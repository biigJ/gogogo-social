-- go-event-requests-withdraw.sql — Winken zurückziehen: wer angefragt hat, darf die offene Anfrage löschen
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-event-requests.sql.
-- (Einladungen zurückziehen braucht kein SQL: go_workout_invites → status 'cancelled'.)

drop policy if exists "go_event_requests_delete_own" on go_event_requests;
create policy "go_event_requests_delete_own" on go_event_requests for delete to anon, authenticated
  using (from_id = go_current_account_id() and status = 'pending');
