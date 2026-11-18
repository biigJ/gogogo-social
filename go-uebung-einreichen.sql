-- go-uebung-einreichen.sql — Plus → Videos: „Übung einreichen“ + Foto je Übung
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- 1) go_exercise_submissions: Nutzer reichen eine fehlende Übung ein, Admin sieht sie unter Profil → Admin → Übungen.
-- 2) go_exercise_catalog.photo_url: Foto-Rahmen neben dem Hochformat-Video (leer = Platzhalter).

create table if not exists go_exercise_submissions (
  id bigserial primary key,
  account_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists go_exercise_submissions_open on go_exercise_submissions (created_at desc) where done_at is null;

alter table go_exercise_submissions enable row level security;
drop policy if exists "go_ex_sub_insert" on go_exercise_submissions;
create policy "go_ex_sub_insert" on go_exercise_submissions for insert to anon, authenticated
  with check (account_id = go_current_account_id());
drop policy if exists "go_ex_sub_select" on go_exercise_submissions;
create policy "go_ex_sub_select" on go_exercise_submissions for select to anon, authenticated
  using (account_id = go_current_account_id() or go_is_admin());
drop policy if exists "go_ex_sub_update" on go_exercise_submissions;
create policy "go_ex_sub_update" on go_exercise_submissions for update to anon, authenticated
  using (go_is_admin()) with check (go_is_admin());

alter table go_exercise_catalog add column if not exists photo_url text;
