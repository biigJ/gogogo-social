-- Intervall-Training: Rundenwerte je Übung (PB + Durchschnitt im Training-Tab)
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).

create table if not exists go_training_interval_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  workout_date date not null default (current_date),
  exercise_id text not null,
  exercise_name text not null,
  work_sec smallint not null check (work_sec >= 30 and work_sec <= 480),
  amount numeric not null check (amount >= 0),
  round_num smallint,
  created_at timestamptz not null default now()
);

create index if not exists go_training_interval_logs_account_idx
  on go_training_interval_logs (account_id);

create index if not exists go_training_interval_logs_pb_idx
  on go_training_interval_logs (account_id, exercise_id, work_sec);

create index if not exists go_training_interval_logs_date_idx
  on go_training_interval_logs (account_id, workout_date);

alter table go_training_interval_logs enable row level security;

drop policy if exists "go_training_interval_logs_select_anon" on go_training_interval_logs;
create policy "go_training_interval_logs_select_anon"
  on go_training_interval_logs for select
  to anon, authenticated
  using (true);

drop policy if exists "go_training_interval_logs_insert_anon" on go_training_interval_logs;
create policy "go_training_interval_logs_insert_anon"
  on go_training_interval_logs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_training_interval_logs_update_anon" on go_training_interval_logs;
create policy "go_training_interval_logs_update_anon"
  on go_training_interval_logs for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_training_interval_logs_delete_anon" on go_training_interval_logs;
create policy "go_training_interval_logs_delete_anon"
  on go_training_interval_logs for delete
  to anon, authenticated
  using (true);
