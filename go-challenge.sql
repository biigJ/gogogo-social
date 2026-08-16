-- 28-Tage Buddy-Challenge Flag + Start + Einsatz (€
-- Im Supabase SQL Editor ausführen.

alter table go_invite_codes
  add column if not exists challenge_active boolean not null default false;

alter table go_invite_codes
  add column if not exists challenge_started_at timestamptz;

alter table go_invite_codes
  add column if not exists challenge_amount integer;

alter table go_accounts
  add column if not exists challenge_active boolean not null default false;

alter table go_accounts
  add column if not exists challenge_started_at timestamptz;

alter table go_accounts
  add column if not exists challenge_amount integer;

-- challenge_amount: 30–999 wenn aktiv (Client prüft; DB lockern für Flexibilität)
