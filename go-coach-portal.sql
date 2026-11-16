-- go-coach-portal.sql
-- Coach-Portal in der App: Coach trägt dem Coachee Events direkt ein und schreibt eine Analyse.
-- Idempotent. Voraussetzung: go-courses-support.sql (go_is_coach_of, events-Policies).
--
--   events.assigned_by      wer das Event eingetragen hat (Coach), sonst null
--   events_insert_own       Coach darf für Coachees anlegen
--   events_delete_own       Coach darf von ihm eingetragene, noch geplante Events löschen
--   coach_notes             Analyse/Notiz des Coaches je Coachee

alter table events
  add column if not exists assigned_by uuid references go_accounts(id) on delete set null;

drop policy if exists "events_insert_own" on events;
create policy "events_insert_own"
  on events for insert to anon, authenticated
  with check (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );

drop policy if exists "events_delete_own" on events;
create policy "events_delete_own"
  on events for delete to anon, authenticated
  using (
    user_id = go_current_account_id()
    or (go_is_coach_of(user_id) and assigned_by = go_current_account_id() and status = 'geplant')
    or go_current_account_id() is null
  );

create table if not exists coach_notes (
  coach_id uuid not null references go_accounts(id) on delete cascade,
  coachee_id uuid not null references go_accounts(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (coach_id, coachee_id)
);

alter table coach_notes enable row level security;

drop policy if exists "coach_notes_rw" on coach_notes;
create policy "coach_notes_rw"
  on coach_notes for all to anon, authenticated
  using (coach_id = go_current_account_id() or go_current_account_id() is null)
  with check (coach_id = go_current_account_id() or go_current_account_id() is null);

grant select, insert, update, delete on coach_notes to anon, authenticated;

-- Kurzcheck
select
  (select count(*) from information_schema.columns where table_name = 'events' and column_name = 'assigned_by') as assigned_by_spalte,
  (select count(*) from coach_notes) as notizen;
