-- go-admin-rollen-log.sql — Protokoll: jede Änderung von Admin-Rechten (is_admin) wird mit Zeit und Auslöser gespeichert
-- Idempotent. Voraussetzung: go-admin-tickets.sql (go_is_admin, go_current_account_id).
-- Admin-Rechte stehen in go_accounts.is_admin (Datenbank) und bleiben, bis Joscha sie entzieht.
-- Ändern dürfen sie nur der Inhaber (go_admin_set_admin) oder jemand direkt in Supabase; der Guard-Trigger blockt alle anderen.

create table if not exists go_admin_role_log (
  id bigserial primary key,
  account_id uuid not null,
  was_admin boolean,
  is_admin boolean,
  changed_by uuid,
  via text,
  at timestamptz not null default now()
);
alter table go_admin_role_log enable row level security;
drop policy if exists "admin_role_log_read" on go_admin_role_log;
create policy "admin_role_log_read" on go_admin_role_log for select to anon, authenticated using (go_is_admin());

create or replace function go_log_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_by uuid;
begin
  if new.is_admin is distinct from old.is_admin then
    begin v_by := go_current_account_id(); exception when others then v_by := null; end;
    insert into go_admin_role_log (account_id, was_admin, is_admin, changed_by, via)
    values (new.id, old.is_admin, new.is_admin, v_by, current_user);
  end if;
  return new;
end $$;

drop trigger if exists go_admin_role_log_trg on go_accounts;
create trigger go_admin_role_log_trg after update of is_admin on go_accounts
  for each row execute function go_log_admin_role();
