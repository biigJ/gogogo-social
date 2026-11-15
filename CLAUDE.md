# CLAUDE.md — Übernahme gogogo.social

Anweisung für **Claude Code** (und andere Coding-Agents) bei der Weiterarbeit an diesem Repo.

Zuerst lesen: [`docs/ENTWICKLUNGSSTAND.md`](docs/ENTWICKLUNGSSTAND.md) (Stand 2026-11-15).

---

## Mission

Produktive Member-App ist **`/workout/`** (`natalyaalice/`).  
Stack: Vanilla HTML/CSS/JS, Vercel, zwei Supabase-Projekte. Kein React/Next im Kern der Workout-App.

Du übernimmst ein laufendes Produkt mit frischer, schmerzhafter Scroll-Regression-Serie am Plus-Tab. **Stabilität vor Feature-Fleisch.**

---

## Harte Regeln

1. **Kleine Diffs.** Eine Ursache, ein Fix, ein PR. Keine „gleich noch Headline/FFC/Gruppe mit“.
2. **Vor Touch/Scroll-CSS nie raten.** `touch-action`, `overflow`, `scroll-snap`, nested scroll (Rail vs. `.go-slide__body`) und JS-Settle (`snapLock`, Timer) sind gekoppelt. Ändere **eine** Schicht, dann verifizieren.
3. **Plus-Rail-Regressionstests (Pflicht bei jedem `#go-rail`-Diff):**
   - Plus öffnen → TOC → **Ernährung** tippen → **L-R swipen** (muss gehen).
   - Pfeil rechts **mindestens 5×** hintereinander (jedes Mal neuer Slide).
   - Pfeil links zurück, inkl. über TOC.
   - FFC/Zirkel-Slide: Login-State darf **nicht** flackern (kein unnötiger Full-Rebuild).
4. **iOS / PWA mitdenken.** Desktop-Chrome allein ist kein Freigabesignal für Swipe.
5. **Kein Full-Rebuild von `paintGoRail`**, wenn Offer-Keys + FFC-Login gleich sind — der Skip existiert absichtlich.
6. **`#go-card-routine` vor Rail-`textContent=""` retten** (bestehendes Muster beibehalten).
7. **Zwei Backends nicht vermischen:** gogogo-REST (`agpyse…`) vs. FFC-Client in `ffc.js` (`uxijbec…`).
8. **SQL:** neue Schema-Änderungen als `go-<feature>.sql` committen; nicht annehmen, dass Production schon migriert ist. In UI-Fehlertexten ggf. Dateiname nennen (FFC-Muster).
9. **Deploy:** nur `main` geht live (`vercel.json`). Feature-Branches `cursor/**` deployen nicht.
10. **Sprache UI:** Deutsch primär. Copy kurz, Marken-Ton gogogo, keine generischen AI-Floskeln.
11. **Keine Secrets in Chat pasten.** Keys liegen bereits im Frontend (Publishable/Anon) — keine Service-Role Keys committen.
12. **Account-App (`/account/`) nicht „mitaufräumen“**, außer der Task sagt es explizit.

---

## Wo du editierst

| Task-Typ | Primärdateien |
|---|---|
| Shell / Pill / Layout / Plus-Rail / Team-Rail / Session | `natalyaalice/index.html` |
| Aktuell-Feed / Filter | `natalyaalice/heute-v3.js` |
| Woche-Reels | `natalyaalice/woche-reels.js` |
| FFC Zirkel / Leaderboard / Posts | `natalyaalice/ffc.js`, `natalyaalice/ffc.css` |
| Buchungen / Ownership Plus | `natalyaalice/support.js` |
| Routes / PWA / Cache | `vercel.json`, `natalyaalice/manifest.webmanifest` |
| Schema | `go-*.sql` |
| Shared Auth | `assets/auth.js`, `assets/go-account-session.js` |

`index.html` ist riesig (~20k Zeilen). Suche gezielt (`#go-rail`, `paintGoRail`, `bindRailNav`, `bindGoRailHardSnap`, `data-shell=`, `jumpToGoOffer`). Nicht die ganze Datei umformatieren.

---

## Plus-Rail — Vertrag (nicht brechen)

```
#go-rail          → horizontaler Scroll + snap (touch-action: pan-x)
.go-slide         → feste Breite = Rail-Viewport, kein eigener Vertikal-Scroll
.go-slide__body   → vertikaler Scroll INHALT (touch-action: pan-x pan-y)
#go-rail-nav      → Titel + Pfeile; Pfeile → sofort snapGoRailToIndex(..., false)
                   Timer + snapLock clearen; KEIN smooth-Fight gegen settle
jumpToGoOffer     → Lock clearen, snap sofort, body.scrollTop = 0
```

Wenn etwas „nur einmal“ klickbar ist: zuerst `snapLock` / `_goSnapTimer` / disabled-State der Buttons prüfen — nicht neuen Gesture-Stack bauen.

