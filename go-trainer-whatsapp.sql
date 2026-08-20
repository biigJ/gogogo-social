-- Trainer-WhatsApp + Einladungen an Trainer binden
-- Im Supabase SQL Editor ausführen (agpysewcsakdpmpftndp).
--
-- Was danach noch für echte WA-Push an den Trainer nötig ist:
-- 1) Dieses SQL ausführen (Spalten + Joscha-Default).
-- 2) Jeder Trainer hinterlegt unter /go/admin/?trainer=1 → Menü „WhatsApp-Nummer“
--    seine Mobilnummer im Format +49…
-- 3) Nutzer öffnen nach Signup wa.me zum Trainer (Client-seitig, Nutzer tippt senden).
-- 4) Für automatische Nachricht AN den Trainer (ohne Nutzeraktion) braucht ihr
--    zusätzlich WhatsApp Business API (Meta Cloud API oder Twilio/MessageBird)
--    + einen Worker, der go_wa_jobs mit notify_phone abarbeitet und Templates sendet.
--    Ohne diesen Worker bleibt der Job nur in der Tabelle liegen.

-- WhatsApp-Nummer des Trainers (E.164, z. B. +491701234567)
alter table go_accounts
  add column if not exists whatsapp_phone text;

-- Welche:r Trainer:in hat den Invite-Code erzeugt?
alter table go_invite_codes
  add column if not exists trainer_id uuid references go_accounts(id) on delete set null;

create index if not exists go_invite_codes_trainer_idx
  on go_invite_codes (trainer_id);

-- Optional: Empfänger-Nummer für WA-Jobs (Trainer benachrichtigen)
alter table go_wa_jobs
  add column if not exists notify_phone text;

alter table go_wa_jobs
  add column if not exists trainer_id uuid references go_accounts(id) on delete set null;

-- Joscha/Coach-Default (bestehende Nummer), falls leer
update go_accounts
set whatsapp_phone = '+491747015500'
where (
  lower(coalesce(phone, '')) = 'coach'
  or lower(coalesce(name, '')) = 'joscha'
)
and (whatsapp_phone is null or whatsapp_phone = '');
