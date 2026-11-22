-- go-coachee-requests.sql — Coach wählen braucht die Zustimmung des Coaches
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-trainer.sql, go-friend-requests.sql.
--
-- Ablauf: Nutzer tippt bei einem Coach auf „Wählen“ → go_request_coachee legt eine Anfrage an (pending).
-- Der Coach sieht sie beim Öffnen von Aktuell und am Herz, tippt Annehmen oder Ablehnen.
-- Annehmen (go_answer_coachee_request) setzt trainer_id des Nutzers.
-- Direktes Setzen von trainer_id durch den Nutzer wird blockiert (Trigger); Coach entfernen (null) bleibt erlaubt.
-- Admins und Funktionen mit security definer (z. B. go_request_coach „Individuell“) sind nicht betroffen.

create table if not exists go_coachee_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  coach_id uuid not null references go_accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (user_id, coach_id),
  check (user_id <> coach_id)
);
create index if not exists go_coachee_requests_coach_idx on go_coachee_requests (coach_id, status);

alter table go_coachee_requests enable row level security;
drop policy if exists "go_coachee_requests_select" on go_coachee_requests;
create policy "go_coachee_requests_select" on go_coachee_requests for select to anon, authenticated
  using (user_id = go_current_account_id() or coach_id = go_current_account_id());
-- zurückziehen: nur der Nutzer selbst
drop policy if exists "go_coachee_requests_update_user" on go_coachee_requests;
create policy "go_coachee_requests_update_user" on go_coachee_requests for update to anon, authenticated
  using (user_id = go_current_account_id()) with check (user_id = go_current_account_id() and status = 'withdrawn');

-- Anfrage stellen (ersetzt eine frühere offene Anfrage an einen anderen Coach)
create or replace function go_request_coachee(p_coach uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
begin
  if me is null or p_coach is null or p_coach = me then raise exception 'Anfrage nicht möglich'; end if;
  if exists (select 1 from go_accounts where id = me and trainer_id = p_coach) then return 'already'; end if;
  update go_coachee_requests set status = 'withdrawn', decided_at = now()
   where user_id = me and coach_id <> p_coach and status = 'pending';
  insert into go_coachee_requests (user_id, coach_id, status, created_at, decided_at)
  values (me, p_coach, 'pending', now(), null)
  on conflict (user_id, coach_id) do update set status = 'pending', created_at = now(), decided_at = null;
  return 'requested';
end $$;
grant execute on function go_request_coachee(uuid) to anon, authenticated;

-- Annehmen / Ablehnen durch den Coach
create or replace function go_answer_coachee_request(p_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r go_coachee_requests%rowtype;
  me uuid := go_current_account_id();
begin
  select * into r from go_coachee_requests where id = p_id;
  if not found or me is null or r.coach_id <> me then raise exception 'Anfrage nicht gefunden'; end if;
  if r.status <> 'pending' then return r.status; end if;
  if p_accept then
    update go_accounts set trainer_id = r.coach_id where id = r.user_id;
    update go_coachee_requests set status = 'accepted', decided_at = now() where id = p_id;
    return 'accepted';
  end if;
  update go_coachee_requests set status = 'declined', decided_at = now() where id = p_id;
  return 'declined';
end $$;
grant execute on function go_answer_coachee_request(uuid, boolean) to anon, authenticated;

-- Nutzer dürfen trainer_id nicht selbst auf einen Coach setzen (nur entfernen)
create or replace function go_guard_trainer_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.trainer_id is not null
     and new.trainer_id is distinct from old.trainer_id
     and current_user in ('anon', 'authenticated')
     and not coalesce(go_is_admin(), false) then
    raise exception 'coach_request_required';
  end if;
  return new;
end $$;
drop trigger if exists go_guard_trainer_id on go_accounts;
create trigger go_guard_trainer_id before update of trainer_id on go_accounts
  for each row execute function go_guard_trainer_id();
