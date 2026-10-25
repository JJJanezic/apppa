# PROJ-7: Gäste-Datenbank

## Status: In Progress
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
| Daten in Supabase, je Kunde abgeschottet (Muster PROJ-1) | Gästedaten sind geteilte Teamdaten und müssen geräteübergreifend und sicher getrennt sein | 2026-10-26 |
| Betreiber-Admin darf Gäste lesen wie alle Kundendaten (ohne eigene Oberfläche) | Vom Nutzer entschieden; einheitliche Regel und einfacher Support | 2026-10-26 |
| Mitarbeiter legen Gäste nur gemeinsam mit einer Buchung an (ein Datenbankvorgang in PROJ-8) | Setzt „Mitarbeiter nur sehen, Anlegen beim Buchen“ in der Datenbank durch; es entstehen keine Gäste ohne Buchung durch Mitarbeiter | 2026-10-26 |
| Zusammenführen und Löschen/Anonymisieren als geschützte Datenbank-Funktionen | Mehrere Schritte müssen gemeinsam gelingen oder gemeinsam scheitern; Rolle wird in der Datenbank geprüft | 2026-10-26 |
| Anonymisieren entfernt Altwerte über die vorhandene Protokoll-Bereinigung aus PROJ-1 | Spec verlangt ein Protokoll ohne personenbezogene Altwerte; die Funktion existiert bereits für DSGVO-Löschungen | 2026-10-26 |
| Vereinheitlichter Suchtext, von der Datenbank gepflegt | Suche und Dublettenvergleich ohne Groß-/Kleinschreibung und Akzente; schnell auch bei Tausenden Gästen; gleiche Idee wie der Gemeinde-Suchname aus PROJ-6 | 2026-10-26 |
| Suche, Filter, Sortierung und Blättern in der Datenbank, Zustand in der Adresse | Browser lädt nur 50 Einträge; Links sind teilbar, „Zurück“ funktioniert | 2026-10-26 |
| Länder als internationaler Code, Namen über die eingebaute Sprachfunktion | Keine eigene Länderliste pflegen, kein Paket; englische Oberfläche (PROJ-23) gratis | 2026-10-26 |
| Aufenthalte und Plattformen berechnet, nicht am Gast gespeichert | Keine doppelt gepflegten Zahlen, die auseinanderlaufen könnten | 2026-10-26 |
| Schutz vor Überschreiben über „zuletzt geändert am“ | Einfach, nutzt das vorhandene Standardfeld; reicht für kleine Teams | 2026-10-26 |
| Plattform-Relay-Adressen zählen nicht als gleiche E-Mail | Sie wechseln je Buchung und würden falsche bzw. fehlende Vorschläge erzeugen | 2026-10-26 |
| Abgelehnte Dubletten-Paare werden gespeichert | Damit „Kein Doppeleintrag“ dauerhaft wirkt | 2026-10-26 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Abschottungsmuster aus PROJ-1:** Jede Fachtabelle hat eine Kundenkennung. Lesen dürfen die Mitglieder des Kunden und der Betreiber-Admin mit 2FA, Schreiben richtet sich nach der Rolle. Standardfelder (angelegt/geändert von/am) und das Änderungsprotokoll schaltet ein Aufruf je Tabelle ein.
- **Änderungsprotokoll:** Es speichert alte und neue Werte. Es gibt schon eine geschützte Funktion, die personenbezogene Altwerte eines Datensatzes aus dem Protokoll entfernt (PROJ-1, für DSGVO-Löschungen gedacht). Einträge werden nach 2 Jahren automatisch gelöscht.
- **Navigation:** Der Punkt „Gäste“ (`/gaeste`) ist seit PROJ-2 angelegt und noch als „in Vorbereitung“ markiert. Auf dem Handy liegt er in der unteren Leiste.
- **Bausteine:** Seitenkopf, Leerzustand, Detail-Panel und Bestätigungsdialog; dazu die shadcn-Bausteine Table, Input, Select, Command und Popover, Sheet, Dialog, AlertDialog, Badge, Pagination und Tabs.
- **Muster für Server-Aktionen** aus PROJ-4 bis 6: gemeinsame Prüfregeln (Zod) für Browser und Server, Meldungen aus `messages/de.json`, kein eigenes API.

