# PROJ-33: Firmenanschrift des Gastes in Felder aufteilen

## Status: Planned
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
