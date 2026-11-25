-- go-apply-plan-from-tomorrow.sql — Neuer Wochenplan ändert heute und die Vergangenheit nicht.
-- Bisher: go_apply_plan löschte offene Termine ab HEUTE und legte für heute neue an (Mimi: Indoor Bike heute,
-- obwohl sie schon eine Alternative gemacht hatte). Jetzt: alte offene Termine erst ab morgen entfernen,
-- neue Termine erst ab morgen. Idempotent (create or replace, gleiche Signatur).

create or replace function public.go_apply_plan(p_user uuid, p_course uuid, p_weekdays integer[], p_start date default null::date, p_weeks integer default 12)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
  v_start date := coalesce(p_start, date_trunc('week', (now() at time zone 'Europe/Berlin'))::date);
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_course courses%rowtype;
  v_en uuid;
  v_ended int := 0;
  v_removed int := 0;
  v_made int := 0;
  v_today_new int := 0;
begin
  if v_me is null then
    raise exception 'login';
  end if;
  if not (v_me = p_user or go_is_coach_of(p_user) or go_is_admin()) then
    raise exception 'not allowed';
  end if;
  select * into v_course from courses where id = p_course;
  if not found then
    raise exception 'course not found';
  end if;
  -- Nutzer selbst: nur öffentliche Pläne. Coach und Admin: alle.
  if v_me = p_user and not v_course.is_public and not go_is_admin() and not go_is_coach_of(p_user) then
    raise exception 'not public';
  end if;
  if p_weekdays is null or array_length(p_weekdays, 1) <> 7
     or not (p_weekdays <@ array[0,1,2,3,4,5,6]) then
    raise exception 'weekdays';
  end if;

  -- alte Pläne beenden, offene Termine erst AB MORGEN entfernen (heute und Vergangenheit bleiben)
  delete from events e
  using enrollments n
  where e.enrollment_id = n.id and n.user_id = p_user and n.status = 'aktiv'
    and e.status = 'geplant'
    and (e.starts_at at time zone 'Europe/Berlin')::date > v_today;
  get diagnostics v_removed = row_count;
  update enrollments set status = 'beendet' where user_id = p_user and status = 'aktiv';
  get diagnostics v_ended = row_count;

  insert into enrollments (user_id, course_id, status, start_date, weekdays, sessions_per_week, weeks, assigned_by, payment_status)
  values (p_user, p_course, 'aktiv', v_start, p_weekdays, 7, coalesce(p_weeks, 12),
          case when v_me <> p_user then v_me else null end, 'gratis')
  returning id into v_en;

  v_made := go_generate_events(v_en);
  -- neuer Plan beginnt morgen: heute (und davor) erzeugte Termine wieder entfernen
  delete from events e
  where e.enrollment_id = v_en and (e.starts_at at time zone 'Europe/Berlin')::date <= v_today;
  get diagnostics v_today_new = row_count;
  return jsonb_build_object('ok', true, 'enrollment_id', v_en, 'events', v_made - v_today_new, 'ended', v_ended, 'removed', v_removed);
end;
$function$;
