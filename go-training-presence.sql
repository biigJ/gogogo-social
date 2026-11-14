-- Live-Training-Präsenz für Heute-Story-Reihe (Freunde pulsieren)
-- Im Supabase SQL Editor ausführen.

create table if not exists go_training_presence (
  account_id uuid not null references go_accounts(id) on delete cascade,
  training_date date not null,
  status text not null default 'active',
  workout_label text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, training_date),
  constraint go_training_presence_status_check
    check (status in ('active', 'done'))
);

create index if not exists go_training_presence_date_status_idx
  on go_training_presence (training_date, status);

alter table go_training_presence enable row level security;

drop policy if exists "go_training_presence_all" on go_training_presence;
create policy "go_training_presence_all" on go_training_presence
  for all to anon, authenticated using (true) with check (true);
