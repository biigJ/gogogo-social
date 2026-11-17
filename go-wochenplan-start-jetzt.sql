-- go-wochenplan-start-jetzt.sql — vom Coach zugeordnete Wochenpläne schon in der laufenden Woche zeigen
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- Bisher startete eine Zuordnung erst am nächsten Montag. Neu im Coachportal: Start = Montag dieser Woche
-- (vergangene Tage überspringt go_generate_events). Dieses Skript zieht bestehende Zuordnungen, die erst
-- in der Zukunft starten, auf den Montag dieser Woche vor und erzeugt die fehlenden Termine ab heute.
-- Bereits vorhandene Termine bleiben (gleiche Uhrzeit wird nicht doppelt angelegt).

do $$
declare
  en record;
  v_monday date := date_trunc('week', (now() at time zone 'Europe/Berlin'))::date;
begin
  for en in
    select id from enrollments
    where status = 'aktiv' and assigned_by is not null and start_date > v_monday
  loop
    update enrollments set start_date = v_monday where id = en.id;
    perform go_generate_events(en.id);
  end loop;
end $$;

-- Kontrolle: Termine dieser Woche aus Coach-Zuordnungen
select a.nickname, e.title, (e.starts_at at time zone 'Europe/Berlin')::date as tag
from events e
join enrollments n on n.id = e.enrollment_id
left join go_accounts a on a.id = e.user_id
where n.assigned_by is not null
  and e.starts_at >= date_trunc('week', now() at time zone 'Europe/Berlin')
  and e.starts_at < date_trunc('week', now() at time zone 'Europe/Berlin') + interval '7 days'
order by a.nickname, e.starts_at;
