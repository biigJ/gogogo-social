-- gogogo lead codes, accounts, WhatsApp jobs
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Storage: Bucket "go-avatars" (public) — SQL unten legt ihn an.
--
-- RLS: anon darf Codes lesen (Validierung), anlegen nur über Admin-Client
-- (Admin-UI nutzt denselben publishable Key — Codes sind nicht geheim,
--  Admin-Gate ist clientseitig biigJ + PIN). Für Produktion später
--  Service-Role / Edge Function nachziehen.

-- Bestehende go_leads: choice um 'challenge' erweitern falls nötig
-- alter table go_leads drop constraint if exists go_leads_choice_check;
-- alter table go_leads add constraint go_leads_choice_check
--   check (choice in ('challenge', 'call', 'plan', 'trainer'));

create table if not exists go_invite_codes (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  serial_number text not null,
  code text not null unique,
  paused boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists go_invite_codes_code_idx on go_invite_codes (code);

create table if not exists go_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  invite_code text,
  serial_number text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists go_accounts_invite_idx on go_accounts (invite_code);
create index if not exists go_accounts_phone_idx on go_accounts (phone);

-- Jobs für WhatsApp-Gruppen-Agent (parallel zur Account-Erstellung)
create table if not exists go_wa_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references go_accounts(id) on delete set null,
  name text not null,
  phone text not null,
  invite_code text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists go_wa_jobs_status_idx on go_wa_jobs (status, created_at);

alter table go_invite_codes enable row level security;
alter table go_accounts enable row level security;
alter table go_wa_jobs enable row level security;

drop policy if exists "go_invite_codes_select_anon" on go_invite_codes;
create policy "go_invite_codes_select_anon"
  on go_invite_codes for select
  to anon, authenticated
  using (true);

drop policy if exists "go_invite_codes_insert_anon" on go_invite_codes;
create policy "go_invite_codes_insert_anon"
  on go_invite_codes for insert
  to anon, authenticated
  with check (true);

alter table go_invite_codes
  add column if not exists paused boolean not null default false;

drop policy if exists "go_invite_codes_update_anon" on go_invite_codes;
create policy "go_invite_codes_update_anon"
  on go_invite_codes for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_invite_codes_delete_anon" on go_invite_codes;
create policy "go_invite_codes_delete_anon"
  on go_invite_codes for delete
  to anon, authenticated
  using (true);

create or replace function pause_go_invite(p_id uuid, p_paused boolean)
returns go_invite_codes
language sql
security definer
set search_path = public
as $$
  update go_invite_codes
  set paused = coalesce(p_paused, true)
  where id = p_id
  returning *;
$$;

create or replace function delete_go_invite(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from go_invite_codes where id = p_id;
$$;

grant execute on function pause_go_invite(uuid, boolean) to anon, authenticated;
grant execute on function delete_go_invite(uuid) to anon, authenticated;

drop policy if exists "go_accounts_select_anon" on go_accounts;
create policy "go_accounts_select_anon"
  on go_accounts for select
  to anon, authenticated
  using (true);

drop policy if exists "go_accounts_insert_anon" on go_accounts;
create policy "go_accounts_insert_anon"
  on go_accounts for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_accounts_update_anon" on go_accounts;
create policy "go_accounts_update_anon"
  on go_accounts for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_wa_jobs_insert_anon" on go_wa_jobs;
create policy "go_wa_jobs_insert_anon"
  on go_wa_jobs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_wa_jobs_select_anon" on go_wa_jobs;
create policy "go_wa_jobs_select_anon"
  on go_wa_jobs for select
  to anon, authenticated
  using (true);

drop policy if exists "go_wa_jobs_update_anon" on go_wa_jobs;
create policy "go_wa_jobs_update_anon"
  on go_wa_jobs for update
  to anon, authenticated
  using (true)
  with check (true);

-- Profilfotos: öffentlicher Bucket + Upload für anon
insert into storage.buckets (id, name, public)
values ('go-avatars', 'go-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "go_avatars_select" on storage.objects;
create policy "go_avatars_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'go-avatars');

drop policy if exists "go_avatars_insert" on storage.objects;
create policy "go_avatars_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'go-avatars');

drop policy if exists "go_avatars_update" on storage.objects;
create policy "go_avatars_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'go-avatars')
  with check (bucket_id = 'go-avatars');