### A) Seiten und Bausteine

```
/gaeste  (alle Mitglieder)
+-- Kopf: „Gäste“ + Knopf „Gast anlegen“ (nur Inhaber) + Link „Mögliche Dubletten (N)“ (nur Inhaber, nur wenn N > 0)
+-- Suchfeld (Name, Firma, E-Mail, Telefon) + Filter Herkunftsland + Filter Marketing-Quelle
+-- Liste
|   +-- Desktop/Tablet: Tabelle (Name mit Firma, Herkunft, Aufenthalte, letzter Aufenthalt), Sortierung per Spaltenkopf
|   +-- Handy: Karten (Name, Firma, Herkunft, letzter Aufenthalt)
|   +-- Blättern zu je 50 Einträgen
+-- Leerzustand (Inhaber: mit „Gast anlegen“; Mitarbeiter: Hinweis auf Buchungen)
+-- „Keine Gäste gefunden“ mit „Suche zurücksetzen“

/gaeste/[id]  Gast-Detail (alle Mitglieder)
+-- Kopf: Name, Firma, Herkunft; Kennzeichen „Anonymisiert“ falls zutreffend
+-- Abschnitt Kontakt (E-Mail, Telefon, Sprache), je mit Kennzeichen „von Plattform übernommen“
+-- Abschnitt Adresse, Abschnitt Firma, Marketing-Quelle, Geburtsdatum, Notiz
+-- Abschnitt Aufenthalte: Anzahl, letzter/nächster, Plattformen (bis PROJ-8: „Noch keine Aufenthalte“)
+-- Aktionen (nur Inhaber): Bearbeiten · Mit anderem Gast zusammenführen · Gast löschen

Detail-Panel „Gast anlegen / bearbeiten“ (nur Inhaber)
+-- Nachname*, Vorname, Herkunftsland* (Länderauswahl mit Suche, häufige Länder oben, keine Vorauswahl)
+-- E-Mail, Telefon, Sprache, Geburtsdatum
+-- Adresse (Straße, PLZ, Ort, Land)
+-- Marketing-Quelle: Auswahl der Standardwerte oder „Eigene Angabe“ → Textfeld
+-- Firma (aufklappbar): Firmenname, UID-Nummer, Rechnungsadresse
+-- Notiz
+-- Hinweis „Möglicher Doppeleintrag“ beim Speichern → „Bestehenden Gast öffnen“ / „Trotzdem anlegen“

Gast-Formular als wiederverwendbarer Baustein
+-- dieselben Felder, eingebettet im Buchungsformular von PROJ-8 (dort auch für Mitarbeiter)

/gaeste/dubletten  Mögliche Dubletten (nur Inhaber)
+-- Liste der Paare mit Grund (gleiche E-Mail / gleiche Telefonnummer / gleicher Name)
+-- je Paar: „Zusammenführen“ · „Kein Doppeleintrag“

Dialog „Gäste zusammenführen“ (nur Inhaber)
+-- zwei Spalten (Gast A | Gast B), je Angabe eine Auswahl, welcher Wert bleibt
+-- Vorschau des Ergebnisses, Hinweis „nicht rückgängig zu machen“, Bestätigung
+-- Einstieg auch aus dem Gast-Detail: anderen Gast per Suche wählen

Bestätigungsdialog „Gast löschen“
+-- ohne Buchungen: „Endgültig löschen“
+-- mit Buchungen: Erklärung „wird anonymisiert“ + was entfernt wird und was bleibt
```

### B) Datenmodell (in Worten)

