# PROJ-33: Firmenanschrift des Gastes in Felder aufteilen

## Status: Deployed
**Created:** 2026-10-29
**Last Updated:** 2026-10-29

## Dependencies
- Requires: PROJ-7 (Gäste-Datenbank) — Firmenangaben am Gast, Gast-Formular, Gast-Detail, Zusammenführen, Anonymisieren
- Requires: PROJ-29 (Gast-Erweiterung) — aktueller Stand des Gast-Formulars
- Vorbild: PROJ-28 (Kundenstammdaten) — gleiche Adressfelder und Prüfregeln

## Überblick
Bisher hat die Firma eines Gastes ein einziges, mehrzeiliges Textfeld „Rechnungsadresse“. Künftig wird diese Anschrift wie bei den Kundenstammdaten in Felder aufgeteilt: Adresszeile 1, Adresszeile 2, Postleitzahl, Ort und Staat. Firmenname und UID-Nummer bleiben unverändert. Bestehende Rechnungsadressen werden in Adresszeile 1 übernommen.

Die aufgeteilte Anschrift ist die Grundlage für das geplante Rechnungsmodul, in dem je Buchung gewählt wird, ob die Rechnung an den Gast oder an seine Firma geht.

## User Stories
- Als **Inhaber** möchte ich die Rechnungsadresse einer Firma in getrennten Feldern erfassen, damit sie später sauber auf Rechnungen und in Exporten erscheint.
- Als **Inhaber** möchte ich für die Firmenanschrift einen Staat aus der Länderliste wählen, damit ausländische Firmen eindeutig erfasst sind.
- Als **Inhaber** möchte ich, dass meine bisher erfassten Rechnungsadressen erhalten bleiben, damit ich nichts neu eintippen muss.
- Als **Inhaber** möchte ich die Firmenanschrift im Gast-Detail übersichtlich untereinander sehen, wie die Privatadresse.
- Als **Inhaber** möchte ich beim Zusammenführen zweier Gäste die Firma samt Anschrift von einem der beiden übernehmen, damit keine gemischten Firmendaten entstehen.
- Als **Inhaber** möchte ich, dass beim Anonymisieren auch die Firmenanschrift vollständig entfernt wird, damit keine personenbezogenen Reste bleiben.
- Als **Mitarbeiter** möchte ich beim Anlegen eines neuen Gastes im Buchungsformular die Firmenanschrift ebenfalls in Feldern erfassen können.

## Out of Scope
- **Rechnungsempfänger je Buchung** („Rechnung an: Gast / Firma“, Firmendaten je Buchung abänderbar): kommt mit dem geplanten Rechnungsmodul
- Änderungen an **Firmenname** und **UID-Nummer** (bleiben unverändert)
- **Suche** über die Firmenanschrift (wie bisher nur Firmenname)
- Schaltfläche „Privatadresse übernehmen“
- Automatisches Zerlegen bestehender Rechnungsadressen in PLZ, Ort usw. (alles geht in Adresszeile 1)
- Vorbelegung des Staates mit „Österreich“
- Prüfung der UID gegen den Staat
- Mehrere Firmen oder Anschriften je Gast (weiterhin ausgeschlossen, siehe PROJ-7)
- Änderungen an der Privatadresse des Gastes

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Formular
- [ ] Angenommen ein Inhaber öffnet das Gast-Formular, wenn er den Bereich „Firma“ aufklappt, dann sieht er Firmenname und UID-Nummer wie bisher und darunter die Überschrift „Rechnungsadresse“ mit dem Hinweis „Nur angeben, wenn sie von der Adresse oben abweicht.“ sowie die Felder Adresszeile 1, Adresszeile 2, PLZ, Ort und Staat
- [ ] Angenommen das Gast-Formular, wenn es auf Tablet oder Desktop angezeigt wird, dann stehen PLZ und Ort nebeneinander; am Handy stehen sie untereinander
- [ ] Angenommen ein neuer Gast, wenn der Bereich „Firma“ geöffnet wird, dann ist beim Staat nichts ausgewählt
- [ ] Angenommen der Staat der Firmenanschrift ist gewählt, wenn der Nutzer „Keine Angabe“ wählt und speichert, dann ist kein Staat gespeichert
- [ ] Angenommen ein Gast mit gespeicherter Firmenanschrift, wenn das Formular geöffnet wird, dann ist der Bereich „Firma“ aufgeklappt und alle Felder zeigen die gespeicherten Werte
- [ ] Angenommen ein Gast hat nur eine Firmenanschrift, aber keinen Firmennamen und keine UID, wenn das Formular geöffnet wird, dann ist der Bereich „Firma“ trotzdem aufgeklappt
- [ ] Angenommen ein Mitarbeiter legt im Buchungsformular einen neuen Gast an, wenn er den Bereich „Firma“ aufklappt, dann sieht er dieselben Felder und kann sie ausfüllen

