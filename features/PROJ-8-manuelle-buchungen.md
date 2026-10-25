# PROJ-8: Manuelle Buchungen

## Status: Planned
**Created:** 2026-10-26
**Last Updated:** 2026-10-26

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup): Mandanten-Abschottung, Änderungsprotokoll
- Requires: PROJ-4 (Kundenkonten & Rollen): Rollen Inhaber/Mitarbeiter, gewählter Kunde
- Requires: PROJ-6 (Wohnungsverwaltung): Wohnung, Personenzahl, Standardpreis, Check-in/-out-Zeiten, Archivieren, Löschsperre
- Requires: PROJ-7 (Gäste-Datenbank): Gastsuche, Gast-Formular, Dublettenwarnung, Zusammenführen, Anonymisieren
- Wird genutzt von: PROJ-9 (Belegungskalender), PROJ-11 (Import legt Buchungen desselben Modells an), PROJ-12 (Sperren an Channex), PROJ-13 (Zahlungen je Buchung), PROJ-14 (Dashboard), PROJ-16 (Ortstaxe aus Personen, Alter und Nächten), PROJ-17 (Kalender-Abo), PROJ-18 (Auswertungen), PROJ-26 (Gästeblatt mit Hauptgast und Mitreisenden)

## Überblick
Inhaber und Mitarbeiter erfassen **Direktbuchungen**, **Optionen** (vorgemerkt mit Ablaufdatum) und **Sperren** (Zeiträume ohne Gast, z. B. Eigennutzung) für ihre Wohnungen. Jede Buchung hat einen Hauptgast aus der Gäste-Datenbank, Erwachsene und Kinder (mit Alter) sowie optional namentlich erfasste Mitreisende. Der Preis besteht aus dem Übernachtungspreis und Zusatzkosten, darunter eine Reinigungsgebühr je Wohnung. Überschneidungen und Überbelegung erkennt die App und warnt. Nur Inhaber dürfen trotzdem speichern, stornieren und Preise sehen.

Buchungen von booking.com und Airbnb werden hier **nicht** von Hand erfasst; sie kommen über den Import (PROJ-11).

## User Stories
- Als **Inhaber** möchte ich eine Direktbuchung mit Wohnung, Zeitraum, Gast, Personen und Preis erfassen, damit alle Buchungen an einem Ort sind.
- Als **Inhaber** möchte ich vor dem Speichern sehen, ob sich der Zeitraum mit einer anderen Buchung oder Sperre überschneidet, damit ich keine Doppelbuchung anlege.
- Als **Inhaber** möchte ich einem Interessenten eine Wohnung als Option mit Ablaufdatum vormerken, damit der Zeitraum gehalten wird und von selbst wieder frei wird, wenn er sich nicht meldet.
- Als **Inhaber** möchte ich Zusatzkosten wie Reinigung, Haustier oder Frühstück an der Buchung erfassen, damit der Endbetrag stimmt.
- Als **Inhaber** möchte ich eine Buchung mit Grund und Stornogebühr stornieren, damit der Zeitraum frei wird und die Gebühr für Zahlungen und Umsatz erhalten bleibt.
- Als **Mitarbeiter** möchte ich Buchungen und Sperren anlegen und ändern und dabei einen neuen Gast erfassen, damit ich Anrufe und Anfragen ohne den Inhaber bearbeiten kann.
- Als **Mitarbeiter** möchte ich beim Check-in die Namen und Geburtsdaten der Mitreisenden nachtragen, damit Gästeblatt und Ortstaxe vollständig sind.
- Als **Inhaber** möchte ich eine Wohnung für Eigennutzung oder Renovierung sperren, damit dort niemand gebucht wird.

## Umfang

### Arten von Einträgen
| Art | Gast | Preis | Nummer | Ende |
|---|---|---|---|---|
| **Buchung** (bestätigt) | Pflicht | ja | ja | stornieren |
| **Option** (vorgemerkt) | Pflicht | ja | ja | bestätigen, stornieren oder verfallen |
| **Sperre** | – | – | – | löschen |

Alle drei belegen den Zeitraum ihrer Wohnung und gehen in die Konfliktprüfung ein. Der Kanal aller hier erfassten Buchungen und Optionen ist „Direkt“.

