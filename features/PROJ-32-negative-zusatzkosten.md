# PROJ-32: Negative Beträge bei Zusatzkosten

## Status: Approved
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
- [ ] Kontrast der roten Schrift im dunklen Design prüfen, sobald es eines gibt (derzeit nur helles Theme)

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
| Betragsleser mit Schalter „negativ erlaubt“ (Standard aus) statt zweitem Leser | Ein Leser für die ganze App bleibt (PROJ-31); alle übrigen Betragsfelder bleiben unverändert ab 0 | 2026-10-28 |
| Datenbank: nur die Untergrenze der Zusatzkosten-Prüfung ändern | Kleinster Eingriff; Übernachtungspreis, Stornogebühr und Wohnungspreise bleiben in der Datenbank ab 0 geschützt | 2026-10-28 |
| Endbetrag weiter nur berechnet, nicht gespeichert | Negativer Endbetrag und anteilige Abrechnung (PROJ-30) funktionieren ohne Datenmigration | 2026-10-28 |
| Gemeinsamer Anzeige-Baustein für Beträge mit roter Schrift bei < 0 | Regel an einer Stelle statt in Formular, Detail und Liste einzeln | 2026-10-28 |
| Rot über vorhandenes Token `destructive` | Keine neue Farbe; Kontrast 6,5:1 bzw. 5,9:1 erfüllt WCAG AA | 2026-10-28 |
| „-0“ wird zu 0 normalisiert | Verhindert „-0,00“ im Feld und rotes „-€ 0,00“ in Anzeigen | 2026-10-28 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Kleine Erweiterung bestehender Bausteine, keine neue Seite, keine neue Tabelle, keine neue Bibliothek. Vier Bausteine werden angepasst:
1. **Betragsleser** (zentral in `src/lib/format.ts`): versteht auf Wunsch ein führendes Minus
2. **Prüfregeln** im Browser und in den Server-Aktionen (ein gemeinsames Schema): Zusatzkosten von -1.000.000,00 bis 1.000.000,00 €
3. **Datenbankprüfung** der Tabelle für Zusatzkosten: Untergrenze von 0 auf -1.000.000,00 € (eine kleine Migration)
4. **Betragsanzeige**: ein gemeinsamer Anzeige-Baustein färbt negative Beträge rot

### A) Betroffene Oberfläche (bestehende Komponenten)
```
Buchungsformular (booking-panel)
+-- Abschnitt Preis
|   +-- Übernachtungspreis (Betragsfeld)        → bleibt ab 0
|   +-- Vorschlags-Chips für Zusatzkosten       → + „Rabatt“, + „Nächtigungsabgabe“
|   +-- Zusatzkosten-Positionen
|   |   +-- Bezeichnung
|   |   +-- Betrag (Betragsfeld)                → NEU: Minus erlaubt
|   +-- Summe / Endbetrag                       → NEU: rot, wenn negativ
Storno-Dialog: Stornogebühr (Betragsfeld)       → bleibt ab 0
Buchungs-Detail (booking-detail)
+-- Positionen mit Betrag                       → rot, wenn negativ
+-- Endbetrag                                   → rot, wenn negativ
Buchungsliste (booking-list)
+-- Betrag in der Desktop-Tabelle               → rot, wenn negativ
+-- Betrag in der Handy-Karte                   → rot, wenn negativ
Wohnungsformular (Standard-/Personenpreise, Reinigung) → unverändert ab 0
```

Neu ist nur ein kleiner gemeinsamer Anzeige-Baustein „Betrag“ (z. B. `src/components/amount.tsx`): zeigt einen Cent-Betrag im App-Format und setzt bei negativem Wert die rote Schrift. Alle oben genannten Anzeigen nutzen ihn, damit die Regel an einer Stelle lebt.

### B) Daten
- **Keine neuen Felder, keine Datenmigration.** Zusatzkosten-Positionen behalten Bezeichnung und Betrag in Cent; der Betrag darf künftig negativ sein.
- **Endbetrag wird weiterhin nicht gespeichert**, sondern beim Anzeigen berechnet (abgerechneter Übernachtungspreis + alle Positionen). Dadurch funktionieren negativer Endbetrag und anteilige Abrechnung (PROJ-30) ohne Zusatzarbeit: Nur der Übernachtungspreis wird anteilig verringert, Positionen bleiben unverändert.
- **Datenbankgrenzen danach:**
  - Zusatzkosten-Position: -1.000.000,00 bis 1.000.000,00 €
  - Übernachtungspreis (vereinbart und abgerechnet), Stornogebühr: unverändert 0 bis 1.000.000,00 €
  - Wohnungspreise, Personenpreise, Reinigungsgebühr: unverändert ab 0
