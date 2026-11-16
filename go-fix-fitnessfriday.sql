-- go-fix-fitnessfriday.sql
-- Einmalige Reparatur: "FitnessFriday" wurde beim FFC-Abgleich doppelt angelegt (Joscha und Ben).
-- Die älteste Gruppe bleibt, alle Mitglieder der Duplikate wandern dorthin, Duplikate werden gelöscht.
-- Idempotent: läuft ohne Duplikate einfach durch.

do $$
declare
  v_keep uuid;
begin
  select id into v_keep from groups
  where lower(trim(name)) = 'fitnessfriday'
  order by created_at asc limit 1;
  if v_keep is null then
    raise notice 'Keine FitnessFriday-Gruppe gefunden';
    return;
  end if;

  -- Gründer der Duplikate als Mitglied übernehmen
  insert into group_members (group_id, account_id, role)
  select v_keep, g.created_by, 'member'
  from groups g
  where lower(trim(g.name)) = 'fitnessfriday' and g.id <> v_keep and g.created_by is not null
  on conflict do nothing;

  -- Mitglieder der Duplikate übernehmen
  insert into group_members (group_id, account_id, role)
  select v_keep, m.account_id, 'member'
  from group_members m
  join groups g on g.id = m.group_id
  where lower(trim(g.name)) = 'fitnessfriday' and g.id <> v_keep
  on conflict do nothing;

  -- Events, die auf ein Duplikat zeigen, umhängen
  if exists (select 1 from information_schema.columns where table_name = 'events' and column_name = 'group_id') then
    update events set group_id = v_keep
    where group_id in (select id from groups where lower(trim(name)) = 'fitnessfriday' and id <> v_keep);
  end if;

  delete from group_members
  where group_id in (select id from groups where lower(trim(name)) = 'fitnessfriday' and id <> v_keep);
  delete from groups where lower(trim(name)) = 'fitnessfriday' and id <> v_keep;
end $$;

-- Kurzcheck: eine Gruppe, Mitglieder
select g.name, a.name as mitglied, m.role
from groups g
join group_members m on m.group_id = g.id
left join go_accounts a on a.id = m.account_id
where lower(trim(g.name)) = 'fitnessfriday'
order by m.role, a.name;
