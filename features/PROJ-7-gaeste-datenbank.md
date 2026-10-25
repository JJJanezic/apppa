# PROJ-7: Gäste-Datenbank

## Status: Planned
**Created:** 2026-10-26
**Last Updated:** 2026-10-26

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup): Mandanten-Abschottung, Änderungsprotokoll
- Requires: PROJ-4 (Kundenkonten & Rollen): Rollen Inhaber/Mitarbeiter, gewählter Kunde
- Requires: PROJ-2 (App-Shell): Navigationspunkt „Gäste“
- Wird genutzt von: PROJ-8 (Gast beim Buchen wählen oder neu anlegen; Mitreisende), PROJ-11 (Gäste aus Channex anlegen bzw. zuordnen), PROJ-18 (Gästeherkunft), PROJ-19 (Einwilligung, Segmente, Export)

## Überblick
Die Gäste-Datenbank verwaltet die **Hauptgäste** eines Kunden (Vermieters), also die buchende Person mit Kontakt, Herkunft und Marketing-Quelle. Optional trägt ein Gast eine Firma (Dienstwohnungen). Inhaber pflegen die Daten, führen Dubletten zusammen und löschen bzw. anonymisieren Gäste. Mitarbeiter sehen die Gäste nur. Neue Gäste können sie lediglich beim Anlegen einer Buchung (PROJ-8) erfassen.

## User Stories
- Als **Inhaber** möchte ich alle meine Gäste an einem Ort mit Kontakt, Herkunft und Firma sehen, damit ich Gästedaten nicht mehr aus Plattform-Postfächern, Excel und E-Mails zusammensuchen muss.
- Als **Inhaber** möchte ich einen Gast schnell mit Nachname und Herkunftsland anlegen und später ergänzen können, damit eine Erfassung am Telefon oder beim Check-in nicht aufhält.
- Als **Inhaber** möchte ich festhalten, wie ein Gast erstmals zu uns kam (z. B. Instagram, Empfehlung), damit ich später sehe, welche Marketing-Kanäle wirken.
- Als **Inhaber** möchte ich doppelte Einträge desselben Gastes erkennen und zusammenführen, damit Stammgäste mit allen Aufenthalten als ein Gast erscheinen.
- Als **Inhaber** möchte ich einen Gast auf Wunsch löschen bzw. anonymisieren, damit ich DSGVO-Löschanfragen erfüllen kann, ohne die für Abgabe und Steuer nötigen Buchungen zu verlieren.
- Als **Mitarbeiter** möchte ich Gäste suchen und ihre Daten ansehen, damit ich beim Check-in oder bei Rückfragen schnell Telefonnummer und Aufenthalte finde.
- Als **Inhaber** möchte ich bei Firmengästen Firmenname, UID-Nummer und Rechnungsadresse hinterlegen, damit Dienstwohnungs-Buchungen der richtigen Firma zugeordnet sind.

## Umfang

### Angaben eines Gastes
| Angabe | Pflicht | Hinweis |
|---|---|---|
| Nachname | ja | |
| Herkunftsland | ja | Wohnsitzland, Auswahl aus der Länderliste (deutsche Namen). Häufige Länder (Österreich, Deutschland, Schweiz, Italien …) stehen oben. **Keine Vorauswahl**, damit die Statistik nicht verfälscht wird |
| Vorname | nein | |
| E-Mail | nein | Format wird geprüft |
| Telefon | nein | frei, mit Ländervorwahl empfohlen |
| Adresse | nein | Straße, PLZ, Ort, Land der Adresse |
| Sprache | nein | Korrespondenzsprache (Deutsch, Englisch, Italienisch, …) |
| Geburtsdatum | nein | darf nicht in der Zukunft liegen |
| Marketing-Quelle | nein | „Wie kam der Gast erstmals zu uns?“: Auswahl aus der Standardliste (Website, Instagram, Google Ads, Newsletter, Empfehlung, Plattform-Suche) **oder** eigener Freitext (max. 100 Zeichen), z. B. „Messe Graz 2026“ |
| Firma | nein | Firmenname, UID-Nummer, Rechnungsadresse (falls abweichend) |
| Notiz | nein | interner Freitext, max. 2.000 Zeichen |

