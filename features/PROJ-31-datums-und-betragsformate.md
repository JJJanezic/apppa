# PROJ-31: Einheitliche Datums- und Betragsformate

## Status: Deployed
**Created:** 2026-10-28
**Last Updated:** 2026-10-28

## Dependencies
- Requires: PROJ-2 (App-Shell & Design-System): zentrale Zahlen- und Datumsformate, deutsche Texte
- Requires: PROJ-8 (Manuelle Buchungen): Buchungsliste, Buchungs-Detail, Buchungsformular mit Beträgen
- Requires: PROJ-9 (Belegungskalender): Datumsangaben in Zeitleiste, Monatsansicht, Tagesliste
- Berührt außerdem: PROJ-5 (Betreiber-Admin: Protokoll, Kundenliste), PROJ-4 (Einladungen), PROJ-6 (Wohnungspreise), PROJ-7/PROJ-29 (Gäste: Geburts- und Ausstellungsdatum), PROJ-27 (Preisvorschlag), PROJ-30 (Abreisen, Hochrechnung)

## Überblick
Alle Datumsangaben und Geldbeträge in der App erscheinen in einem einheitlichen Format. Die Buchungsliste zeigt den Zeitraum zweizeilig.

### Datumsformat

| Art | Format | Beispiel |
|---|---|---|
| **Standard** (Anreise, Abreise, „Option gilt bis“, Storno-Datum, Warnungen, Detail, Listen, Hinweise) | Wochentag (2 Buchstaben), Beistrich, `TT.MM.JJJJ` | Mi, 28.10.2026 |
| **Mit Uhrzeit** (Zeitpunkte, z. B. Betreiber-Protokoll) | Standard + Beistrich + `HH:MM` | Di, 27.10.2026, 14:35 |
| **Ohne Wochentag** (Geburtsdatum, Ausstellungsdatum des Reisedokuments) | `TT.MM.JJJJ` | 15.05.1978 |
| **Wenig Platz** (Belegungskalender: Tageskopf der Zeitleiste, Monatskästchen u. Ä.) | Wochentag entfällt; was bisher nur Tag/Kurzform zeigte, darf kurz bleiben | 28.10.2026 bzw. „27“ |

Wochentage: Mo, Di, Mi, Do, Fr, Sa, So. Tag und Monat immer zweistellig (03.11.2026).

**Ausnahmen (bleiben wie bisher):**
- Monatsanzeigen als Überschrift („Oktober 2026“) in Buchungsliste und Kalender
- Datum unter dem Gruß auf dem Dashboard („Mittwoch, 28. Oktober 2026“)
- Datumsfelder in Formularen (Darstellung bestimmt der Browser), ohne zusätzlichen Wochentags-Hinweis

### Betragsformat
- Überall mit zwei Nachkommastellen, Tausenderpunkt, Euro-Zeichen vorne wie bisher: **€ 1.250,00**, **€ 360,00**, **€ 0,00**
- Gilt auch in Texten (Preisvorschlag, Hochrechnung bei Verlängerung, Wohnungspreise „pro Nacht“/„pro Erwachsenem“), Listen, Detail, Endbetrag
- **Eingabefelder** (Übernachtungspreis, Zusatzkosten, Stornogebühr, Preise und Reinigungsgebühr der Wohnung): beim Öffnen vorbelegt mit zwei Nachkommastellen („360,00“, „1.250,00“); beim Verlassen des Feldes wird eine gültige Eingabe in dieses Format umgeschrieben („1250“ → „1.250,00“, „45,5“ → „45,50“); während des Tippens bleibt die Eingabe unverändert

### Buchungsliste: Zeitraum zweizeilig
- Tabelle (ab Tablet): Spalte „Zeitraum“ zweizeilig wie die Spalte „Gast bzw. Sperre“: oben die Anreise, darunter die Abreise, je im Standardformat
- Karten (Handy): Zeitraum einzeilig „Mi, 28.10.2026 – Di, 03.11.2026 · 6 Nächte“

## User Stories
- Als Vermieter (Inhaber oder Mitarbeiter) möchte ich bei jedem Datum den Wochentag sehen, damit ich An- und Abreisetage sofort einordnen kann (z. B. Wechseltag Samstag).
- Als Vermieter möchte ich das Datum mit Jahr sehen, damit Buchungen über den Jahreswechsel und in der Suche über alle Monate eindeutig sind.
- Als Vermieter möchte ich in der Buchungsliste Anreise und Abreise untereinander sehen, damit die Spalte trotz längerem Format lesbar bleibt.
- Als Inhaber möchte ich alle Beträge mit zwei Nachkommastellen sehen, damit Preise, Zusatzkosten und Endbetrag einheitlich und abrechnungstauglich aussehen.
- Als Inhaber möchte ich, dass meine Eingabe eines Betrags nach dem Verlassen des Feldes sauber formatiert wird, damit ich Tippfehler wie fehlende Nachkommastellen sofort erkenne.
- Als Betreiber möchte ich Zeitpunkte im Protokoll mit Wochentag, Datum und Uhrzeit sehen, damit ich Vorgänge zeitlich genau zuordnen kann.