### Prüfregeln
- [ ] Angenommen alle Felder der Firmenanschrift sind leer, wenn gespeichert wird, dann wird ohne Fehler gespeichert
- [ ] Angenommen nur PLZ und Ort sind ausgefüllt, wenn gespeichert wird, dann wird ohne Fehler gespeichert
- [ ] Angenommen eine Adresszeile hat mehr als 200 Zeichen, wenn gespeichert wird, dann erscheint beim Feld eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen die PLZ hat mehr als 10 Zeichen, wenn gespeichert wird, dann erscheint beim Feld eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen der Ort hat mehr als 100 Zeichen, wenn gespeichert wird, dann erscheint beim Feld eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen eine ausländische PLZ wie „SW1A 1AA“, wenn gespeichert wird, dann wird sie unverändert übernommen
- [ ] Angenommen ein Feld enthält nur Leerzeichen, wenn gespeichert wird, dann gilt es als leer
- [ ] Angenommen jemand umgeht die Prüfung im Browser, wenn zu lange Werte oder ein ungültiger Ländercode gesendet werden, dann lehnt die Datenbank sie ab

### Gast-Detail
- [ ] Angenommen ein Gast mit Firmenanschrift „Musterstraße 1“, „Top 5“, „1010“, „Wien“, Österreich, wenn das Gast-Detail angezeigt wird, dann stehen unter „Rechnungsadresse“ untereinander „Musterstraße 1“, „Top 5“, „1010 Wien“ und „Österreich“
- [ ] Angenommen einzelne Teile der Firmenanschrift sind leer, wenn das Gast-Detail angezeigt wird, dann entfallen diese Zeilen ohne Leerzeilen (z. B. nur „Wien“, wenn nur der Ort erfasst ist)
- [ ] Angenommen die Firmenanschrift ist ganz leer, wenn das Gast-Detail angezeigt wird, dann steht bei „Rechnungsadresse“ wie bisher das Zeichen für fehlende Angaben
- [ ] Angenommen ein Gast ohne jegliche Firmenangaben, wenn das Gast-Detail angezeigt wird, dann erscheint der Abschnitt „Firma“ wie bisher nicht

### Bestehende Daten
- [ ] Angenommen ein Gast hatte die Rechnungsadresse „Muster GmbH\nHauptstraße 1\n1010 Wien“, wenn die Umstellung erfolgt, dann steht in Adresszeile 1 „Muster GmbH Hauptstraße 1 1010 Wien“ und die übrigen Adressfelder sind leer
- [ ] Angenommen ein Gast hatte keine Rechnungsadresse, wenn die Umstellung erfolgt, dann bleiben alle neuen Adressfelder leer
- [ ] Angenommen eine übernommene Rechnungsadresse ist länger als 200 Zeichen, wenn die Umstellung erfolgt, dann wird sie ungekürzt in Adresszeile 1 übernommen; beim nächsten Speichern des Gastes erscheint die Fehlermeldung für zu lange Adresszeilen
- [ ] Angenommen die Umstellung ist erfolgt, wenn Firmenname und UID-Nummer angezeigt werden, dann sind sie unverändert

### Zusammenführen
- [ ] Angenommen zwei Gäste mit unterschiedlicher Firma, wenn der Inhaber sie zusammenführt, dann wählt er bei „Firma“ einmal, von welchem Gast Firmenname, UID-Nummer und alle Felder der Rechnungsadresse gemeinsam übernommen werden
- [ ] Angenommen der Zusammenführen-Dialog, wenn die Firmenangaben verglichen werden, dann zeigt die Vorschau je Gast Firmenname, UID-Nummer und die Rechnungsadresse in der Form wie im Gast-Detail

