-- Historie des Zirkeltraining-Wochentags (immutable).
-- Nach Plan speichern: neuer Wochentag gilt für vergangene und bereits
-- abgehakte Tage; neu nur für noch offene Tage.
-- Im Supabase SQL Editor ausführen.

create table if not exists go_coach_zirkel_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  zirkel_weekday smallint not null check (zirkel_weekday >= 0 and zirkel_weekday <= 6),
  effective_from date not null,
  created_at timestamptz not null default now()
);

create index if not exists go_coach_zirkel_history_lookup_idx
  on go_coach_zirkel_history (account_id, effective_from desc, created_at desc);

alter table go_coach_zirkel_history enable row level security;

drop policy if exists "go_coach_zirkel_history_select_anon" on go_coach_zirkel_history;
create policy "go_coach_zirkel_history_select_anon"
  on go_coach_zirkel_history for select
  to anon, authenticated
  using (true);

drop policy if exists "go_coach_zirkel_history_insert_anon" on go_coach_zirkel_history;
create policy "go_coach_zirkel_history_insert_anon"
  on go_coach_zirkel_history for insert
  to anon, authenticated
  with check (true);

-- Kein UPDATE/DELETE für anon: Einträge sind archiviert und nicht widerrufbar.

-- Bestehende Pläne einmalig als Historie ab 2000-01-01 übernehmen.
insert into go_coach_zirkel_history (account_id, zirkel_weekday, effective_from)
select p.account_id, coalesce(p.zirkel_weekday, 4), date '2000-01-01'
from go_coach_plans p
where not exists (
  select 1
  from go_coach_zirkel_history h
  where h.account_id = p.account_id
);
