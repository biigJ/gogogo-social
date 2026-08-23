-- gogogo account features v2: onboarding, multi-lang, unit choice, goals, challenges, push prefs
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists spoken_langs jsonb not null default '[]'::jsonb,
  add column if not exists push_prefs jsonb not null default '{"enabled":false,"buddy_msg":true,"trainer_msg":true,"workout_reminder":true,"challenge":true}'::jsonb,
  add column if not exists goal_score numeric(4,2);

alter table go_day_entries
  add column if not exists unit_choice text check (unit_choice is null or unit_choice in ('workout', 'alternative'));

-- Ziel-Profile: optimale Wochenverteilung pro Trainingsziel
create table if not exists go_training_goal_profiles (
  id text primary key,
  label_de text not null,
  label_en text not null,
  kraft_days smallint not null default 2,
  ausdauer_days smallint not null default 2,
  hiit_days smallint not null default 1,
  rest_days smallint not null default 2,
  notes text
);

insert into go_training_goal_profiles (id, label_de, label_en, kraft_days, ausdauer_days, hiit_days, rest_days, notes)
values
  ('muscle', 'Muskelaufbau', 'Muscle building', 3, 1, 1, 2, 'Kraft-dominiert, moderates Cardio'),
  ('fat_loss', 'Fettabbau', 'Fat loss', 2, 3, 2, 0, 'Cardio + HIIT, Kraft zur Erhaltung'),
  ('endurance', 'Ausdauer', 'Endurance', 1, 4, 1, 1, 'Zone-2-dominiert'),
  ('general', 'Allgemein fit', 'General fitness', 2, 2, 1, 2, 'Ausgewogene Mischung')
on conflict (id) do nothing;

-- Buddy-/Trainer-Challenges
create table if not exists go_buddy_challenges (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references go_accounts(id) on delete cascade,
  to_account_id uuid not null references go_accounts(id) on delete cascade,
  days smallint not null default 14 check (days >= 1 and days <= 90),
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'done')),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  accepted_at timestamptz
);

alter table go_buddy_challenges
  add column if not exists accepted_at timestamptz;

create index if not exists go_buddy_challenges_to_idx
  on go_buddy_challenges (to_account_id, status, created_at desc);

alter table go_buddy_challenges enable row level security;

drop policy if exists "go_buddy_challenges_select_anon" on go_buddy_challenges;
create policy "go_buddy_challenges_select_anon"
  on go_buddy_challenges for select to anon, authenticated using (true);

drop policy if exists "go_buddy_challenges_insert_anon" on go_buddy_challenges;
create policy "go_buddy_challenges_insert_anon"
  on go_buddy_challenges for insert to anon, authenticated with check (true);

drop policy if exists "go_buddy_challenges_update_anon" on go_buddy_challenges;
create policy "go_buddy_challenges_update_anon"
  on go_buddy_challenges for update to anon, authenticated using (true) with check (true);

-- Neue Orte
insert into go_workout_places (name, lat, lng, map_source, external_id)
values
  ('Columbiabad Neukölln', 52.4830, 13.4310, 'seed', 'seed:columbiabad-neukoelln'),
  ('Prinzenbad Kreuzberg', 52.4885, 13.4055, 'seed', 'seed:prinzenbad-kreuzberg'),
  ('Schwimmbad Landsberger Allee', 52.5285, 13.4720, 'seed', 'seed:schwimmbad-landsberger')
on conflict (external_id) do nothing;
