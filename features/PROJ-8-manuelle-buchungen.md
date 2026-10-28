# PROJ-8: Manuelle Buchungen

## Status: Deployed
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
| Eine Tabelle für Buchungen, Optionen und Sperren mit „Art“ | Alle belegen Zeiträume; Konfliktprüfung, Liste, Kalender (PROJ-9) und Channex-Sperren (PROJ-12) brauchen sie gemeinsam | 2026-10-26 |
| Beträge und Zusatzkosten in eigenen, nur für Inhaber lesbaren Tabellen | Zugriffsregeln wirken je Zeile, nicht je Spalte; nur so sind Preise für Mitarbeiter auch in der Datenbank unsichtbar | 2026-10-26 |
| Schreiben über geschützte Datenbank-Funktionen statt direkt in die Tabellen | Warnung mit Inhaber-Übersteuerung, Preisvorschlag für Mitarbeiter, neuer Gast + Buchung und Nummernvergabe müssen gemeinsam und unumgehbar geprüft werden | 2026-10-26 |
| Konfliktprüfung in der Speicherfunktion mit Reservierung der Wohnung statt starrer Datenbanksperre | Eine starre Sperre ließe kein Übersteuern durch Inhaber zu; die Reservierung verhindert, dass zwei gleichzeitige Speichervorgänge die Prüfung umgehen | 2026-10-26 |
| Zustand (aktiv/verfallen/storniert) und „überschneidet sich“ berechnet statt gespeichert | Optionen verfallen pünktlich ohne nächtlichen Job; keine veralteten Kennzeichen | 2026-10-26 |
| Zeiträume als Anreise/Abreise-Datum, Abreisetag nicht belegt | Wechseltag ohne Sonderlogik; passt zu Nächte-Zählung und Ortstaxe | 2026-10-26 |
| Nummernkreis je Kunde und Jahr in eigener Tabelle | Lückenlos und sicher bei gleichzeitigem Anlegen; Nummer bleibt unverändert | 2026-10-26 |
| Beträge in Cent, Endbetrag nie gespeichert | Keine Rundungsfehler; Endbetrag kann nicht von den Positionen abweichen | 2026-10-26 |
| Kinder als Liste ihrer Alter an der Buchung, Mitreisende als eigene Tabelle | Ortstaxe braucht das Alter auch ohne Namen; Mitreisende werden später für PROJ-26 erweitert und beim Anonymisieren entfernt | 2026-10-26 |
| Löschsperre über Verweise von Buchung auf Wohnung und Gast | Setzt die vorbereiteten Regeln aus PROJ-6/7 ohne Zusatzlogik durch | 2026-10-26 |
| Eingebaute Datumsfelder, keine Kalender-Bibliothek | Wie im Entwurf und PROJ-7; kein zusätzliches Paket; Kalender folgt in PROJ-9 | 2026-10-26 |
| Standardpreis/Reinigungsgebühr der Wohnung bleiben technisch für Mitarbeiter lesbar | Listenpreise, wie seit PROJ-6; geschützt werden die vereinbarten Beträge je Buchung | 2026-10-26 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Abschottungsmuster aus PROJ-1:** Kundenkennung je Tabelle, Lesen für Mitglieder und Betreiber-Admin (2FA), Schreiben nach Rolle, Standardfelder und Änderungsprotokoll per Aufruf je Tabelle.
- **Wohnungen (PROJ-6):** Personenzahl, Standardpreis je Nacht, Check-in/-out-Zeiten, „archiviert am“. Die Anzeige „Objekt · Wohnung“ gibt es als gemeinsame Hilfsfunktion.
- **Gäste (PROJ-7):** Gastsuche, Gast-Formular, Dublettenprüfung, die Funktionen „Zusammenführen“ und „Löschen/Anonymisieren“ mit vorbereiteten Stellen für Buchungen. Die Gästeliste liefert bereits die Spalten „Aufenthalte“ und „letzter Aufenthalt“, derzeit leer.
- **Navigation:** „Buchungen“ (`/buchungen`) ist seit PROJ-2 angelegt und noch „in Vorbereitung“. Auf dem Handy liegt der Punkt in der unteren Leiste.
- **Bausteine:** Seitenkopf, Leerzustand, Detail-Panel (seitliches Formular), Bestätigungsdialog. Dazu die shadcn-Bausteine Table, Input, Select, Radio Group, Checkbox, Badge, Alert, Alert Dialog, Tabs, Popover und Command.
- **Muster für Server-Aktionen:** gemeinsame Prüfregeln für Browser und Server, Meldungen aus `messages/de.json`, kein eigenes API. Zeitzone und Formate fest auf Europe/Vienna bzw. de-AT.

### A) Seiten und Bausteine

```
/buchungen  (alle Mitglieder)
+-- Kopf: „Buchungen“ + Knöpfe „Neue Buchung“ · „Neue Sperre“
+-- Monatsleiste: ‹ Oktober 2026 › · „Heute“
+-- Suchfeld (Gast, Buchungsnummer; sucht über alle Monate)
+-- Filter: Wohnung · Art (Buchung, Option, Sperre) · Zustand (aktiv, storniert, verfallen)
+-- Liste
|   +-- Desktop/Tablet: Tabelle (Nr., Anreise–Abreise, Nächte, Gast/Sperrgrund, Wohnung, Personen, Art/Zustand, Betrag nur Inhaber)
|   +-- Handy: Karten mit denselben Angaben
|   +-- Kennzeichen: „Option bis …“, „verfallen“, „storniert“, „überschneidet sich“, „Preis prüfen“ (nur Inhaber)
+-- Leerzustände: keine Wohnung (Link zu Wohnungen) · keine Buchungen · nichts gefunden

/buchungen/[id]  Buchungs-Detail (alle Mitglieder)
+-- Kopf: Nummer, Gast, Wohnung, Art und Zustand
+-- Abschnitt Aufenthalt: Anreise/Abreise mit Zeiten, Nächte, Personen (Erwachsene, Kinder mit Alter)
+-- Abschnitt Gast: Name, Herkunft, Link zur Gast-Detailseite
+-- Abschnitt Mitreisende: Liste + „Mitreisende bearbeiten“
+-- Abschnitt Preis (nur Inhaber): Übernachtungen, Zusatzkosten-Positionen, Endbetrag, ggf. Stornogebühr, Hinweis „Preis prüfen“
+-- Abschnitt Option: Ablaufdatum, „Bestätigen“, „Verlängern“
+-- Abschnitt Storno: Grund, Gebühr, wer und wann
+-- Aktionen: Bearbeiten · Option bestätigen · Stornieren (nur Inhaber)

Detail-Panel „Neue Buchung / Buchung bearbeiten“
+-- Art: Buchung | Option (bei Option: Ablaufdatum)
+-- Wohnung (nur aktive; beim Bearbeiten bleibt eine inzwischen archivierte sichtbar)
+-- Anreise, Abreise (Datumsfelder), Anzeige Nächte; Check-in/-out-Zeiten (vorbelegt)
+-- Gast: Suche (Baustein aus PROJ-7) oder „Neuer Gast“ → Gast-Felder (Baustein aus PROJ-7)
+-- Personen: Erwachsene (≥ 1) · Kinder: „Kind hinzufügen“ → je ein Altersfeld
+-- Preis (nur Inhaber): Übernachtungspreis mit Vorschlag · Zusatzkosten-Positionen · Endbetrag
+-- Notiz
+-- Warnbereich: Überschneidung (mit welcher Buchung/Sperre) · Überbelegung
|   +-- Inhaber: Häkchen „Trotzdem speichern“ · Mitarbeiter: Speichern gesperrt
+-- Dublettenhinweis für den neuen Gast (wie PROJ-7)

Detail-Panel „Neue Sperre / Sperre bearbeiten“
+-- Wohnung, von, bis, Grund (Eigennutzung, Renovierung, Sonstiges), Notiz
+-- derselbe Warnbereich · „Sperre löschen“ (nur Inhaber)

Detail-Panel „Mitreisende bearbeiten“
+-- je Person Vorname, Nachname, Geburtsdatum · höchstens Personen minus 1

Dialog „Stornieren“ (nur Inhaber): Grund (optional), Stornogebühr (optional), Bestätigung

Ergänzungen bestehender Seiten
+-- Wohnung bearbeiten (PROJ-6): Feld „Reinigungsgebühr“; Archivieren-Dialog nennt künftige Buchungen;
|   Hinweis bei Personenzahl unter künftigen Buchungen
+-- Gast-Detail (PROJ-7): Abschnitt Aufenthalte mit Anzahl, letztem/nächstem und Liste der Buchungen
+-- Gästeliste (PROJ-7): Spalten Aufenthalte/letzter Aufenthalt befüllt, Sortierung danach
```

