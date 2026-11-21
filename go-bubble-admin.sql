-- go-bubble-admin.sql — Admin darf Bubbles bearbeiten (Foto, Farbe, Text), auch Start-Bubbles ohne Ersteller
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-bubbles.sql, go-admin.sql.

drop policy if exists "go_bubbles_update_admin" on go_bubbles;
create policy "go_bubbles_update_admin" on go_bubbles for update to anon, authenticated
  using (go_is_admin()) with check (go_is_admin());

-- Foto für HYROX (nur wenn noch keins gesetzt ist)
update go_bubbles
set photo_url = 'https://agpysewcsakdpmpftndp.supabase.co/storage/v1/object/public/go-covers/bubbles/hyrox-1795271821.jpg'
where lower(name) = 'hyrox' and photo_url is null;
