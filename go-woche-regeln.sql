-- go-woche-regeln.sql — Woche gilt dauerhaft: Tag, Uhrzeit, Sichtbarkeit je Plan-Einheit und wiederkehrendes Zirkeltraining
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
-- Voraussetzung: go-wochenplan-slots.sql, go-schritte-22.sql, go-visibility-fein.sql (bubble_id), go-courses-support.sql (group_id).
--
-- Was „Tage bearbeiten“ und „Zirkeltraining eintragen“ speichern, gilt, bis man es ändert:
-- * kind = 'plan':   Einheit (Einschreibung + Titel), die der Plan auf from_wd legt → wd, at_time, Sichtbarkeit, Bubble, Gruppe.
--                    Ein Trigger wendet das auf jedes neu erzeugte Plan-Event an (auch bei späterem go_generate_events).
-- * kind = 'zirkel': jeden wd um at_time ein Zirkeltraining. go_week_topup() legt die nächsten Wochen an
--                    (die App ruft es beim Öffnen von Woche). skip_days = einzeln gelöschte Termine, die nicht wiederkommen.
--                    replaces_plan = die Plan-Einheit an diesem Tag fällt aus.
-- Wochentage ISO: 1 = Montag … 7 = Sonntag. at_time null = ohne Uhrzeit (12:00 UTC, wie in der App).

create table if not exists go_week_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references go_accounts(id) on delete cascade,
  kind text not null check (kind in ('plan', 'zirkel')),
  enrollment_id uuid references enrollments(id) on delete cascade,
  title text not null default '',
  from_wd smallint check (from_wd between 1 and 7),
  wd smallint not null check (wd between 1 and 7),
  at_time time,
  visibility text not null default 'team',
  bubble_id uuid references go_bubbles(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  replaces_plan boolean not null default false,
  note text,
  skip_days date[] not null default '{}',
  updated_at timestamptz not null default now()
);

create unique index if not exists go_week_rules_plan_key
  on go_week_rules (user_id, enrollment_id, title, from_wd) where kind = 'plan';
create unique index if not exists go_week_rules_zirkel_key
  on go_week_rules (user_id, wd) where kind = 'zirkel';

alter table go_week_rules enable row level security;
drop policy if exists "go_week_rules_own" on go_week_rules;
create policy "go_week_rules_own" on go_week_rules for all to anon, authenticated
  using (user_id = go_current_account_id())
  with check (user_id = go_current_account_id());
grant select, insert, update, delete on go_week_rules to anon, authenticated;

-- ---------- Trigger: Regeln auf neue Plan-Events anwenden ----------
-- Läuft nach go_events_plan_defaults (Trigger feuern alphabetisch), überschreibt also deren 22:00 für Schritte, wenn eine Regel existiert.
create or replace function go_events_week_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r go_week_rules%rowtype;
  v_day date;
  v_wd int;
begin
  if new.enrollment_id is null or coalesce(new.status, 'geplant') <> 'geplant' or new.category = 'zirkel' then
    return new;
  end if;
  v_day := (new.starts_at at time zone 'Europe/Berlin')::date;
  v_wd := extract(isodow from v_day)::int;

  select * into r from go_week_rules
   where kind = 'plan' and user_id = new.user_id and enrollment_id = new.enrollment_id
     and title = coalesce(new.title, '') and from_wd = v_wd
   limit 1;
  if found then
    v_day := v_day + (r.wd - r.from_wd);
    new.starts_at := case when r.at_time is null
      then (v_day::timestamp + time '12:00') at time zone 'UTC'
      else (v_day + r.at_time) at time zone 'Europe/Berlin' end;
    new.visibility := r.visibility;
    new.bubble_id := r.bubble_id;
    if r.group_id is not null then new.group_id := r.group_id; end if;
    -- schon vorhanden (verschobene Einheit aus einem früheren Lauf): nicht doppelt anlegen
    if exists (
      select 1 from events e
      where e.enrollment_id = new.enrollment_id
        and coalesce(e.title, '') = coalesce(new.title, '')
        and (e.starts_at at time zone 'Europe/Berlin')::date = v_day
    ) then
      return null;
    end if;
  end if;

  -- wiederkehrendes Zirkeltraining ersetzt die Plan-Einheit an diesem Wochentag
  if exists (
    select 1 from go_week_rules z
    where z.kind = 'zirkel' and z.user_id = new.user_id and z.replaces_plan
      and z.wd = extract(isodow from (new.starts_at at time zone 'Europe/Berlin')::date)::int
      and not ((new.starts_at at time zone 'Europe/Berlin')::date = any (z.skip_days))
  ) then
    new.status := 'ausgefallen';
  end if;
  return new;
end $$;

drop trigger if exists go_events_week_rules on events;
create trigger go_events_week_rules before insert on events
  for each row execute function go_events_week_rules();

-- ---------- Zirkeltraining auffüllen (nächste p_weeks Wochen) ----------
create or replace function go_week_topup(p_weeks int default 8)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := go_current_account_id();
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_course uuid;
  r go_week_rules%rowtype;
  d date;
  v_at timestamptz;
  n int := 0;
  i int;
begin
  if v_me is null then return 0; end if;
  select id into v_course from courses where title = 'Zirkeltraining' order by created_at limit 1;
  for r in select * from go_week_rules where user_id = v_me and kind = 'zirkel' loop
    for i in 0 .. greatest(1, least(p_weeks, 26)) * 7 - 1 loop
      d := v_today + i;
      continue when extract(isodow from d)::int <> r.wd;
      continue when d = any (r.skip_days);
      v_at := case when r.at_time is null
        then (d::timestamp + time '12:00') at time zone 'UTC'
        else (d + r.at_time) at time zone 'Europe/Berlin' end;
      continue when v_at <= now();
      continue when exists (
        select 1 from events e
        where e.user_id = v_me and e.category = 'zirkel'
          and (e.starts_at at time zone 'Europe/Berlin')::date = d
      );
      insert into events (user_id, category, course_id, title, starts_at, status, visibility, is_unplanned, note)
      values (v_me, 'zirkel', v_course, 'Zirkeltraining', v_at, 'geplant', r.visibility, false, r.note);
      n := n + 1;
      if r.replaces_plan then
        update events set status = 'ausgefallen'
         where user_id = v_me and enrollment_id is not null and status = 'geplant' and category <> 'zirkel'
           and (starts_at at time zone 'Europe/Berlin')::date = d;
      end if;
    end loop;
  end loop;
  return n;
end $$;

grant execute on function go_week_topup(int) to anon, authenticated;