### Angaben einer Buchung bzw. Option
| Angabe | Pflicht | Hinweise |
|---|---|---|
| Wohnung | ja | nur aktive (nicht archivierte) Wohnungen wählbar; Anzeige „Objekt · Wohnung“ |
| Anreise, Abreise | ja | Abreise nach Anreise; Anzeige der Nächte |
| Check-in-, Check-out-Zeit | nein | vorbelegt aus der Wohnung, je Buchung änderbar (z. B. früher Check-in) |
| Hauptgast | ja | bestehenden Gast suchen oder neuen anlegen (Bausteine aus PROJ-7); wohnt immer selbst mit |
| Erwachsene | ja | mindestens 1 (der Hauptgast) |
| Kinder | nein | je Kind das Alter bei Anreise (0–17) |
| Mitreisende | nein | je Person Vorname, Nachname, Geburtsdatum; jederzeit nachtragbar; höchstens so viele wie Personen minus Hauptgast |
| Übernachtungspreis | ja | Euro; vorgeschlagen als Standardpreis × Nächte; frei änderbar |
| Zusatzkosten | nein | beliebig viele Positionen aus Bezeichnung (Vorschläge Reinigung, Haustier, Frühstück, Parkplatz oder frei) und Betrag; Reinigungsgebühr der Wohnung wird bei neuen Buchungen automatisch eingetragen |
| Endbetrag | – | Übernachtungspreis + Zusatzkosten (berechnet); die Ortstaxe kommt in PROJ-16 getrennt dazu |
| Ablaufdatum | nur bei Option | vorbelegt mit heute + 7 Tage, nicht in der Vergangenheit |
| Notiz | nein | intern, max. 2000 Zeichen |
| Buchungsnummer | – | automatisch, z. B. „2026-0042“: fortlaufend je Kunde und Anreisejahr, gemeinsam für Buchungen und Optionen, unveränderlich |

### Angaben einer Sperre
Wohnung, von, bis, Grund (Eigennutzung, Renovierung, Sonstiges) und Notiz (bei „Sonstiges“ Pflicht).

### Ergänzung der Wohnung (PROJ-6)
Neues optionales Feld **Reinigungsgebühr** (Euro) je Wohnung, nur vom Inhaber pflegbar. Sie wird bei neuen Buchungen als Zusatzkosten-Position „Reinigung“ eingetragen und kann dort geändert oder entfernt werden.

### Bereiche
- **Buchungen** (Navigationspunkt): Liste eines Monats mit Blättern (Vor/Zurück/Heute); ein Eintrag erscheint in jedem Monat, in den sein Zeitraum fällt. Filter nach Wohnung, Art (Buchung, Option, Sperre) und Zustand (aktiv, storniert, verfallen); Suche nach Gast oder Buchungsnummer über alle Monate.
- **Buchungs-Detail:** Zeitraum, Wohnung, Gast (mit Link zur Gast-Detailseite), Personen, Mitreisende, Preis (nur Inhaber), Zustand, Aktionen je nach Rolle.
- **Neue Buchung / bearbeiten:** Formular mit Art (Buchung oder Option), Konflikt- und Kapazitätswarnung, Preisvorschlag.
- **Neue Sperre / bearbeiten.**
- **Gast-Detail (PROJ-7):** Aufenthalte (Anzahl, letzter, nächster) und Liste der Buchungen des Gastes.
- **Gästeliste (PROJ-7):** Aufenthalte und Sortierung „letzter Aufenthalt“ werden befüllt.

### Rollen
| Aktion | Inhaber | Mitarbeiter |
|---|---|---|
| Buchungen, Optionen, Sperren sehen | ✓ | ✓ |
| Buchung/Option anlegen und ändern (inkl. neuer Gast) | ✓ | ✓ |
| Mitreisende nachtragen | ✓ | ✓ |
| Option bestätigen | ✓ | ✓ |
| Preis, Zusatzkosten, Stornogebühr sehen und ändern | ✓ | – (Buchungen von Mitarbeitern erhalten den Preisvorschlag) |
| Trotz Überschneidung oder Überbelegung speichern | ✓ | – |
| Buchung/Option stornieren | ✓ | – |
| Sperre anlegen und ändern | ✓ | ✓ |
| Sperre löschen | ✓ | – |

Der Betreiber-Admin liest wie überall nur (PROJ-1).