**Gäste** (je Kunde)
- Kunde
- Nachname (Pflicht), Vorname
- Herkunftsland (Pflicht), gespeichert als zweistelliger internationaler Ländercode (z. B. AT, DE)
- E-Mail, Telefon, Sprache (Sprachcode)
- Adresse: Straße, PLZ, Ort, Land der Adresse (Ländercode)
- Geburtsdatum
- Marketing-Quelle: entweder einer der Standardwerte oder „eigene Angabe“ mit Freitext (max. 100 Zeichen)
- Firma: Firmenname, UID-Nummer, Rechnungsadresse (ein Textfeld)
- Notiz (max. 2.000 Zeichen)
- Herkunft der Kontaktdaten: je für E-Mail und Telefon „direkt“ oder „Plattform“ (PROJ-7 setzt immer „direkt“; PROJ-11 setzt „Plattform“)
- anonymisiert am (leer = normal)
- **Suchtext** (von der Datenbank selbst gepflegt): Name, Firma, E-Mail und Telefon in vereinheitlichter Form (Kleinbuchstaben, ohne Akzente, Telefon nur Ziffern). Darüber laufen Suche und Dublettenvergleich
- Standardfelder und Änderungsprotokoll (PROJ-1)

**Abgelehnte Dubletten-Vorschläge** (je Kunde)
- Kunde, Gast A, Gast B (als Paar, Reihenfolge egal), abgelehnt von/am
- verschwindet automatisch, wenn einer der beiden Gäste gelöscht oder zusammengeführt wird

**Aufenthalte, letzter/nächster Aufenthalt, Plattformen** werden nicht am Gast gespeichert. Sie werden aus den Buchungen (PROJ-8) berechnet. Bis dahin sind sie leer.

**Regeln in der Datenbank** (nicht nur in der Oberfläche):
- Nachname und Herkunftsland dürfen nicht leer sein; das Geburtsdatum liegt nicht in der Zukunft; Längenbegrenzungen wie in der Spec
- Ein anonymisierter Gast kann nicht mehr bearbeitet oder zusammengeführt werden
- Zusammenführen nur innerhalb desselben Kunden und nicht mit sich selbst
- Ab PROJ-8: Buchungen verweisen auf den Gast mit Löschsperre. Ein Gast mit Buchungen kann dann nur anonymisiert, nicht gelöscht werden

### C) Rechte
| Aktion | Inhaber | Mitarbeiter | Betreiber-Admin (2FA) |
|---|---|---|---|
| Gäste lesen | ✓ | ✓ | ✓ lesend, wie überall (PROJ-1), aber ohne eigene Oberfläche |
| Gast anlegen | ✓ | nur über das Buchungsformular (PROJ-8) | – |
| Gast ändern | ✓ | – | – |
| Zusammenführen, Löschen, Anonymisieren | ✓ | – | – |
| Dubletten-Vorschläge sehen bzw. ablehnen | ✓ | – | – |

- „Mitarbeiter nur beim Buchen anlegen“ wird so umgesetzt: Das direkte Anlegen in der Tabelle ist nur Inhabern erlaubt. Für Mitarbeiter legt die Buchungsaktion aus PROJ-8 den Gast in demselben Datenbankvorgang wie die Buchung an. Ein Gast ohne Buchung kann so von Mitarbeitern nicht entstehen.
- Zusammenführen und Anonymisieren laufen über eigene geschützte Datenbank-Funktionen, die die Inhaber-Rolle selbst prüfen und jeden Schritt in einem Vorgang erledigen (alles oder nichts).

### D) Suche, Filter und Dubletten
- **Suche:** über den vereinheitlichten Suchtext, „enthält“-Suche, Groß-/Kleinschreibung und Akzente egal. Die Datenbank filtert und blättert; der Browser lädt immer nur die aktuelle Seite (50 Einträge). Suchbegriff, Filter, Sortierung und Seite stehen in der Adresse (teilbar, „Zurück“ funktioniert).
- **Filter Marketing-Quelle:** Standardwerte, „Eigene Angabe“ (alle Freitexte) und „Keine Angabe“.
- **Sortierung:** Name (Nachname, Vorname) oder letzter Aufenthalt (ab PROJ-8; bis dahin nur Name).
- **Dubletten-Vorschläge:** Die Datenbank sucht Paare desselben Kunden mit gleicher E-Mail (ohne Groß-/Kleinschreibung), gleicher Telefonnummer (nur Ziffern verglichen) oder gleichem Vor- und Nachnamen (vereinheitlicht). Anonymisierte Gäste und abgelehnte Paare sind ausgenommen. Die Zahl erscheint als Link im Kopf der Gästeliste.
- **Warnung beim Anlegen:** dieselbe Prüfung für den neuen Gast vor dem Speichern. „Trotzdem anlegen“ speichert ohne erneute Warnung.
- **Plattform-Adressen von booking.com/Airbnb** (Relay-Adressen) gelten nicht als „gleiche E-Mail“, weil sie je Buchung wechseln können. Erkannt werden sie an ihrer Domain. Die Liste der Domains liegt an einer Stelle im Code.

