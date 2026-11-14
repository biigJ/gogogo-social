-- Trainingsliste → courses + course_templates
-- Voraussetzung: go-courses-support.sql (+ go-event-comments.sql für is_system)
-- Idempotent: mehrfach ausführbar.
-- Coach = Ben Joscha (gogogo-Seed).

-- ---------------------------------------------------------------------------
-- 1) Seed-Kurse ohne ausreichend Inhalt deaktivieren
--    (Fit for Run L1–L3, Bulletproof Knee) — bis Inhalte nachgepflegt sind.
-- ---------------------------------------------------------------------------
update courses
set is_active = false
where slug in (
  'fit-for-run-l1',
  'fit-for-run-l2',
  'fit-for-run-l3',
  'bulletproof-knee'
);

-- ---------------------------------------------------------------------------
-- 2) Kurse aus der bestehenden Trainingsliste (Kraft / Ausdauer / Zirkel)
--    slug-Präfix training-* bzw. ausdauer-* für Idempotenz.
-- ---------------------------------------------------------------------------
insert into courses (
  title, slug, level, duration_weeks, sessions_per_week, category_default,
  price_eur, description, coach_id, source, is_active
)
select
  v.title, v.slug, null, 1, 1, v.category_default,
  0::numeric, v.description,
  '2d3ab029-0a5f-4388-8da7-52501a87dc8c'::uuid,
  'own', true
from (values
  -- Kraft (kraftChoices / GOGOGO_KRAFT + Einfache Basics)
  ('Einfache Basics', 'training-krafttraining', 'kraft',
   'Kraftsystem krafttraining — Übungen in course_templates'),
  ('Ganzkörpertraining', 'training-full', 'kraft',
   'Kraftsystem full — Übungen in course_templates'),
  ('Oberkörpertraining', 'training-upper', 'kraft',
   'Kraftsystem upper — Übungen in course_templates'),
  ('Unterkörpertraining', 'training-lower', 'kraft',
   'Kraftsystem lower — Übungen in course_templates'),
  ('Beintraining', 'training-legs', 'kraft',
   'Kraftsystem legs — Übungen in course_templates'),
  ('Glutes/Legs', 'training-glutes', 'kraft',
   'Kraftsystem glutes — Übungen in course_templates'),
  ('Athletic Day', 'training-athletic', 'kraft',
   'Kraftsystem athletic — Übungen in course_templates'),
  ('Push Day', 'training-push', 'kraft',
   'Kraftsystem push — Übungen in course_templates'),
  ('Pull Day', 'training-pull', 'kraft',
   'Kraftsystem pull — Übungen in course_templates'),
  -- Ausdauer (ausdauerChoices Defaults)
  ('Laufen', 'ausdauer-run', 'ausdauer', 'Ausdauertechnik run'),
  ('Radfahren', 'ausdauer-bike', 'ausdauer', 'Ausdauertechnik bike'),
  ('Rudern', 'ausdauer-row', 'ausdauer', 'Ausdauertechnik row'),
  ('Schwimmen', 'ausdauer-swim', 'ausdauer', 'Ausdauertechnik swim'),
  ('Gehen', 'ausdauer-walk', 'ausdauer', 'Ausdauertechnik walk'),
  ('Wandern', 'ausdauer-hike', 'ausdauer', 'Ausdauertechnik hike'),
  -- Zirkel (eigene Katalog-Variante; hendrik-Spiegel bleibt separat)
  ('Zirkeltraining', 'training-zirkel', 'zirkel',
   'Zirkel — Inhalte später in course_templates pflegen')
) as v(title, slug, category_default, description)
on conflict (slug) do update set
  title = excluded.title,
  category_default = excluded.category_default,
  description = excluded.description,
  coach_id = excluded.coach_id,
  source = 'own',
  is_active = true,
  duration_weeks = coalesce(courses.duration_weeks, 1),
  sessions_per_week = coalesce(courses.sessions_per_week, 1);

-- Bestehenden hendrik-Zirkel nicht anfassen (slug zirkeltraining).
-- training-zirkel ist die auswählbare eigene Variante für Tages-Events.

-- ---------------------------------------------------------------------------
-- 3) course_templates aus Übungen / Einheiten
--    Struktur: week_no=1, session_no = Reihenfolge der Übung.
--    Inhalte können später nur per SQL/DB geändert werden — kein App-Code nötig.
-- ---------------------------------------------------------------------------

