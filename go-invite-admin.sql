-- Admin: Codes pausieren / löschen
-- Im Supabase SQL Editor ausführen (Projekt agpysewcsakdpmpftndp).

alter table go_invite_codes
  add column if not exists paused boolean not null default false;

drop policy if exists "go_invite_codes_update_anon" on go_invite_codes;
create policy "go_invite_codes_update_anon"
  on go_invite_codes for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_invite_codes_delete_anon" on go_invite_codes;
create policy "go_invite_codes_delete_anon"
  on go_invite_codes for delete
  to anon, authenticated
  using (true);

create or replace function pause_go_invite(p_id uuid, p_paused boolean)
returns go_invite_codes
language sql
security definer
set search_path = public
as $$
  update go_invite_codes
  set paused = coalesce(p_paused, true)
  where id = p_id
  returning *;
$$;

create or replace function delete_go_invite(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from go_invite_codes where id = p_id;
$$;

grant execute on function pause_go_invite(uuid, boolean) to anon, authenticated;
grant execute on function delete_go_invite(uuid) to anon, authenticated;
