-- go-circle-events-who.sql — Circle-Events: wer hat zugesagt (dritte Zeile der Tagespille).
-- Idempotent. Ersetzt go_circle_events(text, integer, boolean) aus go-circle-events-past.sql, gleiche Logik plus Spalte rsvps.
drop function if exists public.go_circle_events(text, integer, boolean);
create function public.go_circle_events(p_group text, p_days integer default 14, p_past boolean default false)
returns table(id uuid, user_id uuid, title text, starts_at timestamptz, note text, location text,
              circle_id text, created_at timestamptz, joined boolean, rsvp_count integer, rsvps jsonb)
language sql stable security definer set search_path to 'public'
as $function$
  select e.id, e.user_id, e.title, e.starts_at, e.note, e.location, e.circle_id, e.created_at,
         exists (select 1 from event_rsvps r where r.event_id = e.id and r.user_id = go_current_account_id() and r.status = 'zugesagt'),
         (select count(*)::int from event_rsvps r where r.event_id = e.id and r.user_id <> e.user_id and r.status = 'zugesagt'),
         coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'photo_url', a.photo_url) order by r.created_at)
                   from event_rsvps r join go_accounts a on a.id = r.user_id
                   where r.event_id = e.id and r.user_id <> e.user_id and r.status = 'zugesagt'), '[]'::jsonb)
  from events e
  left join go_circles c on c.group_id = trim(p_group)
  where e.status = 'geplant'
    and e.starts_at >= case when coalesce(p_past, false)
          then ((now() at time zone 'Europe/Berlin')::date - 1)::timestamp at time zone 'Europe/Berlin'
          else now() - interval '2 hours' end
    and e.starts_at < now() + make_interval(days => greatest(1, least(coalesce(p_days, 14), 60)))
    and (
      e.circle_id = trim(p_group)
      or (e.circle_id is null and e.category = 'zirkel' and c.owner_id is not null and e.user_id = c.owner_id)
    )
  order by e.starts_at;
$function$;
grant execute on function public.go_circle_events(text, integer, boolean) to anon, authenticated;
