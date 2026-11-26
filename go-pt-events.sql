-- go-pt-events.sql — Personal Training als gemeinsames Event von Coach und Coachee.
-- events.pt_session_id verbindet die beiden Kopien (Coach, Coachee) mit go_pt_sessions.
-- Nur der Coach steuert: Inhalt (Einheit mit Übungen oder Initialgespräch), Starten, Start verschieben,
-- Absagen, Absagen mit Stempel. Jede Aktion schickt dem Coachee eine Mitteilung (go_messages: Herz + Dialog beim Öffnen).
-- Events werden nie gelöscht, Absagen setzt sie auf „ausgefallen“. Idempotent.

alter table events add column if not exists pt_session_id uuid references go_pt_sessions(id) on delete set null;
create index if not exists events_pt_session_idx on events(pt_session_id);

-- Bestehendes PT von heute (Mimi, Joscha) verbinden
update events e set pt_session_id = s.id
from go_pt_sessions s join go_pt_bookings b on b.id = s.booking_id
where e.pt_session_id is null and e.item_type = 'support_session' and e.starts_at = s.session_at
  and e.user_id in (b.client_id, b.coach_id);

-- Vorname für Titel und Mitteilungen
create or replace function public.go_first_name(p_id uuid)
returns text language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(nullif(split_part(trim(coalesce(nullif(a.name, ''), a.nickname, '')), ' ', 1), ''), 'Coach') from go_accounts a where a.id = p_id;
$function$;