### E) Zusammenführen
- Der Inhaber wählt je Angabe den Wert von Gast A oder B. Die Kennzeichnung „von Plattform übernommen“ wandert mit dem gewählten Wert.
- In einem Datenbankvorgang: verbleibenden Gast mit den gewählten Werten aktualisieren; ab PROJ-8 alle Buchungen des anderen Gastes umhängen; abgelehnte Vorschläge des anderen Gastes entfernen; anderen Gast löschen.
- Das Änderungsprotokoll hält beides fest: die Änderung am verbleibenden Gast und das Löschen des anderen. Ein zusätzlicher Eintrag „zusammengeführt mit …“ verknüpft beide.

### F) Löschen und Anonymisieren
- **Ohne Buchungen:** Gast endgültig löschen. Die Altwerte im Änderungsprotokoll werden über die vorhandene Funktion aus PROJ-1 entfernt. Es bleibt nur der Vermerk „Gast gelöscht“ mit Person und Zeitpunkt.
- **Mit Buchungen:** In einem Vorgang werden Nachname auf „Gelöschter Gast“ gesetzt, Vorname, Kontakt, Adresse, Sprache, Geburtsdatum, Firma, Marketing-Quelle und Notiz geleert, „anonymisiert am“ gesetzt und die Altwerte dieses Gastes im Änderungsprotokoll entfernt. Herkunftsland und Buchungen bleiben.
- **Später:** Daten, die andere Features am Gast oder an der Buchung speichern (z. B. Gästeblatt PROJ-26), müssen beim Anonymisieren mit bedacht werden. Die Anonymisierungsfunktion ist dafür der zentrale Ort.

### G) Gleichzeitiges Bearbeiten
- Das Formular merkt sich beim Öffnen den Stand „zuletzt geändert am“. Beim Speichern wird nur gespeichert, wenn der Gast seitdem nicht geändert wurde. Sonst erscheint „Dieser Gast wurde inzwischen geändert“ mit „Aktuelle Fassung laden“. Die eigenen Eingaben gehen dabei nicht unbemerkt verloren, sondern bleiben bis zum Neuladen im Formular.

### H) Länder, Sprachen, Marketing-Quellen
- **Länder:** gespeichert als internationaler Code. Die deutschen Namen liefert der Browser bzw. Server selbst (eingebaute Sprachfunktion von JavaScript), ohne eigene Länderliste oder Paket. Die häufigen Länder (Österreich, Deutschland, Schweiz, Italien, Niederlande, Ungarn, Tschechien, Slowenien, Vereinigtes Königreich, USA) stehen oben. Die Liste der Codes liegt an einer Stelle im Code und ist für die englische Oberfläche (PROJ-23) schon vorbereitet.
- **Sprachen:** kurze feste Liste (Deutsch, Englisch, Italienisch, Französisch, Niederländisch, Ungarisch, Tschechisch, Slowenisch, Kroatisch, Polnisch, Spanisch), Namen ebenfalls über die eingebaute Sprachfunktion.
- **Marketing-Quellen:** Standardwerte als feste Liste im Code (übersetzbar), dazu „Eigene Angabe“.

### I) Schnittstelle zu späteren Features
- **PROJ-8 (Buchungen):** nutzt den Gast-Formular-Baustein, die Gastsuche (Auswahl eines bestehenden Gastes) und die Dublettenwarnung. Der Gast und die Buchung entstehen in einem Vorgang.
- **PROJ-11 (Import):** legt Gäste mit Kontakt-Herkunft „Plattform“ an bzw. ordnet über die Dublettenprüfung bestehende Gäste zu.
- **PROJ-18/19:** lesen Herkunftsland, Marketing-Quelle und die Kontakt-Herkunft.
- **PROJ-26 (Gästeblatt):** kann zusätzliche Pflichtangaben am Hauptgast verlangen (siehe Open Questions). Die Felder werden dann ergänzt, ohne bestehende zu ändern.

