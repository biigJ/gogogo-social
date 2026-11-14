-- Migrate Profil „Meine Gruppen“ from go_accounts.about_me->groups
-- into tables groups + group_members (source of truth afterwards).
-- Idempotent. Run after go-visibility-team.sql (tables + go_is_group_member).
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).

-- ---------------------------------------------------------------------------
-- 1) Optional UI columns on groups
-- ---------------------------------------------------------------------------
alter table groups
  add column if not exists description text;

alter table groups
  add column if not exists photo_url text;

alter table groups
  add column if not exists legacy_key text;

create unique index if not exists groups_legacy_key_uidx
  on groups (legacy_key)
  where legacy_key is not null;

-- ---------------------------------------------------------------------------
-- 2) RLS: keep write_boot; allow reading peer memberships via security definer
-- ---------------------------------------------------------------------------
alter table groups enable row level security;
alter table group_members enable row level security;

drop policy if exists "groups_write_boot" on groups;
create policy "groups_write_boot"
  on groups for all to anon
  using (true)
  with check (true);

drop policy if exists "group_members_write_boot" on group_members;
create policy "group_members_write_boot"
  on group_members for all to anon
  using (true)
  with check (true);

-- Peers in same group (go_is_group_member is security definer → no RLS recursion)
drop policy if exists "group_members_select_peers" on group_members;
create policy "group_members_select_peers"
  on group_members for select to anon, authenticated
  using (
    go_current_account_id() is null
    or go_is_group_member(group_id)
  );

-- ---------------------------------------------------------------------------
-- 3) go_migrate_about_groups([p_account_id])
--    - null + session header → current account
--    - explicit uuid → that account
--    - null + no header → all accounts with about_me.groups
-- ---------------------------------------------------------------------------
create or replace function go_migrate_about_groups(p_account_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  acc record;
  g jsonb;
  gid uuid;
  legacy text;
  gname text;
  mid text;
  member_uuid uuid;
  migrated int := 0;
  groups_arr jsonb;
  about jsonb;
  target_id uuid;
begin
  target_id := coalesce(p_account_id, go_current_account_id());

  for acc in
    select a.id, a.about_me
    from go_accounts a
    where (target_id is null or a.id = target_id)
      and a.about_me is not null
      and jsonb_typeof(a.about_me -> 'groups') = 'array'
      and jsonb_array_length(a.about_me -> 'groups') > 0
  loop
    about := coalesce(acc.about_me, '{}'::jsonb);
    groups_arr := about -> 'groups';

    for g in select value from jsonb_array_elements(groups_arr)
    loop
      if g is null or jsonb_typeof(g) <> 'object' then
        continue;
      end if;

      gname := nullif(trim(both from coalesce(g ->> 'name', '')), '');
      if gname is null then
        continue;
      end if;

      legacy := nullif(trim(both from coalesce(g ->> 'id', '')), '');
      gid := null;

      if legacy is not null then
        select gr.id into gid
        from groups gr
        where gr.legacy_key = legacy
        limit 1;
      end if;

      if gid is null then
        select gr.id into gid
        from groups gr
        where gr.created_by = acc.id
          and gr.name = gname
        order by gr.created_at asc
        limit 1;
      end if;

      if gid is null then
        insert into groups (name, description, photo_url, created_by, legacy_key)
        values (
          gname,
          nullif(trim(both from coalesce(g ->> 'description', '')), ''),
          nullif(trim(both from coalesce(g ->> 'photo_url', '')), ''),
          acc.id,
          legacy
        )
        returning id into gid;
      else
        update groups
        set
          description = coalesce(
            nullif(trim(both from coalesce(g ->> 'description', '')), ''),
            description
          ),
          photo_url = coalesce(
            nullif(trim(both from coalesce(g ->> 'photo_url', '')), ''),
            photo_url
          ),
          legacy_key = coalesce(legacy_key, legacy)
        where id = gid;
      end if;

      insert into group_members (group_id, account_id, role)
      values (gid, acc.id, 'owner')
      on conflict (group_id, account_id) do update
        set role = 'owner';

      if jsonb_typeof(g -> 'members') = 'array' then
        for mid in select jsonb_array_elements_text(g -> 'members')
        loop
          mid := nullif(trim(both from mid), '');
          if mid is null then
            continue;
          end if;
          begin
            member_uuid := mid::uuid;
          exception
            when others then
              continue;
          end;
          if member_uuid = acc.id then
            continue;
          end if;
          if not exists (select 1 from go_accounts where id = member_uuid) then
            continue;
          end if;
          insert into group_members (group_id, account_id, role)
          values (gid, member_uuid, 'member')
          on conflict (group_id, account_id) do nothing;
        end loop;
      end if;

      migrated := migrated + 1;
    end loop;

    update go_accounts
    set about_me = coalesce(about_me, '{}'::jsonb) - 'groups',
        updated_at = now()
    where id = acc.id;
  end loop;

  return migrated;
end;
$$;

grant execute on function go_migrate_about_groups(uuid) to anon, authenticated;

-- PostgREST overload without args (body {})
create or replace function go_migrate_about_groups()
returns integer
language sql
security definer
set search_path = public
as $$
  select go_migrate_about_groups(null::uuid);
$$;

grant execute on function go_migrate_about_groups() to anon, authenticated;
