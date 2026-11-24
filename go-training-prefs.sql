-- go-training-prefs.sql — Onboarding-Antworten für die Planung (go-onboarding.js, plan-rules.js, plan-picker.js)
-- Idempotent.
-- training_prefs: { kraft: "1"|"1-2"|"2-3"|"3+", fixed_day: 0..6 (0 = Montag), place: "zuhause"|"hanteln"|"gym",
--                   club: { on, days: [0..6], sport }, bike: "nie"|"manchmal"|"taeglich", walk: "selten"|"manchmal"|"viel",
--                   steps: "<4000"|"4000-6000"|"6000-8000"|"8000+"|"?", morning: true|false, step_goal: {...}, at }

alter table go_accounts add column if not exists training_prefs jsonb;
