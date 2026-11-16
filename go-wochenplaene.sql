-- go-wochenplaene.sql
-- Kurse = Wochenpläne: Kombination aus Kraft + Ausdauer + Sonstiges (+ Zirkel über FFC), Level 1/2/3.
-- Jeder Wochenplan füllt alle 7 Tage: Einheit 1 = Mo … Einheit 7 = So.
-- Idempotent. Voraussetzung: go-kurse-v2.sql, go-coach-portal.sql (events.assigned_by).
--
--   course_sessions.category  zusätzlich 'alternative' (= Sonstiges, z. B. Schritte)
--   enrollments.weeks         Laufzeit legt der Coach je Coachee fest (nicht der Kurs)
--   go_generate_events        Wochen aus dem Enrollment; 7 Wochentage = Einheit n auf weekdays[n]
--                             (Reihenfolge frei, so lassen sich Tage tauschen); Zirkel erzeugt keine
--                             Events (läuft über FFC); Sonstiges ohne course_id
--   Inhalte                   Superwoman L1 (aus Natalyas Plan), Fit for Run L1–L3 (Kraft für Läufer),
--                             Bulletproof Knees L1. Inhalte = Entwurf, bitte fachlich prüfen.

-- 1) Schema -----------------------------------------------------------------
alter table course_sessions drop constraint if exists course_sessions_category_check;
alter table course_sessions
  add constraint course_sessions_category_check
  check (category in ('kraft', 'ausdauer', 'zirkel', 'alternative'));

alter table enrollments add column if not exists weeks int;
alter table courses add column if not exists level int;

