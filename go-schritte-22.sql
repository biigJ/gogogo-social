-- go-schritte-22.sql — Schritte-Events immer mit 22:00 Uhr als Voreinstellung
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-wochenplan-slots.sql.
--
-- go_generate_events legt Plan-Events um 13:00 (Berlin) an. Ein Trigger setzt Schritte-Events (Titel enthält „Schritte“)
-- beim Anlegen auf 22:00 desselben Tages, aber nur wenn die Zeit 13:00 ist (eigene Uhrzeiten bleiben).
-- Damit ein erneuter Lauf von go_generate_events keine Doppelten anlegt (er prüft nur exakt 13:00),
-- überspringt der Trigger Plan-Events, die es am selben Tag mit gleichem Titel schon gibt.
-- Bestehende kommende Schritte-Events um 13:00 werden auf 22:00 gesetzt.

create or replace function go_events_plan_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_day date := (new.starts_at at time zone 'Europe/Berlin')::date;
begin
  if new.enrollment_id is not null and new.status = 'geplant' and exists (
    select 1 from events e
    where e.enrollment_id = new.enrollment_id
      and (e.starts_at at time zone 'Europe/Berlin')::date = v_day
      and coalesce(e.title, '') = coalesce(new.title, '')
  ) then
    return null;
  end if;
  if new.title ilike '%schritte%' and (new.starts_at at time zone 'Europe/Berlin')::time = time '13:00' then
    new.starts_at := (v_day + time '22:00') at time zone 'Europe/Berlin';
  end if;
  return new;
end $$;

drop trigger if exists go_events_plan_defaults on events;
create trigger go_events_plan_defaults before insert on events
  for each row execute function go_events_plan_defaults();

-- bestehende: kommende, geplante Schritte-Events mit Standardzeit 13:00 → 22:00
update events
   set starts_at = (((starts_at at time zone 'Europe/Berlin')::date) + time '22:00') at time zone 'Europe/Berlin'
 where title ilike '%schritte%'
   and status = 'geplant'
   and (starts_at at time zone 'Europe/Berlin')::date >= (now() at time zone 'Europe/Berlin')::date
   and (starts_at at time zone 'Europe/Berlin')::time = time '13:00';
