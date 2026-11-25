-- go-circle-about.sql — Circle-Seite: Beschreibung (Kreise → Circle). Nur der Coach des Circles (go_circles.owner_id) oder Admin.
-- Idempotent. Voraussetzung: go-circle-events.sql (go_circles), go-admin.sql (go_is_admin).
--
-- go_circles.description            Text unter dem Namen auf der Circle-Seite
-- go_save_circle_about(group, text) speichern (leer = löschen); legt die Zeile an, wenn es noch keine gibt (wer zuerst speichert, ist Coach)

alter table go_circles add column if not exists description text;

create or replace function go_save_circle_about(p_group text, p_text text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
  owner uuid;
begin
  if me is null or coalesce(trim(p_group), '') = '' then raise exception 'login'; end if;
  select c.owner_id into owner from go_circles c where c.group_id = trim(p_group);
  if found and owner is not null and owner <> me and not go_is_admin() then raise exception 'not_owner'; end if;
  insert into go_circles (group_id, owner_id, description, updated_at)
  values (trim(p_group), me, nullif(left(trim(coalesce(p_text, '')), 600), ''), now())
  on conflict (group_id) do update
    set description = excluded.description,
        owner_id = coalesce(go_circles.owner_id, excluded.owner_id),
        updated_at = now();
  return 'ok';
end $$;
revoke all on function go_save_circle_about(text, text) from public;
grant execute on function go_save_circle_about(text, text) to anon, authenticated;
