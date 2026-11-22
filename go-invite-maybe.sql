-- go-invite-maybe.sql — Einladungen: „Vielleicht“ als eigener Status
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-workout-invites.sql.
-- Dialog: Annehmen (accepted) · Klappt nicht (declined) · Vielleicht (maybe). Kein „Später“ mehr.

alter table go_workout_invites drop constraint if exists go_workout_invites_status_check;
alter table go_workout_invites
  add constraint go_workout_invites_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled', 'maybe'));
