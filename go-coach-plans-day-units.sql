-- Pro Wochentag: Kraft-/Ausdauer-Einheit (Rädchen-Auswahl im Admin)
-- Im Supabase SQL Editor ausführen.

alter table go_coach_plans
  add column if not exists day_training_units jsonb not null default '{}'::jsonb;