## Out of Scope
- Datumsfelder in Formularen: kein eigenes Datumsfeld und kein Wochentags-Hinweis darunter (Darstellung bestimmt der Browser)
- Monatsüberschriften („Oktober 2026“) und das Datum unter dem Gruß auf dem Dashboard: bleiben unverändert
- Englische Oberfläche und andere Sprachen (PROJ-23); das Format gilt für Deutsch
- Negative Beträge bei Zusatzkosten: PROJ-32
- Aufteilen der Firmenanschrift: PROJ-33
- Exporte und Berichte (z. B. Ortstaxe-Monatsbericht PROJ-16, CSV PROJ-19): legen ihr Format selbst fest
- E-Mails (Einladungen, Passwort): enthalten heute kein Buchungsdatum, bleiben unverändert

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Datum
- [ ] Angenommen eine Buchung vom 28.10.2026 bis 03.11.2026, wenn das Buchungs-Detail angezeigt wird, dann stehen dort „Mi, 28.10.2026“ und „Di, 03.11.2026“
- [ ] Angenommen eine Option gilt bis 05.11.2026, wenn Detail, Liste (Kennzeichen „bis …“) oder Kalender sie zeigen, dann steht das Datum als „Do, 05.11.2026“
- [ ] Angenommen eine Überschneidung, wenn die Warnung im Formular oder der Hinweis im Detail erscheint, dann sind die Daten der anderen Buchung im Standardformat angegeben
- [ ] Angenommen ein Gast mit Geburtsdatum 15.05.1978 und Ausstellungsdatum 02.03.2020, wenn Gast-Detail, Zusammenführen oder die Mitreisenden angezeigt werden, dann stehen dort „15.05.1978“ und „02.03.2020“ ohne Wochentag
- [ ] Angenommen ein Eintrag im Betreiber-Protokoll vom 27.10.2026 um 14:35, wenn das Protokoll angezeigt wird, dann steht „Di, 27.10.2026, 14:35“
- [ ] Angenommen ein Kunde, eine Einladung oder ein 2FA-Gerät mit Datum, wenn die jeweilige Liste angezeigt wird, dann steht das Datum im Standardformat
- [ ] Angenommen der Gast-Detail-Abschnitt „Aufenthalte“ bzw. die Buchungen eines Gastes, wenn sie angezeigt werden, dann stehen An- und Abreise im Standardformat
- [ ] Angenommen das Dashboard, wenn es angezeigt wird, dann steht unter dem Gruß das Datum unverändert ausgeschrieben („Mittwoch, 28. Oktober 2026“)
- [ ] Angenommen die Buchungsliste oder die Monatsansicht des Kalenders, wenn ein Monat angezeigt wird, dann steht die Überschrift unverändert als „Oktober 2026“

### Buchungsliste
- [ ] Angenommen die Buchungsliste ab Tablet-Breite, wenn eine Buchung angezeigt wird, dann steht in der Spalte „Zeitraum“ oben die Anreise und darunter die Abreise, je im Standardformat
- [ ] Angenommen die Buchungsliste auf dem Handy (375 px), wenn eine Buchung angezeigt wird, dann steht der Zeitraum einzeilig „Mi, 28.10.2026 – Di, 03.11.2026“ mit Nächten, ohne seitliches Scrollen
- [ ] Angenommen die Suche über alle Monate, wenn Treffer aus verschiedenen Jahren angezeigt werden, dann ist das Jahr bei jedem Datum sichtbar

### Belegungskalender
- [ ] Angenommen die Zeitleiste, wenn der angezeigte Zeitraum oben steht, dann im Standardformat („So, 25.10.2026 – Sa, 07.11.2026“)
- [ ] Angenommen ein Balken, wenn der Hinweis beim Darüberfahren bzw. die Beschriftung für Screenreader erscheint, dann mit beiden Daten im Standardformat
- [ ] Angenommen die Tagesliste der Monatsansicht, wenn ein Tag gewählt ist, dann stehen Tag und „bis …“-Angaben im Standardformat
- [ ] Angenommen Tageskopf der Zeitleiste oder Kästchen der Monatsansicht, wenn sie angezeigt werden, dann passt der Inhalt ohne Überlauf; wo das volle Format nicht passt, entfällt der Wochentag
- [ ] Angenommen die Zeitleiste auf dem Handy (375 px), wenn sie angezeigt wird, dann gibt es kein seitliches Scrollen der Seite

