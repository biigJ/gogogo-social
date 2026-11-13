-- Woche + Support: payment_status, item_type, travel meta
-- Voraussetzung: go-courses-support.sql, go-natalya-plan.sql
-- Idempotent. Im SQL Editor von agpysewcsakdpmpftndp ausführen.

-- ---------------------------------------------------------------------------
-- 1) enrollments.payment_status
-- ---------------------------------------------------------------------------
alter table enrollments
  add column if not exists payment_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'enrollments_payment_status_check'
  ) then
    alter table enrollments
      add constraint enrollments_payment_status_check
      check (
        payment_status is null
        or payment_status in ('offen', 'bezahlt', 'gratis')
      );
  end if;
end $$;

update enrollments e
set payment_status = case
  when coalesce((select c.price_eur from courses c where c.id = e.course_id), 0) = 0
    then 'gratis'
  else 'offen'
end
where e.payment_status is null;

-- ---------------------------------------------------------------------------
-- 2) events.item_type (+ travel meta in note prefix optional; column preferred)
-- ---------------------------------------------------------------------------
alter table events
  add column if not exists item_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_item_type_check'
  ) then
    alter table events
      add constraint events_item_type_check
      check (
        item_type is null
        or item_type in (
          'event',
          'course_session',
          'ffc_event',
          'history',
          'support_session',
          'nutrition_log',
          'spontaneous',
          'hotel_workout'
        )
      );
  end if;
end $$;

update events
set item_type = case
  when enrollment_id is not null then 'course_session'
  when is_unplanned then 'spontaneous'
  else 'event'
end
where item_type is null;

alter table events
  add column if not exists travel_auto boolean not null default false;

create index if not exists events_user_starts_idx
  on events (user_id, starts_at);

-- ---------------------------------------------------------------------------
-- 3) activity_log enrollment_request (table may already exist)
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references go_accounts(id) on delete set null,
  kind text not null,
  ref_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

drop policy if exists "activity_log_select_anon" on activity_log;
create policy "activity_log_select_anon"
  on activity_log for select to anon, authenticated using (true);

drop policy if exists "activity_log_insert_anon" on activity_log;
create policy "activity_log_insert_anon"
  on activity_log for insert to anon, authenticated with check (true);

create index if not exists activity_log_account_idx
  on activity_log (account_id, created_at desc);
