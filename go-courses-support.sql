-- gogogo Schritt 2: Kurse / Support / Events / Streak
-- Im Supabase SQL Editor der gogogo-Instanz ausführen:
--   https://agpysewcsakdpmpftndp.supabase.co  (dein Projekt, nicht Hendrik)
-- Idempotent: mehrfach ausführbar.

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für RLS (Account-ID aus Header x-go-account-id)
-- Die App kann später den Header setzen; ohne Header greifen nur Katalog-Reads.
-- ---------------------------------------------------------------------------
create or replace function go_current_account_id()
returns uuid
language sql
stable
as $$
  select nullif(
    trim(both from coalesce(
      current_setting('request.headers', true)::json ->> 'x-go-account-id',
      current_setting('request.jwt.claims', true)::json ->> 'go_account_id',
      ''
    )),
    ''
  )::uuid;
$$;

create or replace function go_is_coach_of(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from go_accounts a
    where a.id = p_user_id
      and a.trainer_id is not null
      and a.trainer_id = go_current_account_id()
  );
$$;

create or replace function go_shares_group_with(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from go_buddies b
    where (b.account_id = go_current_account_id() and b.buddy_id = p_owner_id)
       or (b.buddy_id = go_current_account_id() and b.account_id = p_owner_id)
  )
  or exists (
    select 1
    from go_accounts me
    join go_accounts them on them.id = p_owner_id
    where me.id = go_current_account_id()
      and me.trainer_id is not null
      and me.trainer_id = them.trainer_id
  );
$$;

-- ---------------------------------------------------------------------------
-- 1) courses
-- ---------------------------------------------------------------------------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  level smallint check (level is null or level between 1 and 3),
  duration_weeks int,
  sessions_per_week int,
  category_default text check (category_default is null or category_default in ('kraft', 'ausdauer', 'zirkel')),
  start_date date,
  seats int,
  price_eur numeric(10, 2),
  description text,
  coach_id uuid,
  source text not null default 'own' check (source in ('own', 'hendrik')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists courses_active_idx on courses (is_active, slug);

-- ---------------------------------------------------------------------------
-- 2) course_templates
-- ---------------------------------------------------------------------------
create table if not exists course_templates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  week_no int not null check (week_no >= 1),
  session_no int not null check (session_no >= 1),
  title text not null,
  category text not null check (category in ('kraft', 'ausdauer', 'zirkel', 'alternative')),
  description text,
  unique (course_id, week_no, session_no)
);

create index if not exists course_templates_course_idx
  on course_templates (course_id, week_no, session_no);

-- ---------------------------------------------------------------------------
-- 3) enrollments
-- ---------------------------------------------------------------------------
create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null default 'angefragt'
    check (status in ('angefragt', 'aktiv', 'beendet')),
  start_date date,
  weekdays int[] check (
    weekdays is null
    or (
      array_length(weekdays, 1) is not null
      and weekdays <@ array[0,1,2,3,4,5,6]::int[]
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists enrollments_user_idx on enrollments (user_id, status);
create index if not exists enrollments_course_idx on enrollments (course_id, status);

-- ---------------------------------------------------------------------------
-- 4) support_products + support_orders
-- ---------------------------------------------------------------------------
create table if not exists support_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in (
    'personal_training', 'web_call', 'ernaehrung', 'stempelkarte', 'merch'
  )),
  price_eur numeric(10, 2),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists support_products_title_type_uidx
  on support_products (title, type);

create table if not exists support_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  product_id uuid not null references support_products(id) on delete restrict,
  status text not null default 'angefragt'
    check (status in ('angefragt', 'freigeschaltet')),
  created_at timestamptz not null default now()
);

create index if not exists support_orders_user_idx on support_orders (user_id, status);
create index if not exists support_orders_product_idx on support_orders (product_id, status);

-- ---------------------------------------------------------------------------
-- 5) events (eigene, nicht Zirkeltraining aus Hendriks DB)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  enrollment_id uuid references enrollments(id) on delete set null,
  category text not null check (category in ('kraft', 'ausdauer', 'zirkel', 'alternative')),
  starts_at timestamptz not null,
  location text,
  visibility text not null default 'privat'
    check (visibility in ('privat', 'gruppe', 'alle')),
  is_unplanned boolean not null default false,
  status text not null default 'geplant'
    check (status in ('geplant', 'erledigt', 'ausgefallen')),
  title text,
  created_at timestamptz not null default now(),
  constraint events_course_or_alternative_chk check (
    (course_id is not null and category <> 'alternative')
    or (course_id is null and category = 'alternative')
  )
);

