# PROJ-27: Personenpreise und Kapazität nach Erwachsenen

## Status: In Progress
**Created:** 2026-10-25
**Last Updated:** 2026-10-25

## Dependencies
- Requires: PROJ-6 (Wohnungsverwaltung): Personenzahl, Standardpreis, Reinigungsgebühr je Wohnung
- Requires: PROJ-8 (Manuelle Buchungen): Erwachsene und Kinderalter je Buchung, Preisvorschlag, Kapazitätswarnung, „Preis prüfen“
- Wird genutzt von: PROJ-11 (Import übernimmt den Plattformpreis, keine Personenpreise), PROJ-18 (Umsatz)

## Überblick
Bisher hat eine Wohnung eine Personenzahl und einen Preis pro Nacht für die ganze Wohnung. Künftig gilt:
- **Kapazität:** höchstens n Personen, davon höchstens m Erwachsene. Kinder dürfen auch Erwachsenenplätze belegen.
- **Preisart je Wohnung:**
  - entweder **Wohnungspreis** pro Nacht (wie bisher, z. B. Dienstwohnungen)
  - oder **Personenpreise** pro Nacht: ein Erwachsenenpreis und bis zu drei Altersstufen für Kinder.
- **Reinigungsgebühr:** wie bisher einmal je Buchung (Position „Reinigung“).

Der Preisvorschlag der Buchung rechnet je nach Preisart. Die Kapazitätswarnung prüft zusätzlich die Erwachsenen.

**Wichtig: Die Wohnung ist nur die Preis-Konfiguration.** Aus ihr ergibt sich ein *rechnerischer* Übernachtungspreis als Vorschlag. Der *tatsächlich vereinbarte* Preis einer Buchung kann davon abweichen.
- Der Inhaber ändert den Übernachtungspreis frei.
- Er erfasst beliebige Gebühren als Positionen: Reinigung, Haustier, Frühstück, Parkplatz oder eine freie Bezeichnung.
- Endbetrag = vereinbarter Übernachtungspreis + Positionen, wie in PROJ-8.
- Gespeichert wird immer der vereinbarte Betrag, nie der rechnerische.

## User Stories
- Als **Inhaber** möchte ich je Wohnung festlegen, wie viele Personen und davon wie viele Erwachsene sie aufnimmt, damit eine Buchung mit zu vielen Erwachsenen auffällt, auch wenn die Gesamtzahl passt.
- Als **Inhaber** möchte ich für eine Ferienwohnung Preise pro Person und Nacht hinterlegen, getrennt für Erwachsene und Kinder nach Alter, damit der Preisvorschlag zur Belegung passt.
- Als **Inhaber** möchte ich für eine Dienstwohnung weiterhin einen Wohnungspreis pro Nacht verwenden.
- Als **Mitarbeiter** möchte ich, dass meine Buchungen den richtigen Preisvorschlag nach Personen erhalten, ohne dass ich Preise sehe.
- Als **Inhaber** möchte ich erfahren, wenn ein Mitarbeiter die Personen einer Buchung mit Personenpreisen ändert, damit ich den Preis prüfe.

## Umfang

### Wohnung (Ergänzung PROJ-6)
| Angabe | Pflicht | Hinweise |
|---|---|---|
| Personen (gesamt) | ja | wie bisher, 1–50 |
| davon höchstens Erwachsene | nein | 1 bis Personen gesamt; leer = keine eigene Grenze |
| Preisart | ja | „Wohnungspreis“ (Vorgabe, auch für alle bestehenden Wohnungen) oder „Personenpreise“ |
| Wohnungspreis pro Nacht | nein | nur bei Preisart „Wohnungspreis“; wie bisher |
| Erwachsenenpreis pro Nacht | ja bei Personenpreisen | Euro mit Cent |
| Kinderstufen | nein | bis zu 3 Stufen „bis einschließlich Alter X: Preis pro Nacht“, aufsteigend, Alter 0–17; Preis € 0 erlaubt (gratis). Kinder älter als die letzte Stufe zahlen den Erwachsenenpreis |
| Reinigungsgebühr | nein | unverändert, einmal je Buchung |

