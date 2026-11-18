-- go-coach-request.sql — „Individuell“: Nutzer fragt einen Coach an und wird sofort Coachee
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin.sql.
--
-- go_coach_requests: Nachricht (max. 200 Zeichen) + Einverständnis WhatsApp / Plan + Aktuell-Nachricht.
-- go_request_coach(): setzt trainer_id des Nutzers auf den Coach und legt die Anfrage an.
-- Der Coach sieht offene Anfragen beim Öffnen der App (seen_at leer) und im Coach-Portal über „Analyse“.

create table if not exists go_coach_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  coach_id uuid not null references go_accounts(id) on delete cascade,
  message text check (char_length(message) <= 200),
  consent_whatsapp boolean not null default false,
  consent_plan boolean not null default false,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists go_coach_requests_coach_idx on go_coach_requests (coach_id, seen_at);

alter table go_coach_requests enable row level security;
drop policy if exists "go_coach_requests_select" on go_coach_requests;
create policy "go_coach_requests_select" on go_coach_requests for select to anon, authenticated
  using (user_id = go_current_account_id() or coach_id = go_current_account_id() or go_is_admin());
drop policy if exists "go_coach_requests_update" on go_coach_requests;
create policy "go_coach_requests_update" on go_coach_requests for update to anon, authenticated
  using (coach_id = go_current_account_id()) with check (coach_id = go_current_account_id());

create or replace function go_request_coach(p_coach uuid, p_message text, p_whatsapp boolean, p_plan boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  v_id uuid;
begin
  if v_me is null then raise exception 'login'; end if;
  if v_me = p_coach then raise exception 'self'; end if;
  if not exists (select 1 from go_accounts where id = p_coach and is_trainer) then
    raise exception 'not a coach';
  end if;
  update go_accounts set trainer_id = p_coach where id = v_me;
  insert into go_coach_requests (user_id, coach_id, message, consent_whatsapp, consent_plan)
  values (v_me, p_coach, left(coalesce(p_message, ''), 200), coalesce(p_whatsapp, false), coalesce(p_plan, false))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
grant execute on function go_request_coach(uuid, text, boolean, boolean) to anon, authenticated;
