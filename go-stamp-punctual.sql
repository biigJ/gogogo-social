-- go-stamp-punctual.sql — Stempel mit gegenseitiger Pünktlichkeit
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Voraussetzung: go-stamp-scan.sql, go-courses-support.sql, go-event-invites.sql.
--
-- Ablauf:
--   1. A tippt sein heutiges Event unter Aktuell an → Stempelkarte mit QR (?stamp=<A>&ev=<Event>).
--   2. B scannt → go_stamp_check_start: beide müssen eine Stempelkarte haben und beim Event dabei sein
--      (Ersteller, Zusage oder angenommene Einladung). B sagt, ob A pünktlich war.
--   3. A bestätigt, ob B pünktlich war (go_stamp_checks_open zeigt das an).
--   4. Sobald beide geantwortet haben: pünktlich = 2 Stempel, sonst 1. Pro Person und Event nur einmal (stamp_log).

create table if not exists go_stamp_checks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  owner_id uuid not null references go_accounts(id) on delete cascade,   -- zeigt die Karte
  scanner_id uuid not null references go_accounts(id) on delete cascade, -- scannt
  owner_punctual boolean,   -- Urteil des Scannenden über den Karteninhaber
  scanner_punctual boolean, -- Urteil des Karteninhabers über den Scannenden
  owner_added int,
  scanner_added int,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create unique index if not exists go_stamp_checks_pair_idx
  on go_stamp_checks (event_id, least(owner_id, scanner_id), greatest(owner_id, scanner_id));

alter table go_stamp_checks enable row level security;
drop policy if exists "go_stamp_checks_select" on go_stamp_checks;
create policy "go_stamp_checks_select" on go_stamp_checks for select to anon, authenticated
  using (owner_id = go_current_account_id() or scanner_id = go_current_account_id());
-- Schreiben nur über die Funktionen

create or replace function go_event_participant(p_event uuid, p_acc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from events e where e.id = p_event and e.user_id = p_acc)
      or exists (select 1 from event_rsvps r where r.event_id = p_event and r.user_id = p_acc and r.status = 'zugesagt')
      or exists (select 1 from go_workout_invites i where i.event_id = p_event and i.to_id = p_acc and i.status = 'accepted');
$$;