### Beträge
- [ ] Angenommen ein Endbetrag von 360 €, wenn Liste, Detail oder Formular ihn zeigen, dann steht „€ 360,00“
- [ ] Angenommen ein Betrag von 1250 €, wenn er angezeigt wird, dann steht „€ 1.250,00“
- [ ] Angenommen der Preisvorschlag bzw. der Hinweis bei Verlängerung im Formular, wenn er erscheint, dann sind alle Beträge darin mit zwei Nachkommastellen
- [ ] Angenommen die Wohnungsübersicht und das Wohnungsformular, wenn Preise oder Reinigungsgebühr angezeigt werden, dann mit zwei Nachkommastellen
- [ ] Angenommen eine Buchung mit Übernachtungspreis 360 €, wenn das Formular „Buchung bearbeiten“ geöffnet wird, dann steht im Feld „360,00“
- [ ] Angenommen ein Betragsfeld, wenn „1250“ eingegeben und das Feld verlassen wird, dann steht dort „1.250,00“
- [ ] Angenommen ein Betragsfeld, wenn „45,5“ eingegeben und das Feld verlassen wird, dann steht dort „45,50“
- [ ] Angenommen ein Betragsfeld, wenn während des Tippens „12“ steht, dann wird es nicht umgeschrieben, bevor das Feld verlassen wird
- [ ] Angenommen ein Betragsfeld mit „abc“, wenn das Feld verlassen wird, dann bleibt „abc“ stehen und beim Speichern erscheint die bisherige Fehlermeldung
- [ ] Angenommen ein leeres, optionales Betragsfeld (z. B. Stornogebühr), wenn es verlassen wird, dann bleibt es leer
- [ ] Angenommen ein umgeschriebener Wert „1.250,00“, wenn gespeichert wird, dann wird genau 1.250,00 € gespeichert

## Edge Cases
- **Jahreswechsel:** Buchung vom 30.12.2026 bis 02.01.2027 → beide Daten mit eigenem Jahr („Mi, 30.12.2026“ / „Sa, 02.01.2027“).
- **Sehr lange Gastnamen und zweizeiliger Zeitraum:** Zeile bleibt lesbar, keine Überlappung; der Zeitraum bricht nicht innerhalb eines Datums um.
- **Betrag 0:** „€ 0,00“; leeres Pflichtfeld bleibt leer und meldet wie bisher „Bitte … eingeben“.
- **Große Beträge:** „€ 1.000.000,00“ (Höchstbetrag) passt in Liste und Detail.
- **Mitarbeiter:** sehen weiterhin keine Beträge; nur die Datumsformate ändern sich für sie.
- **Ältere Einträge ohne Uhrzeit oder mit Zeitzone:** Zeitpunkte werden in Wiener Zeit angezeigt (wie bisher), das Datum verschiebt sich nicht durch die Zeitzone.
- **Eingabe mit Tausenderpunkt** („1.250,5“) oder Punkt als Dezimaltrenner („125.5“): wird wie bisher verstanden und beim Verlassen zu „1.250,50“ bzw. „125,50“.

## Technical Requirements (optional)
- Ein zentrales Datums- und ein zentrales Betragsformat für die ganze App, damit künftige Seiten automatisch einheitlich sind
- Bestehende E2E-Tests, die Datums- oder Betragstexte prüfen, werden an das neue Format angepasst
- Browser: Chrome, Firefox, Safari (Desktop und mobil); erstmals auch automatisierte Prüfung in Safari (WebKit ist installiert)

