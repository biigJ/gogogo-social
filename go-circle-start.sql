-- go-circle-start.sql — Startdatum je Circle: Leaderboard zählt erst ab Gründung
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-circle-events.sql, go-admin-circles.sql.
-- Bestehende Circles behalten created_at = null (keine Einschränkung). Neue Zeilen bekommen den Zeitpunkt,
-- an dem der Circle zum ersten Mal in gogogo auftaucht (beim Gründen in der App sofort).

alter table go_circles add column if not exists created_at timestamptz;
alter table go_circles alter column created_at set default now();

-- Circle-Foto: auch der in gogogo eingetragene Coach des Circles (go_circles.owner_id) darf es ändern
create or replace function go_set_circle_photo(p_group text, p_url text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  setter uuid;
begin
  if me is null or coalesce(trim(p_group), '') = '' or coalesce(p_url, '') = '' then raise exception 'login'; end if;
  select updated_by into setter from go_circle_photos where group_id = trim(p_group);
  if found and setter is not null and setter <> me and not go_is_admin()
     and not exists (select 1 from go_circles c where c.group_id = trim(p_group) and c.owner_id = me) then
    raise exception 'not_owner';
  end if;
  insert into go_circle_photos (group_id, photo_url, updated_by, updated_at)
  values (trim(p_group), p_url, me, now())
  on conflict (group_id) do update
    set photo_url = excluded.photo_url, updated_at = now(),
        updated_by = coalesce(go_circle_photos.updated_by, excluded.updated_by);
  return 'ok';
end $$;
grant execute on function go_set_circle_photo(text, text) to anon, authenticated;
