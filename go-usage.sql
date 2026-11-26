-- go-usage.sql — Nutzungsmessung: Sitzungen (Start, Ende, aktive Sekunden), Pillen-Sektion und genutzte Funktion,
-- dazu Sitzungs-Feedback (jede 20. Sitzung: ja / nein / vielleicht + Text).
-- Zugriff nur über RPCs (security definer, eigenes Konto via go_current_account_id). Tabellen ohne Policies. Idempotent.

create table if not exists go_usage_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  seconds integer not null default 0,
  device text
);
create index if not exists go_usage_sessions_acc on go_usage_sessions(account_id, started_at desc);

create table if not exists go_usage_events (
  id bigserial primary key,
  session_id uuid not null references go_usage_sessions(id) on delete cascade,
  account_id uuid not null references go_accounts(id) on delete cascade,
  at timestamptz not null default now(),
  section text,
  action text
);
create index if not exists go_usage_events_acc on go_usage_events(account_id, at desc);
create index if not exists go_usage_events_sess on go_usage_events(session_id);

create table if not exists go_session_feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references go_accounts(id) on delete cascade,
  session_id uuid references go_usage_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  answer text check (answer in ('ja', 'nein', 'vielleicht')),
  body text
);
create index if not exists go_session_feedback_acc on go_session_feedback(account_id, created_at desc);

alter table go_usage_sessions enable row level security;
alter table go_usage_events enable row level security;
alter table go_session_feedback enable row level security;

-- Neue Sitzung: gibt id und laufende Nummer (n) der Sitzungen dieses Kontos zurück
create or replace function public.go_usage_start(p_device text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
  v_id uuid;
  v_n integer;
begin
  if v_me is null then return null; end if;
  insert into go_usage_sessions (account_id, device) values (v_me, left(p_device, 120)) returning id into v_id;
  select count(*) into v_n from go_usage_sessions where account_id = v_me;
  return jsonb_build_object('id', v_id, 'n', v_n);
end $function$;
grant execute on function public.go_usage_start(text) to anon, authenticated;

-- Laufend: aktive Sekunden der Sitzung und neue Ereignisse [{at, section, action}]
create or replace function public.go_usage_log(p_session uuid, p_seconds integer, p_events jsonb default '[]'::jsonb)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
begin
  if v_me is null or p_session is null then return; end if;
  update go_usage_sessions
     set seconds = greatest(seconds, least(coalesce(p_seconds, 0), 86400)), last_at = now()
   where id = p_session and account_id = v_me;
  if not found then return; end if;
  insert into go_usage_events (session_id, account_id, at, section, action)
  select p_session, v_me,
         least(coalesce((x->>'at')::timestamptz, now()), now()),
         left(x->>'section', 40), left(x->>'action', 80)
  from (select x from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) x limit 200) t;
end $function$;
grant execute on function public.go_usage_log(uuid, integer, jsonb) to anon, authenticated;

-- Feedback zur Sitzung
create or replace function public.go_session_feedback_send(p_session uuid, p_answer text, p_body text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid := go_current_account_id();
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  insert into go_session_feedback (account_id, session_id, answer, body)
  values (v_me,
          (select id from go_usage_sessions where id = p_session and account_id = v_me),
          case when p_answer in ('ja', 'nein', 'vielleicht') then p_answer else null end,
          nullif(left(trim(coalesce(p_body, '')), 2000), ''));
end $function$;
grant execute on function public.go_session_feedback_send(uuid, text, text) to anon, authenticated;
