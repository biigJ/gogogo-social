-- Nickname pro Account, ohne Rücksicht auf Groß-/Kleinschreibung eindeutig.
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists nickname text;

create unique index if not exists go_accounts_nickname_unique
  on go_accounts (lower(nickname))
  where nickname is not null;

alter table go_accounts
  drop constraint if exists go_accounts_nickname_format;

alter table go_accounts
  add constraint go_accounts_nickname_format
  check (nickname is null or nickname ~ '^[A-Za-z0-9._-]{3,20}$');
