# PROJ-32: Negative Beträge bei Zusatzkosten

## Status: Planned
**Created:** 2026-10-28
**Last Updated:** 2026-10-28

## Dependencies
- Requires: PROJ-8 (Manuelle Buchungen) — Zusatzkosten-Positionen, Endbetrag, Rollenregeln für Preise
- Requires: PROJ-30 (Buchungs-Erweiterung) — abgerechneter Übernachtungspreis bei vorgezogener Abreise
- Requires: PROJ-31 (Einheitliche Datums- und Betragsformate) — Betragsformat und Umschreiben der Eingabefelder

## Überblick
Bisher sind Zusatzkosten nur mit Beträgen ab 0 möglich. Künftig darf eine Zusatzkosten-Position auch negativ sein, etwa für einen Rabatt, eine Gutschrift oder einen Nachlass. Der Endbetrag bleibt die Summe aus abgerechnetem Übernachtungspreis und allen Positionen und darf dadurch auch unter 0 fallen. Negative Beträge erscheinen als „-€ 50,00“ in roter Schrift. Zusätzlich gibt es zwei neue Vorschläge für Bezeichnungen: „Rabatt“ und „Nächtigungsabgabe“.

## User Stories
- Als **Inhaber** möchte ich einem Gast einen Rabatt als eigene Position mit negativem Betrag eintragen, damit Preis und Nachlass getrennt sichtbar bleiben.
- Als **Inhaber** möchte ich eine Gutschrift (z. B. für eine Störung während des Aufenthalts) als Position abziehen, damit der Endbetrag stimmt, ohne den Übernachtungspreis zu verändern.
- Als **Inhaber** möchte ich negative Beträge auf einen Blick erkennen (rot, mit Minus), damit ich Abzüge nicht mit Zuschlägen verwechsle.
- Als **Inhaber** möchte ich, dass der Endbetrag auch dann korrekt angezeigt wird, wenn die Abzüge höher sind als der Rest, damit z. B. eine Rückerstattung ersichtlich ist.
- Als **Inhaber** möchte ich „Rabatt“ und „Nächtigungsabgabe“ als Bezeichnung vorgeschlagen bekommen, damit ich sie nicht jedes Mal tippen muss.

## Out of Scope
- Negativer **Übernachtungspreis**: bleibt ab 0 (Abzüge laufen immer über Zusatzkosten)
- Negative **Stornogebühr**: bleibt ab 0
- Negative Preise in den **Wohnungsstammdaten** (Standardpreis, Personenpreise, Reinigungsgebühr): bleiben ab 0
- Prozentuale Rabatte (z. B. „10 % auf den Übernachtungspreis“) – nur feste Beträge
- Automatische Berechnung der Nächtigungsabgabe: kommt mit PROJ-15/PROJ-16; hier nur der Bezeichnungsvorschlag
- Warnung oder Rückfrage bei negativem Endbetrag
- Rote Schrift innerhalb der Eingabefelder (nur in Anzeigen)
- Zahlungen und offene Beträge bei negativem Endbetrag (PROJ-13)
- Sichtbarkeit für Mitarbeiter: unverändert, Mitarbeiter sehen keine Beträge (PROJ-8)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Eingabe
- [ ] Angenommen ein Inhaber im Buchungsformular, wenn er bei einer Zusatzkosten-Position „-50“ eingibt und das Feld verlässt, dann steht dort „-50,00“
- [ ] Angenommen ein Betragsfeld einer Zusatzkosten-Position, wenn „-1250,5“ bzw. „-1.250,50“ eingegeben und das Feld verlassen wird, dann steht dort „-1.250,50“
- [ ] Angenommen ein Betragsfeld einer Zusatzkosten-Position, wenn „-0“ oder „-0,00“ eingegeben und das Feld verlassen wird, dann steht dort „0,00“
- [ ] Angenommen ein Betragsfeld einer Zusatzkosten-Position, wenn ein Betrag unter -1.000.000,00 eingegeben wird, dann erscheint beim Speichern die bisherige Meldung für ungültige Beträge
- [ ] Angenommen ein Betragsfeld einer Zusatzkosten-Position mit „-“ allein oder „--5“, wenn gespeichert wird, dann erscheint die bisherige Meldung für ungültige Beträge und die Eingabe bleibt erhalten
- [ ] Angenommen das Feld „Übernachtungspreis“ oder „Stornogebühr“, wenn ein negativer Betrag eingegeben wird, dann erscheint beim Speichern eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen das Wohnungsformular, wenn bei Standardpreis, Personenpreis oder Reinigungsgebühr ein negativer Betrag eingegeben wird, dann erscheint wie bisher eine Fehlermeldung

### Speichern und Endbetrag
- [ ] Angenommen Übernachtungspreis € 300,00, Reinigung € 60,00 und Rabatt -€ 50,00, wenn gespeichert wird, dann ist der Endbetrag € 310,00
- [ ] Angenommen Übernachtungspreis € 100,00 und Gutschrift -€ 150,00, wenn gespeichert wird, dann wird ohne Warnung gespeichert und der Endbetrag ist -€ 50,00
- [ ] Angenommen eine Buchung mit negativer Position, wenn „Buchung bearbeiten“ geöffnet wird, dann steht im Betragsfeld der Position „-50,00“
- [ ] Angenommen eine Buchung mit vorgezogener Abreise (PROJ-30), wenn der Übernachtungspreis anteilig verringert wird, dann bleiben negative Positionen unverändert und der Endbetrag ist die Summe aus anteiligem Übernachtungspreis und allen Positionen
- [ ] Angenommen ein Mitarbeiter bearbeitet eine Buchung mit negativer Position, wenn er speichert, dann bleiben alle Positionen samt negativer Beträge unverändert

