-- go-matrix.sql — Matrix für Wochenpläne, Events und Übungen: Equipment, Einschränkungen, Verteilung der Tage
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-exercise-muskeln.sql.
--
-- courses.equipment     Mehrfachauswahl: Kettlebells, Kurzhanteln, Langhantel 20 kg, Langhantel 15 kg, Gym-Geräte, Körpergewicht,
--                       Laufschuhe, Boxhandschuhe, Schlitten, Medizinball, Slam-Ball, Widerstandsband, Matte
-- courses.restrictions  physische Einschränkungen: Fuß verletzt, Schulterschmerzen, Hüftmobilität eingeschränkt, Asthma, Adipositas,
--                       Tennisarm, Rundrücken, LWS/BWS/HWS leicht eingeschränkt, Bluthochdruck, Menopause
-- courses.plan_mix      Wochenplan: geplante Anzahl Tage je Kategorie {"kraft":2,"ausdauer":2,"sonstige":2,"zirkel":1}
--                       (Zirkel = Platzhalter-Event, um an dem Tag ein Zirkeltraining zu planen)
-- courses.goals         bleibt text[]; neue Ziel-Schlüssel siehe go/kurse/index.html GOALS
-- go_exercise_catalog.equipment  Equipment je Übung (gleiche Liste)

alter table courses add column if not exists equipment text[] not null default '{}';
alter table courses add column if not exists restrictions text[] not null default '{}';
alter table courses add column if not exists plan_mix jsonb;
alter table go_exercise_catalog add column if not exists equipment text[] not null default '{}';
