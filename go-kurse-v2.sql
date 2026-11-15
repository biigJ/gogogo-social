-- go-kurse-v2.sql
-- Kurse v2: eine Quelle für Trainingspläne (gogogo-Standard + Coach-Pläne).
-- Idempotent. Additiv: alte Tabellen (course_templates, go_coach_plans,
-- go_kraft_*, go_ausdauer_presets, go_plan_*) bleiben unverändert lesbar.
--
-- Modell
--   exercises        Übungsbibliothek (Muster, Equipment, reisetauglich)
--   courses          + owner (gogogo | coach), focus, block_weeks, base_course_id
--   course_sessions  eine Trainingseinheit = Blöcke mit Übungen (jsonb),
--                    je Block (1..3 à block_weeks Wochen) und Einheit (1..3),
--                    optional Reisevariante (is_travel)
--   enrollments      + assigned_by, sessions_per_week
--   events           + course_session_id
--
-- Ablauf: im Supabase SQL Editor ausführen, danach
--   select go_kurse_v2_check();

-- ---------------------------------------------------------------------------
-- 1) exercises
-- ---------------------------------------------------------------------------
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  pattern text check (pattern is null or pattern in (
    'hocke', 'hueftbeuge', 'ausfallschritt', 'druecken', 'ziehen',
    'tragen', 'rumpf', 'plyo', 'schlitten', 'hybrid', 'mobility', 'ausdauer'
  )),
  equipment text[] not null default '{}',
  travel_ok boolean not null default false,
  cue text,
  video_url text,
  legacy_kraft_id text unique,
  created_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table exercises enable row level security;

drop policy if exists "exercises_select" on exercises;
create policy "exercises_select"
  on exercises for select to anon, authenticated
  using (true);

-- Boot-Klausel wie bei courses (bis echte Auth steht)
drop policy if exists "exercises_write_anon_boot" on exercises;
create policy "exercises_write_anon_boot"
  on exercises for all to anon
  using (true) with check (true);

-- Bestehende Admin-Übungen übernehmen (Name bleibt, Muster pflegt der Coach)
do $$
begin
  if to_regclass('public.go_kraft_exercises') is not null then
    insert into exercises (slug, name, legacy_kraft_id)
    select 'k-' || e.id, e.name, e.id
    from go_kraft_exercises e
    on conflict (legacy_kraft_id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) courses erweitern
-- ---------------------------------------------------------------------------
alter table courses add column if not exists owner text not null default 'gogogo';
alter table courses add column if not exists focus text;
alter table courses add column if not exists block_weeks int not null default 4;
alter table courses add column if not exists base_course_id uuid references courses(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courses_owner_check') then
    alter table courses add constraint courses_owner_check check (owner in ('gogogo', 'coach'));
  end if;
end $$;

-- Private Kurse und Kopien gehören dem Coach
update courses set owner = 'coach'
where owner = 'gogogo' and (private_for is not null or base_course_id is not null);

comment on column courses.owner is
  'gogogo = Standardkurs für alle Nutzer; coach = Plan eines Coaches (ggf. private_for).';
comment on column courses.block_weeks is
  'Wochen pro Block. Standard 12 Wochen = 3 Blöcke à 4 Wochen.';

-- ---------------------------------------------------------------------------
-- 3) course_sessions
-- ---------------------------------------------------------------------------
create table if not exists course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  block_no int not null default 1 check (block_no between 1 and 6),
  session_no int not null check (session_no between 1 and 7),
  is_travel boolean not null default false,
  title text not null,
  focus text check (focus is null or focus in (
    'unterkoerper', 'oberkoerper', 'ganzkoerper', 'ausdauer', 'zirkel'
  )),
  category text not null check (category in ('kraft', 'ausdauer', 'zirkel')),
  duration_min int,
  -- [{ "type": "mobility|skill|grund|hybrid|hypertrophie|finisher|ausdauer",
  --    "items": [{ "exercise": "<slug>", "name": "...", "sets": 3, "reps": "8",
  --                "time_s": null, "dist_m": null, "load": "RPE 7", "note": "" }] }]
  blocks jsonb not null default '[]'::jsonb,
  note text,
  updated_at timestamptz not null default now(),
  unique (course_id, block_no, session_no, is_travel)
);

