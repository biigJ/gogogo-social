-- go-kurse-beispiele.sql
-- Zwei Beispielkurse (Block 1) für den Trockentest. Idempotent. Voraussetzung: go-kurse-v2.sql.
-- Inhalte sind Beispiele; Bearbeitung im Kurs-Editor /go/kurse/.

insert into courses (title, slug, level, duration_weeks, sessions_per_week, category_default,
  price_eur, description, coach_id, source, is_active, owner, focus, block_weeks)
values ('Hybrid Kraft · 2× pro Woche', 'hybrid-kraft-2x', 1, 12, 2, 'kraft', 0, 'Ganzkörper A und B. Mobility, Power, Grundübung, Hybrid-Komplex, Hypertrophie, Finisher. Beispielkurs.',
  (select id from go_accounts where name = 'biigJ' order by created_at limit 1),
  'own', true, 'gogogo', 'hybrid', 4)
on conflict (slug) do update set title = excluded.title, sessions_per_week = excluded.sessions_per_week,
  description = excluded.description, owner = 'gogogo', is_active = true;

insert into course_sessions (course_id, block_no, session_no, title, focus, category, duration_min, blocks)
select id, 1, 1, 'Ganzkörper A', 'ganzkoerper', 'kraft', 55, '[{"type": "mobility", "items": [{"name": "Hüftbeuger-Dehnung im Halbknien", "time_s": 60, "note": "je Seite"}, {"name": "Thorax-Rotation", "reps": "8", "note": "je Seite"}, {"name": "Ankle Rocks", "reps": "10", "note": "je Seite"}]}, {"type": "skill", "items": [{"name": "Pogo Jumps", "sets": 3, "time_s": 20}, {"name": "Box Jump", "sets": 3, "reps": "5"}]}, {"type": "grund", "items": [{"name": "Kniebeuge", "sets": 4, "reps": "6", "load": "RPE 7"}]}, {"type": "hybrid", "items": [{"name": "Einbeiniges RDL mit Langhantel → Clean → langer Schritt auf Box", "sets": 3, "reps": "4", "note": "je Seite"}]}, {"type": "hypertrophie", "items": [{"name": "Kurzhantel-Bankdrücken", "sets": 3, "reps": "10"}, {"name": "Rudern am Kabel", "sets": 3, "reps": "12"}]}, {"type": "finisher", "items": [{"name": "Schlitten schieben", "sets": 4, "dist_m": 20}]}]'::jsonb
from courses where slug = 'hybrid-kraft-2x'
on conflict (course_id, block_no, session_no, is_travel) do nothing;

insert into course_sessions (course_id, block_no, session_no, title, focus, category, duration_min, blocks)
select id, 1, 2, 'Ganzkörper B', 'ganzkoerper', 'kraft', 55, '[{"type": "mobility", "items": [{"name": "World''s Greatest Stretch", "reps": "5", "note": "je Seite"}, {"name": "Cat-Cow", "reps": "10"}, {"name": "Schulter-Dislocates", "reps": "10"}]}, {"type": "skill", "items": [{"name": "Skater Jumps", "sets": 3, "reps": "6", "note": "je Seite"}, {"name": "Medizinball-Slam", "sets": 3, "reps": "8"}]}, {"type": "grund", "items": [{"name": "Kreuzheben", "sets": 4, "reps": "5", "load": "RPE 7"}]}, {"type": "hybrid", "items": [{"name": "Bulgarian Split Squat → Kurzhantel-Push-Press", "sets": 3, "reps": "6", "note": "je Seite"}]}, {"type": "hypertrophie", "items": [{"name": "Klimmzug (assistiert)", "sets": 3, "reps": "6-8"}, {"name": "Schulterdrücken stehend", "sets": 3, "reps": "10"}]}, {"type": "finisher", "items": [{"name": "Farmer Carry", "sets": 4, "dist_m": 30}]}]'::jsonb
from courses where slug = 'hybrid-kraft-2x'
on conflict (course_id, block_no, session_no, is_travel) do nothing;

insert into courses (title, slug, level, duration_weeks, sessions_per_week, category_default,
  price_eur, description, coach_id, source, is_active, owner, focus, block_weeks)
values ('Hybrid Kraft · 3× pro Woche', 'hybrid-kraft-3x', 1, 12, 3, 'kraft', 0, 'Unterkörper, Oberkörper, Ganzkörper. Mobility, Power, Grundübung, Hybrid-Komplex, Hypertrophie, Finisher. Beispielkurs.',
  (select id from go_accounts where name = 'biigJ' order by created_at limit 1),
  'own', true, 'gogogo', 'hybrid', 4)
