-- Community: Buddy-Links + Feed-Posts (Foto / 144-Zeichen-Text / Antwort)
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Buddy-Links sind einseitig: account_id sieht buddy_id in der Community,
-- nicht umgekehrt — bis buddy_id die Nummer von account_id ebenfalls eingibt.
--
-- Storage: Community-Fotos nutzen den bestehenden Bucket "checkin-photos" (public),
-- Pfad community/<account-id>-<ts>.jpg — analog zur Check-in-App.
-- Optional: Bucket "go-avatars" aus go-account.sql anlegen (Profilfotos).

create table if not exists go_buddies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  buddy_id uuid not null references go_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (account_id, buddy_id),
  check (account_id <> buddy_id)
);

create index if not exists go_buddies_account_idx on go_buddies (account_id);
create index if not exists go_buddies_buddy_idx on go_buddies (buddy_id);

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

alter table go_buddies enable row level security;
alter table go_community_posts enable row level security;

drop policy if exists "go_buddies_select_anon" on go_buddies;
create policy "go_buddies_select_anon"
  on go_buddies for select
  to anon, authenticated
  using (true);

drop policy if exists "go_buddies_insert_anon" on go_buddies;
create policy "go_buddies_insert_anon"
  on go_buddies for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_buddies_delete_anon" on go_buddies;
create policy "go_buddies_delete_anon"
  on go_buddies for delete
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