## Open Questions
- [ ] Gibt es weitere Stellen mit wenig Platz außer Tageskopf und Monatskästchen, an denen der Wochentag entfallen muss? (wird beim Bauen geprüft und im Tech Design festgehalten)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Standardformat „Mi, 28.10.2026“ überall | Nutzerwunsch; Wochentag hilft bei An-/Abreisetagen, Jahr macht Daten eindeutig | 2026-10-28 |
| Geburts- und Ausstellungsdatum ohne Wochentag | Wochentag hat dort keine Aussage | 2026-10-28 |
| Zeitpunkte mit Uhrzeit: „Di, 27.10.2026, 14:35“ | Einheitlich mit dem Standardformat | 2026-10-28 |
| Wo Platz fehlt (Kalender), entfällt der Wochentag | Nutzerentscheidung; Zeitleiste soll nicht breiter werden | 2026-10-28 |
| Monatsüberschriften bleiben „Oktober 2026“ | Kein einzelnes Datum; „10.2026“ liest sich schlechter | 2026-10-28 |
| Datum unter dem Dashboard-Gruß bleibt ausgeschrieben | Nutzerentscheidung | 2026-10-28 |
| Datumsfelder in Formularen unverändert, ohne Wochentags-Hinweis | Darstellung bestimmt der Browser; Nutzer braucht den Hinweis nicht | 2026-10-28 |
| Zeitraum in der Liste zweizeilig wie die Spalte „Gast bzw. Sperre“; auf dem Handy einzeilig | Längeres Format bleibt in der Tabelle lesbar; Karten haben Platz in der Breite | 2026-10-28 |
| Beträge überall mit zwei Nachkommastellen, auch in Eingabefeldern | Nutzerwunsch; einheitlich und abrechnungstauglich | 2026-10-28 |
| Eingabe wird beim Verlassen des Feldes formatiert, nicht während des Tippens | Nichts springt beim Tippen um; ungültige Eingaben bleiben stehen und werden gemeldet | 2026-10-28 |
| Safari-Tab- und Ortstaxe-Hinweis-Fix (`abb94b7`) wird mit diesem Feature ausgeliefert | Nutzerentscheidung: ein gemeinsames Release | 2026-10-28 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nur Frontend, keine Migration | Daten bleiben als Tag bzw. Cent gespeichert; nur Anzeige und Eingabe ändern sich | 2026-10-28 |
| Zentrale Formatstelle in `src/lib/format.ts` für Datum und Betrag | Eine Quelle für alle Seiten; künftige Features übernehmen das Format automatisch | 2026-10-28 |
| Feste Wochentags-Kürzel Mo–So statt Browser-Kurzform | Browser liefern „Mi.“ mit Punkt bzw. uneinheitlich | 2026-10-28 |
| Formate unabhängig von Gerätesprache und -zeitzone; Kalendertage ohne Uhrzeit gebildet, Zeitpunkte in Wiener Zeit | Gleiche Ausgabe auf Server und im Browser; kein Verschieben des Tages | 2026-10-28 |
| Ein gemeinsamer Betragsleser für Buchungen und Wohnungen (versteht Tausenderpunkt) | Wohnungsleser kannte keinen Tausenderpunkt und hätte „1.250,00“ abgelehnt | 2026-10-28 |
| Baustein „Betragsfeld“ aus shadcn Input, formatiert beim Verlassen | Regel an einer Stelle statt in acht Formularen | 2026-10-28 |
| ESLint-Schutzregel gegen direkte Datums-/Währungsformatierung | Verhindert neue Abweichungen | 2026-10-28 |
| Tageskopf und Monatskästchen bleiben kurz; Zeitraum über dem Kalender darf am Handy umbrechen | Spec: wo es eng ist, ohne Wochentag; kein seitliches Scrollen | 2026-10-28 |
| Zusätzliches Playwright-Projekt „Safari“ (WebKit), gezielt startbar | Safari-Verhalten (Tab-Reihenfolge, Zeilenklick) erstmals automatisch prüfbar | 2026-10-28 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Reines Frontend-Feature: keine Datenbank-Änderung, keine Migration, keine neue Server-Funktion, keine neuen Pakete. Gespeichert werden Daten und Beträge wie bisher (Datum als Kalendertag, Betrag in Cent); es ändert sich nur, **wie** sie angezeigt und eingegeben werden.

Kern ist eine **zentrale Formatstelle** für Datum und Betrag (Erweiterung der bestehenden `src/lib/format.ts` aus PROJ-2). Alle rund 20 Stellen, die heute ein Datum oder einen Betrag selbst formatieren, rufen künftig nur noch diese Stelle auf.

### A) Bausteine

```
Zentrale Formate (src/lib/format.ts, erweitert)
+-- Datum Standard ............ „Mi, 28.10.2026“
+-- Datum mit Uhrzeit ......... „Di, 27.10.2026, 14:35“ (Wiener Zeit)
+-- Datum ohne Wochentag ...... „15.05.1978“ (Geburts-/Ausstellungsdatum, enge Stellen)
+-- Zeitraum .................. „Mi, 28.10.2026 – Di, 03.11.2026“
+-- Betrag .................... „€ 1.250,00“ (immer zwei Nachkommastellen)
+-- Betrag für Eingabefelder .. „1.250,00“ (ohne Euro-Zeichen)
+-- Betrag aus Eingabe lesen .. versteht „1250“, „45,5“, „1.250,00“, „125.5“ (ein Leser für die ganze App)

Neuer Baustein: Betragsfeld (src/components/amount-input.tsx)
+-- shadcn Input + beim Verlassen: gültige Eingabe → „1.250,00“; ungültige/leere bleibt stehen
    eingesetzt in: Übernachtungspreis, Zusatzkosten, Stornogebühr (Dialog und Notiz-Panel),
    Wohnungspreis, Erwachsenenpreis, Kinderstufen-Preise, Reinigungsgebühr

Angepasste Ansichten
+-- Buchungsliste: Spalte „Zeitraum“ zweizeilig (Anreise / Abreise); Handy-Karte einzeilig
+-- Buchungs-Detail, Kennzeichen „bis …“, Warnungen, Storno-Hinweis, Preisvorschlag, Hochrechnung
+-- Belegungskalender: Zeitraum oben, Balken-Hinweis und -Beschriftung, Tagesliste (Standard);
|   Tageskopf und Monatskästchen bleiben kurz wie bisher
+-- Gäste: Aufenthalte (Standard), Geburts- und Ausstellungsdatum (ohne Wochentag), Zusammenführen
+-- Wohnungsübersicht und -formular: Preise mit zwei Nachkommastellen
+-- Betreiber: Kundenliste, Kunden-Detail, Protokoll (mit Uhrzeit); Einladungen; 2FA-Geräte
+-- unverändert: Monatsüberschriften, Datum unter dem Dashboard-Gruß, Datumsfelder in Formularen
```