**Beispiel:**
- Einstellungen: Erwachsene € 50, Stufen „bis 2 Jahre: € 0“ und „bis 11 Jahre: € 20“.
- Buchung: 2 Erwachsene, Kinder mit 1, 8 und 14 Jahren, 3 Nächte.
- Rechnung: 3 × (2 × 50 + 0 + 20 + 50) = **€ 510**, dazu Reinigung.

Beim Wechsel der Preisart bleiben die Werte der anderen Preisart gespeichert, gelten aber nicht.

### Buchung (Ergänzung PROJ-8)
- **Vereinbarter Preis (unverändert aus PROJ-8):**
  - Übernachtungspreis, frei änderbar.
  - Dazu beliebig viele Gebühren-Positionen. Die Reinigungsgebühr der Wohnung wird als Position „Reinigung“ vorbelegt und ist änderbar oder entfernbar.
  - Endbetrag = Übernachtungspreis + Positionen.
- **Preisvorschlag:**
  - bei Wohnungspreis: Wohnungspreis × Nächte (wie bisher)
  - bei Personenpreisen: Nächte × Summe der Personenpreise
  - Maßgeblich ist das Alter bei Anreise (wird schon je Kind erfasst).
  - Das Formular zeigt die Rechnung, z. B. „3 Nächte × (2 × € 50 + 1 × € 20 + …)“.
- **Neuer Vorschlag:** Bei Personenpreisen ändert sich der Vorschlag auch, wenn sich Erwachsene, Kinder oder Alter ändern. Wie bisher übernimmt die App ihn nur, solange der Inhaber den Preis nicht von Hand geändert hat; sonst bietet sie ihn an.
- **Mitarbeiter:** Ihre Buchungen erhalten den Vorschlag nach derselben Rechnung. Ändert ein Mitarbeiter bei einer Wohnung mit Personenpreisen Erwachsene, Kinder oder Alter, setzt die App „Preis prüfen“ (wie bei Zeitraum und Wohnung).
- **Kapazitätswarnung:**
  - Sie erscheint, wenn die Personen die Gesamtzahl **oder** die Erwachsenen die Erwachsenen-Grenze übersteigen.
  - Die Regeln bleiben wie bei Überschneidungen: Mitarbeiter sind blockiert, Inhaber bestätigen „Trotzdem speichern“.
  - Kinder zählen nie als Erwachsene, auch wenn sie den Erwachsenenpreis zahlen.
- **Bestehende Buchungen:** Ihre Beträge bleiben unverändert.

### Hinweise in der Wohnungsverwaltung
Senkt der Inhaber die Personen- oder die Erwachsenenzahl, nennt die App die Zahl künftiger aktiver Buchungen und Optionen, die darüber liegen (wie bisher bei der Personenzahl).

### Rollen
Unverändert. Preise und Preisart pflegt nur der Inhaber; Mitarbeiter sehen Kapazitäten, aber keine Preise.

## Out of Scope
- Saison- und Wochentagspreise, Mindestaufenthalt, Rabatte nach Dauer (PROJ-8: nicht geplant)
- Mindestpreis je Nacht bei wenigen Personen
- Preise je Person ohne Nächte (z. B. Endreinigung je Person)
- Automatisches Neuberechnen bestehender Buchungen
- Ortstaxe: unabhängig vom Preis (PROJ-15/16)

## Acceptance Criteria

### Wohnung
- [ ] Angenommen der Inhaber bearbeitet eine Wohnung, wenn er „davon höchstens Erwachsene“ größer als die Personenzahl oder kleiner als 1 einträgt, dann erscheint eine Meldung am Feld
- [ ] Angenommen eine bestehende Wohnung, wenn der Inhaber sie öffnet, dann ist die Preisart „Wohnungspreis“ mit dem bisherigen Preis gewählt und die Erwachsenen-Grenze leer
- [ ] Angenommen der Inhaber wählt „Personenpreise“, wenn er ohne Erwachsenenpreis speichert, dann erscheint „Bitte den Erwachsenenpreis eingeben“
- [ ] Angenommen der Inhaber legt Kinderstufen an, wenn die Altersgrenzen nicht aufsteigend sind, doppelt vorkommen oder außerhalb 0–17 liegen, dann erscheint eine Meldung; mehr als drei Stufen sind nicht möglich
- [ ] Angenommen der Inhaber speichert gültige Personenpreise, wenn er die Wohnung erneut öffnet, dann sind Preisart, Erwachsenenpreis und Stufen wie gespeichert sichtbar
- [ ] Angenommen der Inhaber senkt die Erwachsenen-Grenze, wenn künftige Buchungen mehr Erwachsene haben, dann zeigt die App vor dem Speichern deren Anzahl als Hinweis
- [ ] Angenommen der Nutzer ist Mitarbeiter, wenn er Wohnungen ansieht, dann sieht er keine Preise. (Umsetzung: „Einstellungen → Wohnungen“ ist wie bisher nur für Inhaber; im Buchungsformular sehen Mitarbeiter keine Preise. Die Kapazität erfahren sie über die Warnung.)

