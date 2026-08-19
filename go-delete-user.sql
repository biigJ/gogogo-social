-- Vollständiges Löschen von Nutzer-Accounts (Admin + Self-Service)
-- Im Supabase SQL Editor ausführen (Projekt agpysewcsakdpmpftndp).

alter table go_accounts
  add column if not exists deleted_at timestamptz;

create index if not exists go_accounts_deleted_at_idx
  on go_accounts (deleted_at)
  where deleted_at is not null;

drop policy if exists "go_accounts_delete_anon" on go_accounts;
create policy "go_accounts_delete_anon"
  on go_accounts for delete
  to anon, authenticated
  using (true);

-- go_leads ist optional (nur wenn Tabelle existiert)
do $$
begin
  if to_regclass('public.go_leads') is not null then
    execute 'drop policy if exists "go_leads_delete_anon" on go_leads';
    execute 'create policy "go_leads_delete_anon"
      on go_leads for delete
      to anon, authenticated
      using (true)';
  end if;
end $$;

drop policy if exists "go_avatars_delete" on storage.objects;
create policy "go_avatars_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'go-avatars');

drop policy if exists "checkin_photos_delete" on storage.objects;
create policy "checkin_photos_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'checkin-photos');

create or replace function delete_go_user(
  p_invite_id uuid default null,
  p_account_id uuid default null,
  p_serial text default null,
  p_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_code text;
  v_serial text;
begin
  v_serial := nullif(trim(p_serial), '');
  v_code := nullif(trim(p_code), '');

  if p_invite_id is not null then
    select serial_number, code
      into v_serial, v_code
    from go_invite_codes
    where id = p_invite_id;
    delete from go_invite_codes where id = p_invite_id;
  end if;

  if p_account_id is not null then
    v_account_id := p_account_id;
  end if;

  if v_account_id is null and v_serial is not null then
    select id, invite_code
      into v_account_id, v_code
    from go_accounts
    where serial_number = v_serial
    limit 1;
  end if;

  if v_account_id is null and v_code is not null then
    select id, serial_number
      into v_account_id, v_serial
    from go_accounts
    where invite_code = v_code
    limit 1;
  end if;

  if v_account_id is not null then
    select invite_code, serial_number
      into v_code, v_serial
    from go_accounts
    where id = v_account_id;
  end if;

  if p_invite_id is null then
    if v_serial is not null then
      delete from go_invite_codes where serial_number = v_serial;
    elsif v_code is not null then
      delete from go_invite_codes where code = v_code;
    end if;
  end if;

  if v_code is not null and to_regclass('public.go_leads') is not null then
    delete from go_leads where invite_code = v_code;
  end if;

  if v_account_id is not null then
    delete from storage.objects
    where bucket_id = 'go-avatars'
      and name = v_account_id::text || '.png';

    delete from storage.objects
    where bucket_id = 'checkin-photos'
      and name like 'community/' || v_account_id::text || '%';

    update go_accounts
    set deleted_at = now(), updated_at = now()
    where id = v_account_id;

    delete from go_accounts where id = v_account_id;
  elsif v_code is not null then
    delete from go_accounts where invite_code = v_code;
  elsif v_serial is not null then
    delete from go_accounts where serial_number = v_serial;
  end if;
end;
$$;

create or replace function change_go_user_code(
  p_account_id uuid,
  p_new_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_code text;
  v_serial text;
  v_new text;
begin
  v_new := nullif(trim(p_new_code), '');
  if p_account_id is null then
    raise exception 'Account nicht gefunden';
  end if;
  if v_new is null or v_new !~ '^\d{4}$' then
    raise exception 'Code muss 4 Ziffern haben';
  end if;
  if exists (select 1 from go_invite_codes where code = v_new) then
    raise exception 'Code bereits vergeben';
  end if;
  if exists (
    select 1 from go_accounts
    where invite_code = v_new and id <> p_account_id
  ) then
    raise exception 'Code bereits vergeben';
  end if;

  select invite_code, serial_number
    into v_old_code, v_serial
  from go_accounts
  where id = p_account_id;

  if not found then
    raise exception 'Account nicht gefunden';
  end if;

  update go_accounts
  set invite_code = v_new, updated_at = now()
  where id = p_account_id;

  if v_serial is not null then
    update go_invite_codes set code = v_new where serial_number = v_serial;
  elsif v_old_code is not null then
    update go_invite_codes set code = v_new where code = v_old_code;
  end if;
end;
$$;

create or replace function delete_go_invite(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select delete_go_user(p_invite_id := p_id);
$$;

grant execute on function delete_go_user(uuid, uuid, text, text) to anon, authenticated;
grant execute on function change_go_user_code(uuid, text) to anon, authenticated;
grant execute on function delete_go_invite(uuid) to anon, authenticated;
