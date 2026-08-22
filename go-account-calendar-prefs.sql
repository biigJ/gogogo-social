-- Kalender-Sync Einstellungen (Google / Apple)
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists calendar_provider text;

alter table go_accounts
  add column if not exists calendar_privacy_accepted boolean not null default false;

-- calendar_provider: 'google' | 'apple' | null
