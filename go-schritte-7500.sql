-- go-schritte-7500.sql — Schritte-Vorgabe von 5.000 auf 7.500 (Wunsch Joscha, 2026-11-27).
-- Vorlage, Plan-Einheiten, Kursbeschreibungen und künftige geplante Events. Erledigte Events bleiben unverändert (Historie).
-- Idempotent: läuft ein zweites Mal ohne Wirkung.
begin;

update courses
   set title = '> 7.500 Schritte'
 where title = '> 5.000 Schritte';

update courses
   set description = replace(description, '5.000 Schritte', '7.500 Schritte')
 where description like '%5.000 Schritte%';

update course_sessions
   set title = '> 7.500 Schritte'
 where title = '> 5.000 Schritte';

update course_sessions
   set blocks = replace(blocks::text, 'mindestens 5.000 Schritte', 'mindestens 7.500 Schritte')::jsonb
 where title = '> 7.500 Schritte' and blocks::text like '%mindestens 5.000 Schritte%';

update events
   set title = '> 7.500 Schritte'
 where title = '> 5.000 Schritte'
   and status = 'geplant'
   and starts_at >= (date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin');

commit;
