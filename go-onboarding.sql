-- go-onboarding.sql — Erste Schritte für neue Nutzer nur einmal je Konto (auch auf neuem Gerät)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Ohne die Spalte merkt sich nur das Gerät, dass die ersten Schritte durch sind.

alter table go_accounts add column if not exists onboarded_at timestamptz;
-- Bestehende Konten haben die App schon eingerichtet
update go_accounts set onboarded_at = coalesce(onboarded_at, created_at) where created_at < now() - interval '1 day';
