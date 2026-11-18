-- go-tamagotchi.sql — Verschieben merken, damit der Profilkreis Gelb / Gelb-Orange zeigt
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- events.moved_days: Tage, von denen das Event auf einen späteren Tag verschoben wurde.
-- Ein Trigger trägt den alten Tag ein, sobald starts_at auf einen späteren Kalendertag (Berlin) wandert.

alter table events add column if not exists moved_days date[] not null default '{}';

create or replace function go_events_track_move()
returns trigger
language plpgsql
as $$
declare
  v_old date := (old.starts_at at time zone 'Europe/Berlin')::date;
  v_new date := (new.starts_at at time zone 'Europe/Berlin')::date;
begin
  if new.starts_at is distinct from old.starts_at
     and v_new > v_old
     and coalesce(new.status, 'geplant') = 'geplant' then
    new.moved_days := array_append(coalesce(old.moved_days, '{}'), v_old);
  end if;
  return new;
end;
$$;

drop trigger if exists go_events_track_move on events;
create trigger go_events_track_move
  before update of starts_at on events
  for each row execute function go_events_track_move();
