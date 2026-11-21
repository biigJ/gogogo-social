-- go-hyrox-doubles.sql — HYROX-Double-Termine eines Circles (Team-Ergebnisse je Station) und Leaderboard
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin-circles.sql.
--
-- go_hyrox_doubles                 eine Zeile je Team und Termin. results: Werte je Station in Meter bzw. Wiederholungen
--                                  (Schlüssel wie in FFC: row, skierg, sledpush, sledhybrid, farmers, wallballs, lunges, bike_m, burpeebox).
--                                  station_order: Reihenfolge, in der das Team die Stationen gemacht hat (leer = unbekannt).
-- go_circle_hyrox_doubles(group)   Ergebnisse für Mitglieder des Circles (go_circle_members), den Coach und Admins
-- Schreiben nur Admins. Punkte rechnet die App (natalyaalice/hyrox-doubles.js), damit die Formel ohne SQL anpassbar bleibt.

create table if not exists go_hyrox_doubles (
  id uuid primary key default gen_random_uuid(),
  circle_id text not null,
  day date not null,
  title text not null default 'HYROX Double',
  category text not null check (category in ('Männer', 'Frauen', 'Mix', 'nicht gewertet')),
  team text not null,
  account_ids uuid[] not null default '{}',
  results jsonb not null default '{}'::jsonb,
  station_order text[],
  board_place int,
  board_points numeric,
  work_sec int not null default 360,
  rest_sec int not null default 60,
  created_at timestamptz not null default now(),
  unique (circle_id, day, team)
);

alter table go_hyrox_doubles enable row level security;
drop policy if exists "go_hyrox_doubles_admin" on go_hyrox_doubles;
create policy "go_hyrox_doubles_admin" on go_hyrox_doubles for all to anon, authenticated
  using (go_is_admin()) with check (go_is_admin());

create or replace function go_circle_hyrox_doubles(p_group text)
returns setof go_hyrox_doubles
language sql
stable
security definer
set search_path = public
as $$
  select d.* from go_hyrox_doubles d
  where d.circle_id = p_group
    and (
      go_is_admin()
      or exists (select 1 from go_circle_members m where m.group_id = p_group and m.account_id = go_current_account_id())
      or exists (select 1 from go_circles c where c.group_id = p_group and c.owner_id = go_current_account_id())
    )
  order by d.day desc, d.category, d.team;
$$;
grant execute on function go_circle_hyrox_doubles(text) to anon, authenticated;
