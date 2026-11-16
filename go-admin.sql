-- go-admin.sql — Admin in der App: Coach freischalten + Nachrichten (neue Nutzer, Buchungen)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- Admins: Joscha (2d3ab029) und Ben/biigJ (5f86ab1e).
-- is_admin / is_trainer lassen sich nur noch durch Admins (oder im SQL-Editor) ändern.
-- Hinweis: Die Identität kommt bis zum Geheimschlüssel (Datenschutz Stufe 2) aus dem Header x-go-account-id.

alter table go_accounts add column if not exists is_admin boolean not null default false;
alter table go_accounts add column if not exists is_trainer boolean not null default false;

update go_accounts set is_admin = true
where id in ('2d3ab029-0a5f-4388-8da7-52501a87dc8c', '5f86ab1e-2043-4944-8196-1bec0c6b0130')
  and is_admin = false;

create or replace function go_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from go_accounts a
    where a.id = go_current_account_id() and a.is_admin
  );
$$;

-- Rollen-Spalten schützen: anon/authenticated dürfen sie nur als Admin ändern
-- Bewusst ohne security definer: current_user ist dann die Rolle des Aufrufers (anon/authenticated)
create or replace function go_accounts_guard_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or go_is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false;
    new.is_trainer := false;
    return new;
  end if;
  new.is_admin := old.is_admin;
  new.is_trainer := old.is_trainer;
  return new;
end $$;

drop trigger if exists go_accounts_guard_roles on go_accounts;
create trigger go_accounts_guard_roles
  before insert or update on go_accounts
  for each row execute function go_accounts_guard_roles();

-- Coach freischalten / entziehen (offene Coach-Anfrage wird dabei freigeschaltet)
create or replace function go_admin_set_trainer(p_account uuid, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then
    raise exception 'Nur Admins';
  end if;
  update go_accounts set is_trainer = p_on, updated_at = now() where id = p_account;
  if p_on then
    update support_orders o set status = 'freigeschaltet'
    from support_products p
    where p.id = o.product_id and p.type = 'coach_offer'
      and o.user_id = p_account and o.status = 'angefragt';
  end if;
  return p_on;
end $$;

-- Nachrichten: neue Konten und Buchungen inkl. Coach-Anfragen (neueste zuerst)
create or replace function go_admin_inbox(p_limit integer default 80)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_accounts jsonb;
  v_bookings jsonb;
begin
  if not go_is_admin() then
    raise exception 'Nur Admins';
  end if;

  select coalesce(jsonb_agg(x.j order by x.at desc), '[]'::jsonb) into v_accounts
  from (
    select a.created_at as at, jsonb_build_object(
      'at', a.created_at, 'account_id', a.id, 'name', a.name,
      'photo_url', a.photo_url, 'is_trainer', a.is_trainer, 'trainer_id', a.trainer_id
    ) as j
    from go_accounts a
    order by a.created_at desc
    limit p_limit
  ) x;

  select coalesce(jsonb_agg(y.j order by y.at desc), '[]'::jsonb) into v_bookings
  from (
    select * from (
      -- Buchungen mit Katalog-Produkt
      select o.created_at as at, jsonb_build_object(
        'at', o.created_at, 'account_id', o.user_id, 'name', a.name, 'photo_url', a.photo_url,
        'type', p.type, 'title', p.title, 'status', o.status
      ) as j
      from support_orders o
      join support_products p on p.id = o.product_id
      left join go_accounts a on a.id = o.user_id
      union all
      -- Buchungen ohne Katalog-Produkt (z. B. Coach-Anfrage, Routine): activity_log mit meta.type
      select l.created_at, jsonb_build_object(
        'at', l.created_at, 'account_id', l.user_id, 'name', a.name, 'photo_url', a.photo_url,
        'type', l.meta->>'type', 'title', null, 'status', 'gebucht'
      )
      from activity_log l
      left join go_accounts a on a.id = l.user_id
      where l.type = 'support_request' and l.meta ? 'type'
    ) u
    order by u.at desc
    limit p_limit
  ) y;

  return jsonb_build_object('accounts', v_accounts, 'bookings', v_bookings);
end $$;

grant execute on function go_is_admin() to anon, authenticated;
grant execute on function go_admin_set_trainer(uuid, boolean) to anon, authenticated;
grant execute on function go_admin_inbox(integer) to anon, authenticated;
