-- go-rsvp-sync.sql — Zusage am Event (event_rsvps) und Einladung (go_workout_invites) sind dasselbe.
-- Zusage in der Gruppe/am Event → offene Einladung derselben Person gilt als angenommen; Absage → abgelehnt.
-- Einladung angenommen/abgelehnt (auch direkt per PATCH) → Zusage am Event gesetzt/entfernt.
-- Jede neue Zusage und jede Absage meldet sich beim Ersteller des Events (go_messages: Herz + Dialog). Idempotent.

-- Zusage → Einladung + Meldung
create or replace function public.go_rsvp_sync()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_ev record;
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_event uuid := coalesce(new.event_id, old.event_id);
  v_on boolean := tg_op <> 'DELETE' and new.status = 'zugesagt';
  v_was boolean := tg_op <> 'INSERT' and old.status = 'zugesagt';
begin
  if v_on = v_was then return coalesce(new, old); end if;
  if pg_trigger_depth() <= 1 then
    update go_workout_invites set status = case when v_on then 'accepted' else 'declined' end, updated_at = now()
    where event_id = v_event and to_id = v_user
      and status <> case when v_on then 'accepted' else 'declined' end
      and status in ('pending', 'maybe', 'accepted', 'declined');
  end if;
  select e.user_id, e.title, e.starts_at into v_ev from events e where e.id = v_event;
  if v_ev.user_id is not null and v_ev.user_id <> v_user and v_ev.starts_at > now() - interval '2 hours' then
    insert into go_messages (to_id, from_id, kind, body)
    values (v_ev.user_id, v_user, 'rsvp',
      go_first_name(v_user) || case when v_on then ' nimmt teil: ' else ' hat abgesagt: ' end || coalesce(v_ev.title, 'Training') || ', ' ||
      to_char(v_ev.starts_at at time zone 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || '.');
  end if;
  return coalesce(new, old);
end $function$;
drop trigger if exists go_rsvp_sync on event_rsvps;
create trigger go_rsvp_sync after insert or update of status or delete on event_rsvps
  for each row execute function public.go_rsvp_sync();

-- Einladung → Zusage
create or replace function public.go_invite_rsvp_sync()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.event_id is null or new.status is not distinct from old.status or pg_trigger_depth() > 1 then return new; end if;
  if new.status = 'accepted' then
    insert into event_rsvps (event_id, user_id, status) values (new.event_id, new.to_id, 'zugesagt')
    on conflict (event_id, user_id) do update set status = 'zugesagt';
  elsif new.status in ('declined', 'cancelled') and old.status = 'accepted' then
    delete from event_rsvps where event_id = new.event_id and user_id = new.to_id;
  end if;
  return new;
end $function$;
drop trigger if exists go_invite_rsvp_sync on go_workout_invites;
create trigger go_invite_rsvp_sync after update of status on go_workout_invites
  for each row execute function public.go_invite_rsvp_sync();

-- Bestand: Zusagen ohne passende Einladung angleichen (z. B. Stefan, Athletic Day)
update go_workout_invites i set status = 'accepted', updated_at = now()
from event_rsvps r
where r.event_id = i.event_id and r.user_id = i.to_id and r.status = 'zugesagt'
  and i.status in ('pending', 'maybe', 'declined');
