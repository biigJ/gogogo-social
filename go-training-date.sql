-- Personal Training Termin in go_accounts speichern
-- Im Supabase SQL Editor ausführen (Projekt agpysewcsakdpmpftndp).

alter table go_accounts
  add column if not exists training_date timestamptz;
