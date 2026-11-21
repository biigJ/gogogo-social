-- go-visibility-fein.sql — Wer sieht ein Event: privat, Gruppe, Circle, Bubble, Team (Woche → Tage bearbeiten)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-visibility-team.sql, go-bubbles.sql.
--
-- privat  nur ich
-- gruppe  Mitglieder meiner Gruppe (events.group_id)          → bestehende Policy events_select_visible
-- circle  nur im Circle der Zirkel-App (FFC); in gogogo wie privat
-- bubble  nur Mitglieder meiner Bubble (events.bubble_id)     → events_select_bubble
-- team    alle Freunde                                        → events_select_visible
-- Bubble-markierte Team-Events sehen wie bisher auch die Bubble-Mitglieder.

alter table events drop constraint if exists events_visibility_check;
alter table events add constraint events_visibility_check
  check (visibility in ('privat', 'team', 'gruppe', 'bubble', 'circle'));

drop policy if exists "events_select_bubble" on events;
create policy "events_select_bubble" on events for select to anon, authenticated
  using (bubble_id is not null and coalesce(visibility, 'team') not in ('privat', 'circle', 'gruppe') and go_in_my_bubble(bubble_id));
