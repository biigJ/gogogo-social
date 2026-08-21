-- Buddy-Workout-Einladungen für Kalender-Vorschläge
-- Im Supabase SQL Editor ausführen (optional).
-- Ohne Tabelle: App liest Einladungen aus Community-Posts
-- (reply_to + Marker ⟦goinv:YYYY-MM-DD|HH:MM|Ort⟧).

create table if not exists go_workout_invites (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references go_accounts(id) on delete cascade,
  to_id uuid not null references go_accounts(id) on delete cascade,
  workout_date date not null,
  workout_label text not null,
  from_name text,
  place text,
  meet_time text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table go_workout_invites add column if not exists place text;
alter table go_workout_invites add column if not exists meet_time text;

create index if not exists go_workout_invites_to_date_idx
  on go_workout_invites (to_id, workout_date);

create index if not exists go_workout_invites_from_date_idx
  on go_workout_invites (from_id, workout_date);

alter table go_workout_invites enable row level security;

drop policy if exists "go_workout_invites_select_anon" on go_workout_invites;
create policy "go_workout_invites_select_anon"
  on go_workout_invites for select
  to anon, authenticated
  using (true);

drop policy if exists "go_workout_invites_insert_anon" on go_workout_invites;
create policy "go_workout_invites_insert_anon"
  on go_workout_invites for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_workout_invites_update_anon" on go_workout_invites;
create policy "go_workout_invites_update_anon"
  on go_workout_invites for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_workout_invites_delete_anon" on go_workout_invites;
create policy "go_workout_invites_delete_anon"
  on go_workout_invites for delete
  to anon, authenticated
  using (true);
