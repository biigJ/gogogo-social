-- Buddy-Einladungen: wer hat eingeladen + Quelle
alter table go_invite_codes
  add column if not exists invited_by_account_id uuid references go_accounts(id) on delete set null;

alter table go_invite_codes
  add column if not exists invite_source text;

create index if not exists go_invite_codes_invited_by_idx
  on go_invite_codes (invited_by_account_id);
