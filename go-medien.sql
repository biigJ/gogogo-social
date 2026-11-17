-- go-medien.sql — Übungsvideos (YouTube/Instagram-Links) + Kurs-Coverbilder
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Läuft auch ohne go-admin.sql: legt is_admin + go_is_admin() bei Bedarf selbst an (gleiche Definition).
--
-- go_exercise_media: ein Link pro Übungsname, gilt in allen Plänen (Schlüssel = Name klein, ohne Leerzeichen-Doppelungen).
-- courses.image_url: Coverbild (Datei im öffentlichen Bucket go-covers, siehe go-covers-bucket.sql).

alter table go_accounts add column if not exists is_admin boolean not null default false;

update go_accounts set is_admin = true
where id in ('2d3ab029-0a5f-4388-8da7-52501a87dc8c', '5f86ab1e-2043-4944-8196-1bec0c6b0130')
  and is_admin = false;

create or replace function go_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from go_accounts a
    where a.id = go_current_account_id() and a.is_admin
  );
$$;

grant execute on function go_is_admin() to anon, authenticated;

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
