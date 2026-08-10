-- gogogo.social/go — Leads von QR / Instagram Bio
-- Im Supabase SQL Editor ausführen (gleiche Instanz wie die App).
--
-- Nach dem Anlegen: RLS prüfen. Für den Insert vom Browser (anon/publishable key)
-- braucht die Tabelle eine Insert Policy für anon, z.B.:
--   create policy "go_leads_insert_anon"
--     on go_leads for insert
--     to anon, authenticated
--     with check (true);
--
-- Wenn die Tabelle schon existiert und choice noch auf call/plan/trainer begrenzt ist:
--   alter table go_leads drop constraint if exists go_leads_choice_check;
--   alter table go_leads alter column choice set default 'challenge';
--   alter table go_leads add constraint go_leads_choice_check
--     check (choice in ('challenge', 'call', 'plan', 'trainer'));

create table if not exists go_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  choice text not null default 'challenge'
    check (choice in ('challenge', 'call', 'plan', 'trainer')),
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
