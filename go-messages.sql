-- go-messages.sql — Mitteilungen in der App (einmal mittig, Tippen schließt)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin.sql, go-event-requests.sql.
--
-- go_messages        to_id leer = an alle (Admin), sonst an eine Person
-- go_message_reads   wer was gesehen hat (msg_key = id der Nachricht oder „news:…“ aus go-news.js)
-- Automatisch:
--   1) Neuer öffentlicher Wochenplan (courses.is_public wird true) → Nachricht an alle
--   2) Ein geplantes, künftiges Event wird gelöscht (z. B. Wochenplan geändert) und Freunde hatten
--      zugesagt (Einladung angenommen oder Mitmachen-Anfrage angenommen) → Nachricht an diese Freunde

create table if not exists go_messages (
  id uuid primary key default gen_random_uuid(),
  to_id uuid references go_accounts(id) on delete cascade,
  from_id uuid,
  kind text not null default 'info',
  ref_day date,
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists go_messages_to_idx on go_messages (to_id, created_at desc);
-- eine Nachricht je Freund, Tag und Absender (Plan-Wechsel löscht viele Events auf einmal)
create unique index if not exists go_messages_plan_day_uniq on go_messages (to_id, from_id, ref_day, kind)
  where kind = 'plan_change';

create table if not exists go_message_reads (
  account_id uuid not null references go_accounts(id) on delete cascade,
  msg_key text not null,
  read_at timestamptz not null default now(),
  primary key (account_id, msg_key)
);

alter table go_messages enable row level security;
alter table go_message_reads enable row level security;

drop policy if exists "go_messages_select" on go_messages;
create policy "go_messages_select" on go_messages for select to anon, authenticated
  using (to_id is null or to_id = go_current_account_id() or from_id = go_current_account_id() or go_is_admin());
drop policy if exists "go_messages_insert_admin" on go_messages;
create policy "go_messages_insert_admin" on go_messages for insert to anon, authenticated
  with check (go_is_admin());
drop policy if exists "go_messages_delete_admin" on go_messages;
create policy "go_messages_delete_admin" on go_messages for delete to anon, authenticated
  using (go_is_admin());

drop policy if exists "go_message_reads_own" on go_message_reads;
create policy "go_message_reads_own" on go_message_reads for all to anon, authenticated
  using (account_id = go_current_account_id()) with check (account_id = go_current_account_id());

-- 1) Neuer öffentlicher Wochenplan
create or replace function go_msg_new_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_public, false) and new.private_for is null and coalesce(new.is_active, true)
     and (tg_op = 'INSERT' or not coalesce(old.is_public, false)) then
    insert into go_messages (to_id, kind, body)
    values (null, 'new_plan', 'Neuer Wochenplan: „' || coalesce(new.title, 'ohne Titel') ||
      '“. Du findest ihn unter Woche → Stift → Wochenplan ändern.');
  end if;
  return new;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'courses' and column_name = 'is_public') then
    execute 'drop trigger if exists go_msg_new_plan on courses';
    execute 'create trigger go_msg_new_plan after insert or update of is_public on courses
             for each row execute function go_msg_new_plan()';
  else
    raise notice 'courses.is_public fehlt: Trigger für neue Wochenpläne nicht angelegt (erst go-wochenplan-wahl.sql)';
  end if;
end $$;

-- 2) Gemeinsames Training fällt weg/ändert sich
create or replace function go_msg_event_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_name text;
  v_wd text;
begin
  if old.status is distinct from 'geplant' or old.starts_at < now() then
    return old;
  end if;
  v_day := (old.starts_at at time zone 'Europe/Berlin')::date;
  select split_part(coalesce(nullif(trim(nickname), ''), name, 'Dein Freund'), ' ', 1) into v_name
  from go_accounts where id = old.user_id;
  v_wd := (array['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'])[extract(dow from v_day)::int + 1];

  insert into go_messages (to_id, from_id, kind, ref_day, body)
  select distinct x.friend, old.user_id, 'plan_change', v_day,
    coalesce(v_name, 'Dein Freund') || ' hat den Wochenplan geändert. Euer gemeinsames Training am ' || v_wd || ', ' ||
    to_char(v_day, 'DD.MM.') || ' ist jetzt ein anderes Event. Schau in Aktuell, was geplant ist.'
  from (
    select r.from_id as friend from go_event_requests r
    where r.event_id = old.id and r.status = 'accepted'
    union
    select i.to_id from go_workout_invites i
    where i.from_id = old.user_id and i.workout_date = v_day and i.status = 'accepted'
  ) x
  where x.friend is not null and x.friend <> old.user_id
  on conflict do nothing;
  return old;
exception when others then
  return old; -- Löschen nie blockieren
end $$;

drop trigger if exists go_msg_event_gone on events;
create trigger go_msg_event_gone before delete on events
  for each row execute function go_msg_event_gone();