### B) Datenmodell (in Worten)

**Buchungen** (eine Tabelle für Buchungen, Optionen und Sperren, je Kunde)
- Kunde, Wohnung
- Art: Buchung, Option oder Sperre
- Kanal: „Direkt“ (PROJ-11 ergänzt später booking.com und Airbnb)
- Buchungsnummer: Jahr + laufende Nummer (leer bei Sperren), je Kunde eindeutig
- Anreise, Abreise (Datum; Abreise nach Anreise, 1–365 Nächte), Check-in-, Check-out-Zeit
- Hauptgast (Pflicht bei Buchung und Option, leer bei Sperren)
- Erwachsene (mindestens 1), Alter der Kinder (Liste von Zahlen 0–17); die Personenzahl ergibt sich daraus
- Sperrgrund (Eigennutzung, Renovierung, Sonstiges), nur bei Sperren
- Ablaufdatum, nur bei Optionen
- Storniert am, storniert von, Stornogrund
- „Überschneidung bestätigt von/am“: wer trotz Warnung gespeichert hat
- „Preis prüfen“: gesetzt, wenn ein Mitarbeiter Zeitraum oder Wohnung geändert hat; der Inhaber löscht es durch Speichern des Preises
- Notiz (max. 2.000 Zeichen)
- Standardfelder und Änderungsprotokoll (PROJ-1)

**Buchungsbeträge** (nur für Inhaber lesbar, eine Zeile je Buchung oder Option)
- Buchung, Übernachtungspreis, Stornogebühr (in Cent)

**Zusatzkosten-Positionen** (nur für Inhaber lesbar)
- Buchung, Bezeichnung (max. 100 Zeichen), Betrag (nicht negativ), Reihenfolge

**Mitreisende** (für alle Mitglieder lesbar)
- Buchung, Vorname, Nachname, Geburtsdatum

**Nummernkreis** (intern): je Kunde und Jahr die zuletzt vergebene Nummer

**Wohnungen** (Ergänzung): Reinigungsgebühr (optional, in Cent)

**Zustand wird berechnet, nicht gespeichert:**
- storniert: „storniert am“ ist gesetzt
- verfallen: Option, deren Ablaufdatum vor dem heutigen Tag (Wien) liegt
- sonst aktiv. Nur aktive Einträge belegen ihren Zeitraum.
- Damit verfallen Optionen ohne nächtlichen Job pünktlich, und es gibt keinen gespeicherten Zustand, der veralten kann.

**Regeln in der Datenbank:**
- Gast Pflicht bei Buchung und Option, verboten bei Sperre; Sperrgrund nur bei Sperren; Ablaufdatum nur bei Optionen
- Wohnung und Gast verweisen mit Löschsperre. Damit greifen die Regeln aus PROJ-6 („Endgültig löschen“ nur ohne Buchungen) und PROJ-7 („mit Buchungen nur anonymisieren“) ohne Zusatzlogik.
- Buchungen und Optionen werden nie gelöscht, nur storniert. Sperren darf nur der Inhaber löschen.
- Wohnung, Gast und Buchung gehören immer zum selben Kunden.

### C) Rechte
| Aktion | Inhaber | Mitarbeiter | Betreiber-Admin (2FA) |
|---|---|---|---|
| Buchungen, Sperren, Mitreisende lesen | ✓ | ✓ | ✓ lesend |
| Beträge und Zusatzkosten lesen | ✓ | – | ✓ lesend |
| Buchung/Option anlegen, ändern, bestätigen (inkl. neuer Gast) | ✓ | ✓ | – |
| Beträge und Zusatzkosten setzen | ✓ | – (Vorschlag automatisch) | – |
| Trotz Warnung speichern | ✓ | – | – |
| Stornieren | ✓ | – | – |
| Sperre anlegen/ändern | ✓ | ✓ | – |
| Sperre löschen | ✓ | – | – |
| Mitreisende bearbeiten | ✓ | ✓ | – |

- **Preise sind für Mitarbeiter auch in der Datenbank unsichtbar:** Beträge stehen deshalb in eigenen Tabellen, die nur Inhaber lesen dürfen, und nicht als Spalten der Buchung. Die Seiten fragen die Beträge nur für Inhaber ab.
- **Speichern läuft über eine geschützte Datenbank-Funktion** („Buchung speichern“), nicht über direktes Schreiben in die Tabellen. Sie prüft die Rolle selbst und erledigt in einem Vorgang (alles oder nichts):
  1. Rechte und Pflichtangaben prüfen;
  2. die Wohnung für die Dauer des Vorgangs reservieren, damit zwei gleichzeitige Speichervorgänge für dieselbe Wohnung nacheinander laufen;
  3. Überschneidungen und Kapazität prüfen und sie bei fehlender Bestätigung als Warnungen zurückgeben, ohne zu speichern. Eine Bestätigung zählt nur, wenn der Nutzer Inhaber ist;
  4. bei Bedarf den neuen Gast anlegen (auch für Mitarbeiter, Entscheidung PROJ-7);
  5. die Nummer vergeben, die Buchung schreiben und den Preis schreiben: vom Inhaber wie eingegeben, für Mitarbeiter-Buchungen als Vorschlag (Standardpreis × Nächte plus Reinigungsgebühr). Ändert ein Mitarbeiter eine bestehende Buchung, bleibt der Preis unverändert und „Preis prüfen“ wird bei Bedarf gesetzt.