Zusätzlich zeigt die App, ohne dass man es eingeben kann:
- **Aufenthalte:** Anzahl, letzter und nächster Aufenthalt, sobald es Buchungen gibt (PROJ-8)
- **Buchungsplattformen:** über welche Kanäle der Gast schon gebucht hat (aus den Buchungen)
- **Herkunft der Kontaktdaten:** „direkt erfasst“ bzw. „von Plattform übernommen“ (setzt PROJ-11). Plattform-Adressen von booking.com und Airbnb sind als solche erkennbar, weil sie nicht für Werbung genutzt werden dürfen (PRD, PROJ-19)

### Bereiche
- **Gästeliste** (Navigationspunkt „Gäste“): Suche nach Name, Firma, E-Mail und Telefon; Filter nach Herkunftsland und Marketing-Quelle. Spalten Name (mit Firma), Herkunft, Aufenthalte, letzter Aufenthalt. Sortierung nach Name oder letztem Aufenthalt. Seitenweise ab 50 Einträgen
- **Gast-Detail:** Stammdaten, Aufenthalte (bis PROJ-8 leer) und Aktionen je nach Rolle
- **Gast anlegen / bearbeiten:** Formular (nur Inhaber; Mitarbeiter legen Gäste nur im Buchungsformular von PROJ-8 an)
- **Mögliche Dubletten:** Vorschlagsliste und Zusammenführen (nur Inhaber)

### Rollen
| Aktion | Inhaber | Mitarbeiter |
|---|---|---|
| Gäste suchen und ansehen | ✓ | ✓ |
| Gast in der Gäste-Datenbank anlegen | ✓ | – |
| Gast beim Anlegen einer Buchung neu erfassen (PROJ-8) | ✓ | ✓ |
| Gast bearbeiten | ✓ | – |
| Dubletten zusammenführen | ✓ | – |
| Gast löschen / anonymisieren | ✓ | – |

Der Betreiber-Admin sieht Gästedaten von Kunden nicht über diese Bereiche. Gästedaten sind Kundendaten.

## Out of Scope
- **Mitreisende:** Sie werden je Buchung in PROJ-8 erfasst, nicht dauerhaft beim Gast gespeichert und nicht wiederverwendet
- **Meldewesen / Gästeblatt** (gesetzliche Meldedaten aller Gäste): eigenes Feature PROJ-26, kommt vor dem Pilot. Es baut auf Hauptgast (PROJ-7) und Mitreisenden (PROJ-8) auf
- **Buchungsplattform als Angabe am Gast:** Sie hängt an jeder Buchung (PROJ-8, PROJ-11). Der Gast zeigt sie nur an
- **DSGVO-Einwilligung für Marketing, Segmente, CSV-Export:** PROJ-19
- **Statistik nach Herkunft und Marketing-Quelle:** PROJ-18
- **Automatisches Anlegen und Zuordnen von Gästen aus booking.com/Airbnb:** PROJ-11
- **Automatisches Zusammenführen ohne Rückfrage:** bewusst nicht vorgesehen
- **E-Mails an Gäste:** PROJ-22 (P2)
- **Import von Gästelisten (Excel/CSV):** nicht vorgesehen (vom Nutzer entschieden)
- **Mehrere Firmen je Gast, Firmen als eigene Einträge:** nicht vorgesehen (Firma ist eine Zusatzangabe am Gast)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Gästeliste
- [ ] Angenommen der Kunde hat noch keine Gäste, wenn ein Inhaber „Gäste“ öffnet, dann sieht er einen leeren Zustand mit Erklärung und dem Knopf „Gast anlegen“
- [ ] Angenommen der Kunde hat noch keine Gäste, wenn ein Mitarbeiter „Gäste“ öffnet, dann sieht er den leeren Zustand mit dem Hinweis, dass Gäste beim Anlegen von Buchungen entstehen, ohne Knopf „Gast anlegen“
- [ ] Angenommen es gibt Gäste, wenn der Nutzer „Gäste“ öffnet, dann sieht er die Liste mit Name (und Firma), Herkunft, Anzahl Aufenthalte und letztem Aufenthalt, alphabetisch nach Nachname sortiert
- [ ] Angenommen es gibt Gäste, wenn der Nutzer einen Suchbegriff eingibt, dann zeigt die Liste nur Gäste, deren Name, Firma, E-Mail oder Telefon den Begriff enthält (Groß-/Kleinschreibung und Umlaute egal)
- [ ] Angenommen die Suche findet nichts, wenn die Liste leer bleibt, dann erscheint „Keine Gäste gefunden“ mit der Möglichkeit, die Suche zurückzusetzen
- [ ] Angenommen es gibt Gäste aus mehreren Ländern, wenn der Nutzer nach Herkunftsland oder Marketing-Quelle filtert, dann zeigt die Liste nur passende Gäste; Suche und Filter wirken zusammen
- [ ] Angenommen Gäste haben eine eigene (Freitext-)Marketing-Quelle, wenn der Nutzer den Filter Marketing-Quelle öffnet, dann bietet er die Standardwerte, „Eigene Angabe“ (alle Freitexte) und „Keine Angabe“ an
- [ ] Angenommen es gibt mehr als 50 passende Gäste, wenn die Liste angezeigt wird, dann ist sie seitenweise zu je 50 Einträgen blätterbar
- [ ] Angenommen der Nutzer gehört zu Kunde A, wenn er die Gästeliste öffnet, dann sieht er ausschließlich Gäste von Kunde A, auch bei direktem Aufruf einer fremden Gast-Adresse

