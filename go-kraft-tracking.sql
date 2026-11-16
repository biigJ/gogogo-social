-- go-kraft-tracking.sql — Kraft-Tracking unter Plus + Übungsnamen in den Logs
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- 1) exercise_name in den Workout-Logs: Historie und Verlauf finden dieselbe Übung
--    auch über verschiedene Kurseinheiten hinweg (exercise_id ist pro Einheit).
-- 2) Produkt "Kraft-Tracking" (gratis), damit die Buchung in support_orders landet.

alter table go_workout_logs add column if not exists exercise_name text;

do $$
begin
  if to_regclass('public.go_natalya_logs') is not null then
    execute 'alter table go_natalya_logs add column if not exists exercise_name text';
  end if;
end $$;

create index if not exists go_workout_logs_account_name_idx
  on go_workout_logs (account_id, exercise_name);

-- support_products.type um kraft_tracking erweitern (alle vorhandenen Typen bleiben erlaubt)
do $$
declare
  cname text;
  def text;
  allowed text;
begin
  select con.conname, pg_get_constraintdef(con.oid) into cname, def
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'support_products'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%type%'
  limit 1;

  if cname is not null and def not ilike '%kraft_tracking%' then
    select string_agg(quote_literal(t), ', ') into allowed
    from (
      select unnest(array['personal_training', 'web_call', 'ernaehrung', 'stempelkarte', 'merch', 'kraft_tracking']) as t
      union
      select distinct type from support_products
    ) x;
    execute format('alter table support_products drop constraint %I', cname);
    execute 'alter table support_products add constraint support_products_type_check check (type in (' || allowed || '))';
  end if;
end $$;

insert into support_products (title, type, price_eur, description, is_active)
values ('Kraft-Tracking', 'kraft_tracking', 0, 'Workouts als Liste, Datumsfilter, Verlauf pro Übung', true)
on conflict (title, type) do update set
  price_eur = excluded.price_eur,
  description = excluded.description,
  is_active = true;
