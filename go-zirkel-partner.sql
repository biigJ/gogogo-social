-- go-zirkel-partner.sql
-- Zirkel Double: jede Zusage kann einen Partner haben (Freund oder nur Name).
-- Idempotent. Voraussetzung: go-courses-support.sql (event_rsvps).
--
--   event_rsvps.partner_id     Partner-Account (optional)
--   event_rsvps.partner_name   Partnername, wenn kein Account
--   go_set_zirkel_partner(...) Zusage + Partner setzen; hat der Partner schon
--                              zugesagt und noch keinen Partner, wird er gegenseitig verknüpft

alter table event_rsvps
  add column if not exists partner_id uuid references go_accounts(id) on delete set null;

alter table event_rsvps
  add column if not exists partner_name text;

create or replace function go_set_zirkel_partner(
  p_event_id uuid,
  p_user_id uuid,
  p_partner_id uuid,
  p_partner_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := coalesce(go_current_account_id(), p_user_id);
  v_old uuid;
begin
  if v_me is null then
    return 'no_user';
  end if;
  if go_current_account_id() is not null and p_user_id is not null and go_current_account_id() <> p_user_id then
    return 'not_yours';
  end if;

  -- alte Verknüpfung lösen
  select partner_id into v_old from event_rsvps where event_id = p_event_id and user_id = v_me;
  if v_old is not null and v_old is distinct from p_partner_id then
    update event_rsvps set partner_id = null
    where event_id = p_event_id and user_id = v_old and partner_id = v_me;
  end if;

  insert into event_rsvps (event_id, user_id, status, partner_id, partner_name)
  values (p_event_id, v_me, 'zugesagt', p_partner_id, nullif(trim(coalesce(p_partner_name, '')), ''))
  on conflict (event_id, user_id) do update
    set status = 'zugesagt',
        partner_id = excluded.partner_id,
        partner_name = excluded.partner_name;

  -- gegenseitig verknüpfen, wenn der Partner schon zugesagt hat und frei ist
  if p_partner_id is not null then
    update event_rsvps
    set partner_id = v_me, partner_name = null
    where event_id = p_event_id and user_id = p_partner_id and partner_id is null;
  end if;

  return 'ok';
end;
$$;

grant execute on function go_set_zirkel_partner(uuid, uuid, uuid, text) to anon, authenticated;

-- Kurzcheck
select
  count(*) as zusagen,
  count(*) filter (where partner_id is not null or partner_name is not null) as mit_partner
from event_rsvps;
