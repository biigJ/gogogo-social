-- go-wochenplan-slots.sql — Wochenplan = 7 Tage, jeder Tag verweist auf eine Einzeleinheit
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- Vorher: Jede Einheit eines Wochenplans hatte ihre Übungen selbst (course_sessions.blocks),
--         plus Blöcke 1/2 und Reisevarianten.
-- Jetzt:  course_sessions.unit_course_id zeigt auf eine Einzeleinheit (Kurs mit einer Einheit).
--         Übungen pflegt man nur noch in der Einzeleinheit. Nur Block 1, keine Reisevariante
--         (alte Zeilen bleiben unangetastet in der DB, werden aber nicht mehr genutzt).
-- Migration: Für jeden Tag eines Wochenplans wird eine passende Einzeleinheit gesucht
--            (gleicher Titel + Kategorie) oder neu angelegt (Übungen werden übernommen).
--            Geplante Events zeigen danach auf die Einzeleinheit (Tracking + Coverbild).
-- Dazu: go_exercise_catalog für die Übungen-Tabelle im Editor (Neu angelegte Übungen).

alter table course_sessions add column if not exists unit_course_id uuid references courses(id) on delete set null;
create index if not exists course_sessions_unit_idx on course_sessions (unit_course_id);

create table if not exists go_exercise_catalog (
  name_key text primary key,
  name text not null,
  block_type text,
  cue text,
  created_by uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table go_exercise_catalog enable row level security;
drop policy if exists "go_exercise_catalog_select" on go_exercise_catalog;
create policy "go_exercise_catalog_select" on go_exercise_catalog for select to anon, authenticated using (true);
drop policy if exists "go_exercise_catalog_write" on go_exercise_catalog;
create policy "go_exercise_catalog_write" on go_exercise_catalog for all to anon, authenticated
  using (go_is_admin()) with check (go_is_admin());

-- Einzeleinheiten gibt es auch als Sonstiges (Schritte, Mobility, Boxen …)
alter table courses drop constraint if exists courses_category_default_check;
alter table courses add constraint courses_category_default_check
  check (category_default is null or category_default in ('kraft', 'ausdauer', 'zirkel', 'alternative'));

-- ---------- Migration: Tage → Einzeleinheiten ----------
do $$
declare
  pl record;
  ses record;
  unit_id uuid;
  unit_ses course_sessions%rowtype;
  v_title text;
  v_slug text;
begin
  for pl in
    select c.* from courses c
    where c.private_for is null
      and (select count(*) from course_sessions s where s.course_id = c.id and s.block_no = 1 and not s.is_travel) > 1
  loop
    for ses in
      select * from course_sessions s
      where s.course_id = pl.id and s.block_no = 1 and not s.is_travel and s.unit_course_id is null
      order by s.session_no
    loop
      unit_id := null;
      -- 1) Zirkel: die Zirkeltraining-Einheit
      if ses.category = 'zirkel' then
        select c.id into unit_id from courses c
        where c.category_default = 'zirkel' and c.is_active
          and exists (select 1 from course_sessions x where x.course_id = c.id)
        order by c.created_at limit 1;
      end if;
      -- 2) gleicher Titel + Kategorie, gleiche Übungen (oder Einheit ohne Übungen, z. B. Laufen)
      if unit_id is null then
        select c.id into unit_id from courses c
        where lower(c.title) = lower(ses.title)
          and coalesce(c.category_default, 'kraft') = ses.category
          and c.id <> pl.id
          and c.private_for is null
          and (select count(*) from course_sessions x where x.course_id = c.id) <= 1
          and (
            not exists (select 1 from course_sessions x where x.course_id = c.id)
            or exists (select 1 from course_sessions x where x.course_id = c.id and x.blocks = ses.blocks)
            or coalesce(jsonb_array_length(ses.blocks), 0) = 0
          )
        order by c.created_at limit 1;
      end if;
      -- 3) neu anlegen (bei gleichem Titel mit anderen Übungen: Level bzw. Planname anhängen)
      if unit_id is null then
        v_title := ses.title;
        if exists (select 1 from courses c where lower(c.title) = lower(v_title) and c.id <> pl.id) then
          v_title := ses.title || case when pl.level is not null then ' · L' || pl.level else ' · ' || pl.title end;
        end if;
        select c.id into unit_id from courses c where lower(c.title) = lower(v_title) and c.id <> pl.id limit 1;
        if unit_id is null then
          v_slug := left(regexp_replace(lower(translate(v_title, 'äöüß', 'aous')), '[^a-z0-9]+', '-', 'g'), 40)
                    || '-' || substr(md5(random()::text), 1, 5);
          insert into courses (title, slug, level, sessions_per_week, duration_weeks, category_default, description,
                               source, is_active, owner, price_eur, image_url)
          values (v_title, v_slug, pl.level, 1, 1, ses.category, null, 'own', true, 'gogogo', 0, null)
          returning id into unit_id;
          insert into course_sessions (course_id, block_no, session_no, is_travel, title, focus, category, duration_min, blocks)
          values (unit_id, 1, 1, false, v_title, ses.focus, ses.category, ses.duration_min, coalesce(ses.blocks, '[]'::jsonb));
        end if;
      end if;

      update course_sessions set unit_course_id = unit_id where id = ses.id;

      -- geplante Events dieses Tages auf die Einzeleinheit umhängen
      select * into unit_ses from course_sessions where course_id = unit_id order by block_no, session_no limit 1;
      update events e set
        course_session_id = unit_ses.id,
        course_id = case when e.category = 'alternative' then null else unit_id end
      where e.course_session_id = ses.id and e.status = 'geplant';
    end loop;
    update courses set sessions_per_week = 7 where id = pl.id and coalesce(sessions_per_week, 0) <> 7
      and (select count(*) from course_sessions s where s.course_id = pl.id and s.block_no = 1 and not s.is_travel) = 7;
  end loop;
