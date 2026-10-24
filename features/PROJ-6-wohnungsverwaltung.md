# PROJ-6: Wohnungsverwaltung

## Status: Planned
**Created:** 2026-10-24
**Last Updated:** 2026-10-24

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup): Abschottung je Kunde, Standardfelder und Änderungsprotokoll für Fachtabellen
- Requires: PROJ-4 (Kundenkonten & Rollen): Rollen Inhaber/Mitarbeiter, Bereich „Einstellungen“ nur für Inhaber
- Nutzt: PROJ-2 (App-Shell): Einstellungs-Reiter, Detail-Panel, Leerzustände
- Grundlage für:
  - PROJ-8 (Buchungen: Wohnung wählen, Preisvorschlag, Personenzahl, Check-in/-out)
  - PROJ-9 (Belegungskalender: Zeilen und Farben)
  - PROJ-10 (Channex: Wohnung ↔ Listing)
  - PROJ-15/16 (Abgaberegeln und -berechnung je Gemeinde)
  - PROJ-18 (Auswertungen nach Wohnung bzw. Objekt)

## User Stories
- Als **Inhaber** möchte ich meine Objekte (z. B. „Haus Seeblick“) mit Adresse und Gemeinde anlegen, damit ich die Adresse nicht für jede Wohnung neu eingeben muss.
- Als **Inhaber** möchte ich Wohnungen mit Name, Personenzahl, Art, Standardpreis, Check-in/-out-Zeiten, Kalenderfarbe und Notizen erfassen, damit Buchungen und Kalender diese Angaben verwenden.
- Als **Inhaber** möchte ich die Gemeinde aus einer Liste aller österreichischen Gemeinden wählen, damit die Tourismusabgabe später der richtigen Gemeinde zugeordnet wird.
- Als **Inhaber** möchte ich eine Wohnung, die ich nicht mehr vermiete, archivieren, damit sie aus Auswahl und Kalender verschwindet, ihre Buchungen aber erhalten bleiben.
- Als **Inhaber** möchte ich eine irrtümlich angelegte Wohnung ohne Buchungen endgültig löschen können, damit meine Liste sauber bleibt.
- Als **Inhaber mit mehreren Häusern** möchte ich gleich benannte Wohnungen (z. B. „Top 1“) in verschiedenen Objekten haben, damit ich die gewohnten Bezeichnungen behalten kann.

## Umfang dieses Features
- **Einstellungen → Wohnungen** (nur Inhaber): Liste aller Wohnungen, gruppiert nach Objekt. Archivierte nur auf Wunsch („Archivierte anzeigen“).
- **Objekt**: Name, Adresse (Straße und Hausnummer, PLZ, Ort), Gemeinde aus der Liste der österreichischen Gemeinden. Bearbeiten wirkt auf alle Wohnungen des Objekts.
- **Wohnung**:
  - Pflichtangaben: Objekt, Name (eindeutig innerhalb des Objekts), maximale Personenzahl.
  - Zusatzangaben: Art (Ferienwohnung oder Dienstwohnung), Standardpreis pro Nacht in Euro, übliche Check-in- und Check-out-Zeit, Kalenderfarbe, Notiz.
- **Anlegen einer Wohnung**: bestehendes Objekt wählen oder im selben Formular ein neues Objekt mit Adresse und Gemeinde anlegen.
- **Gemeindeauswahl**: Suche nach Gemeindename oder PLZ; aus der eingegebenen PLZ werden passende Gemeinden vorgeschlagen.
- **Anzeige überall**: „Objekt · Wohnung“, z. B. „Haus Seeblick · Top 1“.
- **Archivieren und Wiederherstellen** von Wohnungen; **endgültig löschen** nur, solange die Wohnung nie eine Buchung hatte.
- **Objekt löschen**: nur, wenn ihm keine Wohnung (auch keine archivierte) mehr zugeordnet ist.