Wenn Swipe nach TOC tot ist: zuerst `touch-action` und welches Element den Touch bekommt — nicht Pointer-Events-Hack auf die Pill.

---

## Arbeitsablauf (empfohlen)

1. Task in einem Satz + Repro (Gerät, Tab, Schritte).
2. Betroffene Funktion/CSS lokalisieren; **Nachbar-Features nicht anfassen**.
3. Fix schreiben.
4. Manuell: Repro + die drei Plus-Pflichtchecks (wenn Rail betroffen) + „Nachbar-Tab kurz ansehen“ (Aktuell/Team nicht regressen).
5. Commit-Message auf Deutsch oder EN, aber **ursachenklar** (`Fix: …` / `Feat: …`), kein Roman.
6. PR klein halten; Beschreibung = Repro + Fix + Testnotiz.

### Branch-Konvention (wenn Cloud/Cursor-Agents)

`cursor/<kurzname>-ed26` — lowercase. Base i. d. R. `main`, außer der Auftrag sagt die Umbau-Branch.

---

## Host-API (Module ↔ `index.html`)

Module erwarten einen Host mit u. a.:

- `rest(path, opts)` — gogogo Supabase REST
- `sessionAccount` — eingeloggter Account
- `todayIso()`, ggf. Datumshelfer
- Callbacks / Mount-Punkte je Modul (`FFC_HOST`, Heute/Woche init)

Neue Module: IIFE, `host`-Inject, kein Bundler. Globale Namen nicht kollidieren lassen.

---

## Typische Fallstricke

| Symptom | Erste Verdächtige |
|---|---|
| Swipe L-R tot | `touch-action` nur `pan-y`; Overlay fängt Touch; Rail `overflow` |
| Pfeil 1× dann tot | `snapLock`, `_goSnapTimer`, smooth scroll vs. settle |
| FFC flackert | `paintGoRail(true)` / Full-Rebuild trotz gleicher Keys |
| Faces hinter Pill abgeschnitten | Team empty-layout / safe-area / Pill z-index — nicht Plus-Rail „mitfixen“ |
| Feed leer nach Refresh | `heute-v3` paint/refreshSeq / „sichtbar lassen“-Logik |
| Buchung zeigt falsch | `GoSupport.offerOwned` vs. FFC.user für Zirkel |
| Alt-URL 404 | Rewrite nur `/workout/`; `/natalyaalice` redirectet |

---

## Was du absichtlich *nicht* tun sollst

- Custom Touch-Swipe-Engine parallel zu CSS-Snap neu erfinden.
- `touch-action: none` auf große Flächen legen „damit JS alles regelt“.
- Monolith in Framework migrieren ohne expliziten Auftrag.
- Service-Role Keys, `.env` mit Secrets, oder Production-Daten dump’en.
- README’s „deploy from friday-circle“-Skript als Ersatz für Workout-Fixes behandeln.
- PR-Beschreibungen oder Docs des Users überschreiben, wenn er sie in GitHub editiert hat.

---

## Definition of Done (UI-Task)

- [ ] Diff berührt nur nötige Dateien/Funktionen
- [ ] Repro des Bugs ist behoben
- [ ] Bei Plus-Rail: 3 Pflichtchecks grün (TOC-Swipe, 5× Pfeil, kein FFC-Flackern)
- [ ] Kein neuer Lock/Timer ohne Clear-Pfad
- [ ] SQL nur wenn Schema wirklich nötig; Datei im Repo
- [ ] Kurz in PR gesagt, **wie** getestet wurde (Gerät/Browser)

---

## Einstiegs-Prompts (Copy-Paste)

**Bugfix Plus:**
> Lies CLAUDE.md und docs/ENTWICKLUNGSSTAND.md. Bug: \<Repro\>. Ändere nur natalyaalice Plus-Rail. Nach Fix die drei Pflichtchecks beschreiben.

**Feature Aktuell/Woche:**
> Lies CLAUDE.md. Feature: \<…\>. Primärdatei heute-v3.js oder woche-reels.js. index.html nur wenn DOM-Hooks fehlen. Keine Plus-Rail-Änderungen.

**Schema:**
> Neue Spalte/Tabelle für \<…\>. Schreibe go-\<name\>.sql idempotent (IF NOT EXISTS), erwähne RLS falls nötig, und die minimale Frontend-Stelle.

---

## Kontakt-Kontext Produkt

- Marke: **gogogo** / Friday Fitness Circle (FFC)
- Zielgruppe: Trainings-Community, DE-first
- Mobile PWA ist Primärfläche; Portrait-Lock / Safe-Area sind Absicht

Bei Unklarheit: **kleinere sichere Änderung** wählen und im PR die offene Frage nennen — nicht spekulativ die Scroll-Architektur umbauen.