### B) Daten
Keine neuen Daten. Kalendertage (An-/Abreise, „Option gilt bis“, Geburtsdatum …) werden direkt aus dem gespeicherten Tag gebildet, nicht über eine Uhrzeit. Dadurch kann sich der Tag durch Zeitzonen nicht verschieben. Zeitpunkte mit Uhrzeit (Protokoll, „angelegt am“, „storniert am“) werden in Wiener Zeit angezeigt.

### C) Technische Entscheidungen (Begründung)
- **Eine zentrale Formatstelle statt Formatangaben an jeder Stelle:** Heute legt jede Seite ihr Format selbst fest; daher die Unterschiede. Mit einer Stelle sehen alle Seiten gleich aus, und künftige Seiten (Zahlungen, Ortstaxe) übernehmen das Format automatisch.
- **Eigene Wochentags-Kürzel (Mo–So):** Die Standard-Kurzform des Browsers für Deutsch ist „Mi.“ mit Punkt bzw. je nach Browser unterschiedlich. Eine feste Liste liefert überall genau „Mi“.
- **Gleiche Ausgabe auf Server und im Browser:** Viele Seiten werden am Server erzeugt und im Browser weitergeführt. Die Formate hängen deshalb nicht von Spracheinstellung oder Zeitzone des Geräts ab (sonst Flackern oder abweichende Daten).
- **Ein gemeinsamer Leser für Beträge:** Die Wohnungspreise hatten einen eigenen, strengeren Leser ohne Tausenderpunkt. Weil Eingaben künftig zu „1.250,00“ umgeschrieben werden, nutzen Buchungen und Wohnungen denselben Leser, der Tausenderpunkte versteht. Höchstbeträge bleiben je Feld wie bisher.
- **Betragsfeld als eigener Baustein (aus shadcn Input):** Die Regel „beim Verlassen formatieren, beim Tippen nicht“ steckt an einer Stelle statt in acht Formularen.
- **Schutzregel im Code-Prüfer (ESLint):** Direkte Datums- oder Währungsformatierung außerhalb der zentralen Stelle wird angemahnt, damit sich keine neuen Abweichungen einschleichen.
- **Enge Kalenderstellen bleiben kurz:** Tageskopf der Zeitleiste und Monatskästchen zeigen wie bisher Wochentag/Tageszahl; der Zeitraum über dem Kalender darf auf dem Handy zweizeilig umbrechen, statt die Seite zu verbreitern.
- **Safari in den Tests:** Ein zusätzliches, gezielt startbares Test-Projekt „Safari“ (WebKit ist installiert) prüft die wichtigsten Abläufe, darunter die Tab-Reihenfolge aus dem Fix `abb94b7`.

### D) Tests
- Unit-Tests für die zentralen Formate (Standard, mit Uhrzeit, ohne Wochentag, Jahreswechsel, Betrag 0, Höchstbetrag) und für das Umschreiben im Betragsfeld.
- Bestehende E2E-Tests, die Texte wie „3. Nov.“ oder „€ 420“ prüfen, werden auf das neue Format umgestellt; neue E2E-Tests je Akzeptanzkriterium.

### E) Pakete
Keine neuen Pakete.

## Implementation Notes (Frontend)
**Stand 2026-10-28.** Frontend fertig; kein Backend nötig (keine Migration, keine Server-Funktion).

**Zentrale Formate (`src/lib/format.ts`)**
- `formatDate` („Mi, 28.10.2026“), `formatDateTime` („Di, 27.10.2026, 14:35“, Wiener Zeit), `formatDatePlain` („15.05.1978“), `formatPeriod`, für enge Stellen `formatWeekday` („Mi“) und `formatDayOfMonth` („28“). Kalendertage werden aus dem ISO-Tag gebildet (keine Zeitzonen-Verschiebung), Zeitpunkte über `Intl` mit fester Zeitzone Europe/Vienna; feste Wochentagsliste Mo–So.
- `formatCurrency` immer mit zwei Nachkommastellen (Option `cents` entfällt), `formatCents` für Cent-Werte, `amountInput` („1.250,00“) und `parseAmountCents` (ein Leser für die ganze App) zentral; `src/lib/bookings.ts` exportiert sie weiter.
- Wohnungspreise: `parsePriceCents` nutzt den gemeinsamen Leser (versteht jetzt „1.250,00“), Höchstwert 99.999,99 € bleibt; `priceInput` = `amountInput`.

**Betragsfeld (`src/components/amount-input.tsx`)**: shadcn Input; formatiert eine gültige Eingabe beim Verlassen, lässt leere/ungültige stehen. Eingesetzt in Übernachtungspreis, Zusatzkosten, Stornogebühr (Dialog und Notiz-Panel), Wohnungspreis, Erwachsenenpreis, Kinderstufen-Preise, Reinigungsgebühr.