- **Eigene geschützte Funktionen** gibt es für Stornieren (nur Inhaber), Option bestätigen (mit erneuter Prüfung) und Mitreisende speichern.
- **Lesen** läuft wie bisher direkt über die Tabellen mit Zugriffsregeln.

### D) Konflikt- und Kapazitätsprüfung
- **Überschneidung:** dieselbe Wohnung, aktive Einträge und Zeiträume, die sich schneiden. Ein Abreisetag am Anreisetag der nächsten Buchung zählt nicht. Die bearbeitete Buchung selbst zählt nicht.
- **Kapazität:** Erwachsene + Kinder gegen die Personenzahl der Wohnung.
- **Vorschau im Formular:** Sobald Wohnung und Zeitraum stehen, fragt das Formular die Prüfung ab und zeigt die Warnung schon vor dem Speichern. Verbindlich ist die Prüfung beim Speichern in der Datenbank. Hat sich inzwischen etwas geändert, erscheint die Warnung dann.
- **Kennzeichen „überschneidet sich“:** Es wird bei Anzeige berechnet, nicht gespeichert. So verschwindet es, sobald die andere Buchung storniert wird.
- **Schnelle Abfrage:** ein Index auf Wohnung und Zeitraum, damit Prüfung, Monatsliste und später der Kalender (PROJ-9) bei vielen Buchungen schnell bleiben.

### E) Buchungsnummer
- Format „JJJJ-NNNN“ (ab 10.000 einfach fünfstellig), Jahr = Anreisejahr beim Anlegen.
- Vergeben von der Funktion „Buchung speichern“ über den Nummernkreis je Kunde und Jahr. Das ist sicher bei gleichzeitigem Anlegen, ohne Lücken durch abgebrochene Vorgänge.
- Die Nummer ändert sich nie, auch nicht, wenn sich die Anreise ändert oder die Option bestätigt wird.

### F) Preis
- **Vorschlag:** Standardpreis der Wohnung × Nächte, dazu die Reinigungsgebühr als Position „Reinigung“. Er wird im Formular berechnet (Inhaber) bzw. in der Datenbank (Mitarbeiter).
- **Hat der Inhaber den Preis von Hand geändert,** zeigt das Formular bei einem neuen Zeitraum „Neuer Vorschlag: € … übernehmen“, statt den Preis zu überschreiben.
- **Beträge** werden in Cent gespeichert (keine Rundungsfehler) und als Euro im österreichischen Format angezeigt.
- **Der Endbetrag** wird immer berechnet (Übernachtungen + Positionen) und nie gespeichert. Die Stornogebühr wird getrennt geführt. PROJ-13 und PROJ-18 lesen beides.

### G) Liste und Suche
- **Monatsliste:** alle Einträge, deren Zeitraum den Monat berührt, sortiert nach Anreise. Monat, Filter und Suchbegriff stehen in der Adresse (teilbar, „Zurück“ funktioniert).
- **Ohne Zustandsfilter:** stornierte und verfallene Einträge sind ausgeblendet.
- **Suche:** über den vereinheitlichten Gastnamen (Suchtext aus PROJ-7) und die Buchungsnummer, über alle Monate, neueste zuerst, höchstens 50 Treffer.
- **Datenmenge:** Ein Monat hat bei Pilotkunden höchstens einige hundert Einträge und wird ohne Blättern vollständig geladen.

### H) Anschluss an PROJ-6 und PROJ-7
- **Zusammenführen (PROJ-7):** Die Funktion hängt zusätzlich alle Buchungen des entfernten Gastes auf den verbleibenden um.
- **Löschen/Anonymisieren (PROJ-7):**
  - Ob ein Gast „Buchungen hat“, wird aus den Buchungen ermittelt, auch aus stornierten.
  - Beim Anonymisieren werden zusätzlich die Mitreisenden aller Buchungen dieses Gastes entfernt, und deren Altwerte im Änderungsprotokoll bereinigt.
  - Anzahl und Alter der Personen bleiben für Ortstaxe und Statistik.
- **Gästeliste und Gast-Detail (PROJ-7):**
  - Aufenthalte zählen aktive Buchungen, ohne Optionen.
  - Letzter Aufenthalt ist die jüngste Anreise bis heute, nächster Aufenthalt die früheste Anreise danach.
  - Alles wird aus den Buchungen berechnet, wie in PROJ-7 entschieden.
- **Anonymisierte Gäste** sind in der Gastsuche für neue Buchungen nicht wählbar.
- **Wohnungen (PROJ-6):**
  - neues Feld Reinigungsgebühr;
  - Archivieren und Senken der Personenzahl zeigen die Zahl betroffener künftiger Buchungen (nur Hinweis);
  - „Endgültig löschen“ ist gesperrt, sobald es Buchungen oder Sperren gibt.

### I) Gleichzeitiges Bearbeiten
- **Wie bei Gästen (PROJ-7):** Das Formular merkt sich „zuletzt geändert am“. Hat jemand anderer inzwischen gespeichert, erscheint „Diese Buchung wurde inzwischen geändert“ mit „Aktuelle Fassung laden“, und die Eingaben bleiben stehen.
- **Option verfällt, während das Formular offen ist:** Es gilt der Zustand beim Speichern. Eine verfallene Option wird nur über „Bestätigen“ mit erneuter Prüfung wieder zur Buchung.

### J) Schnittstelle zu späteren Features
- **PROJ-9 Kalender:** liest dieselben Buchungen pro Zeitraum. Die Farbe richtet sich nach dem Kanal, Sperren sind schraffiert (Entwurf).
- **PROJ-11 Import:** schreibt Buchungen mit Kanal booking.com/Airbnb in dieselbe Tabelle. Die Konfliktprüfung meldet dann Überschneidungen mit Direktbuchungen.
- **PROJ-12:** sendet aktive Buchungen, Optionen und Sperren als Sperren an Channex. Der offene Punkt zu übersteuerten Überschneidungen wird dort geklärt.
- **PROJ-13 Zahlungen:** knüpfen an die Buchung an und lesen Endbetrag und Stornogebühr.
- **PROJ-16 Ortstaxe:** liest Nächte, Erwachsene und Alter der Kinder.
- **PROJ-26 Gästeblatt:** ergänzt Felder bei den Mitreisenden, ohne bestehende zu ändern.

### K) Tests
- **Integrationstests gegen „apppa-dev“:**
  - Abschottung zwischen Kunden;
  - Mitarbeiter lesen keine Beträge und können sie nicht schreiben;
  - Buchungen von Mitarbeitern erhalten den Preisvorschlag;
  - Mitarbeiter können weder stornieren noch Sperren löschen noch Warnungen übersteuern;
  - Überschneidung: Wechseltag erlaubt, stornierte und verfallene Einträge zählen nicht;
  - Kapazität;
  - Nummernvergabe fortlaufend je Jahr, auch bei gleichzeitigem Anlegen;
  - neuer Gast und Buchung entstehen alles oder nichts;
  - Option verfällt und lässt sich bestätigen;
  - Stornieren mit Gebühr;
  - Zusammenführen hängt Buchungen um;
  - Anonymisieren entfernt Mitreisende;
  - Löschsperre für Wohnung und Gast;
  - Schutz vor Überschreiben bei gleichzeitiger Änderung.
