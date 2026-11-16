-- go-coach-enroll.sql — Coach darf seinem Coachee einen Wochenplan zuordnen
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen, nach go-wochenplaene.sql.
--
-- Bisher: enrollments-Insert nur für sich selbst (user_id = eingeloggter Account).
-- "Zuordnen" im Coach-Portal legt das Enrollment für den Coachee an und scheiterte daran.
-- go_generate_events ist security definer und braucht keine Änderung.

drop policy if exists "enrollments_insert_own" on enrollments;
create policy "enrollments_insert_own"
  on enrollments for insert to anon, authenticated
  with check (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );
