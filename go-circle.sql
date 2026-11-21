-- go-circle.sql — Circle-Foto und persönliche Circle-Stempelkarte umziehen
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-challenges.sql.
--
-- go_circle_photos         Foto je Circle (FFC-Gruppe, group_id als Text). Alle lesen; setzen über go_set_circle_photo.
--                          Wer das Foto zuerst setzt (in der App: Gründer des Circles), darf es später ändern; Admin immer.
-- go_set_circle_photo      Foto setzen/ändern
-- go_move_circle_card      eine persönliche Circle-Stempelkarte: zieht mit ihren Stempeln in einen anderen Circle um

create table if not exists go_circle_photos (
  group_id text primary key,
  photo_url text not null,
  updated_by uuid references go_accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table go_circle_photos enable row level security;
drop policy if exists "go_circle_photos_select" on go_circle_photos;
create policy "go_circle_photos_select" on go_circle_photos for select to anon, authenticated using (true);
-- Schreiben nur über die Funktion

create or replace function go_set_circle_photo(p_group text, p_url text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  owner uuid;
begin
  if me is null or coalesce(trim(p_group), '') = '' or coalesce(p_url, '') = '' then raise exception 'login'; end if;
  select updated_by into owner from go_circle_photos where group_id = trim(p_group);
  if found and owner is not null and owner <> me and not go_is_admin() then raise exception 'not_owner'; end if;
  insert into go_circle_photos (group_id, photo_url, updated_by, updated_at)
  values (trim(p_group), p_url, me, now())
  on conflict (group_id) do update
    set photo_url = excluded.photo_url, updated_at = now(),
        updated_by = coalesce(go_circle_photos.updated_by, excluded.updated_by);
  return 'ok';
end $$;
grant execute on function go_set_circle_photo(text, text) to anon, authenticated;

create or replace function go_move_circle_card(p_circle text, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  v_ref text := trim(coalesce(p_circle, ''));
  v_name text := coalesce(nullif(trim(p_name), ''), 'Circle');
  keep uuid;
begin
  if me is null or v_ref = '' then raise exception 'login'; end if;
  -- die Karte mit den meisten Stempeln bleibt und zieht um, weitere Circle-Karten fallen weg
  select id into keep from go_stamp_links
  where account_id = me and kind = 'circle'
  order by stamps desc, (ref = v_ref) desc, created_at asc limit 1;
  if keep is null then
    insert into go_stamp_links (account_id, kind, ref, name, invited_by, status)
    values (me, 'circle', v_ref, v_name, me, 'linked');
    return 'linked';
  end if;
  delete from go_stamp_links where account_id = me and kind = 'circle' and id <> keep;
  update go_stamp_links set ref = v_ref, name = v_name, status = 'linked' where id = keep;
  return 'moved';
end $$;
grant execute on function go_move_circle_card(text, text) to anon, authenticated;
