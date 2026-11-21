-- go-group-news.sql — Herz meldet bestätigte Gruppen-Mitgliedschaften
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-group-requests.sql, go-group-search.sql.
--
-- Einladung bestätigt (Mitglied tippt Bestätigen)   → der Ersteller sieht unter dem Herz „X ist jetzt in Deiner Gruppe“
-- Beitrittsanfrage bestätigt (Ersteller bestätigt)   → das neue Mitglied sieht „Du bist jetzt in Gruppe Y“
-- group_members.accepted_at / accepted_via ('invite' | 'request') / news_seen_at

alter table group_members add column if not exists accepted_at timestamptz;
alter table group_members add column if not exists accepted_via text;
alter table group_members add column if not exists news_seen_at timestamptz;

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
    update group_members
    set status = 'accepted', accepted_at = now(), accepted_via = 'invite', news_seen_at = null
    where group_id = p_group and account_id = me and status = 'pending';
    return 'accepted';
  end if;
  delete from group_members where group_id = p_group and account_id = me and status = 'pending';
  return 'declined';
end $$;
grant execute on function go_answer_group_invite(uuid, boolean) to anon, authenticated;

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
    update group_members
    set status = 'accepted', accepted_at = now(), accepted_via = 'request', news_seen_at = null
    where group_id = p_group and account_id = p_account and status = 'requested';
    return 'accepted';
  end if;
  delete from group_members where group_id = p_group and account_id = p_account and status = 'requested';
  return 'declined';
end $$;
grant execute on function go_answer_group_request(uuid, uuid, boolean) to anon, authenticated;

-- Neuigkeiten für mich (noch nicht gesehen)
create or replace function go_my_group_news()
returns table (group_id uuid, group_name text, account_id uuid, name text, mine boolean, accepted_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  -- als Ersteller: jemand hat meine Einladung bestätigt
  select g.id, g.name, a.id, a.name, false, m.accepted_at
  from group_members m
  join groups g on g.id = m.group_id
  join go_accounts a on a.id = m.account_id
  where g.created_by = go_current_account_id() and m.accepted_via = 'invite' and m.news_seen_at is null
  union all
  -- als Mitglied: der Ersteller hat meine Beitrittsanfrage bestätigt
  select g.id, g.name, m.account_id, null, true, m.accepted_at
  from group_members m
  join groups g on g.id = m.group_id
  where m.account_id = go_current_account_id() and m.accepted_via = 'request' and m.news_seen_at is null
  order by 6 desc;
$$;
grant execute on function go_my_group_news() to anon, authenticated;

create or replace function go_seen_group_news(p_group uuid, p_account uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update group_members m set news_seen_at = now()
  where m.group_id = p_group and m.account_id = p_account and m.news_seen_at is null
    and (
      (m.accepted_via = 'invite' and exists (select 1 from groups g where g.id = m.group_id and g.created_by = go_current_account_id()))
      or (m.accepted_via = 'request' and m.account_id = go_current_account_id())
    );
$$;
grant execute on function go_seen_group_news(uuid, uuid) to anon, authenticated;
