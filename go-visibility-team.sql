-- Visibility: privat | team | gruppe
-- Migration: gruppe → team, alle → team
-- Vorbereitung: groups, group_members, events.group_id
-- Idempotent. Keine UI für Gruppen.

-- ---------------------------------------------------------------------------
-- 1) groups + group_members (vorbereitet, ohne UI)
-- Bestehende Tabelle public.groups (z. B. „Joschas Kreis“) wird erweitert,
-- nicht neu angelegt.
-- ---------------------------------------------------------------------------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table groups
  add column if not exists created_by uuid references go_accounts(id) on delete set null;

alter table groups
  add column if not exists created_at timestamptz not null default now();

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  account_id uuid not null references go_accounts(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, account_id)
);

create index if not exists group_members_account_idx
  on group_members (account_id);

alter table groups enable row level security;
alter table group_members enable row level security;

-- Helper zuerst (security definer → kein RLS-Loop über group_members)
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
    );
$$;

grant execute on function go_is_group_member(uuid) to anon, authenticated;

-- Lesen: eigene Membership-Zeilen (+ Boot). Kein Self-Join → keine Rekursion.
drop policy if exists "group_members_select_member" on group_members;
create policy "group_members_select_member"
  on group_members for select to anon, authenticated
  using (
    go_current_account_id() is null
    or account_id = go_current_account_id()
  );

drop policy if exists "group_members_write_boot" on group_members;
create policy "group_members_write_boot"
  on group_members for all to anon
  using (true)
  with check (true);

drop policy if exists "groups_select_member" on groups;
create policy "groups_select_member"
  on groups for select to anon, authenticated
  using (
    go_current_account_id() is null
    or created_by = go_current_account_id()
    or go_is_group_member(id)
  );

drop policy if exists "groups_write_boot" on groups;
create policy "groups_write_boot"
  on groups for all to anon
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 2) events.group_id
-- ---------------------------------------------------------------------------
alter table events
  add column if not exists group_id uuid references groups(id) on delete set null;

create index if not exists events_group_id_idx
  on events (group_id)
  where group_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Visibility-Werte migrieren + Constraint
-- ---------------------------------------------------------------------------
-- Alte Werte: privat | gruppe | alle
-- Neu:       privat | team | gruppe
-- Mapping:   gruppe → team, alle → team
update events
set visibility = 'team'
where visibility in ('gruppe', 'alle');

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'events'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%visibility%';

  if cname is not null then
    execute format('alter table events drop constraint %I', cname);
  end if;
end $$;

alter table events
  drop constraint if exists events_visibility_check;

alter table events
  add constraint events_visibility_check
  check (visibility in ('privat', 'team', 'gruppe'));

alter table events
  alter column visibility set default 'team';

-- ---------------------------------------------------------------------------
-- 4) RLS events / event_rsvps / event_comments
-- ---------------------------------------------------------------------------
drop policy if exists "events_select_visible" on events;
create policy "events_select_visible"
  on events for select to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or (visibility = 'team' and go_shares_group_with(user_id))
    or (visibility = 'gruppe' and go_is_group_member(group_id))
    or go_current_account_id() is null
  );

drop policy if exists "event_rsvps_select" on event_rsvps;
create policy "event_rsvps_select"
  on event_rsvps for select to anon, authenticated
  using (
    user_id = go_current_account_id()
    or exists (
      select 1 from events e
      where e.id = event_id
        and (
          e.user_id = go_current_account_id()
          or (e.visibility = 'team' and go_shares_group_with(e.user_id))
          or (e.visibility = 'gruppe' and go_is_group_member(e.group_id))
          or go_current_account_id() is null
        )
    )
  );

-- event_comments optional (kommt aus go-event-comments.sql)
do $$
begin
  if to_regclass('public.event_comments') is null then
    raise notice 'event_comments fehlt — Policy übersprungen (go-event-comments.sql danach ausführen).';
    return;
  end if;

  execute 'drop policy if exists "event_comments_select" on event_comments';
  execute $pol$
    create policy "event_comments_select"
      on event_comments for select to anon, authenticated
      using (
        exists (
          select 1 from events e
          where e.id = event_id
            and (
              e.user_id = go_current_account_id()
              or go_is_coach_of(e.user_id)
              or (e.visibility = 'team' and go_shares_group_with(e.user_id))
              or (e.visibility = 'gruppe' and go_is_group_member(e.group_id))
              or go_current_account_id() is null
            )
        )
      )
  $pol$;
end $$;