### Anonymisieren und Löschen
- [ ] Angenommen ein Gast mit Firmenanschrift und Buchungen, wenn der Inhaber ihn anonymisiert, dann sind Firmenname, UID-Nummer und alle Felder der Rechnungsadresse geleert, und im Änderungsprotokoll sind auch die Altwerte der Adressfelder entfernt

### Änderungsprotokoll
- [ ] Angenommen ein Inhaber ändert ein Feld der Firmenanschrift, wenn gespeichert wird, dann erscheint die Änderung im Änderungsprotokoll wie bei den übrigen Gastfeldern

## Edge Cases
- **Nur Firmenanschrift, keine Firma/UID:** erlaubt, der Abschnitt „Firma“ wird im Detail angezeigt
- **Altdaten über 200 Zeichen** (bisher waren 500 Zeichen erlaubt): bleiben ungekürzt erhalten, bis der Gast das nächste Mal bearbeitet wird; dann muss der Nutzer kürzen. Erwartet selten
- **Altdaten mit Leerzeilen oder mehrfachen Umbrüchen:** Umbrüche werden zu Leerzeichen, mehrere Leerzeichen hintereinander zu einem, Leerzeichen am Anfang und Ende entfallen
- **Staat ohne sonstige Adresse:** erlaubt; das Detail zeigt dann nur den Staat
- **Gast wird gleichzeitig von zwei Inhabern bearbeitet:** bestehender Schutz vor Überschreiben aus PROJ-7 gilt auch für die neuen Felder
- **Mitarbeiter:** dürfen bestehende Gäste weiterhin nicht bearbeiten; nur beim Anlegen eines Gastes in einer Buchung erfassen sie die Firmenanschrift
- **Neuer Gast aus dem Buchungsformular:** speichert die neuen Felder genauso wie das Gast-Formular

## Technical Requirements (optional)
- Gleiche Feldlängen und Länderauswahl wie PROJ-28 (Länderauswahl aus PROJ-7 mit „Keine Angabe“)
- Prüfregeln im Browser und in der Datenbank
- Das bisherige einzelne Textfeld entfällt nach der Übernahme
- Sicherheit: Mandantentrennung und Rollenregeln aus PROJ-7 unverändert

## Open Questions
- [ ] Welche Felder der Firmenanschrift sind für eine Rechnung Pflicht und wie wird der Rechnungsempfänger je Buchung gewählt? Klärung im Spec des Rechnungsmoduls
- [ ] Gibt es in Staging/Produktion überhaupt Rechnungsadressen über 200 Zeichen? Beim Deploy prüfen. Falls ja: Solange ein solcher Gast nicht gekürzt ist, scheitert auch das Zusammenführen mit ihm mit der Längenmeldung

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Firma bleibt am Gast als Stammdatum; „Rechnung an: Gast / Firma“ kommt später an die Buchung (mit dem Rechnungsmodul) | Derselbe Gast bucht mal privat, mal für seine Firma; alte Buchungen dürfen sich bei Firmenwechsel nicht ändern. PROJ-33 bleibt klein | 2026-10-29 |
| Felder Adresszeile 1, Adresszeile 2, PLZ, Ort, Staat; Firmenname und UID unverändert | Einheitlich mit den Kundenstammdaten (PROJ-28); Grundlage für Rechnungen und Exporte | 2026-10-28 |
| Bestehende Rechnungsadresse komplett in Adresszeile 1, Umbrüche zu Leerzeichen | Kein fehleranfälliges automatisches Zerlegen; Nutzer korrigiert bei Bedarf selbst | 2026-10-28 |
| Altdaten über 200 Zeichen werden nicht gekürzt, Fehler erst beim nächsten Speichern | Keine Datenverluste; Fall erwartet selten | 2026-10-29 |
| Staat startet leer, keine Vorbelegung mit Österreich | Leere Firmenanschrift bedeutet „wie Privatadresse“; eine Vorbelegung ließe sie ausgefüllt wirken; auch die Privatadresse ist nicht vorbelegt | 2026-10-29 |
| Alle Adressfelder optional und unabhängig voneinander | Wie Privatadresse und PROJ-28; Nutzer kennen oft nur Teile der Anschrift | 2026-10-29 |
| Beim Zusammenführen bleibt „Firma“ eine einzige Auswahl inkl. Anschrift | Verhindert gemischte Firmendaten aus zwei Gästen | 2026-10-29 |
| Firmenanschrift nicht durchsuchbar | Wie bisher; Suche über Firmenname reicht | 2026-10-29 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Fünf eigene Spalten am Gast mit Präfix „Firma“ statt eigener Tabelle | Eine Firma je Gast (PROJ-7); einfache Abfragen; gleiche Struktur wie Kundenstammdaten | 2026-10-29 |
| Gleiche Längen- und Länderregeln wie PROJ-28, in Browser und Datenbank | Einheitliche Daten für das spätere Rechnungsmodul; Schutz auch bei umgangener Browser-Prüfung | 2026-10-29 |
| Altes Feld in derselben Migration übernehmen und entfernen | Keine doppelte Datenhaltung; kein Aufräum-Schritt später nötig; kurzes Fehlerfenster beim Deploy im Pilotbetrieb vertretbar | 2026-10-29 |
| Längenregel für Altdaten nicht rückwirkend prüfen; scharf schalten, wenn keine zu langen Altdaten existieren | Spec verlangt, Altdaten ungekürzt zu behalten; neue und geänderte Einträge sind trotzdem geschützt | 2026-10-29 |
| Bestehende Datenbankfunktionen (Buchung mit neuem Gast, Zusammenführen, Anonymisieren) anpassen statt neue anzulegen | Bestehende Rechte- und Protokolllogik bleibt; nur die Feldliste ändert sich | 2026-10-29 |
| Gemeinsamer Anzeige-Baustein für Adresszeilen (Privat- und Firmenanschrift) | Gleiche Darstellung in Detail und Zusammenführen-Dialog; keine doppelte Logik | 2026-10-29 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Kleine Umstellung ohne neue Seiten oder Pakete. Der Gast bekommt fünf neue Felder für die Firmenanschrift. Das alte Textfeld wird in einem Schritt übernommen und danach entfernt. Alle Stellen, die bisher das alte Feld lesen oder schreiben, werden auf die neuen Felder umgestellt. Vorbild für Felder, Längen und Länderauswahl sind die Kundenstammdaten (PROJ-28).

