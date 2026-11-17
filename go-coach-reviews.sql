-- go-coach-reviews.sql — Coach-Bewertungen + Calendly-Link pro Coach
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.

create table if not exists go_coach_reviews (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references go_accounts(id) on delete cascade,
  author_id uuid not null references go_accounts(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, author_id),
  check (coach_id <> author_id)
);
create index if not exists go_coach_reviews_coach_idx on go_coach_reviews (coach_id);

alter table go_coach_reviews enable row level security;

-- Bewertungen sind öffentlich (Coach-Liste, „Über“-Seite)
drop policy if exists "go_coach_reviews_select" on go_coach_reviews;
create policy "go_coach_reviews_select" on go_coach_reviews for select to anon, authenticated using (true);

-- schreiben, ändern, löschen: nur die eigene Bewertung
drop policy if exists "go_coach_reviews_write" on go_coach_reviews;
create policy "go_coach_reviews_write" on go_coach_reviews for all to anon, authenticated
  using (author_id = go_current_account_id())
  with check (author_id = go_current_account_id());

-- Calendly des Coaches (Personal Training buchen)
alter table go_accounts add column if not exists calendly_url text;
