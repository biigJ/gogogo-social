-- go-group-leave.sql — Gruppe verlassen (Mitglied) und Mitglied entfernen (Ersteller)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-group-search.sql.
-- Entfernt auch offene Einladungen und Beitrittsanfragen. Offene Stempelkarten-Verknüpfungen der Gruppe fallen weg,
-- bereits verknüpfte Karten behalten ihre Stempel.

create or replace function go_group_drop_links(p_group uuid, p_account uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.go_stamp_links') is not null then
    execute 'delete from go_stamp_links where account_id = $1 and kind = ''group'' and ref = $2 and status = ''pending'''
      using p_account, p_group::text;
  end if;
end $$;

-- Mitglied verlässt die Gruppe (der Ersteller löscht seine Gruppe unter „Gruppe anpassen“)
create or replace function go_leave_group(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
begin
  if me is null then raise exception 'login'; end if;
  if exists (select 1 from groups where id = p_group and created_by = me) then return 'owner'; end if;
  delete from group_members where group_id = p_group and account_id = me;
  perform go_group_drop_links(p_group, me);
  return 'left';
end $$;
grant execute on function go_leave_group(uuid) to anon, authenticated;

-- Ersteller entfernt ein Mitglied (auch Einladung zurückziehen oder Anfrage ablehnen)
create or replace function go_remove_group_member(p_group uuid, p_account uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from groups where id = p_group and created_by = go_current_account_id()) then
    raise exception 'nur Ersteller';
  end if;
  if p_account = go_current_account_id() then return 'owner'; end if;
  delete from group_members where group_id = p_group and account_id = p_account;
  perform go_group_drop_links(p_group, p_account);
  return 'removed';
end $$;
grant execute on function go_remove_group_member(uuid, uuid) to anon, authenticated;