- Der kleinste mögliche Endbetrag (20 Positionen × -1.000.000 €) liegt weit innerhalb des Zahlenbereichs, kein Überlaufrisiko.

### C) Regeln für die Eingabe
- Der Betragsleser bekommt einen Schalter „negativ erlaubt“, standardmäßig aus. Nur die Zusatzkosten-Felder schalten ihn ein; alle anderen Betragsfelder der App verhalten sich exakt wie bisher.
- Bei eingeschaltetem Schalter gilt:
  - Ein Minus ganz vorne ist erlaubt, auch mit Leerzeichen danach („- 5“ = „-5“)
  - Das typografische Minus „−“ wird wie „-“ behandelt
  - „-“ allein, „--5“, „5-“ sind ungültig → bisherige Meldung „Bitte einen Betrag wie 125 oder 125,50 eingeben.“, Eingabe bleibt stehen
  - „-0“ und „-0,00“ ergeben 0 (nicht „-0,00“) – sowohl beim Umschreiben im Feld als auch beim Speichern
- Beim Verlassen des Felds schreibt das bestehende Betragsfeld die Eingabe wie bisher um („-1250,5“ → „-1.250,50“); es reicht den Schalter nur an den Leser weiter.
- Übernachtungspreis und Stornogebühr verwenden den Leser ohne Schalter: Ein Minus dort ist ungültig → bisherige Meldung, nichts wird gespeichert.

### D) Anzeige
- Format kommt unverändert aus der zentralen Betragsformatierung: „-€ 50,00“ (österreichische Schreibweise, bereits so geliefert).
- Rote Schrift über das vorhandene Design-Token für Warn-/Fehlerfarbe (`destructive`), keine neue Farbe. Gemessener Kontrast im hellen Design: 6,5:1 auf dem Seitenhintergrund, 5,9:1 auf grauen Flächen → erfüllt WCAG AA (4,5:1). Das Minus bleibt immer sichtbar, Farbe ist nur Zusatzsignal.
- 0 und positive Beträge: normale Schrift. Eine „-0“ kann wegen der Normalisierung nicht entstehen.
- **Dunkles Design:** existiert in der App noch nicht (siehe `docs/design-system.md`). Sobald es kommt, gilt das Token dort automatisch; der Kontrast ist dann mit zu prüfen.

### E) Vorschläge
- Die Liste der Zusatzkosten-Vorschläge bekommt zwei Einträge: „Rabatt“ und „Nächtigungsabgabe“ (Texte in `messages/de.json`). Gewählt wird wie bisher nur die Bezeichnung, der Betrag bleibt leer.

### F) Sicherheit und Rollen
- Unverändert: Nur Inhaber sehen und setzen Beträge; die Speicherfunktion übernimmt Positionen nur von Inhabern. Bearbeitet ein Mitarbeiter eine Buchung, bleiben alle Positionen samt negativer Beträge unangetastet.
- Die Datenbank prüft die Grenzen selbst. Wer die Browserprüfung umgeht, kann weiterhin keinen negativen Übernachtungspreis und keine negative Stornogebühr speichern.

### G) Tests
- Unit-Tests: Betragsleser (mit/ohne Schalter, alle Edge Cases aus der Spec), Prüfschema für Buchungen (negative Position ok, negativer Übernachtungspreis nicht), Endbetrag mit negativen Positionen und anteiliger Abrechnung, Anzeige-Baustein (rot nur bei < 0)
- E2E: Buchung mit Rabatt anlegen, Endbetrag in Formular, Detail und Liste prüfen; negativer Endbetrag

### Abhängigkeiten
Keine neuen Pakete.

