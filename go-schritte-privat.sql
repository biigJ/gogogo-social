-- go-schritte-privat.sql — Schritte-Events (> 5.000 Schritte, > 10.000 Schritte …) sind privat,
-- bis der Nutzer sie selbst auf „zeigen“ stellt. Freunde sehen sie weder heute noch in der Zukunft.
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.

create or replace function go_steps_private()
returns trigger
language plpgsql
as $$
begin
  -- nur geplante Termine aus Plänen/Coach; selbst geloggte Events behalten die gewählte Sichtbarkeit
  if new.title ilike '%schritte%' and not coalesce(new.is_unplanned, false) then
    new.visibility := 'privat';
  end if;
  return new;
end $$;

drop trigger if exists go_steps_private on events;
create trigger go_steps_private before insert on events
  for each row execute function go_steps_private();

-- bestehende offene Schritte-Termine ab heute
update events set visibility = 'privat'
where title ilike '%schritte%'
  and status = 'geplant'
  and starts_at >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'
  and coalesce(is_unplanned, false) = false
  and visibility is distinct from 'privat';
