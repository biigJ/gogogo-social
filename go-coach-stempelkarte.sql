-- go-coach-stempelkarte.sql — Coach-Stempelkarte je Coachee (Kreise → Coach, Kreise → Meine Coachees)
-- Idempotent. Voraussetzung: go-challenges.sql, go-stamp-group-event.sql, go-coach-gruppe.sql.
--
-- go_stamp_links kind 'coach', ref = Coach-ID: eigene Karte des Coachees bei seinem Coach (12 Felder)
--   wird angelegt, sobald trainer_id gesetzt ist (Trigger + Nachtrag für bestehende Coachees)
-- Stempel: QR-Scan beim gemeinsamen Event (go_stamp_checks). Ist eine Seite der Coach der anderen,
--   bekommt der Coachee den Stempel auf die Coach-Karte. Gruppen- und Circle-Karten bleiben getrennt,
--   zwei Coachees desselben Coaches stempeln sich nicht gegenseitig auf die Coach-Karte.
-- go_coach_cards(coach)         Coach sieht die Karten seiner Coachees (Stempel, bezahlt am, Karte Nr.)
-- go_coach_card_paid(coachee)   Coach: „bar bezahlt“ → neue Karte (Stempel 0, Karte Nr. + 1)

alter table go_stamp_links drop constraint if exists go_stamp_links_kind_check;
alter table go_stamp_links add constraint go_stamp_links_kind_check check (kind in ('group', 'circle', 'coach'));
alter table go_stamp_links add column if not exists paid_at timestamptz;
alter table go_stamp_links add column if not exists card_no int not null default 1;

create or replace function go_coach_card_ensure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trainer_id is null or new.trainer_id = new.id then return new; end if;
  if tg_op = 'UPDATE' and old.trainer_id is not distinct from new.trainer_id then return new; end if;
  insert into go_stamp_links (account_id, kind, ref, name, status, stamps)
  select new.id, 'coach', new.trainer_id::text, 'Coach ' || split_part(coalesce(c.name, ''), ' ', 1), 'linked', 0
    from go_accounts c where c.id = new.trainer_id
  on conflict (account_id, kind, ref) do nothing;
  return new;
end $$;

drop trigger if exists go_coach_card_ensure on go_accounts;
create trigger go_coach_card_ensure
  after insert or update of trainer_id on go_accounts
  for each row execute function go_coach_card_ensure();

-- Nachtrag: bestehende Coachees
insert into go_stamp_links (account_id, kind, ref, name, status, stamps)
select a.id, 'coach', a.trainer_id::text, 'Coach ' || split_part(coalesce(c.name, ''), ' ', 1), 'linked', 0
  from go_accounts a join go_accounts c on c.id = a.trainer_id
 where a.trainer_id is not null and a.trainer_id <> a.id
on conflict (account_id, kind, ref) do nothing;

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
    where l.account_id = new.owner_id and l.status = 'linked' and l.kind <> 'coach'
      and ((l.kind = 'group' and l.ref = g) or (l.kind = 'circle' and l.ref = c)
        or exists (select 1 from go_stamp_links p
                   where p.account_id = new.scanner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref));
    -- Coach-Karte: der Scannende ist Coach des Karteninhabers
    update go_stamp_links l set stamps = least(12, l.stamps + new.owner_added)
    where l.account_id = new.owner_id and l.kind = 'coach' and l.ref = new.scanner_id::text
      and exists (select 1 from go_accounts a where a.id = new.owner_id and a.trainer_id = new.scanner_id);
  end if;
  if coalesce(new.scanner_added, 0) > 0 then
    update go_stamp_links l set stamps = least(12, l.stamps + new.scanner_added)
    where l.account_id = new.scanner_id and l.status = 'linked' and l.kind <> 'coach'
      and ((l.kind = 'group' and l.ref = g) or (l.kind = 'circle' and l.ref = c)
        or exists (select 1 from go_stamp_links p
                   where p.account_id = new.owner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref));
    -- Coach-Karte: der Karteninhaber (QR) ist Coach des Scannenden
    update go_stamp_links l set stamps = least(12, l.stamps + new.scanner_added)
    where l.account_id = new.scanner_id and l.kind = 'coach' and l.ref = new.owner_id::text
      and exists (select 1 from go_accounts a where a.id = new.scanner_id and a.trainer_id = new.owner_id);
  end if;
  return new;
end $$;

create or replace function go_coach_cards(p_coach uuid)
returns table (account_id uuid, stamps int, paid_at timestamptz, card_no int)
language sql
stable
security definer
set search_path = public
as $$
  select l.account_id, l.stamps, l.paid_at, l.card_no
    from go_stamp_links l
    join go_accounts a on a.id = l.account_id and a.trainer_id = p_coach
   where l.kind = 'coach' and l.ref = p_coach::text
     and p_coach = go_current_account_id();
$$;
grant execute on function go_coach_cards(uuid) to anon, authenticated;

create or replace function go_coach_card_paid(p_coachee uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  v_no int;
begin
  if v_me is null or not exists (select 1 from go_accounts where id = p_coachee and trainer_id = v_me) then
    raise exception 'not_coach';
  end if;
  insert into go_stamp_links (account_id, kind, ref, name, status, stamps)
  select p_coachee, 'coach', v_me::text, 'Coach ' || split_part(coalesce(c.name, ''), ' ', 1), 'linked', 0
    from go_accounts c where c.id = v_me
  on conflict (account_id, kind, ref) do nothing;
  update go_stamp_links set stamps = 0, paid_at = now(), card_no = card_no + 1
   where account_id = p_coachee and kind = 'coach' and ref = v_me::text
  returning card_no into v_no;
  return v_no;
end $$;
grant execute on function go_coach_card_paid(uuid) to anon, authenticated;
