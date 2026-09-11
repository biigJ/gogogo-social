# gogogo Account-App — Strukturkarte für Claude

**Kanonische Datei:** `account/index.html`  
**Kopie zum Teilen:** `gogogo-account-app.html` (gleiche Inhalte)  
**Größe:** ~7865 Zeilen / ~307 KB  
**Externes Script:** `/assets/go-account-session.js`

Dies ist die aktuelle Haupt-App unter `/account/`.  
Es gibt **keine** `gogogo-app.html` im Repo.  
`app/index.html` ist eine ältere/separate Member-App — nicht diese.

---

## Aufbau der Datei

| Bereich | Ungefähre Zeilen | Inhalt |
|---|---|---|
| `<head>` + CSS | 1–2306 | Design-Tokens, Layout, Panels, Modals, Safe-Area, Portrait-Lock |
| HTML-Panels | 2336–2920 | UI: Home, Profile, Book, Community, Chat, Training, Nav |
| Modals | 2922–2985 | Settings, Code ändern, Delete, Challenge |
| Haupt-`<script>` | 2987–Ende | gesamte App-Logik (monolithisch) |

---

## Panels (UI)

- `#panel-home` — Kalender / Wochenplan / Rädchen
- `#panel-profile` — Profil, Challenge, Booking, Wochenplan, Mantra, Trainer
- `#panel-book` — Buch-/Wissensbereich
- `#panel-community` — Buddy-Slots + Feed + Composer
- `#panel-chat` — Chat
- `#panel-training` — Kraft / Ausdauer / Info (iframe)

## Wichtige Features im Script

- Account-Session / Cloud-Sync (`syncFromCloud`, `patchAccount`, `rest*`)
- Buddy-Suche per Seriennummer, Buddy-Slots
- Community-Feed + Trainer-Antworten
- Challenge-Einsatz / Refund / Wheel
- Personal-Training-Booking (Calendly) + Admin-Training-Datum
- Mantra (eigen / rotierend)
- Trainer-Zuordnung per Serial
- App-Tour / Onboarding / Greeting-Landing (Rädchen + Dither + Mantra)
- Day entries / Streak / Wert / Cycle-Rays

## Typische Anpassungsorte

- **Visuelles Design:** CSS-Block oben (`:root`, `.panel`, `.profile-*`, `.community-*`)
- **Begrüßungs-Landing:** `.app-greeting*` CSS + `fillGreetingCopy` / `applyGreetingDither` / `drawGreetingWheel`
- **Profil-UI:** `#panel-profile` HTML + `fillProfilePanel`
- **Community:** `#panel-community` + `renderCommunityFeed` / `refreshCommunityFeed`
- **Cloud-Schema-Annahmen:** Tabellen wie Accounts, Invites, Day Entries, Mantras, Buddy-Links (über REST/RPC)

## Hinweise für Prompt-Erstellung

1. Änderungen möglichst **lokal** halten (eine Funktion / ein Panel), nicht die ganze Datei umbauen.
2. Bestehende Brand-Sprache / CSS-Variablen / Safe-Area-Verhalten beibehalten.
3. Cloud-Änderungen brauchen ggf. SQL/Migration — nicht nur Frontend.
4. Deutsch ist Primärsprache; EN oft parallel über `uiLang` / `data-de`/`data-en`.
