-- go-events-feed-hidden.sql — „Speichern ohne Posting“: Event erledigt, aber in keinem Feed (auch nicht im eigenen)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Zählt weiter als erledigt (Woche, Ampel, Stempel), erscheint aber nicht in Aktuell.

alter table events add column if not exists feed_hidden boolean not null default false;
