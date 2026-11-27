-- go-schritte-10000.sql — Einzeleinheit „> 10.000 Schritte“ (Kopie von „> 5.000 Schritte“)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.

do $$
declare
  v_src uuid;
  v_new uuid;
begin
  if exists (select 1 from courses where slug = 'schritte-10000') then
    raise notice '> 10.000 Schritte gibt es schon';
    return;
  end if;
  select id into v_src from courses where title in ('> 7.500 Schritte', '> 5.000 Schritte') order by created_at limit 1;
  if v_src is null then
    raise exception 'Vorlage „> 7.500 Schritte“ fehlt';
  end if;
  v_new := gen_random_uuid();

  insert into courses
  select (jsonb_populate_record(c, jsonb_build_object(
    'id', v_new, 'slug', 'schritte-10000', 'title', '> 10.000 Schritte', 'created_at', now(), 'image_url', null
  ))).*
  from courses c where c.id = v_src;

  insert into course_sessions
  select (jsonb_populate_record(s, jsonb_build_object(
    'id', gen_random_uuid(), 'course_id', v_new, 'title', '> 10.000 Schritte', 'updated_at', now(),
    'blocks', '[{"type":"ausdauer","items":[{"name":"Gehen","note":"mindestens 10.000 Schritte über den Tag"}]}]'::jsonb
  ))).*
  from course_sessions s where s.course_id = v_src and s.block_no = 1 and not s.is_travel;

  raise notice '> 10.000 Schritte angelegt: %', v_new;
end $$;