### Komponenten (was sich in der Oberfläche ändert)
```
Gast-Formular (gemeinsamer Baustein, auch im Buchungsformular „Neuer Gast“)
+-- Bereich „Firma“ (aufklappbar, wie bisher)
    +-- Firmenname, UID-Nummer (unverändert)
    +-- Überschrift „Rechnungsadresse“ + Hinweis „Nur angeben, wenn sie von der Adresse oben abweicht.“
    +-- Adresszeile 1
    +-- Adresszeile 2
    +-- PLZ | Ort (nebeneinander ab Tablet, untereinander am Handy)
    +-- Staat (vorhandene Länderauswahl mit „Keine Angabe“, startet leer)
    (aufgeklappt, sobald Firmenname, UID oder irgendein Adressfeld befüllt ist)

Gast-Detail
+-- Abschnitt „Firma“ (nur wenn Firmenangaben vorhanden)
    +-- Firmenname, UID-Nummer (unverändert)
    +-- Rechnungsadresse: Zeile 1 / Zeile 2 / „PLZ Ort“ / Staat untereinander, leere Teile entfallen

Dubletten zusammenführen (Dialog)
+-- Auswahl „Firma“ (eine Auswahl wie bisher)
    +-- Vorschau je Gast: Firmenname, UID, Rechnungsadresse im selben Zeilenformat wie im Detail
```
Die Anzeige „Zeilen untereinander, leere entfallen“ gibt es schon für die Privatadresse. Sie wird zu einem kleinen gemeinsamen Hilfsbaustein, den Detail und Zusammenführen-Dialog für beide Adressen nutzen.

### Datenmodell (in Worten)
Jeder Gast bekommt zusätzlich:
- Firmen-Adresszeile 1 (bis 200 Zeichen)
- Firmen-Adresszeile 2 (bis 200 Zeichen)
- Firmen-PLZ (bis 10 Zeichen, freie Eingabe)
- Firmen-Ort (bis 100 Zeichen)
- Firmen-Staat (internationaler Ländercode wie bei den übrigen Länderangaben, z. B. AT)

Alle optional, leere Eingaben werden als „nicht angegeben“ gespeichert. Das bisherige Feld „Rechnungsadresse“ (ein Text bis 500 Zeichen) entfällt.

