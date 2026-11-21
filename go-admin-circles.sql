-- go-admin-circles.sql — Admin: Circles-Liste, Coach je Circle, Teilnehmer hinzufügen; Nutzer pausieren
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-circle.sql, go-circle-events.sql, go-wa-reminder.sql.
--
-- go_circle_members           wer in welchem Circle ist (Spiegel der FFC-Mitgliedschaft, source 'ffc'),
--                             plus vom Admin hinzugefügte Teilnehmer (source 'admin'; die App tritt dann in FFC bei, wenn FFC das erlaubt)
-- go_sync_my_circles(groups)  App meldet beim Start die eigenen FFC-Circles; zurück kommen vom Admin hinzugefügte Circles
-- go_admin_circles()          Liste für Admin → Circles
-- go_admin_set_circle_coach   Coach eines Circles setzen oder entfernen (null)
-- go_admin_add_circle_members Teilnehmer hinzufügen
-- go_admin_user_links()       Gruppe und Circle je Nutzer (Admin → Nutzer)
-- go_accounts.paused_at       Nutzer pausiert (keine WhatsApp-Erinnerung, Hinweis im Admin)

alter table go_accounts add column if not exists paused_at timestamptz;

create table if not exists go_circle_members (
  group_id text not null,
  account_id uuid not null references go_accounts(id) on delete cascade,
  source text not null default 'ffc' check (source in ('ffc', 'admin')),
  added_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, account_id)
);
alter table go_circle_members enable row level security;
drop policy if exists "go_circle_members_select" on go_circle_members;
create policy "go_circle_members_select" on go_circle_members for select to anon, authenticated
  using (account_id = go_current_account_id() or go_is_admin());
-- Schreiben nur über die Funktionen

create or replace function go_sync_my_circles(p_groups jsonb)
returns table (group_id text, name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me uuid := go_current_account_id();
  g jsonb;
  ids text[];
begin
  if me is null then return; end if;
  ids := array(select x->>'id' from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) x where coalesce(x->>'id', '') <> '');
  for g in select * from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) loop
    continue when coalesce(g->>'id', '') = '';
    insert into go_circles (group_id, name, owner_id)
    values (g->>'id', coalesce(g->>'name', ''), case when coalesce((g->>'owner')::boolean, false) then me end)
    on conflict (group_id) do update
      set name = case when coalesce(excluded.name, '') <> '' then excluded.name else go_circles.name end,
          owner_id = coalesce(go_circles.owner_id, excluded.owner_id);
    insert into go_circle_members (group_id, account_id, source)
    values (g->>'id', me, 'ffc')
    on conflict (group_id, account_id) do update set source = 'ffc';
  end loop;
  delete from go_circle_members m where m.account_id = me and m.source = 'ffc' and not (m.group_id = any (ids));
  return query
    select m.group_id, coalesce(c.name, 'Circle')
    from go_circle_members m left join go_circles c on c.group_id = m.group_id
    where m.account_id = me and m.source = 'admin';
end $$;
grant execute on function go_sync_my_circles(jsonb) to anon, authenticated;

create or replace function go_admin_circles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'group_id', c.group_id,
      'name', c.name,
      'locations', c.locations,
      'online', c.online,
      'owner', (select jsonb_build_object('id', a.id, 'name', a.name) from go_accounts a where a.id = c.owner_id),
      'photo_url', (select p.photo_url from go_circle_photos p where p.group_id = c.group_id),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'source', m.source) order by a.name)
        from go_circle_members m join go_accounts a on a.id = m.account_id
        where m.group_id = c.group_id), '[]'::jsonb),
      'last', coalesce((
        select jsonb_agg(jsonb_build_object('at', x.starts_at, 'n', x.n) order by x.starts_at desc)
        from (
          select e.starts_at,
                 1 + (select count(*) from event_rsvps r where r.event_id = e.id and r.status = 'zugesagt') as n
          from events e
          where e.status <> 'ausgefallen' and e.starts_at < now()
            and (e.circle_id = c.group_id or (e.circle_id is null and e.category = 'zirkel' and c.owner_id is not null and e.user_id = c.owner_id))
          order by e.starts_at desc
          limit 3
        ) x), '[]'::jsonb)
    ) order by c.name)
    from go_circles c
  ), '[]'::jsonb);
end $$;
grant execute on function go_admin_circles() to anon, authenticated;