create or replace function go_stamp_card_order(p_acc uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id
  from support_orders o
  join support_products p on p.id = o.product_id
  where o.user_id = p_acc
    and p.type = 'stempelkarte'
    and o.status not in ('angefragt', 'cancelled')
  order by o.created_at desc
  limit 1;
$$;

-- Scan: Prüfen und Prüfung anlegen (oder vorhandene zurückgeben)
create or replace function go_stamp_check_start(p_owner uuid, p_event uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_event uuid := p_event;
  c go_stamp_checks%rowtype;
begin
  if v_me is null or p_owner is null then
    return jsonb_build_object('ok', false, 'reason', 'login');
  end if;
  if v_me = p_owner then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  if v_event is null then
    select e.id into v_event
    from events e
    where (e.starts_at at time zone 'Europe/Berlin')::date = v_today
      and coalesce(e.status, '') <> 'ausgefallen'
      and go_event_participant(e.id, p_owner)
      and go_event_participant(e.id, v_me)
    order by e.starts_at
    limit 1;
  elsif not exists (
    select 1 from events e
    where e.id = v_event
      and (e.starts_at at time zone 'Europe/Berlin')::date = v_today
      and coalesce(e.status, '') <> 'ausgefallen'
  ) then
    v_event := null;
  end if;

  if v_event is null or not go_event_participant(v_event, p_owner) then
    return jsonb_build_object('ok', false, 'reason', 'no_event');
  end if;
  if not go_event_participant(v_event, v_me) then
    return jsonb_build_object('ok', false, 'reason', 'not_joined');
  end if;
  if go_stamp_card_order(v_me) is null then
    return jsonb_build_object('ok', false, 'reason', 'no_card');
  end if;
  if go_stamp_card_order(p_owner) is null then
    return jsonb_build_object('ok', false, 'reason', 'owner_no_card');
  end if;

  insert into go_stamp_checks (event_id, owner_id, scanner_id)
  values (v_event, p_owner, v_me)
  on conflict do nothing;

  select * into c from go_stamp_checks
  where event_id = v_event
    and least(owner_id, scanner_id) = least(p_owner, v_me)
    and greatest(owner_id, scanner_id) = greatest(p_owner, v_me);

  if c.done_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;

  return jsonb_build_object(
    'ok', true,
    'check_id', c.id,
    'other_id', p_owner,
    'other_name', (select a.name from go_accounts a where a.id = p_owner),
    'event_title', (select e.title from events e where e.id = v_event),
    'ask', case
      when c.scanner_id = v_me and c.owner_punctual is null then true
      when c.owner_id = v_me and c.scanner_punctual is null then true
      else false end
  );
end;
$$;

-- Urteil abgeben; wenn beide geantwortet haben, Stempel vergeben
create or replace function go_stamp_check_verdict(p_check uuid, p_punctual boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  c go_stamp_checks%rowtype;
  v_order uuid;
  v_n int;
  v_added_owner int := 0;
  v_added_scanner int := 0;
begin
  select * into c from go_stamp_checks where id = p_check for update;
  if c.id is null or v_me is null or (v_me <> c.owner_id and v_me <> c.scanner_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if c.done_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;

  if v_me = c.scanner_id and c.owner_punctual is null then
    update go_stamp_checks set owner_punctual = coalesce(p_punctual, false) where id = c.id;
  elsif v_me = c.owner_id and c.scanner_punctual is null then
    update go_stamp_checks set scanner_punctual = coalesce(p_punctual, false) where id = c.id;
  end if;
  select * into c from go_stamp_checks where id = p_check;

  if c.owner_punctual is null or c.scanner_punctual is null then
    return jsonb_build_object('ok', true, 'done', false);
  end if;

  -- Karteninhaber
  v_order := go_stamp_card_order(c.owner_id);
  if v_order is not null then
    insert into stamp_log (user_id, host_id, event_id, order_id)
    values (c.owner_id, c.scanner_id, c.event_id, v_order)
    on conflict (user_id, event_id) do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_added_owner := case when c.owner_punctual then 2 else 1 end;
      update support_orders
      set meta = coalesce(meta, '{}'::jsonb)
        || jsonb_build_object('stamps', least(12, coalesce((meta->>'stamps')::int, 0) + v_added_owner))
      where id = v_order;
    end if;
  end if;

  -- Scannender
  v_order := go_stamp_card_order(c.scanner_id);
  if v_order is not null then
    insert into stamp_log (user_id, host_id, event_id, order_id)
    values (c.scanner_id, c.owner_id, c.event_id, v_order)
    on conflict (user_id, event_id) do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_added_scanner := case when c.scanner_punctual then 2 else 1 end;
      update support_orders
      set meta = coalesce(meta, '{}'::jsonb)
        || jsonb_build_object('stamps', least(12, coalesce((meta->>'stamps')::int, 0) + v_added_scanner))
      where id = v_order;
    end if;
  end if;

  update go_stamp_checks
  set done_at = now(), owner_added = v_added_owner, scanner_added = v_added_scanner
  where id = c.id;

  return go_stamp_check_status(c.id);
end;
$$;

-- Stand einer Prüfung für mich: fertig? wie viele Stempel dazu? Stand der Karte?
create or replace function go_stamp_check_status(p_check uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  c go_stamp_checks%rowtype;
  v_stamps int;
begin
  select * into c from go_stamp_checks where id = p_check;
  if c.id is null or v_me is null or (v_me <> c.owner_id and v_me <> c.scanner_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select coalesce((o.meta->>'stamps')::int, 0) into v_stamps
  from support_orders o where o.id = go_stamp_card_order(v_me);
  return jsonb_build_object(
    'ok', true,
    'done', c.done_at is not null,
    'added', case when v_me = c.owner_id then c.owner_added else c.scanner_added end,
    'punctual', case when v_me = c.owner_id then c.owner_punctual else c.scanner_punctual end,
    'stamps', coalesce(v_stamps, 0)
  );
end;
$$;

-- Offene Fragen an mich (heute): „War X pünktlich?“
create or replace function go_stamp_checks_open()
returns table (check_id uuid, other_id uuid, other_name text, other_photo text, event_title text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         case when c.owner_id = go_current_account_id() then c.scanner_id else c.owner_id end,
         a.name, a.photo_url, e.title
  from go_stamp_checks c
  join events e on e.id = c.event_id
  join go_accounts a on a.id = case when c.owner_id = go_current_account_id() then c.scanner_id else c.owner_id end
  where c.done_at is null
    and c.created_at > now() - interval '24 hours'
    and (
      (c.owner_id = go_current_account_id() and c.scanner_punctual is null)
      or (c.scanner_id = go_current_account_id() and c.owner_punctual is null)
    )
  order by c.created_at;
$$;

grant execute on function go_event_participant(uuid, uuid) to anon, authenticated;
grant execute on function go_stamp_card_order(uuid) to anon, authenticated;
grant execute on function go_stamp_check_start(uuid, uuid) to anon, authenticated;
grant execute on function go_stamp_check_verdict(uuid, boolean) to anon, authenticated;
grant execute on function go_stamp_check_status(uuid) to anon, authenticated;
grant execute on function go_stamp_checks_open() to anon, authenticated;