Gespeichert in: Supabase, Tabelle der Gäste. Mandantentrennung und Rollenregeln bleiben, wie sie sind, weil sich nur Spalten ändern.

### Datenübernahme (einmalig, in der Migration)
1. Neue Felder anlegen
2. Bisherige Rechnungsadresse in Adresszeile 1 kopieren: Zeilenumbrüche und mehrfache Leerzeichen werden zu einem Leerzeichen, Ränder abgeschnitten
3. Altes Feld entfernen

Die Längenregel von 200 Zeichen gilt in der Datenbank für alle neuen und geänderten Einträge. Altdaten, die länger sind, bleiben unangetastet stehen (die Regel wird für sie nicht rückwirkend geprüft). Gibt es beim Einspielen keine solchen Altdaten, wird die Regel sofort vollständig scharf geschaltet.

### Was in der Datenbank angepasst wird
| Stelle | Änderung |
|--------|----------|
| Buchung speichern mit neuem Gast | übernimmt die fünf Adressfelder statt des alten Felds |
| Gäste zusammenführen | übernimmt bei „Firma“ Name, UID und alle fünf Adressfelder gemeinsam vom gewählten Gast |
| Gast anonymisieren | leert zusätzlich die fünf Adressfelder |
| Änderungsprotokoll | keine Änderung nötig; es erfasst neue Spalten automatisch und wird beim Anonymisieren wie bisher bereinigt |
| Suche, Dublettenprüfung, Gästeliste | keine Änderung (die Anschrift wird nicht durchsucht) |

### Was in der App angepasst wird
- Gast-Datentyp, Feldgrenzen und Prüfregeln (die Grenze 500 entfällt, neue Grenzen 200/10/100)
- Laden und Speichern von Gästen (Gast-Formular und Buchungsformular „Neuer Gast“)
- Gast-Formular, Gast-Detail, Zusammenführen-Dialog
- Texte (Feldbezeichnungen; Überschrift und Hinweis „Rechnungsadresse“ bleiben)

### Tests
- **Unit:** Prüfregeln der neuen Felder (Längen, leer, nur Leerzeichen), Zeilenformat der Anschrift (leere Teile entfallen)
- **Integration (gegen Dev-Datenbank):** Datenbank lehnt zu lange Werte und ungültigen Ländercode ab; Zusammenführen übernimmt die Anschrift gemeinsam; Anonymisieren leert sie; neuer Gast aus dem Buchungsformular speichert sie
- **E2E:** Firmenanschrift erfassen, im Detail sehen, bearbeiten; Staat startet leer; Handy-Ansicht; Zusammenführen-Vorschau
- **Datenübernahme:** einmalige Prüfung in Dev nach dem Einspielen (Altdaten mit Umbrüchen landen korrekt in Adresszeile 1)

### Auslieferung
Migration und App-Stand gehören zusammen. Zwischen dem Einspielen der Migration und dem neuen App-Stand liegen nur Minuten. In dieser Zeit können Gast-Seiten der jeweiligen Umgebung kurz Fehler zeigen. Für den Pilotbetrieb ist das vertretbar; der Deploy-Ablauf spielt beides direkt nacheinander ein.

### Abhängigkeiten (Pakete)
Keine neuen Pakete.

## Implementation Notes (Frontend)
Stand 2026-10-29. Die Oberfläche ist fertig, funktioniert aber erst nach `/backend` (die neuen Spalten fehlen bis dahin in der Datenbank).

