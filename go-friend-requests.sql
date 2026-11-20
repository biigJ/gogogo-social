-- go-friend-requests.sql — Freundschaftsanfragen: die Gegenseite bestätigt
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-friends-rename.sql, go-courses-support.sql.
--
-- Ablauf: Team → Meine Freunde → Freund hinzufügen (Nickname, ID, Ort, QR) legt eine Anfrage an (pending).
-- Die Gegenseite sieht sie beim Öffnen der App und in Meine Freunde und tippt Annehmen oder Ablehnen.
-- Annehmen (go_answer_friend_request) legt die Freundschaft in beide Richtungen an (go_friends).
-- Fragen beide sich gegenseitig an, gilt die zweite Anfrage direkt als Annahme.
-- Bestehende Freundschaften bleiben unverändert.

create table if not exists go_friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references go_accounts(id) on delete cascade,
  to_id uuid not null references go_accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists go_friend_requests_to_idx on go_friend_requests (to_id, status);

alter table go_friend_requests enable row level security;
drop policy if exists "go_friend_requests_select" on go_friend_requests;
create policy "go_friend_requests_select" on go_friend_requests for select to anon, authenticated
  using (from_id = go_current_account_id() or to_id = go_current_account_id());
drop policy if exists "go_friend_requests_insert" on go_friend_requests;
create policy "go_friend_requests_insert" on go_friend_requests for insert to anon, authenticated
  with check (from_id = go_current_account_id());
-- erneut anfragen (nach Ablehnen/Zurückziehen) oder zurückziehen: nur der Absender
drop policy if exists "go_friend_requests_update_from" on go_friend_requests;
create policy "go_friend_requests_update_from" on go_friend_requests for update to anon, authenticated
  using (from_id = go_current_account_id()) with check (from_id = go_current_account_id());

-- Annehmen / Ablehnen durch die Gegenseite. Annehmen verbindet beide (go_friends in beide Richtungen).
create or replace function go_answer_friend_request(p_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r go_friend_requests%rowtype;
  me uuid := go_current_account_id();
begin
  select * into r from go_friend_requests where id = p_id;
  if not found or me is null or r.to_id <> me then
    raise exception 'Anfrage nicht gefunden';
  end if;
  if r.status <> 'pending' then
    return r.status;
  end if;
  if p_accept then
    insert into go_friends (account_id, friend_id) values (r.to_id, r.from_id) on conflict do nothing;
    insert into go_friends (account_id, friend_id) values (r.from_id, r.to_id) on conflict do nothing;
    update go_friend_requests set status = 'accepted', decided_at = now() where id = p_id;
    -- Gegenrichtung (falls beide angefragt hatten) gleich mit erledigen
    update go_friend_requests set status = 'accepted', decided_at = now()
     where from_id = r.to_id and to_id = r.from_id and status = 'pending';
    return 'accepted';
  end if;
  update go_friend_requests set status = 'declined', decided_at = now() where id = p_id;
  return 'declined';
end $$;

grant execute on function go_answer_friend_request(uuid, boolean) to anon, authenticated;
