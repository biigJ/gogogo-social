-- go-hyrox-eintragen.sql — HYROX Doubles in der App eintragen: Termine mit Stationen, Teams und Werte
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-hyrox-doubles.sql, go-admin-circles.sql.
--
-- go_hyrox_events                        ein Termin je Circle und Tag, Stationen in der Reihenfolge an der Tafel
-- go_circle_hyrox_meta(group)            Rolle (coach | member), Termine, Personen für die Partnerwahl
-- go_hyrox_event_save(group, day, title, stations, work_sec)   Coach und Admin: Termin anlegen oder ändern
-- go_hyrox_team_save(id, group, day, category, team, ids, results)
--                                        Coach und Admin: jedes Team; Mitglieder: nur das eigene (eigene ID in ids)
-- go_hyrox_team_delete(id)               wie oben
-- Coach = Besitzer des Circles (go_circles.owner_id). Mitglied = go_circle_members oder schon in einem Team des Circles.

create table if not exists go_hyrox_events (
  circle_id text not null,
  day date not null,
  title text not null default 'HYROX Double',
  stations text[] not null default '{}',
  work_sec int not null default 360,
  rest_sec int not null default 60,
  created_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (circle_id, day)
);
alter table go_hyrox_events enable row level security;
drop policy if exists "go_hyrox_events_admin" on go_hyrox_events;
create policy "go_hyrox_events_admin" on go_hyrox_events for all to anon, authenticated
  using (go_is_admin()) with check (go_is_admin());

-- die beiden Termine im FF Schönhauser HYROX
insert into go_hyrox_events (circle_id, day, stations) values
  ('3', '2026-11-08', array['row', 'sledhybrid', 'skierg', 'farmers', 'wallballs', 'lunges', 'burpeebox']),
  ('3', '2026-11-17', array['row', 'sledpush', 'bike_m', 'skierg', 'farmers', 'wallballs', 'lunges'])
on conflict (circle_id, day) do nothing;

create or replace function go_hyrox_role(p_group text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when go_current_account_id() is null then null
    when go_is_admin() or exists (select 1 from go_circles c where c.group_id = p_group and c.owner_id = go_current_account_id()) then 'coach'
    when exists (select 1 from go_circle_members m where m.group_id = p_group and m.account_id = go_current_account_id())
      or exists (select 1 from go_hyrox_doubles d where d.circle_id = p_group and go_current_account_id() = any (d.account_ids)) then 'member'
  end;
$$;
grant execute on function go_hyrox_role(text) to anon, authenticated;

create or replace function go_circle_hyrox_meta(p_group text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r text := go_hyrox_role(p_group);
begin
  if r is null then return jsonb_build_object('role', null, 'events', '[]'::jsonb, 'people', '[]'::jsonb); end if;
  return jsonb_build_object(
    'role', r,
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.day desc) from go_hyrox_events e where e.circle_id = p_group), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.name)
      from go_accounts a
      where a.id in (
        select m.account_id from go_circle_members m where m.group_id = p_group
        union select c.owner_id from go_circles c where c.group_id = p_group and c.owner_id is not null
        union select unnest(d.account_ids) from go_hyrox_doubles d where d.circle_id = p_group
      )
    ), '[]'::jsonb)
  );
end $$;
grant execute on function go_circle_hyrox_meta(text) to anon, authenticated;

create or replace function go_hyrox_event_save(p_group text, p_day date, p_title text, p_stations text[], p_work_sec int default 360)
returns go_hyrox_events
language plpgsql
security definer
set search_path = public
as $$
declare
  out_row go_hyrox_events;
begin
  if go_hyrox_role(p_group) is distinct from 'coach' then raise exception 'not_allowed'; end if;
  insert into go_hyrox_events (circle_id, day, title, stations, work_sec, created_by)
  values (p_group, p_day, coalesce(nullif(trim(p_title), ''), 'HYROX Double'), coalesce(p_stations, '{}'), coalesce(p_work_sec, 360), go_current_account_id())
  on conflict (circle_id, day) do update
    set title = excluded.title, stations = excluded.stations, work_sec = excluded.work_sec
  returning * into out_row;
  return out_row;
end $$;
grant execute on function go_hyrox_event_save(text, date, text, text[], int) to anon, authenticated;

create or replace function go_hyrox_team_save(p_id uuid, p_group text, p_day date, p_category text, p_team text, p_ids uuid[], p_results jsonb)
returns go_hyrox_doubles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  r text := go_hyrox_role(p_group);
  ev go_hyrox_events;
  cur go_hyrox_doubles;
  out_row go_hyrox_doubles;
begin
  if r is null then raise exception 'not_allowed'; end if;
  select * into ev from go_hyrox_events where circle_id = p_group and day = p_day;
  if ev.circle_id is null then raise exception 'no_event'; end if;
  if r <> 'coach' and not (me = any (coalesce(p_ids, '{}'))) then raise exception 'not_allowed'; end if;
  if p_id is null then
    insert into go_hyrox_doubles (circle_id, day, title, category, team, account_ids, results, work_sec, rest_sec)
    values (p_group, p_day, ev.title, p_category, trim(p_team), coalesce(p_ids, '{}'), coalesce(p_results, '{}'::jsonb), ev.work_sec, ev.rest_sec)
    returning * into out_row;
  else
    select * into cur from go_hyrox_doubles where id = p_id and circle_id = p_group;
    if cur.id is null then raise exception 'not_found'; end if;
    if r <> 'coach' and not (me = any (cur.account_ids)) then raise exception 'not_allowed'; end if;
    update go_hyrox_doubles
      set category = coalesce(p_category, category), team = coalesce(nullif(trim(p_team), ''), team),
          account_ids = coalesce(p_ids, account_ids), results = coalesce(p_results, results)
      where id = p_id
      returning * into out_row;
  end if;
  return out_row;
exception when unique_violation then
  raise exception 'team_exists';
end $$;
grant execute on function go_hyrox_team_save(uuid, text, date, text, text, uuid[], jsonb) to anon, authenticated;

create or replace function go_hyrox_team_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur go_hyrox_doubles;
begin
  select * into cur from go_hyrox_doubles where id = p_id;
  if cur.id is null then return; end if;
  if go_hyrox_role(cur.circle_id) is distinct from 'coach' and not (go_current_account_id() = any (cur.account_ids)) then raise exception 'not_allowed'; end if;
  delete from go_hyrox_doubles where id = p_id;
end $$;
grant execute on function go_hyrox_team_delete(uuid) to anon, authenticated;
