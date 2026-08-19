-- Ausgeblendete Katalog-Übungen (global für alle Nutzer)
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Wenn im Admin eine Standard-Übung aus kraft-catalog.js gelöscht wird,
-- landet sie hier — sie erscheint nicht mehr in der Übungsliste.

create table if not exists go_kraft_hidden (
  system_id text not null,
  exercise_id text not null,
  hidden_at timestamptz not null default now(),
  primary key (system_id, exercise_id)
);

create index if not exists go_kraft_hidden_system_idx
  on go_kraft_hidden (system_id);

alter table go_kraft_hidden enable row level security;

drop policy if exists "go_kraft_hidden_select_anon" on go_kraft_hidden;
create policy "go_kraft_hidden_select_anon"
  on go_kraft_hidden for select
  to anon, authenticated
  using (true);

drop policy if exists "go_kraft_hidden_insert_anon" on go_kraft_hidden;
create policy "go_kraft_hidden_insert_anon"
  on go_kraft_hidden for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_kraft_hidden_delete_anon" on go_kraft_hidden;
create policy "go_kraft_hidden_delete_anon"
  on go_kraft_hidden for delete
  to anon, authenticated
  using (true);
