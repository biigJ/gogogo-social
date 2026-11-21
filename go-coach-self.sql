-- go-coach-self.sql — „Ich als Coach“: Selbst-Anmeldung (unverifiziert) und blaues c (verifiziert durch Admin)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin.sql.
--
-- go_accounts.coach_self_at      selbst als Coach angemeldet (Plus → Ich als Coach → Anmelden): Gruppe leiten, Challenges, Orte
-- go_accounts.coach_verified_at  blaues c: Admin hat bestätigt (gogogo-Zertifikat) → is_trainer, Coachees möglich
-- Beide Spalten ändern nur die Funktionen unten oder Admins (Trigger wie bei is_trainer).

alter table go_accounts add column if not exists coach_self_at timestamptz;
alter table go_accounts add column if not exists coach_verified_at timestamptz;

create or replace function go_accounts_guard_coach()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or go_is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.coach_self_at := null;
    new.coach_verified_at := null;
    return new;
  end if;
  new.coach_self_at := old.coach_self_at;
  new.coach_verified_at := old.coach_verified_at;
  return new;
end $$;

drop trigger if exists go_accounts_guard_coach on go_accounts;
create trigger go_accounts_guard_coach
  before insert or update on go_accounts
  for each row execute function go_accounts_guard_coach();

-- Selbst als Coach anmelden (Einverständnis im Dialog)
create or replace function go_coach_self_signup()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  v_at timestamptz;
begin
  if v_me is null then raise exception 'login'; end if;
  update go_accounts set coach_self_at = coalesce(coach_self_at, now()) where id = v_me
  returning coach_self_at into v_at;
  return v_at;
end $$;
grant execute on function go_coach_self_signup() to anon, authenticated;

-- Admin: blaues c geben (auch Coach-Rolle mit Coachees) oder entziehen
create or replace function go_admin_verify_coach(p_account uuid, p_on boolean default true)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'Nur Admins'; end if;
  if p_on then
    update go_accounts
    set coach_verified_at = coalesce(coach_verified_at, now()),
        coach_self_at = coalesce(coach_self_at, now()),
        is_trainer = true
    where id = p_account;
  else
    update go_accounts set coach_verified_at = null, is_trainer = false where id = p_account;
  end if;
  return p_on;
end $$;
grant execute on function go_admin_verify_coach(uuid, boolean) to anon, authenticated;

-- Joscha bekommt das blaue c
update go_accounts
set coach_verified_at = coalesce(coach_verified_at, now()), coach_self_at = coalesce(coach_self_at, now())
where id = '2d3ab029-0a5f-4388-8da7-52501a87dc8c';
