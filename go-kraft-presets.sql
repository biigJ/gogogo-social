-- Trainer-Vorauswahl für Kraft-Einheiten (Haken hinter der Übung in der App)
-- Im Supabase SQL Editor ausführen (gleiche Instanz: agpysewcsakdpmpftndp).

create table if not exists go_kraft_presets (
  account_id uuid not null references go_accounts(id) on delete cascade,
  system_id text not null,
  exercise_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (account_id, system_id)
);

create index if not exists go_kraft_presets_account_idx
  on go_kraft_presets (account_id);

alter table go_kraft_presets enable row level security;

drop policy if exists "go_kraft_presets_select_anon" on go_kraft_presets;
create policy "go_kraft_presets_select_anon"
  on go_kraft_presets for select
  to anon, authenticated
  using (true);

drop policy if exists "go_kraft_presets_insert_anon" on go_kraft_presets;
create policy "go_kraft_presets_insert_anon"
  on go_kraft_presets for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_kraft_presets_update_anon" on go_kraft_presets;
create policy "go_kraft_presets_update_anon"
  on go_kraft_presets for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "go_kraft_presets_delete_anon" on go_kraft_presets;
create policy "go_kraft_presets_delete_anon"
  on go_kraft_presets for delete
  to anon, authenticated
  using (true);
