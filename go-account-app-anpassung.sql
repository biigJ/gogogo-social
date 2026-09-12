-- gogogo Account-App Anpassung 2026-09-11
-- In Supabase SQL Editor ausführen. RLS analog zu bestehenden go_*-Tabellen setzen.

-- Herkunft der Anmeldung (QR / Invite / Direct)
alter table go_accounts
  add column if not exists origin text;

alter table go_accounts
  add column if not exists calendar_prompt_count int default 0;

alter table go_accounts
  add column if not exists features jsonb default '{}'::jsonb;

comment on column go_accounts.origin is 'qr | invite | direct';
comment on column go_accounts.calendar_prompt_count is 'Wie oft der Kalender-Prompt gezeigt wurde';
comment on column go_accounts.features is 'Feature-Flags je Account, überschreibt Client-Defaults';

-- Freitext-Trainingseinträge (Stufe 1.5)
create table if not exists go_workout_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  entry_date date not null,
  raw_text text,
  parsed jsonb,
  place text,
  created_at timestamptz default now()
);

create index if not exists go_workout_entries_account_date_idx
  on go_workout_entries (account_id, entry_date desc);

alter table go_workout_entries enable row level security;

-- Stufe 2: Ziele
create table if not exists go_goals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  title text not null,
  target_date date,
  visibility text default 'circle',
  created_at timestamptz default now()
);

create table if not exists go_goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references go_goals(id) on delete cascade,
  week_start date not null,
  status text not null,
  created_at timestamptz default now(),
  unique (goal_id, week_start)
);

alter table go_goals enable row level security;
alter table go_goal_checkins enable row level security;

-- Stufe 2: geteilte Trainingspläne
create table if not exists go_plan_shares (
  id uuid primary key default gen_random_uuid(),
  from_account uuid not null references go_accounts(id) on delete cascade,
  to_account uuid not null references go_accounts(id) on delete cascade,
  entry_id uuid references go_workout_entries(id) on delete set null,
  payload jsonb,
  status text default 'sent',
  created_at timestamptz default now()
);

alter table go_plan_shares enable row level security;

-- Stufe 2: Profil-Sichtbarkeit
alter table go_accounts add column if not exists job_title text;
alter table go_accounts add column if not exists company text;
alter table go_accounts add column if not exists interests text[];
alter table go_accounts add column if not exists field_visibility jsonb default '{}'::jsonb;

-- Stufe 3: Matching
create table if not exists go_match_requests (
  id uuid primary key default gen_random_uuid(),
  from_account uuid not null references go_accounts(id) on delete cascade,
  to_account uuid not null references go_accounts(id) on delete cascade,
  slot_date date,
  slot_time time,
  place text,
  message text,
  status text default 'pending',
  created_at timestamptz default now()
);

alter table go_match_requests enable row level security;

-- Stufe 3: Orte
create table if not exists go_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  lat double precision,
  lng double precision,
  blurb text,
  photo_url text,
  recommended_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz default now()
);

alter table go_places enable row level security;

-- Stufe 3: Trainer-Marktplatz
alter table go_accounts add column if not exists trainer_rate_eur numeric;
alter table go_accounts add column if not exists trainer_focus text[];
alter table go_accounts add column if not exists trainer_area text;

create table if not exists go_trainer_endorsements (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references go_accounts(id) on delete cascade,
  account_id uuid not null references go_accounts(id) on delete cascade,
  note text,
  created_at timestamptz default now(),
  unique (trainer_id, account_id)
);

create table if not exists go_bookings (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references go_accounts(id) on delete cascade,
  account_id uuid not null references go_accounts(id) on delete cascade,
  session_at timestamptz,
  price_eur numeric,
  commission_pct numeric default 17.5,
  status text default 'requested',
  created_at timestamptz default now()
);

alter table go_trainer_endorsements enable row level security;
alter table go_bookings enable row level security;

-- Stufe 3: Circles + Membership
create table if not exists go_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references go_accounts(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);

create table if not exists go_circle_members (
  circle_id uuid not null references go_circles(id) on delete cascade,
  account_id uuid not null references go_accounts(id) on delete cascade,
  role text default 'member',
  status text default 'pending',
  invited_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz default now(),
  primary key (circle_id, account_id)
);

alter table go_circles enable row level security;
alter table go_circle_members enable row level security;

alter table go_accounts add column if not exists membership_tier text default 'free';
comment on column go_accounts.membership_tier is 'free | paying | granted';
