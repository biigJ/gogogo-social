-- go-login-stand.sql — Admin → Nutzer: hat sich die Person schon selbst angemeldet (gogogo) und ist sie beim Zirkeltraining (FFC) eingeloggt
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-admin-circles.sql.
--
-- go_accounts.seen_at      zuletzt selbst in gogogo eingeloggt (Vorname + Login-Code); die App meldet das einmal je Start
-- go_accounts.ffc_seen_at  zuletzt in der App mit FFC-Konto (E-Mail + Passwort) eingeloggt
-- go_mark_seen(p_ffc)      App: eigenes Konto als gesehen markieren, mit p_ffc = true auch FFC
-- Erstbefüllung aus Spuren, die nur die Person selbst hinterlässt: Onboarding, Datenschutz, Trainingslog, Tagebuch;
-- FFC aus der Circle-Mitgliedschaft, die die App beim Start aus FFC meldet (go_circle_members, source 'ffc').

alter table go_accounts add column if not exists seen_at timestamptz;
alter table go_accounts add column if not exists ffc_seen_at timestamptz;

create or replace function go_mark_seen(p_ffc boolean default false)
returns void
language sql
security definer
set search_path = public
as $$
  update go_accounts
     set seen_at = now(),
         ffc_seen_at = case when p_ffc then now() else ffc_seen_at end
   where id = go_current_account_id();
$$;
grant execute on function go_mark_seen(boolean) to anon, authenticated;

update go_accounts a set seen_at = x.at
  from (select id, greatest(onboarded_at, privacy_ack_at) as at from go_accounts) x
 where a.id = x.id and a.seen_at is null and x.at is not null;

do $$
begin
  if to_regclass('public.go_workout_logs') is not null then
    update go_accounts a set seen_at = l.at
      from (select account_id, max(created_at) as at from go_workout_logs group by account_id) l
     where a.id = l.account_id and a.seen_at is null;
  end if;
  if to_regclass('public.go_diary_entries') is not null then
    update go_accounts a set seen_at = l.at
      from (select account_id, max(updated_at) as at from go_diary_entries group by account_id) l
     where a.id = l.account_id and a.seen_at is null;
  end if;
end $$;

update go_accounts a set ffc_seen_at = m.at
  from (select account_id, min(created_at) as at from go_circle_members where source = 'ffc' group by account_id) m
 where a.id = m.account_id and a.ffc_seen_at is null;
