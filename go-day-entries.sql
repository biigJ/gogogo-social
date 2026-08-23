-- Tägliche Workout-Bewertungen (1–10) für /account Kalender + Cycle-Rädchen
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- score 1–10 = Häkchen gesetzt
-- score null = explizit mit X markiert (kein Wert / Null)
-- unit_done = Workout/Alternative abgeschlossen (auch ohne Bewertung)
-- kein Eintrag = Tag unmarkiert

alter table go_day_entries
  add column if not exists unit_choice text check (unit_choice is null or unit_choice in ('workout', 'alternative')),
  add column if not exists unit_done boolean not null default false;

create table if not exists go_day_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  date date not null,
  score smallint check (score is null or (score >= 1 and score <= 10)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, date)
);

create index if not exists go_day_entries_account_date_idx
  on go_day_entries (account_id, date);

alter table go_day_entries enable row level security;

drop policy if exists "go_day_entries_select_anon" on go_day_entries;
create policy "go_day_entries_select_anon"
  on go_day_entries for select
  to anon, authenticated
  using (true);

drop policy if exists "go_day_entries_insert_anon" on go_day_entries;
create policy "go_day_entries_insert_anon"
  on go_day_entries for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_day_entries_update_anon" on go_day_entries;
create policy "go_day_entries_update_anon"
  on go_day_entries for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_day_entries_delete_anon" on go_day_entries;
create policy "go_day_entries_delete_anon"
  on go_day_entries for delete
  to anon, authenticated
  using (true);
