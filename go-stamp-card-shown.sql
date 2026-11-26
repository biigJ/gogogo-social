-- go-stamp-card-shown.sql — Gestempelt wird die Karte, die vorgezeigt wird.
-- Der QR der Stempelkarte trägt die gezeigte Karte (&card=main|group|circle|coach), go_stamp_checks.card_kind speichert sie.
-- Coach-Karte bekommt nur Stempel, wenn sie gezeigt wurde (Training mit dem Coach in der Gruppe kann unentgeltlich sein).
-- Gezeigte Coach-Karte: nur sie, nicht zusätzlich gogogo-, Gruppen- oder Circle-Karte. Idempotent.

alter table go_stamp_checks add column if not exists card_kind text;

drop function if exists public.go_stamp_check_start(uuid, uuid);
create or replace function public.go_stamp_check_start(p_owner uuid, p_event uuid default null, p_card text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_event uuid := p_event;
  v_card text := case when p_card in ('main', 'group', 'circle', 'coach') then p_card else null end;
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

  insert into go_stamp_checks (event_id, owner_id, scanner_id, card_kind)
  values (v_event, p_owner, v_me, v_card)
  on conflict do nothing;

  select * into c from go_stamp_checks
  where event_id = v_event
    and least(owner_id, scanner_id) = least(p_owner, v_me)
    and greatest(owner_id, scanner_id) = greatest(p_owner, v_me);

  -- neuer Scan, noch offen: gezeigte Karte übernehmen
  if c.done_at is null and v_card is not null and c.card_kind is distinct from v_card then
    update go_stamp_checks set card_kind = v_card where id = c.id;
  end if;

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
$function$;
grant execute on function public.go_stamp_check_start(uuid, uuid, text) to anon, authenticated;

-- Verknüpfte Karten: Coach-Karte nur bei gezeigter Coach-Karte, die anderen nur ohne
create or replace function public.go_stamp_links_award()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  g text;
  c text;
  v_coach boolean := new.card_kind = 'coach';
begin
  if new.done_at is null or old.done_at is not null then return new; end if;
  select e.group_id::text, e.circle_id into g, c from events e where e.id = new.event_id;
  if coalesce(new.owner_added, 0) > 0 then
    if not v_coach then
      update go_stamp_links l set stamps = least(12, l.stamps + new.owner_added)
      where l.account_id = new.owner_id and l.status = 'linked' and l.kind <> 'coach'
        and ((l.kind = 'group' and l.ref = g) or (l.kind = 'circle' and l.ref = c)
          or exists (select 1 from go_stamp_links p
                     where p.account_id = new.scanner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref));
    else
      update go_stamp_links l set stamps = least(12, l.stamps + new.owner_added)
      where l.account_id = new.owner_id and l.kind = 'coach' and l.ref = new.scanner_id::text
        and exists (select 1 from go_accounts a where a.id = new.owner_id and a.trainer_id = new.scanner_id);
    end if;
  end if;
  if coalesce(new.scanner_added, 0) > 0 then
    if not v_coach then
      update go_stamp_links l set stamps = least(12, l.stamps + new.scanner_added)
      where l.account_id = new.scanner_id and l.status = 'linked' and l.kind <> 'coach'
        and ((l.kind = 'group' and l.ref = g) or (l.kind = 'circle' and l.ref = c)
          or exists (select 1 from go_stamp_links p
                     where p.account_id = new.owner_id and p.status = 'linked' and p.kind = l.kind and p.ref = l.ref));
    else
      update go_stamp_links l set stamps = least(12, l.stamps + new.scanner_added)
      where l.account_id = new.scanner_id and l.kind = 'coach' and l.ref = new.owner_id::text
        and exists (select 1 from go_accounts a where a.id = new.scanner_id and a.trainer_id = new.owner_id);
    end if;
  end if;
  return new;
end $function$;

-- Pünktlichkeit beider Seiten: gogogo-Karte nur, wenn nicht die Coach-Karte gezeigt wurde
create or replace function public.go_stamp_check_verdict(p_check uuid, p_punctual boolean)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
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

  if c.card_kind = 'coach' then
    -- nur die Coach-Karte (go_stamp_links_award), keine gogogo-Karte
    v_added_owner := case when c.owner_punctual then 2 else 1 end;
    v_added_scanner := case when c.scanner_punctual then 2 else 1 end;
  else
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
  end if;

  update go_stamp_checks
  set done_at = now(), owner_added = v_added_owner, scanner_added = v_added_scanner
  where id = c.id;

  return go_stamp_check_status(c.id);
end;
$function$;
