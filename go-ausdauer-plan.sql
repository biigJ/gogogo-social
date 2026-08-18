-- Wochentage Kraft/Ausdauer + Ausdauer-Voreinstellungen und Logs
-- Im Supabase SQL Editor ausführen (agpysewcsakdpmpftndp).

alter table go_coach_plans
  add column if not exists kraft_weekdays jsonb not null default '[]'::jsonb;

alter table go_coach_plans
  add column if not exists ausdauer_weekdays jsonb not null default '[]'::jsonb;

create table if not exists go_ausdauer_presets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  source text not null default 'trainer',
  technique text not null,
  incline numeric,
  duration_min numeric,
  speed numeric,
  hr_avg numeric,
  created_at timestamptz not null default now()
);

create index if not exists go_ausdauer_presets_account_idx
  on go_ausdauer_presets (account_id, source);

alter table go_ausdauer_presets enable row level security;

drop policy if exists "go_ausdauer_presets_select_anon" on go_ausdauer_presets;
create policy "go_ausdauer_presets_select_anon"
  on go_ausdauer_presets for select
  to anon, authenticated
  using (true);

drop policy if exists "go_ausdauer_presets_insert_anon" on go_ausdauer_presets;
create policy "go_ausdauer_presets_insert_anon"
  on go_ausdauer_presets for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_ausdauer_presets_update_anon" on go_ausdauer_presets;
create policy "go_ausdauer_presets_update_anon"
  on go_ausdauer_presets for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_ausdauer_presets_delete_anon" on go_ausdauer_presets;
create policy "go_ausdauer_presets_delete_anon"
  on go_ausdauer_presets for delete
  to anon, authenticated
  using (true);

create table if not exists go_ausdauer_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  workout_date date not null default (current_date),
  technique text not null,
  incline numeric,
  duration_min numeric,
  speed numeric,
  hr_avg numeric,
  created_at timestamptz not null default now()
);

create index if not exists go_ausdauer_logs_account_idx
  on go_ausdauer_logs (account_id, workout_date desc);

alter table go_ausdauer_logs enable row level security;

drop policy if exists "go_ausdauer_logs_select_anon" on go_ausdauer_logs;
create policy "go_ausdauer_logs_select_anon"
  on go_ausdauer_logs for select
  to anon, authenticated
  using (true);

drop policy if exists "go_ausdauer_logs_insert_anon" on go_ausdauer_logs;
create policy "go_ausdauer_logs_insert_anon"
  on go_ausdauer_logs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_ausdauer_logs_delete_anon" on go_ausdauer_logs;
create policy "go_ausdauer_logs_delete_anon"
  on go_ausdauer_logs for delete
  to anon, authenticated
  using (true);

alter table go_ausdauer_presets
  add column if not exists distance_km numeric;

alter table go_ausdauer_logs
  add column if not exists distance_km numeric;