-- 3a) Einfache Basics: aus go_kraft_exercises, sonst Fallback
do $$
begin
  if to_regclass('public.go_kraft_exercises') is not null then
    insert into course_templates (course_id, week_no, session_no, title, category, description)
    select
      c.id,
      1,
      row_number() over (order by coalesce((e.plan_meta->>'sort')::int, 999), e.name),
      e.name,
      'kraft',
      nullif(trim(both from coalesce(e.trainer_note, '')), '')
    from courses c
    join go_kraft_exercises e on e.system_id = 'krafttraining'
    where c.slug = 'training-krafttraining'
    on conflict (course_id, week_no, session_no) do update set
      title = excluded.title,
      category = excluded.category,
      description = coalesce(nullif(excluded.description, ''), course_templates.description);
  end if;
end $$;

insert into course_templates (course_id, week_no, session_no, title, category, description)
select c.id, 1, t.session_no, t.title, 'kraft', t.description
from courses c
join (values
  (1, 'Kindhaltung mit Strecken', 'Aufwärmen'),
  (2, 'Katze-Kuh', 'Aufwärmen'),
  (3, 'Herabschauender Hund', 'Aufwärmen'),
  (4, 'Große Ganzkörperdehnung', 'Aufwärmen'),
  (5, 'Hängen mit Schulterblatt-Heben', 'Hauptteil'),
  (6, 'Bulgarische Kniebeuge', 'Hauptteil'),
  (7, 'Einbeiniges Kreuzheben', 'Hauptteil'),
  (8, 'Einbeiniges Hüftheben', 'Hauptteil'),
  (9, 'Vorgebeugtes Seitheben', 'Hauptteil'),
  (10, 'Schulterdrücken im Sitz', 'Hauptteil'),
  (11, 'Liegestütze auf Knien', 'Hauptteil'),
  (12, 'Umgekehrte Crunches', 'Hauptteil')
) as t(session_no, title, description)
  on c.slug = 'training-krafttraining'
where not exists (
  select 1 from course_templates ct where ct.course_id = c.id
)
on conflict (course_id, week_no, session_no) do nothing;