### Buchung
- [ ] Angenommen eine Wohnung mit Personenpreisen (Erwachsene € 50; bis 2 Jahre € 0; bis 11 Jahre € 20), wenn der Inhaber 3 Nächte mit 2 Erwachsenen und Kindern von 1, 8 und 14 Jahren erfasst, dann schlägt die App € 510 als Übernachtungspreis vor und zeigt die Rechnung
- [ ] Angenommen der Preis ist noch nicht von Hand geändert, wenn der Inhaber Erwachsene, Kinder oder ein Alter ändert, dann passt die App den Vorschlag an; nach einer Handänderung bietet sie ihn nur an
- [ ] Angenommen eine Wohnung mit Wohnungspreis, wenn der Inhaber eine Buchung erfasst, dann rechnet der Vorschlag wie bisher Wohnungspreis × Nächte, unabhängig von den Personen
- [ ] Angenommen ein Mitarbeiter legt eine Buchung in einer Wohnung mit Personenpreisen an, wenn er speichert, dann erhält sie den Vorschlag nach Personenpreisen plus Reinigungsgebühr
- [ ] Angenommen ein Mitarbeiter ändert Erwachsene, Kinder oder Alter einer Buchung mit Personenpreisen, wenn er speichert, dann bleibt der Preis unverändert und der Inhaber sieht „Preis prüfen“
- [ ] Angenommen eine Wohnung für 4 Personen, davon höchstens 2 Erwachsene, wenn eine Buchung 3 Erwachsene hat, dann warnt die App „3 Erwachsene, die Wohnung ist für höchstens 2 Erwachsene ausgelegt“ (Mitarbeiter blockiert, Inhaber bestätigt)
- [ ] Angenommen dieselbe Wohnung, wenn eine Buchung 1 Erwachsenen und 3 Kinder hat, dann gibt es keine Kapazitätswarnung
- [ ] Angenommen die Reinigungsgebühr ist gesetzt, wenn eine Buchung mit Personenpreisen angelegt wird, dann erscheint sie genau einmal als Position „Reinigung“, unabhängig von Nächten und Personen
- [ ] Angenommen der Vorschlag lautet € 510, wenn der Inhaber den Übernachtungspreis auf € 450 ändert, die Reinigung auf € 70 setzt und eine Position „Haustier € 15“ ergänzt, dann speichert die Buchung € 450 + € 70 + € 15 = € 535 als Endbetrag; die Abweichung vom Vorschlag ist erlaubt und wird nicht gewarnt
- [ ] Angenommen eine bestehende Buchung, wenn der Inhaber danach die Preise der Wohnung ändert, dann bleiben ihre Beträge unverändert

## Edge Cases
- **Wohnung ohne Erwachsenen-Grenze:** Es zählt nur die Gesamtzahl (wie bisher).
- **Kinderstufen fehlen:** Alle Kinder zahlen den Erwachsenenpreis.
- **Kind älter als die letzte Stufe** (z. B. 14 bei Stufen bis 11): zahlt den Erwachsenenpreis, zählt für die Kapazität aber als Kind.
- **Preisart wechselt, während eine Buchung offen ist:** Der Vorschlag nutzt den Stand beim Öffnen des Formulars; die Datenbank berechnet Mitarbeiter-Vorschläge beim Speichern.
- **Wohnungspreis leer bei Preisart „Wohnungspreis“:** wie bisher kein Vorschlag, Preis ist für Inhaber Pflicht. Mitarbeiter-Buchungen erhalten € 0 und „Preis prüfen“.
- **Wechsel der Wohnung in einer Buchung:** Der Vorschlag richtet sich nach der neuen Wohnung.
- **Importierte Plattformbuchungen (PROJ-11):** behalten den Plattformpreis.

