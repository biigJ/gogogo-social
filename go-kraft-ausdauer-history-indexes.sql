-- Kraft- und Ausdauer-Historie (Kartei-Reiter in der App)
-- Tabellen go_kraft_logs und go_ausdauer_logs existieren bereits.
-- Dieses Skript ergänzt nur sinnvolle Indizes für die Historie-Ansicht.

create index if not exists go_kraft_logs_history_idx
  on go_kraft_logs (account_id, system_id, workout_date desc, created_at desc);

create index if not exists go_ausdauer_logs_history_idx
  on go_ausdauer_logs (account_id, technique, workout_date desc, created_at desc);
