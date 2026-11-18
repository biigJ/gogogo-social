-- go-friends-feed.sql — Freunde ohne Obergrenze, im Aktuell-Feed höchstens 12
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Ersetzt die Sperre aus go-friends-limit.sql.
--
-- go_friends.in_feed: true = erscheint in meinem Aktuell-Feed (höchstens 12, Coach/Coachees zählen nicht)
--                     false = verbunden (Leaderboard, Gruppe, Partner-Wahl), aber nicht im Feed
-- Neue Freundschaft: ist der Feed voll, wird sie automatisch mit in_feed = false angelegt statt abgelehnt.

alter table go_friends add column if not exists in_feed boolean not null default true;

create or replace function go_friends_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if exists (
    select 1 from go_accounts a
    where (a.id = new.friend_id and a.trainer_id = new.account_id)
       or (a.id = new.account_id and a.trainer_id = new.friend_id)
  ) then
    new.in_feed := true;
    return new;
  end if;
  if not coalesce(new.in_feed, true) then
    return new;
  end if;
  select count(*) into v_count
  from go_friends f
  where f.account_id = new.account_id
    and f.in_feed
    and f.friend_id is distinct from new.friend_id
    and not exists (
      select 1 from go_accounts a
      where (a.id = f.friend_id and a.trainer_id = f.account_id)
         or (a.id = f.account_id and a.trainer_id = f.friend_id)
    );
  if v_count >= 12 then
    new.in_feed := false;
  end if;
  return new;
end;
$$;

drop trigger if exists go_friends_limit on go_friends;
create trigger go_friends_limit
  before insert or update of in_feed on go_friends
  for each row execute function go_friends_limit();

-- eigene Zeilen ändern dürfen (im Feed an/aus)
drop policy if exists "go_friends_update_own" on go_friends;
create policy "go_friends_update_own" on go_friends for update to anon, authenticated
  using (account_id = go_current_account_id()) with check (account_id = go_current_account_id());