### Gast anlegen und bearbeiten (Inhaber)
- [ ] Angenommen ein Inhaber öffnet „Gast anlegen“, wenn er nur Nachname und Herkunftsland ausfüllt und speichert, dann ist der Gast angelegt und seine Detailansicht erscheint
- [ ] Angenommen ein Inhaber lässt Nachname oder Herkunftsland leer, wenn er speichert, dann erscheint beim jeweiligen Feld eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen ein Inhaber gibt eine ungültige E-Mail-Adresse oder ein Geburtsdatum in der Zukunft ein, wenn er speichert, dann erscheint beim Feld eine Fehlermeldung
- [ ] Angenommen ein Inhaber legt einen Gast an, dessen E-Mail oder Telefonnummer oder Vor- und Nachname einem bestehenden Gast entspricht, wenn er speichert, dann weist die App auf den möglichen Doppeleintrag hin und bietet „Bestehenden Gast öffnen“ oder „Trotzdem anlegen“ an
- [ ] Angenommen ein Inhaber wählt bei der Marketing-Quelle „Eigene Angabe“, wenn er einen Freitext eingibt und speichert, dann wird dieser Text als Quelle angezeigt; ein leerer Freitext gilt als „Keine Angabe“
- [ ] Angenommen ein Inhaber erfasst eine Firma, wenn er speichert, dann erscheint der Firmenname in der Liste beim Gast und in der Detailansicht mit UID-Nummer und Rechnungsadresse
- [ ] Angenommen ein Inhaber bearbeitet einen Gast, wenn er speichert, dann sind die Änderungen sofort sichtbar und im Änderungsprotokoll mit Person und Zeitpunkt festgehalten
- [ ] Angenommen das Speichern schlägt fehl (z. B. keine Verbindung), wenn der Inhaber speichert, dann erscheint eine Fehlermeldung und seine Eingaben bleiben im Formular erhalten
- [ ] Angenommen zwei Inhaber bearbeiten denselben Gast gleichzeitig, wenn der zweite speichert, dann wird er darauf hingewiesen, dass der Gast inzwischen geändert wurde, und kann die aktuelle Fassung laden, ohne die Änderung des ersten unbemerkt zu überschreiben

### Gast-Detail
- [ ] Angenommen ein Gast hat noch keine Buchungen, wenn der Nutzer die Detailansicht öffnet, dann zeigt sie die Stammdaten und bei den Aufenthalten „Noch keine Aufenthalte“
- [ ] Angenommen Kontaktdaten stammen von booking.com oder Airbnb (PROJ-11), wenn der Nutzer die Detailansicht öffnet, dann sind sie als „von Plattform übernommen“ gekennzeichnet

### Rollen
- [ ] Angenommen ein Mitarbeiter öffnet die Gästeliste oder eine Detailansicht, wenn er die Seite betrachtet, dann gibt es keine Knöpfe zum Anlegen, Bearbeiten, Zusammenführen oder Löschen
- [ ] Angenommen ein Mitarbeiter versucht, einen Gast direkt (z. B. über die Adresse des Bearbeiten-Formulars) zu ändern, wenn er speichert, dann wird die Änderung abgelehnt
- [ ] Angenommen ein Mitarbeiter legt eine Buchung an (PROJ-8), wenn er dabei einen neuen Gast erfasst, dann wird der Gast mit denselben Pflichtfeldern angelegt

