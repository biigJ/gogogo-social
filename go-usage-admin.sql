-- go-usage-admin.sql — Admin: Nutzungsanalyse je Nutzer und Logs (setzt go-usage.sql voraus). Nur Admins. Idempotent.
--
-- Labels (aus den Daten der letzten 30 Tage, Circle 60 Tage):
--   Circle-User   in der App mit FFC eingeloggt, Circle-Stempelkarte oder Zusage zu einem Circle-Termin
--   Coaching-User Coach-Status (beantragt oder bestätigt) und setzt Termine: eigene Termine ohne Wochenplan oder Termine für Coachees
--   Plan-User     aktiver Wochenplan und mindestens 3 abgehakte Plan-Events
--   Chat-User     mindestens 5 Nachrichten (Aktuell-Posts, Kommentare, Community, Bubble)
--   PT-User       hat einen Coach gewählt und einen Termin gebucht (PT-Buchung oder Support-Termin)

create or replace function public.go_admin_usage(p_days integer default 30)
returns table(account_id uuid, name text, photo_url text, labels text[],
              sessions integer, seconds bigint, last_at timestamptz, top_section text, actions integer,
              done_30 integer, chat_30 integer, coach_events_30 integer,
              fb_ja integer, fb_nein integer, fb_vielleicht integer, fb_last text, fb_last_at timestamptz,
              device text, plan text)
language plpgsql stable security definer set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_from timestamptz := case when coalesce(p_days, 0) > 0 then now() - make_interval(days => p_days) else '-infinity'::timestamptz end;
  v_30 timestamptz := now() - interval '30 days';
  v_60 timestamptz := now() - interval '60 days';
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return query
  with acc as (
    select a.id, a.name, a.photo_url, a.trainer_id, a.is_trainer, a.coach_self_at, a.coach_verified_at, a.ffc_seen_at
    from go_accounts a where a.deleted_at is null
  ),
  ses as (
    select s.account_id, count(*)::int n, coalesce(sum(s.seconds), 0)::bigint secs, max(s.last_at) last_at,
           (array_agg(s.device order by s.started_at desc))[1] device
    from go_usage_sessions s where s.started_at >= v_from group by s.account_id
  ),
  evs as (
    -- Admin zählt nicht als Nutzung; Top-Sektion = meiste Tipps (Pille und Funktionen) außerhalb von Admin
    select e.account_id, count(*) filter (where e.action not in ('Start', 'Pille'))::int n,
           mode() within group (order by e.section) filter (where e.action <> 'Start') top
    from go_usage_events e where e.at >= v_from and coalesce(e.section, '') <> 'Admin' group by e.account_id
  ),
  fb as (
    select f.account_id,
           count(*) filter (where f.answer = 'ja')::int ja,
           count(*) filter (where f.answer = 'nein')::int nein,
           count(*) filter (where f.answer = 'vielleicht')::int viel,
           (array_agg(f.body order by f.created_at desc) filter (where f.body is not null))[1] last_body,
           max(f.created_at) last_at
    from go_session_feedback f where f.created_at >= v_from group by f.account_id
  ),
  done as (
    select e.user_id, count(*)::int n from events e
    where e.status = 'erledigt' and e.enrollment_id is not null and e.starts_at >= v_30 group by e.user_id
  ),
  chat as (
    select x.aid, count(*)::int n from (
      select author_id aid from go_aktuell_posts where created_at >= v_30
      union all select account_id from event_comments where created_at >= v_30
      union all select author_id from go_community_posts where created_at >= v_30
      union all select author_id from go_bubble_messages where created_at >= v_30
    ) x group by x.aid
  ),
  coachev as (
    select c.aid, count(*)::int n from (
      select e.user_id aid from events e
      where e.created_at >= v_30 and e.enrollment_id is null and coalesce(e.travel_auto, false) = false
        and coalesce(e.item_type, '') not in ('nutrition_log', 'support_session')
        and (e.assigned_by is null or e.assigned_by = e.user_id)
      union all
      select e.assigned_by from events e
      where e.created_at >= v_30 and e.assigned_by is not null and e.assigned_by <> e.user_id
    ) c group by c.aid
  ),
  plan as (
    select distinct on (n.user_id) n.user_id, c.title
    from enrollments n join courses c on c.id = n.course_id
    where n.status = 'aktiv' order by n.user_id, n.created_at desc
  ),
  circ as (
    select l.account_id aid from go_stamp_links l where l.kind = 'circle'
    union select r.user_id from event_rsvps r join events e on e.id = r.event_id
      where e.circle_id is not null and r.status = 'zugesagt' and e.starts_at >= v_60
  ),
  pt as (
    select b.client_id aid from go_pt_bookings b
    union select e.user_id from events e where e.item_type = 'support_session'
  )
  select a.id, a.name, a.photo_url,
    array_remove(array[
      case when a.ffc_seen_at is not null or exists (select 1 from circ where circ.aid = a.id) then 'Circle-User' end,
      case when (coalesce(a.is_trainer, false) or a.coach_self_at is not null or a.coach_verified_at is not null)
                and coalesce(cv.n, 0) > 0 then 'Coaching-User' end,
      case when p.user_id is not null and coalesce(d.n, 0) >= 3 then 'Plan-User' end,
      case when coalesce(ch.n, 0) >= 5 then 'Chat-User' end,
      case when a.trainer_id is not null and exists (select 1 from pt where pt.aid = a.id) then 'PT-User' end
    ], null)::text[],
    coalesce(s.n, 0), coalesce(s.secs, 0), s.last_at, ev.top, coalesce(ev.n, 0),
    coalesce(d.n, 0), coalesce(ch.n, 0), coalesce(cv.n, 0),
    coalesce(f.ja, 0), coalesce(f.nein, 0), coalesce(f.viel, 0), f.last_body, f.last_at,
    s.device, p.title
  from acc a
  left join ses s on s.account_id = a.id
  left join evs ev on ev.account_id = a.id
  left join fb f on f.account_id = a.id
  left join done d on d.user_id = a.id
  left join chat ch on ch.aid = a.id
  left join coachev cv on cv.aid = a.id
  left join plan p on p.user_id = a.id;
end $function$;
grant execute on function public.go_admin_usage(integer) to anon, authenticated;

-- Logs einer Person: Sitzungen, Ereignisse und Feedback, neueste zuerst
create or replace function public.go_admin_usage_log(p_account uuid, p_limit integer default 400)
returns table(kind text, at timestamptz, session_id uuid, section text, action text, seconds integer, device text)
language plpgsql stable security definer set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  if not go_is_admin() then raise exception 'not admin'; end if;
  return query
  select * from (
    select 'session'::text, s.started_at, s.id, null::text, null::text, s.seconds, s.device
    from go_usage_sessions s where s.account_id = p_account
    union all
    select 'event', e.at, e.session_id, e.section, e.action, null::int, null::text
    from go_usage_events e where e.account_id = p_account
    union all
    select 'feedback', f.created_at, f.session_id, f.answer, f.body, null::int, null::text
    from go_session_feedback f where f.account_id = p_account
  ) x order by 2 desc
  limit greatest(1, least(coalesce(p_limit, 400), 2000));
end $function$;
grant execute on function public.go_admin_usage_log(uuid, integer) to anon, authenticated;
