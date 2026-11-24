-- go-admin-tickets-bilder.sql — Tickets: Screenshots und Notiz zur technischen Umsetzbarkeit (admin-inbox.js)
-- Idempotent. Voraussetzung: go-admin-tickets.sql. Rechte bleiben wie gehabt: nur Admins.
-- images: Liste von Bild-URLs (Bildspeicher, sonst data-URL), tech_note: Freitext

alter table go_tickets add column if not exists images jsonb not null default '[]'::jsonb;
alter table go_tickets add column if not exists tech_note text;
