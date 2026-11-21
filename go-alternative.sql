-- go-alternative.sql — Alternative eintragen (Aktuell → Kreis → Alternative): Kennzeichen item_type 'alternative'
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-woche-support.sql.
-- Eingetragene Alternativen bieten beim späteren Starten über den Kreis kein „Schieben“ und keine weitere „Alternative“.

alter table events drop constraint if exists events_item_type_check;
alter table events add constraint events_item_type_check
  check (
    item_type is null
    or item_type in ('event', 'course_session', 'ffc_event', 'history', 'support_session',
                     'nutrition_log', 'spontaneous', 'hotel_workout', 'alternative')
  );
