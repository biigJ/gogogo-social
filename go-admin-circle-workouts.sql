-- go-admin-circle-workouts.sql — Admin → Nutzer: alle Zirkeltraining-Workouts je Person, vergangen und geplant
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-circle-events.sql, go-hyrox-doubles.sql.
--
-- go_admin_circle_workouts(p_from, p_to)  eine Zeile je Person und Workout:
--   Circle-Events (events.circle_id) und Zirkeltrainings des Coaches (Besitzer des Circles) → Coach + Zusagen (event_rsvps)
--   eigene Zirkeltrainings ohne Circle → der Circle, in dem die Person Mitglied ist (sonst ohne Circle)
--   HYROX Doubles (go_hyrox_doubles) → beide Partner
-- Zeitraum Standard: 120 Tage zurück bis 60 Tage voraus.

create or replace function go_admin_circle_workouts(p_from date default null, p_to date default null)
returns table (event_id uuid, starts_at timestamptz, day date, circle_id text, circle_name text, account_id uuid, mode text, note text, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := coalesce(p_from, (now() at time zone 'Europe/Berlin')::date - 120);
  v_to date := coalesce(p_to, (now() at time zone 'Europe/Berlin')::date + 60);
begin
  if not go_is_admin() then raise exception 'not_allowed'; end if;
  return query
  with ev as (
    select e.id, e.user_id, e.starts_at, e.note, e.status,
           coalesce(e.circle_id, c.group_id) as cid
      from events e
      left join go_circles c on e.circle_id is null and c.owner_id = e.user_id
     where (e.circle_id is not null or e.category = 'zirkel')
       and e.status <> 'abgesagt'
       and (e.starts_at at time zone 'Europe/Berlin')::date between v_from and v_to
  ),
  people as (
    -- Coach / Ersteller
    select ev.id, ev.starts_at, ev.cid, ev.user_id as acc, ev.note, 'event'::text as src from ev where ev.cid is not null
    union
    -- Zusagen zu Circle-Events
    select ev.id, ev.starts_at, ev.cid, r.user_id, ev.note, 'rsvp' from ev
      join event_rsvps r on r.event_id = ev.id and r.status = 'zugesagt'
     where ev.cid is not null
    union
    -- eigene Zirkeltrainings ohne Circle: Circle über die Mitgliedschaft
    select ev.id, ev.starts_at, m.group_id, ev.user_id, ev.note, 'own' from ev
      left join lateral (select gm.group_id from go_circle_members gm where gm.account_id = ev.user_id order by gm.created_at limit 1) m on true
     where ev.cid is null
  )
  select p.id, p.starts_at, (p.starts_at at time zone 'Europe/Berlin')::date, p.cid,
         coalesce(nullif(gc.name, ''), case when p.cid is null then 'ohne Circle' else 'Circle' end),
         p.acc,
         case when p.note like 'zirkel:double%' then 'double' else 'single' end,
         p.note, p.src
    from people p
    left join go_circles gc on gc.group_id = p.cid
  union all
  select null::uuid, (h.day + time '12:00') at time zone 'Europe/Berlin', h.day, h.circle_id,
         coalesce(nullif(gc.name, ''), 'Circle'), unnest(h.account_ids), 'double', null::text, 'hyrox'
    from go_hyrox_doubles h
    left join go_circles gc on gc.group_id = h.circle_id
   where h.day between v_from and v_to
  order by 2 desc;
end $$;
grant execute on function go_admin_circle_workouts(date, date) to anon, authenticated;