create index if not exists course_sessions_course_idx
  on course_sessions (course_id, block_no, session_no);

alter table course_sessions enable row level security;

drop policy if exists "course_sessions_select" on course_sessions;
create policy "course_sessions_select"
  on course_sessions for select to anon, authenticated
  using (
    exists (
      select 1 from courses c
      where c.id = course_id
        and (
          (c.is_active = true and c.private_for is null)
          or c.private_for = go_current_account_id()
          or c.coach_id = go_current_account_id()
          or go_current_account_id() is null
        )
    )
  );

drop policy if exists "course_sessions_write_coach" on course_sessions;
create policy "course_sessions_write_coach"
  on course_sessions for all to authenticated
  using (exists (select 1 from courses c where c.id = course_id and c.coach_id = go_current_account_id()))
  with check (exists (select 1 from courses c where c.id = course_id and c.coach_id = go_current_account_id()));

drop policy if exists "course_sessions_write_anon_boot" on course_sessions;
create policy "course_sessions_write_anon_boot"
  on course_sessions for all to anon
  using (true) with check (true);

-- Altdaten: course_templates hat pro ÜBUNG eine Zeile (session_no = Übung).
-- Hier wird daraus EINE Einheit mit allen Übungen. "Aufwärmen" → mobility.
insert into course_sessions (course_id, block_no, session_no, title, focus, category, blocks)
select
  c.id, 1, 1, c.title,
  case when c.category_default = 'ausdauer' then 'ausdauer'
       when c.category_default = 'zirkel' then 'zirkel'
       else 'ganzkoerper' end,
  coalesce(c.category_default, 'kraft'),
  (
    select coalesce(jsonb_agg(b order by b->>'type' <> 'mobility'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'type', g.btype,
        'items', jsonb_agg(jsonb_build_object('name', g.title, 'note', '') order by g.session_no)
      ) as b
      from (
        select
          t.title, t.session_no,
          case when t.description ilike 'aufw%' then 'mobility' else 'grund' end as btype
        from course_templates t
        where t.course_id = c.id
      ) g
      group by g.btype
    ) x
  )
from courses c
where c.slug like 'training-%'
  and exists (select 1 from course_templates t where t.course_id = c.id)
  and not exists (select 1 from course_sessions s where s.course_id = c.id)
on conflict (course_id, block_no, session_no, is_travel) do nothing;

