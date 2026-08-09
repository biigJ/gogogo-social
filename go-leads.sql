-- gogogo.social/go — Leads von QR / Instagram Bio
-- Im Supabase SQL Editor ausführen (gleiche Instanz wie die App).
--
-- Nach dem Anlegen: RLS prüfen. Für den Insert vom Browser (anon/publishable key)
-- braucht die Tabelle eine Insert Policy für anon, z.B.:
--   create policy "go_leads_insert_anon"
--     on go_leads for insert
--     to anon, authenticated
--     with check (true);

create table if not exists go_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  choice text not null check (choice in ('call', 'plan', 'trainer')),
  invite_code text,
  source text default 'qr',
  created_at timestamp default now()
);

alter table go_leads enable row level security;

drop policy if exists "go_leads_insert_anon" on go_leads;
create policy "go_leads_insert_anon"
  on go_leads for insert
  to anon, authenticated
  with check (true);