- **E2E:**
  - Leerzustände;
  - Buchung mit bestehendem bzw. neuem Gast;
  - Preisvorschlag mit Reinigung und Zusatzkosten;
  - Konfliktwarnung (Inhaber übersteuert, Mitarbeiter blockiert);
  - Option anlegen, bestätigen, verfallen;
  - Stornieren;
  - Sperre anlegen und löschen;
  - Mitreisende nachtragen;
  - Monatsblättern, Filter und Suche;
  - Mitarbeiter ohne Beträge;
  - Handy-Ansicht;
  - axe;
  - Aufenthalte im Gast-Detail.
- **Unit-Tests:**
  - Nächte und Überschneidungslogik (Wechseltag);
  - Preisvorschlag;
  - Zustand (aktiv, verfallen, storniert);
  - Format der Buchungsnummer;
  - Prüfregeln (Zeitraum, Personen, Kinderalter, Positionen, Ablaufdatum).

### L) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- **Fünf neue Tabellen mit Zugriffsregeln:**
  - Buchungen und Mitreisende: lesen alle Mitglieder;
  - Buchungsbeträge und Zusatzkosten: lesen nur Inhaber;
  - Nummernkreis: nur intern.
- **Schreiben** nur über geschützte Funktionen, die die Rolle selbst prüfen: Speichern, Stornieren, Bestätigen, Mitreisende. Einzige Ausnahme ist „Sperre löschen“, direkt erlaubt nur für Inhaber.
- **Geänderte Funktionen aus PROJ-7:** Zusammenführen, Löschen/Anonymisieren und die Gästeliste.
- **Neues Feld bei den Wohnungen:** Reinigungsgebühr. Die bestehenden Regeln für Wohnungen bleiben.
- **Hinweis:** Standardpreis und Reinigungsgebühr der Wohnung bleiben für Mitarbeiter technisch lesbar, wie seit PROJ-6 beim Standardpreis. Die Oberfläche zeigt sie ihnen nicht. Geschützt sind die Beträge der einzelnen Buchungen.

### M) Abhängigkeiten
- **Keine neuen Pakete.**
  - Datumsfelder sind die eingebauten Datumsfelder des Browsers, wie im Entwurf und beim Geburtsdatum in PROJ-7. Auf dem Handy öffnen sie die gewohnte Datumsauswahl.
  - Die Kalenderdarstellung kommt erst mit PROJ-9.

## Implementation Notes (Frontend)
**Stand 2026-10-26.** Die Oberfläche ist fertig. Schreibende Aktionen prüfen Rolle und Eingaben und melden bis zum Backend „Diese Funktion wird gerade eingerichtet“. In der Entwicklung (`npm run dev`) zeigen Liste und Detail sieben Beispieleinträge auf den echten Wohnungen und Gästen des Kunden (Buchung mit Kind und Mitreisendem, Option, verfallene Option, Sperre mit Überschneidung, stornierte und vergangene Buchung); im Build bzw. in Staging und Production ist die Liste leer.

**Seiten** (`src/app/(app)/buchungen/`)
- `page.tsx`: Monatsliste. Ohne Kunde der Hinweis „keinem Kunden zugeordnet“; ohne Wohnung der Leerzustand mit Link zu den Wohnungen (Inhaber); ohne Buchungen der Leerzustand mit „Neue Buchung“ und „Neue Sperre“; „Keine Einträge gefunden“ mit „Suche und Filter zurücksetzen“ (bleibt im Monat)
- `[id]/page.tsx`: Detail mit Aufenthalt (Zeiten, Nächte, Personen, Kinderalter, Kanal, Notiz), Hauptgast (Link zur Gast-Detailseite), Mitreisenden, Preis (nur Inhaber: Übernachtungen, Positionen, Endbetrag, Stornogebühr, Hinweis „Preis prüfen“), Hinweisen zu verfallener Option, Storno und Überschneidung (mit Links zu den anderen Einträgen)
- **Navigation:** „Buchungen“ ist freigeschaltet (`ready: true`)
- **App-Rahmen:** liefert 404 für unbekannte Buchungen schon vor dem Streaming (Muster aus PROJ-5/7)

**Bausteine** (`src/components/bookings/`)
- `booking-filters.tsx`: Monatsleiste (‹ Monat › · „Heute“, ausgeblendet während einer Suche), Suche (300 ms Verzögerung) über alle Monate, Filter Wohnung, Art, Zustand („Nur aktive“ als Standard); alles in der Adresse (`?monat`, `wohnung`, `art`, `zustand`, `q`)
- `booking-list.tsx`: Tabelle ab 768 px, darunter Karten; Beträge nur für Inhaber
- `booking-badges.tsx`: Art, Zustand, „Option bis …“, „überschneidet sich“, „Preis prüfen“
- `booking-panel.tsx`: Neue Buchung bzw. Option / bearbeiten. Wohnung (nur aktive; die bisherige bleibt beim Bearbeiten sichtbar), Zeiten aus der Wohnung, Gast suchen (`GuestPicker`) oder neu anlegen (`GuestFields` in einem eigenen Formular ohne eigenes `<form>`), Dublettenhinweis mit „Bestehenden Gast verwenden“ bzw. „Trotzdem anlegen“, Erwachsene und Kinder mit Alter, Preis mit Vorschlag (Standardpreis × Nächte; nach Handänderung nur als „Neuen Vorschlag übernehmen“), Zusatzkosten mit Vorschlägen (Reinigung, Haustier, Frühstück, Parkplatz), Endbetrag, Notiz. Mitarbeiter sehen statt des Preises einen Hinweis
- `use-booking-warnings.ts` + `booking-warnings.tsx`: Vorschau der Konflikt- und Kapazitätsprüfung, sobald Wohnung und Zeitraum stehen. Inhaber setzen „Trotzdem speichern“ (gilt nur für die gezeigten Warnungen), für Mitarbeiter ist Speichern gesperrt
- `block-panel.tsx`: Sperre anlegen/bearbeiten (Wohnung, von, bis = frei ab, Grund, Notiz; bei „Sonstiges“ Pflicht), dieselbe Warnung, „Sperre löschen“ nur für Inhaber
- `companions-panel.tsx`: Mitreisende (Vor-, Nachname, Geburtsdatum optional), höchstens Personen minus 1; Nachname des Hauptgastes vorbelegt
- `cancel-dialog.tsx`: Stornieren mit optionalem Grund und Stornogebühr (nur Inhaber)
- `booking-actions.tsx`: Bearbeiten, Option bestätigen (auch verfallene), Mitreisende, Stornieren; nicht mehr aktive Einträge nur „Notiz bearbeiten“ (Inhaber bei stornierten zusätzlich Stornogebühr)
- `new-booking-buttons.tsx`: „Neue Buchung“ und „Neue Sperre“

**Regeln** (`src/lib/bookings.ts`, Unit-Tests): Nächte, Wechseltag-Überschneidung, Konflikte (nur aktive Einträge derselben Wohnung), Zustand (storniert / verfallen / aktiv, Datum in Wien), Kapazität, Preisvorschlag, Endbetrag, Beträge mit Komma und Tausenderpunkt, Buchungsnummer, Monate, Filter aus der Adresse.

