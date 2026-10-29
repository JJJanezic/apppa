# PROJ-34: Preispositionen ordnen

## Status: Planned
**Created:** 2026-10-29
**Last Updated:** 2026-10-29

## Dependencies
- Requires: PROJ-8 (Manuelle Buchungen) — Zusatzkosten-Positionen, Buchungsformular, Rollenregeln für Preise
- Requires: PROJ-32 (Negative Beträge bei Zusatzkosten) — aktueller Stand der Positionen und Beträge
- Vorbereitung für: Rechnungsmodul (Reihenfolge der Positionen auf der Rechnung)

## Überblick
Die Zusatzkosten einer Buchung stehen heute in der Reihenfolge, in der sie eingegeben wurden. Künftig kann der Inhaber sie im Buchungsformular per Ziehen an einem Griff neu ordnen – mit der Maus, am Touchscreen oder mit der Tastatur. Der Übernachtungspreis bleibt immer die oberste Position. Die Reihenfolge wird mit „Buchung speichern“ übernommen und im Buchungs-Detail (und später auf der Rechnung) so angezeigt.

## User Stories
- Als **Inhaber** möchte ich die Zusatzkosten einer Buchung in eine sinnvolle Reihenfolge bringen, damit sie später auf der Rechnung logisch gegliedert erscheinen (z. B. Reinigung vor Rabatt).
- Als **Inhaber** möchte ich eine Position mit der Maus an ihren Platz ziehen, damit das Ordnen schnell geht.
- Als **Inhaber** am Handy oder Tablet möchte ich Positionen mit dem Finger verschieben können.
- Als **Inhaber**, der mit der Tastatur oder einem Screenreader arbeitet, möchte ich Positionen ohne Maus verschieben und dabei die neue Position angesagt bekommen.
- Als **Inhaber** möchte ich, dass die Übernachtung immer ganz oben steht, damit ich sie nicht versehentlich verschiebe.
- Als **Inhaber** möchte ich eine Umsortierung verwerfen können, indem ich das Formular ohne Speichern schließe.

## Out of Scope
- Sortieren direkt im Buchungs-Detail (nur im Buchungsformular)
- Verschieben des Übernachtungspreises (bleibt fix an erster Stelle)
- Zusätzliche Knöpfe „nach oben“/„nach unten“ (der Griff deckt Maus, Touch und Tastatur ab)
- Standard-Reihenfolge je Wohnung oder je Kunde
- Sortieren für Mitarbeiter (sehen keine Preise, PROJ-8)
- Rechnung bzw. Rechnungsdarstellung (Rechnungsmodul)
- Umsatzsteuersatz je Position (PROJ-35)
- Änderung der Höchstzahl von 20 Positionen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Darstellung im Formular
- [ ] Angenommen ein Inhaber im Buchungsformular mit mindestens zwei Zusatzpositionen, wenn die Positionen angezeigt werden, dann hat jede Zusatzposition links einen Griff zum Verschieben
- [ ] Angenommen genau eine oder keine Zusatzposition, wenn das Formular angezeigt wird, dann gibt es keinen Griff
- [ ] Angenommen das Buchungsformular, wenn die Preise angezeigt werden, dann steht der Übernachtungspreis über allen Zusatzpositionen und hat keinen Griff
- [ ] Angenommen der Inhaber fügt eine Position hinzu, wenn sie erscheint, dann steht sie unten als letzte Position

### Verschieben mit Maus und Touch
- [ ] Angenommen drei Positionen „Reinigung“, „Endreinigung Haustier“, „Rabatt“, wenn der Inhaber „Rabatt“ am Griff fasst und über „Reinigung“ zieht, dann lautet die Reihenfolge „Rabatt“, „Reinigung“, „Endreinigung Haustier“
- [ ] Angenommen ein Touchscreen, wenn der Inhaber den Griff einer Position mit dem Finger hält und zieht, dann lässt sich die Position wie mit der Maus verschieben, ohne dass die Seite stattdessen scrollt
- [ ] Angenommen eine Position wird gezogen, wenn sie über anderen Positionen schwebt, dann ist sichtbar, wo sie beim Loslassen landet
- [ ] Angenommen eine Position wird gezogen, wenn sie über dem Übernachtungspreis losgelassen wird, dann landet sie als erste Zusatzposition (unter der Übernachtung)

### Verschieben mit der Tastatur
- [ ] Angenommen der Fokus liegt auf dem Griff einer Position, wenn der Inhaber die Leertaste drückt, mit Pfeil nach oben/unten verschiebt und erneut die Leertaste drückt, dann steht die Position an der neuen Stelle
- [ ] Angenommen eine Position ist mit der Leertaste aufgenommen, wenn der Inhaber Escape drückt, dann kehrt sie an ihre ursprüngliche Stelle zurück
- [ ] Angenommen ein Screenreader, wenn eine Position verschoben wird, dann wird die neue Stelle angesagt (z. B. „Position 2 von 4“)
- [ ] Angenommen der Griff hat den Fokus, wenn er angezeigt wird, dann ist er mit Tab erreichbar, hat einen sichtbaren Fokusrahmen und einen zugänglichen Namen mit der Bezeichnung der Position (z. B. „Reinigung verschieben“)

