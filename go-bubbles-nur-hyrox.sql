-- go-bubbles-nur-hyrox.sql — Start-Bubbles außer HYROX entfernen (Wunsch Joscha, 24.11.2026)
-- Idempotent. Nur leere Bubbles: ohne Mitglieder, Nachrichten und Events (Stand vorher geprüft: alle 0).
-- Mitglieder, Nachrichten, Wiki löschen per Fremdschlüssel mit; events/go_week_rules.bubble_id → null.
delete from go_bubbles b
where b.name in ('Sprinten', 'Schwimmen', 'Spaziergänge', 'Calisthenics')
  and b.created_by is null
  and not exists (select 1 from go_bubble_members m where m.bubble_id = b.id)
  and not exists (select 1 from go_bubble_messages x where x.bubble_id = b.id)
  and not exists (select 1 from events e where e.bubble_id = b.id);
