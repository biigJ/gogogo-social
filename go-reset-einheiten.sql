-- go-reset-einheiten.sql — individuelle Einheiten löschen, damit alle einen Wochenplan wählen
-- Einmalig im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Mehrfaches Ausführen schadet nicht.
--
-- Betroffen: alle Accounts außer Natalya (94a49c08-0818-4491-86a5-714885b6b73c).
--   1) Wochenvorlage pro Wochentag (go_coach_plans.day_training_units + day_mo … day_so) wird geleert.
--      Ziel, Lebenssituation und Coach-Text bleiben.
--   2) Geplante Einzel-Events ab heute ohne Wochenplan (enrollment_id ist leer) werden gelöscht.
--      Ausnahme: Events mit Zusagen oder Einladungen anderer (gemeinsame Termine bleiben).
-- Wochenpläne (enrollments) und erledigte Events bleiben unangetastet.
-- Sicherung: jede Zeile vorher als JSON in go_cleanup_backup (tbl = 'reset-einheiten:…').

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
  v_plans int;
  v_events int;
begin
  -- 1) Wochenvorlagen sichern und leeren
  insert into go_cleanup_backup (account_id, tbl, row_data)
  select p.account_id, 'reset-einheiten:go_coach_plans', to_jsonb(p)
  from go_coach_plans p
  where p.account_id <> v_keep
    and (coalesce(p.day_training_units, '{}'::jsonb) <> '{}'::jsonb
         or coalesce(p.day_mo, p.day_di, p.day_mi, p.day_do, p.day_fr, p.day_sa, p.day_so) is not null);

  update go_coach_plans p
  set day_training_units = '{}'::jsonb,
      day_mo = null, day_di = null, day_mi = null, day_do = null, day_fr = null, day_sa = null, day_so = null
  where p.account_id <> v_keep
    and (coalesce(p.day_training_units, '{}'::jsonb) <> '{}'::jsonb
         or coalesce(p.day_mo, p.day_di, p.day_mi, p.day_do, p.day_fr, p.day_sa, p.day_so) is not null);
  get diagnostics v_plans = row_count;

  -- 2) Geplante Einzel-Events ab heute sichern und löschen
  create temp table _reset_ev on commit drop as
  select e.*
  from events e
  where e.user_id <> v_keep
    and e.enrollment_id is null
    and e.status = 'geplant'
    and (e.starts_at at time zone 'Europe/Berlin')::date >= v_today
    and not exists (select 1 from event_rsvps r where r.event_id = e.id and r.user_id <> e.user_id)
    and not exists (select 1 from go_workout_invites i where i.event_id = e.id and i.status in ('pending', 'accepted'));

  insert into go_cleanup_backup (account_id, tbl, row_data)
  select r.user_id, 'reset-einheiten:events', to_jsonb(r) from _reset_ev r;

  delete from events e using _reset_ev r where e.id = r.id;
  get diagnostics v_events = row_count;

  raise notice 'Wochenvorlagen geleert: %, Einzel-Events gelöscht: %', v_plans, v_events;
end $$;

-- Kontrolle: was jetzt noch geplant ist (ab heute)
select a.name, count(*) filter (where e.enrollment_id is not null) as aus_wochenplan,
       count(*) filter (where e.enrollment_id is null) as einzeln_geblieben
from events e join go_accounts a on a.id = e.user_id
where e.status = 'geplant' and (e.starts_at at time zone 'Europe/Berlin')::date >= (now() at time zone 'Europe/Berlin')::date
group by a.name order by a.name;
