# PROJ-47: Plattform-Buchungsnummer

## Status: Architected
**Created:** 2026-11-06
**Last Updated:** 2026-11-06

## Dependencies
- Requires: PROJ-8 (Manuelle Buchungen): Buchungsformular, Buchungsdetail, Arten Buchung/Option/Sperre, Rollen Inhaber/Mitarbeiter
- Requires: PROJ-30 (Buchungs-Erweiterung): Buchungsquelle inkl. booking.com, Suche in der Buchungsübersicht (Buchungs- und Gästeblattnummer)
- Requires: PROJ-45 (Zahlungserfassung): Buchungsquelle „Airbnb“
- Wird voraussichtlich genutzt von: PROJ-11 (Buchungsimport aus Channex: automatisches Befüllen, Abgleich mit manuell erfassten Buchungen)

## Überblick
Bei Buchungen über booking.com oder Airbnb kann die Nummer der Plattform erfasst werden, damit man die Buchung im Extranet der Plattform schnell wiederfindet.

| Buchungsquelle | Feld | Beispiel |
|---|---|---|
| booking.com | „booking.com-Buchungsnummer“ | 4123456789 |
| Airbnb | „Airbnb-Bestätigungscode“ | HMABCD1234 |
| alle anderen Quellen, keine Angabe | kein Feld | – |

**Regeln:**
- Optional.
- Erlaubt: Buchstaben, Ziffern, Bindestrich; höchstens 30 Zeichen.
- Leerzeichen werden entfernt (auch innerhalb, z. B. beim Einfügen „4123 456 789“).
- Groß- und Kleinschreibung bleibt wie eingegeben.
- Keine Prüfung auf das genaue Format der Plattform.

**Doppelte Nummer:** Steht dieselbe Nummer (ohne Unterschied von Groß-/Kleinschreibung) bei derselben Quelle schon bei einer anderen Buchung des Kunden (auch storniert), erscheint ein Hinweis mit Buchungsnummer, Wohnung und Zeitraum der anderen Buchung samt Link. Gespeichert werden kann trotzdem.

**Wechsel der Buchungsquelle:**
- Auf eine Quelle ohne Feld: Feld verschwindet, die Nummer wird beim Speichern gelöscht.
- Zwischen booking.com und Airbnb: Feld wird geleert.
- Zurückwechseln vor dem Speichern: die zuletzt eingegebene Nummer steht wieder im Feld; gelöscht wird erst beim Speichern.

**Anzeige:**
- Buchungsformular: Feld direkt unter der Buchungsquelle, sobald booking.com oder Airbnb gewählt ist.
- Buchungsdetail: bei der Quelle, z. B. „booking.com · 4123456789“, mit Knopf zum Kopieren.
- Buchungsübersicht: Suche findet die Nummer (auch Teile, ab 2 Zeichen wie bisher); bei einem Treffer erscheint die Nummer klein neben der Buchungsnummer (wie die Gästeblattnummer); keine neue Spalte.
- Kalender, Rechnung, Zahlungen: unverändert.

**Rollen:** wie bei Buchungen: Inhaber und Mitarbeiter erfassen und ändern. Gilt für Buchungen und Optionen; Sperren haben keine Buchungsquelle und damit kein Feld.

## User Stories
- Als **Inhaber oder Mitarbeiter** möchte ich bei einer booking.com-Buchung die booking.com-Buchungsnummer eintragen, damit ich die Buchung im booking.com-Extranet schnell wiederfinde.
- Als **Inhaber oder Mitarbeiter** möchte ich bei einer Airbnb-Buchung den Airbnb-Bestätigungscode eintragen, damit ich bei Rückfragen des Gastes oder von Airbnb sofort die richtige Buchung habe.
- Als **Inhaber oder Mitarbeiter** möchte ich in der Buchungsübersicht nach der Plattform-Nummer suchen, damit ich eine Buchung aus einer Plattform-Nachricht direkt finde.
- Als **Inhaber oder Mitarbeiter** möchte ich gewarnt werden, wenn die Nummer schon bei einer anderen Buchung steht, damit ich eine Buchung nicht doppelt erfasse.
- Als **Inhaber oder Mitarbeiter** möchte ich die Nummer im Buchungsdetail mit einem Klick kopieren, damit ich sie ohne Abtippen in der Plattform suchen kann.