## Technical Requirements
- Preisregeln und Kapazitätsprüfung serverseitig (Datenbank) wie in PROJ-8; App und Datenbank rechnen den Vorschlag identisch (Tests vergleichen beides)
- Beträge in Cent, keine Rundungsfehler
- Preise je Wohnung für Mitarbeiter in der Oberfläche unsichtbar (technisch lesbar wie bisher der Standardpreis, Entscheidung PROJ-8)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kapazität als „Personen gesamt, davon höchstens Erwachsene“ | Vom Nutzer gewählt; Kinder dürfen Erwachsenenplätze belegen (z. B. 1 Erwachsener + 3 Kinder) | 2026-10-25 |
| Preisart je Wohnung: Wohnungspreis oder Personenpreise | Vom Nutzer gewählt; Dienstwohnungen bleiben beim Wohnungspreis, bestehende Wohnungen brauchen keine Umstellung | 2026-10-25 |
| Kinderpreise in bis zu drei Altersstufen, Alter bei Anreise | Vom Nutzer gewählt; üblich sind z. B. 0–2 gratis, 3–11 ermäßigt | 2026-10-25 |
| Ältere Kinder ohne Stufe zahlen den Erwachsenenpreis, zählen aber als Kind | Preis und Kapazität sind getrennte Fragen; die Kapazität „Erwachsene“ bezieht sich auf die erfassten Erwachsenen | 2026-10-25 |
| Reinigungsgebühr bleibt eine Pauschale je Buchung | Vom Nutzer bestätigt; so bereits in PROJ-8 umgesetzt | 2026-10-25 |
| Wohnungspreise sind nur Konfiguration für einen rechnerischen Vorschlag; der vereinbarte Preis je Buchung ist frei und enthält beliebige Gebühren-Positionen | Vom Nutzer so festgelegt; Sonderpreise und Absprachen sind üblich | 2026-10-25 |
| „Preis prüfen“ auch bei Personenänderungen durch Mitarbeiter (nur bei Personenpreisen) | Bei Personenpreisen hängt der Preis von der Belegung ab; Mitarbeiter sehen keine Preise | 2026-10-25 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Seiten und Bausteine
```
Einstellungen → Wohnungen → Wohnung bearbeiten (PROJ-6, Detail-Panel)
+-- Abschnitt „Belegung“: Personen (gesamt) · davon höchstens Erwachsene (optional)
+-- Abschnitt „Preis“ (nur Inhaber)
|   +-- Preisart: Wohnungspreis | Personenpreise (Radio)
|   +-- Wohnungspreis: Preis pro Nacht (wie bisher)
|   +-- Personenpreise: Erwachsener pro Nacht · Kinderstufen (bis 3 Zeilen: „bis Alter“ + Preis, „Stufe hinzufügen“)
|   +-- Reinigungsgebühr (wie bisher)
+-- Hinweis bei Senken von Personen oder Erwachsenen (künftige Buchungen)

Buchung anlegen/bearbeiten (PROJ-8, Detail-Panel)
+-- Preisvorschlag mit Rechnung je Preisart; Vorschlag folgt auch Erwachsenen, Kindern und Alter
+-- Kapazitätswarnung nennt Personen bzw. Erwachsene

Wohnungsübersicht (PROJ-6): Kapazität „4 Personen, davon max. 2 Erwachsene“; Preis „€ 50 / Erw.“ bzw. „€ 120 / Nacht“ (nur Inhaber)
```

### B) Datenmodell (in Worten)
**Wohnungen**, neue Felder:
- „Höchstens Erwachsene“: optional; mindestens 1 und höchstens die Personenzahl
- Preisart: „Wohnung“ oder „Personen“; Vorgabe „Wohnung“, für alle bestehenden Wohnungen gesetzt
- Erwachsenenpreis pro Nacht in Cent; Pflicht bei Preisart „Personen“
- Kinderstufen als kleine Liste an der Wohnung: je Stufe „bis Alter“ und Preis in Cent
  - höchstens 3 Stufen, Alter aufsteigend und eindeutig, 0–17, Preise ab 0
  - Die Datenbank prüft die Regeln.
  - Eine eigene Tabelle ist nicht nötig: Die Stufen gehören fest zur Wohnung und werden mit ihr gespeichert und protokolliert.