end $$;

-- Gleichnamige Einheiten verschiedener Level einheitlich benennen („Läuferkraft A · L1“, „· L2“ …)
with plain as (
  select u.id, u.title, u.level from courses u
  where u.level is not null and u.title not like '% · L_'
    and (select count(*) from course_sessions x where x.course_id = u.id) = 1
    and exists (select 1 from courses o where o.title = u.title || ' · L' || o.level and o.id <> u.id)
)
update courses c set title = p.title || ' · L' || p.level
from plain p where c.id = p.id
  and not exists (select 1 from courses o where o.title = p.title || ' · L' || p.level);
update course_sessions s set title = c.title
from courses c
where s.course_id = c.id and c.title like '% · L_' and s.title <> c.title
  and (select count(*) from course_sessions x where x.course_id = c.id) = 1;

-- ---------- Generator: Tag → Einzeleinheit ----------
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
  unit courses%rowtype;
  useS course_sessions%rowtype;
  v_weekdays int[];
  v_slots int;
  v_weeks int;
  v_wd int;
  v_day date;
  v_starts timestamptz;
  v_inserted int := 0;
  v_k int;
  v_by_slot boolean;
  v_cat text;
  v_title text;
  v_course uuid;
  v_ses uuid;
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

  if exists (select 1 from course_sessions where course_id = en.course_id and not is_travel) then
    v_weeks := coalesce(en.weeks, co.duration_weeks, 12);
    v_slots := array_length(v_weekdays, 1);
    v_by_slot := array_length(en.weekdays, 1) >= 7;

    for w in 1..v_weeks loop
      v_k := 0;
      for s in 1..7 loop
        -- nur Block 1, keine Reisevariante
        select * into ses from course_sessions
          where course_id = en.course_id and not is_travel and block_no = 1 and session_no = s
          limit 1;
        if not found then
          continue;
        end if;

        -- Tag zeigt auf Einzeleinheit: Titel, Kategorie, Übungen und Coverbild von dort
        v_cat := ses.category;
        v_title := ses.title;
        v_course := en.course_id;
        v_ses := ses.id;
        if ses.unit_course_id is not null then
          select * into unit from courses where id = ses.unit_course_id;
          if found then
            select * into useS from course_sessions where course_id = unit.id order by block_no, session_no limit 1;
            v_cat := coalesce(useS.category, unit.category_default, ses.category);
            v_title := unit.title;
            v_course := unit.id;
            v_ses := useS.id;
          end if;
        end if;

        if v_cat = 'zirkel' then
          continue;  -- Zirkel läuft über FFC, Tag bleibt frei
        end if;
        if v_by_slot then
          v_wd := en.weekdays[s];
        else
          v_k := v_k + 1;
          if v_k > v_slots then
            exit;
          end if;
          v_wd := v_weekdays[v_k];
        end if;
        v_day := en.start_date + ((w - 1) * 7) + v_wd;
        if v_day < current_date then
          continue;
        end if;
        v_starts := ((v_day::text || ' 13:00:00')::timestamp at time zone 'Europe/Berlin');

        if exists (select 1 from events e where e.enrollment_id = en.id and e.starts_at = v_starts) then
          continue;
        end if;

        insert into events (
          user_id, course_id, enrollment_id, course_session_id, category, starts_at,
          location, visibility, is_unplanned, status, title, assigned_by
        ) values (
          en.user_id,
          case when v_cat = 'alternative' then null else v_course end,
          en.id, v_ses, v_cat, v_starts,
          null, 'team', false, 'geplant', v_title, en.assigned_by
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

-- Kontrolle
select p.title as wochenplan, p.level, s.session_no as tag, u.title as einzeleinheit, u.category_default
from course_sessions s
join courses p on p.id = s.course_id
left join courses u on u.id = s.unit_course_id
where s.block_no = 1 and not s.is_travel and s.unit_course_id is not null
order by p.title, p.level, s.session_no;