create or replace function go_admin_set_circle_coach(p_group text, p_account uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update go_circles set owner_id = p_account, updated_at = now() where group_id = p_group;
  return 'ok';
end $$;
grant execute on function go_admin_set_circle_coach(text, uuid) to anon, authenticated;

create or replace function go_admin_add_circle_members(p_group text, p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  insert into go_circle_members (group_id, account_id, source, added_by)
  select p_group, x, 'admin', go_current_account_id() from unnest(coalesce(p_ids, '{}')) x
  on conflict (group_id, account_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function go_admin_add_circle_members(text, uuid[]) to anon, authenticated;

create or replace function go_admin_user_links()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return coalesce((
    select jsonb_object_agg(a.id::text, jsonb_build_object(
      'groups', coalesce((
        select jsonb_agg(distinct g.name)
        from groups g
        where g.created_by = a.id
           or exists (select 1 from group_members m where m.group_id = g.id and m.account_id = a.id and m.status = 'accepted')), '[]'::jsonb),
      'circles', coalesce((
        select jsonb_agg(distinct coalesce(nullif(c.name, ''), 'Circle'))
        from go_circle_members m left join go_circles c on c.group_id = m.group_id
        where m.account_id = a.id), '[]'::jsonb)))
    from go_accounts a
  ), '{}'::jsonb);
end $$;
grant execute on function go_admin_user_links() to anon, authenticated;

create or replace function go_admin_pause_account(p_account uuid, p_on boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update go_accounts set paused_at = case when p_on then now() else null end where id = p_account;
  return case when p_on then 'paused' else 'active' end;
end $$;
grant execute on function go_admin_pause_account(uuid, boolean) to anon, authenticated;

-- WhatsApp-Erinnerung: pausierte Nutzer fallen aus der Liste (sonst wie go-wa-reminder.sql)
create or replace function go_admin_wa_list(p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'Europe/Berlin')::date);
begin
  if not go_is_admin() then
    raise exception 'not admin';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.name)
    from (
      select a.id as account_id, a.name, a.nickname, a.phone, a.photo_url,
        (select l.sent_at from go_wa_reminder_log l where l.account_id = a.id and l.day = v_day) as sent_at,
        (select jsonb_agg(jsonb_build_object('title', e.title, 'at', e.starts_at, 'status', e.status) order by e.starts_at)
           from events e where e.user_id = a.id and (e.starts_at at time zone 'Europe/Berlin')::date = v_day
             and e.status <> 'ausgefallen') as today,
        (select jsonb_agg(jsonb_build_object('title', e.title, 'at', e.starts_at) order by e.starts_at)
           from events e where e.user_id = a.id and (e.starts_at at time zone 'Europe/Berlin')::date = v_day + 1
             and e.status = 'geplant') as tomorrow
      from go_accounts a
      where a.wa_reminder and coalesce(a.phone, '') <> '' and a.paused_at is null
    ) x
  ), '[]'::jsonb);
end;
$$;
grant execute on function go_admin_wa_list(date) to anon, authenticated;

-- Orte eines Circles als Admin setzen (ohne den Coach zu ändern)
create or replace function go_admin_save_circle_places(p_group text, p_locations text[], p_online boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update go_circles
  set locations = coalesce((select array_agg(trim(x)) from unnest(p_locations) x where trim(x) <> ''), '{}'),
      online = coalesce(p_online, false), updated_at = now()
  where group_id = p_group;
  return 'ok';
end $$;
grant execute on function go_admin_save_circle_places(text, text[], boolean) to anon, authenticated;

-- Coach-Rolle: verify = blaues c, unverify = nur das c weg, revoke = Coach-Rolle ganz weg
create or replace function go_admin_coach_role(p_account uuid, p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  if p_mode = 'verify' then
    update go_accounts set coach_verified_at = coalesce(coach_verified_at, now()), coach_self_at = coalesce(coach_self_at, now()), is_trainer = true where id = p_account;
  elsif p_mode = 'unverify' then
    update go_accounts set coach_verified_at = null where id = p_account;
  elsif p_mode = 'revoke' then
    update go_accounts set coach_verified_at = null, coach_self_at = null, is_trainer = false where id = p_account;
  else
    raise exception 'mode';
  end if;
  return p_mode;
end $$;
grant execute on function go_admin_coach_role(uuid, text) to anon, authenticated;
