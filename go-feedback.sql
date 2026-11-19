-- go-feedback.sql — Feedback aus der App landet unter Profil → Admin → Nachrichten
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.

create table if not exists go_feedback (
  id bigserial primary key,
  account_id uuid not null,
  name text,
  text text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists go_feedback_created on go_feedback (created_at desc);

alter table go_feedback enable row level security;
drop policy if exists "go_feedback_insert" on go_feedback;
create policy "go_feedback_insert" on go_feedback for insert to anon, authenticated
  with check (account_id = go_current_account_id());
drop policy if exists "go_feedback_select" on go_feedback;
create policy "go_feedback_select" on go_feedback for select to anon, authenticated
  using (account_id = go_current_account_id() or go_is_admin());