-- ---------------------------------------------------------------------------
-- 4) enrollments + events erweitern
-- ---------------------------------------------------------------------------
alter table enrollments add column if not exists assigned_by uuid references go_accounts(id) on delete set null;
alter table enrollments add column if not exists sessions_per_week int;
alter table events add column if not exists course_session_id uuid references course_sessions(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5) Events aus Kurs erzeugen (v2 mit Fallback auf course_templates)
-- ---------------------------------------------------------------------------
create or replace function go_generate_events(p_enrollment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  en enrollments%rowtype;
  co courses%rowtype;
  tmpl course_templates%rowtype;
  ses course_sessions%rowtype;
  v_weekdays int[];
  v_per_week int;
  v_weeks int;
  v_block int;
  v_max_block int;
  v_wd int;
  v_day date;
  v_starts timestamptz;
  v_inserted int := 0;
  w int;
  s int;
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

  select array_agg(x order by x) into v_weekdays from unnest(en.weekdays) as x;
  select * into co from courses where id = en.course_id;

  -- v2: Kurs hat course_sessions
  if exists (select 1 from course_sessions where course_id = en.course_id and not is_travel) then
    v_per_week := least(
      coalesce(en.sessions_per_week, co.sessions_per_week, array_length(v_weekdays, 1)),
      array_length(v_weekdays, 1)
    );
    v_weeks := coalesce(co.duration_weeks, 12);
    select max(block_no) into v_max_block from course_sessions
      where course_id = en.course_id and not is_travel;

    for w in 1..v_weeks loop
      v_block := least(((w - 1) / greatest(co.block_weeks, 1)) + 1, v_max_block);
      for s in 1..v_per_week loop
        -- Einheit s im aktuellen Block; fehlt sie, die höchste vorhandene davor
        select * into ses from course_sessions
          where course_id = en.course_id and not is_travel
            and block_no <= v_block and session_no = s
          order by block_no desc limit 1;
        if not found then
          continue;
        end if;

        v_wd := v_weekdays[s];
        v_day := en.start_date + ((w - 1) * 7) + v_wd;
        if v_day < current_date then
          continue;
        end if;
        v_starts := ((v_day::text || ' 13:00:00')::timestamp at time zone 'Europe/Berlin');

        if exists (
          select 1 from events e
          where e.enrollment_id = en.id and e.starts_at = v_starts
        ) then
          continue;
        end if;

        insert into events (
          user_id, course_id, enrollment_id, course_session_id, category, starts_at,
          location, visibility, is_unplanned, status, title
        ) values (
          en.user_id, en.course_id, en.id, ses.id, ses.category, v_starts,
          null, 'team', false, 'geplant', ses.title
        );
        v_inserted := v_inserted + 1;
      end loop;
    end loop;
    return v_inserted;
  end if;

  -- Fallback: altes Modell (course_templates)
  for tmpl in
    select * from course_templates where course_id = en.course_id order by week_no, session_no
  loop
    if tmpl.session_no < 1 or tmpl.session_no > coalesce(array_length(v_weekdays, 1), 0) then
      continue;
    end if;
    v_wd := v_weekdays[tmpl.session_no];
    v_day := en.start_date + ((tmpl.week_no - 1) * 7) + v_wd;
    v_starts := ((v_day::text || ' 13:00:00')::timestamp at time zone 'Europe/Berlin');
    if exists (
      select 1 from events e
      where e.enrollment_id = en.id and e.starts_at = v_starts and e.course_id = en.course_id
    ) then
      continue;
    end if;
    insert into events (
      user_id, course_id, enrollment_id, category, starts_at,
      location, visibility, is_unplanned, status, title
    ) values (
      en.user_id, en.course_id, en.id, tmpl.category, v_starts,
      null, 'team', false, 'geplant', tmpl.title
    );
    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end;
$$;

grant execute on function go_generate_events(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Coach: Kurs für Coachee kopieren (Anpassen ohne Original zu ändern)
-- ---------------------------------------------------------------------------
create or replace function go_copy_course_for(p_course_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := go_current_account_id();
  v_new uuid;
  v_title text;
begin
  if v_coach is not null and not go_is_coach_of(p_user_id) then
    raise exception 'not coach of %', p_user_id;
  end if;

  select coalesce(nullif(split_part(a.name, ' ', 1), ''), 'Coachee') into v_title from go_accounts a where a.id = p_user_id;

  insert into courses (
    title, slug, level, duration_weeks, sessions_per_week, category_default,
    price_eur, description, coach_id, source, is_active,
    private_for, owner, focus, block_weeks, base_course_id
  )
  select
    c.title || ' · ' || v_title,
    c.slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    c.level, c.duration_weeks, c.sessions_per_week, c.category_default,
    0, c.description, coalesce(v_coach, c.coach_id), 'own', true,
    p_user_id, 'coach', c.focus, c.block_weeks, c.id
  from courses c where c.id = p_course_id
  returning id into v_new;

  if v_new is null then
    raise exception 'course % not found', p_course_id;
  end if;

  insert into course_sessions (
    course_id, block_no, session_no, is_travel, title, focus, category, duration_min, blocks, note
  )
  select v_new, block_no, session_no, is_travel, title, focus, category, duration_min, blocks, note
  from course_sessions where course_id = p_course_id;

  return v_new;
end;
$$;

grant execute on function go_copy_course_for(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) Check
-- ---------------------------------------------------------------------------
create or replace function go_kurse_v2_check()
returns table (
  exercises_count bigint,
  courses_gogogo bigint,
  courses_coach bigint,
  sessions_count bigint,
  courses_ohne_sessions bigint
)
language sql
stable
as $$
  select
    (select count(*) from exercises),
    (select count(*) from courses where owner = 'gogogo' and is_active),
    (select count(*) from courses where owner = 'coach'),
    (select count(*) from course_sessions),
    (select count(*) from courses c
       where c.is_active
         and not exists (select 1 from course_sessions s where s.course_id = c.id)
         and not exists (select 1 from course_templates t where t.course_id = c.id));
$$;