## Out of Scope
- **Plattformbuchungen von Hand erfassen** (booking.com, Airbnb): nur über den Import (PROJ-11); verhindert Doppelerfassung
- **Sperren an booking.com/Airbnb senden:** PROJ-12 (der Hinweis im Entwurf „sperrt automatisch auf Booking.com und Airbnb“ erscheint erst dann)
- **Belegungskalender** (Zeitleiste, Monatsansicht): PROJ-9
- **Zahlungen, Anzahlungen, Status offen/bezahlt:** PROJ-13
- **Ortstaxe-Berechnung:** PROJ-15/16 (PROJ-8 liefert Personen, Alter und Nächte)
- **Vollständige Meldedaten** (Adresse, Staatsangehörigkeit, Ausweis der Mitreisenden): Gästeblatt PROJ-26
- **Anfragen** vor der Option sowie Erinnerungen per E-Mail (kein E-Mail-Versand, PROJ-22)
- **Stornierung zurücknehmen:** nicht möglich; die Buchung wird neu angelegt
- **Rechnungen, Bestätigungs-E-Mails an Gäste:** nicht Teil der App (PRD)
- **Mitreisende als wiederverwendbare Gäste:** bewusst nicht (Entscheidung PROJ-7)
- **Hauptgast, der nicht mitwohnt** (Firma bucht für andere): als Gast wird die wohnende Person angelegt, die Firma bei ihr eingetragen
- **Preisregeln** (Saisonpreise, Mindestaufenthalt, Rabatte je Dauer): nicht geplant
- **Bald ablaufende Optionen anzeigen:** Dashboard PROJ-14

## Acceptance Criteria

### Liste
- [ ] Angenommen der Kunde hat noch keine Buchungen, wenn ein Nutzer „Buchungen“ öffnet, dann sieht er den leeren Zustand mit „Neue Buchung“ und „Neue Sperre“
- [ ] Angenommen der Kunde hat noch keine aktive Wohnung, wenn ein Nutzer „Buchungen“ öffnet, dann erklärt die App, dass zuerst eine Wohnung angelegt werden muss (Inhaber mit Link zu „Wohnungen“), und „Neue Buchung“ ist nicht möglich
- [ ] Angenommen es gibt Buchungen im aktuellen Monat, wenn der Nutzer „Buchungen“ öffnet, dann sieht er alle Einträge, deren Zeitraum in diesen Monat fällt, sortiert nach Anreise, mit Nummer, Gast, Wohnung, Zeitraum, Nächten, Personen, Art und Zustand
- [ ] Angenommen der Nutzer ist Inhaber, wenn er die Liste sieht, dann wird je Buchung der Endbetrag angezeigt; ein Mitarbeiter sieht keine Beträge
- [ ] Angenommen der Nutzer blättert zum nächsten Monat, wenn die Liste lädt, dann zeigt sie die Einträge dieses Monats, und „Heute“ führt zum aktuellen Monat zurück
- [ ] Angenommen der Nutzer filtert nach Wohnung, Art oder Zustand, wenn die Liste lädt, dann zeigt sie nur passende Einträge; stornierte und verfallene sind ohne Filter ausgeblendet
- [ ] Angenommen der Nutzer sucht nach einem Gastnamen oder einer Buchungsnummer, wenn er mindestens 2 Zeichen eingibt, dann zeigt die Liste passende Einträge aus allen Monaten
- [ ] Angenommen die Seite wird auf dem Handy geöffnet, wenn die Liste erscheint, dann ist jeder Eintrag eine Karte ohne waagrechtes Scrollen

