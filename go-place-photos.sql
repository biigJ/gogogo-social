-- go-place-photos.sql — Plus → Orte: Nutzer laden Fotos zu Orten hoch.
-- Vor der Freigabe sieht nur der Hochlader das Foto, nach Freigabe im Admin alle.
-- Idempotent. Voraussetzung: go-orte-plus.sql (go_workout_places, go_admin_places), go_is_admin, go_current_account_id.

create table if not exists go_place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references go_workout_places(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  added_by uuid references go_accounts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists go_place_photos_place_idx on go_place_photos (place_id, status);
alter table go_place_photos enable row level security;

drop policy if exists go_place_photos_select on go_place_photos;
create policy go_place_photos_select on go_place_photos for select to anon, authenticated
  using (status = 'approved' or added_by = go_current_account_id() or go_is_admin());
drop policy if exists go_place_photos_insert on go_place_photos;
create policy go_place_photos_insert on go_place_photos for insert to anon, authenticated
  with check (added_by = go_current_account_id() and status = 'pending');
-- eigenes, noch nicht freigegebenes Foto zurückziehen
drop policy if exists go_place_photos_delete on go_place_photos;
create policy go_place_photos_delete on go_place_photos for delete to anon, authenticated
  using (added_by = go_current_account_id() and status = 'pending');

-- Admin: Foto freigeben oder ablehnen. Hat der Ort noch kein Titelbild, wird das freigegebene Foto Titelbild.
create or replace function public.go_admin_place_photo_review(p_photo uuid, p_ok boolean)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_place uuid;
  v_url text;
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update go_place_photos set status = case when p_ok then 'approved' else 'rejected' end, decided_at = now()
    where id = p_photo returning place_id, url into v_place, v_url;
  if v_place is null then raise exception 'photo'; end if;
  if p_ok then
    update go_workout_places set photo_url = v_url, photo_credit = null where id = v_place and coalesce(photo_url, '') = '';
  end if;
  return case when p_ok then 'approved' else 'rejected' end;
end $function$;
grant execute on function public.go_admin_place_photo_review(uuid, boolean) to anon, authenticated;

-- Admin-Liste: offene Fotos je Ort ergänzen (Rest wie go-orte-plus.sql)
create or replace function public.go_admin_places()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'lat', p.lat, 'lng', p.lng, 'photo_url', p.photo_url, 'photo_credit', p.photo_credit,
      'created_at', p.created_at,
      'creator', (select a.name from go_accounts a where a.id = p.created_by),
      'events', (select count(*) from events e where lower(trim(e.location)) = lower(trim(p.name)) and e.status <> 'ausgefallen'),
      'last', (select max(e.starts_at) from events e where lower(trim(e.location)) = lower(trim(p.name)) and e.starts_at <= now()),
      'people', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.name)
                 from go_accounts a where a.workout_places @> to_jsonb(array[p.name])), '[]'::jsonb),
      'renames', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'new_name', r.new_name, 'by', (select a.name from go_accounts a where a.id = r.requested_by), 'at', r.created_at) order by r.created_at)
                 from go_place_renames r where r.place_id = p.id and r.status = 'pending'), '[]'::jsonb),
      'photos', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'url', f.url, 'by', (select a.name from go_accounts a where a.id = f.added_by), 'at', f.created_at) order by f.created_at)
                 from go_place_photos f where f.place_id = p.id and f.status = 'pending'), '[]'::jsonb)
    ) order by p.name)
    from go_workout_places p
  ), '[]'::jsonb);
end $function$;
grant execute on function public.go_admin_places() to anon, authenticated;
