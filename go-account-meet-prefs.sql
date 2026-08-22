-- Mehrfach-Orte + Wochentag Ort/Zeit + Together-Invites
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists workout_place text;

alter table go_accounts
  add column if not exists workout_places jsonb default '[]'::jsonb;

alter table go_accounts
  add column if not exists weekday_meet_prefs jsonb default '{}'::jsonb;

-- weekday_meet_prefs JSON pro Wochentag (Schlüssel "0"=Mo … "6"=So):
-- { "place": "…", "time": "18:00", "label": "…", "effective_from": "YYYY-MM-DD" }
-- Matches im Kalender nur wenn Kalendertag >= effective_from und nicht in der Vergangenheit.

alter table go_workout_invites
  add column if not exists invite_kind text default 'invite';

alter table go_workout_invites
  add column if not exists their_label text;

-- workout_places normalisieren
update go_accounts
set workout_places = '[]'::jsonb
where workout_places is null
   or jsonb_typeof(workout_places) <> 'array';

update go_accounts
set weekday_meet_prefs = '{}'::jsonb
where weekday_meet_prefs is null
   or jsonb_typeof(weekday_meet_prefs) <> 'object';

-- Einzel-Ort → workout_places (nur wenn Spalte workout_place existiert)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'go_accounts'
      and column_name = 'workout_place'
  ) then
    execute $sql$
      update go_accounts
      set workout_places = jsonb_build_array(workout_place)
      where workout_place is not null
        and trim(workout_place) <> ''
        and (
          workout_places is null
          or workout_places = '[]'::jsonb
          or jsonb_typeof(workout_places) <> 'array'
        )
    $sql$;
  end if;
end $$;

-- Ersten Ort aus workout_places als workout_place spiegeln (App-Kompatibilität)
update go_accounts
set workout_place = trim(both '"' from (workout_places->>0))
where (workout_place is null or trim(workout_place) = '')
  and workout_places is not null
  and jsonb_typeof(workout_places) = 'array'
  and jsonb_array_length(workout_places) > 0
  and coalesce(trim(workout_places->>0), '') <> '';
