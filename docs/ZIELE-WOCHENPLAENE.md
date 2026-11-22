# Ziele × Wochenpläne

Zielgruppe: 32 bis 52 Jahre, Männer und Frauen, meist Wiedereinsteiger.
Jeder Plan hat 7 Tage. Freie Tage sind Bewegung (Schritte, Mobility).

## Level

| Level | Kraft | Ausdauer | Zirkel | Bewegung |
|---|---|---|---|---|
| 1 Einstieg | 2 | 1 | 1 | 3 |
| 2 Aufbau | 3 (1 bis 2 funktional) | 1 | 1 | 2 |
| 3 Ausdauer dazu | 2 bis 3 | 2 bis 3 | 1 | 0 bis 1 |

## Ziele (Auswahl im Stift-Dialog, Mehrfachwahl)

| Schlüssel | Text in der App | Kurz |
|---|---|---|
| `laufen` | Gesund laufen | ohne Knie- und Rückenschmerzen |
| `ruecken` | Rücken stärken | weniger Rückenschmerzen |
| `gesund` | Gesund bleiben | fit für den Alltag |
| `abnehmen` | Abnehmen | durch mehr Bewegung |
| `muskeln` | Muskeln erhalten | stark bleiben mit den Jahren |
| `gelenke` | Gelenke schonen | Knie, Hüfte, Schulter |

## Matrix

✓ = gibt es schon, ○ = fehlt noch (Vorschlag für den Namen)

| Ziel | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| Gesund laufen | ✓ Fit for Run | ✓ Fit for Run | ✓ Fit for Run |
| Rücken stärken | ○ Starker Rücken | ○ Starker Rücken | ○ Starker Rücken |
| Gesund bleiben | ✓ Hybrid Kraft 2× | ✓ Hybrid Kraft 3× (als L2 einstufen) | ○ Hybrid Ausdauer |
| Abnehmen | ✓ Superwoman | ○ Mehr Bewegung | ○ Mehr Bewegung |
| Muskeln erhalten | ✓ Hybrid Kraft 2× | ✓ Hybrid Kraft 3× | ○ Kraft & Kondition |
| Gelenke schonen | ✓ Bulletproof Knees | ○ Bulletproof Knees | ○ Bulletproof Knees |

## gogogo-Hybrid-Prinzip (gilt für jedes Event)

Einfache Herangehensweise: Grundübungen in jeder Variante.

- Jede Einheit enthält Hüftöffnung, Hängen und Hocksitz und/oder Kniebeuge. Ausnahme: Fuß verletzt oder ähnlich.
- Reihenfolge der Blöcke: Mobilität (mit Gewicht, sobald kräftig genug) → Explosivkraft (Sprünge, Würfe) → Grundübung → komplexe Übung → Geräte (Hypertrophie) → Finisher.
- Hypertrophie hängt nicht an 10 bis 12 Wiederholungen. Entscheidend ist, dass die letzten Wiederholungen schwer werden.
- Keine Sätze, Wiederholungen oder Pausen als Felder. Varianten stehen im Übungsnamen, der Hinweis höchstens „Ungefähr: Sätze × Wdh × Gewicht“.
- Keine doppelten Übungen unter verschiedenen Namen. Vor dem Anlegen im Katalog nach vorhandenem Namen suchen.
- In der App erscheint der Kurztext dazu beim Weg zu den Plänen („Alle Pläne zeigen“ / „Passende Pläne zeigen“) (`PRINZIP` in `natalyaalice/plan-picker.js`).

## Abweichungen der bestehenden Pläne vom Level-Schema

- Keiner hat einen Zirkel-Tag. Laut Schema gehört in jedes Level einer (Freitag).
- Bulletproof Knees L1 und Hybrid Kraft 2× haben keinen Ausdauertag.
- Hybrid Kraft 3× ist als L1 eingetragen, passt nach Schema zu L2.

## Wo es steckt

- Ziele je Plan: `courses.goals` (Startbelegung in `go-wochenplan-wahl.sql`, pflegen im Kurs-Editor)
- Sichtbar für Nutzer: `courses.is_public` (Haken „öffentlich“ im Kurs-Editor)
- Ziel-Texte in der App: `natalyaalice/plan-picker.js` (`GOALS`)
