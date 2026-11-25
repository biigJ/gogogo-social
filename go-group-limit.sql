-- go-group-limit.sql — Wie viele Gruppen ein Nutzer gründen darf (1 oder 5), Admin vergibt die Rechte.
-- go_accounts.max_groups (Standard 1), RPC go_admin_set_max_groups, Prüfung beim Anlegen einer Gruppe.
-- Die vier Admins bekommen direkt 5. Idempotent.

alter table go_accounts add column if not exists max_groups integer not null default 1;
alter table go_accounts drop constraint if exists go_accounts_max_groups_chk;
alter table go_accounts add constraint go_accounts_max_groups_chk check (max_groups between 1 and 5);

-- Admin: 1 oder 5 Gruppen
create or replace function public.go_admin_set_max_groups(p_account uuid, p_n integer)
returns integer
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  update go_accounts set max_groups = case when p_n >= 5 then 5 else 1 end where id = p_account;
  return case when p_n >= 5 then 5 else 1 end;
end $function$;
grant execute on function public.go_admin_set_max_groups(uuid, integer) to anon, authenticated;

-- Neue Gruppe: höchstens max_groups eigene Gruppen (created_by)
create or replace function public.go_groups_limit()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_max integer;
  v_have integer;
begin
  if new.created_by is null then return new; end if;
  select coalesce(max_groups, 1) into v_max from go_accounts where id = new.created_by;
  select count(*) into v_have from groups where created_by = new.created_by;
  if v_have >= coalesce(v_max, 1) then
    raise exception 'group_limit %', coalesce(v_max, 1) using errcode = 'P0001';
  end if;
  return new;
end $function$;
drop trigger if exists go_groups_limit on groups;
create trigger go_groups_limit before insert on groups for each row execute function public.go_groups_limit();

-- Admins: 5 Gruppen
update go_accounts set max_groups = 5 where is_admin and max_groups < 5;
