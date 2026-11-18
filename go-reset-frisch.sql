-- go-reset-frisch.sql — frischer Start für alle außer Natalya
-- Einmalig im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Mehrfaches Ausführen schadet nicht.
--
-- Für alle Accounts außer Natalya (94a49c08-0818-4491-86a5-714885b6b73c):
--   1) Alte Wochentags-Vorlage leeren (go_coach_plans.kraft_weekdays, ausdauer_weekdays). Freitag-Zirkel bleibt.
--      Daraus hat die App „Einfache Basics“ & Co. in die Woche gesetzt.
--   2) Laufende Wochenpläne beenden (enrollments.status = 'beendet').
--   3) Alle geplanten Termine ab heute löschen, auch gemeinsame (Zusagen dazu fallen mit weg).
-- Erledigte Termine, Tracking und Profile bleiben. Sicherung in go_cleanup_backup (tbl 'reset-frisch:…').

create table if not exists go_cleanup_backup (
  id bigserial primary key,
  account_id uuid not null,
  tbl text not null,
  col text,
  row_data jsonb not null,
  created_at timestamptz not null default now()
);

do $$
declare
  v_keep uuid := '94a49c08-0818-4491-86a5-714885b6b73c';
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  n1 int; n2 int; n3 int;
begin
  insert into go_cleanup_backup (account_id, tbl, row_data)
  select p.account_id, 'reset-frisch:go_coach_plans', to_jsonb(p) from go_coach_plans p
  where p.account_id <> v_keep;
  update go_coach_plans
  set kraft_weekdays = '[]'::jsonb, ausdauer_weekdays = '[]'::jsonb
  where account_id <> v_keep;
  get diagnostics n1 = row_count;

  insert into go_cleanup_backup (account_id, tbl, row_data)
  select n.user_id, 'reset-frisch:enrollments', to_jsonb(n) from enrollments n
  where n.user_id <> v_keep and n.status = 'aktiv';
  update enrollments set status = 'beendet' where user_id <> v_keep and status = 'aktiv';
  get diagnostics n2 = row_count;

  insert into go_cleanup_backup (account_id, tbl, row_data)
  select e.user_id, 'reset-frisch:events', to_jsonb(e) from events e
  where e.user_id <> v_keep and e.status = 'geplant'
    and (e.starts_at at time zone 'Europe/Berlin')::date >= v_today;
  delete from events e
  where e.user_id <> v_keep and e.status = 'geplant'
    and (e.starts_at at time zone 'Europe/Berlin')::date >= v_today;
  get diagnostics n3 = row_count;

  raise notice 'Vorlagen geleert: %, Pläne beendet: %, Termine gelöscht: %', n1, n2, n3;
end $$;

-- Kontrolle: ab heute geplant (sollte nur Natalya zeigen)
select a.name, count(*) from events e join go_accounts a on a.id = e.user_id
where e.status = 'geplant' and (e.starts_at at time zone 'Europe/Berlin')::date >= (now() at time zone 'Europe/Berlin')::date
group by a.name;
