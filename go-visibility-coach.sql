-- go-visibility-coach.sql — Sichtbarkeit „Coach“: Event sehen nur ich und mein Coach
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-visibility-fein.sql.
-- Lesen: der Coach sieht alle Events seiner Coachees schon über events_select_visible (go_is_coach_of),
-- Freunde, Gruppe, Bubble und Circle haben für 'coach' keine Policy → nur Ersteller und Coach.

alter table events drop constraint if exists events_visibility_check;
alter table events add constraint events_visibility_check
  check (visibility in ('privat', 'team', 'gruppe', 'bubble', 'circle', 'coach'));

-- Regeln der Woche (go-woche-regeln.sql) dürfen 'coach' ebenfalls speichern (Spalte ohne Check, nur zur Info)
