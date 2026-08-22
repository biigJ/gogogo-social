-- Kalender-Sync Einstellungen (Google / Apple) + Feed-Bucket
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists calendar_provider text;

alter table go_accounts
  add column if not exists calendar_privacy_accepted boolean not null default false;

alter table go_accounts
  add column if not exists calendar_subscribed boolean not null default false;

-- calendar_provider: 'google' | 'apple' | null

-- Öffentlicher Bucket für ICS-Feeds (direkter Kalender-Abo-Sync)
insert into storage.buckets (id, name, public)
values ('go-calendars', 'go-calendars', true)
on conflict (id) do update set public = true;

drop policy if exists "go_calendars_select" on storage.objects;
create policy "go_calendars_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'go-calendars');

drop policy if exists "go_calendars_insert" on storage.objects;
create policy "go_calendars_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'go-calendars');

drop policy if exists "go_calendars_update" on storage.objects;
create policy "go_calendars_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'go-calendars')
  with check (bucket_id = 'go-calendars');