### Buchung anlegen
- [ ] Angenommen der Nutzer öffnet „Neue Buchung“, wenn er eine Wohnung wählt, dann sind Check-in/-out-Zeiten aus der Wohnung vorbelegt, und bei Inhabern ist die Reinigungsgebühr der Wohnung als Zusatzkosten eingetragen
- [ ] Angenommen der Nutzer gibt Anreise und Abreise ein, wenn die Abreise nicht nach der Anreise liegt, dann erscheint „Die Abreise muss nach der Anreise liegen“
- [ ] Angenommen Wohnung und Zeitraum sind gewählt, wenn der Inhaber das Formular sieht, dann ist der Übernachtungspreis mit Standardpreis × Nächte vorbelegt und der Endbetrag berechnet
- [ ] Angenommen der Inhaber hat den Preis von Hand geändert, wenn er danach den Zeitraum ändert, dann bietet die App den neuen Vorschlag an, übernimmt ihn aber nicht ungefragt
- [ ] Angenommen die Wohnung hat keinen Standardpreis, wenn der Inhaber den Zeitraum wählt, dann bleibt der Übernachtungspreis leer und ist Pflicht
- [ ] Angenommen ein Mitarbeiter legt eine Buchung an, wenn er speichert, dann erhält sie den Preisvorschlag (Standardpreis × Nächte, Reinigungsgebühr) ohne dass er Beträge sieht
- [ ] Angenommen der Nutzer sucht den Gast, wenn er einen bestehenden Gast wählt, dann ist dieser der Hauptgast
- [ ] Angenommen der Nutzer legt im Formular einen neuen Gast an (auch als Mitarbeiter), wenn er speichert, dann entstehen Gast und Buchung gemeinsam mit den Pflichtfeldern aus PROJ-7, und die Dublettenwarnung aus PROJ-7 erscheint vorher, falls ein ähnlicher Gast existiert
- [ ] Angenommen das Speichern der Buchung schlägt fehl, wenn dabei ein neuer Gast erfasst wurde, dann ist auch der Gast nicht angelegt, und die Eingaben bleiben erhalten
- [ ] Angenommen der Nutzer gibt 2 Erwachsene und 1 Kind mit Alter 4 ein, wenn er speichert, dann zeigt die Buchung „3 Personen (2 Erwachsene, 1 Kind)“
- [ ] Angenommen ein Kind ist erfasst, wenn kein Alter oder ein Alter außerhalb 0–17 eingegeben ist, dann erscheint eine Validierungsmeldung
- [ ] Angenommen alle Pflichtfelder sind gültig und es gibt keine Warnung, wenn der Nutzer speichert, dann ist die Buchung mit der nächsten Nummer des Anreisejahres angelegt und ihr Detail geöffnet
- [ ] Angenommen der Nutzer schickt das leere Formular ab, wenn er speichert, dann erscheint bei Wohnung, Anreise, Abreise, Hauptgast und (beim Inhaber) Übernachtungspreis eine Meldung

### Zusatzkosten (Inhaber)
- [ ] Angenommen der Inhaber fügt eine Position hinzu, wenn er eine Bezeichnung aus den Vorschlägen wählt oder frei eintippt und einen Betrag eingibt, dann erhöht sich der Endbetrag entsprechend
- [ ] Angenommen eine Position hat keine Bezeichnung oder einen negativen Betrag, wenn der Inhaber speichert, dann erscheint eine Validierungsmeldung
- [ ] Angenommen der Inhaber pflegt eine Wohnung (PROJ-6), wenn er eine Reinigungsgebühr einträgt, dann wird sie bei künftigen neuen Buchungen dieser Wohnung vorgeschlagen; bestehende Buchungen bleiben unverändert

### Konflikte und Kapazität
- [ ] Angenommen in derselben Wohnung gibt es eine aktive Buchung, Option oder Sperre mit überschneidendem Zeitraum, wenn der Nutzer Wohnung und Zeitraum wählt, dann warnt die App mit Gast bzw. Sperrgrund, Zeitraum und Art des anderen Eintrags
- [ ] Angenommen eine Buchung reist am selben Tag ab, an dem die neue anreist, wenn der Nutzer speichert, dann gibt es keine Warnung
- [ ] Angenommen der überschneidende Eintrag ist storniert, verfallen oder eine gelöschte Sperre, wenn der Nutzer speichert, dann gibt es keine Warnung
- [ ] Angenommen es gibt eine Überschneidung, wenn ein Mitarbeiter speichern will, dann ist Speichern nicht möglich
- [ ] Angenommen es gibt eine Überschneidung, wenn der Inhaber speichern will, dann muss er „Trotzdem speichern“ ausdrücklich bestätigen, und die Buchung ist danach als „überschneidet sich“ gekennzeichnet
- [ ] Angenommen die Personenzahl übersteigt die Kapazität der Wohnung, wenn der Nutzer speichern will, dann gilt dasselbe wie bei Überschneidungen (Warnung; Mitarbeiter blockiert; Inhaber bestätigt)
- [ ] Angenommen eine Sperre überschneidet sich mit einer Buchung, wenn der Nutzer sie speichert, dann gilt dieselbe Warnregel

