-- Natalya: Wochentage und 12-Wochen-Routine unter /natalyaalice
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
-- Einmalig, zusätzlich zu go-natalya-logs.sql.
--
-- Eine Zeile für Natalya.
-- days       = gewählte Wochentage, z. B. ["tue","sat"]
-- started_on = Start der 12-Wochen-Routine, leer solange sie nicht läuft
-- Vorzeitiges Beenden löscht die Zeile. Die Workout-Logs bleiben.

create table if not exists go_natalya_routine (
  id text primary key,
  name text not null,
  days jsonb not null default '[]'::jsonb,
  started_on date,
  updated_at timestamptz not null default now()
);

alter table go_natalya_routine enable row level security;

drop policy if exists "go_natalya_routine_select_anon" on go_natalya_routine;
create policy "go_natalya_routine_select_anon"
  on go_natalya_routine for select
  to anon, authenticated
  using (true);

drop policy if exists "go_natalya_routine_insert_anon" on go_natalya_routine;
create policy "go_natalya_routine_insert_anon"
  on go_natalya_routine for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_natalya_routine_update_anon" on go_natalya_routine;
create policy "go_natalya_routine_update_anon"
  on go_natalya_routine for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_natalya_routine_delete_anon" on go_natalya_routine;
create policy "go_natalya_routine_delete_anon"
  on go_natalya_routine for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on go_natalya_routine to anon, authenticated;
