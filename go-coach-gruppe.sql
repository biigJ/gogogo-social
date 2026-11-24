-- go-coach-gruppe.sql — Coach-Gruppe: Coach und seine Kunden (trainer_id) als eigene Gruppe in Kreise (coach-group.js)
-- Idempotent. Voraussetzung: go-event-invites.sql, go-nutzer-papierkorb.sql.
--
-- events.coach_group            Event der Coach-Gruppe (vom Coach angelegt, Kunden per Einladung)
-- go_coach_group_open           Haken „offen für Gruppentraining“ je Kunde
-- go_coach_group_members(coach) Wer wen sieht: Coach alle Kunden; Kunde mit Haken die anderen mit Haken; ohne Haken niemanden

alter table events add column if not exists coach_group boolean not null default false;

create table if not exists go_coach_group_open (
  account_id uuid primary key references go_accounts(id) on delete cascade,
  coach_id uuid references go_accounts(id) on delete cascade,
  is_open boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table go_coach_group_open enable row level security;
drop policy if exists "coach_group_open_own" on go_coach_group_open;
create policy "coach_group_open_own" on go_coach_group_open for all to anon, authenticated
  using (account_id = go_current_account_id()) with check (account_id = go_current_account_id());

create or replace function go_coach_group_members(p_coach uuid)
returns table (id uuid, name text, nickname text, photo_url text, is_open boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  v_open boolean;
begin
  if v_me is null or p_coach is null then return; end if;
  if v_me = p_coach then
    return query
      select a.id, a.name, a.nickname, a.photo_url, coalesce(o.is_open, false)
        from go_accounts a
        left join go_coach_group_open o on o.account_id = a.id and o.coach_id = p_coach
       where a.trainer_id = p_coach and a.deleted_at is null
       order by a.name;
    return;
  end if;
  if not exists (select 1 from go_accounts g where g.id = v_me and g.trainer_id = p_coach) then return; end if;
  select coalesce(o.is_open, false) into v_open from go_coach_group_open o where o.account_id = v_me and o.coach_id = p_coach;
  if not coalesce(v_open, false) then return; end if;
  return query
    select a.id, a.name, a.nickname, a.photo_url, true
      from go_accounts a
      join go_coach_group_open o on o.account_id = a.id and o.coach_id = p_coach and o.is_open
     where a.trainer_id = p_coach and a.deleted_at is null and a.id <> v_me
     order by a.name;
end $$;
grant execute on function go_coach_group_members(uuid) to anon, authenticated;
