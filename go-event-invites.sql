-- go-event-invites.sql
-- Einladungen hängen an einem konkreten Event (nicht mehr nur am Tag).
-- Idempotent. Voraussetzung: go-workout-invites.sql, go-courses-support.sql.
--
--   go_workout_invites.event_id   Verweis auf das Event des Einladenden
--   Status 'expired'              Einladungen für vergangene Tage verfallen
--   go_accept_invite(id)          Einladung annehmen = Zusage im Event
--   go_decline_invite(id)         Einladung absagen  = Zusage entfernen

alter table go_workout_invites
  add column if not exists event_id uuid references events(id) on delete cascade;

create index if not exists go_workout_invites_event_idx on go_workout_invites (event_id);
create index if not exists go_workout_invites_to_status_idx on go_workout_invites (to_id, status, workout_date);

alter table go_workout_invites drop constraint if exists go_workout_invites_status_check;
alter table go_workout_invites
  add constraint go_workout_invites_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired'));

-- Bestehende Einladungen dem Event des Einladenden am selben Tag zuordnen
-- (gleicher Titel zuerst, sonst das früheste Event des Tages)
update go_workout_invites i
set event_id = (
  select e.id
  from events e
  where e.user_id = i.from_id
    and (e.starts_at at time zone 'Europe/Berlin')::date = i.workout_date
    and e.status <> 'ausgefallen'
  order by (e.title = i.workout_label) desc, e.starts_at
  limit 1
)
where i.event_id is null;

-- Vergangene offene Einladungen verfallen lassen
create or replace function go_expire_invites()
returns integer
language sql
security definer
set search_path = public
as $$
  with x as (
    update go_workout_invites
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and workout_date < (now() at time zone 'Europe/Berlin')::date
    returning 1
  )
  select count(*)::int from x;
$$;

grant execute on function go_expire_invites() to anon, authenticated;

select go_expire_invites();

-- Annehmen: Status + Zusage im Event
create or replace function go_accept_invite(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv go_workout_invites%rowtype;
begin
  select * into inv from go_workout_invites where id = p_invite_id;
  if not found then
    return 'not_found';
  end if;
  if inv.workout_date < (now() at time zone 'Europe/Berlin')::date then
    update go_workout_invites set status = 'expired', updated_at = now() where id = inv.id;
    return 'expired';
  end if;
  if go_current_account_id() is not null and go_current_account_id() <> inv.to_id then
    return 'not_yours';
  end if;
  update go_workout_invites set status = 'accepted', updated_at = now() where id = inv.id;
  if inv.event_id is not null then
    insert into event_rsvps (event_id, user_id, status)
    values (inv.event_id, inv.to_id, 'zugesagt')
    on conflict (event_id, user_id) do update set status = 'zugesagt';
  end if;
  return 'accepted';
end;
$$;

grant execute on function go_accept_invite(uuid) to anon, authenticated;

-- Absagen: Status + Zusage entfernen
create or replace function go_decline_invite(p_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv go_workout_invites%rowtype;
begin
  select * into inv from go_workout_invites where id = p_invite_id;
  if not found then
    return 'not_found';
  end if;
  if go_current_account_id() is not null and go_current_account_id() <> inv.to_id then
    return 'not_yours';
  end if;
  update go_workout_invites set status = 'declined', updated_at = now() where id = inv.id;
  if inv.event_id is not null then
    delete from event_rsvps where event_id = inv.event_id and user_id = inv.to_id;
  end if;
  return 'declined';
end;
$$;

grant execute on function go_decline_invite(uuid) to anon, authenticated;

-- Kurzcheck
select
  count(*) filter (where event_id is not null) as mit_event,
  count(*) filter (where event_id is null) as ohne_event,
  count(*) filter (where status = 'pending' and workout_date >= (now() at time zone 'Europe/Berlin')::date) as offen_zukuenftig,
  count(*) filter (where status = 'expired') as verfallen
from go_workout_invites;