- Der bisherige „Standardpreis“ bleibt der Wohnungspreis.

**Buchungen:** keine neuen Felder.
- Gespeichert wird wie bisher der vereinbarte Übernachtungspreis und die Gebühren-Positionen (PROJ-8).
- Der rechnerische Vorschlag und seine Rechnung werden nicht gespeichert.

### C) Berechnung
- **Vorschlag:**
  - Preisart „Wohnung“: Wohnungspreis × Nächte.
  - Preisart „Personen“: Nächte × (Erwachsene × Erwachsenenpreis + je Kind der Preis der ersten Stufe, deren „bis Alter“ ≥ Alter ist, sonst der Erwachsenenpreis).
- **Eine gemeinsame Regel an zwei Orten:**
  - Im Formular für den Inhaber und für die Anzeige der Rechnung.
  - In der Datenbank für Mitarbeiter-Buchungen, die keine Preise sehen.
  - Beide werden mit denselben Beispielen getestet.
- **Kapazität:** Die Prüfung in der Datenbank bekommt zusätzlich die Zahl der Erwachsenen. Überbelegung liegt vor bei Personen > Gesamt oder Erwachsene > Grenze. Die Warnung nennt, welche Grenze überschritten ist.
- **„Preis prüfen“:** Wie bisher bei Mitarbeiter-Änderungen von Zeitraum und Wohnung, zusätzlich bei Änderung von Erwachsenen oder Kinderaltern in Wohnungen mit Personenpreisen.

### D) Rechte und Sicherheit
- Keine neuen Tabellen, **keine Änderung an Zugriffsregeln (RLS)**.
- Für die neuen Spalten der Wohnung gelten dieselben Spaltenrechte wie für Standardpreis und Reinigungsgebühr; schreiben dürfen laut bestehender Regel nur Inhaber.
- Die Speicherfunktion der Buchung und die Kapazitätsprüfung werden erweitert. Sie prüfen die Rolle wie bisher selbst.

### E) Tests
- **Unit:**
  - Vorschlag je Preisart, Stufenwahl (Grenzen, Kind älter als letzte Stufe, gratis-Stufe), Kapazität (gesamt, Erwachsene)
  - Prüfregeln der Wohnung (Erwachsenen-Grenze, Stufen, Pflicht Erwachsenenpreis)
- **Integration („apppa-dev“):**
  - Mitarbeiter-Buchung erhält Personenpreis-Vorschlag (gleiche Beispiele wie Unit)
  - Erwachsenen-Grenze warnt bzw. blockiert
  - Personenänderung durch Mitarbeiter setzt „Preis prüfen“
  - Datenbank lehnt ungültige Stufen ab
  - Bestehende Wohnungen behalten Wohnungspreis
- **E2E:** Wohnung auf Personenpreise umstellen, Buchung mit Vorschlag € 510, Erwachsenen-Warnung, Mitarbeiter ohne Preise, Layout/axe des Wohnungs-Panels

### F) Ausliefern
- Eine Migration (neue Spalten mit Vorgaben, erweiterte Funktionen). Bestehende Daten bleiben gültig, ohne Umrechnung.
- Ablauf über Staging nach Production wie gewohnt.

### G) Abhängigkeiten
Keine neuen Pakete.

## Implementation Notes (Frontend + Backend)
**Stand 2026-10-25.**

**Migrationen** (nur „apppa-dev“):
- `20261026150000_person_prices_capacity.sql`:
  - Wohnungen: `max_adults`, `price_mode` (Vorgabe `apartment`), `adult_price_cents`, `child_prices` (jsonb).
  - Regeln in der Datenbank:
    - Erwachsene 1 bis Personenzahl;
    - Erwachsenenpreis Pflicht bei Personenpreisen;
    - Stufen geprüft durch `private.valid_child_prices`: höchstens 3, Alter 0–17 streng aufsteigend, Preis 0–10.000 €.
  - Spaltenrechte wie beim Standardpreis.
  - `private.suggested_nights_cents(apartment, adults, child_ages, nights)` rechnet den Vorschlag.
  - Neu angelegt (mit zusätzlichem Parameter Erwachsene):
    - `booking_warnings_for` und `booking_warnings`
    - die öffentliche Hülle `booking_warnings`, mit `p_adults default 0`
  - Angepasst: `save_booking`, `save_block` und `confirm_option`:
    - Erwachsene fließen in die Prüfung ein;
    - Mitarbeiter-Vorschlag nach Preisart;
    - „Preis prüfen“ bei Personenänderungen, nur bei Personenpreisen.
