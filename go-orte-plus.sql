-- go-orte-plus.sql — Plus → Orte: Foto je Ort, Namensänderungen mit Admin-Freigabe, Nutzung je Ort.
-- Idempotent. Voraussetzung: go-workout-places.sql, go-admin-user-extras.sql (go_is_admin), go-covers-bucket.sql.

alter table go_workout_places add column if not exists photo_url text;
alter table go_workout_places add column if not exists photo_credit text;

-- Namensänderung: Nutzer schlagen vor, Admin gibt frei (dann gilt der Name überall)
create table if not exists go_place_renames (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references go_workout_places(id) on delete cascade,
  old_name text not null,
  new_name text not null check (length(trim(new_name)) between 2 and 80),
  requested_by uuid references go_accounts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists go_place_renames_place_idx on go_place_renames (place_id, status);
alter table go_place_renames enable row level security;
drop policy if exists go_place_renames_select on go_place_renames;
create policy go_place_renames_select on go_place_renames for select to anon, authenticated
  using (requested_by = go_current_account_id() or go_is_admin());
drop policy if exists go_place_renames_insert on go_place_renames;
create policy go_place_renames_insert on go_place_renames for insert to anon, authenticated
  with check (requested_by = go_current_account_id() and status = 'pending');

-- Nutzung je Ort (alle Events, nur Zahlen): Kategorien für die Filter Kraft / Ausdauer / Zirkeltraining
create or replace function public.go_place_usage()
returns table(name_key text, categories text[], n integer)
language sql stable security definer set search_path to 'public'
as $function$
  select lower(trim(e.location)),
         array_agg(distinct case when e.category = 'zirkel' then 'zirkel' when e.category = 'ausdauer' then 'ausdauer' when e.category = 'kraft' then 'kraft' end)
           filter (where e.category in ('zirkel', 'ausdauer', 'kraft')),
         count(*)::int
  from events e
  where coalesce(trim(e.location), '') <> '' and e.status <> 'ausgefallen'
    and e.starts_at > now() - interval '180 days'
  group by 1;
$function$;
grant execute on function public.go_place_usage() to anon, authenticated;

-- Admin: Orte mit Nutzung, Personen („Meine Orte“) und offenen Namensänderungen
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
                 from go_place_renames r where r.place_id = p.id and r.status = 'pending'), '[]'::jsonb)
    ) order by p.name)
    from go_workout_places p
  ), '[]'::jsonb);
end $function$;
grant execute on function public.go_admin_places() to anon, authenticated;

-- Admin: Ort umbenennen (direkt oder per Freigabe). Name gilt dann auch in Events und „Meine Orte“.
create or replace function public.go_admin_rename_place(p_place uuid, p_name text, p_rename uuid default null, p_ok boolean default true)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_old text;
  v_new text := trim(coalesce(p_name, ''));
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  if p_rename is not null and not p_ok then
    update go_place_renames set status = 'rejected', decided_at = now() where id = p_rename;
    return 'rejected';
  end if;
  if p_rename is not null then
    select new_name into v_new from go_place_renames where id = p_rename;
  end if;
  if length(v_new) < 2 then raise exception 'name'; end if;
  select name into v_old from go_workout_places where id = p_place;
  if v_old is null then raise exception 'place'; end if;
  update go_workout_places set name = v_new where id = p_place;
  update events set location = v_new where lower(trim(location)) = lower(trim(v_old));
  update go_accounts a set workout_places = (
      select jsonb_agg(case when x = to_jsonb(v_old) then to_jsonb(v_new) else x end) from jsonb_array_elements(a.workout_places) x),
    workout_place = case when a.workout_place = v_old then v_new else a.workout_place end
    where a.workout_places @> to_jsonb(array[v_old]);
  if p_rename is not null then
    update go_place_renames set status = 'approved', decided_at = now() where id = p_rename;
  end if;
  update go_place_renames set status = 'rejected', decided_at = now() where place_id = p_place and status = 'pending' and id is distinct from p_rename;
  return 'renamed';
end $function$;
grant execute on function public.go_admin_rename_place(uuid, text, uuid, boolean) to anon, authenticated;

-- Admin: Foto eines Orts setzen
create or replace function public.go_admin_place_photo(p_place uuid, p_url text, p_credit text default null)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update go_workout_places set photo_url = nullif(trim(p_url), ''), photo_credit = nullif(trim(coalesce(p_credit, '')), '') where id = p_place;
  return 'ok';
end $function$;
grant execute on function public.go_admin_place_photo(uuid, text, text) to anon, authenticated;
