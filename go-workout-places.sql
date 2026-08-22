-- Globale Workout-Orte (für alle Nutzer in der Auswahl)
-- Im Supabase SQL Editor ausführen.

create table if not exists go_workout_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat numeric,
  lng numeric,
  map_source text not null default 'osm',
  external_id text unique,
  created_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists go_workout_places_name_idx
  on go_workout_places (lower(name));

alter table go_workout_places enable row level security;

drop policy if exists "go_workout_places_select_anon" on go_workout_places;
create policy "go_workout_places_select_anon"
  on go_workout_places for select
  to anon, authenticated
  using (true);

drop policy if exists "go_workout_places_insert_anon" on go_workout_places;
create policy "go_workout_places_insert_anon"
  on go_workout_places for insert
  to anon, authenticated
  with check (true);

-- Start-Orte (external_id verhindert Duplikate; App prüft zusätzlich ~80 % Namensähnlichkeit)
insert into go_workout_places (name, lat, lng, map_source, external_id)
values
  ('FF Schönhauser Allee', 52.5408, 13.4124, 'seed', 'seed:ff-schoenhauser'),
  ('Holmes Place Neue Welt', 52.5055, 13.4437, 'seed', 'seed:holmes-neue-welt'),
  ('Hagius Berlin', 52.4969, 13.4386, 'seed', 'seed:hagius-berlin'),
  ('Hasenheide Park', 52.4774, 13.4194, 'seed', 'seed:hasenheide'),
  ('Tempelhofer Feld', 52.4734, 13.4039, 'seed', 'seed:tempelhofer-feld')
on conflict (external_id) do nothing;
