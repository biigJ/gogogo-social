-- 28-Tage Buddy-Challenge Flag + Start
-- Im Supabase SQL Editor ausführen.

alter table go_invite_codes
  add column if not exists challenge_active boolean not null default false;

alter table go_invite_codes
  add column if not exists challenge_started_at timestamptz;

alter table go_accounts
  add column if not exists challenge_active boolean not null default false;

alter table go_accounts
  add column if not exists challenge_started_at timestamptz;

-- Bestehende Update-Policy auf go_invite_codes reicht (go-invite-admin.sql).
-- go_accounts: Update-Policy sollte bereits existieren (go-account.sql / go-mantras).
