-- go-exercise-links.sql — Nutzer speichern eigene Übungsvideo-Links, andere vergeben Sterne
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- Reihenfolge je Übung: zuerst der Link von gogogo (go_exercise_media), dahinter die Nutzer-Links nach Sternen.
-- Hat gogogo keinen Link, rückt der Nutzer-Link mit den meisten Sternen an die erste Stelle
-- (auch für das Abspielen-Symbol in der Workout-Ansicht).

create table if not exists go_exercise_links (
  id uuid primary key default gen_random_uuid(),
  name_key text not null,
  name text not null,
  url text not null,
  added_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name_key, url)
);
create index if not exists go_exercise_links_key_idx on go_exercise_links (name_key);

create table if not exists go_exercise_link_stars (
  link_id uuid not null references go_exercise_links(id) on delete cascade,
  account_id uuid not null references go_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (link_id, account_id)
);

alter table go_exercise_links enable row level security;
alter table go_exercise_link_stars enable row level security;

drop policy if exists "go_exercise_links_select" on go_exercise_links;
create policy "go_exercise_links_select" on go_exercise_links for select to anon, authenticated using (true);
drop policy if exists "go_exercise_links_insert" on go_exercise_links;
create policy "go_exercise_links_insert" on go_exercise_links for insert to anon, authenticated
  with check (added_by = go_current_account_id());
drop policy if exists "go_exercise_links_delete" on go_exercise_links;
create policy "go_exercise_links_delete" on go_exercise_links for delete to anon, authenticated
  using (added_by = go_current_account_id() or go_is_admin());

drop policy if exists "go_exercise_link_stars_select" on go_exercise_link_stars;
create policy "go_exercise_link_stars_select" on go_exercise_link_stars for select to anon, authenticated using (true);
drop policy if exists "go_exercise_link_stars_write" on go_exercise_link_stars;
create policy "go_exercise_link_stars_write" on go_exercise_link_stars for all to anon, authenticated
  using (account_id = go_current_account_id())
  with check (account_id = go_current_account_id());

create or replace view go_exercise_links_ranked with (security_invoker = true) as
select l.id, l.name_key, l.name, l.url, l.added_by, l.created_at,
       (select count(*) from go_exercise_link_stars s where s.link_id = l.id)::int as stars,
       (select a.name from go_accounts a where a.id = l.added_by) as added_by_name
from go_exercise_links l;

grant select on go_exercise_links_ranked to anon, authenticated;
