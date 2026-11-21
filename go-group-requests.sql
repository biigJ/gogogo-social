-- go-group-requests.sql — Meine Gruppe: Hinzugefügte bestätigen erst (Herz in Aktuell), Ablehnen entfernt sie
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-visibility-team.sql, go-groups-migrate.sql.
--
-- group_members.status: bestehende Mitglieder bleiben 'accepted'; neu hinzugefügte sind 'pending',
-- bis sie im Dialog „X möchte Dich der Gruppe Y hinzufügen“ Bestätigen tippen. Ablehnen löscht die Zeile.
-- Offene Mitglieder sehen Gruppen-Events erst nach dem Bestätigen (go_is_group_member).

alter table group_members add column if not exists status text not null default 'accepted';
alter table group_members alter column status set default 'pending';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'group_members_status_check') then
    alter table group_members add constraint group_members_status_check check (status in ('pending', 'accepted'));
  end if;
end $$;
-- Besitzer sind immer dabei
update group_members set status = 'accepted' where role = 'owner' and status <> 'accepted';

create or replace function go_is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_group_id is not null
    and exists (
      select 1 from group_members gm
      where gm.group_id = p_group_id
        and gm.account_id = go_current_account_id()
        and gm.status = 'accepted'
    );
$$;
grant execute on function go_is_group_member(uuid) to anon, authenticated;

-- Offene Anfragen an mich, mit Gruppenname, Kurzbeschreibung und Besitzer
create or replace function go_my_group_invites()
returns table (group_id uuid, name text, description text, owner_id uuid, owner_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name, g.description, g.created_by, a.name, gm.created_at
  from group_members gm
  join groups g on g.id = gm.group_id
  left join go_accounts a on a.id = g.created_by
  where gm.account_id = go_current_account_id() and gm.status = 'pending'
  order by gm.created_at desc;
$$;
grant execute on function go_my_group_invites() to anon, authenticated;

-- Bestätigen → accepted, Ablehnen → Zeile weg (erscheint nicht mehr in der Gruppe)
create or replace function go_answer_group_invite(p_group uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
begin
  if me is null then raise exception 'nicht angemeldet'; end if;
  if p_accept then
    update group_members set status = 'accepted' where group_id = p_group and account_id = me and status = 'pending';
    return 'accepted';
  end if;
  delete from group_members where group_id = p_group and account_id = me and status = 'pending';
  return 'declined';
end $$;
grant execute on function go_answer_group_invite(uuid, boolean) to anon, authenticated;
