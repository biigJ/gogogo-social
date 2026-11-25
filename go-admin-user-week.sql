-- go-admin-user-week.sql — Admin → Nutzer → Wochenplan: die nächsten 7 Tage des Nutzers wie „Tage bearbeiten“.
-- Idempotent. Voraussetzung: go-admin-user-extras.sql (go_is_admin).
create or replace function public.go_admin_user_week(p_account uuid)
returns table(id uuid, title text, starts_at timestamptz, location text, visibility text, status text,
              category text, item_type text, enrollment_id uuid, course_id uuid)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return query
  select e.id, e.title, e.starts_at, e.location, e.visibility::text, e.status::text,
         e.category::text, e.item_type::text, e.enrollment_id, e.course_id
  from events e
  where e.user_id = p_account
    and e.status <> 'ausgefallen'
    and (e.starts_at at time zone 'Europe/Berlin')::date between v_today and v_today + 6
  order by e.starts_at;
end $function$;
grant execute on function public.go_admin_user_week(uuid) to anon, authenticated;
