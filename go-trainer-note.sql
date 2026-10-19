-- Trainernotiz, Tagebuch-Sichtbarkeit und Workout-Logs pro Account.
-- Einmal im Supabase SQL Editor ausführen (agpysewcsakdpmpftndp).

alter table go_kraft_exercises
  add column if not exists trainer_note text not null default '';

alter table go_kraft_exercises
  add column if not exists plan_meta jsonb not null default '{}'::jsonb;

alter table go_accounts
  add column if not exists diary_visibility text not null default 'private';

alter table go_accounts
  drop constraint if exists go_accounts_diary_visibility_check;

alter table go_accounts
  add constraint go_accounts_diary_visibility_check
  check (diary_visibility in ('private', 'trainer', 'friends'));

create table if not exists go_workout_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  workout_date date not null,
  exercise_id text not null,
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg >= 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, workout_date, exercise_id)
);

create index if not exists go_workout_logs_account_idx
  on go_workout_logs (account_id, workout_date desc);

alter table go_workout_logs enable row level security;

drop policy if exists "go_workout_logs_select_anon" on go_workout_logs;
create policy "go_workout_logs_select_anon"
  on go_workout_logs for select to anon, authenticated using (true);

drop policy if exists "go_workout_logs_insert_anon" on go_workout_logs;
create policy "go_workout_logs_insert_anon"
  on go_workout_logs for insert to anon, authenticated with check (true);

drop policy if exists "go_workout_logs_update_anon" on go_workout_logs;
create policy "go_workout_logs_update_anon"
  on go_workout_logs for update to anon, authenticated using (true) with check (true);

drop policy if exists "go_workout_logs_delete_anon" on go_workout_logs;
create policy "go_workout_logs_delete_anon"
  on go_workout_logs for delete to anon, authenticated using (true);

create table if not exists go_diary_entries (
  account_id uuid not null references go_accounts(id) on delete cascade,
  entry_date date not null,
  note text not null default '',
  move text not null default '',
  extras jsonb not null default '[]'::jsonb,
  cleared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (account_id, entry_date)
);

alter table go_diary_entries enable row level security;

drop policy if exists "go_diary_entries_select_anon" on go_diary_entries;
create policy "go_diary_entries_select_anon"
  on go_diary_entries for select to anon, authenticated using (true);

drop policy if exists "go_diary_entries_insert_anon" on go_diary_entries;
create policy "go_diary_entries_insert_anon"
  on go_diary_entries for insert to anon, authenticated with check (true);

drop policy if exists "go_diary_entries_update_anon" on go_diary_entries;
create policy "go_diary_entries_update_anon"
  on go_diary_entries for update to anon, authenticated using (true) with check (true);

drop policy if exists "go_diary_entries_delete_anon" on go_diary_entries;
create policy "go_diary_entries_delete_anon"
  on go_diary_entries for delete to anon, authenticated using (true);

-- Krafttraining-Einheit. Hinweise liegen in trainer_note.
insert into go_kraft_exercises (id, system_id, name, trainer_note, plan_meta)
values
  ('kt-child', 'krafttraining', 'Kindhaltung mit Strecken', '1 Durchgang', '{"kind":"check","cue":"Po zu Fersen, Arme weit vor.","group":"Aufwärmen","short":"Kind","sort":1}'),
  ('kt-catcow', 'krafttraining', 'Katze-Kuh', '1 Durchgang', '{"kind":"check","cue":"Rücken abwechselnd rund und hohl. Mit Ein- und Ausatmen.","group":"Aufwärmen","short":"Katze","sort":2}'),
  ('kt-downdog', 'krafttraining', 'Herabschauender Hund', '1 Durchgang', '{"kind":"check","cue":"Po hoch, Fersen Richtung Boden. Arme durchstrecken und Oberkörper öffnen.","group":"Aufwärmen","short":"Hund","sort":3}'),
  ('kt-wgs', 'krafttraining', 'Große Ganzkörperdehnung', '1 Durchgang je Seite', '{"kind":"check","cue":"Ausfallschritt, Arm zur Decke drehen.","group":"Aufwärmen","short":"Dehnung","sort":4}'),
  ('kt-hang', 'krafttraining', 'Hängen mit Schulterblatt-Heben', '3 × 5 · letzter Satz so lange wie möglich hängen', '{"kind":"reps","sets":3,"cue":"Gestreckt hängen, Schultern runterziehen.","group":"Hauptteil","short":"Hängen","sort":5}'),
  ('kt-split', 'krafttraining', 'Bulgarische Kniebeuge', '3 × ca. 10 je Bein', '{"kind":"reps","sets":3,"weight":true,"step":1,"startKg":6,"cue":"Hinterer Fuß erhöht, tief beugen.","group":"Hauptteil","short":"Bulgarisch","sort":6}'),
  ('kt-sldl', 'krafttraining', 'Einbeiniges Kreuzheben', '3 × ca. 10 je Bein', '{"kind":"reps","sets":3,"weight":true,"step":1,"startKg":6,"cue":"Hüfte nach hinten, Rücken gerade.","group":"Hauptteil","short":"Kreuzheben","sort":7}'),
  ('kt-slhip', 'krafttraining', 'Einbeiniges Hüftheben', '3 × ca. 10 je Bein', '{"kind":"reps","sets":3,"cue":"Schultern auf Box, Po hoch. Freies Bein gestreckt.","group":"Hauptteil","short":"Hüftheben","sort":8}'),
  ('kt-lateral', 'krafttraining', 'Vorgebeugtes Seitheben', '3 × ca. 10', '{"kind":"reps","sets":3,"weight":true,"step":1,"startKg":3,"cue":"Stirn auf Stuhllehne, Arme seitlich.","group":"Hauptteil","short":"Seitheben","sort":9}'),
  ('kt-press', 'krafttraining', 'Schulterdrücken im Sitz', '3 × ca. 15', '{"kind":"reps","sets":3,"weight":true,"step":1,"startKg":3,"cue":"Vorne auf Stuhlkante, Bauch fest.","group":"Hauptteil","short":"Schulter","sort":10}'),
  ('kt-pushup', 'krafttraining', 'Liegestütze auf Knien', '5 × ca. 5', '{"kind":"reps","sets":5,"cue":"Körper gerade von Knie bis Kopf.","group":"Hauptteil","short":"Liegestütz","sort":11}'),
  ('kt-crunch', 'krafttraining', 'Umgekehrte Crunches', '2 × ca. 15', '{"kind":"reps","sets":2,"cue":"Rückenlage, Hände hinten abstützen. Bein strecken, dann Knie Richtung Brust ziehen.","group":"Hauptteil","short":"Crunches","sort":12}')
on conflict (id) do update
  set
    system_id = excluded.system_id,
    name = case
      when go_kraft_exercises.name is null or go_kraft_exercises.name = '' then excluded.name
      else go_kraft_exercises.name
    end,
    trainer_note = case
      when go_kraft_exercises.trainer_note is null or go_kraft_exercises.trainer_note = '' then excluded.trainer_note
      else go_kraft_exercises.trainer_note
    end,
    plan_meta = case
      when go_kraft_exercises.plan_meta is null or go_kraft_exercises.plan_meta = '{}'::jsonb then excluded.plan_meta
      else go_kraft_exercises.plan_meta
    end;