**Umgestellte Ansichten**: Buchungsliste (Spalte „Zeitraum“ zweizeilig, Handy-Karte einzeilig; Prop `withYear` entfällt, Jahr steht immer), Buchungs-Detail (Mitreisende-Geburtsdatum ohne Wochentag), Kennzeichen „bis …“, Warnungen, Kalender (Zeitraum oben, Balken-Hinweis und -Beschriftung, Tagesliste, Monats-Kästchen-Beschriftung für Screenreader; Tageskopf und Monatskästchen kurz mit „Mi“/„28“; Zeitraum-Knopf darf umbrechen), Gast-Detail (Geburts-/Ausstellungsdatum ohne Wochentag), Gästeliste, Zusammenführen, Betreiber-Kundenliste (letzte Anmeldung mit Uhrzeit), Kunden-Detail, Protokoll (mit Uhrzeit), Einladungen, 2FA-Geräte, Wohnungsübersicht. Texte mit festen Beträgen („€ 0,00“, „€ 1.000.000,00“) angepasst.

**Ausnahmen** (mit `eslint-disable-next-line` und Begründung): Datum unter dem Dashboard-Gruß, Monatsüberschrift in Buchungsliste und Kalender.

**Schutzregel**: `eslint.config.mjs` warnt bei `format.dateTime()`/`format.number()` und `toLocaleDateString` (außer `sv-SE` für ISO-Tage) außerhalb von `src/lib/format.ts`.

**Tests**: Unit-Tests in `src/lib/format.test.ts` (Formate, Jahreswechsel, Schalttag, Sommerzeit, Mitternacht), `src/components/amount-input.test.tsx`, angepasst in `bookings.test.ts`/`apartments.test.ts`; 306 grün. Playwright-Projekt `safari` (WebKit) nur mit `PW_SAFARI=1 npx playwright test --project=safari`.

**Offen für /qa**: Bestehende E2E-Tests mit alten Texten/Werten anpassen (z. B. PROJ-8: Feldwerte „60“/„90“ → „60,00“/„90,00“; weitere Prüfungen auf „3. Nov.“, „€ 420“ o. Ä.). `desktopOnly()` in den Specs überspringt das Projekt `safari` – für Safari-Läufe ggf. zulassen.

## QA Test Results

**Tested:** 2026-10-28
**App URL:** http://localhost:3000 (Produktions-Build, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)
**Browser:** Chrome (Desktop 1440 px, Tablet 768 px, Handy 375 px), Safari/WebKit (Projekt `safari`, Desktop 1440 px). Firefox nicht geprüft (kein Playwright-Projekt).

### Acceptance Criteria Status

#### Datum
- [x] AC-1: Buchungs-Detail „Mi, 28.10.2026“ / „Di, 03.11.2026“ (auch Jahreswechsel „Mi, 30.12.2026“ / „Sa, 02.01.2027“)
- [x] AC-2: „Option bis Do, 05.11.2026“ in Detail, Liste (Kennzeichen) und Kalender-Panel
- [x] AC-3: Warnung im Formular und Hinweis im Detail nennen die andere Buchung mit „Mi, 28.10.2026 – Di, 03.11.2026“ (Detail nach Behebung von BUG-1)
- [x] AC-4: Geburts- und Ausstellungsdatum „15.05.1978“ / „02.03.2020“ ohne Wochentag (Gast-Detail, Mitreisende im Buchungs-Detail)
- [x] AC-5: Betreiber-Protokoll „Wochentag, TT.MM.JJJJ, HH:MM“ in Wiener Zeit (geprüft gegen den gespeicherten Zeitpunkt)
- [x] AC-6: Kundenliste (Anlegedatum, letzte Anmeldung mit Uhrzeit), Kunden-Detail „angelegt am“, Einladungen, 2FA-Geräte im Standardformat (Code-Review + E2E Kundenliste/Detail)
- [x] AC-7: Aufenthalte im Gast-Detail im Standardformat
- [x] AC-8: Dashboard-Gruß unverändert ausgeschrieben (PROJ-2-Test)
- [x] AC-9: Monatsüberschrift „Oktober 2026“ in Buchungsliste und Kalender unverändert

#### Buchungsliste
- [x] AC-10: Ab Tablet „Zeitraum“ zweizeilig (Anreise oben, Abreise darunter, je eine Zeile); Screenreader liest „… – …“
- [x] AC-11: Handy-Karte „Mi, 28.10.2026 – Di, 03.11.2026 · 6 Nächte“ in einer Zeile, kein seitliches Scrollen („2 Personen“ bleibt nach BUG-5 zusammen)
- [x] AC-12: Suche über alle Monate zeigt das Jahr bei jedem Datum

#### Belegungskalender
- [x] AC-13: Zeitraum oben im Standardformat (Desktop: „So, 25.10.2026 – Sa, 21.11.2026“, vier Wochen)
- [x] AC-14: Balken-Beschriftung „Buchung: Anna Huber, Mi, 28.10.2026 bis Di, 03.11.2026“
- [x] AC-15: Tagesliste: Kopf „Fr, 30.10.2026“, „bis Di, 03.11.2026“
- [x] AC-16: Tageskopf („Mi“/„28“) und Monatskästchen ohne sichtbaren Überlauf; Kästchen-Beschriftung „Mi, 28.10.2026: …“
- [x] AC-17: Zeitleiste am Handy ohne seitliches Scrollen der Seite (Zeitraum-Knopf bricht nur am „–“ um, „Heute“ mit 16 px Rand; BUG-2/3 behoben)

