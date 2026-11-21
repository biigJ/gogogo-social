-- go-circle-start-fix.sql — Leaderboard ab Gründung nur für Circles, die in der App gegründet wurden
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-circle-start.sql.
-- Fehler vorher: go_circles.created_at ist der Zeitpunkt, an dem ein Circle zum ersten Mal in gogogo auftauchte.
-- Bei alten Circles (FitnessFriday) war das heute → Leaderboard zeigte nur Workouts ab heute.
-- Jetzt zählt created_at nur, wenn started_in_app = true (gesetzt beim Gründen in der App über go_circle_started).

alter table go_circles add column if not exists started_in_app boolean not null default false;

create or replace function go_circle_started(p_group text, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := go_current_account_id();
begin
  if me is null or coalesce(trim(p_group), '') = '' then raise exception 'login'; end if;
  insert into go_circles (group_id, name, owner_id, created_at, started_in_app)
  values (trim(p_group), coalesce(trim(p_name), ''), me, now(), true)
  on conflict (group_id) do update
    set started_in_app = true,
        created_at = coalesce(go_circles.created_at, now()),
        owner_id = coalesce(go_circles.owner_id, excluded.owner_id),
        name = case when coalesce(excluded.name, '') <> '' then excluded.name else go_circles.name end;
  return 'ok';
end $$;
grant execute on function go_circle_started(text, text) to anon, authenticated;
