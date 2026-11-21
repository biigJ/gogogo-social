-- go-plan-covers.sql — Wochenplan-Bild auch an Events anderer (Freunde, Gruppe, Bubble)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-courses-support.sql.
-- enrollments ist per RLS nur für einen selbst (und den Coach) lesbar. Fürs Bild reicht die Zuordnung
-- Einschreibung → Wochenplan (ohne Person), damit Ben an Joschas Events Joschas Plan-Bild sieht statt des Kategoriebilds.

create or replace function go_enrollment_plans()
returns table (id uuid, course_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.course_id from enrollments e where e.course_id is not null;
$$;
grant execute on function go_enrollment_plans() to anon, authenticated;
