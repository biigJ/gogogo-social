-- go-admin-nutzer.sql — Admin → Nutzer: Ziele vom Coach zusätzlich, Coach-Anfrage ablehnen
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin.sql.
--
-- go_accounts.coach_goals            Ziele, die Admin/Coach ergänzt (Komma-getrennt). training_goal bleibt das Ziel des Nutzers.
-- go_admin_decline_coach(p_account)  Coach-Anfrage ablehnen: Anfrage (activity_log + support_orders) wird entfernt.

alter table go_accounts add column if not exists coach_goals text;

create or replace function go_admin_decline_coach(p_account uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then
    raise exception 'Nur Admins';
  end if;
  delete from activity_log l
   where l.user_id = p_account and l.type = 'support_request' and l.meta ->> 'type' = 'coach_offer';
  delete from support_orders o
   using support_products p
   where p.id = o.product_id and p.type = 'coach_offer'
     and o.user_id = p_account and o.status = 'angefragt';
  return true;
end $$;

grant execute on function go_admin_decline_coach(uuid) to anon, authenticated;
