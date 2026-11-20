-- go-bubbles.sql — Bubbles: Themen-Communities (HYROX, Sprinten, …), je Nutzer genau eine Bubble
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-courses-support.sql (go_current_account_id).
--
-- go_bubbles          Bubble: Name, Foto, Beschreibung, Orte, Farbe
-- go_bubble_members   Mitgliedschaft (account_id ist Primärschlüssel → nur eine Bubble gleichzeitig), Rolle member | coach
-- events.bubble_id    Event aus dem Wochenplan in der Bubble zeigen (Woche → Tage bearbeiten → Bubble)
-- RLS: Bubbles und Mitglieder sieht jeder; Bubble-Events (nicht privat) sehen alle Mitglieder derselben Bubble,
--      dazu deren Kommentare und Zusagen.

create table if not exists go_bubbles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  photo_url text,
  color text,
  places jsonb not null default '[]'::jsonb,
  created_by uuid references go_accounts(id) on delete set null,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists go_bubbles_name_uidx on go_bubbles (lower(name));

create table if not exists go_bubble_members (
  account_id uuid primary key references go_accounts(id) on delete cascade,
  bubble_id uuid not null references go_bubbles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'coach')),
  joined_at timestamptz not null default now()
);
create index if not exists go_bubble_members_bubble_idx on go_bubble_members (bubble_id);

alter table events add column if not exists bubble_id uuid references go_bubbles(id) on delete set null;
create index if not exists events_bubble_idx on events (bubble_id) where bubble_id is not null;

-- Start-Bubbles
insert into go_bubbles (name, description, color, sort) values
  ('HYROX', 'Laufen, Sled, Wall Balls: gemeinsam fit für den nächsten Wettkampf.', '#FFD84D', 10),
  ('Sprinten', 'Kurze Läufe, volle Geschwindigkeit. Technik, Starts, Intervalle.', '#FF7A59', 20),
  ('Schwimmen', 'Bahnen ziehen, Technik verbessern, zusammen ins Wasser.', '#5EC8F2', 30),
  ('Spaziergänge', 'Raus an die Luft: gehen, reden, Schritte sammeln.', '#9BD49B', 40),
  ('Calisthenics', 'Training mit dem eigenen Körpergewicht: Klimmzüge, Dips, Handstand.', '#C9A7F5', 50)
on conflict do nothing;

alter table go_bubbles enable row level security;
drop policy if exists "go_bubbles_select" on go_bubbles;
create policy "go_bubbles_select" on go_bubbles for select to anon, authenticated using (true);
drop policy if exists "go_bubbles_insert" on go_bubbles;
create policy "go_bubbles_insert" on go_bubbles for insert to anon, authenticated
  with check (created_by = go_current_account_id());
drop policy if exists "go_bubbles_update" on go_bubbles;
create policy "go_bubbles_update" on go_bubbles for update to anon, authenticated
  using (created_by = go_current_account_id()) with check (created_by = go_current_account_id());

alter table go_bubble_members enable row level security;
drop policy if exists "go_bubble_members_select" on go_bubble_members;
create policy "go_bubble_members_select" on go_bubble_members for select to anon, authenticated using (true);
drop policy if exists "go_bubble_members_insert" on go_bubble_members;
create policy "go_bubble_members_insert" on go_bubble_members for insert to anon, authenticated
  with check (account_id = go_current_account_id());
drop policy if exists "go_bubble_members_update" on go_bubble_members;
create policy "go_bubble_members_update" on go_bubble_members for update to anon, authenticated
  using (account_id = go_current_account_id()) with check (account_id = go_current_account_id());
drop policy if exists "go_bubble_members_delete" on go_bubble_members;
create policy "go_bubble_members_delete" on go_bubble_members for delete to anon, authenticated
  using (account_id = go_current_account_id());

-- Bin ich in derselben Bubble? (security definer: liest Mitglieder unabhängig von RLS)
create or replace function go_in_my_bubble(p_bubble uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_bubble is not null and exists (
    select 1 from go_bubble_members m
    where m.bubble_id = p_bubble and m.account_id = go_current_account_id()
  );
$$;
grant execute on function go_in_my_bubble(uuid) to anon, authenticated;

-- Zusätzliche Policies (werden mit den bestehenden ODER-verknüpft)
drop policy if exists "events_select_bubble" on events;
create policy "events_select_bubble" on events for select to anon, authenticated
  using (bubble_id is not null and coalesce(visibility, 'team') <> 'privat' and go_in_my_bubble(bubble_id));

drop policy if exists "event_rsvps_select_bubble" on event_rsvps;
create policy "event_rsvps_select_bubble" on event_rsvps for select to anon, authenticated
  using (exists (select 1 from events e where e.id = event_id and e.bubble_id is not null and go_in_my_bubble(e.bubble_id)));

do $$
begin
  if to_regclass('public.event_comments') is null then
    raise notice 'event_comments fehlt — Bubble-Policy für Kommentare übersprungen.';
    return;
  end if;
  execute 'drop policy if exists "event_comments_select_bubble" on event_comments';
  execute $pol$
    create policy "event_comments_select_bubble" on event_comments for select to anon, authenticated
    using (exists (select 1 from events e where e.id = event_id and e.bubble_id is not null and go_in_my_bubble(e.bubble_id)))
  $pol$;
end $$;