- `src/lib/guests.ts`: Gast-Typ mit `companyAddressLine1/2`, `companyPostalCode`, `companyCity`, `companyCountry` statt `companyBillingAddress`; neue Grenzen (200/10/100), Grenze 500 entfällt. Neue Hilfsfunktionen `addressLines`, `privateAddressLines`, `companyAddressLines` (Zeilen, leere Teile entfallen) und `hasCompany`. Zusammenführen: „Firma“ umfasst Name, UID und alle fünf Adressfelder
- `src/lib/validation/guests.ts`: Prüfregeln der neuen Felder (optional, getrimmt, leer → null; Staat nur gültige Ländercodes)
- `src/lib/guests-data.ts`, `src/types/database.ts`: Spalten `company_address_line1`, `company_address_line2`, `company_postal_code`, `company_city`, `company_country` (Typen von Hand nachgezogen; werden mit `/backend` neu erzeugt). Das Buchungsformular „Neuer Gast“ nutzt dieselbe Spaltenzuordnung
- `src/components/guests/guest-fields.tsx`: Im Bereich „Firma“ unter Firmenname und UID die Gruppe „Rechnungsadresse“ mit Hinweis, Adresszeile 1/2, PLZ | Ort (ab Tablet nebeneinander, am Handy untereinander), Staat (Länderauswahl mit „Keine Angabe“, startet leer). Bereich aufgeklappt, sobald eines der Firmenfelder befüllt ist
- Gast-Detail: Rechnungsadresse zeilenweise wie die Privatadresse; Abschnitt „Firma“ auch bei reiner Anschrift
- Zusammenführen-Dialog: Vorschau nutzt dieselben Adresszeilen. **Abweichung:** Wie bei der Privatadresse stehen sie dort durch Komma getrennt in einer Zeile (der Dialog zeigt jede Angabe einzeilig), nicht untereinander
- Texte: `guests.panel.addressLine1/2`, `guests.panel.companyCountry` („Staat“)
- Tests: Unit-Tests für Prüfregeln, Adresszeilen, `hasCompany` und Zusammenführen (gesamt 347 grün)

## Implementation Notes (Backend)
Stand 2026-10-29, in Dev („apppa-dev“) eingespielt.

- `supabase/migrations/20261029043623_guest_company_address.sql`:
  - Neue Spalten `company_address_line1/2`, `company_postal_code`, `company_city`, `company_country` mit denselben Prüfregeln wie PROJ-28 (leer bzw. nur Leerzeichen abgelehnt, 200/10/100 Zeichen, Ländercode `^[A-Z]{2}$`)
  - Übernahme: `company_billing_address` → Adresszeile 1, alle Leerraum-Folgen (Umbrüche, mehrfache Leerzeichen) zu einem Leerzeichen, Ränder weg. Dabei sind die Tabellen-Trigger kurz aus, damit die Strukturumstellung weder `updated_at` ändert (sonst „veralteter Stand“ in offenen Formularen) noch als Nutzeränderung ins Änderungsprotokoll geht
  - Regel „Adresszeile 1 bis 200 Zeichen“ zuerst `not valid` angelegt und nur dann rückwirkend geprüft, wenn keine längeren Altdaten existieren (sonst Hinweis im Migrationslog mit Anzahl). In Dev: keine Altdaten, Regel voll gültig
  - Spalte `company_billing_address` entfernt
  - Funktionen neu: `private.save_booking` (neuer Gast mit den fünf Feldern), `private.merge_guests` („Firma“ übernimmt Name, UID und alle Adressfelder gemeinsam), `private.anonymize_guest` (leert auch die Adressfelder). Sonst unverändert gegenüber dem letzten Stand (PROJ-30 bzw. PROJ-29)
- `supabase/migrations/20261029043831_guest_company_address_grants.sql`: Schreibrechte (insert/update) für die neuen Spalten. **Nachtrag aus den Tests:** Die Gäste-Tabelle vergibt Schreibrechte spaltenweise (PROJ-7); ohne diese Freigabe scheiterte jedes Speichern eines Gastes mit „permission denied“
- Änderungsprotokoll und RLS: keine Änderung nötig (Protokoll erfasst neue Spalten automatisch; Lesen ist tabellenweit freigegeben)
- `npm run db:types` erzeugt dieselben Typen, die das Frontend schon von Hand nachgezogen hatte
- Advisors: nur die zwei bekannten Auth-Hinweise der Dev-Umgebung (OTP-Ablaufzeit, Passwortprüfung gegen Datenlecks), nichts aus dieser Migration
- Tests: `supabase/tests/guests.integration.test.ts` (neuer Block „PROJ-33 Firmenanschrift“: Speichern, Prüfregeln inkl. Grenzwerte und ausländischer PLZ, Zusammenführen, Anonymisieren samt bereinigtem Protokoll, Änderungsprotokoll), `supabase/tests/bookings.integration.test.ts` (neuer Gast aus dem Buchungsformular mit Firmenanschrift)
- Übernahme-Logik in Dev mit Beispieltext geprüft („  Muster GmbH⏎Hauptstraße 1⏎⏎1010   Wien  “ → „Muster GmbH Hauptstraße 1 1010 Wien“); Dev hatte keine Altdaten

