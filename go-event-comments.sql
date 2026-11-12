-- event_comments + Systemkurs „Eigenes Training“ + Event-Notiz/Foto
-- Voraussetzung: go-courses-support.sql (+ ideal go-private-courses.sql)
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Optional Foto + Text bei erledigten Events
-- ---------------------------------------------------------------------------
alter table events
  add column if not exists note text;

alter table events
  add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- System-Flag für Katalog-Ausschluss
-- ---------------------------------------------------------------------------
alter table courses
  add column if not exists is_system boolean not null default false;

create index if not exists courses_is_system_idx
  on courses (is_system)
  where is_system = true;

drop policy if exists "courses_select_active" on courses;
create policy "courses_select_active"
  on courses for select to anon, authenticated
  using (
    (
      is_active = true
      and is_system = false
      and private_for is null
    )
    or private_for = go_current_account_id()
    or coach_id = go_current_account_id()
    or is_system = true
    or go_current_account_id() is null
  );

-- Systemkurs: startbar ohne Enrollment im Katalog
insert into courses (
  title, slug, level, duration_weeks, sessions_per_week, category_default,
  price_eur, description, coach_id, source, is_active, is_system, private_for
)
values (
  'Eigenes Training',
  'eigenes-training',
  null,
  null,
  null,
  null,
  0,
  'Systemkurs für außerplanmäßige Starts ohne gebuchten Kurs',
  null,
  'own',
  true,
  true,
  null
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  is_active = true,
  is_system = true,
  private_for = null;

-- ---------------------------------------------------------------------------
-- event_comments
-- ---------------------------------------------------------------------------
create table if not exists event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  account_id uuid not null references go_accounts(id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0 and char_length(text) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists event_comments_event_idx
  on event_comments (event_id, created_at asc);

alter table event_comments enable row level security;

drop policy if exists "event_comments_select" on event_comments;
create policy "event_comments_select"
  on event_comments for select to anon, authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (
          e.user_id = go_current_account_id()
          or go_is_coach_of(e.user_id)
          or e.visibility = 'alle'
          or (e.visibility = 'gruppe' and go_shares_group_with(e.user_id))
          or go_current_account_id() is null
        )
    )
  );

drop policy if exists "event_comments_insert_own" on event_comments;
create policy "event_comments_insert_own"
  on event_comments for insert to anon, authenticated
  with check (
    account_id = go_current_account_id()
    or go_current_account_id() is null
  );

drop policy if exists "event_comments_delete_own" on event_comments;
create policy "event_comments_delete_own"
  on event_comments for delete to anon, authenticated
  using (
    account_id = go_current_account_id()
    or go_current_account_id() is null
  );

drop policy if exists "event_comments_write_anon_boot" on event_comments;
create policy "event_comments_write_anon_boot"
  on event_comments for all to anon
  using (true)
  with check (true);