-- 3b) Weitere Kraftsysteme (aus account/kraft-catalog.js)
insert into course_templates (course_id, week_no, session_no, title, category, description)
select c.id, 1, t.session_no, t.title, 'kraft', null
from courses c
join (values
  ('training-full', 1, 'Kniebeuge'),
  ('training-full', 2, 'Kreuzheben'),
  ('training-full', 3, 'Bankdrücken'),
  ('training-full', 4, 'Schulterdrücken'),
  ('training-full', 5, 'Klimmzüge'),
  ('training-full', 6, 'Langhantelrudern'),
  ('training-full', 7, 'Ausfallschritte'),
  ('training-full', 8, 'Rumänisches Kreuzheben'),
  ('training-full', 9, 'Farmer Carry'),
  ('training-full', 10, 'Unterarmstütz'),

  ('training-upper', 1, 'Bankdrücken'),
  ('training-upper', 2, 'Schulterdrücken'),
  ('training-upper', 3, 'Klimmzüge'),
  ('training-upper', 4, 'Langhantelrudern'),
  ('training-upper', 5, 'Dips'),
  ('training-upper', 6, 'Schrägbankdrücken'),
  ('training-upper', 7, 'Liegestütze'),
  ('training-upper', 8, 'Face Pulls'),
  ('training-upper', 9, 'Seitheben'),
  ('training-upper', 10, 'Klimmzüge supiniert'),

  ('training-lower', 1, 'Kniebeuge'),
  ('training-lower', 2, 'Kreuzheben'),
  ('training-lower', 3, 'Rumänisches Kreuzheben'),
  ('training-lower', 4, 'Ausfallschritte'),
  ('training-lower', 5, 'Hip Thrust'),
  ('training-lower', 6, 'Bulgarian Split Squat'),
  ('training-lower', 7, 'Beinpresse'),
  ('training-lower', 8, 'Step-ups'),
  ('training-lower', 9, 'Wadenheben'),
  ('training-lower', 10, 'Good Morning'),

  ('training-legs', 1, 'Kniebeuge'),
  ('training-legs', 2, 'Frontkniebeuge'),
  ('training-legs', 3, 'Beinpresse'),
  ('training-legs', 4, 'Beinbeuger'),
  ('training-legs', 5, 'Beinstrecker'),
  ('training-legs', 6, 'Walking Lunges'),
  ('training-legs', 7, 'Bulgarian Split Squat'),
  ('training-legs', 8, 'Hip Thrust'),
  ('training-legs', 9, 'Wadenheben'),
  ('training-legs', 10, 'Adduktoren'),

  ('training-glutes', 1, 'Hip Thrust'),
  ('training-glutes', 2, 'Rumänisches Kreuzheben'),
  ('training-glutes', 3, 'Bulgarian Split Squat'),
  ('training-glutes', 4, 'Glute Bridge'),
  ('training-glutes', 5, 'Walking Lunges'),
  ('training-glutes', 6, 'Kniebeuge'),
  ('training-glutes', 7, 'Step-ups'),
  ('training-glutes', 8, 'Kabel Kickback'),
  ('training-glutes', 9, 'Hüftabduktion'),
  ('training-glutes', 10, 'Kreuzheben'),

  ('training-athletic', 1, 'Power Clean'),
  ('training-athletic', 2, 'Box Jump'),
  ('training-athletic', 3, 'Kettlebell Swing'),
  ('training-athletic', 4, 'Push Press'),
  ('training-athletic', 5, 'Medizinball-Slam'),
  ('training-athletic', 6, 'Weitsprung'),
  ('training-athletic', 7, 'Farmer Carry'),
  ('training-athletic', 8, 'Sled Push'),
  ('training-athletic', 9, 'Klimmzüge'),
  ('training-athletic', 10, 'Unterarmstütz'),

  ('training-push', 1, 'Bankdrücken'),
  ('training-push', 2, 'Schulterdrücken'),
  ('training-push', 3, 'Schrägbankdrücken'),
  ('training-push', 4, 'Dips'),
  ('training-push', 5, 'Liegestütze'),
  ('training-push', 6, 'Seitheben'),
  ('training-push', 7, 'Frontheben'),
  ('training-push', 8, 'Enges Bankdrücken'),
  ('training-push', 9, 'Trizepsdrücken'),
  ('training-push', 10, 'Überkopf-Trizeps'),

  ('training-pull', 1, 'Kreuzheben'),
  ('training-pull', 2, 'Klimmzüge'),
  ('training-pull', 3, 'Langhantelrudern'),
  ('training-pull', 4, 'Latzug'),
  ('training-pull', 5, 'Sitzendes Rudern'),
  ('training-pull', 6, 'Face Pulls'),
  ('training-pull', 7, 'Klimmzüge supiniert'),
  ('training-pull', 8, 'Reverse Fly'),
  ('training-pull', 9, 'Bizepscurl'),
  ('training-pull', 10, 'Hammercurl')
) as t(slug, session_no, title)
  on c.slug = t.slug
on conflict (course_id, week_no, session_no) do update set
  title = excluded.title,
  category = excluded.category;

-- 3c) Ausdauer: eine Session-Vorlage pro Kurs (Inhalte später erweiterbar)
insert into course_templates (course_id, week_no, session_no, title, category, description)
select c.id, 1, 1, c.title, 'ausdauer', 'Einheit — Details später in course_templates pflegen'
from courses c
where c.slug in (
  'ausdauer-run', 'ausdauer-bike', 'ausdauer-row',
  'ausdauer-swim', 'ausdauer-walk', 'ausdauer-hike'
)
on conflict (course_id, week_no, session_no) do update set
  title = excluded.title,
  category = excluded.category,
  description = coalesce(course_templates.description, excluded.description);

-- 3d) Zirkel-Eigenkurs: Platzhalter-Session (Inhalt später)
insert into course_templates (course_id, week_no, session_no, title, category, description)
select c.id, 1, 1, 'Zirkel · Einheit', 'zirkel', 'Inhalt später pflegen'
from courses c
where c.slug = 'training-zirkel'
on conflict (course_id, week_no, session_no) do nothing;

-- ---------------------------------------------------------------------------
-- Hinweis: go-courses-support.sql setzt bei erneutem Lauf Fit-for-Run /
-- Bulletproof wieder auf is_active=true. Danach dieses Script nochmal ausführen.
-- ---------------------------------------------------------------------------
