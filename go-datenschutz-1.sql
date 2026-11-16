-- go-datenschutz-1.sql — Datenschutz Stufe 1: Trainings, Tagebuch und Coach-Notizen nur für Berechtigte
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- Vorher: jeder mit dem öffentlichen Schlüssel konnte go_workout_logs, go_natalya_logs,
-- go_diary_entries und (ohne Header) coach_notes lesen und ändern.
-- Jetzt:
--   Trainings (go_workout_logs, go_natalya_logs): ich, mein Coach, Freunde wenn ich „Offen für Freunde“ gewählt habe
--   Tagebuch (go_diary_entries): ich, Coach bei „Offen für Trainer“/„Freunde“, Freunde bei „Offen für Freunde“
--   Schreiben/Löschen: nur ich
--   Coach-Notizen: nur der Coach, der sie schreibt
-- Alle vier Tabellen nutzt nur /workout/ (immer mit x-go-account-id).
-- Stufe 2 (Geheimschlüssel statt Konto-ID im Header) folgt separat.

alter table go_accounts add column if not exists privacy_ack_at timestamptz;

create or replace function go_is_friend_of(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from go_friends f
    where (f.account_id = p_owner and f.friend_id = go_current_account_id())
       or (f.friend_id = p_owner and f.account_id = go_current_account_id())
  );
$$;

-- p_kind: 'training' (Coach sieht immer) oder 'diary' (Coach nur wenn freigegeben)
create or replace function go_can_see(p_owner uuid, p_kind text default 'training')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select go_current_account_id() is not null and (
    p_owner = go_current_account_id()
    or exists (
      select 1 from go_accounts a
      where a.id = p_owner
        and (
          (a.trainer_id = go_current_account_id()
            and (p_kind = 'training' or a.diary_visibility in ('trainer', 'friends')))
          or (a.diary_visibility = 'friends' and go_is_friend_of(p_owner))
        )
    )
  );
$$;

-- Natalyas Alt-Logs haben keine account_id: Eigentümer ist ihr Konto
create or replace function go_natalya_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from go_accounts
  where lower(coalesce(phone, '')) = 'natalya' or serial_number = '24011901'
  order by created_at
  limit 1;
$$;

grant execute on function go_is_friend_of(uuid) to anon, authenticated;
grant execute on function go_can_see(uuid, text) to anon, authenticated;
grant execute on function go_natalya_account_id() to anon, authenticated;

-- go_workout_logs
drop policy if exists "go_workout_logs_select_anon" on go_workout_logs;
drop policy if exists "go_workout_logs_insert_anon" on go_workout_logs;
drop policy if exists "go_workout_logs_update_anon" on go_workout_logs;
drop policy if exists "go_workout_logs_delete_anon" on go_workout_logs;
drop policy if exists "go_workout_logs_select" on go_workout_logs;
drop policy if exists "go_workout_logs_write" on go_workout_logs;
create policy "go_workout_logs_select" on go_workout_logs for select to anon, authenticated
  using (go_can_see(account_id, 'training'));
create policy "go_workout_logs_write" on go_workout_logs for all to anon, authenticated
  using (account_id = go_current_account_id())
  with check (account_id = go_current_account_id());

-- go_natalya_logs (falls vorhanden)
do $$
declare p record;
begin
  if to_regclass('public.go_natalya_logs') is null then return; end if;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'go_natalya_logs' loop
    execute format('drop policy %I on go_natalya_logs', p.policyname);
  end loop;
  execute 'create policy "go_natalya_logs_select" on go_natalya_logs for select to anon, authenticated
    using (go_can_see(go_natalya_account_id(), ''training''))';
  execute 'create policy "go_natalya_logs_write" on go_natalya_logs for all to anon, authenticated
    using (go_current_account_id() = go_natalya_account_id())
    with check (go_current_account_id() = go_natalya_account_id())';
end $$;

-- go_diary_entries
drop policy if exists "go_diary_entries_select_anon" on go_diary_entries;
drop policy if exists "go_diary_entries_insert_anon" on go_diary_entries;
drop policy if exists "go_diary_entries_update_anon" on go_diary_entries;
drop policy if exists "go_diary_entries_delete_anon" on go_diary_entries;
drop policy if exists "go_diary_entries_select" on go_diary_entries;
drop policy if exists "go_diary_entries_write" on go_diary_entries;
create policy "go_diary_entries_select" on go_diary_entries for select to anon, authenticated
  using (go_can_see(account_id, 'diary'));
create policy "go_diary_entries_write" on go_diary_entries for all to anon, authenticated
  using (account_id = go_current_account_id())
  with check (account_id = go_current_account_id());

-- coach_notes: ohne Header kein Zugriff mehr
drop policy if exists "coach_notes_rw" on coach_notes;
create policy "coach_notes_rw" on coach_notes for all to anon, authenticated
  using (coach_id = go_current_account_id())
  with check (coach_id = go_current_account_id());
