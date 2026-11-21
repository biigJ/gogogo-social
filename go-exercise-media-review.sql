-- go-exercise-media-review.sql — Übungsfotos und Video-Links von Nutzern: erst nach Freigabe für alle sichtbar
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-exercise-links.sql, go-admin.sql.
--
-- Nutzer setzt unter Woche → Tage bearbeiten → Media ein Foto oder einen Video-Link:
--   sieht es sofort selbst, alle anderen erst nach Freigabe (Admin → Videos → Fotos und Videos von Nutzern).
-- Beim ersten Ausführen werden alle bestehenden Einträge als freigegeben übernommen (bleiben sichtbar wie bisher).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'go_exercise_links' and column_name = 'approved_at'
  ) then
    alter table go_exercise_links add column approved_at timestamptz;
    alter table go_exercise_links add column approved_by uuid references go_accounts(id) on delete set null;
    update go_exercise_links set approved_at = created_at;
  end if;
end $$;

create index if not exists go_exercise_links_pending_idx on go_exercise_links (created_at desc) where approved_at is null;

-- Lesen: freigegeben, eigene, oder Admin
drop policy if exists "go_exercise_links_select" on go_exercise_links;
create policy "go_exercise_links_select" on go_exercise_links for select to anon, authenticated
  using (approved_at is not null or added_by = go_current_account_id() or go_is_admin());

-- Freigeben: nur Admin
drop policy if exists "go_exercise_links_update_admin" on go_exercise_links;
create policy "go_exercise_links_update_admin" on go_exercise_links for update to anon, authenticated
  using (go_is_admin()) with check (go_is_admin());

-- Sterne nur auf sichtbare Links (bleibt über die Link-Policy geschützt); View um approved_at ergänzt
create or replace view go_exercise_links_ranked with (security_invoker = true) as
select l.id, l.name_key, l.name, l.url, l.added_by, l.created_at,
       (select count(*) from go_exercise_link_stars s where s.link_id = l.id)::int as stars,
       (select a.name from go_accounts a where a.id = l.added_by) as added_by_name,
       l.approved_at
from go_exercise_links l;

grant select on go_exercise_links_ranked to anon, authenticated;