#### Beträge
- [x] AC-18: „€ 360,00“ in Liste und Detail
- [x] AC-19: „€ 1.250,00“ (inkl. Zusatzkosten) in der Liste
- [x] AC-20: Preisvorschlag und Hochrechnung mit zwei Nachkommastellen („Vorschlag: € 510,00 (3 Nächte × (3 × € 50,00 + …))“, „Neuen Vorschlag € 720,00 übernehmen“, „Verlängert: vereinbart € 500,00 …“)
- [x] AC-21: Wohnungsübersicht „€ 120,00“, Formular „120,00“ / Reinigung „60,00“
- [x] AC-22: „Buchung bearbeiten“ zeigt „360,00“
- [x] AC-23: „1250“ → „1.250,00“ beim Verlassen
- [x] AC-24: „45,5“ → „45,50“
- [x] AC-25: „12“ bleibt während des Tippens unverändert
- [x] AC-26: „abc“ bleibt stehen; Speichern meldet „Bitte einen Betrag wie 125 oder 125,50 eingeben.“
- [x] AC-27: Leere Stornogebühr bleibt leer; „90“ → „90,00“
- [x] AC-28: „1.250,00“ wird als 125000 Cent gespeichert (Buchung); Wohnungspreis „1.250,00“ wird angenommen und als „€ 1.250,00“ gezeigt

### Edge Cases Status
- [x] Jahreswechsel: eigene Jahre je Datum
- [x] Lange Gastnamen + zweizeiliger Zeitraum: kein Umbruch innerhalb eines Datums, kein seitliches Scrollen
- [x] Betrag 0: „0“ → „0,00“; „€ 0,00“ im Preisvorschlag
- [x] Höchstbetrag „€ 1.000.000,00“ passt in Liste (Desktop) und Detail; Handy-Karte bricht den langen Namen um, Betrag bleibt lesbar
- [x] Mitarbeiter: keine Beträge in Liste und Detail, Datum im neuen Format
- [x] Zeitzone: Zeitpunkte in Wiener Zeit; Kalendertage ohne Verschiebung (Unit-Tests Sommerzeit/Mitternacht, E2E Protokoll)
- [x] Eingabe „1.250,5“ → „1.250,50“, „125.5“ → „125,50“
- [x] Zusätzlich: Vorschlag wird schon formatiert eingesetzt, Verlassen des Preisfelds markiert den Preis daher nicht als „von Hand geändert“
- [x] Zusätzlich: zu große Beträge („2.000.000“) werden umgeschrieben und beim Speichern weiterhin mit Fehlermeldung abgelehnt

### Security Audit Results
- [x] Reines Frontend-Feature: keine neuen Server-Aktionen, keine Migration, keine neuen Abfragen
- [x] Betragsleser auf dem Server unverändert streng (gleiche Höchstwerte je Feld: Buchung € 1.000.000,00, Wohnung € 10.000,00); ungültige Eingaben werden serverseitig abgewiesen
- [x] Ausgaben als React-Text (kein `dangerouslySetInnerHTML`); bestehender XSS-Test im Kalender grün
- [x] Mitarbeiter sehen weiterhin keine Beträge (E2E)
- [x] Keine direkte Datums-/Währungsformatierung außerhalb `src/lib/format.ts` (Suche + ESLint-Schutzregel)

### Automatisierte Tests
- `npm run lint`: sauber. Unit-Tests des Features (format, Betragsfeld, bookings, apartments): 58/58 grün.
- `npm test` gesamt: Datenbank-Integrationstests (z. B. `supabase/tests/rls.integration.test.ts`) liefen in 5-s-Zeitüberschreitungen, bei jedem Lauf andere Tests – „apppa-dev“ antwortete langsam. Keine Datenbank-Änderung in PROJ-31, daher kein Feature-Bezug; vor dem Deploy wiederholen.
- Neue E2E-Datei `tests/PROJ-31-datums-und-betragsformate.spec.ts` (22 Tests): Desktop, Tablet, Handy und Safari grün. Hilfsfunktionen `tests/support/format.ts` (vom App-Code unabhängig).
- Bestehende E2E-Tests auf neue Formate umgestellt: PROJ-5 (Kundenliste), PROJ-8, PROJ-9 (Kästchen-Beschriftung), PROJ-27, PROJ-29 (Ausstellungsdatum), PROJ-30 (Hochrechnung, Balken-Beschriftung).
- Regression Desktop grün: PROJ-2, 5, 6, 7, 8, 9, 27, 29, 30 (zwei Timing-Ausreißer in PROJ-8/PROJ-30 bei Wiederholung grün). PROJ-4: 18 grün, 13 rot nur wegen der Supabase-Grenze für Anmelde-Links („Request rate limit reached“), nicht wegen der App; PROJ-4 ändert sich nur in der Einladungsliste (Datum über `formatDate`, Code-Review). Vor dem Deploy mit Abstand wiederholen.

### Bugs Found

