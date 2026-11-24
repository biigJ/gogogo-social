-- Online-Status (grüner Punkt am Profilkreis) und Privatsphäre-Schalter
-- last_active_at: Herzschlag der offenen App (jede Minute, beim Schließen zurückgesetzt)
-- show_online: false = es wird gar kein Herzschlag gespeichert
alter table go_accounts add column if not exists last_active_at timestamptz;
alter table go_accounts add column if not exists show_online boolean not null default true;
