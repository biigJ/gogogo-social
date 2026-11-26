-- go-group-copy.sql — Teilnahme am Gruppentraining: die eigene Einheit (für Workout, Erledigt, Tamagotchi) bleibt in der
-- Datenbank, ist im Frontend aber nie als eigene Karte zu sehen. events.copy_of zeigt auf das Event der Gruppe. Idempotent.

alter table events add column if not exists copy_of uuid references events(id) on delete set null;
create index if not exists events_copy_of_idx on events(copy_of);

-- Bestand: eigene Einheit eines Mitglieds am selben Tag wie das Gruppen-Event, zu dem es zugesagt hat
update events c set copy_of = o.id
from events o
where c.copy_of is null and c.group_id is not null and c.group_id = o.group_id
  and c.user_id <> o.user_id and c.enrollment_id is null
  and (c.starts_at at time zone 'Europe/Berlin')::date = (o.starts_at at time zone 'Europe/Berlin')::date
  and lower(trim(c.title)) = lower(trim(o.title))
  and c.created_at > o.created_at
  and exists (select 1 from event_rsvps r where r.event_id = o.id and r.user_id = c.user_id);