## Out of Scope
- Eigener Menüpunkt bzw. Leseansicht für Mitarbeiter: Mitarbeiter sehen Wohnungen nur in Kalender und Buchungen (PROJ-8/9)
- Verknüpfung mit booking.com-/Airbnb-Listings bzw. Plattform-Konten → PROJ-10
- Abgaberegeln je Gemeinde (Sätze, Befreiungen, Vorlagen je Bundesland) → PROJ-15
- Preise je Saison, Wochentag oder Aufenthaltsdauer; Mindestaufenthalt → später, eigenes Feature
- Ausführliche Objektdaten (Schlafzimmer, Betten, Fläche, Ausstattung), Fotos, Beschreibungstexte für Inserate → nicht geplant
- Gemeinden außerhalb Österreichs → nicht geplant (PRD: Österreich)
- Import von Wohnungen aus Channex bzw. CSV → mit PROJ-10 bzw. später
- Begrenzung der Anzahl Wohnungen je Kunde bzw. Abrechnung je Wohnung → außerhalb der App (PRD)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugang
- [ ] Angenommen ein Inhaber ist angemeldet, wenn er „Einstellungen“ öffnet, dann gibt es neben „Team“ und „Kunde“ den Reiter „Wohnungen“
- [ ] Angenommen ein Mitarbeiter ist angemeldet, wenn er die Wohnungsseite direkt aufruft, dann erscheint „Seite nicht gefunden“
- [ ] Angenommen ein Inhaber von Kunde A, wenn er Objekte oder Wohnungen anlegt, ändert oder liest, dann betrifft das nur Kunde A; Daten anderer Kunden sind weder sichtbar noch änderbar

### Liste
- [ ] Angenommen es gibt Wohnungen, wenn der Inhaber die Seite öffnet, dann sieht er die Wohnungen gruppiert nach Objekt (Objekte und Wohnungen alphabetisch), je Wohnung Name, Art, Personenzahl, Standardpreis und Kalenderfarbe, je Objekt Adresse und Gemeinde
- [ ] Angenommen es gibt noch keine Wohnung, wenn der Inhaber die Seite öffnet, dann erscheint ein Leerzustand mit Erklärung und dem Knopf „Wohnung anlegen“
- [ ] Angenommen es gibt archivierte Wohnungen, wenn der Inhaber „Archivierte anzeigen“ wählt, dann erscheinen sie gekennzeichnet als „archiviert“ in der Liste; sonst sind sie ausgeblendet
- [ ] Angenommen die Seite wird auf dem Handy geöffnet, wenn sie angezeigt wird, dann sind die Wohnungen als Karten je Objekt ohne seitliches Scrollen lesbar

### Wohnung anlegen
- [ ] Angenommen der Inhaber wählt „Wohnung anlegen“, wenn er ein bestehendes Objekt wählt und Name und Personenzahl eingibt, dann wird die Wohnung angelegt und erscheint unter dem Objekt
- [ ] Angenommen es gibt noch kein passendes Objekt, wenn der Inhaber im Formular „Neues Objekt“ wählt und Objektname, Adresse und Gemeinde angibt, dann werden Objekt und Wohnung in einem Schritt angelegt
- [ ] Angenommen der Kunde hat noch kein Objekt, wenn der Inhaber die erste Wohnung anlegt, dann ist „Neues Objekt“ bereits ausgewählt
- [ ] Angenommen Pflichtangaben fehlen oder sind ungültig, wenn der Inhaber speichert, dann erscheint je Feld eine Meldung, und es wird nichts angelegt
- [ ] Angenommen der Inhaber gibt keine Zusatzangaben ein, wenn er speichert, dann gelten Standardwerte: Art „Ferienwohnung“, Check-in 15:00, Check-out 10:00, eine noch ungenutzte Kalenderfarbe; Preis und Notiz bleiben leer
- [ ] Angenommen im Objekt gibt es bereits eine Wohnung gleichen Namens (auch archiviert, ohne Unterschied von Groß- und Kleinschreibung), wenn der Inhaber speichert, dann erscheint „In diesem Objekt gibt es schon eine Wohnung mit diesem Namen“
- [ ] Angenommen eine Wohnung gleichen Namens existiert in einem anderen Objekt, wenn der Inhaber speichert, dann wird die Wohnung angelegt

### Gemeinde wählen
- [ ] Angenommen der Inhaber tippt mindestens zwei Zeichen eines Gemeindenamens, wenn er sucht, dann erscheinen passende österreichische Gemeinden mit Bundesland (auch „St.“/„Sankt“ und Umlaute werden gefunden)
- [ ] Angenommen der Inhaber hat eine PLZ eingegeben, wenn er die Gemeindeauswahl öffnet, dann werden zuerst die Gemeinden vorgeschlagen, zu denen diese PLZ gehört
- [ ] Angenommen eine PLZ gehört zu mehreren Gemeinden, wenn sie vorgeschlagen werden, dann muss der Inhaber eine davon auswählen; es wird keine automatisch gesetzt
- [ ] Angenommen der Inhaber gibt einen Gemeindenamen ein, der nicht in der Liste steht, wenn er speichern will, dann ist das nicht möglich, und es erscheint „Bitte eine Gemeinde aus der Liste wählen“

