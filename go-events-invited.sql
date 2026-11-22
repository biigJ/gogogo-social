-- go-events-invited.sql — Eingeladene sehen das Event, auch wenn es privat ist
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-workout-invites.sql, go-circle-events.sql.
-- Fall: Ben lädt Joscha zu „> 5.000 Schritte“ ein (Schritte sind standardmäßig privat) → Joscha sah die Einladung,
-- aber nicht das Event. Neu: wer eingeladen ist (offen, angenommen, vielleicht) oder zugesagt hat, darf es lesen.

create or replace function go_i_invited(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from go_workout_invites i
    where i.event_id = p_event and i.to_id = go_current_account_id()
      and i.status in ('pending', 'accepted', 'maybe')
  ) or exists (
    select 1 from event_rsvps r
    where r.event_id = p_event and r.user_id = go_current_account_id() and r.status = 'zugesagt'
  );
$$;
grant execute on function go_i_invited(uuid) to anon, authenticated;

drop policy if exists "events_select_invited" on events;
create policy "events_select_invited" on events for select to anon, authenticated
  using (go_i_invited(id));
