-- go-friends-limit.sql — höchstens 12 Freunde pro Account, Coachees zählen nicht mit
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Bestehende Freundschaften bleiben, die Grenze gilt nur für neue.

create or replace function go_friends_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Coach ↔ Coachee ist immer erlaubt
  if exists (
    select 1 from go_accounts a
    where (a.id = new.friend_id and a.trainer_id = new.account_id)
       or (a.id = new.account_id and a.trainer_id = new.friend_id)
  ) then
    return new;
  end if;

  select count(*) into v_count
  from go_friends f
  where f.account_id = new.account_id
    and not exists (
      select 1 from go_accounts a
      where (a.id = f.friend_id and a.trainer_id = f.account_id)
         or (a.id = f.account_id and a.trainer_id = f.friend_id)
    );

  if v_count >= 12 then
    raise exception 'friend_limit: maximal 12 Freunde';
  end if;
  return new;
end;
$$;

drop trigger if exists go_friends_limit on go_friends;
create trigger go_friends_limit
  before insert on go_friends
  for each row execute function go_friends_limit();
