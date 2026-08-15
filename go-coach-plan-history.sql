-- Unveränderliche Wochentags-Historie für Coach-Pläne
-- Beim Überschreiben eines Tages im Admin: neuer Wert bleibt für
-- alle Kalendertage vor dem Änderungsdatum sichtbar (kein Widerruf).
-- Im Supabase SQL Editor ausführen.

create table if not exists go_coach_plan_day_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  day_key text not null check (
    day_key in ('day_mo', 'day_di', 'day_mi', 'day_do', 'day_fr', 'day_sa', 'day_so')
  ),
  body text,
  effective_from date not null,
  created_at timestamptz not null default now()
);

create index if not exists go_coach_plan_day_history_lookup_idx
  on go_coach_plan_day_history (account_id, day_key, effective_from desc, created_at desc);

alter table go_coach_plan_day_history enable row level security;

drop policy if exists "go_coach_plan_day_history_select_anon" on go_coach_plan_day_history;
create policy "go_coach_plan_day_history_select_anon"
  on go_coach_plan_day_history for select
  to anon, authenticated
  using (true);

drop policy if exists "go_coach_plan_day_history_insert_anon" on go_coach_plan_day_history;
create policy "go_coach_plan_day_history_insert_anon"
  on go_coach_plan_day_history for insert
  to anon, authenticated
  with check (true);

-- Kein UPDATE/DELETE für anon: Einträge sind archiviert und nicht widerrufbar.

-- Bestehende Plan-Tage einmalig als Historie ab 2000-01-01 übernehmen
-- (nur wenn für den Tag noch kein History-Eintrag existiert).
insert into go_coach_plan_day_history (account_id, day_key, body, effective_from)
select p.account_id, v.day_key, v.body, date '2000-01-01'
from go_coach_plans p
cross join lateral (
  values
    ('day_mo', p.day_mo),
    ('day_di', p.day_di),
    ('day_mi', p.day_mi),
    ('day_do', p.day_do),
    ('day_fr', p.day_fr),
    ('day_sa', p.day_sa),
    ('day_so', p.day_so)
) as v(day_key, body)
where v.body is not null
  and length(trim(v.body)) > 0
  and not exists (
    select 1
    from go_coach_plan_day_history h
    where h.account_id = p.account_id
      and h.day_key = v.day_key
  );
