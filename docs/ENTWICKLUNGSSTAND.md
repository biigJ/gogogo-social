# gogogo.social — Entwicklungsstand

**Stand:** 15. November 2026 (Europe/Berlin)  
**Repo:** [biigJ/gogogo-social](https://github.com/biigJ/gogogo-social)  
**Live:** Vercel-Projekt **gogogo-social** → Domain `gogogo.social`  
**Aktueller `main`-Tip:** Merge PR #138 (Plus Swipe + Pfeile)

---

## 1. Was dieses Repo ist

Statische Multi-App-Site (HTML/CSS/Vanilla-JS) mit Supabase-Backend. Ursprünglich Export aus `friday-circle`; die produktive Member-App wird **direkt hier** weitergebaut — der README-Hinweis „Do not edit by hand“ gilt für den alten Landing-/Export-Pfad, **nicht** für `/workout/` (natalyaalice).

| Oberfläche | URL | Rolle |
|---|---|---|
| Landing / Brand | `/`, `brand-landing.html`, … | Marketing, Redirects |
| **Workout-App (kanonisch)** | `/workout/` → `natalyaalice/index.html` | FFC-Umbau, 5-Tab-Shell |
| Account-App (älter) | `/account/` | Frühere Member-App; parallel existent |
| Go / Admin | `/go/`, `/go/admin/` | Admin / Plan-Tools |
| Zirkeltraining | `/zirkeltraining/` | Proxy auf separates Vercel-App |
| Kunst / Interior | `/kunst/`, `/biig-interior/` | Nebenprojekte |

Alte Pfade `/natalyaalice` und `/natalyaalice/` redirecten permanent auf `/workout/`.

---

## 2. Architektur der Workout-App

### 2.1 Dateien

| Datei | ~Zeilen | Aufgabe |
|---|---|---|
| `natalyaalice/index.html` | ~20 700 | Shell, CSS, Session, Plus-Rail, Team, Profil, Host-API |
| `natalyaalice/heute-v3.js` | ~3 000 | Tab **Aktuell** (Feed, Filter, Accountability) |
| `natalyaalice/woche-reels.js` | ~3 900 | Tab **Woche** (Reels, Edit, Travel, Share) |
| `natalyaalice/ffc.js` | ~3 600 | Friday Fitness Circle (eigenes Supabase-Projekt) |
| `natalyaalice/support.js` | ~900 | Plus-Katalog, Buchungen, Ownership |
| `natalyaalice/log.js` | ~600 | Workout-Logs (Legacy-Nähe) |
| `natalyaalice/ffc.css` | — | FFC-Styles |
| `natalyaalice/manifest.webmanifest` | — | PWA: `start_url` `/workout/` |
| `natalyaalice/sw-kill.js` | — | Alter Service-Worker killen |

Host-Bridge: `window.FFC_HOST` / Module mit `host.rest`, `host.sessionAccount`, Callbacks. Module sind IIFEs, die sich an `window` hängen (`HeuteV3`, `WocheReels`, `FFC`, `GoSupport`, …).

### 2.2 Bottom-Pill (5 Tabs)

`body.dataset.shell` steuert Sichtbarkeit per CSS:

| `data-shell` | Label | Inhalt |
|---|---|---|
| `heute` | Aktuell | Instagram-artiger Feed (`heute-v3.js`) |
| `woche` | Woche | Wochen-Reels + optionaler Wochenplan |
| `team` | Team | Horizontal-Rail `#plan-team` (Gruppe / Faces) |
| `kurse` | Plus | Horizontal-Rail `#go-rail` (TOC + Angebote + FFC) |
| `profil` | Profil | Profil, Settings, Coaching, Passwort, … |

Zusätzlich existieren Legacy-Shells (`plan`, `diary`, `workout`) — nicht mehr in der Pill, aber Codepfade noch da.

### 2.3 Zwei Supabase-Projekte

| Projekt | Client | Nutzung |
|---|---|---|
| **gogogo** `agpysewcsakdpmpftndp` | `natalyaalice/index.html` REST + `assets/auth.js` | Accounts, Events, Groups, Support-Orders, Visibility, … |
| **FFC / Zirkel** `uxijbecqklzwxbpvsglh` | `natalyaalice/ffc.js` (anon JWT) | Profiles, Leaderboard, Posts, FFC-Events, Punkte |

Schema-Änderungen am gogogo-Projekt liegen als `go-*.sql` im Repo-Root (manuell im Supabase SQL Editor ausführen — kein automatisches Migrate).

### 2.4 Deploy

- `vercel.json`: nur `main` deployt; Branches `cursor/**` sind deployment-disabled.
- Rewrite `/workout/` → `natalyaalice/index.html`.
- Nach Merge: **Hard-Reload** (PWA/Cache); bei Zweifel Cache leeren.

---

## 3. Plus-Rail (`#go-rail`) — aktueller Stand & Lektion

### 3.1 Aufbau

- Horizontaler Scroll-Container mit CSS `scroll-snap`.
- Slides: TOC (`data-offer="toc"`) + Katalog (u. a. `zirkel`, `stempelkarte`, `web_call`, `routine`, `ernaehrung`, `coach_offer`).
- Headline + Pfeile sitzen in `#go-rail-nav` (Sibling oberhalb der Pane, analog Team).
- Vertikaler Inhalt eines Slides liegt in `.go-slide__body` (Wrapper per `wrapGoSlideBody`).
- Navigation: Swipe, Pfeile (`bindRailNav`), TOC-Sprung (`jumpToGoOffer`).
- Settle-Hilfe: `bindGoRailHardSnap` (Timer + `snapLock`).

`paintGoRail()` baut Slides; bei gleichen Offer-Keys + gleichem FFC-Login-Status **kein Full-Rebuild** (gegen FFC-Flackern). Routine-Karte `#go-card-routine` wird vor Rebuild aus der Rail gerettet.

### 3.2 Was ~20 Iterationen kaputt gemacht hat (ehrlich)

Kein „ein Bug“, sondern **Schichten von Partial-Fixes** auf einem empfindlichen Touch/Scroll-Stack (iOS WebKit + nested scroll + snap + JS-Korrektur):

1. **Custom-Swipe / JS-Scroll-Fight** gegen natives Snap → Hängen zwischen Slides, Rebuilds, die Snap „tot“ ließen.
2. **`touch-action: pan-y`** auf `.go-slide__body` → Browser erlaubt nur Vertikal-Pan; Horizontal-Swipe stirbt (besonders auffällig nach TOC→Ernährung, wenn der Finger auf dem Body landet).
3. **`snapLock` + smooth-scroll + settle-Timer** → erster Pfeil-Klick ok, Folgeklicks werden von Lock/Timer geschluckt.
4. **TOC-Jump** setzte Scroll, aber Body-Scroll/Lock-Zustand blieb inkonsistent, bis Jump Lock clearte und Body `scrollTop = 0` setzte.
5. Zusätzlich parallel: Gruppe-Faces hinter Pill, Headline-Höhe, FFC-Rebuild-Flackern — Fixes in denselben Dateien erhöhten Regressionsrisiko.

**Finale Fixes (PR #138, auf `main`):**

- CSS: `.go-slide__body` → `touch-action: pan-x pan-y`.
- JS: Pfeile auf `#go-rail` springen **sofort** (`snapGoRailToIndex(..., false)`), clearen `_goSnapTimer` und `snapLock` — kein smooth+settle-Kampf.

### 3.3 Bewertung: „einer weit entwickelten KI würdig?“

**Nein — nicht in der Form.** Eine fortgeschrittene Agentur/KI hätte:

- zuerst die **eine** Scroll-Vertrag-Regel fixiert (wer pannt horizontal, wer vertikal, wer snapt),
- **einen** Repro-Pfad (TOC→Ernährung, dann Swipe; Pfeil 5× tippen) vor jedem weiteren Diff getestet,
- nicht nacheinander Custom-Handler, Lock-Flags und `touch-action` gegeneinander geschoben.

Was passiert ist: iterative Cloud-Agent-PRs unter Zeitdruck + schlechte Feedback-Schleife (User testet auf Gerät, Agent sieht kein iPhone). Das Ergebnis war korrekt, der Weg war unwürdig — deshalb diese Doku und die Übernahme-Regeln in `CLAUDE.md`.

---

## 4. Feature-Stand nach Bereichen

### Aktuell (`heute`)

- Filter-Hierarchie: Ich ⊂ Team ⊂ Gruppe ⊂ Tagebuch ⊂ Alles (`heute-v3.js`).
- Visibility-Modell: Legacy `alle`/`friends` → `team`; echte Gruppe über `groups.group_id`.
- Feed, Invites, Historie, FFC-Events gemischt; Flackern-Fixes durch „Feed bei Refresh sichtbar lassen“.

### Woche (`woche`)

- Reels-UI, Edit-Panel, Travel/Alternative Bewegung, Share-Pick, Undo-Delete.
- Anbindung Kraft/Ausdauer/Zirkel + Support-Kurse.

### Team

- Horizontal-Slides, Empty-State-Padding hinter Bottom-Pill, Faces dürfen Pill nicht schneiden.
- Gruppen-Migration: `go-groups-migrate.sql`, `go-friends-rename.sql`, `go-visibility-team.sql`.

### Plus (`kurse`)

- TOC, Buchungs-CTAs via `GoSupport`, FFC-Login/Leaderboard/Aufzeichnungen im Zirkel-Slide.
- Stempelkarte / Wallet-Share, Routine-UI, Ernährung, Initialgespräch, Coach-Offer.
- Rail-Nav: Snap + Pfeile nach PR #136–#138 stabilisiert — **Regressionen hier besonders teuer**.

### Profil

- Foto, Mantra, Coaching/Calendly, Passwort-Einstellung, Punkte, Einladung, Trainer-Stift, Abwesenheit/Kraft.

### Support / Kurse-Daten

- `go-courses-support.sql`, `go-trainings-to-courses.sql`, `go-woche-support.sql`, `go-support-*.sql`.
- Verify-Scripts: `scripts/verify-courses-support.mjs`, `scripts/verify-visibility-team.mjs`.

---

## 5. Parallel: Account-App

`account/index.html` (~20 k Zeilen) bleibt die ältere Member-Oberfläche. Strukturkarte: `docs/gogogo-account-app-MAP.md`.  
Neue Produktarbeit fokussiert `/workout/`. Änderungen an Account nur wenn explizit gewünscht oder für Shared Assets (`assets/go-account-session.js`, Auth).

---

## 6. Offene Risiken / technische Schulden

1. **Monolith `index.html`** — CSS + HTML + Host-JS in einer Datei; Diffs werden leicht groß und konfliktanfällig.
2. **Scroll-Stack Plus/Team/Woche** — jede `touch-action`-/snap-/overflow-Änderung braucht Geräte-Test (iOS Safari + installierte PWA).
3. **Zwei Supabase-Projekte** — FFC-Login ≠ gogogo-Session; Ownership-Logik (`offerOwned` + FFC.user) doppelt denken.
4. **SQL manuell** — `go-*.sql` müssen in der richtigen Reihenfolge im Dashboard laufen; Repo speichert Absicht, nicht Ausführungsstatus.
5. **README veraltet** bezüglich „nicht von Hand editieren“ für die Workout-App.
6. **Viele Agent-Branches** `cursor/*-ed26` — nach Merge aufräumen, um Drift zu vermeiden.

---

## 7. Wichtige PRs der Umbau-Phase (Auswahl, neueste zuerst)

| PR | Thema |
|---|---|
| #138 | Plus: `touch-action` pan-x/pan-y + Pfeile ohne settle-Lock |
| #137 | Plus L-R nach TOC→Ernährung (Scroll in `.go-slide__body`) |
| #136 | Natives Snap, Snap nach Rebuild wieder binden |
| #135–#134 | Gruppe Faces/Pill-Rand + Plus-Swipe |
| #133–#131 | Headlines, Routine/FFC/Stempel, Snap+TOC, Aufzeichnungen |
| #119 ff. | Plus-Start, Reise, Aktuell-Flackern, Korrekturen |

Vollständige Historie: GitHub Pull Requests auf `biigJ/gogogo-social`.

---

## 8. Lokaler Check (Minimal)

```bash
# Statisch servieren (Beispiel)
npx --yes serve -l 5173 .

# Workout
open http://localhost:5173/workout/
```

Echte Session braucht Supabase-Auth (Publishable Key liegt im Frontend — wie üblich bei diesem Stack). Für Plus-Swipe/Pfeile: **echtes Touch-Gerät oder Remote-Debug**, Desktop-Maus allein reicht nicht.

---

## 9. Verwandte Dateien

- `CLAUDE.md` — Arbeitsanweisung für Claude Code (Übernahme)
- `docs/gogogo-account-app-MAP.md` — Account-App-Karte
- `vercel.json` — Routes, Deploy-Gates, Cache-Header
- `go-*.sql` — Schema-/Feature-Migrationen
