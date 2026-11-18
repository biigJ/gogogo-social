-- go-event-requests.sql — Winken: Anfrage, bei einem Event eines Freundes mitzumachen
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Ablauf: Freund tippt auf die winkende Hand → Zeile hier (pending). Der Ersteller bekommt beim Öffnen
-- der App bzw. bei Refresh einen Dialog. Annehmen legt eine angenommene Einladung an (go_workout_invites).

create table if not exists go_event_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  from_id uuid not null references go_accounts(id) on delete cascade,
  to_id uuid not null references go_accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (event_id, from_id)
);
create index if not exists go_event_requests_to_idx on go_event_requests (to_id, status);

alter table go_event_requests enable row level security;
drop policy if exists "go_event_requests_select" on go_event_requests;
create policy "go_event_requests_select" on go_event_requests for select to anon, authenticated
  using (from_id = go_current_account_id() or to_id = go_current_account_id());
drop policy if exists "go_event_requests_insert" on go_event_requests;
create policy "go_event_requests_insert" on go_event_requests for insert to anon, authenticated
  with check (from_id = go_current_account_id());
drop policy if exists "go_event_requests_update" on go_event_requests;
create policy "go_event_requests_update" on go_event_requests for update to anon, authenticated
  using (to_id = go_current_account_id()) with check (to_id = go_current_account_id());
