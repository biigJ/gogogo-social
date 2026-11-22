-- go-admin-owner.sql — Inhaber-Schutz: Joschas Admin-Rechte kann niemand entziehen, auch er selbst nicht.
-- Admin-Rechte geben und anderen entziehen darf nur der Inhaber.
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin-tickets.sql.

create or replace function go_owner_id()
returns uuid
language sql
immutable
as $$ select '2d3ab029-0a5f-4388-8da7-52501a87dc8c'::uuid $$;

create or replace function go_admin_set_admin(p_account uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not_allowed'; end if;
  if not coalesce(p_on, false) and p_account = go_owner_id() then raise exception 'owner'; end if;
  if go_current_account_id() is distinct from go_owner_id() then raise exception 'only_owner'; end if;
  update go_accounts set is_admin = coalesce(p_on, false) where id = p_account;
end $$;
grant execute on function go_admin_set_admin(uuid, boolean) to anon, authenticated;

-- auch direkte Änderungen und Löschen abfangen (Tabellen-Ebene, gilt für jeden Weg)
create or replace function go_protect_owner()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.id = go_owner_id() then raise exception 'owner'; end if;
    return old;
  end if;
  if old.id = go_owner_id() and (not coalesce(new.is_admin, false) or new.deleted_at is not null) then
    raise exception 'owner';
  end if;
  return new;
end $$;

drop trigger if exists go_protect_owner_trg on go_accounts;
create trigger go_protect_owner_trg before update or delete on go_accounts
  for each row execute function go_protect_owner();

update go_accounts set is_admin = true where id = go_owner_id() and not coalesce(is_admin, false);
