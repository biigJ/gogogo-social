# Wolfgang Grope Katalog

Die Live-Ausstellung liegt unter [biig.works/kunst](https://www.biig.works/kunst/). Quellcode und Katalog-Daten kommen aus dem Repo `biigJ/friday-circle`.

## Sofortänderungen in diesem Branch

- Roter Punkt bei Radierung Nr. 026 (`wg-03-026`, `wg-06-026`) und Holzschnitt Nr. 009 (`wg-04-009`)
- Signatur unter „Unser Vater“: `Joscha, Berlin 2026`
- Hover zeigt optional Maße und Preis
- Hover über dem leeren Punkt: `klick für Anfrage`
- Kontakt-Link der Anfrage öffnet `/kontakt/`
- Admin unter `/kunst/admin/`

## Veröffentlichen auf biig.works

Dieser Agent hat Schreibzugriff nur auf `gogogo-social`. Zum Live-Deploy:

1. Preview auf gogogo.social öffnen: `/kunst/admin/`
2. Mit einem GitHub-Token anmelden, das Schreibrecht auf `biigJ/friday-circle` hat
3. „Seiten-Code mit veröffentlichen“ aktiv lassen und **Veröffentlichen** klicken

Danach baut das Vercel-Projekt von `friday-circle` die Site neu und aktualisiert biig.works.

Optional dauerhaft: Secrets `KUNST_ADMIN_PASSWORD` und `KUNST_GITHUB_TOKEN` im Vercel-Projekt setzen. Dann reicht die Passwort-Anmeldung.
