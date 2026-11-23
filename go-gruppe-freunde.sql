-- go-gruppe-freunde.sql — Gruppen-Events sehen auch die Freunde des Erstellers
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-visibility-team.sql, go-courses-support.sql.
-- Fall: Ben verlässt die Gruppe „Mittagstraining“ → Joschas Gruppen-Events waren für ihn weg,
-- obwohl beide befreundet sind. Neu: Gruppen-Events lesen Gruppenmitglieder UND Freunde des Erstellers.
-- Zusätzliche Policies (Postgres verknüpft Policies mit ODER), bestehende bleiben unverändert.

drop policy if exists "events_select_gruppe_freunde" on events;
create policy "events_select_gruppe_freunde" on events for select to anon, authenticated
  using (visibility = 'gruppe' and go_shares_group_with(user_id));

drop policy if exists "event_rsvps_select_gruppe_freunde" on event_rsvps;
create policy "event_rsvps_select_gruppe_freunde" on event_rsvps for select to anon, authenticated
  using (exists (
    select 1 from events e
    where e.id = event_id and e.visibility = 'gruppe' and go_shares_group_with(e.user_id)
  ));
