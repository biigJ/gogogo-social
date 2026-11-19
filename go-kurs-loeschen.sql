-- go-kurs-loeschen.sql — Wochenpläne/Einzeleinheiten im Editor löschen, auch wenn schon damit trainiert wurde
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- Hartes Löschen scheitert, sobald erledigte Kraft-/Ausdauer-Events auf den Plan zeigen
-- (events_course_or_alternative_chk: course_id darf dort nicht leer werden).
-- Dann markiert der Editor den Plan als gelöscht: deleted_at gesetzt, nicht aktiv, nicht öffentlich.
-- Offene künftige Termine des Plans entfernt der Editor, die Historie bleibt.

alter table courses add column if not exists deleted_at timestamptz;
