-- go-circle-events.sql — Circle: Orte, online, Circle-Events (Coach) und Nachricht ans Herz
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-circle.sql, go-visibility-fein.sql.
--
-- go_circles                 Einstellungen je Circle (FFC-Gruppe, group_id als Text): Orte, online möglich, Coach (owner_id)
--                            Wer zuerst speichert (in der App: Gründer des Circles), ist Coach; danach nur er oder Admin.
-- events.circle_id           Event gehört zu einem Circle (vom Coach erstellt)
-- go_circle_events(g, days)  Circle-Events der nächsten Tage: eigene Circle-Events des Coaches + seine Zirkeltrainings aus dem Wochenplan
-- go_join_circle_event(e)    Mitglied übernimmt ein Circle-Event in seine Woche (Zusage)
-- go_circle_news(groups)     neue Circle-Events für das Herz (noch nicht gesehen, noch nicht zugesagt)
-- go_seen_circle_news(e)     als gesehen markieren

create table if not exists go_circles (
  group_id text primary key,
  name text not null default '',
  owner_id uuid references go_accounts(id) on delete set null,
  locations text[] not null default '{}',
  online boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table go_circles enable row level security;
drop policy if exists "go_circles_select" on go_circles;
create policy "go_circles_select" on go_circles for select to anon, authenticated using (true);
-- Schreiben nur über go_save_circle

create or replace function go_save_circle(p_group text, p_name text, p_locations text[], p_online boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  owner uuid;
begin
  if me is null or coalesce(trim(p_group), '') = '' then raise exception 'login'; end if;
  select c.owner_id into owner from go_circles c where c.group_id = trim(p_group);
  if found and owner is not null and owner <> me and not go_is_admin() then raise exception 'not_owner'; end if;
  insert into go_circles (group_id, name, owner_id, locations, online, updated_at)
  values (trim(p_group), coalesce(trim(p_name), ''), me,
          coalesce((select array_agg(trim(x)) from unnest(p_locations) x where trim(x) <> ''), '{}'), coalesce(p_online, false), now())
  on conflict (group_id) do update
    set name = excluded.name, locations = excluded.locations, online = excluded.online, updated_at = now(),
        owner_id = coalesce(go_circles.owner_id, excluded.owner_id);
  return 'ok';
end $$;
grant execute on function go_save_circle(text, text, text[], boolean) to anon, authenticated;

alter table events add column if not exists circle_id text;
create index if not exists events_circle_idx on events (circle_id, starts_at) where circle_id is not null;

-- zugesagte Circle-Events sieht man in der eigenen Woche (Funktion statt Unterabfrage: keine RLS-Schleife mit event_rsvps)
create or replace function go_i_joined(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from event_rsvps r where r.event_id = p_event and r.user_id = go_current_account_id() and r.status = 'zugesagt');
$$;
grant execute on function go_i_joined(uuid) to anon, authenticated;

drop policy if exists "events_select_circle_joined" on events;
create policy "events_select_circle_joined" on events for select to anon, authenticated
  using (circle_id is not null and go_i_joined(id));

create or replace function go_circle_events(p_group text, p_days int default 14)
returns table (id uuid, user_id uuid, title text, starts_at timestamptz, note text, location text, circle_id text, created_at timestamptz, joined boolean)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.user_id, e.title, e.starts_at, e.note, e.location, e.circle_id, e.created_at,
         exists (select 1 from event_rsvps r where r.event_id = e.id and r.user_id = go_current_account_id() and r.status = 'zugesagt')
  from events e
  left join go_circles c on c.group_id = trim(p_group)
  where e.status = 'geplant'
    and e.starts_at >= now() - interval '2 hours'
    and e.starts_at < now() + make_interval(days => greatest(1, least(coalesce(p_days, 14), 60)))
    and (
      e.circle_id = trim(p_group)
      or (e.circle_id is null and e.category = 'zirkel' and c.owner_id is not null and e.user_id = c.owner_id)
    )
  order by e.starts_at;
$$;
grant execute on function go_circle_events(text, int) to anon, authenticated;

create table if not exists go_circle_news_seen (
  account_id uuid not null references go_accounts(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (account_id, event_id)
);
alter table go_circle_news_seen enable row level security;
drop policy if exists "go_circle_news_seen_own" on go_circle_news_seen;
create policy "go_circle_news_seen_own" on go_circle_news_seen for select to anon, authenticated
  using (account_id = go_current_account_id());

create or replace function go_join_circle_event(p_event uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
begin
  if me is null then raise exception 'login'; end if;
  if not exists (
    select 1 from events e left join go_circles c on c.owner_id = e.user_id
    where e.id = p_event and e.status = 'geplant'
      and (e.circle_id is not null or (e.category = 'zirkel' and c.group_id is not null))
  ) then
    return 'not_circle';
  end if;
  insert into event_rsvps (event_id, user_id, status) values (p_event, me, 'zugesagt')
  on conflict (event_id, user_id) do update set status = 'zugesagt';
  insert into go_circle_news_seen (account_id, event_id) values (me, p_event) on conflict do nothing;
  return 'joined';
end $$;

grant execute on function go_join_circle_event(uuid) to anon, authenticated;

-- Herz: neue Circle-Events vom Coach in meinen Circles (Liste der FFC-Gruppen kommt aus der App)
create or replace function go_circle_news(p_groups text[])
returns table (id uuid, circle_id text, circle_name text, starts_at timestamptz, note text, location text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.circle_id, coalesce(nullif(c.name, ''), 'Circle'), e.starts_at, e.note, e.location, e.created_at
  from events e
  left join go_circles c on c.group_id = e.circle_id
  where e.circle_id = any (coalesce(p_groups, '{}'))
    and e.user_id <> go_current_account_id()
    and e.status = 'geplant'
    and e.starts_at > now()
    and e.created_at > now() - interval '14 days'
    and not exists (select 1 from go_circle_news_seen s where s.event_id = e.id and s.account_id = go_current_account_id())
    and not exists (select 1 from event_rsvps r where r.event_id = e.id and r.user_id = go_current_account_id())
  order by e.created_at desc
  limit 20;
$$;
grant execute on function go_circle_news(text[]) to anon, authenticated;

create or replace function go_seen_circle_news(p_event uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into go_circle_news_seen (account_id, event_id)
  select go_current_account_id(), p_event where go_current_account_id() is not null
  on conflict do nothing;
$$;
grant execute on function go_seen_circle_news(uuid) to anon, authenticated;
