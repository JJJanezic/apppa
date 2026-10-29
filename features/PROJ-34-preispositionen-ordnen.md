# PROJ-34: Preispositionen ordnen

## Status: Deployed
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
- **Ziehen abgebrochen** (Escape): Position kehrt an ihre Stelle zurück
- **Außerhalb der Liste losgelassen:** Position landet am nächstgelegenen Ende der Liste (oben unter der Übernachtung, unten als letzte); zurück an die alte Stelle nur mit Escape oder Schließen ohne Speichern
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
| Loslassen außerhalb der Liste legt am nächstgelegenen Ende ab (QA BUG-1, bewusst so belassen) | Gleiches Verhalten oben (unter die Übernachtung) und unten; Abbrechen bleibt mit Escape möglich, Verwerfen mit Schließen ohne Speichern | 2026-10-29 |
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

## Implementation Notes (Frontend)
**Gebaut (2026-10-29):**
- `src/components/bookings/sortable-charges.tsx` (neu): `SortableChargeList` (Ziehbereich mit @dnd-kit, Sensoren Zeiger + Tastatur, nur senkrecht und innerhalb der Liste, deutsche Screenreader-Anleitung und -Ansagen) und `SortableChargeRow` (Zeile mit Griff als shadcn-`Button`, 44 × 44 px, `touch-none`, Name „<Bezeichnung> verschieben“ bzw. „Position n verschieben“ bei leerer Bezeichnung; Rahmen + Schatten an der gezogenen Zeile)
- `booking-panel.tsx`: Zusatzkosten-Zeilen in die sortierbare Liste gelegt; Ablegen ruft `useFieldArray.move` (Werte und Fehlermeldungen wandern mit); Griff erst ab zwei Positionen; Übernachtung bleibt außerhalb der Liste
- `detail-panel.tsx`: neue optionale Eigenschaft `onEscapeKeyDown`; das Buchungsformular verhindert damit das Schließen, solange eine Position aufgenommen ist (Escape bricht nur das Verschieben ab)
- `messages/de.json`: Texte für Griff, Anleitung und Ansagen („… aufgenommen, Position x von y“, „… auf Position …“, „… abgelegt auf Position …“, „Verschieben abgebrochen …“)
- Pakete: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`
- Keine Datenbank- oder Server-Änderung (siehe Tech Design)

**Während der Umsetzung gefunden und behoben:**
- Beim Aufnehmen überschrieb die Bibliothek die Ansage „aufgenommen“ sofort mit „auf Position x von y“ (Position liegt über sich selbst) → Ansage für das unveränderte Ziel unterdrückt
- Die Ablege-Ansage nannte nach dem Umsortieren die falsche Bezeichnung → Name und Stellen werden beim Aufnehmen festgehalten

**Abweichungen:** Für die Verschiebe-Darstellung (transform) ist ein `style`-Attribut nötig; das lässt sich mit Tailwind-Klassen nicht abbilden.

**Bekannte Eigenheiten der Bibliothek (kein App-Fehler, relevant für Tests):**
- Klicks in den ersten 50 ms nach dem Ablegen werden verschluckt (Schutz vor Klick am Ende des Ziehens)
- Die Tastatur-Steuerung hört erst einen Takt nach der Leertaste auf Pfeile und Escape; Tests warten deshalb auf die Ansage

**Tests:** `tests/PROJ-34-preispositionen-ordnen.spec.ts`, 9 Desktop-Tests (Darstellung, Maus, Tastatur inkl. Ansagen und Escape, Speichern/Detail/Bearbeiten, Verwerfen, Fehlermeldung wandert mit, Löschen ohne Lücke, Mitarbeiter) und 1 Handy-Test (375 px, Griff ≥ 44 px, Touch-Ziehen über das Chrome-Protokoll), alle grün. Regression: Unit 347/347, PROJ-32 „Eingabe“ 5/5.

## QA Test Results

**Tested:** 2026-10-29
**App URL:** http://localhost:3000 (Produktions-Build gegen Supabase „apppa-dev“; Safari gegen `npm run dev`)
**Tester:** QA Engineer (AI)
**E2E:** `tests/PROJ-34-preispositionen-ordnen.spec.ts`, 14 Tests (12 Desktop, 1 Handy/Tablet, 1 Sicherheit)

### Acceptance Criteria Status

#### Darstellung im Formular
- [x] Griff links an jeder Zusatzposition ab zwei Positionen
- [x] Keine oder eine Position: kein Griff
- [x] Übernachtungspreis steht über allen Zusatzpositionen, ohne Griff
- [x] Neue Position erscheint unten als letzte

#### Verschieben mit Maus und Touch
- [x] „Rabatt“ über „Reinigung“ gezogen → „Rabatt“, „Reinigung“, „Endreinigung Haustier“
- [x] Touch: Griff mit dem Finger ziehen verschiebt, die Seite scrollt nicht (Handy 375 px und Tablet 768 px, Touch über das Chrome-Protokoll)
- [x] Landeplatz sichtbar (Zeilen rücken auseinander, gezogene Zeile mit Rahmen und Schatten)
- [x] Über dem Übernachtungspreis losgelassen → erste Zusatzposition

#### Verschieben mit der Tastatur
- [x] Leertaste, Pfeil nach oben/unten, Leertaste → neue Stelle
- [x] Escape während des Verschiebens → zurück an die ursprüngliche Stelle, Panel bleibt offen
- [x] Screenreader-Ansage „… auf Position x von y“, „… abgelegt auf Position …“, „Verschieben abgebrochen …“
- [x] Griff mit Tab erreichbar (direkt vor der Bezeichnung), Fokusrahmen sichtbar, Name „<Bezeichnung> verschieben“

#### Speichern und Anzeige
- [x] Nach „Speichern“ zeigt das Detail die neue Reihenfolge unter der Übernachtung (Datenbank: Positionen 1, 2, 3)
- [x] „Bearbeiten“ öffnet die gespeicherte Reihenfolge
- [x] Schließen ohne Speichern behält die bisherige Reihenfolge
- [x] Endbetrag nach dem Umsortieren unverändert
- [x] Gelöschte Position: die übrigen behalten ihre Reihenfolge ohne Lücke

#### Fehler und Rollen
- [x] Fehlermeldung (fehlende Bezeichnung) wandert mit der Position
- [x] Mitarbeiter speichert: Reihenfolge unverändert, kein Griff sichtbar
- [x] Bestehende Buchungen zeigen die Eingabereihenfolge (Positionsnummern seit PROJ-8, keine Migration)

### Edge Cases Status
- [x] Nur eine Zusatzposition: kein Griff
- [x] 20 Positionen: letzte per Tastatur an Stelle 1, gespeichert lückenlos 1–20, kein „Position hinzufügen“
- [x] Ganz nach oben gezogen: landet unter der Übernachtung
- [x] Escape während des Ziehens mit der Maus: zurück, Panel bleibt offen
- [x] BUG-1 (gewollt): Maus außerhalb des Bereichs losgelassen → Position landet am nächstgelegenen Ende der Liste; Spec-Randfall angepasst
- [x] Leere/fehlerhafte Position verschiebbar; Griffname „Position n verschieben“, Meldung wandert mit
- [x] Gleichzeitige Bearbeitung: „Diese Buchung wurde inzwischen von jemand anderem geändert.“, Reihenfolge in der Datenbank unverändert
- [x] 375 px: kein seitliches Scrollen, Griff 44 × 44 px; 768 px ebenso
- [x] Negative Beträge: Betrag wandert mit („-50,00“), gespeichert -5000 an neuer Stelle

### Cross-Browser / Responsive
- [x] Chrome Desktop 1440 px: 12/12
- [x] Firefox Desktop: 12/12
- [x] Safari (WebKit) Desktop: 12/12; ein einmaliger Fehlschlag im ersten Test auf dem kalten Entwicklungsserver, danach 3/3 bei Wiederholung (kein App-Fehler)
- [x] Handy 375 px und Tablet 768 px (Touch): je 1/1

### Security Audit Results
- [x] Keine neuen Endpunkte, keine Datenbank-Änderung; gespeichert wird über die bestehende Speicherfunktion (Mandanten-RLS unverändert)
- [x] Rollen: Beträge und Positionen setzt der Server nur für Inhaber; Mitarbeiter-Speichern lässt die Reihenfolge unangetastet (E2E bestätigt)
- [x] XSS: Bezeichnung `<img src=x onerror=…>` erscheint im Griffnamen und in der Screenreader-Ansage nur als Text, kein Skript ausgeführt (E2E)
- [x] Keine Geheimnisse oder neuen Daten im Browser; neue Pakete nur @dnd-kit (Frontend)
- [x] Rate Limiting: keine neuen Anfragen (Sortieren ist rein lokal bis zum Speichern)

### Regression
- [x] Vitest komplett: 470/470 (Unit + Integration)
- [x] PROJ-32 Desktop 10/10, PROJ-27 Desktop 9/9
- [x] PROJ-8: „Konflikte“, „Optionen und Stornieren“, „Liste“, „Layout“, „Zugang“, „Anschluss“, „Mitarbeiter“, „Bearbeiten“ grün
- [x] Detail-Panel-Escape in anderen Bereichen (PROJ-6 Wohnungen, PROJ-9 Belegung): grün
- [x] PROJ-8 „Buchung anlegen“: 2 Fehlschläge, beide **nicht durch PROJ-34** verursacht (BUG-2, BUG-3; Gegenprobe mit zurückgenommenen PROJ-34-Änderungen); beide behoben, Gruppe 5/5 grün

### Unit Tests
Keine neuen Unit-Tests: Die Logik (Umsortieren, Ansagen) steckt in der Komponente und hängt an Browser-Layout und @dnd-kit; sie ist durch die E2E-Tests in drei Browsern abgedeckt.

### Bugs Found

#### BUG-1: Loslassen außerhalb der Liste ordnet um statt abzubrechen
- **Status:** Gewollt (Entscheidung 2026-10-29); Spec-Randfall und Decision Log angepasst
- **Severity:** Low
- **Steps to Reproduce:**
  1. Buchung mit „Reinigung“, „Endreinigung Haustier“, „Rabatt“ bearbeiten
  2. „Reinigung“ am Griff fassen und weit unter die Liste ziehen (z. B. über das Feld „Notiz“), loslassen
  3. Expected (Spec, Edge Case „Ziehen abgebrochen“): Position kehrt an ihre Stelle zurück
  4. Actual: Reihenfolge „Endreinigung Haustier“, „Rabatt“, „Reinigung“; Ansage „Reinigung abgelegt auf Position 3 von 3.“
- **Ursache:** Die Bewegung ist auf die Liste begrenzt (Tech Design), dadurch zählt jedes Loslassen als Ablegen am nächstgelegenen Ende. Das AC „über der Übernachtung losgelassen → erste Zusatzposition“ beruht auf demselben Verhalten
- **Workaround:** Escape vor dem Loslassen oder Position zurückziehen; Schließen ohne Speichern verwirft
- **Priority:** Nice to have. Entweder den Spec-Randfall an das Verhalten anpassen (Produktentscheidung) oder unten wie oben behandeln (nur beim Loslassen weit außerhalb der Liste abbrechen)

#### BUG-2: Nach „Neue Buchung“ öffnet sich manchmal die Detailseite nicht (vorbestehend, PROJ-8)
- **Status:** Behoben (2026-10-29), siehe unten
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Buchungen → „Neue Buchung“, alle Pflichtfelder ausfüllen, „Buchung speichern“
  2. Expected: Detailseite der neuen Buchung öffnet sich
  3. Actual: in etwa 2 von 5 Läufen erscheinen die Meldung „Buchung angelegt.“ und das geschlossene Panel, die Liste bleibt stehen (auch nach 20 s). Die Buchung ist gespeichert
- **Nachweis:** Mit zurückgenommenen PROJ-34-Änderungen ebenfalls 2/5 → nicht durch PROJ-34 verursacht. Betrifft den E2E-Test PROJ-8 „Zeiten und Reinigung … gespeichert mit nächster Nummer“
- **Vermutung:** `router.push` direkt nach dem Schließen des Panels geht verloren (Navigation konkurriert mit Schließen/Refresh)
- **Priority:** Fix in next sprint (eigener Fix außerhalb von PROJ-34)

#### BUG-3: Veralteter E2E-Test in PROJ-8 erwartet Ablehnung negativer Zusatzkosten
- **Status:** Behoben (2026-10-29): Test gibt jetzt „5-“ ein (ungültig) statt „-5“
- **Severity:** Low (Testschuld)
- **Steps to Reproduce:** `tests/PROJ-8-manuelle-buchungen.spec.ts` „Pflichtfelder, Zeitraum, …“: erwartet bei „-5“ die Meldung „Bitte einen Betrag wie 125 oder 125,50 eingeben.“
- **Actual:** Seit PROJ-32 sind negative Zusatzkosten erlaubt; die Meldung erscheint korrekt nicht
- **Priority:** Test an PROJ-32 anpassen (eigener Fix außerhalb von PROJ-34)

### Behebung (2026-10-29)
- **BUG-2, Ursache:** Next.js 16 gibt das Ergebnis einer Server-Aktion an den Aufrufer zurück, bevor es die mitgelieferte, neu geladene Seite (durch `revalidatePath`) einarbeitet. Das anschließende `router.push` verwarf die Aktion; die danach nachgeholte Aktualisierung lief mit veraltetem Stand und überschrieb in etwa 2 von 5 Fällen die Navigation (Nachweis: kein `pushState`, nur `replaceState /buchungen`)
- **BUG-2, Fix:** `saveBooking`/`saveBlock` erhalten `open`; nach dem Anlegen leitet die Aktion selbst mit `redirect()` zur Detailseite weiter, Next.js wendet Aktualisierung und Navigation in einem Schritt an. `callAction` erkennt die Weiterleitung (`digest` „NEXT_REDIRECT;…“) und meldet Erfolg mit `redirectTo` statt „network“; die Panels erneuern nur noch ohne Weiterleitung. Belegungskalender (`afterCreate: 'refresh'`) unverändert
- **Nachweis:** PROJ-8 „Buchung anlegen … gespeichert mit nächster Nummer“ 10/10 (vorher 3/5); „Buchung anlegen“ 5/5; Sperre anlegen (PROJ-8, PROJ-30), Anlegen per Klick im Kalender (PROJ-9) grün; Unit-Test `src/components/auth/form-error.test.ts` (5 Fälle); Vitest 475/475; PROJ-34 Kontrolllauf grün
- **Gleiches Muster, nicht geändert:** Gast anlegen (`guest-panel.tsx`), Kunde anlegen (`create-tenant-panel.tsx`), Gäste zusammenführen (`merge-dialog.tsx`) rufen ebenfalls `router.push` nach einer Aktion auf; dort ist bisher kein Fehler beobachtet, das Risiko ist dasselbe

### Summary
- **Acceptance Criteria:** 20/20 passed
- **Edge Cases:** 10/10 (BUG-1 als gewollt entschieden)
- **Bugs Found:** 3 total (0 critical, 0 high, 1 medium, 2 low). PROJ-34 selbst: 1 low (gewollt); BUG-2 und BUG-3 vorbestehend aus PROJ-8/PROJ-32, beide behoben
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy (mit dem Fix für BUG-2)

## Deployment
- **Datum:** 2026-10-29, Version v1.11.0
- **Commit:** `dc86941` (Branches `staging` und `production`)
- **Staging:** https://staging.apppa.at (geprüft vom Nutzer)
- **Production:** https://app.apppa.at
- **Migrationen:** keine (Reihenfolge nutzt die bestehende Spalte `booking_charges.position`)
- **Neue Pakete:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`
- **Mit ausgeliefert:** Fix für PROJ-8 „Detailseite nach dem Anlegen öffnet sich zuverlässig“ (`19dd794`, QA BUG-2) und angepasster PROJ-8-Test (QA BUG-3)
