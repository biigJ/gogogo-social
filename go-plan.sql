-- Vorlage und Personen für den kopierten Trainingsplan.
-- Einmal im Supabase SQL Editor ausführen (Projekt agpysewcsakdpmpftndp).
-- Natalyas Seite /natalyaalice bleibt davon getrennt.

create table if not exists go_plan_templates (
  slug text primary key,
  title text not null,
  headline text not null default 'Krafttraining',
  exercises jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists go_plan_athletes (
  slug text primary key,
  name text not null,
  headline text not null default 'Krafttraining',
  trainer_wa text not null default '491747015500',
  template_slug text,
  exercises jsonb not null default '[]'::jsonb,
  days jsonb not null default '["tue","sat"]'::jsonb,
  started_on date,
  updated_at timestamptz not null default now()
);

create table if not exists go_plan_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null,
  workout_date date not null,
  exercise_id text not null,
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg >= 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, workout_date, exercise_id)
);

create index if not exists go_plan_logs_athlete_date_idx
  on go_plan_logs (athlete_id, workout_date desc, exercise_id);

alter table go_plan_templates enable row level security;
alter table go_plan_athletes enable row level security;
alter table go_plan_logs enable row level security;

drop policy if exists "go_plan_templates_all_anon" on go_plan_templates;
create policy "go_plan_templates_all_anon"
  on go_plan_templates for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_plan_athletes_all_anon" on go_plan_athletes;
create policy "go_plan_athletes_all_anon"
  on go_plan_athletes for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_plan_logs_all_anon" on go_plan_logs;
create policy "go_plan_logs_all_anon"
  on go_plan_logs for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on go_plan_templates to anon, authenticated;
grant select, insert, update, delete on go_plan_athletes to anon, authenticated;
grant select, insert, update, delete on go_plan_logs to anon, authenticated;