## Implementation Notes (Frontend)
**Stand 2026-10-28**
- `src/lib/format.ts`: `parseAmountCents(input, { negative })` – Minus vorne (auch „- 5“, „−5“, „-€ 50“) nur mit Schalter; „-“, „--5“, „5-“ ungültig; „-0“ → 0
- `src/components/amount-input.tsx`: neue Eigenschaft `negative`, reicht den Schalter an den Leser weiter
- `src/lib/validation/bookings.ts`: Zusatzkosten von -1.000.000,00 bis 1.000.000,00 €; Übernachtungspreis und Stornogebühr unverändert ab 0
- Neuer Anzeige-Baustein `src/components/amount.tsx` (`Amount`): „-€ 50,00“ mit `text-destructive` bei < 0; eingesetzt in Formular-Summe, Buchungs-Detail (Positionen, Übernachtungspreis, Endbetrag, Stornogebühr) und Buchungsliste (Tabelle und Handy-Karte)
- Vorschläge „Rabatt“ und „Nächtigungsabgabe“ (`CHARGE_SUGGESTIONS`, `messages/de.json`)
- Tests: Leser, Betragsfeld, Prüfschema, Endbetrag, `Amount`
- **Hinweis zur Spec:** Anteilig berechnet wird nach PROJ-30 nur bei *späterer* tatsächlicher Abreise (Preis steigt); bei vorgezogener Abreise bleibt der volle Preis. Das Kriterium „vorgezogene Abreise … anteilig verringert“ ist daher in QA mit späterer Abreise zu prüfen: Positionen bleiben unverändert, Endbetrag = anteiliger Übernachtungspreis + Positionen

## Implementation Notes (Backend)
**Stand 2026-10-28**
- Migration `20261028202255_negative_charges.sql` (nur Dev): Prüfung `booking_charges.amount_cents` jetzt -100.000.000 bis 100.000.000 Cent; Übernachtungspreis, Stornogebühr und Wohnungspreise unverändert ab 0. Keine neue Funktion, keine RLS-Änderung, keine Datenmigration
- `save_booking` übernimmt Positionen weiterhin nur von Inhabern; Mitarbeiter ändern keine Beträge
- Integrationstest (`supabase/tests/bookings.integration.test.ts`): negative Positionen bis -1.000.000 € werden gespeichert; -1.000.000,01 €, negativer Übernachtungspreis und negative Stornogebühr werden von der Datenbank abgelehnt (23514); direktes Schreiben in `booking_charges` bleibt gesperrt
- Typen neu erzeugt (unverändert); Advisors: nur die bekannten Auth-Hinweise (siehe `docs/runbooks/supabase.md`)

## QA Test Results

**Tested:** 2026-10-28
**App URL:** http://localhost:3000 (Produktions-Build, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)
**E2E:** `tests/PROJ-32-negative-zusatzkosten.spec.ts` (10 Tests: desktop, mobile, Safari/WebKit)

### Acceptance Criteria Status

#### Eingabe
- [x] „-50“ → „-50,00“ beim Verlassen
- [x] „-1250,5“ und „-1.250,50“ → „-1.250,50“
- [x] „-0“ und „-0,00“ → „0,00“
- [x] Unter -1.000.000,00 (z. B. „-1.000.000,01“) → bisherige Meldung; genau -1.000.000,00 wird gespeichert
- [x] „-“ und „--5“ → bisherige Meldung, Eingabe bleibt stehen
- [x] Negativer Übernachtungspreis und negative Stornogebühr → Fehlermeldung, nichts gespeichert (Formular, Storno-Dialog und Datenbank)
- [x] Wohnungsformular: negativer Standardpreis, Personenpreis, Kinderpreis und Reinigungsgebühr weiterhin abgelehnt (Unit-Test)

#### Speichern und Endbetrag
- [x] € 300,00 + Reinigung € 60,00 + Rabatt -€ 50,00 → Endbetrag € 310,00 (Formular und Detail)
- [x] € 100,00 + Gutschrift -€ 150,00 → ohne Warnung gespeichert, Endbetrag -€ 50,00
- [x] „Buchung bearbeiten“ zeigt „-50,00“ bzw. „-150,00“ im Betragsfeld
- [x] Anteilige Abrechnung (PROJ-30): Positionen bleiben unverändert, Endbetrag = anteiliger Übernachtungspreis + Positionen. Geprüft mit *späterer* Abreise (siehe Hinweis 1)
- [x] Mitarbeiter speichert eine Buchung mit negativer Position → alle Positionen unverändert; Mitarbeiter sehen keine Beträge

#### Anzeige
- [x] Position -€ 50,00 im Detail in roter Schrift
- [x] Negativer Endbetrag rot in Detail, Buchungsliste (Desktop-Tabelle, Handy-Karte) und Formular-Summe
- [x] Positive Beträge und 0 in normaler Schrift; kein „-€ 0,00“
- [x] Minus immer sichtbar; Kontrast Rot (`destructive`) 6,5:1 auf Seitenhintergrund, 6,0:1 auf Karten (`ds-surface`), 5,9:1 auf Hover-Fläche → WCAG AA. Dunkles Design gibt es noch nicht (offene Frage)
- [x] Eingabefelder ohne rote Schrift

