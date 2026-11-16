-- go-medien.sql — Übungsvideos (YouTube/Instagram-Links) + Kurs-Coverbilder
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen, nach go-admin.sql (braucht go_is_admin).
--
-- go_exercise_media: ein Link pro Übungsname, gilt in allen Plänen (Schlüssel = Name klein, ohne Leerzeichen-Doppelungen).
-- courses.image_url: Coverbild (Datei im öffentlichen Bucket go-avatars unter covers/).

create table if not exists go_exercise_media (
  name_key text primary key,
  name text not null,
  url text not null,
  updated_by uuid references go_accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table go_exercise_media enable row level security;

drop policy if exists "go_exercise_media_select" on go_exercise_media;
create policy "go_exercise_media_select" on go_exercise_media for select to anon, authenticated
  using (true);

drop policy if exists "go_exercise_media_write" on go_exercise_media;
create policy "go_exercise_media_write" on go_exercise_media for all to anon, authenticated
  using (go_is_admin())
  with check (go_is_admin());

alter table courses add column if not exists image_url text;
