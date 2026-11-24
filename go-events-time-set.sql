-- go-events-time-set.sql — Zeitpunkt, an dem die Uhrzeit eines Events gesetzt wurde
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Nutzen: Herz-Meldung „Mimi trainiert morgen um 18:00“ für Freunde. Lesen regelt die bestehende events-RLS
-- (privat sieht niemand außer Ersteller, Coach, Eingeladene).
alter table events add column if not exists time_set_at timestamptz;
create index if not exists events_time_set_at_idx on events (time_set_at) where time_set_at is not null;
