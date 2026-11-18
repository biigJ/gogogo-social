-- go-ffc-punkte.sql — Zirkel-Punkte aus FFC in gogogo spiegeln (All-time- und Double-Leaderboard)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-datenschutz-1.sql.
--
-- FFC (Hendriks Backend) liefert nur Wochenpunkte. Beim Öffnen der App lädt gogogo die eigenen
-- FFC-Trainings (mit derselben Punkteformel) hierher. Daraus rechnet die App „Gesamt“ und Double-Paare.
-- Sichtbar für einen selbst und für Freunde (go_is_friend_of).

create table if not exists go_ffc_sessions (
  id text primary key,                       -- FFC training_sessions.id
  account_id uuid not null references go_accounts(id) on delete cascade,
  day date not null,                         -- Kalendertag Berlin
  started_at timestamptz,
  points int not null default 0,
  rounds int,
  work_sec int,
  rest_sec int,
  synced_at timestamptz not null default now()
);
create index if not exists go_ffc_sessions_acc_day on go_ffc_sessions (account_id, day);

alter table go_ffc_sessions enable row level security;
drop policy if exists "go_ffc_sessions_select" on go_ffc_sessions;
create policy "go_ffc_sessions_select" on go_ffc_sessions for select to anon, authenticated
  using (account_id = go_current_account_id() or go_is_friend_of(account_id) or go_is_admin());
drop policy if exists "go_ffc_sessions_write" on go_ffc_sessions;
create policy "go_ffc_sessions_write" on go_ffc_sessions for all to anon, authenticated
  using (account_id = go_current_account_id()) with check (account_id = go_current_account_id());