**Prüfregeln** (`src/lib/validation/bookings.ts`, Unit-Tests): Zeitraum (Abreise nach Anreise, höchstens 365 Nächte, Anreise höchstens 3 Jahre voraus, Vergangenheit erlaubt), Gast, Erwachsene 1–50, Kinderalter 0–17, Option mit Ablaufdatum ab heute, Übernachtungspreis Pflicht nur für Inhaber, Positionen, Sperrgrund, Mitreisende, Storno.

**Ursprünglich vorläufig** (seit dem Backend erledigt): Beispielbuchungen, „wird eingerichtet“-Aktionen, Reinigungsgebühr, Hinweise bei Wohnungen, Aufenthalte bei Gästen, Dublettenprüfung für Mitarbeiter. Siehe „Implementation Notes (Backend)“.

**Geprüft**
- Typprüfung, Lint, Build grün; Unit-Tests 309/309 (davon 30 neu)
- Im Browser (Desktop 1440 px, Handy 375 px) als Inhaber und als Mitarbeiter: Liste mit Monatsleiste und Karten, Detail mit Preis (Inhaber) bzw. ohne Preis und ohne „Stornieren“ (Mitarbeiter), Formular mit Preisvorschlag, Kinderalter und Kapazitätswarnung inkl. „Trotzdem speichern“

## Implementation Notes (Backend)
**Stand 2026-10-26.** Migration `supabase/migrations/20261026130000_bookings.sql`, eingespielt nur in „apppa-dev“; `npm run db:types` erzeugt; `db advisors` ohne Befund.

**Tabellen** (alle mit Kundenkennung, Standardfeldern und Änderungsprotokoll)
- `bookings`: Buchungen, Optionen und Sperren (`kind`).
  - **Nummer:** Jahr + laufende Nummer; `number` wird daraus berechnet („2026-0042“, ab 10.000 fünfstellig).
  - **Regeln in der Datenbank:**
    - Abreise nach Anreise, höchstens 365 Nächte;
    - Kinderalter 0–17, höchstens 50 Personen;
    - Buchung/Option mit Gast, Erwachsenen und Nummer;
    - Sperre mit Grund, ohne Gast, Nummer und Storno;
    - Ablaufdatum genau bei Optionen;
    - Notiz Pflicht beim Sperrgrund „Sonstiges“.
  - **Verweise auf Wohnung und Gast** mit Löschsperre (NO ACTION). Das Löschen eines ganzen Kunden bleibt möglich.
- `booking_amounts` (Übernachtungspreis, Stornogebühr) und `booking_charges` (Positionen): nur Inhaber und Admin lesen
- `booking_companions`: Mitreisende, für alle Mitglieder lesbar
- `booking_numbers`: Nummernkreis je Kunde und Jahr, nur intern
- `apartments`: neues Feld `cleaning_fee_cents`, Schlüssel `(id, tenant_id)` für Verweise

**Rechte:** Lesen über Zugriffsregeln wie bisher. Geschrieben wird nur über geschützte Funktionen (eigene Rollenprüfung, alles oder nichts); direkt erlaubt ist nur „Sperre löschen“ für Inhaber.

**Funktionen** (privat mit Rollenprüfung, öffentliche Hülle für die App)
- `save_booking(p_input, p_confirm)` legt an oder ändert.
  - **Prüft:**
    - Mitgliedschaft und Stand (`updated_at`);
    - ob die Buchung aktiv ist;
    - archivierte Wohnung und anonymisierten Gast;
    - Mitreisende gegen die Personenzahl.
  - **Gleichzeitige Speichervorgänge** je Wohnung laufen nacheinander (Transaktionssperre je Wohnung).
  - **Bei Überschneidung oder Überbelegung** ohne Bestätigung des Inhabers → `{ status: 'warnings' }`, es wird nichts gespeichert.
  - **Beim Speichern:**
    - legt bei Bedarf den neuen Gast im selben Vorgang an;
    - vergibt die Nummer;
    - schreibt die Beträge des Inhabers bzw. für Mitarbeiter den Vorschlag (Standardpreis × Nächte + „Reinigung“).
  - **„Preis prüfen“:** wird gesetzt, wenn ein Mitarbeiter Zeitraum oder Wohnung ändert. Speichert der Inhaber, verschwindet es wieder.
- Weitere Funktionen:
  - `save_block`;
  - `cancel_booking`: nur Inhaber, mit Grund und Gebühr;
  - `confirm_option`: gleiche Nummer, erneute Prüfung, Inhaber kann übersteuern;
  - `save_companions`: höchstens Personen minus 1;
  - `save_booking_note`: Notiz; Stornogebühr nur Inhaber.
- `booking_warnings`: Vorschau für das Formular (nur Mitglieder)
- Fehlercodes P0801–P0808 → Meldungen in `src/app/(app)/buchungen/actions.ts`

**PROJ-6/7 angeschlossen**
- **Datenbank-Funktionen aus PROJ-7:**
  - `merge_guests` hängt Buchungen um;
  - `delete_guest` anonymisiert, sobald der Gast Einträge hat (auch Optionen und stornierte);
  - `anonymize_guest` entfernt die Mitreisenden seiner Buchungen samt Altwerten im Protokoll;
  - `guest_list` zählt Aufenthalte (aktive Buchungen ohne Optionen) und den letzten Aufenthalt.
- Gast-Detail: Aufenthalte (Anzahl, letzter, nächster, Kanäle) und Liste der Buchungen; Löschdialog entscheidet nach „hat Einträge“
- Dublettenwarnung (`checkGuestDuplicates`) jetzt für alle Mitglieder (Mitarbeiter im Buchungsformular)
- **Wohnungen:**
  - Feld „Reinigungsgebühr“;
  - kein „Endgültig löschen“ mehr bei Wohnungen mit Einträgen, stattdessen ein Hinweis;
  - Archivieren nennt die Zahl künftiger Buchungen;
  - Hinweis, wenn künftige Buchungen mehr Personen haben als die neue Personenzahl.

**App**
- `src/lib/bookings-data.ts`:
  - Monatsliste und Suche (Gast über den Suchtext aus PROJ-7, Nummer);
  - Kennzeichen „überschneidet sich“ aus den aktiven Einträgen der betroffenen Wohnungen;
  - Detail mit Mitreisenden, Beträgen (nur Inhaber) und Namen für Storno und Übersteuern.
- `src/app/(app)/buchungen/actions.ts`: ruft die Funktionen auf; bei neuen Warnungen beim Speichern lädt das Formular die Warnung neu

**Tests**
- `supabase/tests/bookings.integration.test.ts` (13):
  - Abschottung, Beträge nur für Inhaber;
  - Nummern fortlaufend und eindeutig, auch bei gleichzeitigem Anlegen;
  - Preisvorschlag und „Preis prüfen“ für Mitarbeiter;
  - neuer Gast alles oder nichts;
  - archivierte Wohnung und anonymisierter Gast;
  - Wechseltag, Warnungen ohne Speichern, Übersteuern nur Inhaber, Überbelegung;
  - stornierte und verfallene Einträge zählen nicht;
  - Option bestätigen mit gleicher Nummer;
  - Sperren (anlegen alle, löschen nur Inhaber), Löschsperre der Wohnung;
  - Mitreisende (Höchstzahl, Stand, Personenzahl);
  - Zusammenführen, Anonymisieren samt Protokoll;
  - Aufenthalte in der Gästeliste.
