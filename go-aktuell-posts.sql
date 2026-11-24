-- go-aktuell-posts.sql — Nachrichten aus Aktuell (Sprechblase) an einen Kreis: Nur ich, Freunde, Gruppe, Circle, Coachees, Alles
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-bubble-chat.sql (go_is_blocked, go_reports).
-- Bubble-Nachrichten bleiben in go_bubble_messages. Empfänger werden beim Senden aufgelöst (recipients),
-- sehen dürfen: Autor und Empfänger.

create table if not exists go_aktuell_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references go_accounts(id) on delete cascade,
  audience text not null default 'ich',
  audience_id text,
  recipients uuid[] not null default '{}',
  body text not null default '',
  media_url text,
  media_kind text,
  reply_to uuid references go_aktuell_posts(id) on delete set null,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  constraint go_aktuell_posts_audience_check check (audience in ('ich', 'team', 'gruppe', 'circle', 'coach', 'alles')),
  constraint go_aktuell_posts_body_check check (length(body) <= 2000 and (length(trim(body)) > 0 or media_url is not null))
);

create index if not exists go_aktuell_posts_author_idx on go_aktuell_posts (author_id, created_at desc);
create index if not exists go_aktuell_posts_recipients_idx on go_aktuell_posts using gin (recipients);

alter table go_aktuell_posts enable row level security;

drop policy if exists "go_aktuell_posts_select" on go_aktuell_posts;
create policy "go_aktuell_posts_select" on go_aktuell_posts for select to anon, authenticated
  using (hidden_at is null and (author_id = go_current_account_id() or go_current_account_id() = any (recipients)));

drop policy if exists "go_aktuell_posts_insert" on go_aktuell_posts;
create policy "go_aktuell_posts_insert" on go_aktuell_posts for insert to anon, authenticated
  with check (author_id = go_current_account_id() and not go_is_blocked(author_id));

drop policy if exists "go_aktuell_posts_delete" on go_aktuell_posts;
create policy "go_aktuell_posts_delete" on go_aktuell_posts for delete to anon, authenticated
  using (author_id = go_current_account_id());

grant select, insert, delete on go_aktuell_posts to anon, authenticated;
