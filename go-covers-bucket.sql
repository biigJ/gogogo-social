-- go-covers-bucket.sql — Speicher für Kurs-Coverbilder (Kurs-Editor → Coverbild)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Vorher lud der Editor in "go-avatars" hoch; diesen Bucket gibt es in Production nicht (Profilfotos liegen als Data-URL in der DB).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('go-covers', 'go-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "go_covers_select" on storage.objects;
create policy "go_covers_select" on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'go-covers');

drop policy if exists "go_covers_insert" on storage.objects;
create policy "go_covers_insert" on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'go-covers');

drop policy if exists "go_covers_update" on storage.objects;
create policy "go_covers_update" on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'go-covers')
  with check (bucket_id = 'go-covers');