create index if not exists events_user_starts_idx on events (user_id, starts_at desc);
create index if not exists events_status_day_idx on events (status, starts_at);
create index if not exists events_course_idx on events (course_id);

-- ---------------------------------------------------------------------------
-- 6) event_rsvps
-- ---------------------------------------------------------------------------
create table if not exists event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references go_accounts(id) on delete cascade,
  status text not null check (status in ('zugesagt', 'abgesagt')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_rsvps_user_idx on event_rsvps (user_id, status);

-- ---------------------------------------------------------------------------
-- 8) activity_log
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  type text not null check (type in (
    'rsvp_yes', 'rsvp_no', 'checkin', 'unplanned_start',
    'post_view', 'enrollment_request', 'support_request'
  )),
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_user_created_idx
  on activity_log (user_id, created_at desc);
create index if not exists activity_log_type_idx
  on activity_log (type, created_at desc);

-- ---------------------------------------------------------------------------
-- 7) Streak (nicht speichern): View + Funktion
-- Ein Tag zählt bei ≥1 Event status=erledigt (alle Kategorien inkl. alternative).
-- Gespiegelte Zirkel-Teilnahmen: activity_log.checkin / rsvp_yes am selben Tag.
-- ---------------------------------------------------------------------------
create or replace view go_user_active_days as
select
  e.user_id,
  ((e.starts_at at time zone 'Europe/Berlin')::date) as day
from events e
where e.status = 'erledigt'
union
select
  a.user_id,
  ((a.created_at at time zone 'Europe/Berlin')::date) as day
from activity_log a
where a.type in ('checkin', 'rsvp_yes');

