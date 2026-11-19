-- go-uebung-ablehnen.sql — Admin → Videos: eingereichte Übung ablehnen löscht die Einreichung
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-uebung-einreichen.sql.
-- Ohne diese Datei blendet „Ablehnen“ die Einreichung nur aus (done_at), statt sie zu löschen.

drop policy if exists "go_ex_sub_delete" on go_exercise_submissions;
create policy "go_ex_sub_delete" on go_exercise_submissions for delete to anon, authenticated
  using (go_is_admin());
