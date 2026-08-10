# WhatsApp Gruppen-Agent — gogogo /go leads

## Auftrag
Wenn ein neuer Eintrag in `go_wa_jobs` mit `status = pending` erscheint:

1. Name und Handynummer aus dem Job lesen.
2. Die Person in Joschas WhatsApp-Gruppe für die Buddy-Challenge aufnehmen (WhatsApp Business / verknüpftes Tool).
3. Der Person eine WhatsApp-Nachricht senden sinngemäß:
   „Hi {name}, du bist bei Joscha in der gogogo WhatsApp-Gruppe. Willkommen zur 4 Wochen Buddy-Challenge.“
4. Job auf `status = done` setzen und `processed_at = now()` schreiben.
5. Bei Fehlern: `status = error`, Fehlerkurztext in `note`.

## Datenquelle (Supabase)
- Projekt: `https://agpysewcsakdpmpftndp.supabase.co`
- Tabelle: `go_wa_jobs`
- Felder: `id`, `account_id`, `name`, `phone`, `invite_code`, `status`, `note`, `created_at`, `processed_at`

## Parallelität
Jobs werden beim Submit auf `/go` parallel zur Account-Weiterleitung erzeugt. Der Agent arbeitet die Queue unabhängig ab — die Account-Seite darf nicht auf WhatsApp warten.

## Trigger-Vorschlag
- Geplant alle 1–2 Minuten, oder Webhook bei Insert auf `go_wa_jobs`.
- Tools: Supabase lesen/schreiben + WhatsApp-Integration (sobald angebunden).

## Noch offen (in Cursor Automations Editor setzen)
- WhatsApp-Kanal / Business-API Credentials
- Konkrete Gruppen-ID
- Service-Role Key für sichere Status-Updates (statt anon)
