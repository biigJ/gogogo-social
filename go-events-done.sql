-- Events: note + photo_url für Erledigt-Dialog (Foto + Text)
-- Idempotent. Im SQL Editor von Supabase ausführen.

alter table events
  add column if not exists note text;

alter table events
  add column if not exists photo_url text;
