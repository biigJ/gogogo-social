-- Freunde statt Buddies: go_buddies → go_friends, buddy_id → friend_id
-- Idempotent. Team bleibt UI-Aggregation (Freunde + Coach + Coachees + Gruppen).
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Am Ende: read-only Kompatibilitäts-Views go_buddies / go_buddy_challenges
-- für alte gecachte Clients (friend_id als buddy_id aliased). Die Views werden
-- erst nach DROP/Rename der Tabellen angelegt.

-- ---------------------------------------------------------------------------
-- 1) Tabelle umbenennen (bestehend) oder neu anlegen
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.go_buddies') is not null
     and to_regclass('public.go_friends') is null then
    alter table public.go_buddies rename to go_friends;
  end if;
end $$;

create table if not exists go_friends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  friend_id uuid not null references go_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (account_id, friend_id),
  check (account_id <> friend_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'go_friends' and column_name = 'buddy_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'go_friends' and column_name = 'friend_id'
  ) then
    alter table public.go_friends rename column buddy_id to friend_id;
  end if;
end $$;

-- Falls go_friends schon mit friend_id existiert und go_buddies noch da: Daten mergen, dann drop.
do $$
begin
  if to_regclass('public.go_buddies') is not null
     and to_regclass('public.go_friends') is not null then
    insert into go_friends (account_id, friend_id, created_at)
    select b.account_id, b.buddy_id, b.created_at
    from go_buddies b
    on conflict (account_id, friend_id) do nothing;
    drop table public.go_buddies;
  end if;
end $$;

drop index if exists go_buddies_account_idx;
drop index if exists go_buddies_buddy_idx;
create index if not exists go_friends_account_idx on go_friends (account_id);
create index if not exists go_friends_friend_idx on go_friends (friend_id);

alter table go_friends enable row level security;

drop policy if exists "go_buddies_select_anon" on go_friends;
drop policy if exists "go_buddies_insert_anon" on go_friends;
drop policy if exists "go_buddies_delete_anon" on go_friends;
drop policy if exists "go_friends_select_anon" on go_friends;
drop policy if exists "go_friends_insert_anon" on go_friends;
drop policy if exists "go_friends_delete_anon" on go_friends;

create policy "go_friends_select_anon"
  on go_friends for select
  to anon, authenticated
  using (true);

create policy "go_friends_insert_anon"
  on go_friends for insert
  to anon, authenticated
  with check (true);

create policy "go_friends_delete_anon"
  on go_friends for delete
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2) Sichtbarkeit team: Freundes-Link ODER gleicher Coach (trainer_id)
-- ---------------------------------------------------------------------------
create or replace function go_shares_group_with(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from go_friends f
    where (f.account_id = go_current_account_id() and f.friend_id = p_owner_id)
       or (f.friend_id = go_current_account_id() and f.account_id = p_owner_id)
  )
  or exists (
    select 1
    from go_accounts me
    join go_accounts them on them.id = p_owner_id
    where me.id = go_current_account_id()
      and me.trainer_id is not null
      and me.trainer_id = them.trainer_id
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Challenges: go_buddy_challenges → go_friend_challenges
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.go_buddy_challenges') is not null
     and to_regclass('public.go_friend_challenges') is null then
    alter table public.go_buddy_challenges rename to go_friend_challenges;
  end if;
end $$;

create table if not exists go_friend_challenges (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references go_accounts(id) on delete cascade,
  to_account_id uuid not null references go_accounts(id) on delete cascade,
  days smallint not null default 14 check (days >= 1 and days <= 90),
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'done')),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  accepted_at timestamptz
);

alter table go_friend_challenges
  add column if not exists accepted_at timestamptz;

do $$
begin
  if to_regclass('public.go_buddy_challenges') is not null
     and to_regclass('public.go_friend_challenges') is not null then
    insert into go_friend_challenges (
      id, from_account_id, to_account_id, days, message, status, created_at, seen_at, accepted_at
    )
    select id, from_account_id, to_account_id, days, message, status, created_at, seen_at, accepted_at
    from go_buddy_challenges
    on conflict (id) do nothing;
    drop table public.go_buddy_challenges;
  end if;
end $$;

drop index if exists go_buddy_challenges_to_idx;
create index if not exists go_friend_challenges_to_idx
  on go_friend_challenges (to_account_id, status, created_at desc);

alter table go_friend_challenges enable row level security;

drop policy if exists "go_buddy_challenges_select_anon" on go_friend_challenges;
drop policy if exists "go_buddy_challenges_insert_anon" on go_friend_challenges;
drop policy if exists "go_buddy_challenges_update_anon" on go_friend_challenges;
drop policy if exists "go_friend_challenges_select_anon" on go_friend_challenges;
drop policy if exists "go_friend_challenges_insert_anon" on go_friend_challenges;
drop policy if exists "go_friend_challenges_update_anon" on go_friend_challenges;

create policy "go_friend_challenges_select_anon"
  on go_friend_challenges for select to anon, authenticated using (true);

create policy "go_friend_challenges_insert_anon"
  on go_friend_challenges for insert to anon, authenticated with check (true);

create policy "go_friend_challenges_update_anon"
  on go_friend_challenges for update to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 4) Übergangs-Views für alte gecachte Clients (read-only)
--    Laufen NACH dem DROP/Rename der Tabellen go_buddies / go_buddy_challenges.
--    friend_id wird als buddy_id aliased; Challenges: Spalten 1:1 aliasiert.
-- ---------------------------------------------------------------------------
drop view if exists go_buddies cascade;
create or replace view go_buddies as
  select id, account_id, friend_id as buddy_id, created_at
  from go_friends;

grant select on go_buddies to anon, authenticated;

drop view if exists go_buddy_challenges cascade;
create or replace view go_buddy_challenges as
  select
    id,
    from_account_id,
    to_account_id,
    days,
    message,
    status,
    created_at,
    seen_at,
    accepted_at
  from go_friend_challenges;

grant select on go_buddy_challenges to anon, authenticated;
