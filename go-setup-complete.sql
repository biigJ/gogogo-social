-- gogogo — vollständige Datenbank-Einrichtung (Reihenfolge beachten)
-- Im Supabase SQL Editor nacheinander ausführen (gleiche Instanz: agpysewcsakdpmpftndp).
--
-- Jede Datei ist idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Bei bestehender DB nur fehlende Dateien nachziehen — nicht alles löschen.

-- 1. Basis: Accounts, Invite-Codes, WhatsApp-Jobs, RLS
--    Datei: go-account.sql

-- 2. Community (Buddies, Posts)
--    Datei: go-community.sql

-- 3. Coach-Trainingsplan (Profil: Lebenssituation, Ziel, Wochentage)
--    Datei: go-coach-plans.sql
--    Datei: go-coach-plans-zirkel.sql
--    Datei: go-coach-plans-day-units.sql   (day_training_units — Kraft/Ausdauer pro Tag)
--    Datei: go-coach-plan-history.sql
--    Datei: go-coach-zirkel-history.sql

-- 4. Kraft & Ausdauer Wochentage + Ausdauer-Presets
--    Datei: go-ausdauer-plan.sql

-- 5. Kraft: Trainer-Vorauswahl (Haken pro Nutzer)
--    Datei: go-kraft-presets.sql

-- 6. Kraft: Satzprotokoll + legacy custom_exercises-Spalte
--    Datei: go-kraft-workout.sql

-- 7. Kraft: Globale Übungen (NEU — für alle Nutzer sichtbar)
--    Datei: go-kraft-exercises-global.sql

-- 8. Trainer-Rolle + trainer_id-Zuordnung
--    Datei: go-trainer.sql

-- 9. Challenge, Mantras, Tages-Scores, Interval-Logs, Löschen, …
--    Datei: go-challenge.sql
--    Datei: go-mantras.sql
--    Datei: go-day-entries.sql
--    Datei: go-training-interval-logs.sql
--    Datei: go-training-date.sql
--    Datei: go-delete-user.sql
--    Datei: go-invite-admin.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- Datenmodell — Zusammenhänge
-- ─────────────────────────────────────────────────────────────────────────────
--
-- go_accounts
--   is_trainer      → Account ist Trainer (sieht Trainer-Bereich)
--   trainer_id      → zugewiesener Trainer (Nutzer wählt per Seriennummer)
--
-- go_coach_plans (1 Zeile pro Nutzer, account_id PK)
--   life_situation, goal, phase_steps  → Profil-Panel
--   day_mo … day_so                    → Wochenplan-Texte
--   zirkel_weekday, kraft_weekdays, ausdauer_weekdays
--   day_training_units                 → welche Kraft-/Ausdauer-Einheit an welchem Tag
--
-- go_kraft_exercises (GLOBAL)
--   id, system_id, name                → neue Übungen für alle sichtbar
--
-- go_kraft_presets (pro Nutzer + system_id)
--   exercise_ids                       → welche Übungen vorausgewählt (Haken)
--
-- go_kraft_logs (pro Nutzer)
--   sets                               → Wdh × kg Protokoll
--
-- go_ausdauer_presets (pro Nutzer)
--   source = 'trainer'                 → Trainer-Voreinstellungen in der App
--
-- Trainer-Bereich (/go/admin/?trainer=1):
--   Sieht Nutzer mit trainer_id = eigene ID
--   Kann Plan, Kraft-Haken, Ausdauer-Presets und Community-Antworten pflegen
--
-- Admin-Bereich (/go/admin/):
--   Alle Nutzer, Challenge, Trainer markieren, globale Übungen anlegen