### J) Tests
- **Integrationstests gegen „apppa-dev“:**
  - Abschottung zwischen Kunden;
  - Mitarbeiter lesen, legen aber nicht direkt an und ändern nicht;
  - Pflichtfelder und Längen;
  - Suche mit Akzenten;
  - Dubletten-Paare (E-Mail, Telefon, Name; abgelehnte und anonymisierte ausgenommen; Plattform-Adressen ignoriert);
  - Zusammenführen (nur Inhaber, nur gleicher Kunde, nicht mit sich selbst, alles-oder-nichts);
  - Löschen bzw. Anonymisieren inkl. bereinigtem Änderungsprotokoll;
  - Schutz vor Überschreiben bei gleichzeitiger Änderung.
- **E2E:** Leerzustände (Inhaber/Mitarbeiter), Anlegen mit Pflichtfeldern, Dublettenwarnung, Bearbeiten, Firma, eigene Marketing-Quelle, Suche und Filter, Blättern, Zusammenführen mit Feldwahl, „Kein Doppeleintrag“, Löschen und Anonymisieren, Mitarbeiter ohne Aktionen, Handy-Ansicht, axe.
- **Unit-Tests:** Vereinheitlichung von Suchtext und Telefon, Erkennung von Plattform-Adressen, Länder- und Sprachnamen, Prüfregeln (E-Mail, Geburtsdatum, Längen, Marketing-Quelle).

### K) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- **Zwei neue Tabellen mit Zugriffsregeln:**
  - Gäste: je Kunde; Lesen Mitglieder und Betreiber-Admin; direktes Anlegen und Ändern nur Inhaber; Löschen nur über die Funktion „Löschen/Anonymisieren“;
  - abgelehnte Dubletten-Vorschläge: je Kunde; Lesen und Schreiben nur Inhaber.
- **Drei neue geschützte Datenbank-Funktionen:** Dubletten suchen, Zusammenführen, Löschen/Anonymisieren. Sie prüfen die Rolle selbst.
- **Neue Nutzung der Protokoll-Bereinigung aus PROJ-1:** bisher nur für den Server mit dem geheimen Schlüssel. Sie wird künftig auch von der Funktion „Löschen/Anonymisieren“ genutzt, und zwar nur für den betroffenen Gast.
- **Bestehende Regeln bleiben unverändert.**

### L) Abhängigkeiten
- Keine neuen Pakete. Länder- und Sprachnamen kommen aus der eingebauten Sprachfunktion von JavaScript; Auswahl mit Suche über die vorhandenen shadcn-Bausteine Command und Popover.

## Implementation Notes (Frontend)
**Stand 2026-10-26.** Die Oberfläche ist fertig. Schreibende Aktionen melden bis zum Backend „Diese Funktion wird gerade eingerichtet“. In der Entwicklung (`npm run dev`) zeigen Liste, Detail, Suche und Dubletten sieben Beispielgäste; im Build bzw. in Staging und Production ist die Liste leer.

**Seiten** (`src/app/(app)/gaeste/`)
- `page.tsx`: Gästeliste. Ohne Kunde (z. B. Betreiber-Admin ohne Mitgliedschaft) der Hinweis „keinem Kunden zugeordnet“ wie im Dashboard statt 404. Leerzustand je Rolle; „Gast anlegen“ und der Link „N mögliche Dubletten“ nur für Inhaber; „Keine Gäste gefunden“ mit „Suche und Filter zurücksetzen“
- `[id]/page.tsx`: Gast-Detail mit Kontakt (Kennzeichen „von Plattform übernommen“), Aufenthalte (bis PROJ-8 leer), weitere Angaben, Firma (nur wenn vorhanden). Anonymisierte Gäste zeigen einen Hinweis und keine Aktionen
- `dubletten/page.tsx`: Vorschlagsliste
- **Navigation:** „Gäste“ ist freigeschaltet (`ready: true`)
- **App-Rahmen:** liefert 404 für `/gaeste/dubletten` bei Mitarbeitern und für unbekannte Gäste, schon vor dem Streaming (Muster aus PROJ-5)

