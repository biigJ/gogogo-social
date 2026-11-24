
create table if not exists go_pt_bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references go_accounts(id) on delete cascade,
  coach_id uuid not null references go_accounts(id) on delete cascade,
  status text not null default 'offered',
  package_label text not null default 'Einzeltermin',
  calendly_uri text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint go_pt_bookings_status_check check (status in ('offered', 'accepted', 'confirmed', 'cancelled'))
);
create table if not exists go_pt_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references go_pt_bookings(id) on delete cascade,
  session_at timestamptz not null,
  status text not null default 'proposed',
  calendly_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint go_pt_sessions_status_check check (status in ('proposed', 'confirmed', 'declined'))
);
create index if not exists go_pt_bookings_client_idx on go_pt_bookings (client_id, status);
create index if not exists go_pt_bookings_coach_idx on go_pt_bookings (coach_id, status);
create index if not exists go_pt_sessions_booking_idx on go_pt_sessions (booking_id, session_at);
alter table go_pt_bookings enable row level security;
alter table go_pt_sessions enable row level security;
drop policy if exists "go_pt_bookings_all" on go_pt_bookings;
drop policy if exists "pt_bookings_party" on go_pt_bookings;
create policy "pt_bookings_party" on go_pt_bookings for all to anon, authenticated
  using (client_id = go_current_account_id() or coach_id = go_current_account_id())
  with check (client_id = go_current_account_id() or coach_id = go_current_account_id());
drop policy if exists "go_pt_sessions_all" on go_pt_sessions;
drop policy if exists "pt_sessions_party" on go_pt_sessions;
create policy "pt_sessions_party" on go_pt_sessions for all to anon, authenticated
  using (exists (select 1 from go_pt_bookings b where b.id = booking_id and (b.client_id = go_current_account_id() or b.coach_id = go_current_account_id())))
  with check (exists (select 1 from go_pt_bookings b where b.id = booking_id and (b.client_id = go_current_account_id() or b.coach_id = go_current_account_id())));

create table if not exists go_coach_blocked_days (
  coach_id uuid not null references go_accounts(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (coach_id, day)
);
alter table go_coach_blocked_days enable row level security;
drop policy if exists "coach_blocked_read" on go_coach_blocked_days;
create policy "coach_blocked_read" on go_coach_blocked_days for select to anon, authenticated using (true);
drop policy if exists "coach_blocked_own" on go_coach_blocked_days;
create policy "coach_blocked_own" on go_coach_blocked_days for all to anon, authenticated
  using (coach_id = go_current_account_id()) with check (coach_id = go_current_account_id());

create or replace function go_coach_busy(p_coach uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, kind text)
language sql
stable
security definer
set search_path = public
as $$
  select e.starts_at, 'event'::text
    from events e
   where e.user_id = p_coach
     and e.starts_at >= p_from and e.starts_at < p_to
     and coalesce(e.status, 'geplant') <> 'ausgefallen'
     and coalesce(e.item_type, '') not in ('nutrition_log')
     /* 12:00:00 UTC = Event ohne Uhrzeit, blockiert keine Stunde */
     and not (extract(hour from e.starts_at at time zone 'UTC') = 12 and extract(minute from e.starts_at at time zone 'UTC') = 0 and extract(second from e.starts_at at time zone 'UTC') = 0)
  union all
  select s.session_at, 'pt'::text
    from go_pt_sessions s
    join go_pt_bookings b on b.id = s.booking_id
   where b.coach_id = p_coach
     and s.session_at >= p_from and s.session_at < p_to
     and s.status in ('proposed', 'confirmed')
$$;
grant execute on function go_coach_busy(uuid, timestamptz, timestamptz) to anon, authenticated;