### Dubletten zusammenführen (Inhaber)
- [ ] Angenommen es gibt Gäste mit gleicher E-Mail, gleicher Telefonnummer oder gleichem Vor- und Nachnamen, wenn ein Inhaber „Mögliche Dubletten“ öffnet, dann sieht er diese Paare mit dem Grund des Vorschlags
- [ ] Angenommen ein Vorschlag ist kein echter Doppeleintrag, wenn der Inhaber „Kein Doppeleintrag“ wählt, dann erscheint dieses Paar nicht mehr in den Vorschlägen
- [ ] Angenommen ein Inhaber führt zwei Gäste zusammen, wenn er je Angabe den Wert eines der beiden wählt und bestätigt, dann bleibt ein Gast mit den gewählten Werten, alle Buchungen beider Gäste gehören diesem Gast, und der andere Eintrag ist entfernt
- [ ] Angenommen ein Inhaber will zwei Gäste zusammenführen, wenn er den Dialog öffnet, dann weist die App darauf hin, dass das Zusammenführen nicht rückgängig zu machen ist, und verlangt eine Bestätigung
- [ ] Angenommen zwei Gäste wurden zusammengeführt, wenn ein Inhaber das Änderungsprotokoll ansieht, dann ist das Zusammenführen mit beiden Gästen, Person und Zeitpunkt festgehalten
- [ ] Angenommen ein Inhaber wählt zweimal denselben Gast oder Gäste verschiedener Kunden, wenn er zusammenführen will, dann ist das nicht möglich

### Löschen und Anonymisieren (Inhaber)
- [ ] Angenommen ein Gast hat keine Buchungen, wenn der Inhaber „Gast löschen“ wählt und bestätigt, dann ist der Gast endgültig entfernt
- [ ] Angenommen ein Gast hat Buchungen, wenn der Inhaber „Gast löschen“ wählt, dann erklärt die App, dass der Gast anonymisiert wird, weil die Buchungen erhalten bleiben müssen, und verlangt eine Bestätigung
- [ ] Angenommen der Inhaber bestätigt das Anonymisieren, wenn es abgeschlossen ist, dann heißt der Gast „Gelöschter Gast“, Vorname, Kontakt, Adresse, Sprache, Geburtsdatum, Firma, Marketing-Quelle und Notiz sind entfernt, Herkunftsland und Buchungen bleiben erhalten
- [ ] Angenommen ein Gast wurde anonymisiert, wenn jemand das Änderungsprotokoll dieses Gastes ansieht, dann enthält es keine personenbezogenen Altwerte mehr
- [ ] Angenommen ein Gast wurde anonymisiert, wenn der Inhaber ihn ansieht, dann kann er ihn nicht mehr bearbeiten oder mit anderen zusammenführen

## Edge Cases
- **Gleichnamige verschiedene Personen** (z. B. zwei „Anna Huber“): Die App schlägt sie als mögliche Dublette vor. Der Inhaber markiert „Kein Doppeleintrag“, und der Vorschlag verschwindet dauerhaft
- **Plattform-Adresse und private Adresse desselben Gastes:** Beim Zusammenführen wählt der Inhaber die private E-Mail. Die Kennzeichnung „von Plattform übernommen“ gilt nur, solange der gewählte Wert von der Plattform stammt
- **Gast ohne Vorname** (z. B. „Familie Berger“, Walk-in): zulässig. Liste und Suche funktionieren mit dem Nachnamen
- **Firma ohne Ansprechperson:** nicht vorgesehen. Ein Gast ist immer eine Person, der Nachname bleibt Pflicht (bei Bedarf der Name der wohnenden Person)
- **Sonderzeichen und Akzente** (Müller, Ø, é): Die Suche ignoriert Groß-/Kleinschreibung und Akzente, d. h. „muller“ findet „Müller“ und „rene“ findet „René“. Die Schreibweise „Mueller“ für „Müller“ muss sie nicht erkennen
- **Anonymisieren eines Gastes, der in einem Dubletten-Vorschlag steht:** Der Vorschlag entfällt
- **Löschen während ein anderer Nutzer den Gast gerade ansieht:** Beim nächsten Speichern oder Neuladen sieht er „Gast nicht mehr vorhanden“ bzw. den anonymisierten Stand
- **Sehr viele Gäste** (mehrere Tausend bei größeren Betrieben): Suche und Blättern bleiben flüssig
- **Kunde deaktiviert** (PROJ-5): Gästedaten bleiben erhalten. Beim Löschen eines Kunden (PROJ-5) werden auch seine Gäste gelöscht

