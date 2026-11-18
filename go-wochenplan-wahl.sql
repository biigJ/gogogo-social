-- go-wochenplan-wahl.sql — Nutzer wählen Wochenpläne selbst, Coaches für Coachees
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Voraussetzung: go-wochenplan-slots.sql, go-admin.sql, go-coach-enroll.sql.
--
-- courses.is_public    Haken im Kurs-Editor: Nutzer sehen den Plan in Woche → Stift
-- courses.goals        Ziele, zu denen der Plan passt (laufen, ruecken, gesund, abnehmen, muskeln, gelenke)
-- courses.preview_url  Instagram- oder YouTube-Link als Vorschau auf der Karte
-- go_apply_plan(...)   Plan anwenden: alte Pläne beenden, offene Termine ab heute entfernen,
--                      neue Einschreibung mit Tagesverteilung, Termine ab heute erzeugen.

alter table courses add column if not exists is_public boolean not null default false;
alter table courses add column if not exists goals text[] not null default '{}';
alter table courses add column if not exists preview_url text;

-- Startbelegung der Ziele (Matrix in docs/ZIELE-WOCHENPLAENE.md); Haken „öffentlich“ setzt Joscha im Editor
update courses set goals = array['laufen','gelenke','gesund'] where title = 'Fit for Run' and goals = '{}';
update courses set goals = array['gelenke','laufen','ruecken'] where title = 'Bulletproof Knees' and goals = '{}';
update courses set goals = array['muskeln','gesund','abnehmen'] where title like 'Hybrid Kraft%' and goals = '{}';
update courses set goals = array['abnehmen','gesund','muskeln'] where title = 'Superwoman' and goals = '{}';

create or replace function go_apply_plan(
  p_user uuid,
  p_course uuid,
  p_weekdays int[],
  p_start date default null,
  p_weeks int default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  v_start date := coalesce(p_start, date_trunc('week', (now() at time zone 'Europe/Berlin'))::date);
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_course courses%rowtype;
  v_en uuid;
  v_ended int := 0;
  v_removed int := 0;
  v_made int := 0;
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

  -- alte Pläne beenden, offene Termine ab heute entfernen
  delete from events e
  using enrollments n
  where e.enrollment_id = n.id and n.user_id = p_user and n.status = 'aktiv'
    and e.status = 'geplant'
    and (e.starts_at at time zone 'Europe/Berlin')::date >= v_today;
  get diagnostics v_removed = row_count;
  update enrollments set status = 'beendet' where user_id = p_user and status = 'aktiv';
  get diagnostics v_ended = row_count;

  insert into enrollments (user_id, course_id, status, start_date, weekdays, sessions_per_week, weeks, assigned_by, payment_status)
  values (p_user, p_course, 'aktiv', v_start, p_weekdays, 7, coalesce(p_weeks, 12),
          case when v_me <> p_user then v_me else null end, 'gratis')
  returning id into v_en;

  v_made := go_generate_events(v_en);
  return jsonb_build_object('ok', true, 'enrollment_id', v_en, 'events', v_made, 'ended', v_ended, 'removed', v_removed);
end;
$$;
grant execute on function go_apply_plan(uuid, uuid, int[], date, int) to anon, authenticated;