### Optionen
- [ ] Angenommen der Nutzer wählt im Formular die Art „Option“, wenn er speichert, dann ist ein Ablaufdatum Pflicht (vorbelegt heute + 7 Tage) und darf nicht in der Vergangenheit liegen
- [ ] Angenommen eine Option ist aktiv, wenn ein anderer Eintrag denselben Zeitraum belegen will, dann warnt die Konfliktprüfung wie bei Buchungen
- [ ] Angenommen eine Option ist aktiv, wenn ein Nutzer „Bestätigen“ wählt, dann wird sie zur Buchung mit derselben Nummer
- [ ] Angenommen das Ablaufdatum einer Option ist vorbei, wenn ein Nutzer sie oder die Liste ansieht, dann ist sie „verfallen“ und belegt den Zeitraum nicht mehr, ohne dass jemand sie bearbeitet hat
- [ ] Angenommen eine Option ist verfallen, wenn ein Nutzer sie bestätigt, dann läuft die Konflikt- und Kapazitätsprüfung erneut, und bei freiem Zeitraum wird sie zur Buchung
- [ ] Angenommen eine Option ist aktiv, wenn der Nutzer das Ablaufdatum verlängert, dann gilt das neue Datum

### Bearbeiten
- [ ] Angenommen eine Buchung ist aktiv, wenn ein Nutzer Zeitraum, Wohnung, Gast, Personen, Zeiten oder Notiz ändert und speichert, dann gelten die Änderungen und die Konflikt- und Kapazitätsprüfung läuft erneut (ohne die Buchung selbst)
- [ ] Angenommen ein anderer Nutzer hat die Buchung inzwischen geändert, wenn der Nutzer speichert, dann erscheint ein Hinweis, die Seite neu zu laden, und nichts wird überschrieben
- [ ] Angenommen eine Buchung ist storniert oder verfallen, wenn ein Nutzer sie öffnet, dann sind nur Notiz (und beim Inhaber die Stornogebühr) änderbar
- [ ] Angenommen ein Mitarbeiter ändert eine Buchung, wenn er speichert, dann bleiben Preis und Zusatzkosten unverändert, auch wenn sich der Zeitraum geändert hat; der Inhaber sieht im Detail einen Hinweis „Zeitraum geändert, Preis prüfen“

### Mitreisende
- [ ] Angenommen eine Buchung hat 3 Personen, wenn der Nutzer Mitreisende nachträgt, dann kann er bis zu 2 Personen mit Vorname, Nachname und Geburtsdatum erfassen
- [ ] Angenommen ein Mitreisender ist erfasst, wenn Vor- oder Nachname fehlt oder das Geburtsdatum in der Zukunft liegt, dann erscheint eine Validierungsmeldung
- [ ] Angenommen bereits erfasste Mitreisende, wenn der Nutzer die Personenzahl unter Hauptgast + Mitreisende senkt, dann verlangt die App, zuerst Mitreisende zu entfernen

### Stornieren (Inhaber)
- [ ] Angenommen eine Buchung oder Option ist aktiv, wenn der Inhaber „Stornieren“ wählt, dann fragt ein Dialog optional nach Grund und Stornogebühr und verlangt eine Bestätigung
- [ ] Angenommen der Inhaber bestätigt das Stornieren, wenn es abgeschlossen ist, dann ist die Buchung „storniert“, gibt den Zeitraum frei, bleibt mit Grund, Gebühr, Person und Zeitpunkt sichtbar und ist nicht mehr aktivierbar
- [ ] Angenommen der Nutzer ist Mitarbeiter, wenn er eine Buchung öffnet, dann gibt es kein „Stornieren“

### Sperren
- [ ] Angenommen der Nutzer legt eine Sperre an, wenn er Wohnung, Zeitraum und Grund angibt und speichert, dann belegt sie den Zeitraum ohne Gast, Preis und Nummer
- [ ] Angenommen der Grund ist „Sonstiges“, wenn die Notiz leer ist, dann erscheint eine Validierungsmeldung
- [ ] Angenommen der Inhaber wählt bei einer Sperre „Löschen“ und bestätigt, dann ist sie entfernt und der Zeitraum frei; Mitarbeiter sehen kein „Löschen“