## Technical Requirements
- Mandantentrennung wie alle Fachtabellen (PROJ-1): Gäste sind nur für Mitglieder des eigenen Kunden sichtbar
- Rollenrechte werden serverseitig bzw. in der Datenbank durchgesetzt, nicht nur in der Oberfläche
- Änderungsprotokoll für Anlegen, Ändern, Zusammenführen, Löschen und Anonymisieren
- Suche liefert Ergebnisse spürbar sofort (Richtwert < 500 ms bei 5.000 Gästen)
- Responsiv (Handy beim Check-in), deutsch, österreichische Datumsformate

## Open Questions
- [x] Meldewesen / Gästeblatt → eigenes Feature PROJ-26, vor dem Pilot (geklärt 2026-10-26)
- [x] Import bestehender Gästelisten → nicht nötig (geklärt 2026-10-26)
- [x] Marketing-Quellen → Standardliste plus eigener Freitext (geklärt 2026-10-26)
- [ ] Welche Angaben verlangt das Gästeblatt vom Hauptgast zusätzlich (z. B. Geburtsdatum, Staatsangehörigkeit, Ausweis)? Klärt PROJ-26. Werden sie Pflicht, ergänzt /refine PROJ-7 die Felder

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Gast-Eintrag ist der Hauptgast (buchende Person) | Mitreisende hängen an der einzelnen Buchung (PROJ-8), nicht dauerhaft am Gast | 2026-10-26 |
| Mitreisende nur je Buchung, nicht wiederverwendbar | Vom Nutzer so entschieden; hält die Gäste-Datenbank schlank | 2026-10-26 |
| Firma als optionale Zusatzangabe einer Person (Name, UID, Rechnungsadresse) | Dienstwohnungen werden oft von Firmen gebucht; Herkunft und Statistik bleiben personenbezogen | 2026-10-26 |
| Pflicht nur Nachname und Herkunftsland | Schnelle Erfassung am Telefon und beim Check-in; Herkunft wird für Statistik (PROJ-18) gebraucht; Importe bringen selten mehr mit | 2026-10-26 |
| Keine Vorauswahl beim Herkunftsland | Eine Vorbelegung (z. B. Österreich) würde unbemerkt die Herkunftsstatistik verfälschen | 2026-10-26 |
| Marketing-Quelle am Gast (Ersterwerb), Plattform an der Buchung | Ein Stammgast kann über verschiedene Plattformen buchen; die Quelle beschreibt, wie er erstmals kam | 2026-10-26 |
| Mitarbeiter sehen Gäste nur; neu anlegen nur beim Buchen | Vom Nutzer so entschieden; Mitarbeiter brauchen Gäste für Check-in und Buchungen, Stammdatenpflege bleibt beim Inhaber | 2026-10-26 |
| Dubletten: Vorschläge (E-Mail, Telefon, Vor-+Nachname) und Zusammenführen mit Feldwahl, nur Inhaber, endgültig | Häufiger Fall: derselbe Gast mit Plattform-Adresse und privater Adresse; automatisches Zusammenführen wäre bei Namensgleichheit gefährlich | 2026-10-26 |
| Löschen: ohne Buchungen endgültig, mit Buchungen anonymisieren | DSGVO-Löschrecht erfüllen und trotzdem Buchungen für Abgabe und Steuer (7 Jahre) behalten; Herkunftsland bleibt für die Statistik | 2026-10-26 |
| Kontaktdaten tragen ihre Herkunft (direkt / Plattform) | PRD: Plattform-Adressen dürfen nicht für Werbung genutzt werden; PROJ-19 braucht diese Unterscheidung | 2026-10-26 |
| Marketing-Quelle: Standardliste plus eigener Freitext | Vom Nutzer entschieden; Standardwerte bleiben auswertbar, Sonderfälle (Messe, Partner) gehen nicht verloren. Im Filter und in der Statistik erscheinen Freitexte gesammelt als „Eigene Angabe“ | 2026-10-26 |
| Kein Import bestehender Gästelisten | Vom Nutzer entschieden; Gäste entstehen durch Erfassung und Buchungen | 2026-10-26 |
| Gästeblatt als eigenes Feature PROJ-26 vor dem Pilot | Gesetzliche Meldepflicht; eigener, getrennt testbarer Umfang | 2026-10-26 |
| Liste mit Suche, Filter Herkunftsland und Marketing-Quelle, ohne Export | Export ist an die Einwilligung gebunden und gehört zu PROJ-19 | 2026-10-26 |

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
