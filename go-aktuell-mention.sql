-- go-aktuell-mention.sql — Nachricht mit @Name an genau eine Person (Sprechblase in Aktuell)
-- Idempotent. Voraussetzung: go-aktuell-posts.sql.
-- to_id: erwähnte Person; recipients enthält dann nur sie (sehen dürfen weiter Autor und Empfänger).

alter table go_aktuell_posts add column if not exists to_id uuid references go_accounts(id) on delete set null;