-- Coach bestätigt: Events bei Coach und Coachee anlegen (falls noch nicht da)
create or replace function public.go_pt_confirm(p_session uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
  s record;
begin
  select ps.*, b.client_id, b.coach_id into s
  from go_pt_sessions ps join go_pt_bookings b on b.id = ps.booking_id where ps.id = p_session;
  if s.id is null or s.coach_id <> v_me then raise exception 'not_coach'; end if;
  update go_pt_sessions set status = 'confirmed', updated_at = now() where id = p_session;
  update go_pt_bookings set status = 'confirmed', updated_at = now() where id = s.booking_id and status <> 'confirmed';
  if not exists (select 1 from events where pt_session_id = p_session) then
    insert into events (user_id, title, starts_at, status, visibility, category, is_unplanned, item_type, pt_session_id)
    values (s.coach_id, 'Personal Training mit ' || go_first_name(s.client_id), s.session_at, 'geplant', 'privat', 'alternative', true, 'support_session', p_session),
           (s.client_id, 'Personal Training mit ' || go_first_name(s.coach_id), s.session_at, 'geplant', 'privat', 'alternative', true, 'support_session', p_session);
  end if;
  insert into go_messages (to_id, from_id, kind, body)
  values (s.client_id, v_me, 'pt', go_first_name(v_me) || ' hat Dein Personal Training am ' ||
          to_char(s.session_at at time zone 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' bestätigt.');
end $function$;
grant execute on function public.go_pt_confirm(uuid) to anon, authenticated;

-- Coach legt fest, was im PT passiert: Einheit (Übungen auf der Karte) oder Initialgespräch (p_course null)
create or replace function public.go_pt_content(p_session uuid, p_course uuid default null)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
  s record;
  c record;
  v_cat text := 'alternative';
  v_course uuid := null;
  v_what text := 'Initialgespräch';
begin
  select ps.*, b.client_id, b.coach_id into s
  from go_pt_sessions ps join go_pt_bookings b on b.id = ps.booking_id where ps.id = p_session;
  if s.id is null or s.coach_id <> v_me then raise exception 'not_coach'; end if;
  if p_course is not null then
    select id, title, category_default into c from courses where id = p_course;
    if c.id is null then raise exception 'course'; end if;
    v_what := c.title;
    if coalesce(c.category_default, 'alternative') <> 'alternative' then v_cat := c.category_default; v_course := c.id; end if;
  end if;
  update events e set
    course_id = v_course, category = v_cat,
    title = case when p_course is null then 'Initialgespräch mit ' else 'Personal Training mit ' end
            || go_first_name(case when e.user_id = s.coach_id then s.client_id else s.coach_id end),
    note = case when p_course is null then null else 'PT: ' || v_what end
  where e.pt_session_id = p_session;
  insert into go_messages (to_id, from_id, kind, body)
  values (s.client_id, v_me, 'pt', go_first_name(v_me) || ' hat Euer Personal Training festgelegt: ' || v_what || '.');
end $function$;
grant execute on function public.go_pt_content(uuid, uuid) to anon, authenticated;

-- Aktionen des Coachs: start | move (p_at) | cancel | cancel_stamp
create or replace function public.go_pt_action(p_session uuid, p_action text, p_at timestamptz default null)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
  s record;
  v_who text;
  v_when text;
begin
  select ps.*, b.client_id, b.coach_id into s
  from go_pt_sessions ps join go_pt_bookings b on b.id = ps.booking_id where ps.id = p_session;
  if s.id is null then raise exception 'not_found'; end if;
  v_who := go_first_name(v_me);
  v_when := to_char(s.session_at at time zone 'Europe/Berlin', 'DD.MM. "um" HH24:MI');
  -- Coachee darf nur „Absagen mit Stempel“, die Nachricht geht an den Coach
  if s.client_id = v_me and p_action = 'cancel_stamp' then
    update go_pt_sessions set status = 'declined', updated_at = now() where id = p_session;
    update events set status = 'ausgefallen' where pt_session_id = p_session and status = 'geplant';
    update go_stamp_links set stamps = least(12, stamps + 1)
    where account_id = s.client_id and kind = 'coach' and ref = s.coach_id::text and status = 'linked';
    insert into go_messages (to_id, from_id, kind, body) values (s.coach_id, v_me, 'pt',
      v_who || ' hat Euer Personal Training am ' || v_when || ' abgesagt. Der Termin zählt als Stempel.');
    return;
  end if;
  if s.coach_id <> v_me then raise exception 'not_coach'; end if;
  if p_action = 'start' then
    insert into go_messages (to_id, from_id, kind, body) values (s.client_id, v_me, 'pt', v_who || ' hat Euer Personal Training gestartet.');
  elsif p_action = 'move' then
    if p_at is null then raise exception 'time'; end if;
    update go_pt_sessions set session_at = p_at, updated_at = now() where id = p_session;
    update events set starts_at = p_at where pt_session_id = p_session;
    insert into go_messages (to_id, from_id, kind, body) values (s.client_id, v_me, 'pt',
      v_who || ' hat den Start Eures Personal Trainings verschoben: ' || to_char(p_at at time zone 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || '.');
  elsif p_action in ('cancel', 'cancel_stamp') then
    update go_pt_sessions set status = 'declined', updated_at = now() where id = p_session;
    update events set status = 'ausgefallen' where pt_session_id = p_session and status = 'geplant';
    if p_action = 'cancel_stamp' then
      update go_stamp_links set stamps = least(12, stamps + 1)
      where account_id = s.client_id and kind = 'coach' and ref = s.coach_id::text and status = 'linked';
    end if;
    insert into go_messages (to_id, from_id, kind, body) values (s.client_id, v_me, 'pt',
      v_who || ' hat Euer Personal Training am ' || v_when || ' abgesagt' ||
      case when p_action = 'cancel_stamp' then '. Der Termin zählt als Stempel auf Deiner Karte.' else '.' end);
  else
    raise exception 'action';
  end if;
end $function$;
grant execute on function public.go_pt_action(uuid, text, timestamptz) to anon, authenticated;

-- Coach schließt das PT ab (erledigt): Kopie des Coachees ist auch erledigt
create or replace function public.go_pt_done_sync()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.pt_session_id is null or new.status <> 'erledigt' or old.status = 'erledigt' then return new; end if;
  if not exists (select 1 from go_pt_sessions ps join go_pt_bookings b on b.id = ps.booking_id
                 where ps.id = new.pt_session_id and b.coach_id = new.user_id) then return new; end if;
  update events set status = 'erledigt' where pt_session_id = new.pt_session_id and id <> new.id and status = 'geplant';
  return new;
end $function$;
drop trigger if exists go_pt_done_sync on events;
create trigger go_pt_done_sync after update of status on events for each row execute function public.go_pt_done_sync();
