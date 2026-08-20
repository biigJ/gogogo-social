# WhatsApp Gruppen-Agent — gogogo /go leads

## Auftrag
Wenn ein neuer Eintrag in `go_wa_jobs` mit `status = pending` erscheint:

1. Name und Handynummer aus dem Job lesen (`name`, `phone`).
2. Optional: Trainer benachrichtigen — Nummer aus `notify_phone` (sonst Fallback Joscha).
   Kurz: „Neuer Nutzer {name} hat sich über Deinen Invite angemeldet.“
3. Die Person in der Buddy-Challenge-WhatsApp-Gruppe aufnehmen (WhatsApp Business / verknüpftes Tool), sofern Gruppe konfiguriert.
4. Der Person eine WhatsApp-Nachricht senden sinngemäß:
   „Hi {name}, willkommen zur 4 Wochen Buddy-Challenge bei gogogo.“
5. Job auf `status = done` setzen und `processed_at = now()` schreiben.
6. Bei Fehlern: `status = error`, Fehlerkurztext in `note`.

## Datenquelle (Supabase)
- Projekt: `https://agpysewcsakdpmpftndp.supabase.co`
- Tabelle: `go_wa_jobs`
- Felder: `id`, `account_id`, `name`, `phone`, `invite_code`, `status`, `note`, `created_at`, `processed_at`, `notify_phone`, `trainer_id`
- Schema-Erweiterung: `go-trainer-whatsapp.sql` (whatsapp_phone am Trainer-Account, trainer_id am Invite)

## Parallelität
Jobs werden beim Submit auf `/invite` und `/go` parallel zur Account-Weiterleitung erzeugt. Der Agent arbeitet die Queue unabhängig ab — die Account-Seite darf nicht auf WhatsApp warten.

## Client vs. Server
- Client: Nutzer öffnet `wa.me/{trainer}` mit vorgefüllter Nachricht („Dein Trainer“).
- Server/Agent: echte Push an Trainer + Gruppenaufnahme braucht WhatsApp Business API + diesen Worker.

## Trigger-Vorschlag
- Geplant alle 1–2 Minuten, oder Webhook bei Insert auf `go_wa_jobs`.
- Tools: Supabase lesen/schreiben + WhatsApp-Integration (sobald angebunden).

## Noch offen (in Cursor Automations Editor setzen)
- WhatsApp-Kanal / Business-API Credentials (Meta Cloud API oder Twilio)
- Konkrete Gruppen-ID
- Service-Role Key für sichere Status-Updates (statt anon)
- Template-Freigabe bei Meta (für proaktive Nachrichten an Trainer)
