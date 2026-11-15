-- go-natalya-v2.sql
-- Natalyas Plan im Kurse-v2-Modell (ersetzt go-natalya-plan.sql, das nie lief).
-- Voraussetzung: go-kurse-v2.sql. Idempotent.
--
-- Ergebnis: privater Kurs "Einfache Basics · Natalya" (Kopie von training-krafttraining),
-- 12 Wochen, 3 Einheiten (Di/Mi/Sa), Start 16.11.2026, Events erzeugt,
-- bisher erledigte Tage aus go_natalya_logs als erledigte Events übernommen.

do $$
declare
  v_user uuid := '94a49c08-0818-4491-86a5-714885b6b73c';
  v_base uuid;
  v_course uuid;
  v_coach uuid;
  v_enroll uuid;
  v_start date := date '2026-11-16';
begin
  if not exists (select 1 from go_accounts where id = v_user) then
    raise notice 'Natalya-Account nicht gefunden, nichts geändert';
    return;
  end if;

  select coalesce(trainer_id, '96170549-7420-4738-843c-aa0f702b321d'::uuid)
    into v_coach from go_accounts where id = v_user;
  if not exists (select 1 from go_accounts where id = v_coach) then
    v_coach := null;
  end if;

  -- Bestehende Kopie wiederverwenden
  select id into v_course from courses
    where private_for = v_user and slug like 'training-krafttraining-%'
    order by created_at limit 1;

  if v_course is null then
    select id into v_base from courses where slug = 'training-krafttraining';
    if v_base is null then
      raise exception 'Kurs training-krafttraining fehlt (go-trainings-to-courses.sql)';
    end if;
    v_course := go_copy_course_for(v_base, v_user);
  end if;

  update courses set
    title = 'Einfache Basics · Natalya',
    duration_weeks = 12,
    sessions_per_week = 3,
    block_weeks = 4,
    start_date = v_start,
    coach_id = v_coach,
    owner = 'coach',
    is_active = true
  where id = v_course;

  -- Einheit 1 auf Einheit 2 und 3 übertragen (gleiche Übungen an Di/Mi/Sa)
  insert into course_sessions (course_id, block_no, session_no, is_travel, title, focus, category, blocks)
  select s.course_id, s.block_no, n, false, s.title, s.focus, s.category, s.blocks
  from course_sessions s
  cross join (values (2), (3)) as x(n)
  where s.course_id = v_course and s.block_no = 1 and s.session_no = 1 and not s.is_travel
  on conflict (course_id, block_no, session_no, is_travel) do nothing;

  -- Enrollment
  select id into v_enroll from enrollments
    where user_id = v_user and course_id = v_course
    order by created_at desc limit 1;

  if v_enroll is null then
    insert into enrollments (user_id, course_id, status, start_date, weekdays, sessions_per_week, assigned_by)
    values (v_user, v_course, 'aktiv', v_start, array[1, 2, 5], 3, v_coach)
    returning id into v_enroll;
  else
    update enrollments set status = 'aktiv', start_date = v_start,
      weekdays = array[1, 2, 5], sessions_per_week = 3, assigned_by = v_coach
    where id = v_enroll;
  end if;

  perform go_generate_events(v_enroll);

  -- Bisher erledigte Tage übernehmen
  if to_regclass('public.go_natalya_logs') is not null then
    insert into events (
      user_id, course_id, enrollment_id, category, starts_at,
      location, visibility, is_unplanned, status, title
    )
    select v_user, v_course, v_enroll, 'kraft',
      ((d.workout_date::text || ' 13:00:00')::timestamp at time zone 'Europe/Berlin'),
      null, 'team', false, 'erledigt', 'Einfache Basics'
    from (select distinct workout_date from go_natalya_logs where done = true) d
    where not exists (
      select 1 from events x
      where x.user_id = v_user and x.status = 'erledigt'
        and (x.starts_at at time zone 'Europe/Berlin')::date = d.workout_date
    );
  end if;

  delete from events where user_id = v_user and title = 'Streak Seed';
end $$;

-- Kurzcheck: Kurs, Einheiten, geplante und erledigte Termine
select
  c.title,
  (select count(*) from course_sessions s where s.course_id = c.id) as einheiten,
  (select count(*) from events e where e.course_id = c.id and e.status = 'geplant') as geplant,
  (select count(*) from events e where e.user_id = c.private_for and e.status = 'erledigt') as erledigt,
  (select min(e.starts_at at time zone 'Europe/Berlin')::date from events e
     where e.course_id = c.id and e.status = 'geplant') as erster_termin
from courses c
where c.private_for = '94a49c08-0818-4491-86a5-714885b6b73c'
  and c.slug like 'training-krafttraining-%';