on conflict (slug) do update set title = excluded.title, sessions_per_week = excluded.sessions_per_week,
  description = excluded.description, owner = 'gogogo', is_active = true;

insert into course_sessions (course_id, block_no, session_no, title, focus, category, duration_min, blocks)
select id, 1, 1, 'Unterkörper', 'unterkoerper', 'kraft', 55, '[{"type": "mobility", "items": [{"name": "Hüftbeuger-Dehnung im Halbknien", "time_s": 60, "note": "je Seite"}, {"name": "Thorax-Rotation", "reps": "8", "note": "je Seite"}, {"name": "Ankle Rocks", "reps": "10", "note": "je Seite"}]}, {"type": "skill", "items": [{"name": "Pogo Jumps", "sets": 3, "time_s": 20}, {"name": "Broad Jump", "sets": 3, "reps": "4"}]}, {"type": "grund", "items": [{"name": "Kniebeuge", "sets": 4, "reps": "6", "load": "RPE 7"}, {"name": "Romanian Deadlift", "sets": 3, "reps": "8"}]}, {"type": "hybrid", "items": [{"name": "Einbeiniges RDL mit Langhantel → Clean → langer Schritt auf Box", "sets": 3, "reps": "4", "note": "je Seite"}]}, {"type": "hypertrophie", "items": [{"name": "Bulgarian Split Squat", "sets": 3, "reps": "8", "note": "je Seite"}, {"name": "Hip Thrust", "sets": 3, "reps": "10"}]}, {"type": "finisher", "items": [{"name": "Schlitten schieben", "sets": 4, "dist_m": 20}]}]'::jsonb
from courses where slug = 'hybrid-kraft-3x'
on conflict (course_id, block_no, session_no, is_travel) do nothing;

insert into course_sessions (course_id, block_no, session_no, title, focus, category, duration_min, blocks)
select id, 1, 2, 'Oberkörper', 'oberkoerper', 'kraft', 55, '[{"type": "mobility", "items": [{"name": "Thorax-Rotation", "reps": "8", "note": "je Seite"}, {"name": "Wall Slides", "reps": "10"}, {"name": "Schulter-Dislocates", "reps": "10"}]}, {"type": "skill", "items": [{"name": "Medizinball-Brustpass", "sets": 3, "reps": "6"}, {"name": "Plyo-Liegestütz", "sets": 3, "reps": "5"}]}, {"type": "grund", "items": [{"name": "Bankdrücken", "sets": 4, "reps": "6", "load": "RPE 7"}, {"name": "Klimmzug", "sets": 4, "reps": "max. 8"}]}, {"type": "hybrid", "items": [{"name": "Kettlebell Clean → Press → Reverse Lunge", "sets": 3, "reps": "5", "note": "je Seite"}]}, {"type": "hypertrophie", "items": [{"name": "Rudern einarmig", "sets": 3, "reps": "10"}, {"name": "Seitheben", "sets": 3, "reps": "15"}]}, {"type": "finisher", "items": [{"name": "Schlitten ziehen", "sets": 4, "dist_m": 20}]}]'::jsonb
from courses where slug = 'hybrid-kraft-3x'
on conflict (course_id, block_no, session_no, is_travel) do nothing;

insert into course_sessions (course_id, block_no, session_no, title, focus, category, duration_min, blocks)
select id, 1, 3, 'Ganzkörper', 'ganzkoerper', 'kraft', 55, '[{"type": "mobility", "items": [{"name": "World''s Greatest Stretch", "reps": "5", "note": "je Seite"}, {"name": "Cat-Cow", "reps": "10"}, {"name": "Schulter-Dislocates", "reps": "10"}]}, {"type": "skill", "items": [{"name": "Skater Jumps", "sets": 3, "reps": "6", "note": "je Seite"}, {"name": "Medizinball-Slam", "sets": 3, "reps": "8"}]}, {"type": "grund", "items": [{"name": "Kreuzheben", "sets": 4, "reps": "5", "load": "RPE 7"}]}, {"type": "hybrid", "items": [{"name": "Thruster → Burpee-Box-Step-Over", "sets": 3, "reps": "6"}]}, {"type": "hypertrophie", "items": [{"name": "Liegestütz", "sets": 3, "reps": "max."}, {"name": "Dead Bug", "sets": 3, "reps": "10"}]}, {"type": "finisher", "items": [{"name": "Farmer Carry", "sets": 4, "dist_m": 30}]}]'::jsonb
from courses where slug = 'hybrid-kraft-3x'
on conflict (course_id, block_no, session_no, is_travel) do nothing;

select c.title, count(s.*) as einheiten
from courses c left join course_sessions s on s.course_id = c.id
where c.slug in ('hybrid-kraft-2x', 'hybrid-kraft-3x') group by c.title order by c.title;
