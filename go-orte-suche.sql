-- go-orte-suche.sql — Freunde über Orte finden + Orte vereinheitlichen
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-workout-places.sql, go-account-meet-prefs.sql.
--
-- 1) go_accounts.places_findable   true = „Man kann mich unter den Orten finden.“ (Team → Freunde finden → Ort durchsuchen)
--                                  false = „Die Orte sind nur zur Info für meine Freunde.“ (Standard)
-- 2) Ortsliste aufräumen: doppelte Einträge (≤ 150 m auseinander oder gleicher Name bis auf Groß/Klein)
--    werden zum ältesten Eintrag zusammengeführt. Die Orte in den Profilen (workout_places) bekommen dessen Namen.
--    Beispiel: „Fitness First Prenzlauer Berg“ und „FF Schönhauser Allee“ am selben Punkt → ein Ort.
--    Kann jederzeit erneut laufen.

alter table go_accounts add column if not exists places_findable boolean not null default false;

create index if not exists go_accounts_places_findable_idx on go_accounts (places_findable) where places_findable;

do $$
declare
  v_merged int;
begin
  -- Leerzeichen vereinheitlichen
  update go_workout_places
     set name = regexp_replace(trim(name), '\s+', ' ', 'g')
   where name <> regexp_replace(trim(name), '\s+', ' ', 'g');

  drop table if exists _go_place_dup;
  create temp table _go_place_dup as
  select d.id as dup_id, d.name as dup_name, k.name as keep_name
  from go_workout_places d
  join lateral (
    select k.name
    from go_workout_places k
    where (k.created_at, k.id) < (d.created_at, d.id)
      and (
        lower(k.name) = lower(d.name)
        or (
          k.lat is not null and k.lng is not null and d.lat is not null and d.lng is not null
          and sqrt(power((k.lat - d.lat) * 111320, 2) +
                   power((k.lng - d.lng) * 111320 * cos(radians(d.lat)), 2)) <= 150
        )
      )
    order by k.created_at, k.id
    limit 1
  ) k on true;

  -- Profile: Namen auf den bleibenden Eintrag (und die Schreibweise der Ortsliste) umstellen, Dopplungen raus
  update go_accounts a
     set workout_places = (
       select coalesce(jsonb_agg(y.n order by y.ord), '[]'::jsonb)
       from (
         select distinct on (lower(x.n)) x.n, x.ord
         from (
           select coalesce(dp.keep_name, wp.name, e.n) as n, e.ord
           from (
             select regexp_replace(trim(case when jsonb_typeof(v) = 'object' then v ->> 'name' else v #>> '{}' end), '\s+', ' ', 'g') as n, ord
             from jsonb_array_elements(a.workout_places) with ordinality t(v, ord)
           ) e
           left join _go_place_dup dp on lower(dp.dup_name) = lower(e.n)
           left join lateral (
             select w.name from go_workout_places w
             where lower(w.name) = lower(e.n)
               and not exists (select 1 from _go_place_dup z where z.dup_id = w.id)
             limit 1
           ) wp on true
           where coalesce(e.n, '') <> ''
         ) x
         order by lower(x.n), x.ord
       ) y
     )
   where jsonb_typeof(a.workout_places) = 'array'
     and jsonb_array_length(a.workout_places) > 0;

  delete from go_workout_places w using _go_place_dup dp where w.id = dp.dup_id;
  get diagnostics v_merged = row_count;
  raise notice 'Orte zusammengeführt: %', v_merged;

  -- erster Ort bleibt das alte Einzelfeld, falls vorhanden
  if exists (select 1 from information_schema.columns where table_name = 'go_accounts' and column_name = 'workout_place') then
    execute $q$update go_accounts set workout_place = coalesce(workout_places ->> 0, '')
             where jsonb_typeof(workout_places) = 'array'
               and coalesce(workout_place, '') is distinct from coalesce(workout_places ->> 0, '')$q$;
  end if;

  drop table if exists _go_place_dup;
end $$;
