-- Natalya: private Workout-Checkliste unter /natalyaalice
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Eine Zeile pro Datum und Übung.
-- reps      = Wiederholungen (leer bei reinen Haken)
-- weight_kg = Trainingsgewicht, wenn die Übung Gewicht braucht
-- done      = abgehakt bzw. ein Wert ist eingetragen

create table if not exists go_natalya_logs (
  id uuid primary key default gen_random_uuid(),
  workout_date date not null,
  exercise_id text not null,
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg >= 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_date, exercise_id)
);

create index if not exists go_natalya_logs_date_idx
  on go_natalya_logs (workout_date desc, exercise_id);

alter table go_natalya_logs enable row level security;

drop policy if exists "go_natalya_logs_select_anon" on go_natalya_logs;
create policy "go_natalya_logs_select_anon"
  on go_natalya_logs for select
  to anon, authenticated
  using (true);

drop policy if exists "go_natalya_logs_insert_anon" on go_natalya_logs;
create policy "go_natalya_logs_insert_anon"
  on go_natalya_logs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_natalya_logs_update_anon" on go_natalya_logs;
create policy "go_natalya_logs_update_anon"
  on go_natalya_logs for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_natalya_logs_delete_anon" on go_natalya_logs;
create policy "go_natalya_logs_delete_anon"
  on go_natalya_logs for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on go_natalya_logs to anon, authenticated;