- Unit-Tests 234/234 grün (inkl. Reinigungsgebühr); Lint und Typprüfung grün
- Rauchtest im Browser: Mitarbeiter legt Buchung mit neuem Gast an (Preisvorschlag € 420 = 3 × € 120 + Reinigung € 60), Inhaber storniert mit Gebühr
- Hinweis: Beim Lauf der ganzen Suite schlug einmal ein Test aus PROJ-4 fehl (Anmelde-Grenze von Supabase); einzeln läuft er grün

## QA Test Results

**Tested:** 2026-10-25
**App URL:** http://localhost:3000 (Dev, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)

**Umgebung:** Die Prüfung von `.env.local` per `grep` wurde abgelehnt (Dateizugriff gesperrt). Schutz besteht trotzdem: `assertTestableProject` in den Test-Helfern bricht bei Staging- oder Produktions-Refs ab.

**Automatische Tests**
- Vitest: 323/323 grün (Unit- und Integrationstests, davon 13 Integrationstests PROJ-8)
- Neue E2E-Datei `tests/PROJ-8-manuelle-buchungen.spec.ts`:
  - 19 Abläufe: 18 im Projekt „desktop“, Layout/axe zusätzlich in „tablet“ und „mobile“;
  - alle grün;
  - BUG-1 und BUG-2 sind als erwartete Fehler (`test.fail`) hinterlegt. Nach der Behebung schlagen diese Tests an und die Markierung muss entfernt werden.
- Regression (desktop):
  - PROJ-7: 15/15 grün;
  - PROJ-6 und PROJ-2: 29/30 grün. Der eine Ausfall war die Supabase-Grenze „Request rate limit reached“ beim Anmelden; der Test lief danach einzeln grün (siehe unten).

### Acceptance Criteria Status

#### Liste (8/8)
- [x] Leerzustand mit „Neue Buchung“ und „Neue Sperre“
- [x] Ohne Wohnung: Hinweis mit Link „Zu den Wohnungen“, kein „Neue Buchung“
- [x] Monatsliste nach Anreise sortiert mit Nummer, Gast, Wohnung, Zeitraum, Nächten, Personen, Art/Zustand
- [x] Endbetrag nur für Inhaber; Mitarbeiter ohne Spalte „Betrag“
- [x] Blättern (Vorheriger Monat) und „Heute“
- [x] Filter Wohnung, Art, Zustand; stornierte und verfallene ohne Filter ausgeblendet
- [x] Suche nach Gast (ohne Akzente) und Buchungsnummer über alle Monate
- [x] Handy: Karten statt Tabelle, kein seitliches Scrollen

#### Buchung anlegen (13/13)
- [x] BUG-1 (behoben): Check-in/-out-Zeiten und Reinigungsgebühr werden beim Wählen einer Wohnung übernommen. Hat der Kunde nur **eine** aktive Wohnung, ist sie vorausgewählt, die Reinigungsgebühr fehlt dann aber.
- [x] „Die Abreise muss nach der Anreise liegen“
- [x] Übernachtungspreis = Standardpreis × Nächte, Endbetrag berechnet
- [x] Nach Handänderung: neuer Zeitraum ändert den Preis nicht, „Neuen Vorschlag … übernehmen“ wird angeboten
- [x] Ohne Standardpreis: Preis bleibt leer und ist Pflicht
- [x] Mitarbeiter: Buchung erhält den Vorschlag (3 × € 120 + Reinigung € 60), ohne dass Beträge sichtbar sind
- [x] Bestehenden Gast suchen und wählen
- [x] Neuer Gast durch Mitarbeiter, Dublettenwarnung mit „Trotzdem anlegen“
- [x] Fehlschlag legt keinen Gast an (Integrationstest „alles oder nichts“)
- [x] „3 (2 Erwachsene, 1 Kind)“ mit Alter 4
- [x] Kinderalter außerhalb 0–17 wird gemeldet
- [x] Nächste Nummer des Anreisejahres, Detail wird geöffnet
- [x] Leeres Formular: Meldungen bei Wohnung, Anreise, Abreise, Hauptgast, Übernachtungspreis

#### Zusatzkosten (3/3)
- [x] Position mit Vorschlag/freier Bezeichnung erhöht den Endbetrag (inkl. Cent)
- [x] Fehlende Bezeichnung bzw. negativer Betrag werden gemeldet
- [x] Reinigungsgebühr in der Wohnung gepflegt und neuen Buchungen vorgeschlagen; bestehende Positionen bleiben (eigene Zeilen je Buchung)

#### Konflikte und Kapazität (7/7)
- [x] Warnung nennt Art, Nummer, Gast und Zeitraum des anderen Eintrags
- [x] Wechseltag ohne Warnung
- [x] Stornierte und verfallene Einträge ohne Warnung
- [x] Mitarbeiter: Speichern gesperrt, kein „Trotzdem speichern“
- [x] Inhaber: „Trotzdem speichern“ nötig, danach „überschneidet sich“ und „Trotz Warnung gespeichert von …“
- [x] Überbelegung wie Überschneidung
- [x] Sperre über einer Buchung warnt ebenso

#### Optionen (6/6)
- [x] Ablaufdatum vorbelegt mit heute + 7, nicht in der Vergangenheit
- [x] Aktive Option belegt den Zeitraum (Integrationstest)
- [x] „Bestätigen“ macht sie zur Buchung mit derselben Nummer
- [x] Verfallene Option: ohne Filter ausgeblendet, „verfallen“, Hinweis im Detail, nur „Notiz bearbeiten“
- [x] Verfallene Option bei freiem Zeitraum bestätigt (mit erneuter Prüfung)
- [x] Ablaufdatum verlängern (Code-Review: `save_booking` erlaubt neues Datum ab heute; kein eigener E2E-Ablauf)

#### Bearbeiten (4/4)
- [x] Änderungen gelten, Prüfung erneut ohne die Buchung selbst
- [x] Fremde Änderung: „wurde inzwischen … geändert“, Eingaben bleiben, „Aktuelle Fassung laden“
- [x] Storniert/verfallen: nur Notiz (Inhaber zusätzlich Stornogebühr)
- [x] Mitarbeiter ändert Zeitraum: Preis bleibt, Inhaber sieht „Preis prüfen“ in Detail und Liste

#### Mitreisende (3/3)
- [x] Bis zu Personen minus 1 (3 Personen → 2 Mitreisende), danach kein „Person hinzufügen“
- [x] Fehlender Vor-/Nachname, Geburtsdatum in der Zukunft werden gemeldet
- [x] Personenzahl unter Hauptgast + Mitreisende: Meldung „zuerst Mitreisende entfernen“

