-- go-stamp-group-leave.sql — Gruppen-Stempelkarte nur für Mitglieder
-- Idempotent. Voraussetzung: go-challenges.sql (go_stamp_links), go-stamp-group-event.sql.
--
-- Bisher blieb die verknüpfte Gruppen-Karte stehen, wenn jemand die Gruppe verließ oder entfernt wurde
-- (z. B. Karte „Mittagstraining“ ohne Mitgliedschaft). Jetzt:
-- go_stamp_links_left_group()  Trigger: Mitglied raus (Zeile gelöscht oder Status nicht mehr accepted) → Karte weg
-- go_stamp_links_group_gone()  Trigger: Gruppe gelöscht → Karten dieser Gruppe weg
-- Aufräumen: bestehende Gruppen-Karten ohne Mitgliedschaft löschen

create or replace function go_stamp_links_left_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from go_stamp_links where kind = 'group' and ref = old.group_id::text and account_id = old.account_id;
    return old;
  end if;
  if coalesce(new.status, 'accepted') <> 'accepted' then
    delete from go_stamp_links where kind = 'group' and ref = new.group_id::text and account_id = new.account_id;
  end if;
  return new;
end $$;

drop trigger if exists go_stamp_links_left_group on group_members;
create trigger go_stamp_links_left_group
  after delete or update of status on group_members
  for each row execute function go_stamp_links_left_group();

create or replace function go_stamp_links_group_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from go_stamp_links where kind = 'group' and ref = old.id::text;
  return old;
end $$;

drop trigger if exists go_stamp_links_group_gone on groups;
create trigger go_stamp_links_group_gone
  after delete on groups
  for each row execute function go_stamp_links_group_gone();

-- Aufräumen: Gruppen-Karten ohne angenommene Mitgliedschaft
delete from go_stamp_links l
where l.kind = 'group'
  and not exists (
    select 1 from group_members m
    where m.group_id::text = l.ref and m.account_id = l.account_id and m.status = 'accepted'
  );
