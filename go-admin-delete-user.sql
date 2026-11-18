-- go-admin-delete-user.sql — Admin: Nutzer löschen (Profil → Admin → Coaches/Nutzer → Löschen)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- rpc go_admin_delete_account(p_account uuid)
--   nur Admin (go_is_admin), nicht sich selbst, keine anderen Admins.
--   Sicherung des Kontos in go_cleanup_backup (tbl 'admin-delete:go_accounts').
--   Tabellen ohne Fremdschlüssel werden ausdrücklich geleert, der Rest fällt per ON DELETE CASCADE weg.
--   Endgültig: Termine, Kommentare, Tracking dieser Person sind danach weg.

create table if not exists go_cleanup_backup (
  id bigserial primary key,
  account_id uuid not null,
  tbl text not null,
  col text,
  row_data jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function go_admin_delete_account(p_account uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  r record;
  n int;
  v_done jsonb := '{}'::jsonb;
begin
  if not go_is_admin() then
    raise exception 'Nur Admin';
  end if;
  if p_account is null or p_account = go_current_account_id() then
    raise exception 'Eigenes Konto kann nicht gelöscht werden';
  end if;
  select name into v_name from go_accounts where id = p_account;
  if exists (select 1 from go_accounts where id = p_account and is_admin) then
    raise exception 'Admins können nicht gelöscht werden';
  end if;
  if v_name is null then
    raise exception 'Konto nicht gefunden';
  end if;

  insert into go_cleanup_backup (account_id, tbl, row_data)
  select a.id, 'admin-delete:go_accounts', to_jsonb(a) from go_accounts a where a.id = p_account;

  -- Tabellen ohne Fremdschlüssel auf go_accounts (falls vorhanden)
  for r in
    select * from (values
      ('go_friends', 'account_id'), ('go_friends', 'friend_id'),
      ('go_coach_requests', 'user_id'), ('go_coach_requests', 'coach_id'),
      ('go_event_requests', 'requester_id'), ('go_event_requests', 'owner_id'),
      ('go_ffc_sessions', 'account_id'),
      ('go_exercise_submissions', 'account_id'),
      ('go_wa_reminder_log', 'account_id'),
      ('go_coach_plans', 'account_id'),
      ('coach_notes', 'coachee_id'), ('coach_notes', 'coach_id')
    ) as t(tbl, col)
  loop
    if exists (
      select 1 from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
        and t.table_type = 'BASE TABLE'
    ) then
      execute format('delete from %I where %I = $1', r.tbl, r.col) using p_account;
      get diagnostics n = row_count;
      if n > 0 then v_done := v_done || jsonb_build_object(r.tbl || '.' || r.col, n); end if;
    end if;
  end loop;

  update go_accounts set trainer_id = null where trainer_id = p_account;
  delete from go_accounts where id = p_account;

  return jsonb_build_object('deleted', v_name, 'cleared', v_done);
end $$;

revoke all on function go_admin_delete_account(uuid) from public;
grant execute on function go_admin_delete_account(uuid) to anon, authenticated;
