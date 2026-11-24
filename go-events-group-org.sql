-- go-events-group-org.sql — Gruppe ist Organisation, keine Sichtbarkeit
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-visibility-fein.sql (go_is_group_member).
-- Events mit group_id sehen alle Mitglieder der Gruppe, solange sie nicht privat sind.
-- Die Sichtbarkeit (Community, Bubble …) gilt daneben wie gewohnt, z. B. sehen Freunde ein erledigtes Gruppentraining.

drop policy if exists "events_select_group_org" on events;
create policy "events_select_group_org" on events for select to anon, authenticated
  using (group_id is not null and coalesce(visibility, 'team') not in ('privat', 'coach') and go_is_group_member(group_id));
