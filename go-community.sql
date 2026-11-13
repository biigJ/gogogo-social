-- Community: Freundes-Links + Feed-Posts (Foto / 144-Zeichen-Text / Antwort)
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Freundes-Links sind paarweise gegenseitig (A↔B), wenn jemand die Nummer eingibt.
-- Nicht transitiv: A↔B und A↔C bedeuten nicht B↔C. Feed und Profilbilder
-- kommen nur aus direkten Links von account_id.
--
-- Storage: Community-Fotos nutzen den bestehenden Bucket "checkin-photos" (public),
-- Pfad community/<account-id>-<ts>.jpg — analog zur Check-in-App.
-- Optional: Bucket "go-avatars" aus go-account.sql anlegen (Profilfotos).
--
-- Bestehende DBs: zusätzlich go-friends-rename.sql ausführen (go_buddies → go_friends).

create table if not exists go_friends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  friend_id uuid not null references go_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (account_id, friend_id),
  check (account_id <> friend_id)
);

create index if not exists go_friends_account_idx on go_friends (account_id);
create index if not exists go_friends_friend_idx on go_friends (friend_id);

create table if not exists go_community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references go_accounts(id) on delete cascade,
  kind text not null check (kind in ('photo', 'text', 'reply')),
  body text check (body is null or char_length(body) <= 144),
  photo_url text,
  reply_to_id uuid references go_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists go_community_posts_author_created_idx
  on go_community_posts (author_id, created_at desc);

create index if not exists go_accounts_serial_idx
  on go_accounts (serial_number);

alter table go_friends enable row level security;
alter table go_community_posts enable row level security;

drop policy if exists "go_friends_select_anon" on go_friends;
create policy "go_friends_select_anon"
  on go_friends for select
  to anon, authenticated
  using (true);

drop policy if exists "go_friends_insert_anon" on go_friends;
create policy "go_friends_insert_anon"
  on go_friends for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_friends_delete_anon" on go_friends;
create policy "go_friends_delete_anon"
  on go_friends for delete
  to anon, authenticated
  using (true);

drop policy if exists "go_community_posts_select_anon" on go_community_posts;
create policy "go_community_posts_select_anon"
  on go_community_posts for select
  to anon, authenticated
  using (true);

drop policy if exists "go_community_posts_insert_anon" on go_community_posts;
create policy "go_community_posts_insert_anon"
  on go_community_posts for insert
  to anon, authenticated
  with check (true);
