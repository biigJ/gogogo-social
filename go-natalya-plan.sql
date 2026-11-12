-- Natalya: privater Kurs, Enrollment, Event-Generator, Log→Events
-- Voraussetzung: go-courses-support.sql + go-private-courses.sql
-- Idempotent. Im SQL Editor von agpysewcsakdpmpftndp ausführen.
--
-- Zuordnung alt → neu (Stand 2026-11-12):
--   go_natalya_routine.days ["tue","wed","sat"]  → weekdays [1,2,5]  (0=Mo…6=So)
--   go_natalya_routine.started_on 2026-11-10     → Plan läuft; Enrollment start_date = nächster Mo 2026-11-16
--   go_kraft_presets system_id=krafttraining     → Templates category=kraft, Titel „Einfache Basics“
--   go_coach_plans kraft[3,6]+zirkel[4]          → NICHT verwendet (day_training_units leer;
--                                                  aktive App-Tage kommen aus go_natalya_routine)
--   go_natalya_logs done am 2026-10-18            → 1 Event status=erledigt
--   Streak Seed                                  → wird gelöscht

-- ---------------------------------------------------------------------------
-- go_generate_events(enrollment_id)
-- session_no innerhalb einer Woche mappt auf das n-te Element von weekdays
-- (sortiert aufsteigend). start_date = Montag der Woche 1.
-- ---------------------------------------------------------------------------
create or replace function go_generate_events(p_enrollment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  en enrollments%rowtype;
  tmpl course_templates%rowtype;
  v_weekdays int[];
  v_wd int;
  v_day date;
  v_starts timestamptz;
  v_inserted int := 0;
begin
  select * into en from enrollments where id = p_enrollment_id;
  if not found then
    raise exception 'enrollment % not found', p_enrollment_id;
  end if;
  if en.start_date is null then
    raise exception 'enrollment % has no start_date', p_enrollment_id;
  end if;
  if en.weekdays is null or coalesce(array_length(en.weekdays, 1), 0) = 0 then
    raise exception 'enrollment % has no weekdays', p_enrollment_id;
  end if;

  select array_agg(x order by x) into v_weekdays
  from unnest(en.weekdays) as x;

  for tmpl in
    select * from course_templates
    where course_id = en.course_id
    order by week_no, session_no
  loop
    if tmpl.session_no < 1 or tmpl.session_no > coalesce(array_length(v_weekdays, 1), 0) then
      continue;
    end if;
    v_wd := v_weekdays[tmpl.session_no];
    -- start_date = Montag; + (week_no-1) Wochen + Wochentag-Offset
    v_day := en.start_date + ((tmpl.week_no - 1) * 7) + v_wd;
    v_starts := ((v_day::text || ' 13:00:00')::timestamp at time zone 'Europe/Berlin');

    if exists (
      select 1 from events e
      where e.enrollment_id = en.id
        and e.starts_at = v_starts
        and e.course_id = en.course_id
    ) then
      continue;
    end if;

    insert into events (
      user_id, course_id, enrollment_id, category, starts_at,
      location, visibility, is_unplanned, status, title
    ) values (
      en.user_id, en.course_id, en.id, tmpl.category, v_starts,
      null, 'gruppe', false, 'geplant', tmpl.title
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

grant execute on function go_generate_events(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privater Kurs „Natalya Plan“
-- ---------------------------------------------------------------------------
insert into courses (
  title, slug, level, duration_weeks, sessions_per_week, category_default,
  start_date, seats, price_eur, description, coach_id, source, is_active, private_for
)
values (
  'Natalya Plan',
  'natalya-plan',
  null,
  12,
  3,
  'kraft',
  date '2026-11-16',
  1,
  0,
  'Privater 12-Wochen-Plan aus go_natalya_routine (Di/Mi/Sa) + Einfache Basics',
  '96170549-7420-4738-843c-aa0f702b321d'::uuid,  -- biigJ
  'own',
  true,
  '94a49c08-0818-4491-86a5-714885b6b73c'::uuid   -- Natalya
)
on conflict (slug) do update set
  title = excluded.title,
  duration_weeks = excluded.duration_weeks,
  sessions_per_week = excluded.sessions_per_week,
  category_default = excluded.category_default,
  start_date = excluded.start_date,
  description = excluded.description,
  coach_id = excluded.coach_id,
  source = excluded.source,
  is_active = true,
  private_for = excluded.private_for;

-- 12 × 3 Templates (session_no 1→Di, 2→Mi, 3→Sa)
insert into course_templates (course_id, week_no, session_no, title, category, description)
select
  c.id,
  w.week_no,
  s.session_no,
  format('Woche %s · Einheit %s · Einfache Basics', w.week_no, s.session_no),
  'kraft',
  'Aus go_kraft_presets (krafttraining): Child, Cat-Cow, Downdog, Wall Sit, Hang, Split Squat, SL Deadlift, SL Hip Thrust, Lateral, Press, Push-up, Crunch'
from courses c
cross join generate_series(1, 12) as w(week_no)
cross join generate_series(1, 3) as s(session_no)
where c.slug = 'natalya-plan'
on conflict (course_id, week_no, session_no) do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description;

-- ---------------------------------------------------------------------------
-- Enrollment aktiv, start = nächster Montag (2026-11-16), weekdays Di/Mi/Sa
-- ---------------------------------------------------------------------------
insert into enrollments (user_id, course_id, status, start_date, weekdays)
select
  '94a49c08-0818-4491-86a5-714885b6b73c'::uuid,
  c.id,
  'aktiv',
  date '2026-11-16',
  array[1, 2, 5]::int[]
from courses c
where c.slug = 'natalya-plan'
  and not exists (
    select 1 from enrollments e
    where e.user_id = '94a49c08-0818-4491-86a5-714885b6b73c'::uuid
      and e.course_id = c.id
      and e.status = 'aktiv'
  );

-- Falls Enrollment schon existiert: Felder aktualisieren
update enrollments e
set status = 'aktiv',
    start_date = date '2026-11-16',
    weekdays = array[1, 2, 5]::int[]
from courses c
where c.slug = 'natalya-plan'
  and e.course_id = c.id
  and e.user_id = '94a49c08-0818-4491-86a5-714885b6b73c'::uuid;

-- Events aus Templates erzeugen
select go_generate_events(e.id) as generated_events
from enrollments e
join courses c on c.id = e.course_id
where c.slug = 'natalya-plan'
  and e.user_id = '94a49c08-0818-4491-86a5-714885b6b73c'::uuid
  and e.status = 'aktiv'
order by e.created_at desc
limit 1;

-- ---------------------------------------------------------------------------
-- Bisher erledigte Tage → Events (go_natalya_logs done)
-- ---------------------------------------------------------------------------
insert into events (
  user_id, course_id, enrollment_id, category, starts_at,
  location, visibility, is_unplanned, status, title
)
select
  '94a49c08-0818-4491-86a5-714885b6b73c'::uuid,
  c.id,
  e.id,
  'kraft',
  ((d.workout_date::text || ' 13:00:00')::timestamp at time zone 'Europe/Berlin'),
  null,
  'gruppe',
  false,
  'erledigt',
  'Einfache Basics · übernommen'
from courses c
join enrollments e
  on e.course_id = c.id
 and e.user_id = '94a49c08-0818-4491-86a5-714885b6b73c'::uuid
 and e.status = 'aktiv'
join (
  select distinct workout_date
  from go_natalya_logs
  where done = true
) d on true
where c.slug = 'natalya-plan'
  and not exists (
    select 1 from events x
    where x.user_id = '94a49c08-0818-4491-86a5-714885b6b73c'::uuid
      and x.status = 'erledigt'
      and (x.starts_at at time zone 'Europe/Berlin')::date = d.workout_date
      and x.title = 'Einfache Basics · übernommen'
  );

-- Streak-Seed entfernen
delete from events
where user_id = '94a49c08-0818-4491-86a5-714885b6b73c'::uuid
  and title = 'Streak Seed';

-- Kurzcheck
select
  (select count(*) from course_templates t join courses c on c.id = t.course_id where c.slug = 'natalya-plan') as templates,
  (select count(*) from events ev join courses c on c.id = ev.course_id where c.slug = 'natalya-plan' and ev.status = 'geplant') as geplant,
  (select count(*) from events ev where ev.user_id = '94a49c08-0818-4491-86a5-714885b6b73c'::uuid and ev.status = 'erledigt') as erledigt,
  go_streak_days('94a49c08-0818-4491-86a5-714885b6b73c'::uuid) as streak;