#### Stornieren (3/3)
- [x] Dialog mit optionalem Grund und Stornogebühr
- [x] Danach „storniert“, Zeitraum frei, Grund, Gebühr, Person und Zeitpunkt sichtbar, nicht aktivierbar
- [x] Mitarbeiter ohne „Stornieren“

#### Sperren (3/3)
- [x] Sperre ohne Gast, Preis und Nummer
- [x] „Sonstiges“ ohne Notiz wird gemeldet
- [x] Inhaber löscht nach Bestätigung; Mitarbeiter sehen kein „Sperre löschen“

#### Gäste und Wohnungen (8/8)
- [x] Gast-Detail: Aufenthalte und Liste der Buchungen, stornierte gekennzeichnet
- [x] Gästeliste nach „letzter Aufenthalt“ sortiert
- [x] Gast mit Buchungen wird anonymisiert; Buchung zeigt „Gelöschter Gast“
- [x] Mitreisende entfernt, Personenzahl bleibt
- [x] Zusammenführen hängt Buchungen um (Integrationstest)
- [x] Wohnung mit Buchungen: kein „Endgültig löschen“, stattdessen Hinweis
- [x] Archivieren nennt „1 künftige Buchung bleibt bestehen“
- [x] Kleinere Personenzahl: Hinweis „1 künftige Buchung hat mehr Personen“

### Edge Cases Status
- [x] Buchung in der Vergangenheit erlaubt (Prüfregel, Unit-Test)
- [x] Bis 365 Nächte, Anreise höchstens 3 Jahre voraus (Formular und Server-Aktion; DB prüft nur 365 Nächte, siehe BUG-4)
- [x] Anreisejahr ändert sich: Nummer bleibt (Update ändert `number_year/seq` nicht)
- [x] Option verfällt bei offenem Formular: `save_booking` meldet „nicht mehr aktiv“
- [x] Gleichzeitiges Anlegen: Sperre je Wohnung, der zweite erhält die Warnung (Integrationstest)
- [x] Archivierte Wohnung: Buchungen bearbeitbar, für neue Buchungen nicht wählbar (Integrationstest)
- [x] Gast zusammengeführt/anonymisiert während Bearbeitung: Stand-Prüfung greift; anonymisierter Gast in der Gastsuche nicht wählbar
- [x] Mitarbeiter wechselt Wohnung: Preis bleibt, „Preis prüfen“
- [x] Netzwerkfehler: Meldung, Eingaben bleiben; Gast und Buchung in einem Vorgang
- [x] BUG-2 (behoben): Check-in/-out-Zeit ist laut Spec optional; das Formular verlangte sie

### Security Audit Results
- [x] Ohne Anmeldung kein Zugriff (App-Rahmen wie bisher); fremde Buchung per Adresse → 404
- [x] Abschottung je Kunde: alle Funktionen prüfen Mitgliedschaft; Wohnung und Gast werden mit der Kundenkennung gesucht (fremde IDs → „nicht gefunden“)
- [x] Beträge und Zusatzkosten für Mitarbeiter in der Datenbank nicht lesbar (RLS, Integrationstest) und nicht schreibbar (`save_booking` ignoriert `amounts` für Mitarbeiter)
- [x] Übersteuern, Stornieren, Sperre löschen und Stornogebühr nur Inhaber, serverseitig geprüft (auch bei direktem API-Aufruf)
- [x] Keine Schreibrechte auf die Tabellen außer DELETE für Sperren (Policy: nur Inhaber, nur `kind = 'block'`); `booking_numbers` ohne Policy
- [x] Suche: Suchbegriff wird vor der Abfrage auf Buchstaben, Ziffern, Leerzeichen und Bindestrich bereinigt (kein Einschleusen in den PostgREST-Filter, keine LIKE-Platzhalter)
- [x] XSS: Notizen, Gründe und Namen werden von React als Text ausgegeben
- [x] Keine Geheimnisse in Client-Code oder Antworten; Admin liest Beträge nur lesend (wie geplant)
- [x] BUG-4 (Low, behoben): Einige Regeln prüft nur die App, nicht die Datenbank. Wer die Funktionen direkt über die API aufruft (nur eigene Kundendaten), kann sie umgehen.
- [x] BUG-5 (Low, behoben): Theoretische Verklemmung bei gleichzeitigem Bearbeiten und Bestätigen derselben Option

### Bugs Found

#### BUG-1: Reinigungsgebühr fehlt, wenn nur eine Wohnung aktiv ist (behoben)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Als Inhaber eines Kunden mit genau einer aktiven Wohnung (Reinigungsgebühr € 60) „Neue Buchung“ öffnen
  2. Erwartet: Wohnung vorausgewählt und Position „Reinigung € 60“ eingetragen
  3. Tatsächlich: Die Wohnung ist vorausgewählt, aber es gibt keine Position „Reinigung“. Wird die Gebühr übersehen, fehlt sie im Endbetrag.
- **Ursache:** `initialValues` in `booking-panel.tsx` setzt die einzige Wohnung, die Reinigungsposition entsteht aber nur in `onApartment` (beim Wählen).
- **Test:** `BUG-1: Bei nur einer aktiven Wohnung …` (`test.fail`)
- **Priority:** Fix before deployment (betrifft Kunden mit einer Wohnung bei jeder Inhaber-Buchung)

#### BUG-2: Check-in/-out-Zeit im Formular Pflicht (behoben)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Buchung ohne Check-in/-out-Zeit (z. B. künftig aus dem Import) bearbeiten oder im Formular die Uhrzeit leeren
  2. Speichern
  3. Erwartet: speichert (Zeiten optional, Spec „Angaben einer Buchung“)
  4. Tatsächlich: „Bitte eine Uhrzeit wie 15:00 eingeben.“, Speichern nicht möglich
- **Hinweis:** In der App angelegte Buchungen haben immer Zeiten. Betrifft heute nur geleerte Felder, ab PROJ-11 ggf. importierte Buchungen.
- **Test:** `BUG-2: Buchung ohne Check-in/-out-Zeit …` (`test.fail`)
- **Priority:** Fix in next sprint (spätestens mit PROJ-11)

#### BUG-3: Irreführende Meldung für Mitarbeiter beim Bestätigen einer überschneidenden Option (behoben)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Verfallene Option, deren Zeitraum inzwischen belegt ist
  2. Als Mitarbeiter „Option bestätigen“ wählen
  3. Erwartet: Hinweis, dass der Zeitraum belegt ist und nur der Inhaber übersteuern kann
  4. Tatsächlich: Meldung „Bitte die Warnung prüfen und ‚Trotzdem speichern‘ bestätigen.“; es gibt aber für Mitarbeiter nichts zu bestätigen
- **Ursache:** `booking-actions.tsx` zeigt bei `ownerOnly` die Meldung `warnings`
- **Priority:** Nice to have

#### BUG-4: Einige Regeln nur in der App, nicht in der Datenbank (behoben)
- **Severity:** Low
- **Details:** Bei direktem Aufruf von `save_booking` bzw. `save_companions` über die API (nur mit eigener Anmeldung, nur eigene Kundendaten) werden nicht geprüft:
  - Anreise höchstens 3 Jahre voraus;
  - Geburtsdatum der Mitreisenden nicht in der Zukunft (DB erlaubt bis 2100);
  - leere Einträge (`null`) in `child_ages`: `0 <= all(...)` ist bei `null` nicht falsch und lässt sie durch;
  - Ablaufdatum der Option ohne Obergrenze.
