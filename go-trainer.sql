-- Trainer-Rolle und gewählter Trainer pro Account
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists is_trainer boolean not null default false;

alter table go_accounts
  add column if not exists trainer_id uuid references go_accounts(id) on delete set null;

create index if not exists go_accounts_is_trainer_idx
  on go_accounts (is_trainer)
  where is_trainer = true;

create index if not exists go_accounts_trainer_id_idx
  on go_accounts (trainer_id);

-- Bestehenden Joscha-/Coach-Account als Trainer markieren (falls vorhanden)
update go_accounts
set is_trainer = true
where (
  lower(coalesce(phone, '')) = 'coach'
  or lower(coalesce(name, '')) = 'joscha'
)
and is_trainer = false;