## Out of Scope
- Automatisches Befüllen und Abgleich beim Import aus Channex → PROJ-11
- Link direkt in das booking.com-/Airbnb-Extranet (Adressen der Plattformen nicht stabil, erfordern Login)
- Plattform-Nummern für weitere Quellen (z. B. Expedia, eigene Quellen)
- Formatprüfung je Plattform (z. B. 10 Ziffern bei booking.com, „HM…“ bei Airbnb)
- Sperre bei doppelter Nummer (nur Hinweis)
- Anzeige der Nummer in Kalender, Rechnung, Rechnungs-PDF oder Zahlungsliste
- Eigene Spalte oder eigener Filter „mit/ohne Plattform-Nummer“ in der Buchungsübersicht
- Nummer bei Sperren
- Nachträgliches Befüllen bestehender Buchungen (geschieht von Hand)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Feld im Buchungsformular
- [ ] Angenommen ein Inhaber oder Mitarbeiter erfasst eine Buchung, wenn er als Quelle „booking.com“ wählt, dann erscheint direkt unter der Quelle das Feld „booking.com-Buchungsnummer“
- [ ] Angenommen als Quelle ist „Airbnb“ gewählt, wenn das Formular angezeigt wird, dann heißt das Feld „Airbnb-Bestätigungscode“
- [ ] Angenommen als Quelle ist eine andere Quelle oder keine Angabe gewählt, wenn das Formular angezeigt wird, dann gibt es kein Feld für eine Plattform-Nummer
- [ ] Angenommen eine Option wird mit Quelle booking.com erfasst, wenn das Formular angezeigt wird, dann gibt es das Feld ebenfalls
- [ ] Angenommen eine Sperre wird erfasst, wenn das Formular angezeigt wird, dann gibt es kein Feld für eine Plattform-Nummer
- [ ] Angenommen das Feld bleibt leer, wenn gespeichert wird, dann wird die Buchung ohne Nummer gespeichert
- [ ] Angenommen eine bestehende Buchung mit Quelle booking.com ohne Nummer, wenn sie bearbeitet wird, dann kann die Nummer nachgetragen werden

