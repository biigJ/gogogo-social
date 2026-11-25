-- go-series-endless.sql — Wiederkehrende Events ohne Ende: Serien werden rollierend verlängert.
-- Bisher legten go_generate_events (Wochenplan) und das Zirkeltraining die Termine einmalig für 12 Wochen an.
-- Jetzt schreibt go_extend_series() je Serie und Wochentag den letzten Termin Woche für Woche fort,
-- bis 12 Wochen ab heute. Uhrzeit, Ort, Sichtbarkeit usw. kommen vom letzten Termin (= Stand aus „Tage bearbeiten“).
-- Serie = aktive Wochenplan-Einschreibung (enrollment_id) oder eigenes Zirkeltraining (gleicher Titel),
-- mit mindestens 3 Terminen an diesem Wochentag und dem letzten Termin in der Zukunft (verschobene Serien enden am alten Tag).
-- Die App ruft go_extend_series() einmal am Tag auf. Idempotent.

create or replace function public.go_extend_series_for(p_user uuid, p_weeks integer default 12)
returns integer
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_until date := (now() at time zone 'Europe/Berlin')::date + greatest(4, least(coalesce(p_weeks, 12), 26)) * 7;
  r record;
  v_day date;
  v_local time;
  v_untimed boolean;
  v_new timestamptz;
  v_n integer := 0;
begin
  if p_user is null then return 0; end if;
  for r in
    select * from (
      select e.*,
             coalesce(e.enrollment_id::text, 'z:' || lower(trim(e.title))) as sk,
             extract(isodow from e.starts_at at time zone 'Europe/Berlin')::int as dow,
             count(*) over (partition by coalesce(e.enrollment_id::text, 'z:' || lower(trim(e.title))),
                                         extract(isodow from e.starts_at at time zone 'Europe/Berlin')) as cnt,
             row_number() over (partition by coalesce(e.enrollment_id::text, 'z:' || lower(trim(e.title))),
                                             extract(isodow from e.starts_at at time zone 'Europe/Berlin')
                                order by e.starts_at desc) as rn
      from events e
      left join enrollments n on n.id = e.enrollment_id
      where e.user_id = p_user
        and coalesce(e.travel_auto, false) = false
        and coalesce(e.item_type, '') not in ('support_session', 'nutrition_log')
        and (
          (e.enrollment_id is not null and n.status = 'aktiv')
          or (e.enrollment_id is null and e.category = 'zirkel' and e.circle_id is null and coalesce(e.coach_group, false) = false)
        )
    ) x
    where x.rn = 1 and x.cnt >= 3 and x.starts_at > now()
  loop
    v_untimed := (r.starts_at at time zone 'UTC')::time = time '12:00:00';
    v_local := (r.starts_at at time zone 'Europe/Berlin')::time;
    v_day := (r.starts_at at time zone 'Europe/Berlin')::date + 7;
    while v_day <= v_until loop
      if v_untimed then
        v_new := (v_day::text || ' 12:00:00')::timestamp at time zone 'UTC';
      else
        v_new := (v_day + v_local) at time zone 'Europe/Berlin';
        -- genau 12:00 UTC heißt in der App „ohne Uhrzeit“: eine Sekunde dazu
        if (v_new at time zone 'UTC')::time = time '12:00:00' then v_new := v_new + interval '1 second'; end if;
      end if;
      if not exists (
        select 1 from events e
        where e.user_id = p_user
          and (e.starts_at at time zone 'Europe/Berlin')::date = v_day
          and coalesce(e.enrollment_id::text, 'z:' || lower(trim(e.title))) = r.sk
      ) then
        insert into events (user_id, course_id, enrollment_id, course_session_id, category, starts_at, location, visibility,
                            is_unplanned, status, title, item_type, group_id, bubble_id, assigned_by, note)
        values (r.user_id, r.course_id, r.enrollment_id, r.course_session_id, r.category, v_new, r.location, r.visibility,
                false, 'geplant', r.title, r.item_type, r.group_id, r.bubble_id, r.assigned_by,
                case when r.category = 'zirkel' then r.note else null end);
        v_n := v_n + 1;
      end if;
      v_day := v_day + 7;
    end loop;
  end loop;
  return v_n;
end $function$;
revoke all on function public.go_extend_series_for(uuid, integer) from public, anon, authenticated;

-- Aufruf aus der App: nur für das eigene Konto
create or replace function public.go_extend_series(p_weeks integer default 12)
returns integer
language sql security definer set search_path to 'public'
as $function$
  select public.go_extend_series_for(go_current_account_id(), p_weeks);
$function$;
grant execute on function public.go_extend_series(integer) to anon, authenticated;
