-- go-admin-user-extras.sql — Admin → Nutzer: Wochenplan setzen/entfernen, Stempelkarten, Double-Partner
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Voraussetzung: go-courses-support.sql, go-wochenplaene.sql (go_generate_events), go-stamp-punctual.sql,
--               go-challenges.sql, go-zirkel-partner.sql, go-admin-circles.sql.
--
-- go_admin_user_extras()          je Nutzer: aktiver Wochenplan, Stempelkarte (Stempel), verknüpfte Gruppen-/Circle-Karten,
--                                 Gruppen und Circles, letzte 3 Doubles (Datum, Partner)
-- go_admin_set_plan(acc, course, weekdays)
--                                 aktiven Plan beenden (künftige, noch geplante Plan-Events fallen weg);
--                                 mit course: neuen Plan ab heute anlegen und Events erzeugen

create or replace function go_admin_user_extras()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return coalesce((
    select jsonb_object_agg(a.id::text, jsonb_build_object(
      'plan', (
        select jsonb_build_object('enrollment_id', e.id, 'course_id', e.course_id, 'title', c.title, 'weekdays', e.weekdays)
        from enrollments e join courses c on c.id = e.course_id
        where e.user_id = a.id and e.status = 'aktiv'
        order by e.start_date desc nulls last limit 1),
      'stamp', (
        select jsonb_build_object('stamps', coalesce((o.meta->>'stamps')::int, 0), 'status', o.status)
        from support_orders o join support_products p on p.id = o.product_id
        where o.user_id = a.id and p.type = 'stempelkarte' and o.status not in ('angefragt', 'cancelled')
        order by o.created_at desc limit 1),
      'links', coalesce((
        select jsonb_agg(jsonb_build_object('kind', l.kind, 'ref', l.ref, 'name', l.name, 'stamps', l.stamps, 'status', l.status))
        from go_stamp_links l where l.account_id = a.id), '[]'::jsonb),
      'groups', coalesce((
        select jsonb_agg(jsonb_build_object('id', g.id::text, 'name', g.name))
        from groups g
        where g.created_by = a.id
           or exists (select 1 from group_members m where m.group_id = g.id and m.account_id = a.id and m.status = 'accepted')), '[]'::jsonb),
      'circles', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.group_id, 'name', coalesce(nullif(c.name, ''), 'Circle')))
        from go_circle_members m left join go_circles c on c.group_id = m.group_id
        where m.account_id = a.id), '[]'::jsonb),
      'doubles', coalesce((
        select jsonb_agg(jsonb_build_object('at', d.at, 'partner_id', d.partner_id, 'partner_name', d.partner_name) order by d.at desc)
        from (
          select * from (
            select e.starts_at as at,
                   nullif(substring(e.note from 'partner=([0-9a-fA-F-]{36})'), '')::uuid as partner_id,
                   substring(e.note from 'pname=([^|]*)') as partner_name
            from events e
            where e.user_id = a.id and e.note like 'zirkel:double%' and e.status <> 'ausgefallen' and e.starts_at <= now()
            union all
            select e.starts_at, r.partner_id, r.partner_name
            from event_rsvps r join events e on e.id = r.event_id
            where r.user_id = a.id and (r.partner_id is not null or r.partner_name is not null)
              and e.status <> 'ausgefallen' and e.starts_at <= now()
          ) u
          order by u.at desc
          limit 3
        ) d), '[]'::jsonb)
    ))
    from go_accounts a
  ), '{}'::jsonb);
end $$;
grant execute on function go_admin_user_extras() to anon, authenticated;

create or replace function go_admin_set_plan(p_account uuid, p_course uuid default null, p_weekdays int[] default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_ids uuid[];
  new_id uuid;
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  select array_agg(id) into old_ids from enrollments where user_id = p_account and status = 'aktiv';
  if old_ids is not null then
    update enrollments set status = 'beendet' where id = any (old_ids);
    delete from events
    where enrollment_id = any (old_ids) and user_id = p_account and status = 'geplant' and starts_at > now();
  end if;
  if p_course is null then return 'removed'; end if;
  if coalesce(array_length(p_weekdays, 1), 0) = 0 then raise exception 'weekdays'; end if;
  insert into enrollments (user_id, course_id, status, start_date, weekdays)
  values (p_account, p_course, 'aktiv', (now() at time zone 'Europe/Berlin')::date,
          (select array_agg(distinct x order by x) from unnest(p_weekdays) x where x between 0 and 6))
  returning id into new_id;
  perform go_generate_events(new_id);
  return 'set';
end $$;
grant execute on function go_admin_set_plan(uuid, uuid, int[]) to anon, authenticated;
