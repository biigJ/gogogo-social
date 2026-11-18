-- go-uebungen-katalog.sql — eine Übungsliste mit Labels, gleiche Übung = gleicher Name
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-wochenplan-slots.sql.
--
-- 1) go_exercise_catalog bekommt labels (Push, Pull, Beine, Glutes, Oberkörper, Arme, Rumpf,
--    Mehrgelenkig, Sprung, Mobility, Ausdauer) und aliases (andere Schreibweisen).
-- 2) Alle 112 Übungen aus den Einheiten werden eingetragen (vorhandene Einträge bekommen Labels dazu).
-- 3) Andere Schreibweisen werden überall auf den einen Namen umgestellt:
--    Einheiten (course_sessions.blocks), Videos (go_exercise_media, go_exercise_links), Tracking-Logs.
--    z. B. „Bulgarian Split Squat“ → „Bulgarische Kniebeuge“, „Box Jumps“ → „Box Jump“.

alter table go_exercise_catalog add column if not exists labels text[] not null default '{}';
alter table go_exercise_catalog add column if not exists aliases text[] not null default '{}';

insert into go_exercise_catalog (name_key, name, labels, aliases)
values
  ('90/90 hüftrotation', '90/90 Hüftrotation', array['Mobility']::text[], '{}'::text[]),
  ('adduktoren', 'Adduktoren', array['Beine']::text[], '{}'::text[]),
  ('adduktoren-rocking', 'Adduktoren-Rocking', array['Mobility']::text[], '{}'::text[]),
  ('ankle rocks', 'Ankle Rocks', array['Mobility']::text[], '{}'::text[]),
  ('ausfallschritt rückwärts', 'Ausfallschritt rückwärts', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('auslaufen', 'Auslaufen', array['Ausdauer']::text[], '{}'::text[]),
  ('bankdrücken', 'Bankdrücken', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('beinbeuger', 'Beinbeuger', array['Beine']::text[], '{}'::text[]),
  ('beinpresse', 'Beinpresse', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('beinstrecker', 'Beinstrecker', array['Beine']::text[], '{}'::text[]),
  ('bird dog', 'Bird Dog', array['Rumpf']::text[], '{}'::text[]),
  ('bizepscurl', 'Bizepscurl', array['Pull','Arme']::text[], '{}'::text[]),
  ('bounding', 'Bounding', array['Sprung','Beine']::text[], '{}'::text[]),
  ('box jump', 'Box Jump', array['Sprung','Beine']::text[], array['Box Jumps']::text[]),
  ('bulgarian split squat → kurzhantel-push-press', 'Bulgarian Split Squat → Kurzhantel-Push-Press', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('bulgarische kniebeuge', 'Bulgarische Kniebeuge', array['Beine','Glutes','Mehrgelenkig']::text[], array['Bulgarian Split Squat']::text[]),
  ('copenhagen plank', 'Copenhagen Plank', array['Beine','Rumpf']::text[], '{}'::text[]),
  ('copenhagen plank kurzer hebel', 'Copenhagen Plank kurzer Hebel', array['Beine','Rumpf']::text[], '{}'::text[]),
  ('couch stretch', 'Couch Stretch', array['Mobility']::text[], '{}'::text[]),
  ('dead bug', 'Dead Bug', array['Rumpf']::text[], '{}'::text[]),
  ('dips', 'Dips', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('drop jumps', 'Drop Jumps', array['Sprung','Beine']::text[], '{}'::text[]),
  ('einbeinige hops', 'Einbeinige Hops', array['Sprung','Beine']::text[], '{}'::text[]),
  ('einbeiniges hüftheben', 'Einbeiniges Hüftheben', array['Glutes','Beine']::text[], array['Glute Bridge einbeinig']::text[]),
  ('einbeiniges kreuzheben', 'Einbeiniges Kreuzheben', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('einbeiniges rdl mit langhantel → clean → langer schritt auf box', 'Einbeiniges RDL mit Langhantel → Clean → langer Schritt auf Box', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('einlaufen', 'Einlaufen', array['Ausdauer']::text[], '{}'::text[]),
  ('enges bankdrücken', 'Enges Bankdrücken', array['Push','Oberkörper','Arme','Mehrgelenkig']::text[], '{}'::text[]),
  ('face pulls', 'Face Pulls', array['Pull','Oberkörper']::text[], '{}'::text[]),
  ('farmer carry', 'Farmer Carry', array['Rumpf','Mehrgelenkig']::text[], '{}'::text[]),
  ('frontheben', 'Frontheben', array['Push','Oberkörper']::text[], '{}'::text[]),
  ('frontkniebeuge', 'Frontkniebeuge', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('gehen', 'Gehen', array['Ausdauer']::text[], '{}'::text[]),
  ('glute bridge', 'Glute Bridge', array['Glutes','Beine']::text[], '{}'::text[]),
  ('goblet squat', 'Goblet Squat', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('good morning', 'Good Morning', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('große ganzkörperdehnung', 'Große Ganzkörperdehnung', array['Mobility']::text[], '{}'::text[]),
  ('hammercurl', 'Hammercurl', array['Pull','Arme']::text[], '{}'::text[]),
  ('herabschauender hund', 'Herabschauender Hund', array['Mobility']::text[], '{}'::text[]),
  ('hip thrust', 'Hip Thrust', array['Glutes','Beine']::text[], '{}'::text[]),
  ('hopserlauf', 'Hopserlauf', array['Ausdauer','Sprung']::text[], '{}'::text[]),
  ('hängen mit schulterblatt-heben', 'Hängen mit Schulterblatt-Heben', array['Pull','Oberkörper']::text[], '{}'::text[]),
  ('hüftabduktion', 'Hüftabduktion', array['Glutes','Beine']::text[], '{}'::text[]),
  ('hüftbeuger-dehnung kniend', 'Hüftbeuger-Dehnung kniend', array['Mobility']::text[], array['Hüftbeuger-Dehnung im Halbknien']::text[]),
  ('intervall', 'Intervall', array['Ausdauer']::text[], '{}'::text[]),
  ('kabel kickback', 'Kabel Kickback', array['Glutes','Beine']::text[], '{}'::text[]),
  ('katze-kuh', 'Katze-Kuh', array['Mobility']::text[], array['Cat-Cow']::text[]),
  ('kettlebell clean → press → reverse lunge', 'Kettlebell Clean → Press → Reverse Lunge', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('kettlebell swing', 'Kettlebell Swing', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('kindhaltung mit strecken', 'Kindhaltung mit Strecken', array['Mobility']::text[], '{}'::text[]),
  ('klimmzug (assistiert)', 'Klimmzug (assistiert)', array['Pull','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('klimmzüge', 'Klimmzüge', array['Pull','Oberkörper','Mehrgelenkig']::text[], array['Klimmzug']::text[]),
  ('klimmzüge supiniert', 'Klimmzüge supiniert', array['Pull','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('kniebeuge', 'Kniebeuge', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('kniehebelauf', 'Kniehebelauf', array['Ausdauer','Sprung']::text[], '{}'::text[]),
  ('kreuzheben', 'Kreuzheben', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('kurzhantel-bankdrücken', 'Kurzhantel-Bankdrücken', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('langhantelrudern', 'Langhantelrudern', array['Pull','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('latzug', 'Latzug', array['Pull','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('laufen', 'Laufen', array['Ausdauer']::text[], '{}'::text[]),
  ('laufen locker', 'Laufen locker', array['Ausdauer']::text[], '{}'::text[]),
  ('liegestütze', 'Liegestütze', array['Push','Oberkörper','Mehrgelenkig']::text[], array['Liegestütz']::text[]),
  ('liegestütze auf knien', 'Liegestütze auf Knien', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('medizinball-brustpass', 'Medizinball-Brustpass', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('medizinball-slam', 'Medizinball-Slam', array['Rumpf','Mehrgelenkig']::text[], '{}'::text[]),
  ('nordic curl', 'Nordic Curl', array['Beine']::text[], array['Nordic Curl exzentrisch']::text[]),
  ('pallof press', 'Pallof Press', array['Rumpf']::text[], '{}'::text[]),
  ('plyo-liegestütz', 'Plyo-Liegestütz', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('pogo jumps', 'Pogo Jumps', array['Sprung','Beine']::text[], '{}'::text[]),
  ('power clean', 'Power Clean', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('push press', 'Push Press', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('reverse fly', 'Reverse Fly', array['Pull','Oberkörper']::text[], '{}'::text[]),
  ('reverse nordic leicht', 'Reverse Nordic leicht', array['Beine']::text[], '{}'::text[]),
  ('rudern am kabel', 'Rudern am Kabel', array['Pull','Oberkörper','Mehrgelenkig']::text[], array['Sitzendes Rudern']::text[]),
  ('rudern einarmig', 'Rudern einarmig', array['Pull','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('rumänisches kreuzheben', 'Rumänisches Kreuzheben', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], array['Romanian Deadlift']::text[]),
  ('rumänisches kreuzheben kurzhantel', 'Rumänisches Kreuzheben Kurzhantel', array['Pull','Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('schlitten schieben', 'Schlitten schieben', array['Beine','Mehrgelenkig','Ausdauer']::text[], array['Sled Push']::text[]),
  ('schlitten ziehen', 'Schlitten ziehen', array['Beine','Mehrgelenkig','Ausdauer']::text[], '{}'::text[]),
  ('schrägbankdrücken', 'Schrägbankdrücken', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('schulter-dislocates', 'Schulter-Dislocates', array['Mobility','Oberkörper']::text[], '{}'::text[]),
  ('schulterdrücken', 'Schulterdrücken', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('schulterdrücken im sitz', 'Schulterdrücken im Sitz', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('schulterdrücken stehend', 'Schulterdrücken stehend', array['Push','Oberkörper','Mehrgelenkig']::text[], '{}'::text[]),
  ('seitheben', 'Seitheben', array['Push','Oberkörper']::text[], '{}'::text[]),
  ('seitlicher ausfallschritt', 'Seitlicher Ausfallschritt', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('seitstütz', 'Seitstütz', array['Rumpf']::text[], '{}'::text[]),
  ('seitstütz mit beinheben', 'Seitstütz mit Beinheben', array['Rumpf']::text[], '{}'::text[]),
  ('skater jumps', 'Skater Jumps', array['Sprung','Beine']::text[], '{}'::text[]),
  ('spanish squat isometrisch', 'Spanish Squat isometrisch', array['Beine']::text[], '{}'::text[]),
  ('split squat', 'Split Squat', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('steigerungsläufe', 'Steigerungsläufe', array['Ausdauer']::text[], '{}'::text[]),
  ('step-down langsam', 'Step-down langsam', array['Beine']::text[], '{}'::text[]),
  ('step-ups', 'Step-ups', array['Beine','Glutes','Mehrgelenkig']::text[], array['Step-ups mit Gewicht']::text[]),
  ('tempo', 'Tempo', array['Ausdauer']::text[], '{}'::text[]),
  ('thorax-rotation', 'Thorax-Rotation', array['Mobility']::text[], '{}'::text[]),
  ('thruster → burpee-box-step-over', 'Thruster → Burpee-Box-Step-Over', array['Beine','Glutes','Mehrgelenkig']::text[], '{}'::text[]),
  ('tibialis raises', 'Tibialis Raises', array['Beine']::text[], '{}'::text[]),
  ('trizepsdrücken', 'Trizepsdrücken', array['Push','Arme']::text[], '{}'::text[]),
  ('umgekehrte crunches', 'Umgekehrte Crunches', array['Rumpf']::text[], '{}'::text[]),
  ('unterarmstütz', 'Unterarmstütz', array['Rumpf']::text[], '{}'::text[]),
  ('vorgebeugtes seitheben', 'Vorgebeugtes Seitheben', array['Pull','Oberkörper']::text[], '{}'::text[]),
  ('wadenheben', 'Wadenheben', array['Beine']::text[], '{}'::text[]),
  ('wadenheben einbeinig', 'Wadenheben einbeinig', array['Beine']::text[], '{}'::text[]),
  ('wadenheben einbeinig mit gewicht', 'Wadenheben einbeinig mit Gewicht', array['Beine']::text[], '{}'::text[]),
  ('wadenheben langsam', 'Wadenheben langsam', array['Beine']::text[], '{}'::text[]),
  ('wadenheben mit gebeugtem knie', 'Wadenheben mit gebeugtem Knie', array['Beine']::text[], '{}'::text[]),
  ('walking lunges', 'Walking Lunges', array['Beine','Glutes','Mehrgelenkig']::text[], array['Ausfallschritte']::text[]),
  ('wall slides', 'Wall Slides', array['Mobility','Oberkörper']::text[], '{}'::text[]),
  ('weitsprung', 'Weitsprung', array['Sprung','Beine']::text[], array['Broad Jump']::text[]),
  ('world''s greatest stretch', 'World''s Greatest Stretch', array['Mobility']::text[], '{}'::text[]),
  ('überkopf-trizeps', 'Überkopf-Trizeps', array['Push','Arme']::text[], '{}'::text[])
on conflict (name_key) do update
  set name = excluded.name,
      labels = (select array(select distinct unnest(go_exercise_catalog.labels || excluded.labels))),
      aliases = (select array(select distinct unnest(go_exercise_catalog.aliases || excluded.aliases)));

-- ---------- andere Schreibweisen → ein Name ----------

-- Map alte Schreibweise → Name (ohne Hilfstabelle, der SQL-Editor behält keine temporären Tabellen)
do $$
declare
  v_map jsonb := '{"Ausfallschritte": "Walking Lunges", "Box Jumps": "Box Jump", "Broad Jump": "Weitsprung", "Bulgarian Split Squat": "Bulgarische Kniebeuge", "Cat-Cow": "Katze-Kuh", "Glute Bridge einbeinig": "Einbeiniges Hüftheben", "Hüftbeuger-Dehnung im Halbknien": "Hüftbeuger-Dehnung kniend", "Klimmzug": "Klimmzüge", "Liegestütz": "Liegestütze", "Nordic Curl exzentrisch": "Nordic Curl", "Romanian Deadlift": "Rumänisches Kreuzheben", "Sitzendes Rudern": "Rudern am Kabel", "Sled Push": "Schlitten schieben", "Step-ups mit Gewicht": "Step-ups"}'::jsonb;
  a record;
  s record;
  v_blocks jsonb;
begin
  -- Einheiten: Übungsnamen in blocks[].items[].name
  for s in select id, blocks from course_sessions where blocks is not null loop
    select coalesce(jsonb_agg(
             case when jsonb_typeof(bl->'items') = 'array' then
               jsonb_set(bl, '{items}', (
                 select coalesce(jsonb_agg(
                   case when it ? 'name' and v_map ? trim(it->>'name')
                        then jsonb_set(it, '{name}', v_map -> trim(it->>'name'))
                        else it end order by o2), '[]'::jsonb)
                 from jsonb_array_elements(bl->'items') with ordinality as t2(it, o2)))
             else bl end order by o1), '[]'::jsonb)
      into v_blocks
      from jsonb_array_elements(s.blocks) with ordinality as t1(bl, o1);
    if v_blocks is distinct from s.blocks then
      update course_sessions set blocks = v_blocks where id = s.id;
    end if;
  end loop;

  for a in select key as alias, value #>> '{}' as canon from jsonb_each(v_map) loop
    -- Videos von gogogo: nur übernehmen, wenn der Hauptname noch keins hat
    if to_regclass('public.go_exercise_media') is not null then
      update go_exercise_media m set name_key = lower(a.canon), name = a.canon
      where m.name_key = lower(a.alias)
        and not exists (select 1 from go_exercise_media x where x.name_key = lower(a.canon));
      delete from go_exercise_media where name_key = lower(a.alias);
    end if;
    -- Nutzer-Links
    if to_regclass('public.go_exercise_links') is not null then
      update go_exercise_links l set name_key = lower(a.canon), name = a.canon
      where l.name_key = lower(a.alias)
        and not exists (select 1 from go_exercise_links x where x.name_key = lower(a.canon) and x.url = l.url);
    end if;
    -- Tracking
    if exists (select 1 from information_schema.columns where table_name = 'go_workout_logs' and column_name = 'exercise_name') then
      execute 'update go_workout_logs set exercise_name = $1 where exercise_name = $2' using a.canon, a.alias;
    end if;
    if exists (select 1 from information_schema.columns where table_name = 'go_natalya_logs' and column_name = 'exercise_name') then
      execute 'update go_natalya_logs set exercise_name = $1 where exercise_name = $2' using a.canon, a.alias;
    end if;
    delete from go_exercise_catalog where name_key = lower(a.alias) and lower(a.alias) <> lower(a.canon);
  end loop;
end $$;

-- Kontrolle
select name, labels, aliases from go_exercise_catalog order by name;