create or replace function go_streak_days(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d date;
  expect date;
  streak int := 0;
begin
  expect := (now() at time zone 'Europe/Berlin')::date;
  for d in
    select day
    from go_user_active_days
    where user_id = p_user_id
      and day <= expect
    order by day desc
  loop
    if d = expect then
      streak := streak + 1;
      expect := expect - 1;
    elsif d < expect then
      exit;
    end if;
  end loop;
  return streak;
end;
$$;

grant execute on function go_streak_days(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seeds: courses
-- ---------------------------------------------------------------------------
insert into courses (
  title, slug, level, duration_weeks, sessions_per_week, category_default,
  price_eur, description, coach_id, source, is_active
)
select v.title, v.slug, v.level, v.duration_weeks, v.sessions_per_week, v.category_default,
       v.price_eur, v.description, v.coach_id, v.source, true
from (values
  ('Fit for Run L1', 'fit-for-run-l1', 1, 8, 3, 'ausdauer', 0::numeric,
   'Laufkurs Level 1', '2d3ab029-0a5f-4388-8da7-52501a87dc8c'::uuid, 'own'),
  ('Fit for Run L2', 'fit-for-run-l2', 2, 8, 3, 'ausdauer', 0::numeric,
   'Laufkurs Level 2', '2d3ab029-0a5f-4388-8da7-52501a87dc8c'::uuid, 'own'),
  ('Fit for Run L3', 'fit-for-run-l3', 3, 8, 3, 'ausdauer', 0::numeric,
   'Laufkurs Level 3', '2d3ab029-0a5f-4388-8da7-52501a87dc8c'::uuid, 'own'),
  ('Bulletproof Knee', 'bulletproof-knee', null, 6, 2, 'kraft', 0::numeric,
   'Knie-Stabilität und Kraft', '2d3ab029-0a5f-4388-8da7-52501a87dc8c'::uuid, 'own'),
  ('12-Wochen-Routine', '12-wochen-routine', null, 12, 3, 'kraft', 0::numeric,
   'Die gogogo 12-Wochen-Routine', '2d3ab029-0a5f-4388-8da7-52501a87dc8c'::uuid, 'own'),
  ('Zirkeltraining', 'zirkeltraining', null, null, null, 'zirkel', 0::numeric,
   'Termine bleiben gespiegelt aus Hendriks Supabase', null::uuid, 'hendrik')
) as v(title, slug, level, duration_weeks, sessions_per_week, category_default, price_eur, description, coach_id, source)
on conflict (slug) do update set
  title = excluded.title,
  level = excluded.level,
  duration_weeks = excluded.duration_weeks,
  sessions_per_week = excluded.sessions_per_week,
  category_default = excluded.category_default,
  description = excluded.description,
  coach_id = excluded.coach_id,
  source = excluded.source,
  is_active = true;

-- Minimale Templates (Woche 1) für eigene Kurse
insert into course_templates (course_id, week_no, session_no, title, category, description)
select c.id, t.week_no, t.session_no, t.title, t.category, t.description
from courses c
join (values
  ('fit-for-run-l1', 1, 1, 'Einfach loslaufen', 'ausdauer', 'Grundlage Ausdauer'),
  ('fit-for-run-l1', 1, 2, 'Intervall leicht', 'ausdauer', null),
  ('fit-for-run-l2', 1, 1, 'Tempo Basis', 'ausdauer', null),
  ('fit-for-run-l3', 1, 1, 'Schwellenlauf', 'ausdauer', null),
  ('bulletproof-knee', 1, 1, 'Activation & Stability', 'kraft', null),
  ('12-wochen-routine', 1, 1, 'Woche 1 · Einheit 1', 'kraft', null),
  ('12-wochen-routine', 1, 2, 'Woche 1 · Einheit 2', 'kraft', null),
  ('12-wochen-routine', 1, 3, 'Woche 1 · Einheit 3', 'kraft', null)
) as t(slug, week_no, session_no, title, category, description)
  on c.slug = t.slug
on conflict (course_id, week_no, session_no) do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description;

-- Seeds: support_products
insert into support_products (title, type, price_eur, description, is_active)
select v.title, v.type, v.price_eur, v.description, true
from (values
  ('Personal Training', 'personal_training', 600::numeric, '10 Treffen mit deinem Coach'),
  ('Web-Call Trainingsplan', 'web_call', 0::numeric, 'Online-Call für deinen Plan'),
  ('Ernährung', 'ernaehrung', 0::numeric, 'Ernährungs-Support'),
  ('Stempelkarte', 'stempelkarte', 0::numeric, 'Stempelkarte für regelmäßiges Training'),
  ('gogogo Shirt', 'merch', 0::numeric, 'gogogo Merch Shirt'),
  ('Selfie Stick', 'merch', 0::numeric, 'Selfie Stick für Check-ins')
) as v(title, type, price_eur, description)
on conflict (title, type) do update set
  price_eur = excluded.price_eur,
  description = excluded.description,
  is_active = true;

-- Demo-Event für Streak-Check (Natalya), falls Account existiert
insert into events (user_id, course_id, category, starts_at, location, visibility, status, title)
select
  a.id,
  c.id,
  'kraft',
  (now() at time zone 'Europe/Berlin')::date::timestamptz + interval '8 hours',
  'FF Schönhauser Allee',
  'privat',
  'erledigt',
  'Streak Seed'
from go_accounts a
cross join courses c
where a.name = 'Natalya'
  and c.slug = '12-wochen-routine'
  and not exists (
    select 1 from events e
    where e.user_id = a.id and e.title = 'Streak Seed'
  )
limit 1;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table courses enable row level security;
alter table course_templates enable row level security;
alter table enrollments enable row level security;
alter table support_products enable row level security;
alter table support_orders enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table activity_log enable row level security;

-- courses: aktive Katalog-Einträge für alle; Coach sieht/ändert eigene
drop policy if exists "courses_select_active" on courses;
create policy "courses_select_active"
  on courses for select to anon, authenticated
  using (
    is_active = true
    or coach_id = go_current_account_id()
  );

drop policy if exists "courses_write_coach" on courses;
create policy "courses_write_coach"
  on courses for all to authenticated
  using (coach_id = go_current_account_id())
  with check (coach_id = go_current_account_id());

-- Anon-Schreibzugriff wie bei anderen go_*-Tabellen (Publishable Key der App),
-- bis Account-Header durchgängig gesetzt ist. Lesen bleibt über Select-Policy.
-- OFFEN (nach Test-Start, noch nicht umsetzen): RLS von Header x-go-account-id
-- auf echte Auth umstellen (Hendriks JWT in diesem Projekt verifizieren → auth.uid()),
-- Boot-Klauseln (go_current_account_id() is null / *_anon_boot) entfernen.
drop policy if exists "courses_write_anon_boot" on courses;
create policy "courses_write_anon_boot"
  on courses for all to anon
  using (true)
  with check (true);

drop policy if exists "course_templates_select" on course_templates;
create policy "course_templates_select"
  on course_templates for select to anon, authenticated
  using (
    exists (
      select 1 from courses c
      where c.id = course_id and (c.is_active or c.coach_id = go_current_account_id())
    )
  );

drop policy if exists "course_templates_write_anon_boot" on course_templates;
create policy "course_templates_write_anon_boot"
  on course_templates for all to anon
  using (true) with check (true);

-- enrollments: eigene + Coach der Kurs-/Coachee-Beziehung
drop policy if exists "enrollments_select_own_or_coach" on enrollments;
create policy "enrollments_select_own_or_coach"
  on enrollments for select to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or exists (
      select 1 from courses c
      where c.id = course_id and c.coach_id = go_current_account_id()
    )
    -- Boot: ohne Header weiterhin lesbar (App-Filter nach user_id)
    or go_current_account_id() is null
  );

drop policy if exists "enrollments_insert_own" on enrollments;
create policy "enrollments_insert_own"
  on enrollments for insert to anon, authenticated
  with check (
    user_id = go_current_account_id()
    or go_current_account_id() is null
  );

drop policy if exists "enrollments_update_own_or_coach" on enrollments;
create policy "enrollments_update_own_or_coach"
  on enrollments for update to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or exists (select 1 from courses c where c.id = course_id and c.coach_id = go_current_account_id())
    or go_current_account_id() is null
  )
  with check (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or exists (select 1 from courses c where c.id = course_id and c.coach_id = go_current_account_id())
    or go_current_account_id() is null
  );

