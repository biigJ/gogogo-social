-- Kraft: eigene Übungen am Preset + Satzprotokoll (Wdh × kg)
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).

alter table go_kraft_presets
  add column if not exists custom_exercises jsonb not null default '[]'::jsonb;

create table if not exists go_kraft_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  workout_date date not null default (current_date),
  system_id text not null,
  exercise_id text not null,
  exercise_name text not null,
  sets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists go_kraft_logs_account_idx
  on go_kraft_logs (account_id);

create index if not exists go_kraft_logs_lookup_idx
  on go_kraft_logs (account_id, exercise_id, workout_date desc, created_at desc);

alter table go_kraft_logs enable row level security;

drop policy if exists "go_kraft_logs_select_anon" on go_kraft_logs;
create policy "go_kraft_logs_select_anon"
  on go_kraft_logs for select
  to anon, authenticated
  using (true);

drop policy if exists "go_kraft_logs_insert_anon" on go_kraft_logs;
create policy "go_kraft_logs_insert_anon"
  on go_kraft_logs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_kraft_logs_update_anon" on go_kraft_logs;
create policy "go_kraft_logs_update_anon"
  on go_kraft_logs for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_kraft_logs_delete_anon" on go_kraft_logs;
create policy "go_kraft_logs_delete_anon"
  on go_kraft_logs for delete
  to anon, authenticated
  using (true);
