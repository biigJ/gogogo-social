-- Personal Training: Angebote, Termine, Calendly-Sync
-- Im Supabase SQL Editor ausführen.

create table if not exists go_pt_bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references go_accounts(id) on delete cascade,
  coach_id uuid not null references go_accounts(id) on delete cascade,
  status text not null default 'offered',
  package_label text not null default '10 Treffen für 600€',
  calendly_uri text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint go_pt_bookings_status_check
    check (status in ('offered', 'accepted', 'confirmed', 'cancelled'))
);

create table if not exists go_pt_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references go_pt_bookings(id) on delete cascade,
  session_at timestamptz not null,
  status text not null default 'proposed',
  calendly_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint go_pt_sessions_status_check
    check (status in ('proposed', 'confirmed', 'declined'))
);

create index if not exists go_pt_bookings_client_idx on go_pt_bookings (client_id, status);
create index if not exists go_pt_bookings_coach_idx on go_pt_bookings (coach_id, status);
create index if not exists go_pt_sessions_booking_idx on go_pt_sessions (booking_id, session_at);
create index if not exists go_pt_sessions_at_idx on go_pt_sessions (session_at);

alter table go_pt_bookings enable row level security;
alter table go_pt_sessions enable row level security;

drop policy if exists "go_pt_bookings_all" on go_pt_bookings;
create policy "go_pt_bookings_all" on go_pt_bookings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "go_pt_sessions_all" on go_pt_sessions;
create policy "go_pt_sessions_all" on go_pt_sessions
  for all to anon, authenticated using (true) with check (true);