### Gäste und Wohnungen (Anschluss an PROJ-6/7)
- [ ] Angenommen ein Gast hat Buchungen, wenn ein Nutzer seine Detailseite öffnet, dann sieht er Anzahl der Aufenthalte, letzten und nächsten Aufenthalt und die Liste seiner Buchungen (stornierte gekennzeichnet)
- [ ] Angenommen Gäste haben Buchungen, wenn der Nutzer die Gästeliste nach „letzter Aufenthalt“ sortiert, dann erscheinen sie entsprechend
- [ ] Angenommen ein Gast hat Buchungen (auch stornierte), wenn der Inhaber ihn löscht, dann wird er gemäß PROJ-7 anonymisiert statt gelöscht, und die Buchungen bleiben mit „Gelöschter Gast“ erhalten
- [ ] Angenommen ein Gast ist anonymisiert, wenn ein Nutzer eine seiner Buchungen öffnet, dann sind auch die Mitreisenden dieser Buchungen entfernt; Anzahl und Alter der Personen bleiben
- [ ] Angenommen der Inhaber führt zwei Gäste zusammen, wenn es abgeschlossen ist, dann gehören alle Buchungen beider Gäste dem verbleibenden Gast
- [ ] Angenommen eine Wohnung hat oder hatte Buchungen oder Sperren, wenn der Inhaber sie öffnet, dann gibt es kein „Endgültig löschen“ (PROJ-6)
- [ ] Angenommen eine Wohnung hat künftige aktive Buchungen oder Optionen, wenn der Inhaber sie archivieren will, dann nennt der Bestätigungsdialog deren Anzahl; die Buchungen bleiben bestehen
- [ ] Angenommen der Inhaber senkt die Personenzahl einer Wohnung, wenn künftige Buchungen mehr Personen haben, dann zeigt die App vor dem Speichern deren Anzahl als Hinweis

## Edge Cases
- **Buchung in der Vergangenheit:** erlaubt (Nachtragen alter Buchungen); keine Warnung außer Konflikt/Kapazität.
- **Sehr lange Aufenthalte (Dienstwohnungen):** bis 365 Nächte; die Anreise höchstens 3 Jahre in der Zukunft.
- **Anreisejahr wechselt beim Bearbeiten:** Die Buchungsnummer bleibt unverändert.
- **Option verfällt, während jemand das Formular offen hat:** Beim Speichern gilt der Stand zum Zeitpunkt des Speicherns; eine verfallene Option wird nicht stillschweigend bestätigt.
- **Zwei Nutzer legen gleichzeitig Buchungen für denselben Zeitraum an:** Die Prüfung läuft beim Speichern in der Datenbank; der zweite erhält die Konfliktwarnung (Mitarbeiter blockiert, Inhaber muss bestätigen).
- **Wohnung wird archiviert, während Buchungen in der Zukunft liegen:** Die Buchungen bleiben bearbeitbar, die Wohnung ist aber für neue Buchungen und beim Wechsel der Wohnung nicht mehr wählbar.
- **Gast wird während des Bearbeitens zusammengeführt oder anonymisiert:** Beim Speichern gilt der Stale-Hinweis; die Buchung zeigt danach den verbleibenden bzw. anonymisierten Gast.
- **Reinigungsgebühr der Wohnung ändert sich:** Nur neue Buchungen erhalten den neuen Betrag.
- **Mitarbeiter wechselt die Wohnung einer Buchung:** Preis bleibt; der Inhaber sieht „Preis prüfen“.
- **Netzwerkfehler beim Speichern:** Meldung, Eingaben bleiben erhalten, kein halber Zustand (Gast ohne Buchung).
- **Hauptgast ist anonymisiert:** Die Buchung bleibt; ein anonymisierter Gast kann für neue Buchungen nicht gewählt werden.

## Technical Requirements
- Sicherheit: Abschottung je Kunde in der Datenbank (Muster PROJ-1); Preis-, Zusatzkosten- und Stornogebühr-Angaben für Mitarbeiter auch serverseitig nicht lesbar und nicht schreibbar
- Konflikt-, Kapazitäts- und Rollenregeln (Übersteuern nur Inhaber) werden serverseitig durchgesetzt, nicht nur im Formular
- Gast und Buchung entstehen in einem Vorgang (Entscheidung PROJ-7)
- Änderungsprotokoll für Buchungen, Sperren, Mitreisende (PROJ-1); Mitreisende sind beim Anonymisieren des Gastes zu entfernen
- Beträge in Euro mit Cent, österreichisches Format; Daten in österreichischem Format
- Liste eines Monats lädt bei einigen hundert Buchungen ohne spürbare Verzögerung

