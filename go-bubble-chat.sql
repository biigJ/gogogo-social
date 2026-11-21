-- go-bubble-chat.sql — Bubble-Chat: Fotos/Videos, Antworten, Melden; Admin kann Nutzer sperren
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-bubbles.sql, go-admin.sql.
--
-- go_bubble_messages: media_url/media_kind (Foto/Video), reply_to (Antwort auf Nachricht), hidden_at (gesperrt)
-- go_accounts.blocked_at: gesperrte Nutzer können nicht mehr schreiben, ihre Nachrichten sind ausgeblendet
-- go_reports: Meldungen (Admin → Nachrichten), RPCs go_admin_reports / go_admin_block_user / go_admin_report_done
-- Speicher: Bucket go-chat (öffentlich, max. 50 MB je Datei, Fotos und Videos)

alter table go_bubble_messages add column if not exists media_url text;
alter table go_bubble_messages add column if not exists media_kind text;
alter table go_bubble_messages add column if not exists reply_to uuid references go_bubble_messages(id) on delete set null;
alter table go_bubble_messages add column if not exists hidden_at timestamptz;
-- Nur Foto/Video ohne Text erlaubt
alter table go_bubble_messages drop constraint if exists go_bubble_messages_body_check;
alter table go_bubble_messages drop constraint if exists go_bubble_messages_body_media_check;
alter table go_bubble_messages add constraint go_bubble_messages_body_media_check
  check (length(body) <= 2000 and (length(trim(body)) > 0 or media_url is not null));

alter table go_accounts add column if not exists blocked_at timestamptz;

create or replace function go_is_blocked(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from go_accounts a where a.id = p_id and a.blocked_at is not null);
$$;
grant execute on function go_is_blocked(uuid) to anon, authenticated;

drop policy if exists "go_bubble_messages_select" on go_bubble_messages;
create policy "go_bubble_messages_select" on go_bubble_messages for select to anon, authenticated
  using (go_in_my_bubble(bubble_id) and hidden_at is null);
drop policy if exists "go_bubble_messages_insert" on go_bubble_messages;
create policy "go_bubble_messages_insert" on go_bubble_messages for insert to anon, authenticated
  with check (author_id = go_current_account_id() and go_in_my_bubble(bubble_id) and not go_is_blocked(author_id));

-- Meldungen
create table if not exists go_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'bubble_message',
  target_id uuid,
  author_id uuid references go_accounts(id) on delete cascade,
  reporter_id uuid references go_accounts(id) on delete set null,
  body text,
  media_url text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists go_reports_open_idx on go_reports (created_at desc) where done_at is null;
alter table go_reports enable row level security;
drop policy if exists "go_reports_insert" on go_reports;
create policy "go_reports_insert" on go_reports for insert to anon, authenticated
  with check (reporter_id = go_current_account_id());
drop policy if exists "go_reports_admin" on go_reports;
create policy "go_reports_admin" on go_reports for select to anon, authenticated using (go_is_admin());

create or replace function go_admin_reports()
returns table (
  id uuid, kind text, target_id uuid, body text, media_url text, created_at timestamptz,
  author_id uuid, author_name text, author_photo text, author_since timestamptz, author_blocked_at timestamptz,
  author_messages bigint, author_reports bigint, reporter_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.kind, r.target_id, r.body, r.media_url, r.created_at,
         a.id, a.name, a.photo_url, a.created_at, a.blocked_at,
         (select count(*) from go_bubble_messages m where m.author_id = a.id),
         (select count(*) from go_reports x where x.author_id = a.id),
         rp.name
  from go_reports r
  left join go_accounts a on a.id = r.author_id
  left join go_accounts rp on rp.id = r.reporter_id
  where go_is_admin() and r.done_at is null
  order by r.created_at desc
  limit 100;
$$;
grant execute on function go_admin_reports() to anon, authenticated;

-- Sperren: Konto gesperrt, alle Bubble-Nachrichten ausgeblendet, offene Meldungen zu der Person erledigt
create or replace function go_admin_block_user(p_id uuid, p_block boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'nur Admin'; end if;
  if p_block then
    update go_accounts set blocked_at = now() where id = p_id;
    update go_bubble_messages set hidden_at = now() where author_id = p_id and hidden_at is null;
    update go_reports set done_at = now() where author_id = p_id and done_at is null;
    return 'blocked';
  end if;
  update go_accounts set blocked_at = null where id = p_id;
  update go_bubble_messages set hidden_at = null where author_id = p_id;
  return 'unblocked';
end $$;
grant execute on function go_admin_block_user(uuid, boolean) to anon, authenticated;

create or replace function go_admin_report_done(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update go_reports set done_at = now() where id = p_id and go_is_admin();
$$;
grant execute on function go_admin_report_done(uuid) to anon, authenticated;

-- Speicher für Chat-Fotos und -Videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('go-chat', 'go-chat', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "go_chat_select" on storage.objects;
create policy "go_chat_select" on storage.objects for select to anon, authenticated using (bucket_id = 'go-chat');
drop policy if exists "go_chat_insert" on storage.objects;
create policy "go_chat_insert" on storage.objects for insert to anon, authenticated with check (bucket_id = 'go-chat');
