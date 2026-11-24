-- go-stamp-group-event.sql — Stempel beim Gruppentraining zählen auf der Gruppen-Karte
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-challenges.sql, go-stamp-punctual.sql, go-circle-events.sql.
--
-- Bisher: Stempel auf verknüpfte Karten nur, wenn BEIDE (Karteninhaber und Scannender) die Karte verknüpft hatten.
-- Neu: Gehört das Event zu einer Gruppe (events.group_id) oder einem Circle (events.circle_id),
-- bekommt jede Seite den Stempel auf ihrer eigenen verknüpften Karte dieser Gruppe bzw. dieses Circles.
-- Dazu: Wer einer Gruppe mit laufender Challenge (Stempelkarten verknüpft) beitritt, bekommt die Karte zur Bestätigung (pending).

create or replace function go_stamp_links_award()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g text;
  c text;
begin
  if new.done_at is null or old.done_at is not null then return new; end if;
  select e.group_id::text, e.circle_id into g, c from events e where e.id = new.event_id;
  if coalesce(new.owner_added, 0) > 0 then
    update go_stamp_links l set stamps = least(12, l.stamps + new.owner_added)
    where l.account_id = new.owner_id and l.status = 'linked'
      and ((l.kind = 'group' and l.ref = g) or (l.kind = 'circle' and l.ref = c)
        or exists (select 1 from go_stamp_links p
                   where p.account_id = new.scanner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref));
  end if;
  if coalesce(new.scanner_added, 0) > 0 then
    update go_stamp_links l set stamps = least(12, l.stamps + new.scanner_added)
    where l.account_id = new.scanner_id and l.status = 'linked'
      and ((l.kind = 'group' and l.ref = g) or (l.kind = 'circle' and l.ref = c)
        or exists (select 1 from go_stamp_links p
                   where p.account_id = new.owner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref));
  end if;
  return new;
end $$;

drop trigger if exists go_stamp_links_award on go_stamp_checks;
create trigger go_stamp_links_award
  after update on go_stamp_checks
  for each row execute function go_stamp_links_award();

-- Neues Mitglied: Gruppen-Karte zur Bestätigung, wenn die Gruppe eine laufende Challenge mit verknüpften Karten hat
create or replace function go_stamp_links_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'accepted') <> 'accepted' then return new; end if;
  insert into go_stamp_links (account_id, kind, ref, name, challenge_id, invited_by, status)
  select new.account_id, 'group', ch.group_id::text, g.name, ch.id, ch.created_by, 'pending'
  from go_challenges ch join groups g on g.id = ch.group_id
  where ch.group_id = new.group_id and ch.ended_at is null and ch.link_stamps
  on conflict (account_id, kind, ref) do nothing;
  return new;
end $$;

drop trigger if exists go_stamp_links_new_member on group_members;
create trigger go_stamp_links_new_member
  after insert or update of status on group_members
  for each row execute function go_stamp_links_new_member();

-- Nachtrag für Mitglieder, die nach dem Anlegen der Challenge dazugekommen sind
insert into go_stamp_links (account_id, kind, ref, name, challenge_id, invited_by, status)
select m.account_id, 'group', ch.group_id::text, g.name, ch.id, ch.created_by, 'pending'
from go_challenges ch
join groups g on g.id = ch.group_id
join group_members m on m.group_id = ch.group_id and m.status = 'accepted'
where ch.ended_at is null and ch.link_stamps
on conflict (account_id, kind, ref) do nothing;
