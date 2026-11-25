-- go_circle_events: zusätzlich Anzahl Zusagen anderer (ohne Ersteller).
-- Circle-Seite sperrt Uhrzeit/Ort/Entfernen, sobald jemand zugesagt hat.
-- Rückgabetyp ändert sich: drop + create (idempotent).
drop function if exists public.go_circle_events(text, integer);
create function public.go_circle_events(p_group text, p_days integer default 14)
returns table(id uuid, user_id uuid, title text, starts_at timestamptz, note text, location text,
              circle_id text, created_at timestamptz, joined boolean, rsvp_count integer)
language sql stable security definer set search_path to 'public'
as $function$
  select e.id, e.user_id, e.title, e.starts_at, e.note, e.location, e.circle_id, e.created_at,
         exists (select 1 from event_rsvps r where r.event_id = e.id and r.user_id = go_current_account_id() and r.status = 'zugesagt'),
         (select count(*)::int from event_rsvps r where r.event_id = e.id and r.user_id <> e.user_id and r.status = 'zugesagt')
  from events e
  left join go_circles c on c.group_id = trim(p_group)
  where e.status = 'geplant'
    and e.starts_at >= now() - interval '2 hours'
    and e.starts_at < now() + make_interval(days => greatest(1, least(coalesce(p_days, 14), 60)))
    and (
      e.circle_id = trim(p_group)
      or (e.circle_id is null and e.category = 'zirkel' and c.owner_id is not null and e.user_id = c.owner_id)
    )
  order by e.starts_at;
$function$;
grant execute on function public.go_circle_events(text, integer) to anon, authenticated;
