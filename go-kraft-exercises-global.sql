-- Globale Kraft-Übungen (für alle Nutzer sichtbar)
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Admin/Trainer legen neue Übungen hier an — nicht mehr pro Nutzer in
-- go_kraft_presets.custom_exercises. Pro Nutzer bleiben nur die Haken
-- (exercise_ids) in go_kraft_presets.

create table if not exists go_kraft_exercises (
  id text primary key,
  system_id text not null,
  name text not null,
  created_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists go_kraft_exercises_system_idx
  on go_kraft_exercises (system_id);

alter table go_kraft_exercises enable row level security;

drop policy if exists "go_kraft_exercises_select_anon" on go_kraft_exercises;
create policy "go_kraft_exercises_select_anon"
  on go_kraft_exercises for select
  to anon, authenticated
  using (true);

drop policy if exists "go_kraft_exercises_insert_anon" on go_kraft_exercises;
create policy "go_kraft_exercises_insert_anon"
  on go_kraft_exercises for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_kraft_exercises_update_anon" on go_kraft_exercises;
create policy "go_kraft_exercises_update_anon"
  on go_kraft_exercises for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_kraft_exercises_delete_anon" on go_kraft_exercises;
create policy "go_kraft_exercises_delete_anon"
  on go_kraft_exercises for delete
  to anon, authenticated
  using (true);

-- Bestehende pro-Nutzer-Übungen aus custom_exercises übernehmen (einmalig)
insert into go_kraft_exercises (id, system_id, name, created_by)
select distinct on (ex.id)
  ex.id,
  p.system_id,
  ex.name,
  p.account_id
from go_kraft_presets p,
  lateral jsonb_to_recordset(coalesce(p.custom_exercises, '[]'::jsonb))
    as ex(id text, name text)
where ex.id is not null
  and ex.id <> ''
  and ex.name is not null
  and ex.name <> ''
on conflict (id) do update
  set name = excluded.name
  where go_kraft_exercises.name is distinct from excluded.name;
