-- Coach-Notizen / Trainingsplan pro Account (Admin-Profil)
-- Im Supabase SQL Editor ausführen.

create table if not exists go_coach_plans (
  account_id uuid primary key references go_accounts(id) on delete cascade,
  blurb text,
  life_situation text,
  goal text,
  phase_steps text,
  day_mo text,
  day_di text,
  day_mi text,
  day_do text,
  day_fr text,
  day_sa text,
  day_so text,
  updated_at timestamptz not null default now()
);

alter table go_coach_plans enable row level security;

drop policy if exists "go_coach_plans_select_anon" on go_coach_plans;
create policy "go_coach_plans_select_anon"
  on go_coach_plans for select
  to anon, authenticated
  using (true);

drop policy if exists "go_coach_plans_insert_anon" on go_coach_plans;
create policy "go_coach_plans_insert_anon"
  on go_coach_plans for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_coach_plans_update_anon" on go_coach_plans;
create policy "go_coach_plans_update_anon"
  on go_coach_plans for update
  to anon, authenticated
  using (true)
  with check (true);
