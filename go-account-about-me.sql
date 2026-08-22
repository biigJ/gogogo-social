-- Über-mich Texte (Lebenssituation, Ziel, Phase) pro Account
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists about_me jsonb default '{}'::jsonb;

-- about_me JSON: { "life_situation": "…", "goal": "…", "phase_steps": "…" }
