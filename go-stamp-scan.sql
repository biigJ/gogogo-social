-- go-stamp-scan.sql
-- Stempel per QR-Scan: Wer beim Event eines anderen dabei ist (Zusage oder angenommene
-- Einladung, heute), scannt dessen Stempelkarten-QR und bekommt einen Stempel auf die
-- eigene Karte. Pro Event und Person höchstens ein Stempel. Idempotent.
-- Voraussetzung: go-courses-support.sql, go-woche-support.sql, go-event-invites.sql.

create table if not exists stamp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  host_id uuid not null references go_accounts(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  order_id uuid references support_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

alter table stamp_log enable row level security;

drop policy if exists "stamp_log_select" on stamp_log;
create policy "stamp_log_select"
  on stamp_log for select to anon, authenticated
  using (true);

-- Schreiben nur über die Funktion
create or replace function go_stamp_by_scan(p_host_id uuid, p_scanner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scanner uuid := coalesce(go_current_account_id(), p_scanner_id);
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_event uuid;
  v_order support_orders%rowtype;
  v_stamps int;
begin
  if v_scanner is null or p_host_id is null then
    return jsonb_build_object('ok', false, 'reason', 'login');
  end if;
  if v_scanner = p_host_id then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- Event des Gastgebers heute, bei dem ich dabei bin
  select e.id into v_event
  from events e
  where e.user_id = p_host_id
    and (e.starts_at at time zone 'Europe/Berlin')::date = v_today
    and e.status <> 'ausgefallen'
    and (
      exists (select 1 from event_rsvps r
              where r.event_id = e.id and r.user_id = v_scanner and r.status = 'zugesagt')
      or exists (select 1 from go_workout_invites i
                 where i.event_id = e.id and i.to_id = v_scanner and i.status = 'accepted')
    )
  order by e.starts_at
  limit 1;

  if v_event is null then
    return jsonb_build_object('ok', false, 'reason', 'no_event');
  end if;

  if exists (select 1 from stamp_log where user_id = v_scanner and event_id = v_event) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;

  -- Aktive Stempelkarte des Scannenden
  select o.* into v_order
  from support_orders o
  join support_products p on p.id = o.product_id
  where o.user_id = v_scanner
    and p.type = 'stempelkarte'
    and o.status not in ('angefragt', 'cancelled')
  order by o.created_at desc
  limit 1;

  if v_order.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_card');
  end if;

  v_stamps := least(12, coalesce((v_order.meta->>'stamps')::int, 0) + 1);
  update support_orders
  set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('stamps', v_stamps)
  where id = v_order.id;

  insert into stamp_log (user_id, host_id, event_id, order_id)
  values (v_scanner, p_host_id, v_event, v_order.id);

  return jsonb_build_object('ok', true, 'stamps', v_stamps);
end;
$$;

grant execute on function go_stamp_by_scan(uuid, uuid) to anon, authenticated;
