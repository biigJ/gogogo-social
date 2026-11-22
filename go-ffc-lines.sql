-- go-ffc-lines.sql — FFC-Aufzeichnungen mit Stationen und Werten in gogogo spiegeln (Admin → Circle-PDF „Letztes Workout“)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-ffc-punkte.sql.
--
-- go_ffc_sessions.lines  Runden wie in der App unter Aufzeichnungen: [{ "label": "R1 · Rudern", "value": "1250 m · 84 P" }, …]
--                        Die App schreibt sie beim nächsten Start mit FFC-Login nach (auch für ältere Trainings).

alter table go_ffc_sessions add column if not exists lines jsonb;
