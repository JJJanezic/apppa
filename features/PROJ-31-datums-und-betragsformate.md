# PROJ-31: Einheitliche Datums- und Betragsformate

## Status: Planned
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
