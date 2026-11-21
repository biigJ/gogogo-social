-- go-admin-groups.sql — Admin: Gruppen-Liste (wie Circles), Fotos und Orte von Nutzern, Gruppen und Circles ändern
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Voraussetzung: go-visibility-team.sql, go-groups-migrate.sql, go-group-search.sql, go-group-news.sql, go-admin-circles.sql.
--
-- groups.locations              Orte je Gruppe
-- go_admin_groups()             Liste für Admin → Gruppen
-- go_admin_set_group_owner      Coach (Ersteller) der Gruppe setzen
-- go_admin_add_group_members    Teilnehmer hinzufügen (höchstens 10, Trigger aus go-group-search.sql)
-- go_admin_save_group_places    Orte der Gruppe
-- go_admin_set_group_photo      Gruppenfoto
-- go_admin_update_account       Foto und Orte eines Nutzers

alter table groups add column if not exists locations text[] not null default '{}';

create or replace function go_admin_groups()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'group_id', g.id,
      'name', g.name,
      'photo_url', g.photo_url,
      'locations', g.locations,
      'owner', (select jsonb_build_object('id', a.id, 'name', a.name) from go_accounts a where a.id = g.created_by),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'status', m.status) order by a.name)
        from group_members m join go_accounts a on a.id = m.account_id
        where m.group_id = g.id and m.account_id is distinct from g.created_by), '[]'::jsonb),
      'last', coalesce((
        select jsonb_agg(jsonb_build_object('at', x.starts_at, 'n', x.n) order by x.starts_at desc)
        from (
          select e.starts_at,
                 1 + (select count(*) from event_rsvps r where r.event_id = e.id and r.status = 'zugesagt') as n
          from events e
          where e.group_id = g.id and e.status <> 'ausgefallen' and e.starts_at < now()
          order by e.starts_at desc
          limit 3
        ) x), '[]'::jsonb)
    ) order by g.name)
    from groups g
  ), '[]'::jsonb);
end $$;
grant execute on function go_admin_groups() to anon, authenticated;

create or replace function go_admin_set_group_owner(p_group uuid, p_account uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old uuid;
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  select created_by into old from groups where id = p_group;
  update groups set created_by = p_account where id = p_group;
  if old is not null and old is distinct from p_account then
    update group_members set role = 'member' where group_id = p_group and account_id = old;
  end if;
  if p_account is not null then
    insert into group_members (group_id, account_id, role, status)
    values (p_group, p_account, 'owner', 'accepted')
    on conflict (group_id, account_id) do update set role = 'owner', status = 'accepted';
  end if;
  return 'ok';
end $$;
grant execute on function go_admin_set_group_owner(uuid, uuid) to anon, authenticated;

create or replace function go_admin_add_group_members(p_group uuid, p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  x uuid;
  n int := 0;
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  foreach x in array coalesce(p_ids, '{}') loop
    insert into group_members (group_id, account_id, role, status, accepted_at, accepted_via)
    values (p_group, x, 'member', 'accepted', now(), 'admin')
    on conflict (group_id, account_id) do update set status = 'accepted', accepted_at = coalesce(group_members.accepted_at, now());
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function go_admin_add_group_members(uuid, uuid[]) to anon, authenticated;

create or replace function go_admin_save_group_places(p_group uuid, p_locations text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update groups set locations = coalesce((select array_agg(trim(x)) from unnest(p_locations) x where trim(x) <> ''), '{}') where id = p_group;
  return 'ok';
end $$;
grant execute on function go_admin_save_group_places(uuid, text[]) to anon, authenticated;

create or replace function go_admin_set_group_photo(p_group uuid, p_url text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update groups set photo_url = nullif(p_url, '') where id = p_group;
  return 'ok';
end $$;
grant execute on function go_admin_set_group_photo(uuid, text) to anon, authenticated;

create or replace function go_admin_update_account(p_account uuid, p_photo text default null, p_places jsonb default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  if p_photo is not null then
    update go_accounts set photo_url = nullif(p_photo, '') where id = p_account;
  end if;
  if p_places is not null then
    update go_accounts set workout_places = p_places, workout_place = coalesce(p_places->>0, '') where id = p_account;
  end if;
  return 'ok';
end $$;
grant execute on function go_admin_update_account(uuid, text, jsonb) to anon, authenticated;
