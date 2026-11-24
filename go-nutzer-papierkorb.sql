-- go-nutzer-papierkorb.sql — Admin → Nutzer: Löschen legt in den Papierkorb (Löschdatum), endgültig löschen nur von dort
-- Idempotent. Voraussetzung: go-delete-user.sql (deleted_at), go-admin-delete-user.sql, go-admin.sql.
--
-- go_accounts.deleted_at / deleted_by   Zeitpunkt und Admin, der in den Papierkorb gelegt hat
-- Papierkorb: Konto und Daten bleiben gespeichert, sind aber für alle außer Admins unsichtbar
--             (kein Login, nicht in Freunden, Feed, Profilen). Wiederherstellen setzt deleted_at zurück.
-- go_admin_trash_account(p_account, p_on)   in den Papierkorb (true) oder wiederherstellen (false)
-- go_admin_delete_account(p_account)        endgültig, nur für Konten im Papierkorb

alter table go_accounts add column if not exists deleted_at timestamptz;
alter table go_accounts add column if not exists deleted_by uuid;

create or replace function go_account_active(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select a.deleted_at is null from go_accounts a where a.id = p_account), true);
$$;
grant execute on function go_account_active(uuid) to anon, authenticated;

/* einschränkend (restrictive): gilt zusätzlich zu allen bestehenden Lese-Regeln */
drop policy if exists "go_accounts_hide_trashed" on go_accounts;
create policy "go_accounts_hide_trashed" on go_accounts as restrictive for select to anon, authenticated
  using (deleted_at is null or go_is_admin());

drop policy if exists "events_hide_trashed" on events;
create policy "events_hide_trashed" on events as restrictive for select to anon, authenticated
  using (go_account_active(user_id) or go_is_admin());

create or replace function go_admin_trash_account(p_account uuid, p_on boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz;
begin
  if not go_is_admin() then raise exception 'Nur Admin'; end if;
  if p_account is null or p_account = go_current_account_id() then raise exception 'self'; end if;
  if coalesce(p_on, true) and exists (select 1 from go_accounts where id = p_account and is_admin) then raise exception 'admin'; end if;
  if coalesce(p_on, true) then
    update go_accounts set deleted_at = coalesce(deleted_at, now()), deleted_by = go_current_account_id() where id = p_account returning deleted_at into v_at;
  else
    update go_accounts set deleted_at = null, deleted_by = null where id = p_account;
  end if;
  if not found then raise exception 'Konto nicht gefunden'; end if;
  return v_at;
end $$;
revoke all on function go_admin_trash_account(uuid, boolean) from public;
grant execute on function go_admin_trash_account(uuid, boolean) to anon, authenticated;

/* Admin-Liste: Löschdatum mitliefern */
create or replace function go_admin_inbox(p_limit integer default 80)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_accounts jsonb;
  v_bookings jsonb;
begin
  if not go_is_admin() then
    raise exception 'Nur Admins';
  end if;

  select coalesce(jsonb_agg(x.j order by x.at desc), '[]'::jsonb) into v_accounts
  from (
    select a.created_at as at, jsonb_build_object(
      'at', a.created_at, 'account_id', a.id, 'name', a.name,
      'photo_url', a.photo_url, 'is_trainer', a.is_trainer, 'trainer_id', a.trainer_id,
      'deleted_at', a.deleted_at
    ) as j
    from go_accounts a
    order by a.created_at desc
    limit p_limit
  ) x;

  select coalesce(jsonb_agg(y.j order by y.at desc), '[]'::jsonb) into v_bookings
  from (
    select * from (
      select o.created_at as at, jsonb_build_object(
        'at', o.created_at, 'account_id', o.user_id, 'name', a.name, 'photo_url', a.photo_url,
        'type', p.type, 'title', p.title, 'status', o.status
      ) as j
      from support_orders o
      join support_products p on p.id = o.product_id
      left join go_accounts a on a.id = o.user_id
      union all
      select l.created_at, jsonb_build_object(
        'at', l.created_at, 'account_id', l.user_id, 'name', a.name, 'photo_url', a.photo_url,
        'type', l.meta->>'type', 'title', null, 'status', 'gebucht'
      )
      from activity_log l
      left join go_accounts a on a.id = l.user_id
      where l.type = 'support_request' and l.meta ? 'type'
    ) u
    order by u.at desc
    limit p_limit
  ) y;

  return jsonb_build_object('accounts', v_accounts, 'bookings', v_bookings);
end $$;

/* endgültig löschen nur aus dem Papierkorb (sonst wie go-admin-delete-user.sql) */
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
  if not exists (select 1 from go_accounts where id = p_account and deleted_at is not null) then
    raise exception 'Erst in den Papierkorb';
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