## QA Test Results

**Tested:** 2026-10-29
**App URL:** http://localhost:3000 (Produktions-Build gegen „apppa-dev“)
**Tester:** QA Engineer (AI)

### Automatisierte Tests
- Unit (Vitest): 347/347 grün, davon neu: Prüfregeln der Firmenanschrift, Adresszeilen, `hasCompany`, Zusammenführen
- Integration (Vitest gegen Dev): Gäste und Buchungen 45/45 grün, davon neu: Speichern, Datenbank-Prüfregeln, Zusammenführen, Anonymisieren samt Protokoll, neuer Gast aus dem Buchungsformular. Gesamtlauf 469/470; der eine Ausreißer (PROJ-1 RLS, Zeitüberschreitung unter Last) läuft allein 19/19 grün und hat keinen Bezug zu PROJ-33
- E2E (Playwright, neu `tests/PROJ-33-firmenanschrift-aufteilen.spec.ts`): 6 Tests, Abläufe im Desktop-Projekt, Layout/axe in Desktop, Tablet, Handy und Firefox – alle grün
- Regression E2E: PROJ-7 „Anlegen und Bearbeiten“, „Dubletten“, „Löschen und Anonymisieren“ (12), PROJ-29 „Rollen“, „Zusammenführen und Löschen“ (6), PROJ-8 „Mitarbeiter legt Buchung mit neuem Gast an“ – alle grün

### Acceptance Criteria Status

#### Formular
- [x] Firmenname und UID wie bisher, darunter „Rechnungsadresse“ mit Hinweis und den fünf Feldern (E2E)
- [x] PLZ und Ort ab Tablet nebeneinander, am Handy untereinander (E2E, Positionsvergleich in allen Breiten)
- [x] Staat startet leer („Land wählen“) (E2E)
- [x] „Keine Angabe“ beim Staat speichert keinen Staat (E2E, Datenbank geprüft)
- [x] Gespeicherte Werte beim Bearbeiten, Bereich „Firma“ aufgeklappt (E2E)
- [x] Nur Firmenanschrift ohne Firma/UID → Bereich trotzdem aufgeklappt (E2E)
- [x] Mitarbeiter im Buchungsformular: gleicher Formular-Baustein; Speichern mit Firmenanschrift über „Buchung mit neuem Gast“ (Integration); Regression des Mitarbeiter-Ablaufs (E2E)

#### Prüfregeln
- [x] Alles leer → speichert (Unit)
- [x] Nur PLZ und Ort → speichert (Unit)
- [x] Adresszeile > 200, PLZ > 10, Ort > 100 → Fehlermeldung, nichts gespeichert (Unit; im Formular zusätzlich `maxlength`, E2E)
- [x] Ausländische PLZ „SW1A 1AA“ unverändert (Unit + Integration)
- [x] Nur Leerzeichen gilt als leer (Unit; E2E: „  Linz  “ → „Linz“)
- [x] Datenbank lehnt zu lange Werte, nur Leerzeichen und ungültige Ländercodes ab (Integration)

#### Gast-Detail
- [x] „Musterstraße 1“ / „Top 5“ / „1010 Wien“ / „Österreich“ untereinander (E2E)
- [x] Leere Teile entfallen, z. B. nur „Wien“ (E2E + Unit)
- [x] Firmenname ohne Anschrift → „–“ bei Rechnungsadresse (E2E)
- [x] Ohne Firmenangaben kein Abschnitt „Firma“ (E2E)

#### Bestehende Daten
- [x] Umbrüche/mehrfache Leerzeichen → ein Leerzeichen in Adresszeile 1, übrige Felder leer (in Dev per Beispieltext geprüft; Dev hatte keine Altdaten)
- [x] Ohne Rechnungsadresse bleiben alle Felder leer
- [x] Altdaten > 200 Zeichen bleiben ungekürzt (Regel `not valid`, nur rückwirkend geprüft, wenn keine solchen Daten existieren). In Dev nicht reproduzierbar, da keine Altdaten; Logik per Code-Review geprüft
- [x] Firmenname und UID unverändert (Migration fasst sie nicht an)