### Speichern und Anzeige
- [ ] Angenommen die Positionen wurden neu geordnet, wenn der Inhaber „Buchung speichern“ wählt, dann zeigt das Buchungs-Detail die Zusatzkosten in der neuen Reihenfolge unter dem Übernachtungspreis
- [ ] Angenommen eine gespeicherte Buchung mit geordneten Positionen, wenn „Buchung bearbeiten“ geöffnet wird, dann stehen die Positionen in der gespeicherten Reihenfolge
- [ ] Angenommen die Positionen wurden neu geordnet, wenn der Inhaber das Formular ohne Speichern schließt, dann bleibt die bisherige Reihenfolge erhalten
- [ ] Angenommen die Positionen wurden neu geordnet, wenn der Endbetrag angezeigt wird, dann ist er unverändert
- [ ] Angenommen eine mittlere Position wird gelöscht, wenn gespeichert wird, dann behalten die übrigen ihre Reihenfolge ohne Lücke

### Fehler und Rollen
- [ ] Angenommen eine Position hat eine Fehlermeldung (z. B. fehlende Bezeichnung), wenn sie verschoben wird, dann wandert die Meldung mit der Position mit
- [ ] Angenommen ein Mitarbeiter bearbeitet eine Buchung mit geordneten Positionen, wenn er speichert, dann bleibt die Reihenfolge unverändert
- [ ] Angenommen eine bestehende Buchung aus der Zeit vor PROJ-34, wenn sie angezeigt oder bearbeitet wird, dann stehen die Positionen in der Reihenfolge ihrer Eingabe

## Edge Cases
- **Nur eine Zusatzposition:** kein Griff, nichts zu ordnen
- **Höchstzahl 20 Positionen:** Sortieren funktioniert unverändert; die Grenze bleibt
- **Position ganz nach oben gezogen:** landet unter dem Übernachtungspreis, nie darüber
- **Ziehen abgebrochen** (Maus außerhalb des Bereichs losgelassen, Escape): Position kehrt an ihre Stelle zurück
- **Leere oder fehlerhafte Position verschieben:** erlaubt; Prüfregeln und Meldungen gelten unverändert beim Speichern und gehören zur verschobenen Position
- **Gleichzeitige Bearbeitung durch zwei Personen:** bestehender Schutz vor Überschreiben der Buchung (PROJ-8) gilt auch für die Reihenfolge
- **Sehr schmaler Bildschirm (375 px):** Griff, Bezeichnung, Betrag und Löschen-Knopf passen in eine Zeile ohne seitliches Scrollen; Griff mit mindestens 44 × 44 px Tippfläche
- **Positionen mit negativen Beträgen (PROJ-32):** werden wie alle anderen verschoben

## Technical Requirements (optional)
- Barrierefreiheit: WCAG 2.1 AA (Tastaturbedienung, Ansage der neuen Position, Fokusrahmen, Tippfläche ≥ 44 px)
- Reihenfolge wird beim Speichern lückenlos (1, 2, 3 …) übernommen; Rollenregeln aus PROJ-8 unverändert
- Responsiv: Desktop 1440 px, Tablet 768 px, Handy 375 px

## Open Questions
- [ ] Übernimmt das Rechnungsmodul diese Reihenfolge 1:1 oder gruppiert es Positionen (z. B. nach Steuersatz aus PROJ-35)? Klärung im Spec des Rechnungsmoduls

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Übernachtungspreis bleibt fix an erster Stelle, nur Zusatzkosten sind sortierbar | Auf Beherbergungsrechnungen steht die Übernachtung oben; der Übernachtungspreis hat eigene Logik (Vorschlag, anteilige Abrechnung, Storno) | 2026-10-29 |
| Sortieren nur im Buchungsformular, Übernahme mit „Buchung speichern“ | Positionen werden dort ohnehin gepflegt; Verwerfen ohne Speichern möglich; kein zweiter Bearbeitungsweg | 2026-10-29 |
| Ein Griff für Maus, Touch und Tastatur, keine Pfeil-Knöpfe | Deckt alle Bedienwege ab und erfüllt WCAG 2.1 AA; Zeile bleibt am Handy kompakt | 2026-10-29 |
| Griff erst ab zwei Zusatzpositionen | Bei einer Position gibt es nichts zu ordnen; weniger visuelles Rauschen | 2026-10-29 |
| Nur Inhaber sortieren | Mitarbeiter sehen keine Preise (PROJ-8) | 2026-10-29 |
| Bestehende Buchungen behalten die Eingabereihenfolge, keine Umstellung | Reihenfolge ist schon gespeichert; nichts zu migrieren | 2026-10-29 |

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
