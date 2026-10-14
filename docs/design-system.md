# Design-System: Broadsheet

> Quelle: https://claude.ai/code/artifact/354c87d0-94cc-4b0f-a0ba-3809f0d37301
> Diese Datei fasst die Tokens und Komponentenregeln für die App zusammen. Der `/frontend`-Skill liest sie beim Bauen der Oberfläche.
> App-Entwurf (Layout, Navigation, Seiten): `docs/design/app-entwurf.html` (lauffähig) und `docs/design/app-entwurf-quelltext.html` (lesbar), Quelle https://claude.ai/artifact/7ajSUrRxcJKYgzUPsNdrTA. Wo Entwurf und diese Datei abweichen (z. B. Buttons und Balken in `accent-700` statt `accent`), gilt der Entwurf.

## Charakter
Ruhige, papierartige Fläche, dunkle Tinte als Text, zwei kräftige Druckfarben (Cyan und Magenta) als Akzente. Klare Serifenschrift, kleine Radien, sparsame Schatten.

## Farben

### Basis
| Token | Wert | Verwendung |
|-------|------|------------|
| `--color-bg` | `#f3f2f2` | Seitenhintergrund |
| `--color-surface` | `#eae9e9` | Karten, Panels, Eingabeflächen |
| `--color-text` | `#201e1d` | Text, Icons |
| `--color-accent` | `#0088b0` | Primärfarbe (Cyan): Primär-Buttons, Links, Fokus |
| `--color-accent-2` | `#d6006c` | Zweitakzent (Magenta): Hervorhebungen, Warn-/Status-Akzente |
| `--color-divider` | `color-mix(in srgb, #201e1d 16%, transparent)` | Trennlinien, Rahmen |
| `--color-process-yellow` | `#edbb00` | Nur dekorativ (Druck-Effekte), nie für Text oder Bedienelemente |

Gedämpfter Text: `color-mix(in srgb, var(--color-text) 55%, transparent)`.

### Tonale Rampen
Erzeugt in OKLCH auf einer gemeinsamen Helligkeitsskala: Die gleiche Stufe wirkt in jeder Farbe gleich hell.

| Stufe | Neutral | Accent (Cyan) | Accent-2 (Magenta) |
|-------|---------|---------------|--------------------|
| 100 | `#f8f4f4` | `#e9f8ff` | `#fff1f4` |
| 200 | `#eae7e7` | `#cbeeff` | `#ffdee6` |
| 300 | `#d7d3d3` | `#99e0ff` | `#ffc0d0` |
| 400 | `#bab6b6` | `#62c5ee` | `#ff90b1` |
| 500 | `#9b9797` | `#38a6cf` | `#ff458e` |
| 600 | `#7d7979` | `#1186ac` | `#d82071` |
| 700 | `#605d5d` | `#006786` | `#aa0b56` |
| 800 | `#444141` | `#004961` | `#790e3d` |
| 900 | `#2d2b2b` | `#0a303e` | `#4b1528` |

## Typografie
- **Schrift:** „Source Serif 4“ (Google Fonts) für Überschriften und Fließtext; Fallback `system-ui, sans-serif`
- **Gewichte:** Überschriften 600, Fließtext 400
- **Fließtext:** 15px, Zeilenhöhe 1.55
- **Überschriften:** Zeilenhöhe 1.12, letter-spacing −0.015em

| Ebene | Größe |
|-------|-------|
| h1 | 42px |
| h2 | 32px |
| h3 | 25px |
| h4 | 20px |
| h5 | 16px |
| h6 | 13px, Versalien, letter-spacing 0.08em |

Bildunterschriften: 11px, gedämpfter Text.

## Abstände
5er-Raster: `--space-1` 5px · `--space-2` 10px · `--space-3` 15px · `--space-4` 20px · `--space-6` 30px · `--space-8` 40px

## Radien
`--radius-sm` 1px · `--radius-md` 2px · `--radius-lg` 4px. Die Kanten sind bewusst fast eckig.

## Schatten
| Token | Wert |
|-------|------|
| `--shadow-sm` | `0 1px 2px color-mix(in srgb, #2d2b2b 14%, transparent)` |
| `--shadow-md` | `0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent)` |
| `--shadow-lg` | `0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent)` |

## Komponenten
- **Buttons:** Schrift wie Überschriften (600), 14px; Padding 10px × 18px; Radius `--radius-md`
  - *Primary:* Hintergrund accent, Text bg; Hover accent-600, Active accent-700
  - *Secondary:* transparenter Hintergrund, Rahmen divider; Hover Text mit 7 %, Active 14 % Deckkraft
  - *Ghost:* Text accent, ohne Rahmen
  - *Disabled:* Deckkraft 0.45
- **Links:** accent, Unterstreichungs-Abstand 3px
- **Fokus:** `outline: 2px solid accent; outline-offset: 2px` (nur `:focus-visible`)
- **Textauswahl:** accent mit 30 % Deckkraft
- **Trennlinie:** 1px, divider, Abstand 20px oben/unten

## Hinweise für die Umsetzung
- Die Tokens werden auf die shadcn/ui-CSS-Variablen abgebildet (`--background`, `--foreground`, `--primary`, `--border`, `--radius` usw.). Es werden keine eigenen Varianten installierter shadcn-Komponenten gebaut.
- Die Druck-Effekte des Systems (CMYK-Plattenversatz, Halftone-Raster, `.cmyk-head`/`.cmyk-num`) eignen sich höchstens für Login- oder Marketing-Seiten, nicht für die eigentliche App-Oberfläche.
- Das Quell-System definiert nur ein helles Theme. Ein Dark Mode wird bei `/frontend` aus den Rampen abgeleitet.
- Statusfarben (Erfolg, Warnung, Fehler) sind im System nicht definiert und werden bei `/frontend` passend zu den Rampen ergänzt.