## Open Questions
- [ ] Wie verhalten sich vom Inhaber übersteuerte Überschneidungen, wenn PROJ-12 Sperren an Channex sendet bzw. PROJ-11 eine überschneidende Plattformbuchung importiert? (Klärung in PROJ-11/12)
- [ ] Welche Meldedaten der Mitreisenden braucht das Gästeblatt zusätzlich (Staatsangehörigkeit, Adresse, Ausweis)? (Klärung in PROJ-26)
- [ ] Altersgrenzen der Ortstaxe-Befreiungen je Gemeinde (Alter bei Anreise reicht?) (Klärung in PROJ-15)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Von Hand nur Direktbuchungen, Optionen und Sperren; keine Plattformbuchungen | Plattformbuchungen kommen über den Import (PROJ-11); Handerfassung würde Doppelungen erzeugen | 2026-10-26 |
| Überschneidungen: Warnung; nur Inhaber dürfen trotzdem speichern | Vom Nutzer so entschieden; deckt Sonderfälle ab, Mitarbeiter können keine Doppelbuchung erzeugen | 2026-10-26 |
| Abreisetag = Anreisetag ist keine Überschneidung; stornierte und verfallene zählen nicht | Üblicher Wechseltag in der Vermietung | 2026-10-26 |
| Mitarbeiter: anlegen und ändern, aber nicht stornieren und keine Preise | Vom Nutzer so entschieden; PRD: kein Zugriff auf Zahlungen; Storno hat finanzielle Folgen | 2026-10-26 |
| Preis = Übernachtungspreis + Zusatzkosten-Positionen; Ortstaxe getrennt | Vom Nutzer so entschieden; die Ortstaxe hängt von Personen, Alter und Nächten ab, nicht vom Preis | 2026-10-26 |
| Reinigungsgebühr je Wohnung, automatisch als Position eingetragen | Vom Nutzer so entschieden; erspart die Eingabe bei jeder Buchung | 2026-10-26 |
| Personen als Erwachsene + Kinder mit Alter; Mitreisende namentlich optional und nachtragbar | Ortstaxe braucht Anzahl und Alter; Namen sind beim Buchen oft noch unbekannt, beim Check-in bekannt | 2026-10-26 |
| Hauptgast wohnt immer selbst mit | Vom Nutzer so entschieden; bei Firmenbuchungen wird die wohnende Person mit Firma als Gast angelegt | 2026-10-26 |
| Zustände Option / Buchung / storniert / verfallen | Vom Nutzer gewünscht: Direktbuchungen beginnen oft als Option | 2026-10-26 |
| Optionen verfallen automatisch nach Ablaufdatum | Kein E-Mail-Versand; ohne Automatik würden vergessene Optionen Zeiträume blockieren | 2026-10-26 |
| Überbelegung wie Überschneidung behandelt | Einheitliche Regel; Sonderfälle (Baby im Reisebett) entscheidet der Inhaber | 2026-10-26 |
| Storno mit optionalem Grund und Stornogebühr, nicht rücknehmbar | Gebühr wird für Zahlungen (PROJ-13) und Umsatz (PROJ-18) gebraucht; Rücknahme selten, Neuanlage genügt | 2026-10-26 |
| Sperren werden gelöscht, nicht storniert; löschen nur Inhaber | Vom Nutzer so entschieden; analog zum Stornieren von Buchungen | 2026-10-26 |
| Liste mit Monatsblättern, Filtern und Suche über alle Monate | Vom Nutzer so entschieden; bis zum Kalender (PROJ-9) die zentrale Übersicht | 2026-10-26 |
| Buchungsnummer fortlaufend je Kunde und Anreisejahr, gemeinsam für Buchungen und Optionen, Sperren ohne Nummer | Bezug in Telefonat, E-Mail und Rechnung; die Option behält beim Bestätigen ihre Nummer | 2026-10-26 |
| Mitarbeiter-Buchungen erhalten den Preisvorschlag; bei Änderungen durch Mitarbeiter Hinweis „Preis prüfen“ | Mitarbeiter sehen keine Preise, die Buchung soll trotzdem einen Betrag haben | 2026-10-26 |

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
