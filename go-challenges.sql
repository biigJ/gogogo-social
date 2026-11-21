-- go-challenges.sql — Challenge in Meine Gruppe + verknüpfte Stempelkarten (Gruppe und Circle)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Voraussetzung: go-visibility-team.sql, go-group-requests.sql, go-stamp-punctual.sql.
--
-- go_challenges     eine laufende Challenge je Gruppe (Name, Ziel, Ersteller, Stempelkarten verknüpft ja/nein)
--                   Ziel = was die Gruppe ausmacht, z. B. „Wer als Letzter die Stempelkarte voll hat, gibt allen einen Kaffee aus.“
-- go_stamp_links    zusätzliche Stempelkarte je Person für eine Gruppe oder einen Circle (eigener Zähler, Überschrift = Name)
--                   status 'pending' (Mitglied muss bestätigen, Herz in Aktuell) oder 'linked'
-- Stempel: Sobald eine Pünktlichkeits-Prüfung fertig ist (go_stamp_checks.done_at), bekommt jede verknüpfte Karte
--          dieselben Stempel, wenn der Trainingspartner dieselbe Gruppe bzw. denselben Circle verknüpft hat.

create table if not exists go_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  link_stamps boolean not null default false,
  created_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table go_challenges add column if not exists goal text check (char_length(goal) <= 200);
create unique index if not exists go_challenges_one_active on go_challenges (group_id) where ended_at is null;

alter table go_challenges enable row level security;
drop policy if exists "go_challenges_select" on go_challenges;
create policy "go_challenges_select" on go_challenges for select to anon, authenticated
  using (
    exists (select 1 from groups g where g.id = group_id and g.created_by = go_current_account_id())
    or go_is_group_member(group_id)
  );

create table if not exists go_stamp_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  kind text not null check (kind in ('group', 'circle')),
  ref text not null,
  name text not null default '',
  challenge_id uuid references go_challenges(id) on delete set null,
  invited_by uuid references go_accounts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'linked')),
  stamps int not null default 0 check (stamps between 0 and 12),
  created_at timestamptz not null default now(),
  unique (account_id, kind, ref)
);

alter table go_stamp_links enable row level security;
drop policy if exists "go_stamp_links_select" on go_stamp_links;
create policy "go_stamp_links_select" on go_stamp_links for select to anon, authenticated
  using (account_id = go_current_account_id());
-- Schreiben nur über die Funktionen

-- Challenge anlegen (nur Ersteller der Gruppe). Mit Verknüpfung: Ersteller sofort verknüpft, Mitglieder bestätigen.
drop function if exists go_create_challenge(uuid, text, boolean);
create or replace function go_create_challenge(p_group uuid, p_name text, p_link boolean default false, p_goal text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  g groups%rowtype;
  ch uuid;
begin
  select * into g from groups where id = p_group;
  if g.id is null or g.created_by is distinct from me then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;
  if exists (select 1 from go_challenges where group_id = p_group and ended_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  insert into go_challenges (group_id, name, goal, link_stamps, created_by)
  values (p_group, trim(p_name), nullif(trim(coalesce(p_goal, '')), ''), coalesce(p_link, false), me)
  returning id into ch;
  if p_link then
    insert into go_stamp_links (account_id, kind, ref, name, challenge_id, invited_by, status)
    values (me, 'group', p_group::text, g.name, ch, me, 'linked')
    on conflict (account_id, kind, ref) do update set challenge_id = excluded.challenge_id, name = excluded.name, status = 'linked';
    insert into go_stamp_links (account_id, kind, ref, name, challenge_id, invited_by, status)
    select m.account_id, 'group', p_group::text, g.name, ch, me, 'pending'
    from group_members m
    where m.group_id = p_group and m.status = 'accepted' and m.account_id <> me
    on conflict (account_id, kind, ref) do update set challenge_id = excluded.challenge_id, name = excluded.name;
  end if;
  return jsonb_build_object('ok', true, 'id', ch);
end $$;
grant execute on function go_create_challenge(uuid, text, boolean, text) to anon, authenticated;

-- Challenge beenden (Ersteller). Verknüpfte Karten bleiben mit ihren Stempeln.
create or replace function go_end_challenge(p_challenge uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update go_challenges c set ended_at = now()
  where c.id = p_challenge and c.ended_at is null
    and exists (select 1 from groups g where g.id = c.group_id and g.created_by = go_current_account_id())
  returning true;
$$;
grant execute on function go_end_challenge(uuid) to anon, authenticated;

-- Offene Verknüpfungen an mich (Herz): Gruppe, Challenge, wer fragt
drop function if exists go_my_stamp_link_requests();
create or replace function go_my_stamp_link_requests()
returns table (link_id uuid, group_name text, challenge_name text, challenge_goal text, from_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.name, c.name, c.goal, a.name, l.created_at
  from go_stamp_links l
  left join go_challenges c on c.id = l.challenge_id
  left join go_accounts a on a.id = l.invited_by
  where l.account_id = go_current_account_id() and l.status = 'pending'
  order by l.created_at desc;
$$;
grant execute on function go_my_stamp_link_requests() to anon, authenticated;

create or replace function go_answer_stamp_link(p_link uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_accept then
    update go_stamp_links set status = 'linked' where id = p_link and account_id = go_current_account_id() and status = 'pending';
    return 'linked';
  end if;
  delete from go_stamp_links where id = p_link and account_id = go_current_account_id() and status = 'pending';
  return 'declined';
end $$;
grant execute on function go_answer_stamp_link(uuid, boolean) to anon, authenticated;

-- Circle: eigene Karte verknüpfen (Plus → Friday Fitness Circle → Circle → Stempelkarte verknüpfen)
create or replace function go_link_circle_card(p_circle text, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
begin
  if me is null or coalesce(trim(p_circle), '') = '' then raise exception 'login'; end if;
  insert into go_stamp_links (account_id, kind, ref, name, invited_by, status)
  values (me, 'circle', trim(p_circle), coalesce(nullif(trim(p_name), ''), 'Circle'), me, 'linked')
  on conflict (account_id, kind, ref) do update set status = 'linked', name = excluded.name;
  return 'linked';
end $$;
grant execute on function go_link_circle_card(text, text) to anon, authenticated;

-- Stempel auf verknüpfte Karten: wenn die Pünktlichkeits-Prüfung fertig ist
create or replace function go_stamp_links_award()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done_at is null or old.done_at is not null then return new; end if;
  if coalesce(new.owner_added, 0) > 0 then
    update go_stamp_links l set stamps = least(12, l.stamps + new.owner_added)
    where l.account_id = new.owner_id and l.status = 'linked'
      and exists (select 1 from go_stamp_links p
                  where p.account_id = new.scanner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref);
  end if;
  if coalesce(new.scanner_added, 0) > 0 then
    update go_stamp_links l set stamps = least(12, l.stamps + new.scanner_added)
    where l.account_id = new.scanner_id and l.status = 'linked'
      and exists (select 1 from go_stamp_links p
                  where p.account_id = new.owner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref);
  end if;
  return new;
end $$;

drop trigger if exists go_stamp_links_award on go_stamp_checks;
create trigger go_stamp_links_award
  after update on go_stamp_checks
  for each row execute function go_stamp_links_award();