**Bausteine** (`src/components/guests/`)
- `guest-fields.tsx`: alle Felder eines Gastes, wiederverwendbar für das Buchungsformular (PROJ-8). Firma aufklappbar, eigene Marketing-Quelle als Textfeld
- `country-picker.tsx`: Länderauswahl mit Suche (ohne Akzente), häufige Länder oben, keine Vorauswahl; beim Adressland mit „Keine Angabe“
- `guest-panel.tsx`: Anlegen und Bearbeiten. Prüft vor dem Anlegen auf mögliche Doppeleinträge („Bestehenden Gast öffnen“ / „Trotzdem anlegen“); die Warnung verfällt, sobald sich eine Eingabe ändert. Beim Bearbeiten wird „zuletzt geändert am“ mitgeschickt; bei fremder Änderung erscheint ein Hinweis mit „Aktuelle Fassung laden“, die Eingaben bleiben stehen
- `guest-filters.tsx`: Suche (300 ms Verzögerung), Filter Herkunftsland und Marketing-Quelle (inkl. „Eigene Angabe“ und „Keine Angabe“), Sortierung, alles in der Adresse (`?q`, `land`, `quelle`, `sortierung`, `seite`)
- `guest-list.tsx`: Tabelle ab 768 px, darunter Karten; Blättern zu je 50
- `guest-actions.tsx`: Bearbeiten, Zusammenführen, Löschen. Der Lösch-Dialog erklärt bei Gästen mit Aufenthalten das Anonymisieren
- `merge-dialog.tsx`: zweiten Gast per Suche wählen (bzw. vorgewählt aus „Mögliche Dubletten“); je Angabe Auswahl A/B, gleiche Werte ohne Auswahl; Vorbelegung A, außer A ist leer; Hinweis „nicht rückgängig“ und Bestätigung
- `guest-picker.tsx`: Gastsuche mit Trefferliste (ab 2 Zeichen), wiederverwendbar für PROJ-8
- `duplicate-list.tsx`, `create-guest-button.tsx`

**Regeln** (`src/lib/guests.ts`, Unit-Tests): Namen („Huber, Anna“ / „Anna Huber“), vereinheitlichter Suchtext (ohne Akzente, ß → ss), Telefon-Ziffern, Erkennung von Plattform-Relay-Adressen, Dubletten-Gründe, Länder- und Sprachnamen über `Intl.DisplayNames`, Filter aus der Adresse, Hilfen für das Zusammenführen.

**Prüfregeln** (`src/lib/validation/guests.ts`, Unit-Tests): Pflicht Nachname und Herkunftsland (ISO-Code aus der Liste), E-Mail-Format (gespeichert in Kleinbuchstaben), Telefon grob, Geburtsdatum nicht in der Zukunft (Wiener Datum) und nicht vor 1900, Längen, Marketing-Quelle (Standardwert oder Freitext; leerer Freitext = keine Angabe).

**Vorläufig bis zum Backend**
- `src/lib/guests-data.ts`: Lesefunktionen auf Beispielgästen (nur in der Entwicklung)
- `src/app/(app)/gaeste/actions.ts`: Anlegen, Ändern, Löschen, Zusammenführen und „Kein Doppeleintrag“ prüfen Rolle und Eingaben und melden „wird eingerichtet“; Suche, Dublettenprüfung und `loadGuest` arbeiten auf den Beispielgästen

**Geprüft**
- Typprüfung, Lint, Build grün; Unit-Tests 203/203 (davon 25 neu)
- Im Browser (Desktop 1440 px und Handy 375 px) als Inhaber und als Mitarbeiter: Liste, Suche, Detail, Bearbeiten, Pflichtfeld-Meldungen, Dubletten, Zusammenführen-Dialog; Mitarbeiter ohne Aktionen, `/gaeste/dubletten` liefert für Mitarbeiter 404

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