- `20261026150100_person_prices_grant.sql`: Ausführungsrecht der Prüffunktion für `service_role`. Die Prüfregel läuft mit den Rechten der schreibenden Rolle; ohne das Recht scheitern Systemvorgänge und Tests.
- Bestehende Wohnungen und Buchungen bleiben unverändert (Preisart „Wohnung“, keine Erwachsenen-Grenze).

**App**
- **`src/lib/apartments.ts`:**
  - Typen `PriceMode`, `ChildPrice`, `ApartmentPricing`.
  - `suggestedNightsCents` (gleiche Rechnung wie die Datenbank), `personPriceGroups` (Anzeige der Rechnung), `childNightCents`, Umwandlung der Stufen.
- **`src/lib/bookings.ts`:**
  - `BookableApartment` mit Preis-Konfiguration und Erwachsenen-Grenze.
  - `overCapacity` prüft auch die Erwachsenen; die Warnung liefert Personen und Erwachsene.
- **Wohnung bearbeiten** (`apartment-panel.tsx`):
  - „Personen (gesamt)“ und „davon höchstens Erwachsene“.
  - Abschnitt „Preis-Konfiguration“ mit Preisart, Wohnungspreis oder Erwachsenenpreis und bis zu 3 Kinderstufen, dazu die Reinigungsgebühr.
  - Hinweise zu künftigen Buchungen mit mehr Personen bzw. Erwachsenen.
  - Die Werte der nicht gewählten Preisart bleiben gespeichert.
- **Übersicht:** Kapazität mit „max. 2 Erw.“; Preis „€ 50,00 / Erw.“ bzw. Wohnungspreis.
- **Buchungsformular:**
  - Der Vorschlag folgt Wohnung, Zeitraum, Erwachsenen, Kindern und Alter, solange der Preis nicht von Hand geändert ist; danach nur „Neuen Vorschlag übernehmen“.
  - Rechnung „Vorschlag: € 510 (3 Nächte × (3 × € 50 + 1 × € 0 + 1 × € 20))“.
  - Vereinbarter Preis und Gebühren-Positionen wie in PROJ-8.
- **Warnung:** zusätzliche Zeile „3 Erwachsene, die Wohnung ist für höchstens 2 Erwachsene ausgelegt.“

**Tests**
- **Unit:** 241/241, neu:
  - Vorschlag je Preisart mit Spec-Beispiel € 510;
  - Altersgrenzen einschließlich, ältere Kinder zum Erwachsenenpreis;
  - Erwachsenen-Grenze;
  - Prüfregeln der Wohnung.
- **Integration** (`bookings.integration.test.ts`), 6 neu:
  - Vorgaben bestehender Wohnungen;
  - Mitarbeiter-Vorschlag € 510 mit Reinigung einmal;
  - abweichender vereinbarter Preis mit Gebühren;
  - Erwachsenen-Grenze (Mitarbeiter blockiert, Inhaber übersteuert, 1 + 3 Kinder ohne Warnung);
  - „Preis prüfen“ nur bei Personenpreisen;
  - Datenbank lehnt ungültige Konfigurationen ab, Mitarbeiter dürfen sie nicht ändern.
  - Alle Integrationstests grün; beim Gesamtlauf liefen einmal zwei Tests wegen der Last in die 5-Sekunden-Grenze, einzeln grün.
- **E2E**, neu `tests/PROJ-27-personenpreise-kapazitaet.spec.ts` (5 Abläufe, alle grün; Layout/axe auch Tablet und Handy):
  - Konfiguration speichern;
  - Prüfregeln und Hinweis;
  - Vorschlag € 510 und vereinbarter Preis € 535;
  - Erwachsenen-Warnung und Wohnungspreis.
- **Regression:** PROJ-6 und PROJ-8 grün (Desktop). Dafür wurden die Beschriftungen „Personen (gesamt)“ und „Wohnungspreis pro Nacht (€)“ in den Tests angepasst.
