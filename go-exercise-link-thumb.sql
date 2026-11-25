-- go-exercise-link-thumb.sql — Vorschaubild je Video-Link (Instagram-Startbild, Edge Function go-ig-thumb).
-- Idempotent. Voraussetzung: go-exercise-links.sql, go-covers-bucket.sql.
alter table go_exercise_links add column if not exists thumb_url text;

create or replace view go_exercise_links_ranked with (security_invoker = true) as
  select l.id, l.name_key, l.name, l.url, l.added_by, l.created_at,
         (select count(*) from go_exercise_link_stars s where s.link_id = l.id)::integer as stars,
         (select a.name from go_accounts a where a.id = l.added_by) as added_by_name,
         l.approved_at,
         l.thumb_url
  from go_exercise_links l;
