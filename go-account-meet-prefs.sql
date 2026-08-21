-- Mehrfach-Orte + Wochentag Ort/Zeit + Together-Invites
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists workout_places jsonb default '[]'::jsonb;

alter table go_accounts
  add column if not exists weekday_meet_prefs jsonb default '{}'::jsonb;

alter table go_workout_invites
  add column if not exists invite_kind text default 'invite';

alter table go_workout_invites
  add column if not exists their_label text;

-- Bestehende einzelne Orte in workout_places spiegeln
update go_accounts
set workout_places = jsonb_build_array(workout_place)
where workout_place is not null
  and trim(workout_place) <> ''
  and (
    workout_places is null
    or workout_places = '[]'::jsonb
    or jsonb_typeof(workout_places) <> 'array'
  );