### Bearbeiten
- [ ] Angenommen eine Wohnung existiert, wenn der Inhaber sie öffnet und Angaben ändert, dann werden die Änderungen gespeichert und sofort überall angezeigt
- [ ] Angenommen der Inhaber ändert Adresse oder Gemeinde eines Objekts, wenn er speichert, dann gilt die Änderung für alle Wohnungen des Objekts, und ein Hinweis nennt die Anzahl betroffener Wohnungen
- [ ] Angenommen der Inhaber verschiebt eine Wohnung in ein anderes Objekt, wenn dort bereits eine Wohnung gleichen Namens existiert, dann wird das abgewiesen
- [ ] Angenommen ein Objekt oder eine Wohnung wird geändert, wenn die Aktion abgeschlossen ist, dann steht die Änderung mit Person und Zeitpunkt im Änderungsprotokoll (PROJ-1)

### Archivieren, Wiederherstellen, Löschen
- [ ] Angenommen eine Wohnung ist aktiv, wenn der Inhaber „Archivieren“ wählt und bestätigt, dann ist sie als „archiviert“ gekennzeichnet, steht nicht mehr zur Auswahl für neue Buchungen und erscheint nicht im Kalender; ihre Daten bleiben erhalten
- [ ] Angenommen eine Wohnung ist archiviert, wenn der Inhaber „Wiederherstellen“ wählt, dann ist sie wieder aktiv
- [ ] Angenommen eine Wohnung hatte nie eine Buchung, wenn der Inhaber „Endgültig löschen“ wählt und bestätigt, dann ist sie entfernt
- [ ] Angenommen eine Wohnung hat oder hatte Buchungen, wenn der Inhaber sie öffnet, dann gibt es kein „Endgültig löschen“, sondern einen Hinweis, sie zu archivieren
- [ ] Angenommen einem Objekt ist keine Wohnung mehr zugeordnet, wenn der Inhaber „Objekt löschen“ wählt und bestätigt, dann ist das Objekt entfernt
- [ ] Angenommen einem Objekt sind noch Wohnungen zugeordnet (auch archivierte), wenn der Inhaber das Objekt öffnet, dann gibt es kein „Objekt löschen“, sondern einen Hinweis darauf

## Edge Cases
- **Letzte aktive Wohnung archivieren:** erlaubt. Die Liste zeigt dann den Leerzustand mit Hinweis auf archivierte Wohnungen.
- **Objekt ohne aktive Wohnung:** Es bleibt in der Liste, solange archivierte Wohnungen darunter hängen, aber nur bei „Archivierte anzeigen“.
- **Gemeinde eines Objekts nachträglich ändern:** Künftige Abgabeberechnungen verwenden die neue Gemeinde. Ob bereits berechnete bzw. gemeldete Abgaben unverändert bleiben, regelt PROJ-16; die Änderung steht im Änderungsprotokoll.
- **Personenzahl verringern, obwohl künftige Buchungen mehr Personen haben:** In PROJ-6 erlaubt; die Konfliktprüfung bzw. ein Hinweis folgt mit PROJ-8.
- **Wohnung archivieren, die künftige Buchungen hat:** erst ab PROJ-8 relevant. Dann erscheint ein Hinweis mit der Anzahl künftiger Buchungen, die bestehen bleiben.
- **Wohnung ist mit Channex verbunden (ab PROJ-10):** Archivieren bzw. Löschen trennt oder pausiert die Verbindung; das regelt PROJ-10.
- **Gemeindezusammenlegungen und Umbenennungen** (z. B. Gemeindestrukturreform): Die Liste muss aktualisierbar sein. Bestehende Zuordnungen bleiben gültig oder werden auf die Nachfolgegemeinde übertragen (siehe Open Questions).
- **Zwei Inhaber bearbeiten gleichzeitig dieselbe Wohnung:** Die zuletzt gespeicherte Änderung gilt; beide Änderungen stehen im Änderungsprotokoll.
- **Sehr viele Wohnungen (z. B. 80 in 10 Objekten):** Die Liste bleibt mit Gruppierung bedienbar, ohne seitenweise Anzeige.
- **Name mit Leerzeichen am Rand oder nur Groß-/Kleinschreibung anders:** Leerzeichen werden entfernt; „top 1“ und „Top 1“ gelten im selben Objekt als gleich.
- **Kunde deaktiviert (PROJ-5):** kein Zugriff; die Daten bleiben erhalten.

