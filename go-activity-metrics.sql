-- go-activity-metrics.sql — Messwerte am Event + Wochenauswertung je Kategorie (2026-11-27)
-- Bisher standen Schritte, Strecke und Dauer nur als Text in events.note („8.500 Schritte“, „5,2 km · 32 min“).
-- Später (Sportuhren): Tageswerte wie Kalorien, Eiweiß, Schritte aus der Uhr kommen in eine eigene Tagestabelle mit Quelle.
-- Idempotent.

alter table events add column if not exists steps integer check (steps is null or steps >= 0);
alter table events add column if not exists distance_km numeric(6,2) check (distance_km is null or distance_km >= 0);
alter table events add column if not exists duration_min integer check (duration_min is null or duration_min >= 0);

-- Nachtrag aus bereits eingetragenen Notizen (erste Zeile)
update events
   set steps = replace(substring(note from '^([0-9.]+) Schritte'), '.', '')::int
 where steps is null and status = 'erledigt' and note ~ '^[0-9.]+ Schritte';
update events
   set distance_km = replace(substring(note from '^([0-9]+(?:,[0-9]+)?) km'), ',', '.')::numeric
 where distance_km is null and status = 'erledigt' and note ~ '^[0-9]+(,[0-9]+)? km';
update events
   set duration_min = replace(substring(note from '([0-9.]+) min'), '.', '')::int
 where duration_min is null and status = 'erledigt' and split_part(note, E'\n', 1) ~ '[0-9.]+ min$';

-- Woche je Nutzer und Kategorie: Anzahl erledigter Events, Summe Schritte, km, Minuten.
-- security_invoker: es gelten die RLS-Regeln von events (jeder sieht, was er auch im Feed sieht).
create or replace view go_activity_week with (security_invoker = true) as
select e.user_id,
       date_trunc('week', (e.starts_at at time zone 'Europe/Berlin'))::date as week_start,
       case when e.category = 'zirkel' then 'zirkel'
            when e.title ilike '%schritte%' then 'schritte'
            when e.category in ('kraft', 'ausdauer') then e.category
            else 'sonstiges' end as kind,
       count(*)::int as events_done,
       coalesce(sum(e.steps), 0)::int as steps,
       coalesce(sum(e.distance_km), 0)::numeric(8,2) as distance_km,
       coalesce(sum(e.duration_min), 0)::int as duration_min
  from events e
 where e.status = 'erledigt'
 group by 1, 2, 3;

grant select on go_activity_week to anon, authenticated;