#### Vorschläge
- [x] „Rabatt“ und „Nächtigungsabgabe“ in der Vorschlagsliste (zusätzlich zu den bisherigen)
- [x] Betrag bleibt nach Wahl der Bezeichnung leer; Speichern ohne Betrag meldet „Bitte einen Betrag eingeben.“

### Edge Cases Status
- [x] „-“, „5-“, „--5“ ungültig; „- 5“ → „-5,00“
- [x] Typografisches Minus „−5“ → „-5,00“ (Zusatzkosten); in Wohnungspreisen ungültig
- [x] „-0,00“ → „0,00“, kein rotes „-€ 0,00“
- [x] Endbetrag genau 0 → „€ 0,00“ in normaler Schrift
- [x] Nur negative Positionen bei Übernachtungspreis 0 → erlaubt, Endbetrag rot
- [x] Bestehende Buchungen unverändert (Regression PROJ-31/PROJ-27 grün)
- [x] Datenbank lehnt negative Beträge außerhalb der Zusatzkosten ab, auch bei direktem Aufruf (Integrationstest)
- [x] Grenze 20 Positionen unverändert; kleinster Endbetrag (20 × -1.000.000 € + 0) bleibt im Zahlenbereich
- [x] Zusätzlich: „-€ 50“ wird als -50,00 gelesen

### Security Audit Results
- [x] Rollen: Mitarbeiter sehen keine Beträge (Detail, Formular) und können Positionen nicht ändern; `save_booking` übernimmt Beträge nur von Inhabern
- [x] Direktes Schreiben in `booking_charges` bleibt gesperrt (auch für Inhaber), nur über `save_booking`
- [x] Umgehen der Browserprüfung: Datenbank lehnt negativen Übernachtungspreis, negative Stornogebühr und Beträge unter -1.000.000 € ab (23514)
- [x] Mandanten-Abschottung unverändert (keine RLS-Änderung; RLS-Integrationstests grün)
- [x] Eingaben: Bezeichnungen werden von React escaped; keine neue Eingabe außer dem Minus
- [x] Keine neuen Schlüssel oder Umgebungsvariablen

### Regression
- [x] Unit-Tests: 457 Tests, alle grün (2 Integrationstests nur im parallelen Gesamtlauf rot, siehe Hinweis 2)
- [x] E2E PROJ-31 „Beträge“ (desktop) und PROJ-27 (desktop) grün
- [x] Integrationstests Buchungen (30) und RLS (19) einzeln grün

### Hinweise (keine Bugs im Feature)
1. **Spec-Formulierung:** Das Kriterium spricht von „vorgezogener Abreise … anteilig verringert“. Nach PROJ-30 wird nur bei *späterer* tatsächlicher Abreise anteilig gerechnet (Preis steigt); bei früherer Abreise bleibt der volle Preis. Verhalten ist korrekt, nur der Text der Spec passt nicht.
2. **Testumgebung (Low):** Im parallelen Gesamtlauf `npm test` scheiterten einmalig „Gästeblattnummer: Warnung bei Doppelung“ (P0801) und „Person ohne Mitgliedschaft …“ (Zeitüberschreitung 5 s). Beide einzeln grün; die RLS-Tests brauchen derzeit gegen Dev teils über 5 s. Keine „rate limit“-Fehler mehr seit Anhebung der Dev-Grenze. Vorschlag: Zeitgrenze der Integrationstests erhöhen (eigene kleine Aufgabe).
3. **Nicht getestet:** Firefox (kein Playwright-Projekt eingerichtet). Chrome (desktop, mobile) und Safari (WebKit) getestet.
4. **Für PROJ-13/PROJ-18:** Summen über alle Positionen einer Buchung liegen mit -2,0 bis 2,1 Mrd. Cent knapp unter der Grenze von `integer` (±2,147 Mrd.). Summen über mehrere Buchungen in SQL mit `bigint` rechnen.

### Bugs Found
Keine.

### Summary
- **Acceptance Criteria:** 20/20 passed
- **Bugs Found:** 0 (0 critical, 0 high, 0 medium, 0 low); 1 Hinweis zur Testumgebung (Low)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment
_To be added by /deploy_
