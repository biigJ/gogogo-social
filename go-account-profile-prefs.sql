-- Profil-Präferenzen: Ziel, Sprache, Stadtteil, Open to Connect
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists training_goal text;

alter table go_accounts
  add column if not exists spoken_lang text;

alter table go_accounts
  add column if not exists city_area text;

alter table go_accounts
  add column if not exists open_to_connect boolean not null default false;

create index if not exists go_accounts_open_connect_idx
  on go_accounts (open_to_connect)
  where open_to_connect = true;