#### Zusammenführen
- [x] „Firma“ als eine Auswahl, übernimmt Name, UID und alle Adressfelder gemeinsam (E2E + Integration)
- [x] Vorschau zeigt Firma samt Anschrift (E2E). Hinweis: durch Komma getrennt in einer Zeile wie bei der Privatadresse (bekannte, dokumentierte Abweichung)

#### Anonymisieren und Änderungsprotokoll
- [x] Anonymisieren leert alle Adressfelder, Altwerte im Protokoll entfernt (Integration)
- [x] Änderung eines Adressfelds erscheint im Änderungsprotokoll (Integration)

### Edge Cases Status
- [x] Nur Firmenanschrift, keine Firma/UID: Abschnitt sichtbar (E2E)
- [x] Altdaten > 200 Zeichen: siehe oben; Zusammenführen mit so einem Gast würde an der Längenregel scheitern (bekannt, offene Frage für den Deploy)
- [x] Altdaten mit Leerzeilen/mehrfachen Umbrüchen (Dev-Prüfung der Übernahme-Logik)
- [x] Staat ohne sonstige Adresse: nur Staat im Detail (Unit)
- [x] Gleichzeitiges Bearbeiten: bestehender Schutz unverändert (Regression PROJ-7 E2E „Bearbeiten … fremde Änderung“)
- [x] Mitarbeiter ändern bestehende Gäste weiterhin nicht (Integration PROJ-7; neue Spaltenrechte umgehen die Zeilenregeln nicht)
- [x] Neuer Gast aus dem Buchungsformular speichert die Felder (Integration)

### Security Audit Results
- [x] Authentifizierung: Gast-Seiten nur angemeldet (unverändert, Regression)
- [x] Autorisierung: Mandantentrennung per RLS unverändert; neue Schreibrechte gelten nur spaltenweise und zusätzlich zu den Zeilenregeln (Mitarbeiter-Update trifft weiterhin nichts, Integration)
- [x] Zusammenführen über Kundengrenzen und durch Mitarbeiter weiterhin abgelehnt (Integration)
- [x] Eingaben werden im Browser und in der Server-Aktion mit demselben Zod-Schema geprüft, zusätzlich Prüfregeln in der Datenbank
- [x] XSS: Anschrift wird als Text gerendert (React escaped), kein `dangerouslySetInnerHTML`
- [x] Keine neuen Endpunkte, keine neuen Geheimnisse
- [x] DSGVO: Anonymisieren entfernt die Firmenanschrift samt Protokoll-Altwerten

### Nicht getestet
- Safari: nur gegen `npm run dev` möglich (Secure-Cookies); die Änderung besteht aus normalen Eingabefeldern ohne Safari-spezifisches Verhalten, daher ausgelassen

### Bugs Found
Keine. Während `/backend` gefunden und schon behoben: fehlende spaltenweise Schreibrechte für die neuen Spalten (jedes Speichern wäre gescheitert).

### Summary
- **Acceptance Criteria:** 26/26 bestanden
- **Bugs Found:** 0 (0 critical, 0 high, 0 medium, 0 low)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy. Beim Deploy prüfen, ob Staging/Produktion Rechnungsadressen über 200 Zeichen haben (Migrationslog meldet die Anzahl)


## Deployment
- **Datum:** 2026-10-29, Version v1.10.0
- **Commit:** `4a4001e` (Branches `staging` und `production`)
- **Staging:** https://staging.apppa.at (geprüft vom Nutzer)
- **Production:** https://app.apppa.at
- **Migrationen (Staging und Produktion):** `20261028212807_audit_log_policy_tenant_list.sql` (Fix aus einem früheren Commit, mit ausgeliefert), `20261029043623_guest_company_address.sql`, `20261029043831_guest_company_address_grants.sql`
- **Advisors:** Staging und Produktion ohne Meldungen
- **Lange Altadressen (> 200 Zeichen):** Die Migration hat auf beiden Umgebungen keine Meldung ausgegeben; nicht direkt abgefragt
- **Hinweis Dev:** Der RLS-Test „Person ohne Mitgliedschaft sieht keinerlei Mandantendaten“ (PROJ-1) läuft im Gesamtlauf in die Zeitgrenze, weil im Dev-Protokoll rund 61.000 Zeilen gelöschter Testkunden liegen. Kein Bezug zu PROJ-33, nicht auf Staging/Produktion übertragbar
