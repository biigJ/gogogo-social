-- go-admin-plan-start.sql
-- Admin weist Wochenplan zu: Montag-Slot landet auf Montag, Termine ab heute.
-- Vorher war start_date = heute, dadurch lag Tag 1 des Plans auf dem heutigen Wochentag.
-- Jetzt wie go_apply_plan: start_date = Montag dieser Woche, go_generate_events überspringt Tage vor heute.
-- Alte offene Termine werden ab heute (ganzer Tag) entfernt, damit heute nichts doppelt steht.

create or replace function go_admin_set_plan(p_account uuid, p_course uuid default null, p_weekdays int[] default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_ids uuid[];
  new_id uuid;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  select array_agg(id) into old_ids from enrollments where user_id = p_account and status = 'aktiv';
  if old_ids is not null then
    update enrollments set status = 'beendet' where id = any (old_ids);
    delete from events
    where enrollment_id = any (old_ids) and user_id = p_account and status = 'geplant'
      and (starts_at at time zone 'Europe/Berlin')::date >= v_today;
  end if;
  if p_course is null then return 'removed'; end if;
  if coalesce(array_length(p_weekdays, 1), 0) = 0 then raise exception 'weekdays'; end if;
  insert into enrollments (user_id, course_id, status, start_date, weekdays)
  values (p_account, p_course, 'aktiv', date_trunc('week', v_today)::date,
          (select array_agg(distinct x order by x) from unnest(p_weekdays) x where x between 0 and 6))
  returning id into new_id;
  perform go_generate_events(new_id);
  return 'set';
end $$;
grant execute on function go_admin_set_plan(uuid, uuid, int[]) to anon, authenticated;
