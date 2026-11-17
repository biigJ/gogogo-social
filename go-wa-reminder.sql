-- go-wa-reminder.sql — WhatsApp-Erinnerung um 19 Uhr (mit Einverständnis), Checkliste im Admin
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin.sql.
--
-- go_accounts.wa_reminder    Einverständnis (Einstellungen → WhatsApp-Erinnerung)
-- go_wa_reminder_log         wer an welchem Tag schon erinnert wurde (Haken in der Checkliste)
-- go_admin_wa_list(p_day)    Admin: alle mit Einverständnis + Telefon, offenes Training heute, Training morgen

alter table go_accounts add column if not exists wa_reminder boolean not null default false;
alter table go_accounts add column if not exists wa_reminder_at timestamptz;

create table if not exists go_wa_reminder_log (
  account_id uuid not null references go_accounts(id) on delete cascade,
  day date not null,
  sent_by uuid references go_accounts(id) on delete set null,
  sent_at timestamptz not null default now(),
  primary key (account_id, day)
);
alter table go_wa_reminder_log enable row level security;
drop policy if exists "go_wa_reminder_log_admin" on go_wa_reminder_log;
create policy "go_wa_reminder_log_admin" on go_wa_reminder_log for all to anon, authenticated
  using (go_is_admin()) with check (go_is_admin());

create or replace function go_admin_wa_list(p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'Europe/Berlin')::date);
begin
  if not go_is_admin() then
    raise exception 'not admin';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.name)
    from (
      select a.id as account_id, a.name, a.nickname, a.phone, a.photo_url,
        (select l.sent_at from go_wa_reminder_log l where l.account_id = a.id and l.day = v_day) as sent_at,
        (select jsonb_agg(jsonb_build_object('title', e.title, 'at', e.starts_at, 'status', e.status) order by e.starts_at)
           from events e where e.user_id = a.id and (e.starts_at at time zone 'Europe/Berlin')::date = v_day
             and e.status <> 'ausgefallen') as today,
        (select jsonb_agg(jsonb_build_object('title', e.title, 'at', e.starts_at) order by e.starts_at)
           from events e where e.user_id = a.id and (e.starts_at at time zone 'Europe/Berlin')::date = v_day + 1
             and e.status = 'geplant') as tomorrow
      from go_accounts a
      where a.wa_reminder and coalesce(a.phone, '') <> ''
    ) x
  ), '[]'::jsonb);
end;
$$;
grant execute on function go_admin_wa_list(date) to anon, authenticated;