## Technical Requirements
- Sicherheit: Abschottung je Kunde in der Datenbank (Muster aus PROJ-1); Schreiben nur für Inhaber, Lesen für alle Mitglieder (Mitarbeiter brauchen die Wohnungen in Kalender und Buchungen)
- Nachvollziehbarkeit: Standardfelder und Änderungsprotokoll für Objekte und Wohnungen (PROJ-1)
- Gemeindeliste: amtliches Gemeindeverzeichnis von Statistik Austria (Gemeindekennziffer, Name, Bundesland, PLZ-Zuordnung), für alle Kunden gemeinsam, nur lesbar
- Validierung:
  - Personenzahl 1–50;
  - Preis 0–10.000 € mit zwei Nachkommastellen;
  - Zeiten im Format hh:mm;
  - Namen 1–100 Zeichen;
  - Notiz bis 2.000 Zeichen;
  - PLZ vierstellig.
- Performance: Gemeindesuche mit Ergebnissen in < 300 ms
- Responsiv: Desktop, Tablet und Handy

## Open Questions
- [ ] Quelle und Aktualisierung der Gemeindeliste: Wer spielt Änderungen von Statistik Austria ein und wie oft? Was passiert mit Objekten in zusammengelegten Gemeinden? Vorschlag: einmal jährlich per Runbook, mit Übertragung auf die Nachfolgegemeinde.
- [ ] Ist die Art „Dienstwohnung“ für die Ortstaxe relevant (Befreiung bei längerem Aufenthalt bzw. bei Arbeitnehmern)? Klärung in PROJ-15.
- [ ] Kalenderfarben: feste Palette aus dem Design-System (Vorschlag: 8 Farben) statt freier Farbwahl. Klärung in /architecture bzw. /frontend.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Wohnungen unter „Einstellungen → Wohnungen“, nur für Inhaber | Stammdaten ändern sich selten; schlanke Hauptnavigation wie im Entwurf (offene Frage aus PROJ-2 damit geklärt) | 2026-10-24 |
| Pflichtfelder plus Art, Standardpreis, Check-in/-out, Kalenderfarbe, Notiz | Werden von Buchungen (Preisvorschlag, Zeiten) und Kalender (Farbe) genutzt; ausführliche Objektdaten wertet nichts aus | 2026-10-24 |
| Gemeinde aus hinterlegter Liste aller österreichischen Gemeinden, Suche und PLZ-Vorschlag | Eindeutige Zuordnung für die Abgaberegeln (PROJ-15); keine Schreibvarianten | 2026-10-24 |
| Archivieren statt Löschen; endgültig löschen nur ohne Buchungen | Buchungen, Zahlungen und Abgabemeldungen müssen nachvollziehbar bleiben | 2026-10-24 |
| Eigene Objekte mit Adresse und Gemeinde, Wohnungen darunter | Mehrere Wohnungen in einem Haus ohne Mehrfacherfassung; Gruppierung in Liste, Kalender, Auswertungen | 2026-10-24 |
| Jede Wohnung gehört zu genau einem Objekt; Objekt kann beim Anlegen der Wohnung mit angelegt werden | Ein einheitliches Modell; für Einzelwohnungen trotzdem nur ein Formular | 2026-10-24 |
| Wohnungsnamen eindeutig innerhalb des Objekts; Anzeige „Objekt · Wohnung“ | Gewohnte Bezeichnungen wie „Top 1“ je Haus bleiben möglich | 2026-10-24 |
| Objekt löschen nur ohne zugeordnete Wohnungen | Keine verwaisten Wohnungen; archivierte Wohnungen brauchen weiter ihre Adresse und Gemeinde | 2026-10-24 |
| Standardwerte: Ferienwohnung, Check-in 15:00, Check-out 10:00, ungenutzte Kalenderfarbe | Schnelles Anlegen; übliche Zeiten in Österreich | 2026-10-24 |
| Mitarbeiter dürfen Wohnungen lesen (nicht bearbeiten), aber ohne eigene Seite | Kalender und Buchungen brauchen Wohnungsdaten | 2026-10-24 |

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
