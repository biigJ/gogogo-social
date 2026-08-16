-- Zirkeltraining-Wochentag am Coach-Plan (0=Mo … 4=Fr … 6=So). Default Freitag.
-- Im Supabase SQL Editor ausführen.

alter table go_coach_plans
  add column if not exists zirkel_weekday smallint;

update go_coach_plans
  set zirkel_weekday = 4
  where zirkel_weekday is null;

alter table go_coach_plans
  alter column zirkel_weekday set default 4;

alter table go_coach_plans
  alter column zirkel_weekday set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'go_coach_plans_zirkel_weekday_check'
  ) then
    alter table go_coach_plans
      add constraint go_coach_plans_zirkel_weekday_check
      check (zirkel_weekday >= 0 and zirkel_weekday <= 6);
  end if;
end $$;
