# PROJ-34: Preispositionen ordnen

## Status: Architected
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
| Keine Datenbank-Änderung | `booking_charges.position` (1–20) existiert seit PROJ-8; die Speicherfunktion schreibt die Positionen lückenlos in Listenreihenfolge, das Detail sortiert danach; Mitarbeiter-Speichern lässt Positionen unangetastet | 2026-10-29 |
| Reines Frontend-Feature, Speicherweg unverändert | Die Formularliste wird umsortiert und wie bisher als Liste gesendet; kein neuer Server-Endpunkt, keine neue Prüfregel | 2026-10-29 |
| Bibliothek @dnd-kit (core, sortable, modifiers, utilities) | Maus, Touch und Tastatur aus einer Hand, eingebaute Screenreader-Ansagen (auf Deutsch einstellbar), aktiv gepflegt, klein, arbeitet mit React 19; Alternativen: react-beautiful-dnd eingestellt, Eigenbau für Touch + Tastatur + Ansagen zu aufwendig | 2026-10-29 |
| Umsortieren über die vorhandene Formular-Liste (react-hook-form „verschieben“) | Werte und Fehlermeldungen wandern automatisch mit der Position; keine Doppelhaltung der Reihenfolge | 2026-10-29 |
| Ziehen nur am Griff, nur senkrecht, nur innerhalb der Zusatzkosten-Liste | Eingabefelder bleiben normal bedienbar; Seite scrollt außerhalb des Griffs weiter; Übernachtung liegt außerhalb der Liste und kann nie überholt werden | 2026-10-29 |
| Escape während des Ziehens schließt das Seitenpanel nicht | Das Buchungsformular liegt in einem Sheet, das auf Escape schließt; während einer Ziehaktion bricht Escape nur das Ziehen ab | 2026-10-29 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (Bestand geprüft)
- Die Zusatzkosten werden schon heute mit einer **Positionsnummer** (1–20) gespeichert. Beim Speichern ersetzt die Datenbank alle Positionen einer Buchung und nummeriert sie in der Reihenfolge, in der das Formular sie schickt – lückenlos.
- Das Buchungs-Detail und „Buchung bearbeiten“ laden die Positionen nach dieser Nummer sortiert.
- Speichert ein Mitarbeiter, bleiben Preise und Positionen unverändert (PROJ-8).
- Alte Buchungen haben die Nummern in Eingabereihenfolge.

**Folge:** Es braucht **keine Datenbank- und keine Server-Änderung**. Das Feature ist rein im Buchungsformular: Wer die Liste im Formular umsortiert, bekommt beim Speichern automatisch die neue Reihenfolge.

### A) Komponenten-Struktur
```
Buchungsformular (Seitenpanel, booking-panel)
+-- … Abschnitte wie bisher …
+-- Preis-Bereich (nur Inhaber)
    +-- Übernachtungspreis (fix oben, kein Griff, kein Ziehziel)
    +-- Zusatzkosten-Liste  ← NEU: sortierbarer Bereich
    |   +-- Zusatzposition (je Zeile)
    |   |   +-- Griff (NEU, nur ab 2 Positionen; 44 × 44 px; „<Bezeichnung> verschieben“)
    |   |   +-- Bezeichnung (wie bisher, Fehler unter dem Feld)
    |   |   +-- Betrag (wie bisher)
    |   |   +-- Löschen-Knopf (wie bisher)
    |   +-- Platzhalter-Markierung beim Ziehen (zeigt den Landeplatz)
    +-- „Position hinzufügen“ (hängt unten an, wie bisher)
    +-- Endbetrag (unverändert, Summe ist reihenfolgeunabhängig)
+-- Unsichtbarer Ansagebereich für Screenreader (von der Bibliothek bereitgestellt)
```
Eine kleine neue Komponente „sortierbare Zusatzposition“ kapselt Griff und Zieh-Verhalten; der Rest der Zeile bleibt der heutige Code. Das Buchungs-Detail bleibt unverändert (zeigt schon in Positionsreihenfolge).

### B) Datenmodell
Unverändert. Jede Zusatzposition hat weiterhin:
- Positionsnummer (1–20, lückenlos, ergibt sich aus der Reihenfolge im Formular)
- Bezeichnung
- Betrag in Cent (auch negativ, PROJ-32)

Gespeichert in: Supabase, Tabelle der Buchungs-Zusatzkosten (nur für Inhaber lesbar). Keine Migration.

### C) Technische Entscheidungen (Begründung)
- **Fertige Ziehen-und-Ablegen-Bibliothek (@dnd-kit):** Sie deckt Maus, Finger und Tastatur mit einem einzigen Griff ab und bringt Screenreader-Ansagen mit, die wir auf Deutsch formulieren („Reinigung aufgenommen, Position 2 von 4“ / „… abgelegt auf Position 3 von 4“ / „Verschieben abgebrochen“). Selbst bauen wäre bei Touch und Barrierefreiheit fehleranfällig.
- **Umsortieren der vorhandenen Formularliste:** Das Formular kennt die Positionen schon als Liste. Beim Ablegen wird nur die Position in dieser Liste verschoben – Bezeichnung, Betrag und eventuelle Fehlermeldung ziehen automatisch mit. Schließen ohne Speichern verwirft die Änderung wie jede andere Formulareingabe.
- **Ziehen nur am Griff, nur senkrecht, begrenzt auf die Liste:** Felder bleiben normal klick- und tippbar. Am Handy scrollt die Seite außerhalb des Griffs normal; am Griff selbst wird das Scrollen unterdrückt, damit der Finger zieht. Weil die Übernachtung außerhalb der Liste steht, landet eine ganz nach oben gezogene Position immer als erste Zusatzposition.
- **Escape-Konflikt mit dem Seitenpanel:** Das Formular liegt in einem Panel, das auf Escape schließt. Während eine Position aufgenommen ist, bricht Escape nur das Verschieben ab (Position springt zurück); das Panel bleibt offen.
- **Griff erst ab zwei Positionen:** Bei 0 oder 1 Position wird die Zeile ohne Griff angezeigt, Layout wie heute.
- **Platz auf 375 px:** Die Zeile bekommt eine zusätzliche schmale Spalte für den Griff; Bezeichnung schrumpft, Betrag und Löschen bleiben gleich breit – kein seitliches Scrollen.

### D) Abhängigkeiten (zu installieren)
- `@dnd-kit/core` – Grundlage für Ziehen mit Maus, Touch und Tastatur inkl. Ansagen
- `@dnd-kit/sortable` – sortierbare Listen, Tastatur-Verschieben in der Liste
- `@dnd-kit/modifiers` – Bewegung auf senkrecht und auf den Listenbereich begrenzen
- `@dnd-kit/utilities` – Hilfen für die Verschiebe-Darstellung

### Tests (Plan)
- Unit: Umsortier-Logik und deutsche Ansagetexte
- E2E (Playwright): Maus-Ziehen, Tastatur (Leertaste / Pfeile / Leertaste, Escape bricht ab und Panel bleibt offen), Speichern → Detail-Reihenfolge, Bearbeiten öffnet gespeicherte Reihenfolge, Schließen ohne Speichern, Mitarbeiter-Speichern ändert nichts, 375 px ohne seitliches Scrollen
- Touch: E2E mit Touch-Emulation, zusätzlich manuell am Handy

### Backend
Nicht nötig. `/backend` kann für PROJ-34 entfallen; nach `/frontend` direkt `/qa`.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