### Anzeige
- [ ] Angenommen eine Position mit -50 €, wenn das Buchungs-Detail angezeigt wird, dann steht dort „-€ 50,00“ in roter Schrift
- [ ] Angenommen ein negativer Endbetrag, wenn Buchungs-Detail, Buchungsliste (Desktop und Handy-Karte) oder die Summe im Formular ihn zeigen, dann steht er als „-€ 50,00“ in roter Schrift
- [ ] Angenommen positive Beträge und 0, wenn sie angezeigt werden, dann unverändert in normaler Schrift
- [ ] Angenommen ein negativer Betrag in roter Schrift, wenn er angezeigt wird, dann ist er auch ohne Farbe am Minus erkennbar und erfüllt den Mindestkontrast (WCAG AA) im hellen und dunklen Design

### Vorschläge
- [ ] Angenommen die Vorschläge für Zusatzkosten, wenn sie angezeigt werden, dann gibt es zusätzlich „Rabatt“ und „Nächtigungsabgabe“
- [ ] Angenommen der Inhaber wählt „Rabatt“ oder „Nächtigungsabgabe“, wenn die Position angelegt wird, dann ist der Betrag leer und muss eingetippt werden (das Minus beim Rabatt tippt der Nutzer selbst)

## Edge Cases
- **Nur Minus oder Minus an falscher Stelle** („-“, „5-“, „--5“, „- 5“): ungültig, bisherige Fehlermeldung; „- 5“ mit Leerzeichen nach dem Minus wird wie „-5“ behandelt
- **Typografisches Minus „−“** (z. B. aus kopiertem Text): wird wie „-“ behandelt
- **„-0,00“**: wird zu „0,00“, kein rotes „-€ 0,00“
- **Endbetrag genau 0**: normale Schrift, „€ 0,00“
- **Nur negative Positionen ohne Übernachtungspreis** (Übernachtungspreis leer/0): erlaubt, Endbetrag negativ
- **Bestehende Buchungen**: unverändert, keine Datenmigration nötig
- **Konflikt mit der Datenbankprüfung**: Die Datenbank lehnt negative Beträge außerhalb von Zusatzkosten weiterhin ab, auch wenn jemand die Prüfung im Browser umgeht
- **Sehr viele Positionen**: bisherige Grenze (20 Positionen) gilt unverändert; der Endbetrag kann höchstens so weit negativ werden, wie die Positionen zusammen ergeben

## Technical Requirements (optional)
- Prüfregel für Zusatzkosten in Browser und Datenbank: von „0 bis 1.000.000,00 €“ auf „-1.000.000,00 bis 1.000.000,00 €“
- Rote Schrift aus dem vorhandenen Design-Token (keine neue Farbe)
- Sicherheit: Rollenregeln aus PROJ-8 bleiben (nur Inhaber sehen und ändern Beträge)

## Open Questions
- [ ] Wie gehen Zahlungserfassung (PROJ-13) und Auswertungen (PROJ-18) mit negativem Endbetrag um (z. B. Rückerstattung statt offener Betrag)? Klärung in diesen Specs
- [ ] Soll eine von Hand erfasste Position „Nächtigungsabgabe“ später von der automatischen Berechnung (PROJ-16) ersetzt oder erkannt werden? Klärung in PROJ-16

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Negative Beträge nur bei Zusatzkosten, nicht beim Übernachtungspreis | Abzüge bleiben als eigene Position nachvollziehbar; der Übernachtungspreis bleibt die Grundlage für anteilige Abrechnung und Ortstaxe | 2026-10-28 |
| Endbetrag darf unter 0 fallen | Gutschriften/Rückerstattungen sollen abbildbar sein | 2026-10-28 |
| Keine Warnung bei negativem Endbetrag | Rote Schrift macht ihn ohnehin auffällig; zusätzliche Rückfrage wäre lästig | 2026-10-28 |
| Anzeige „-€ 50,00“ in Rot | Österreichische Standardschreibweise wie im übrigen Betragsformat, Farbe zur schnellen Erkennung | 2026-10-28 |
| Eingabe durch Tippen eines Minus | Kein zusätzliches Bedienelement, passt zum bisherigen Betragsfeld | 2026-10-28 |
| Rot nur in Anzeigen, nicht im Eingabefeld | Eingabefelder bleiben einheitlich; das Minus ist dort sichtbar | 2026-10-28 |
| Neue Vorschläge „Rabatt“ und „Nächtigungsabgabe“ | Häufige Positionen; Nächtigungsabgabe wird bis PROJ-16 von Hand eingetragen | 2026-10-28 |
| Grenze -1.000.000,00 € | Spiegelt die bisherige Obergrenze | 2026-10-28 |

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
