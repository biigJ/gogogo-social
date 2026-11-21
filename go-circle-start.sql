-- go-circle-start.sql — Startdatum je Circle: Leaderboard zählt erst ab Gründung
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-circle-events.sql.
-- Bestehende Circles behalten created_at = null (keine Einschränkung). Neue Zeilen bekommen den Zeitpunkt,
-- an dem der Circle zum ersten Mal in gogogo auftaucht (beim Gründen in der App sofort).

alter table go_circles add column if not exists created_at timestamptz;
alter table go_circles alter column created_at set default now();
