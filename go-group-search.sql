-- go-group-search.sql — Gruppe suchen und beitreten (Anfrage an den Ersteller), höchstens 10 Mitglieder je Gruppe
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-visibility-team.sql, go-group-requests.sql.
--
-- group_members.status: 'requested' = Nutzer möchte beitreten, Ersteller bestätigt (Herz in Aktuell)
-- go_find_group(p_name)            Gruppe per Name finden (erst genau, sonst enthält)
-- go_request_group_join(p_group)   Beitritt anfragen
-- go_my_group_requests()           offene Beitrittsanfragen an meine Gruppen
-- go_answer_group_request(...)     Ersteller bestätigt (accepted) oder lehnt ab (Zeile weg)
-- Trigger: höchstens 10 Mitglieder (eingeladen oder dabei, ohne Ersteller)

alter table group_members drop constraint if exists group_members_status_check;
alter table group_members add constraint group_members_status_check
  check (status in ('pending', 'accepted', 'requested'));

create or replace function go_group_members_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if new.role = 'owner' or new.status not in ('pending', 'accepted') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('pending', 'accepted') then
    return new;
  end if;
  select count(*) into n
  from group_members
  where group_id = new.group_id and role <> 'owner' and status in ('pending', 'accepted')
    and account_id <> new.account_id;
  if n >= 10 then
    raise exception 'group_full';
  end if;
  return new;
end $$;

drop trigger if exists go_group_members_limit on group_members;
create trigger go_group_members_limit
  before insert or update on group_members
  for each row execute function go_group_members_limit();

create or replace function go_find_group(p_name text)
returns table (group_id uuid, name text, description text, owner_id uuid, owner_name text, members bigint, my_status text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select lower(trim(p_name)) as n)
  select g.id, g.name, g.description, g.created_by, a.name,
         (select count(*) from group_members m where m.group_id = g.id and m.status = 'accepted' and m.role <> 'owner'),
         (select m.status from group_members m where m.group_id = g.id and m.account_id = go_current_account_id())
  from groups g
  cross join q
  left join go_accounts a on a.id = g.created_by
  where length(q.n) >= 2
    and (lower(g.name) = q.n or lower(g.name) like '%' || q.n || '%')
  order by (lower(g.name) = q.n) desc, g.created_at asc
  limit 5;
$$;
grant execute on function go_find_group(text) to anon, authenticated;

create or replace function go_request_group_join(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  cur text;
  n int;
begin
  if me is null then raise exception 'login'; end if;
  if exists (select 1 from groups where id = p_group and created_by = me) then return 'owner'; end if;
  select status into cur from group_members where group_id = p_group and account_id = me;
  if cur is not null then return cur; end if;
  select count(*) into n from group_members
  where group_id = p_group and role <> 'owner' and status in ('pending', 'accepted');
  if n >= 10 then return 'full'; end if;
  insert into group_members (group_id, account_id, role, status) values (p_group, me, 'member', 'requested');
  return 'requested';
end $$;
grant execute on function go_request_group_join(uuid) to anon, authenticated;

create or replace function go_my_group_requests()
returns table (group_id uuid, group_name text, account_id uuid, name text, nickname text, photo_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name, a.id, a.name, a.nickname, a.photo_url, m.created_at
  from group_members m
  join groups g on g.id = m.group_id
  join go_accounts a on a.id = m.account_id
  where g.created_by = go_current_account_id() and m.status = 'requested'
  order by m.created_at desc;
$$;
grant execute on function go_my_group_requests() to anon, authenticated;

create or replace function go_answer_group_request(p_group uuid, p_account uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from groups where id = p_group and created_by = go_current_account_id()) then
    raise exception 'nur Ersteller';
  end if;
  if p_accept then
    update group_members set status = 'accepted'
    where group_id = p_group and account_id = p_account and status = 'requested';
    return 'accepted';
  end if;
  delete from group_members where group_id = p_group and account_id = p_account and status = 'requested';
  return 'declined';
end $$;
grant execute on function go_answer_group_request(uuid, uuid, boolean) to anon, authenticated;

-- Gruppe eines Coaches (Coach-Liste → „Gruppe beitreten“ bei Coaches ohne Zertifikat)
create or replace function go_coach_group(p_coach uuid)
returns table (group_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name from groups g
  where g.created_by = p_coach
  order by g.created_at asc
  limit 1;
$$;
grant execute on function go_coach_group(uuid) to anon, authenticated;