### Validierung
- [ ] Angenommen jemand gibt „ 4123 456 789 “ ein, wenn gespeichert wird, dann wird „4123456789“ gespeichert
- [ ] Angenommen jemand gibt „HMabcd1234“ ein, wenn gespeichert wird, dann wird „HMabcd1234“ unverändert gespeichert
- [ ] Angenommen jemand gibt „AB-1234“ ein, wenn gespeichert wird, dann wird es akzeptiert
- [ ] Angenommen jemand gibt Zeichen außer Buchstaben, Ziffern, Bindestrich und Leerzeichen ein (z. B. „4123/456“ oder „#4123“), wenn gespeichert wird, dann erscheint beim Feld eine Fehlermeldung, nichts wird gespeichert und die Eingaben bleiben erhalten
- [ ] Angenommen jemand gibt nach Entfernen der Leerzeichen mehr als 30 Zeichen ein, wenn gespeichert wird, dann erscheint eine Fehlermeldung bzw. die Eingabe ist begrenzt

### Doppelte Nummer
- [ ] Angenommen bei einer anderen Buchung des Kunden steht dieselbe booking.com-Nummer, wenn eine Buchung mit Quelle booking.com und dieser Nummer gespeichert wird, dann erscheint ein Hinweis mit Nummer, Wohnung und Zeitraum der anderen Buchung samt Link, und die Buchung wird trotzdem gespeichert
- [ ] Angenommen die andere Buchung ist storniert, wenn die gleiche Nummer gespeichert wird, dann erscheint der Hinweis ebenfalls
- [ ] Angenommen die vorhandene Nummer lautet „hmabcd1234“, wenn „HMABCD1234“ bei Quelle Airbnb gespeichert wird, dann erscheint der Hinweis
- [ ] Angenommen dieselbe Zeichenfolge steht bei einer Buchung mit anderer Quelle (booking.com statt Airbnb), wenn gespeichert wird, dann erscheint kein Hinweis
- [ ] Angenommen dieselbe Nummer steht bei einer Buchung eines anderen Kunden, wenn gespeichert wird, dann erscheint kein Hinweis und nichts über den anderen Kunden wird preisgegeben
- [ ] Angenommen eine Buchung wird ohne Änderung der Nummer erneut gespeichert, wenn nur sie selbst die Nummer trägt, dann erscheint kein Hinweis

### Wechsel der Buchungsquelle
- [ ] Angenommen eine Buchung hat Quelle booking.com mit Nummer, wenn die Quelle auf „Website“ geändert und gespeichert wird, dann ist die Nummer gelöscht und die Änderung im Änderungsprotokoll vermerkt
- [ ] Angenommen eine Buchung hat Quelle booking.com mit Nummer, wenn die Quelle auf „Airbnb“ geändert wird, dann ist das Feld „Airbnb-Bestätigungscode“ leer
- [ ] Angenommen jemand wechselt die Quelle von booking.com auf „Website“ und vor dem Speichern zurück auf booking.com, wenn das Feld wieder erscheint, dann steht die zuletzt eingegebene Nummer darin
- [ ] Angenommen jemand ändert die Quelle auf eine Quelle ohne Feld, wenn die Anfrage dennoch eine Nummer mitschickt, dann speichert der Server keine Nummer

### Anzeige und Suche
- [ ] Angenommen eine Buchung hat Quelle booking.com mit Nummer, wenn das Buchungsdetail geöffnet wird, dann steht bei der Quelle „booking.com · 4123456789“
- [ ] Angenommen das Buchungsdetail zeigt eine Nummer, wenn der Nutzer auf „Kopieren“ klickt, dann ist die Nummer in der Zwischenablage und eine kurze Bestätigung erscheint
- [ ] Angenommen eine Buchung hat Quelle booking.com ohne Nummer, wenn das Buchungsdetail geöffnet wird, dann steht nur „booking.com“ ohne Kopier-Knopf
- [ ] Angenommen eine Buchung hat die Nummer „4123456789“, wenn in der Buchungsübersicht „3456“ gesucht wird, dann erscheint die Buchung, und die Nummer steht klein neben der Buchungsnummer
- [ ] Angenommen ohne Suche, wenn die Buchungsübersicht angezeigt wird, dann bleibt die Liste unverändert (keine neue Spalte)
- [ ] Angenommen eine Buchung hat eine Plattform-Nummer, wenn Kalender, Rechnungsentwurf oder Zahlungsliste angezeigt werden, dann sind diese unverändert

### Allgemein
- [ ] Angenommen ein Mitarbeiter erfasst oder ändert die Nummer, wenn er speichert, dann wird sie gespeichert (gleiche Rechte wie bei Buchungen)
- [ ] Angenommen ein Nutzer von Kunde A, wenn er versucht, Nummern von Buchungen des Kunden B zu lesen, zu suchen oder zu ändern, dann wird das abgelehnt (Mandantentrennung)
- [ ] Angenommen bestehende Buchungen, wenn das Feature eingespielt wird, dann haben sie keine Nummer und alle bisherigen Daten bleiben unverändert
- [ ] Angenommen das Formular wird auf einem Handy (375 px Breite) geöffnet, wenn eine 30-stellige Nummer angezeigt wird, dann gibt es kein seitliches Scrollen
- [ ] Angenommen die Nummer wird geändert, wenn gespeichert wird, dann steht im Änderungsprotokoll, wer wann die Nummer geändert hat

## Edge Cases
- **Booking.com-Buchung auf zwei Wohnungen aufgeteilt:** gleiche Nummer bei zwei Buchungen; Hinweis erscheint, Speichern möglich.
- **Stornierte und neu erfasste Buchung mit derselben Nummer:** Hinweis verweist auf die stornierte Buchung; Speichern möglich.
- **Buchung wird storniert:** Nummer bleibt erhalten (für Rückfragen bei der Plattform).
- **Buchung in eine andere Wohnung verschoben oder Zeitraum geändert:** Nummer bleibt unverändert.
- **Mehrere doppelte Treffer:** Hinweis nennt die erste gefundene Buchung und die Anzahl weiterer („und 2 weitere“).
- **Nummer mit Bindestrich am Anfang oder Ende:** akzeptiert, keine weitere Prüfung.
- **Kopieren im Browser ohne Zwischenablage-Zugriff** (z. B. ältere Browser, nicht sichere Verbindung): Meldung, dass Kopieren nicht möglich ist; die Nummer ist im Detail markierbar.
- **Zwei Nutzer bearbeiten dieselbe Buchung gleichzeitig:** wie bisher bei Buchungen (bestehende Regel aus PROJ-8).

## Technical Requirements
- Rechte serverseitig wie bei Buchungen (Inhaber und Mitarbeiter des eigenen Kunden)
- Prüfung auf doppelte Nummer nur innerhalb des eigenen Kunden
- Nummer wird nur gespeichert, wenn die Quelle booking.com oder Airbnb ist (serverseitig erzwungen)
- Validierungsregeln gleich in Oberfläche und Server
- Deutsche Texte über die bestehende i18n-Struktur
- Responsiv ab 375 px Breite

## Open Questions
- [ ] Wie verhält sich eine von Hand erfasste Nummer beim Channex-Import (PROJ-11): Abgleich, Zusammenführen oder Warnung bei gleicher Nummer? Klärung in PROJ-11.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigenes Feature PROJ-47 statt Teil von PROJ-46 | Anderer Bereich (Buchungen) und andere Rollen (auch Mitarbeiter); einzeln test- und deploybar | 2026-11-06 |
| Feld auch für Airbnb („Airbnb-Bestätigungscode“), Bezeichnung je Quelle | Airbnb ist seit PROJ-45 Buchungsquelle und vergibt ebenfalls einen Code je Buchung | 2026-11-06 |
| Optional, Buchstaben/Ziffern/Bindestrich, max. 30, Leerzeichen entfernt, Schreibweise unverändert, keine Plattform-Formatprüfung | Großzügig wie bei der Hotel-ID (PROJ-46); Plattformen können ihr Format ändern; Nachtragen später möglich | 2026-11-06 |
| Doppelte Nummer: Hinweis mit Link, keine Sperre; storniert zählt mit; ohne Groß-/Kleinschreibung; nur gleiche Quelle, nur eigener Kunde | Doppelt erfasste Buchungen fallen sofort auf; Sonderfälle (aufgeteilte Buchung) bleiben möglich; Mandantentrennung | 2026-11-06 |
| Anzeige im Detail mit Kopier-Knopf, Suche in der Übersicht, keine neue Spalte | Hauptzweck Wiederfinden in beide Richtungen; Liste bleibt schlank | 2026-11-06 |
| Quellenwechsel löscht die Nummer beim Speichern; Zurückwechseln vor dem Speichern stellt sie wieder her | Keine verwaisten Nummern bei falscher Quelle; versehentlicher Wechsel kostet keine Eingabe | 2026-11-06 |
| Rollen wie bei Buchungen; Buchungen und Optionen, nicht Sperren | Mitarbeiter erfassen Buchungen; Sperren haben keine Buchungsquelle | 2026-11-06 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein optionales Feld „Plattform-Nummer“ an der Buchung, Bedeutung über die Buchungsquelle | Eine Buchung hat genau eine Quelle; keine verwaisten Nummern bei Quellenwechsel | 2026-11-06 |
| Datenbankregel: Nummer nur bei Quelle booking.com/Airbnb, Format wie Hotel-ID | Serverseitig erzwungen (Spec), schützt auch künftigen Import (PROJ-11) | 2026-11-06 |
| Index je Kunde, Quelle und Nummer ohne Groß-/Kleinschreibung, nicht eindeutig | Schnelle Doppelungsprüfung; doppelte Nummern sind erlaubt | 2026-11-06 |
| Doppelungsprüfung in der bestehenden Live-Warnung (wie Gästeblattnummer), Speichern blockiert nie | Eine Anfrage, gleiche Mandantenprüfung; Spec: nur Hinweis | 2026-11-06 |
| Hinweis ohne Bestätigungs-Häkchen (Abweichung von der Gästeblattnummer) | Aufgeteilte booking.com-Buchungen sind normal; Häkchen wäre nur Reibung | 2026-11-06 |
| Formatregel mit der Hotel-ID (PROJ-46) teilen | Gleiches Format, eine Regel für Formular und Server | 2026-11-06 |
| Änderungsprotokoll über das bestehende automatische Protokoll der Buchungstabelle | Neue Spalte wird ohne Zusatzarbeit mitprotokolliert | 2026-11-06 |
| Keine neuen Pakete; Kopieren über die Zwischenablage des Browsers | Muster existiert (Zwei-Faktor-Einrichtung) | 2026-11-06 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Kleines Feature ohne neue Seiten und ohne neue Pakete. Es erweitert die bestehende Buchung um **ein Feld** und nutzt durchgehend Muster, die es schon gibt:

| Teil | Vorlage im bestehenden Code |
|---|---|
| Format (Buchstaben, Ziffern, Bindestrich, max. 30) | Hotel-ID der Wohnung (PROJ-46) |
| Hinweis „Nummer schon vergeben“ während der Eingabe | Gästeblattnummer-Warnung (PROJ-30), aber **ohne** Bestätigungs-Häkchen |
| Suche in der Buchungsübersicht, Anzeige klein neben der Buchungsnummer | Gästeblattnummer (PROJ-30) |
| Änderungsprotokoll | bestehendes automatisches Protokoll der Buchungstabelle (PROJ-1) – keine Zusatzarbeit |
| Kopieren in die Zwischenablage mit kurzer Bestätigung | Kopieren des Geheimschlüssels bei der Zwei-Faktor-Einrichtung |

### A) Komponenten (was sich in der Oberfläche ändert)
```
Buchungsformular (booking-panel, bestehend)
+-- Buchungsquelle (bestehend)
+-- NEU: Feld „booking.com-Buchungsnummer“ bzw. „Airbnb-Bestätigungscode“
|   (nur bei Quelle booking.com/Airbnb, nicht bei Sperren; merkt sich je Quelle
|    die zuletzt eingegebene Nummer bis zum Speichern)
+-- NEU: Hinweis „Nummer schon vergeben“ (gelbe Infobox wie bei der Gästeblattnummer)
|   +-- erste gefundene Buchung: Buchungsnummer, Wohnung, Zeitraum, „storniert“, Link
|   +-- „und N weitere“
|   (kein Häkchen, Speichern bleibt jederzeit möglich)

Buchungsdetail (booking-detail, bestehend)
+-- Zeile „Buchungsquelle“: „booking.com · 4123456789“
    +-- NEU: kleiner Knopf „Kopieren“ (nur wenn eine Nummer da ist)
        → kurze Bestätigung bzw. Meldung „Kopieren nicht möglich“

Buchungsübersicht (booking-list, bestehend)
+-- Suche findet zusätzlich die Plattform-Nummer (Teiltreffer ab 2 Zeichen)
+-- bei Suche: Nummer klein neben Buchungs- und Gästeblattnummer (keine neue Spalte)
```
Kalender, Rechnung, Rechnungs-PDF und Zahlungen werden nicht angefasst.

### B) Datenmodell (in Worten)
Die Buchung bekommt **ein neues, optionales Feld „Plattform-Nummer“**:
- Text, 1–30 Zeichen, nur Buchstaben, Ziffern und Bindestrich, ohne Leerzeichen; Schreibweise wie eingegeben
- Darf nur gefüllt sein, wenn die Buchungsquelle booking.com oder Airbnb ist – die **Datenbank selbst** erzwingt das (zusätzlich zur Prüfung im Formular und auf dem Server). Sperren haben ohnehin keine Quelle, also auch keine Nummer.
- Bestehende Buchungen: Feld leer, sonst ändert sich nichts.
- Ein eigenes Feld für die Quelle ist nicht nötig: welche Plattform gemeint ist, ergibt sich aus der Buchungsquelle der Buchung.
- Nicht eindeutig (doppelte Nummern sind erlaubt, siehe aufgeteilte Buchung).
- Ein Suchindex je Kunde, Quelle und Nummer (ohne Groß-/Kleinschreibung) macht die Doppelungsprüfung schnell.

Gespeichert in: Supabase, Tabelle der Buchungen, mit der bestehenden Mandantentrennung (Zeilen-Sicherheit je Kunde). Wer was geändert hat, schreibt das bestehende Protokoll automatisch mit.

### C) Abläufe

**Speichern**
1. Formular bereinigt die Eingabe (alle Leerzeichen raus) und prüft das Format; bei Fehler Meldung beim Feld, Eingaben bleiben.
2. Server prüft dieselben Regeln noch einmal (gemeinsame Prüfregel für Formular und Server).
3. Die bestehende Speicherfunktion der Buchung übernimmt die Nummer **nur**, wenn die Quelle booking.com oder Airbnb ist; sonst wird sie geleert – auch wenn eine Anfrage trotzdem eine Nummer schickt.
4. Die Speicherfunktion blockiert wegen einer doppelten Nummer **nie**.

**Hinweis bei doppelter Nummer**
- Läuft über die bestehende Live-Prüfung im Formular (die schon Überschneidungen, Kapazität und doppelte Gästeblattnummer prüft) – sie bekommt Quelle und Nummer als zusätzliche Angabe und liefert die Treffer mit.
- Gesucht wird nur beim eigenen Kunden, nur bei gleicher Quelle, ohne Groß-/Kleinschreibung, stornierte eingeschlossen, die bearbeitete Buchung selbst ausgenommen. Über andere Kunden wird nichts zurückgegeben.
- Geliefert werden die erste Buchung (Nummer, Wohnung, Zeitraum, storniert ja/nein) und die Anzahl weiterer Treffer.

**Quellenwechsel im Formular**
- Das Formular merkt sich die Nummer je Plattform getrennt (booking.com / Airbnb). Wechsel auf eine andere Quelle blendet das Feld aus; Zurückwechseln zeigt die gemerkte Nummer wieder. Beim Speichern zählt nur die Nummer der aktuell gewählten Quelle.

**Suche**
- Die bestehende Suche der Buchungsübersicht (Buchungsnummer, Gästeblattnummer, Gastname) sucht zusätzlich in der Plattform-Nummer, mit derselben Absicherung gegen Sonderzeichen wie bei der Gästeblattnummer.

### D) Technische Entscheidungen (Begründung)
- **Ein Feld statt zwei** (je Plattform eines): Eine Buchung hat genau eine Quelle, also höchstens eine Plattform-Nummer. Die Bedeutung ergibt sich aus der Quelle; ein Quellenwechsel kann keine „verwaiste“ zweite Nummer hinterlassen.
- **Regel „nur bei booking.com/Airbnb“ in der Datenbank**: Selbst ein Fehler in der Oberfläche oder ein späterer Import (PROJ-11) kann keine Nummer an eine falsche Quelle hängen.
- **Hinweis ohne Bestätigungs-Häkchen** (anders als bei der Gästeblattnummer): Die Spec verlangt „nur Hinweis, Speichern möglich“. Aufgeteilte booking.com-Buchungen sind ein normaler Fall; ein Pflicht-Häkchen wäre dort nur Reibung.
- **Prüfung in der bestehenden Live-Warnung statt eigener Abfrage**: eine Anfrage pro Eingabe statt zwei, gleiche Verzögerung, gleiche Mandantenprüfung.
- **Prüfregel geteilt mit der Hotel-ID**: Gleiches Format (Buchstaben, Ziffern, Bindestrich, max. 30) – eine Regel, ein Test.
- **Kein Bestandsumbau**: Neues Feld leer, keine Datenübernahme nötig.

### E) Tests (Vorschau für /qa)
- Unit: Bereinigung/Format, Löschen bei falscher Quelle, Merken je Quelle im Formular
- Datenbank/Integration: Datenbankregel Quelle↔Nummer, Doppelungsprüfung (gleiche Quelle, Groß/Klein, storniert, eigene Buchung ausgenommen, anderer Kunde unsichtbar), Suche
- E2E (kleine Pakete): Feld erscheint/verschwindet, Hinweis mit Link, Kopieren, Suche in der Übersicht, 375 px

### F) Pakete
Keine neuen Pakete.

### G) Aufteilung Frontend / Backend
- **Backend:** neues Feld mit Datenbankregeln und Index; Speicherfunktion und Live-Warnung erweitert; Suche erweitert; Laden der Nummer in Liste und Detail
- **Frontend:** Feld mit Beschriftung je Quelle und Merken je Quelle, Hinweisbox, Anzeige und Kopieren im Detail, Anzeige bei Suchtreffern, deutsche Texte

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