#### BUG-1: Überschneidungshinweis im Buchungs-Detail ohne Datum – BEHOBEN
- **Severity:** Medium
- **Fix:** `booking-detail.tsx` hängt „, Mi, 28.10.2026 – Di, 03.11.2026“ an den Link an (wie die Formular-Warnung); E2E prüft es
- **Steps to Reproduce:**
  1. Zwei Buchungen in derselben Wohnung, 28.10.–03.11.2026 und 01.11.–04.11.2026
  2. Detail der zweiten Buchung öffnen
  3. Expected (AC-3): Hinweis nennt die andere Buchung mit „Mi, 28.10.2026 – Di, 03.11.2026“
  4. Actual: „Der Zeitraum überschneidet sich mit: Buchung · 2026-3101 · Huber, Anna“ (Link ohne Datum). Die Formular-Warnung zeigt die Daten korrekt.
- **Priority:** Fix before deployment (klein: Datum an `conflictLabel` in `booking-detail.tsx` anhängen, sofern die Konflikt-Daten An-/Abreise mitliefern)

#### BUG-2: Zeitraum-Knopf der Zeitleiste bricht am Handy innerhalb eines Datums um – BEHOBEN
- **Severity:** Low
- **Fix:** sichtbarer Text mit geschütztem Leerzeichen je Datum (`calendar-view.tsx`); Vorlesetext unverändert; E2E prüft es
- **Steps to Reproduce:** Handy 375 px, `/belegung?ansicht=zeitleiste&ab=2026-10-25` → „So, 25.10.2026 – Sa,“ / „21.11.2026“. Expected: Umbruch nur am „–“ (je Datum geschütztes Leerzeichen bzw. `whitespace-nowrap` je Datum)
- **Priority:** Nice to have

#### BUG-3: „Heute“-Knopf der Zeitleiste am Handy fast am rechten Rand – BEHOBEN
- **Severity:** Low
- **Fix:** Mindestbreite des Zeitraum-Knopfs am Handy 9rem statt 11rem (ab `sm` wie bisher); E2E prüft den 16-px-Rand
- **Steps to Reproduce:** wie BUG-2; der Knopf endet ca. 6 px vor dem Rand statt mit 16 px Seitenabstand (die Seite scrollt nicht seitlich). Vermutlich Folge des längeren Zeitraum-Texts.
- **Priority:** Nice to have

#### BUG-4: Fehlermeldung Wohnungspreis noch im alten Betragsformat – BEHOBEN
- **Severity:** Low
- **Fix:** „Bitte einen Betrag bis € 10.000,00 eingeben, z. B. 125 oder 125,50.“ (`messages/de.json`, PROJ-6-Test angepasst)
- **Steps to Reproduce:** Wohnungsformular, Preis „12,345“ → „Bitte einen Betrag bis 10.000 € eingeben, z. B. 125 oder 125,50.“ Expected: „€ 10.000,00“ (Euro vorne, zwei Nachkommastellen wie überall)
- **Priority:** Nice to have

#### BUG-5: Handy-Karte trennt „2“ und „Personen“ – BEHOBEN
- **Severity:** Low
- **Fix:** Nächte und Personen in der Karte je `whitespace-nowrap` (`booking-list.tsx`); E2E prüft es
- **Steps to Reproduce:** Handy 375 px, Buchungsliste: „… · 6 Nächte · 2“ / „Personen“. Expected: Umbruch vor „2 Personen“ (geschütztes Leerzeichen)
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 28/28 passed (nach Behebung von BUG-1)
- **Bugs Found:** 5 total (0 critical, 0 high, 1 medium, 4 low) – alle behoben (2026-10-28)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy. Nachprüfung nach den Korrekturen: PROJ-31-E2E Handy und Desktop (betroffene Tests), PROJ-6 vollständig, Layout/axe von PROJ-8 und PROJ-9 grün; PROJ-4 30/31 (1× Supabase-Grenze); `npm test`: nur Zeitüberschreitungen der Dev-Datenbank (4 Tests, wechselnd). Vor dem Deploy `npm test` bei ruhiger Datenbank wiederholen.

## Deployment
_Stand 2026-10-28 (/deploy, Tag `v1.8.0`)_

- **Staging:** https://staging.apppa.at (Vercel `apppa-staging`, Supabase `iikzjqjjxoznrkkixfqa`), vom Nutzer anhand der Checkliste geprüft und freigegeben
- **Production:** https://app.apppa.at (Vercel `apppa`, Supabase `ahclrqbhfpidxjzbpfgb`), Commit `4d1b361`, 2026-10-28
- **Migrationen:** keine; kein `db push`, kein `config push`, keine neuen Umgebungsvariablen
- **Vor dem Release:** Lint und Build fehlerfrei; `npm test` 424/425, die eine Zeitüberschreitung (RLS-Test, Dev-Datenbank) bei Wiederholung grün (19/19); Secret-Scan ohne Fund
- Mit ausgeliefert: PROJ-8-Korrektur `abb94b7` (Tab-Erreichbarkeit in Safari, Ortstaxe-Hinweise am Preis entfernt)
