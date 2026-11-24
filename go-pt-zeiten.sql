-- go-pt-zeiten.sql — Verfügbare Zeiten des Coaches für Personal Training (pt-calendar.js, Zahnrad)
-- Idempotent. Voraussetzung: go-pt-kalender.sql, go_current_account_id().
-- hours: {"daily":[7,21],"days":{"1":[9,18],"2":[9,18],...}}  Schlüssel = Wochentag (0 = So), fehlend = nicht verfügbar
-- mode: daily = jeden Tag gleich, weekday = je Wochentag. Ohne Zeile ist alles von 7 bis 21 Uhr frei.

create table if not exists go_coach_hours (
  coach_id uuid primary key references go_accounts(id) on delete cascade,
  mode text not null default 'daily',
  hours jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint go_coach_hours_mode_check check (mode in ('daily', 'weekday'))
);
alter table go_coach_hours enable row level security;
drop policy if exists "coach_hours_read" on go_coach_hours;
create policy "coach_hours_read" on go_coach_hours for select to anon, authenticated using (true);
drop policy if exists "coach_hours_own" on go_coach_hours;
create policy "coach_hours_own" on go_coach_hours for all to anon, authenticated
  using (coach_id = go_current_account_id()) with check (coach_id = go_current_account_id());