-- support_products: Katalog
drop policy if exists "support_products_select_active" on support_products;
create policy "support_products_select_active"
  on support_products for select to anon, authenticated
  using (is_active = true or go_current_account_id() is not null);

drop policy if exists "support_products_write_anon_boot" on support_products;
create policy "support_products_write_anon_boot"
  on support_products for all to anon
  using (true) with check (true);

-- support_orders: eigene + Coach des Users
drop policy if exists "support_orders_select_own_or_coach" on support_orders;
create policy "support_orders_select_own_or_coach"
  on support_orders for select to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );

drop policy if exists "support_orders_insert_own" on support_orders;
create policy "support_orders_insert_own"
  on support_orders for insert to anon, authenticated
  with check (user_id = go_current_account_id() or go_current_account_id() is null);

drop policy if exists "support_orders_update_own_or_coach" on support_orders;
create policy "support_orders_update_own_or_coach"
  on support_orders for update to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  )
  with check (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );

-- events: eigene; gruppe/alle für Gruppenmitglieder; Coach der Coachees
drop policy if exists "events_select_visible" on events;
create policy "events_select_visible"
  on events for select to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or (visibility = 'alle')
    or (visibility = 'gruppe' and go_shares_group_with(user_id))
    or go_current_account_id() is null
  );

drop policy if exists "events_insert_own" on events;
create policy "events_insert_own"
  on events for insert to anon, authenticated
  with check (user_id = go_current_account_id() or go_current_account_id() is null);

drop policy if exists "events_update_own" on events;
create policy "events_update_own"
  on events for update to anon, authenticated
  using (user_id = go_current_account_id() or go_is_coach_of(user_id) or go_current_account_id() is null)
  with check (user_id = go_current_account_id() or go_is_coach_of(user_id) or go_current_account_id() is null);

drop policy if exists "events_delete_own" on events;
create policy "events_delete_own"
  on events for delete to anon, authenticated
  using (user_id = go_current_account_id() or go_current_account_id() is null);

-- event_rsvps
drop policy if exists "event_rsvps_select" on event_rsvps;
create policy "event_rsvps_select"
  on event_rsvps for select to anon, authenticated
  using (
    user_id = go_current_account_id()
    or exists (
      select 1 from events e
      where e.id = event_id
        and (
          e.user_id = go_current_account_id()
          or e.visibility in ('gruppe', 'alle')
          or go_current_account_id() is null
        )
    )
  );

drop policy if exists "event_rsvps_write_own" on event_rsvps;
create policy "event_rsvps_write_own"
  on event_rsvps for all to anon, authenticated
  using (user_id = go_current_account_id() or go_current_account_id() is null)
  with check (user_id = go_current_account_id() or go_current_account_id() is null);

-- activity_log: eigene (+ Coach liest Coachee)
drop policy if exists "activity_log_select_own_or_coach" on activity_log;
create policy "activity_log_select_own_or_coach"
  on activity_log for select to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );

drop policy if exists "activity_log_insert_own" on activity_log;
create policy "activity_log_insert_own"
  on activity_log for insert to anon, authenticated
  with check (user_id = go_current_account_id() or go_current_account_id() is null);

-- Fertig-Hinweis (Streak):
--   select go_streak_days('94a49c08-0818-4491-86a5-714885b6b73c');  -- Natalya
-- Constraint-Test (muss fehlschlagen):
--   insert into events (user_id, category, starts_at)
--   values ('94a49c08-0818-4491-86a5-714885b6b73c', 'kraft', now());