-- 2) Generator ---------------------------------------------------------------
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
  v_slots int;
  v_weeks int;
  v_block int;
  v_max_block int;
  v_wd int;
  v_day date;
  v_starts timestamptz;
  v_inserted int := 0;
  v_k int;
  v_by_slot boolean;
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
    -- 7 Tage angegeben: Einheit n landet auf en.weekdays[n] (unsortiert = individuelle Tage)
    v_by_slot := array_length(en.weekdays, 1) >= 7;
    select max(block_no) into v_max_block from course_sessions
      where course_id = en.course_id and not is_travel;

    for w in 1..v_weeks loop
      v_block := least(((w - 1) / greatest(coalesce(co.block_weeks, 4), 1)) + 1, v_max_block);
      v_k := 0;  -- Wochentag-Index: nur Einheiten ohne Zirkel belegen einen Tag
      for s in 1..7 loop
        select * into ses from course_sessions
          where course_id = en.course_id and not is_travel
            and block_no <= v_block and session_no = s
          order by block_no desc limit 1;
        if not found then
          continue;
        end if;
        if v_by_slot then
          if ses.category = 'zirkel' then
            continue;  -- Zirkel läuft über FFC, Tag bleibt frei
          end if;
          v_wd := en.weekdays[s];
        else
          if ses.category = 'zirkel' then
            continue;
          end if;
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

        if exists (
          select 1 from events e
          where e.enrollment_id = en.id and e.starts_at = v_starts
        ) then
          continue;
        end if;

        insert into events (
          user_id, course_id, enrollment_id, course_session_id, category, starts_at,
          location, visibility, is_unplanned, status, title, assigned_by
        ) values (
          en.user_id,
          case when ses.category = 'alternative' then null else en.course_id end,
          en.id, ses.id, ses.category, v_starts,
          null, 'team', false, 'geplant', ses.title, en.assigned_by
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

-- 3) Inhalte -----------------------------------------------------------------
-- Hilfsfunktion: Kurs anlegen/aktualisieren und Block-1-Einheiten neu setzen
create or replace function go_tmp_upsert_plan(
  p_slug text, p_title text, p_level int, p_desc text, p_sessions jsonb
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_n int := jsonb_array_length(p_sessions);
begin
  select id into v_id from courses where slug = p_slug;
  if v_id is null then
    insert into courses (slug, title, source, price_eur, owner, category_default, level,
                         sessions_per_week, duration_weeks, block_weeks, description, is_active)
    values (p_slug, p_title, 'own', 0, 'gogogo', 'kraft', p_level, v_n, 12, 4, p_desc, true)
    returning id into v_id;
  else
    update courses set title = p_title, owner = 'gogogo', private_for = null, category_default = 'kraft',
      level = p_level, sessions_per_week = v_n, block_weeks = 4, description = p_desc, is_active = true
    where id = v_id;
  end if;
  delete from course_sessions where course_id = v_id;
  insert into course_sessions (course_id, block_no, session_no, is_travel, title, focus, category, duration_min, blocks, note)
  select v_id, 1, (e.ord)::int, false, e.val->>'title', nullif(e.val->>'focus', ''), e.val->>'category',
         nullif(e.val->>'min', '')::int, coalesce(e.val->'blocks', '[]'::jsonb), nullif(e.val->>'note', '')
  from jsonb_array_elements(p_sessions) with ordinality as e(val, ord);
  return v_id;
end;
$$;

-- Superwoman L1: Mo Kraft A · Di/Mi Schritte · Do Kraft B · Fr Schritte · Sa Laufen 5 km · So Schritte
do $$
declare
  v_kraft jsonb;
  v_steps jsonb := '{"title": "> 5.000 Schritte", "category": "alternative", "focus": "", "blocks": [{"type": "ausdauer", "items": [{"name": "Gehen", "note": "mindestens 5.000 Schritte über den Tag"}]}]}';
begin
  select blocks into v_kraft from course_sessions s
  join courses c on c.id = s.course_id
  where c.slug = 'training-krafttraining' and s.block_no = 1 and s.session_no = 1 and not s.is_travel
  limit 1;
  v_kraft := coalesce(v_kraft, '[]'::jsonb);
  perform go_tmp_upsert_plan(
    'superwoman-l1', 'Superwoman', 1,
    'Einstieg: zwei einfache Ganzkörper-Einheiten, ein lockerer 5-km-Lauf und an den übrigen Tagen mehr als 5.000 Schritte.',
    jsonb_build_array(
      jsonb_build_object('title', 'Einfache Basics A', 'category', 'kraft', 'focus', 'ganzkoerper', 'min', 45, 'blocks', v_kraft),
      v_steps,
      v_steps,
      jsonb_build_object('title', 'Einfache Basics B', 'category', 'kraft', 'focus', 'ganzkoerper', 'min', 45, 'blocks', v_kraft),
      v_steps,
      jsonb_build_object('title', 'Laufen 5 km', 'category', 'ausdauer', 'focus', 'ausdauer', 'min', 35,
        'blocks', '[{"type": "ausdauer", "items": [{"name": "Laufen", "dist_m": 5000, "note": "locker, Gesprächstempo; Gehpausen erlaubt"}]}]'::jsonb),
      v_steps
    )
  );
end $$;

select go_tmp_upsert_plan('fit-for-run-l1', 'Fit for Run', 1,
  'Krafttraining für Läufer, Level 1: Grundkraft für Hüfte, Beine und Rumpf, dazu zwei lockere Läufe.',
  '[
 {
  "title": "Läuferkraft A",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 40,
  "blocks": [
   {
    "type": "mobility",
    "items": [
     {
      "name": "Hüftbeuger-Dehnung kniend",
      "time_s": 45,
      "note": "je Seite"
     },
     {
      "name": "Wadenheben langsam",
      "sets": 1,
      "reps": "15"
     }
    ]
   },
   {
    "type": "grund",
    "items": [
     {
      "name": "Goblet Squat",
      "sets": 3,
      "reps": "10",
      "load": "RPE 6"
     },
     {
      "name": "Rumänisches Kreuzheben Kurzhantel",
      "sets": 3,
      "reps": "10",
      "load": "RPE 6"
     },
     {
      "name": "Ausfallschritt rückwärts",
      "sets": 3,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Glute Bridge einbeinig",
      "sets": 3,
      "reps": "10",
      "note": "je Seite"
     }
    ]
   },
   {
    "type": "finisher",
    "items": [
     {
      "name": "Seitstütz",
      "sets": 3,
      "time_s": 30,
      "note": "je Seite"
     },
     {
      "name": "Dead Bug",
      "sets": 3,
      "reps": "10"
     }
    ]
   }
  ]
 },
 {
  "title": "Lockerer Lauf 30 min",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 30,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Laufen locker",
      "time_s": 1800,
      "note": "Gesprächstempo"
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 },
 {
  "title": "Läuferkraft B",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 40,
  "blocks": [
   {
    "type": "skill",
    "items": [
     {
      "name": "Hopserlauf",
      "sets": 3,
      "dist_m": 20
     },
     {
      "name": "Kniehebelauf",
      "sets": 3,
      "dist_m": 20
     }
    ]
   },
   {
    "type": "grund",
    "items": [
     {
      "name": "Step-ups",
      "sets": 3,
      "reps": "10",
      "note": "je Seite"
     },
     {
      "name": "Hip Thrust",
      "sets": 3,
      "reps": "12",
      "load": "RPE 6"
     },
     {
      "name": "Wadenheben einbeinig",
      "sets": 3,
      "reps": "15",
      "note": "je Seite"
     }
    ]
   },
   {
    "type": "finisher",
    "items": [
     {
      "name": "Copenhagen Plank kurzer Hebel",
      "sets": 3,
      "time_s": 15,
      "note": "je Seite"
     },
     {
      "name": "Pallof Press",
      "sets": 3,
      "reps": "10",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 },
 {
  "title": "Lauf mit Steigerungen",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 35,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Laufen locker",
      "time_s": 1800
     },
     {
      "name": "Steigerungsläufe",
      "sets": 4,
      "time_s": 20,
      "note": "zügig, nicht maximal"
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 }
]'::jsonb);

select go_tmp_upsert_plan('fit-for-run-l2', 'Fit for Run', 2,
  'Krafttraining für Läufer, Level 2: schwerere Grundübungen, erste Sprünge, drei Läufe inklusive Intervalle.',
  '[
 {
  "title": "Läuferkraft A",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 50,
  "blocks": [
   {
    "type": "skill",
    "items": [
     {
      "name": "Pogo Jumps",
      "sets": 3,
      "reps": "20"
     }
    ]
   },
   {
    "type": "grund",
    "items": [
     {
      "name": "Bulgarische Kniebeuge",
      "sets": 4,
      "reps": "8",
      "note": "je Seite",
      "load": "RPE 7"
     },
     {
      "name": "Kreuzheben",
      "sets": 4,
      "reps": "6",
      "load": "RPE 7"
     },
     {
      "name": "Wadenheben einbeinig mit Gewicht",
      "sets": 4,
      "reps": "12",
      "note": "je Seite"
     }
    ]
   },
   {
    "type": "finisher",
    "items": [
     {
      "name": "Seitstütz mit Beinheben",
      "sets": 3,
      "reps": "10",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "Lockerer Lauf 40 min",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 40,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Laufen locker",
      "time_s": 2400,
      "note": "Gesprächstempo"
     }
    ]
   }
  ]
 },
 {
  "title": "Hüft- & Core-Mobility",
  "category": "alternative",
  "focus": "",
  "min": 20,
  "blocks": [
   {
    "type": "mobility",
    "items": [
     {
      "name": "Couch Stretch",
      "time_s": 60,
      "note": "je Seite"
     },
     {
      "name": "90/90 Hüftrotation",
      "sets": 2,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Adduktoren-Rocking",
      "sets": 2,
      "reps": "10"
     },
     {
      "name": "Katze-Kuh",
      "sets": 2,
      "reps": "10"
     },
     {
      "name": "Bird Dog",
      "sets": 2,
      "reps": "8",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "Läuferkraft B",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 50,
  "blocks": [
   {
    "type": "skill",
    "items": [
     {
      "name": "Box Jumps",
      "sets": 3,
      "reps": "5"
     }
    ]
   },
   {
    "type": "grund",
    "items": [
     {
      "name": "Frontkniebeuge",
      "sets": 4,
      "reps": "6",
      "load": "RPE 7"
     },
     {
      "name": "Einbeiniges Kreuzheben",
      "sets": 3,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Nordic Curl exzentrisch",
      "sets": 3,
      "reps": "5"
     }
    ]
   },
   {
    "type": "finisher",
    "items": [
     {
      "name": "Copenhagen Plank",
      "sets": 3,
      "time_s": 20,
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "Intervalle 6 × 3 min",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 45,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Einlaufen",
      "time_s": 900
     },
     {
      "name": "Intervall",
      "sets": 6,
      "time_s": 180,
      "note": "zügig, 2 min Trabpause"
     },
     {
      "name": "Auslaufen",
      "time_s": 600
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 },
 {
  "title": "Langer Lauf 60 min",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 60,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Laufen locker",
      "time_s": 3600
     }
    ]
   }
  ]
 }
]'::jsonb);

select go_tmp_upsert_plan('fit-for-run-l3', 'Fit for Run', 3,
  'Krafttraining für Läufer, Level 3: Maximalkraft, Reaktivkraft und Kraftausdauer, drei Läufe mit Tempo und langem Lauf.',
  '[
 {
  "title": "Maximalkraft",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 55,
  "blocks": [
   {
    "type": "grund",
    "items": [
     {
      "name": "Kniebeuge",
      "sets": 5,
      "reps": "4",
      "load": "RPE 8"
     },
     {
      "name": "Kreuzheben",
      "sets": 4,
      "reps": "4",
      "load": "RPE 8"
     },
     {
      "name": "Bulgarische Kniebeuge",
      "sets": 3,
      "reps": "6",
      "note": "je Seite",
      "load": "RPE 8"
     }
    ]
   },
   {
    "type": "finisher",
    "items": [
     {
      "name": "Wadenheben einbeinig mit Gewicht",
      "sets": 4,
      "reps": "10",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "Lockerer Lauf 45 min",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 45,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Laufen locker",
      "time_s": 2700,
      "note": "Gesprächstempo"
     }
    ]
   }
  ]
 },
 {
  "title": "Reaktivkraft",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 45,
  "blocks": [
   {
    "type": "skill",
    "items": [
     {
      "name": "Bounding",
      "sets": 4,
      "dist_m": 30
     },
     {
      "name": "Einbeinige Hops",
      "sets": 3,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Drop Jumps",
      "sets": 3,
      "reps": "5"
     }
    ]
   },
   {
    "type": "hybrid",
    "items": [
     {
      "name": "Hip Thrust",
      "sets": 3,
      "reps": "8",
      "load": "RPE 8"
     },
     {
      "name": "Nordic Curl",
      "sets": 3,
      "reps": "5"
     }
    ]
   }
  ]
 },
 {
  "title": "Tempo 3 × 10 min",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 55,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Einlaufen",
      "time_s": 900
     },
     {
      "name": "Tempo",
      "sets": 3,
      "time_s": 600,
      "note": "Schwellentempo, 2 min Trabpause"
     },
     {
      "name": "Auslaufen",
      "time_s": 600
     }
    ]
   }
  ]
 },
 {
  "title": "Kraftausdauer & Rumpf",
  "category": "kraft",
  "focus": "ganzkoerper",
  "min": 40,
  "blocks": [
   {
    "type": "hybrid",
    "items": [
     {
      "name": "Walking Lunges",
      "sets": 3,
      "reps": "20"
     },
     {
      "name": "Step-ups mit Gewicht",
      "sets": 3,
      "reps": "12",
      "note": "je Seite"
     },
     {
      "name": "Copenhagen Plank",
      "sets": 3,
      "time_s": 30,
      "note": "je Seite"
     },
     {
      "name": "Pallof Press",
      "sets": 3,
      "reps": "12",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 },
 {
  "title": "Langer Lauf 75–90 min",
  "category": "ausdauer",
  "focus": "ausdauer",
  "min": 85,
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Laufen locker",
      "time_s": 5100
     }
    ]
   }
  ]
 }
]'::jsonb);

select go_tmp_upsert_plan('bulletproof-knee', 'Bulletproof Knees', 1,
  'Für starke Beine und belastbare Knie mit guter Core- und Hüftmobilität.',
  '[
 {
  "title": "Knie & Beine A",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 45,
  "blocks": [
   {
    "type": "mobility",
    "items": [
     {
      "name": "90/90 Hüftrotation",
      "sets": 2,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Tibialis Raises",
      "sets": 2,
      "reps": "15"
     }
    ]
   },
   {
    "type": "grund",
    "items": [
     {
      "name": "Spanish Squat isometrisch",
      "sets": 3,
      "time_s": 40
     },
     {
      "name": "Step-down langsam",
      "sets": 3,
      "reps": "8",
      "note": "je Seite, 3 s ablassen"
     },
     {
      "name": "Rumänisches Kreuzheben",
      "sets": 3,
      "reps": "10",
      "load": "RPE 7"
     },
     {
      "name": "Wadenheben mit gebeugtem Knie",
      "sets": 3,
      "reps": "15"
     }
    ]
   },
   {
    "type": "finisher",
    "items": [
     {
      "name": "Dead Bug",
      "sets": 3,
      "reps": "10"
     },
     {
      "name": "Seitstütz",
      "sets": 3,
      "time_s": 30,
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 },
 {
  "title": "Hüft- & Core-Mobility",
  "category": "alternative",
  "focus": "",
  "min": 20,
  "blocks": [
   {
    "type": "mobility",
    "items": [
     {
      "name": "Couch Stretch",
      "time_s": 60,
      "note": "je Seite"
     },
     {
      "name": "90/90 Hüftrotation",
      "sets": 2,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Adduktoren-Rocking",
      "sets": 2,
      "reps": "10"
     },
     {
      "name": "Katze-Kuh",
      "sets": 2,
      "reps": "10"
     },
     {
      "name": "Bird Dog",
      "sets": 2,
      "reps": "8",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "Knie & Beine B",
  "category": "kraft",
  "focus": "unterkoerper",
  "min": 45,
  "blocks": [
   {
    "type": "grund",
    "items": [
     {
      "name": "Split Squat",
      "sets": 3,
      "reps": "10",
      "note": "je Seite",
      "load": "RPE 7"
     },
     {
      "name": "Einbeiniges Kreuzheben",
      "sets": 3,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Seitlicher Ausfallschritt",
      "sets": 3,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Reverse Nordic leicht",
      "sets": 3,
      "reps": "6"
     }
    ]
   },
   {
    "type": "finisher",
    "items": [
     {
      "name": "Copenhagen Plank kurzer Hebel",
      "sets": 3,
      "time_s": 20,
      "note": "je Seite"
     },
     {
      "name": "Pallof Press",
      "sets": 3,
      "reps": "10",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 },
 {
  "title": "Hüft- & Core-Mobility",
  "category": "alternative",
  "focus": "",
  "min": 20,
  "blocks": [
   {
    "type": "mobility",
    "items": [
     {
      "name": "Couch Stretch",
      "time_s": 60,
      "note": "je Seite"
     },
     {
      "name": "90/90 Hüftrotation",
      "sets": 2,
      "reps": "8",
      "note": "je Seite"
     },
     {
      "name": "Adduktoren-Rocking",
      "sets": 2,
      "reps": "10"
     },
     {
      "name": "Katze-Kuh",
      "sets": 2,
      "reps": "10"
     },
     {
      "name": "Bird Dog",
      "sets": 2,
      "reps": "8",
      "note": "je Seite"
     }
    ]
   }
  ]
 },
 {
  "title": "> 5.000 Schritte",
  "category": "alternative",
  "focus": "",
  "blocks": [
   {
    "type": "ausdauer",
    "items": [
     {
      "name": "Gehen",
      "note": "mindestens 5.000 Schritte über den Tag"
     }
    ]
   }
  ]
 }
]'::jsonb);

-- Hybrid Kraft 2× / 3×: auf 7 Tage auffüllen (Kraft an festen Tagen, sonst Schritte)
do $$
declare
  v_steps jsonb := '{"title": "> 5.000 Schritte", "category": "alternative", "focus": "", "blocks": [{"type": "ausdauer", "items": [{"name": "Gehen", "note": "mindestens 5.000 Schritte über den Tag"}]}]}';
  v_c uuid;
begin
  select id into v_c from courses where slug = 'hybrid-kraft-2x';
  if v_c is not null and (select max(session_no) from course_sessions where course_id = v_c) < 7 then
    update course_sessions set session_no = 4 where course_id = v_c and session_no = 2;  -- Mo + Do
    insert into course_sessions (course_id, block_no, session_no, is_travel, title, category, blocks)
    select v_c, 1, n, false, v_steps->>'title', 'alternative', v_steps->'blocks'
    from unnest(array[2, 3, 5, 6, 7]) as n
    on conflict (course_id, block_no, session_no, is_travel) do nothing;
    update courses set sessions_per_week = 7, level = coalesce(level, 1) where id = v_c;
  end if;
  select id into v_c from courses where slug = 'hybrid-kraft-3x';
  if v_c is not null and (select max(session_no) from course_sessions where course_id = v_c) < 7 then
    update course_sessions set session_no = 5 where course_id = v_c and session_no = 3;  -- Mo + Mi + Fr
    update course_sessions set session_no = 3 where course_id = v_c and session_no = 2;
    insert into course_sessions (course_id, block_no, session_no, is_travel, title, category, blocks)
    select v_c, 1, n, false, v_steps->>'title', 'alternative', v_steps->'blocks'
    from unnest(array[2, 4, 6, 7]) as n
    on conflict (course_id, block_no, session_no, is_travel) do nothing;
    update courses set sessions_per_week = 7, level = coalesce(level, 1) where id = v_c;
  end if;
end $$;

-- Natalya: persönlichen Plan durch Superwoman ersetzen.
-- Kraft an ihren Tagen Di + Mi, Lauf am Samstag, sonst Schritte. Erledigtes bleibt.
do $$
declare
  v_user uuid := '94a49c08-0818-4491-86a5-714885b6b73c';
  v_sw uuid;
  v_coach uuid;
  v_en uuid;
begin
  if not exists (select 1 from go_accounts where id = v_user) then
    return;
  end if;
  select id into v_sw from courses where slug = 'superwoman-l1';
  select trainer_id into v_coach from go_accounts where id = v_user;
  if v_coach is not null and not exists (select 1 from go_accounts where id = v_coach) then
    v_coach := null;
  end if;

  -- alter persönlicher Plan: offene Termine weg, Enrollment beendet, Kurs ausgeblendet
  delete from events e
  using enrollments x
  where e.enrollment_id = x.id and x.user_id = v_user and x.course_id <> v_sw
    and e.status = 'geplant';
  update enrollments set status = 'beendet' where user_id = v_user and course_id <> v_sw and status = 'aktiv';
  update courses set is_active = false where private_for = v_user and slug like 'training-krafttraining-%';

  -- Superwoman einmalig zuordnen
  if not exists (select 1 from enrollments where user_id = v_user and course_id = v_sw and status = 'aktiv') then
    -- Einheit: 1 Kraft A, 2 Schritte, 3 Schritte, 4 Kraft B, 5 Schritte, 6 Lauf, 7 Schritte
    -- Tag:     Di(1),    Mo(0),     Do(3),     Mi(2),     Fr(4),     Sa(5),  So(6)
    insert into enrollments (user_id, course_id, status, start_date, weekdays, sessions_per_week, weeks, assigned_by, payment_status)
    values (v_user, v_sw, 'aktiv', date '2026-11-16', array[1, 0, 3, 2, 4, 5, 6], 7, 12, v_coach, 'gratis')
    returning id into v_en;
    perform go_generate_events(v_en);
  end if;
end $$;

drop function if exists go_tmp_upsert_plan(text, text, int, text, jsonb);

-- Kurzcheck: Wochenpläne mit Verteilung (jede Zeile sollte 7 ergeben)
select c.title, c.level,
  count(*) filter (where s.category = 'kraft') as kraft,
  count(*) filter (where s.category = 'ausdauer') as ausdauer,
  count(*) filter (where s.category = 'alternative') as sonstiges,
  count(*) filter (where s.category = 'zirkel') as zirkel
from courses c
join course_sessions s on s.course_id = c.id and s.block_no = 1 and not s.is_travel
where c.slug in ('superwoman-l1', 'fit-for-run-l1', 'fit-for-run-l2', 'fit-for-run-l3', 'bulletproof-knee', 'hybrid-kraft-2x', 'hybrid-kraft-3x')
group by c.title, c.level
order by c.title, c.level;
