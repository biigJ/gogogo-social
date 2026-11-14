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
-- 3) activity_log (bestehend aus go-courses-support.sql: user_id, type, ref_id)
--    Kein Neu-Anlegen mit account_id/kind — Schema nicht überschreiben.
--    Optional: meta + erweiterte type-Werte (idempotent).
-- ---------------------------------------------------------------------------
alter table activity_log
  add column if not exists meta jsonb not null default '{}'::jsonb;

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'activity_log'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%type%';

  if cname is not null then
    execute format('alter table activity_log drop constraint %I', cname);
  end if;

  alter table activity_log
    add constraint activity_log_type_check
    check (type in (
      'rsvp_yes', 'rsvp_no', 'checkin', 'unplanned_start',
      'post_view', 'enrollment_request', 'support_request',
      'nutrition_log'
    ));
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 4) support_orders: status aktiv + payment_status (nullable → main bleibt ok)
-- ---------------------------------------------------------------------------
alter table support_orders
  add column if not exists payment_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_orders_payment_status_check'
  ) then
    alter table support_orders
      add constraint support_orders_payment_status_check
      check (
        payment_status is null
        or payment_status in ('offen', 'bezahlt', 'gratis')
      );
  end if;
end $$;

-- Status-Constraint erweitern: angefragt | freigeschaltet | aktiv
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'support_orders'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if cname is not null then
    execute format('alter table support_orders drop constraint %I', cname);
  end if;

  alter table support_orders
    add constraint support_orders_status_check
    check (status in ('angefragt', 'freigeschaltet', 'aktiv'));
exception
  when duplicate_object then null;
end $$;

update support_orders
set status = 'aktiv'
where status = 'freigeschaltet';

update support_orders o
set payment_status = case
  when coalesce((select p.price_eur from support_products p where p.id = o.product_id), 0) = 0
    then 'gratis'
  else coalesce(o.payment_status, 'offen')
end
where o.payment_status is null;

-- Meta für Heute-Karten (z. B. geplantes Call-Datum)
alter table support_orders
  add column if not exists meta jsonb not null default '{}'::jsonb;