- **Folge:** Keine Sicherheitslücke (keine fremden Daten, keine Rollenumgehung), nur unplausible Daten im eigenen Kunden
- **Priority:** Nice to have (z. B. `array_position(child_ages, null) is null` als Regel ergänzen)

#### BUG-5: Mögliche Verklemmung zwischen Bearbeiten und Bestätigen derselben Option (behoben)
- **Severity:** Low
- **Details:**
  - `save_booking` (Bearbeiten) sperrt erst die Buchungszeile, dann die Wohnung.
  - `confirm_option` sperrt in umgekehrter Reihenfolge: erst die Wohnung, dann die Zeile.
  - Laufen beide gleichzeitig für dieselbe Option, bricht PostgreSQL einen Vorgang mit „deadlock detected“ ab. Der Nutzer sieht dann „Etwas ist schiefgelaufen“. Daten gehen nicht verloren.
- **Priority:** Nice to have (gleiche Reihenfolge: Wohnung zuerst)

**Beobachtung (kein Fehler, laut Spec so gewollt):** Hat der Inhaber eine Überschneidung übersteuert, kann ein Mitarbeiter diese Buchung nicht mehr bearbeiten, solange die Überschneidung besteht. Das gilt auch für reine Personen- oder Gaständerungen. Notiz und Mitreisende bleiben änderbar.

### Behebung (2026-10-25)
- **BUG-1:** `booking-panel.tsx` trägt bei der vorausgewählten einzigen Wohnung die Reinigungsgebühr für Inhaber gleich als Position „Reinigung“ ein.
- **BUG-2:**
  - Check-in/-out-Zeit sind im Formular optional (leer → keine Zeit).
  - `save_booking` übernimmt beim Ändern den übergebenen Wert; beim Anlegen ohne Angabe gelten die Zeiten der Wohnung.
- **BUG-3:** Mitarbeiter erhalten beim Bestätigen einer überschneidenden Option „… Bitte den Inhaber fragen.“ (`bookings.confirmOption.staffBlocked`).
- **BUG-4:** Neue Migration `20261026140000_bookings_qa_fixes.sql` (nur „apppa-dev“). RLS und Rechte sind unverändert.
  - Anreise (Buchung, Sperre) und Ablaufdatum der Option höchstens 3 Jahre voraus (`private.booking_max_date()`);
  - Geburtsdatum der Mitreisenden nicht in der Zukunft (`save_companions`);
  - keine leeren Kinderalter (`bookings_child_ages_not_null_check`).
  - Das Formular prüft das Ablaufdatum ebenfalls (`optionUntilTooFar`).
- **BUG-5:** `save_booking` und `save_block` sperren wie `confirm_option` erst die Wohnung(en), nach id sortiert (`private.lock_apartments`), dann den Eintrag. Geprüft per Code-Review; die Verklemmung ist zeitabhängig und nicht verlässlich nachstellbar.
- **Tests:**
  - Unit-Tests: Zeiten optional, Obergrenze Ablaufdatum.
  - 2 neue Integrationstests: Regeln bei direktem Aufruf, Zeiten beim Anlegen und Ändern.
  - E2E: BUG-1 und BUG-2 als „(behoben)“ ohne `test.fail`, neuer Test BUG-3.
- **Nachtest:**
  - Vitest 326/326;
  - Lint, Typprüfung und Build grün;
  - PROJ-8-E2E 20/20 (desktop) grün;
  - `db advisors`: nur die bekannten Auth-Hinweise der Dev-Umgebung (OTP-Ablauf, Leaked-Password-Schutz), kein Befund zu Tabellen oder Funktionen.

### Summary
- **Acceptance Criteria:** 58/58 bestanden (nach Behebung von BUG-1)
- **Bugs Found:** 5 total (0 critical, 0 high, 1 medium, 4 low), alle behoben
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment
_Stand 2026-10-25 (/deploy, Tag `v1.2.0`)_

- **Staging:** https://staging.apppa.at (Vercel `apppa-staging`, Supabase `iikzjqjjxoznrkkixfqa`), vom Nutzer anhand der Checkliste geprüft und freigegeben
- **Production:** https://app.apppa.at (Vercel `apppa`, Supabase `ahclrqbhfpidxjzbpfgb`), Commit `b8d8ddc`, 2026-10-25
- **Migrationen** in Staging und Production eingespielt: `20261026130000_bookings.sql`, `20261026140000_bookings_qa_fixes.sql`
- **Advisors:** kein Befund zur Datenbank. Es bleiben nur die bekannten Auth-Hinweise: in Staging Gültigkeit der Mail-Links und die dort nicht eingeschaltete Passwort-Leak-Prüfung, in Production nur die Gültigkeit der Mail-Links.
- **Beim Ausliefern aufgefallen:**
  - Der lokale Branch `staging` war veraltet, deshalb wurde der Push nach `production` abgelehnt. Ausgeliefert wurde `origin/staging` als Fast-Forward; Befehl in Runbook, Deploy-Skill und Git-Regel angepasst.
  - `apppa-staging` baute bei jedem Push auch Previews ohne Variablen, die scheiterten. Abhilfe „Ignored Build Step → Only build production“, im Runbook (Abschnitt 5) dokumentiert.

### Nachtrag 2026-10-27 (Tag `v1.7.1`): Safari-Zeilenklick behoben
- In Safari öffnete ein Klick in der Tabelle immer den untersten Eintrag (Klickfläche `after:inset-0` lässt sich in Safari nicht an `<tr>` verankern). Jetzt ist nur der Name der Link bzw. Knopf; Handy-Karten bleiben ganz anklickbar. Regressionstest „Safari-Zeilenklick“
- Staging und Production mit Commit `60659ee`, ohne Migrationen

### Nachtrag 2026-10-28 (Tag `v1.8.0`, mit PROJ-31): Tab in Safari, Ortstaxe-Hinweise
- Auswahlfelder, Checkboxen, Schalter und Länderauswahl haben ein ausdrückliches `tabIndex`, weil Safari Knöpfe beim Tabben sonst überspringt
- Die Hinweise „Die Ortstaxe kommt getrennt dazu.“ und „ohne Ortstaxe“ am Preis sind entfernt (die Nächtigungsabgabe ist eine Kostenposition)
- Staging und Production mit Commit `4d1b361`, ohne Migrationen

### Nachtrag 2026-10-28 (Tag `v1.8.1`): Uhrzeiten im Buchungs-Detail entfernt
- Bei Anreise und Abreise steht im Buchungs-Detail nur noch das Datum; Check-in-/Check-out-Zeiten bleiben im Formular und in der Wohnung erhalten
- Staging und Production mit Commit `8450f1d`, ohne Migrationen; `npm test` bis auf wechselnde Zeitüberschreitungen der Dev-Datenbank grün (bei Wiederholung grün)
