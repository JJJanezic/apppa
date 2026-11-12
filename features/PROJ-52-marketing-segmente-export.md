# PROJ-52: Marketing: Segmente und CSV-Export

## Status: In Progress
**Created:** 2026-11-12
**Last Updated:** 2026-11-12

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Rolle Inhaber, gewählter Kunde
- Requires: PROJ-6 (Wohnungsverwaltung): Objekte und Wohnungen für den Filter
- Requires: PROJ-7 (Gäste-Datenbank): Gastdaten, Sprache, Kennzeichnung von Plattform-E-Mail und -Telefon, Gastdetailseite
- Requires: PROJ-8 / PROJ-30 (Buchungen, Buchungsquelle): Aufenthalte, Wohnung und Quelle je Buchung
- Requires: PROJ-19 (Marketing-Einwilligung verwalten): Stand „Erteilt“ und „eingewilligt seit“ je Gast
- Requires: PROJ-29 (Titel, Geschlecht) und PROJ-50 (Firmenliste): Angaben für Anrede und Firma im Export

## Überblick
Inhaber suchen auf einer eigenen Seite **„Marketing“** die Gäste aus, die sie bewerben dürfen, und laden sie als **CSV-Datei** für ein Newsletter-Programm oder einen Serienbrief herunter.

- Auf der Seite erscheinen **ausschließlich Gäste mit gültiger Einwilligung** (Stand „Erteilt“ aus PROJ-19) und mit mindestens einer eigenen Kontaktmöglichkeit.
- Filterkombinationen lassen sich als **Segment** unter einem Namen speichern. Ein Segment merkt sich nur die Filter; beim Öffnen wird die Liste neu berechnet.
- E-Mail-Adressen und Telefonnummern, die von booking.com oder Airbnb übernommen wurden, kommen nie in die Liste oder den Export.

## User Stories
- Als **Inhaber** möchte ich alle Gäste sehen, die in Marketing eingewilligt haben und die ich erreichen kann, damit ich weiß, wen ich anschreiben darf.
- Als **Inhaber** möchte ich diese Gäste nach Aufenthalten (Zeitraum, Anzahl), Wohnung bzw. Objekt, Herkunftsland, Sprache und Buchungsquelle eingrenzen, damit ich gezielte Aussendungen machen kann (z. B. „Stammgäste aus Deutschland, die im Sommer da waren“).
- Als **Inhaber** möchte ich nur Gäste mit E-Mail-Adresse bzw. nur Gäste mit Postanschrift auswählen, damit die Liste zum geplanten Kanal (Newsletter oder Brief) passt.
- Als **Inhaber** möchte ich die ausgewählten Gäste als CSV herunterladen, damit ich sie in mein Newsletter-Programm oder in Word/Excel für einen Serienbrief übernehmen kann.
- Als **Inhaber** möchte ich eine Filterkombination als Segment speichern und später wieder öffnen, damit ich wiederkehrende Aussendungen nicht jedes Mal neu zusammenstellen muss.
- Als **Inhaber** möchte ich mich darauf verlassen, dass Gäste mit Widerruf und Plattform-Adressen nie im Export landen, damit ich die DSGVO und die Regeln von booking.com/Airbnb einhalte.

## Begriffe und Regeln

### Wer erscheint auf der Seite
Ein Gast erscheint nur, wenn **alle** Bedingungen zutreffen:
- Er gehört zum gewählten Kunden.
- Sein Stand der Marketing-Einwilligung ist **„Erteilt“** (PROJ-19). Widerrufen, keine Einwilligung und anonymisiert sind ausgeschlossen.
- Er hat mindestens eine **eigene Kontaktmöglichkeit**: eine selbst erfasste E-Mail-Adresse (nicht von der Plattform übernommen) oder eine Postanschrift (Straße und PLZ oder Ort; dieselbe Regel wie der Hinweis auf der Gastseite in PROJ-19).
- Er erfüllt alle gesetzten Filter.

Gäste mit Einwilligung, aber ohne eigene Kontaktmöglichkeit, fehlen in Liste und Export. Ein Hinweis nennt ihre Anzahl, z. B. „3 Gäste mit Einwilligung haben keine eigene E-Mail-Adresse und keine Anschrift.“

### Aufenthalt
Als Aufenthalt zählt eine **Buchung** (keine Option, keine Sperre), die **nicht storniert** ist und deren **Anreise bis heute** liegt. Das ist dieselbe Zählweise wie die Spalte „Aufenthalte“ in der Gästeliste. Künftige Buchungen zählen nicht.

### Filter

| Filter | Auswahl | Wirkung |
|--------|---------|---------|
| Aufenthaltszeitraum | von (Monat/Jahr) – bis (Monat/Jahr), beide optional | Gast hatte mindestens einen Aufenthalt, der sich mit dem Zeitraum überschneidet |
| Mindestens Aufenthalte | Zahl ab 1 (leer = egal) | Anzahl aller Aufenthalte des Gastes, unabhängig vom Zeitraum; z. B. „2“ = Stammgäste |
| Objekt / Wohnung | Objekt oder einzelne Wohnung (Mehrfachauswahl) | Gast hatte mindestens einen Aufenthalt in einer der gewählten Wohnungen (bei gesetztem Zeitraum: in diesem Zeitraum) |
| Buchungsquelle | Mehrfachauswahl der Buchungsquellen (z. B. Website, booking.com, Airbnb, Empfehlung) | Gast hatte mindestens einen Aufenthalt mit einer der gewählten Quellen (bei gesetztem Zeitraum: in diesem Zeitraum) |
| Herkunftsland | Mehrfachauswahl der Länder | Land der Adresse des Gastes |
| Sprache | Mehrfachauswahl der Sprachen | Sprache am Gast; „Keine Angabe“ wählbar |
| Erreichbar per | „egal“ (Standard), „E-Mail“, „Post“ | „E-Mail“: eigene E-Mail-Adresse vorhanden; „Post“: Anschrift vorhanden |

- Alle Filter wirken zusammen (und), innerhalb einer Mehrfachauswahl gilt „oder“.
- Ohne Filter erscheinen alle Gäste mit Einwilligung und eigener Kontaktmöglichkeit, auch solche ohne Aufenthalt (z. B. Einwilligung per Webformular). Sobald ein Aufenthalts-, Wohnungs- oder Quellenfilter gesetzt ist, fallen Gäste ohne passenden Aufenthalt heraus.
- Die Filter stehen in der Adresse der Seite (Lesezeichen und „Zurück“ funktionieren).

### Segmente
- Ein Segment hat einen **Namen** (Pflicht, bis 60 Zeichen, je Kunde eindeutig, Groß-/Kleinschreibung egal) und speichert **nur die Filter**.
- „Als Segment speichern“ legt ein neues Segment mit den aktuellen Filtern an.
- Ist ein Segment geöffnet und wurden die Filter geändert, gibt es zusätzlich „Segment aktualisieren“ (überschreibt die Filter nach Rückfrage).
- Segmente lassen sich **umbenennen** und **löschen** (nach Rückfrage). Ein Löschen betrifft keine Gäste.
- Segmente gehören dem Kunden: Alle Inhaber des Kunden sehen und bearbeiten dieselben Segmente.
- Beim Öffnen wird die Liste **neu berechnet**: Wer inzwischen widerrufen hat, fällt heraus; neue passende Gäste kommen dazu.
- Verweist ein Segment auf eine Wohnung oder ein Objekt, das es nicht mehr gibt, wird dieser Teil des Filters übergangen, und ein Hinweis erscheint („Eine gespeicherte Wohnung gibt es nicht mehr; der Filter wurde angepasst.“).

### CSV-Export
- Knopf **„CSV exportieren“**: lädt alle Treffer der aktuellen Filter herunter (alle Seiten, nicht nur die angezeigte).
- Format wie die übrigen CSV-Exporte der App (Auswertungen, Ortstaxe): für Excel lesbar, Umlaute korrekt.
- Dateiname: `gaeste_[Kundenname]_[Datum und Uhrzeit].csv`
  - Kundenname wie in den Stammdaten; Leerzeichen und in Dateinamen unzulässige Zeichen (`/ \ : * ? " < > |`) werden durch „-“ ersetzt, Umlaute bleiben.
  - Datum und Uhrzeit des Exports in Wiener Zeit als `JJJJ-MM-TT_HH-MM`.
  - Beispiel: `gaeste_Pichler-Ferienwohnungen_2026-11-12_14-30.csv`
- Eine Zeile je Gast, Spalten in dieser Reihenfolge:
  1. Anrede (aus dem Geschlecht: „Frau“, „Herr“, sonst leer)
  2. Titel vor dem Namen
  3. Vorname
  4. Nachname
  5. Titel nach dem Namen
  6. Firma
  7. E-Mail (nur eigene, Plattform-Adressen leer)
  8. Telefon (nur eigene, Plattform-Nummern leer)
  9. Straße
  10. PLZ
  11. Ort
  12. Land
  13. Sprache
  14. Anzahl Aufenthalte
  15. Letzter Aufenthalt (Datum der letzten Anreise)
  16. Eingewilligt seit
- Die Datei wird nur an den Browser heruntergeladen (Ablage im Download-Ordner des Geräts); die App speichert **keine Kopie**, nur den Protokolleintrag.
- Ohne Treffer ist der Knopf ausgegraut.
- Jeder Export wird im **Protokoll** festgehalten: Person, Zeitpunkt, Filter bzw. Segment und Anzahl der Gäste. Eine eigene Anzeige dieser Einträge gibt es nicht.

## Bildschirme

### Menüpunkt und Seite „Marketing“
- Neuer Menüpunkt „Marketing“, nur für **Inhaber des gewählten Kunden**. Position: nach „Auswertungen“ und „Ortstaxe“, vor „Einstellungen“.
- Kopf: Titel „Marketing“, kurze Erklärung („Gäste mit Marketing-Einwilligung und eigener Kontaktmöglichkeit. Gäste mit Widerruf und Adressen von booking.com/Airbnb sind ausgeschlossen.“).
- **Segmente:** Auswahl „Segment öffnen“ (Liste der gespeicherten Segmente bzw. „Keine Segmente“), daneben „Als Segment speichern“, bei geöffnetem Segment auch „Segment aktualisieren“, „Umbenennen“, „Löschen“.
- **Filterleiste** mit den Filtern oben und „Filter zurücksetzen“.
- **Trefferzahl** („42 Gäste“) und Hinweis zu Gästen ohne eigene Kontaktmöglichkeit.
- **Trefferliste**, seitenweise zu je 50, sortiert nach Nachname:
  - Spalten: Name (Link zur Gastseite), Ort und Land, Sprache, Erreichbar per (E-Mail/Post), Aufenthalte, letzter Aufenthalt, eingewilligt seit.
  - Nur lesen, keine Bearbeitung auf dieser Seite.
- Knopf **„CSV exportieren“**.
- **Leere Zustände:**
  - Noch kein Gast mit Einwilligung: „Noch keine Gäste mit Marketing-Einwilligung. Gäste willigen in der Regel auf dem Gästeblatt ein; einzelne Einwilligungen erfassen Sie auf der Gastseite.“
  - Filter ohne Treffer: „Keine Gäste für diese Filter.“ mit „Filter zurücksetzen“.
- Am Handy: Filter untereinander bzw. in einem aufklappbaren Bereich, Trefferliste als Karten; Export und Segmente auch dort verfügbar.

## Rechte
| Aktion | Inhaber | Mitarbeiter |
|--------|---------|-------------|
| Seite „Marketing“ sehen, filtern | ja | nein (kein Menüpunkt, Adresse gesperrt) |
| CSV exportieren | ja | nein |
| Segmente anlegen, ändern, löschen | ja | nein |

Mitarbeiter erfassen Einwilligungen und Widerrufe weiterhin auf der Gastseite (PROJ-19).

## Out of Scope
- E-Mail- oder Newsletter-Versand aus der App → PROJ-22
- Export für mehrere Kunden auf einmal (Auswahl „Alle Kunden“)
- Zugriff für Mitarbeiter
- Filter nach Marketing-Quelle am Gast, nach Firma/Privat und nach Staatsangehörigkeit
- Künftige Buchungen als Aufenthalt (z. B. Gäste vor der Anreise anschreiben)
- Feste Gästelisten als Segment (Momentaufnahme)
- Anzeige vergangener Exporte in der App (nur im Protokoll)
- Abgleich mit Abmeldungen aus dem Newsletter-Programm (Rücklauf); ein Widerruf wird auf der Gastseite erfasst (PROJ-19)
- Export als Excel-Datei (XLSX) oder PDF
- Dubletten-Bereinigung im Export (gleiche E-Mail bei zwei Gästen): eine Zeile je Gast; Zusammenführen bleibt Aufgabe der Gästeverwaltung (PROJ-7)
- Mitreisende (nur Hauptgäste haben eine Einwilligung)

## Acceptance Criteria

**Zugang**
- [ ] Angenommen eine Person ist Inhaber des gewählten Kunden, wenn sie die App öffnet, dann gibt es den Menüpunkt „Marketing“ nach „Auswertungen“ und „Ortstaxe“
- [ ] Angenommen eine Person ist Mitarbeiter des gewählten Kunden, wenn sie die App öffnet, dann gibt es keinen Menüpunkt „Marketing“, und der direkte Aufruf der Adresse zeigt „Seite nicht gefunden“ bzw. „Keine Berechtigung“

**Wer erscheint**
- [ ] Angenommen Gäste mit Stand „Erteilt“, „Widerrufen“ und „Keine“, wenn die Seite ohne Filter geöffnet wird, dann erscheinen nur die Gäste mit Stand „Erteilt“
- [ ] Angenommen ein Gast mit Einwilligung hat nur eine von booking.com übernommene E-Mail-Adresse und keine Anschrift, wenn die Seite geöffnet wird, dann erscheint er nicht, und der Hinweis nennt „1 Gast mit Einwilligung hat keine eigene E-Mail-Adresse und keine Anschrift“
- [ ] Angenommen ein Gast mit Einwilligung hat eine Plattform-E-Mail-Adresse und eine Anschrift, wenn er in der Liste erscheint bzw. exportiert wird, dann ist „Erreichbar per“ nur „Post“ und die Spalte E-Mail im Export leer
- [ ] Angenommen ein Gast widerruft nach dem Speichern eines Segments, wenn das Segment geöffnet wird, dann erscheint er nicht mehr

**Filter**
- [ ] Angenommen Gäste mit Aufenthalten im Juli 2026 und im Jänner 2026, wenn der Aufenthaltszeitraum Juni 2026 bis August 2026 gewählt wird, dann erscheinen nur die Gäste mit einem Aufenthalt, der sich mit diesem Zeitraum überschneidet
- [ ] Angenommen ein Gast mit einem Aufenthalt und ein Gast mit drei Aufenthalten, wenn „Mindestens Aufenthalte: 2“ gesetzt wird, dann erscheint nur der Gast mit drei Aufenthalten
- [ ] Angenommen ein Gast hat nur eine künftige Buchung und eine stornierte Buchung, wenn „Mindestens Aufenthalte: 1“ gesetzt wird, dann erscheint er nicht
- [ ] Angenommen Gäste in Wohnung A und Wohnung B, wenn Wohnung A gewählt wird, dann erscheinen nur Gäste mit einem Aufenthalt in Wohnung A; bei Wahl des Objekts erscheinen die Gäste aller seiner Wohnungen
- [ ] Angenommen ein Gast hatte eine Buchung über booking.com und eine über die Website, wenn als Buchungsquelle „Website“ gewählt wird, dann erscheint er
- [ ] Angenommen Gäste mit Adresse in Deutschland und in Österreich, wenn Herkunftsland „Deutschland“ gewählt wird, dann erscheinen nur Gäste mit Adresse in Deutschland
- [ ] Angenommen Gäste mit Sprache Deutsch, Englisch und ohne Sprache, wenn „Englisch“ und „Keine Angabe“ gewählt werden, dann erscheinen die Gäste mit Englisch und ohne Sprache
- [ ] Angenommen ein Gast nur mit E-Mail und ein Gast nur mit Anschrift, wenn „Erreichbar per: E-Mail“ gewählt wird, dann erscheint nur der Gast mit E-Mail
- [ ] Angenommen mehrere Filter sind gesetzt, wenn die Liste angezeigt wird, dann erfüllen alle Treffer jeden Filter, und die Filter stehen in der Adresse (Neuladen zeigt dieselbe Liste)

**Trefferliste**
- [ ] Angenommen mehr als 50 Treffer, wenn die Seite geöffnet wird, dann zeigt sie die Trefferzahl und blättert in Seiten zu je 50, sortiert nach Nachname
- [ ] Angenommen ein Treffer, wenn der Inhaber auf den Namen klickt, dann öffnet sich die Gastseite
- [ ] Angenommen noch kein Gast hat eingewilligt, wenn die Seite geöffnet wird, dann erscheint der leere Zustand mit Hinweis auf Gästeblatt und Gastseite, und „CSV exportieren“ ist ausgegraut

**Export**
- [ ] Angenommen 120 Treffer, wenn „CSV exportieren“ geklickt wird, dann enthält die Datei 120 Zeilen (plus Kopfzeile) mit den festgelegten Spalten in der festgelegten Reihenfolge, Umlaute korrekt in Excel
- [ ] Angenommen der Kunde heißt „Pichler Ferienwohnungen“, wenn am 12.11.2026 um 14:30 exportiert wird, dann heißt die Datei `gaeste_Pichler-Ferienwohnungen_2026-11-12_14-30.csv`
- [ ] Angenommen ein Gast mit Plattform-Telefonnummer, wenn exportiert wird, dann ist seine Spalte Telefon leer
- [ ] Angenommen ein Gast mit Geschlecht „weiblich“ und Titel „Dr.“, wenn exportiert wird, dann stehen „Frau“ und „Dr.“ in den Spalten Anrede und Titel
- [ ] Angenommen ein Export wurde ausgeführt, wenn das Protokoll geprüft wird, dann steht dort ein Eintrag mit Person, Zeitpunkt, Filtern bzw. Segment und Anzahl der Gäste
- [ ] Angenommen ein Mitarbeiter ruft die Exportfunktion direkt auf, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt und nichts ausgegeben

**Segmente**
- [ ] Angenommen Filter sind gesetzt, wenn der Inhaber „Als Segment speichern“ mit dem Namen „Stammgäste DE“ bestätigt, dann erscheint das Segment in der Auswahl und öffnet später dieselben Filter
- [ ] Angenommen ein Segment „Stammgäste DE“ existiert, wenn ein zweites mit dem Namen „stammgäste de“ gespeichert wird, dann erscheint eine Fehlermeldung „Diesen Namen gibt es schon.“
- [ ] Angenommen ein leerer Name oder mehr als 60 Zeichen, wenn gespeichert wird, dann erscheint eine Fehlermeldung am Feld und nichts wird gespeichert
- [ ] Angenommen ein geöffnetes Segment mit geänderten Filtern, wenn „Segment aktualisieren“ bestätigt wird, dann speichert das Segment die neuen Filter
- [ ] Angenommen ein Segment, wenn der Inhaber es umbenennt bzw. nach Rückfrage löscht, dann erscheint es mit neuem Namen bzw. nicht mehr in der Auswahl; Gäste bleiben unverändert
- [ ] Angenommen ein zweiter Inhaber desselben Kunden, wenn er die Seite öffnet, dann sieht er dieselben Segmente
- [ ] Angenommen ein Segment verweist auf eine gelöschte Wohnung, wenn es geöffnet wird, dann wird dieser Filterteil übergangen und ein Hinweis erscheint

**Mandantentrennung**
- [ ] Angenommen ein Inhaber eines anderen Kunden, wenn er Segmente oder Export eines fremden Kunden aufruft, dann wird der Zugriff verweigert

## Edge Cases
- **Widerruf zwischen Anzeige und Export:** Der Export rechnet beim Klick neu; ein inzwischen widerrufener Gast fehlt in der Datei, auch wenn er auf der Seite noch zu sehen war.
- **Zwei Inhaber bearbeiten dasselbe Segment:** Der zuletzt gespeicherte Stand gilt; wurde das Segment inzwischen gelöscht, meldet „Segment aktualisieren“ „Dieses Segment gibt es nicht mehr.“
- **Sehr viele Treffer** (mehrere Tausend): Export bleibt möglich; Seite und Datei laden in vertretbarer Zeit (siehe Technical Requirements).
- **Gast mit Einwilligung, aber ohne jeden Aufenthalt:** erscheint ohne Aufenthaltsfilter (Aufenthalte 0, letzter Aufenthalt leer); mit Aufenthalts-, Wohnungs- oder Quellenfilter nicht.
- **Aufenthaltszeitraum nur „von“ oder nur „bis“:** offen nach der anderen Seite; „bis“ vor „von“ → Fehlermeldung am Feld.
- **Archivierte bzw. gelöschte Wohnung:** Aufenthalte darin zählen weiterhin; nur die Auswahl im Filter zeigt bestehende Objekte und Wohnungen.
- **Gast zusammengeführt** (PROJ-7): Aufenthalte und Verlauf beider Gäste gelten für den verbleibenden Gast.
- **Kunde gewechselt** während die Seite offen ist: Seite zeigt nach dem Wechsel die Gäste und Segmente des neuen Kunden bzw. ist ausgeblendet, wenn die Person dort Mitarbeiter ist.
- **Sonderzeichen in Namen** (z. B. Semikolon, Anführungszeichen, Zeilenumbruch in der Firma): Die CSV-Datei bleibt lesbar (Felder korrekt eingefasst). Zellen, die mit „=“, „+“, „-“ oder „@“ beginnen, werden so ausgegeben, dass Excel sie nicht als Formel ausführt.
- **Netzwerkfehler beim Export:** Fehlermeldung, kein halber Download; Filter bleiben erhalten.

## Technical Requirements
- Mandantentrennung wie überall; Seite, Segmente und Export nur für Inhaber des Kunden, auch serverseitig geprüft.
- Trefferliste und Export berücksichtigen den aktuellen Stand der Einwilligung zum Zeitpunkt des Abrufs.
- Seite mit Filtern bei bis zu 5.000 Gästen je Kunde unter 2 Sekunden; Export von 5.000 Gästen unter 10 Sekunden.
- Browser: Chrome, Firefox, Safari, auch iPad und Handy.

## Open Questions
- Keine offenen Fragen. (Obergrenze für große Exporte: entschieden, keine; siehe Decision Log.)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Seite „Marketing“ statt Erweiterung der Gästeliste | Klare Trennung: dort erscheinen nur bewerbbare Gäste; die Gästeliste bleibt am Handy schlank | 2026-11-12 |
| Nur Inhaber des gewählten Kunden | Export vieler Kontaktdaten ist datenschutzrechtlich heikel; wie „Auswertungen“ und „Ortstaxe“. Eine Einwilligung gilt nur für den Kunden, dem sie gegeben wurde | 2026-11-12 |
| Filter: Aufenthaltszeitraum, Anzahl Aufenthalte, Objekt/Wohnung, Buchungsquelle, Herkunftsland (Adresse), Sprache, Erreichbar per | Nutzerwahl; deckt typische Aussendungen ab (Stammgäste, Saison, Land, Sprache, Kanal) | 2026-11-12 |
| Buchungsquelle: Gast erscheint bei mindestens einer passenden Buchung (im Zeitraum, falls gesetzt) | Einfach verständlich; Gäste mit gemischten Quellen fallen nicht heraus | 2026-11-12 |
| Nur angetretene Aufenthalte (Buchung, nicht storniert, Anreise bis heute) | Gleiche Zählweise wie die Gästeliste; Stammgast heißt „war schon da“ | 2026-11-12 |
| Anzahl Aufenthalte über alle Zeit, unabhängig vom Zeitraumfilter | „Stammgast“ ist eine Eigenschaft des Gastes, nicht des Zeitraums; Zeitraum und Anzahl lassen sich kombinieren | 2026-11-12 |
| Herkunft = Land der Adresse | Wie „Gästeherkunft“ in den Auswertungen (seit PROJ-26); passt zu Aussendungen je Land | 2026-11-12 |
| Gäste ohne eigene Kontaktmöglichkeit fehlen, Hinweis mit Anzahl; Filter „Erreichbar per“ | Plattform-Adressen dürfen nicht beworben werden; der Hinweis zeigt, wo Kontaktdaten nachzutragen wären | 2026-11-12 |
| CSV mit Kontakt und Merkmalen (Anrede bis „eingewilligt seit“) | Reicht für Newsletter-Programme und Serienbriefe; Merkmale erlauben Nacharbeit in Excel | 2026-11-12 |
| Benannte Segmente, die nur die Filter speichern | Nutzerwunsch; neu berechnet, damit Widerrufe sofort wirken (DSGVO) | 2026-11-12 |
| Segmente gehören dem Kunden, alle Inhaber teilen sie | Mehrere Inhaber arbeiten mit denselben Aussendungen | 2026-11-12 |
| Jeder Export ins Protokoll, ohne Anzeige in der App | Nachweis nach DSGVO, ohne zusätzlichen Bildschirm | 2026-11-12 |
| Export nur als Download, keine Kopie in der App | Eine gespeicherte Kontaktliste wäre nach einem Widerruf veraltet und müsste eigens gelöscht werden; der Export wird bei Bedarf neu erzeugt | 2026-11-12 |
| Keine Obergrenze für die Anzahl exportierter Gäste | Nutzerentscheid; Pilotkunden haben wenige hundert Gäste | 2026-11-12 |
| Dateiname `gaeste_[Kundenname]_[JJJJ-MM-TT_HH-MM].csv` | Nutzervorgabe; Kunde und Zeitpunkt sind auf einen Blick erkennbar, mehrere Exporte am selben Tag überschreiben sich nicht | 2026-11-12 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine Datenbank-Abfrage liefert Trefferseite, Gesamtzahl, Zahl ohne Kontaktdaten und (ohne Blättern) die Exportzeilen | Eine Stelle für alle Regeln; Liste und Datei stimmen immer überein; wiederverwendbar für PROJ-22 | 2026-11-12 |
| Plattform-E-Mail und -Telefon blendet schon die Datenbank-Abfrage aus | Sie können nirgends in der App oder im Export auftauchen, auch nicht durch einen Fehler in der Oberfläche | 2026-11-12 |
| CSV über eigene Download-Adresse (Muster Ortstaxe/Auswertungen), Datei wird nicht gespeichert | Rollenprüfung und Protokoll auf dem Server; immer aktueller Stand; keine veralteten Kontaktlisten | 2026-11-12 |
| Vorhandenen CSV-Baustein (Strichpunkt, BOM, CRLF, Formelschutz) wiederverwenden | Gleiches Verhalten in Excel wie die übrigen Exporte | 2026-11-12 |
| Segmente: eigene Tabelle je Kunde, Filter als ein Feld, nur Inhaber | Neue Filter ohne Umbau; Segmente speichern keine Gäste, Widerrufe wirken sofort | 2026-11-12 |
| Protokolleintrag je Export im bestehenden Änderungsprotokoll, ohne Gastdaten | DSGVO-Nachweis, ohne personenbezogene Daten ins Protokoll zu kopieren | 2026-11-12 |
| Filter in der Adresse, Segment öffnen = Filter in die Adresse laden | Lesezeichen, Zurück, Neuladen; ein Weg für Seite und Export | 2026-11-12 |
| Keine neuen Pakete | Alles mit vorhandenen Bausteinen machbar | 2026-11-12 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
### Überblick
Eine neue Seite **„Marketing“** mit Filterleiste, Segmentauswahl, Trefferliste und Export; dazu in der Datenbank eine Abfrage für die bewerbbaren Gäste, eine kleine Tabelle für Segmente und ein Protokolleintrag je Export. Kein neues Paket: Trefferliste, Blättern, Mehrfachauswahl, Dialoge und der CSV-Download folgen den Mustern von „Gästeliste“, „Auswertungen“ und „Ortstaxe“.

### A) Bildschirm-Aufbau

```
Seite „Marketing“ (/marketing, neu; nur Inhaber des gewählten Kunden)
+-- Kopf: Titel, Erklärung (nur Gäste mit Einwilligung, ohne Plattform-Adressen)
+-- Segmentleiste
|   +-- Auswahl „Segment öffnen“ (gespeicherte Segmente / „Keine Segmente“)
|   +-- „Als Segment speichern“ → Dialog: Name
|   +-- bei geöffnetem Segment: „Segment aktualisieren“ (Rückfrage), „Umbenennen“ (Dialog), „Löschen“ (Rückfrage)
|   +-- Hinweis, wenn eine gespeicherte Wohnung nicht mehr existiert
+-- Filterleiste (am Handy aufklappbar)
|   +-- Aufenthaltszeitraum von/bis (Monat/Jahr)
|   +-- Mindestens Aufenthalte (Zahl)
|   +-- Objekt/Wohnung (Mehrfachauswahl, Objekte mit ihren Wohnungen)
|   +-- Buchungsquelle (Mehrfachauswahl)
|   +-- Herkunftsland (Mehrfachauswahl mit Suche)
|   +-- Sprache (Mehrfachauswahl inkl. „Keine Angabe“)
|   +-- Erreichbar per (egal / E-Mail / Post)
|   +-- „Filter zurücksetzen“
+-- Trefferzahl („42 Gäste“) + Hinweis „x Gäste mit Einwilligung ohne eigene Kontaktdaten“
+-- Knopf „CSV exportieren“ (ausgegraut ohne Treffer)
+-- Trefferliste (Tabelle; am Handy Karten), 50 je Seite, Blättern
|   +-- Name (Link zur Gastseite), Ort/Land, Sprache, Erreichbar per, Aufenthalte, letzter Aufenthalt, eingewilligt seit
+-- Leere Zustände (noch keine Einwilligung / keine Treffer)

Menü (bestehend)
+-- NEU Punkt „Marketing“ nach „Auswertungen“ und „Ortstaxe“, nur für Inhaber des gewählten Kunden (am Handy unter „Mehr“)
```

### B) Daten (in Worten)

**Neu: Segmente** – je Segment:
- Kunde
- Name (bis 60 Zeichen, je Kunde eindeutig ohne Rücksicht auf Groß-/Kleinschreibung)
- Filter (die gespeicherten Einstellungen: Zeitraum, Mindestanzahl, Wohnungen/Objekte, Quellen, Länder, Sprachen, Erreichbar per)
- angelegt/geändert von und am

Lesen und Schreiben nur für Inhaber des Kunden. Wohnungen und Objekte stehen als Verweise in den Filtern; gibt es eine nicht mehr, wird sie beim Öffnen übergangen und gemeldet.

**Keine neuen Felder an Gästen oder Buchungen.** Die Trefferliste rechnet aus Vorhandenem:
- Stand der Einwilligung und „eingewilligt seit“ am Gast (aus PROJ-19)
- eigene E-Mail und eigenes Telefon (Herkunft „direkt“ statt „Plattform“, PROJ-7), Anschrift, Land der Adresse, Sprache
- Aufenthalte aus den Buchungen (Buchung, nicht storniert, Anreise bis heute) mit Wohnung und Buchungsquelle
- Anrede aus dem Geschlecht, Titel (PROJ-29), Firma über die Verknüpfung (PROJ-50)

**Protokoll:** Jeder Export legt einen Eintrag im bestehenden Änderungsprotokoll an (Person, Zeitpunkt, Kunde, Filter bzw. Segment, Anzahl der Gäste); keine Gastdaten im Eintrag. Segmente hängen wie andere Tabellen am Protokoll.

**Die CSV-Datei** wird beim Klick erzeugt und nur an den Browser geschickt; der Server speichert sie nicht.

### C) Abläufe

| Ablauf | Was passiert |
|--------|--------------|
| Seite öffnen / Filter ändern | Die Filter stehen in der Adresse. Der Server fragt die Datenbank nach einer Seite Treffer, der Gesamtzahl und der Zahl der Gäste mit Einwilligung ohne eigene Kontaktdaten, in einem Aufruf. |
| CSV exportieren | Eigene Download-Adresse mit denselben Filtern (wie bei Ortstaxe/Auswertungen). Der Server prüft Anmeldung und Inhaber-Rolle, holt alle Treffer aus derselben Datenbank-Abfrage, schreibt den Protokolleintrag und schickt die Datei mit dem Namen `gaeste_[Kunde]_[JJJJ-MM-TT_HH-MM].csv`. Plattform-E-Mail und -Telefon gibt die Abfrage gar nicht erst heraus. |
| Segment speichern / aktualisieren / umbenennen / löschen | Server-Aktionen mit Prüfung (Name, Eindeutigkeit, Inhaber); bei „aktualisieren“ und „umbenennen“ wird erkannt, wenn das Segment inzwischen gelöscht oder geändert wurde. |
| Segment öffnen | Lädt die gespeicherten Filter in die Adresse; die Liste wird neu berechnet (Widerrufe wirken sofort). |

### D) Rechte
- Seite, Trefferliste, Export und Segmente: nur **Inhaber** des gewählten Kunden; geprüft in der Seite, in der Download-Adresse und in der Datenbank (Abfrage und Segmente nur für Inhaber).
- Mitarbeiter: kein Menüpunkt; die Adresse zeigt „Seite nicht gefunden“, der Download antwortet mit „keine Berechtigung“.
- Mandantentrennung wie überall über die Zugriffsregeln der Datenbank.

### E) Technische Entscheidungen (Begründung)
- **Eine Datenbank-Abfrage für Liste und Export:** Die Regeln (nur „Erteilt“, eigene Kontaktdaten, Plattform-Daten ausblenden, Zählweise der Aufenthalte, Filter) stehen an einer Stelle. Liste und Datei können nicht voneinander abweichen, und PROJ-22 (Versand) kann sie später wiederverwenden.
- **Download-Adresse statt Datei im Browser zusammenbauen:** Wie bei „Ortstaxe“ und „Auswertungen“: Der Server prüft die Rolle, schreibt das Protokoll und liefert immer den aktuellen Stand; nichts bleibt gespeichert.
- **CSV-Format der bestehenden Exporte:** Strichpunkt, UTF-8 mit Kennung für Excel, Schutz vor Formeln (Zellen mit „=“, „+“, „-“, „@“), korrekt eingefasste Felder. Der vorhandene Baustein aus PROJ-16/18 wird wiederverwendet.
- **Segmente als eigene kleine Tabelle mit den Filtern als einem Feld:** Neue Filter lassen sich später ergänzen, ohne die Tabelle umzubauen; Widerrufe wirken, weil keine Gästeliste gespeichert wird.
- **Filter in der Adresse:** Lesezeichen, „Zurück“ und Neuladen funktionieren; Segment öffnen heißt nur „Adresse mit diesen Filtern laden“.
- **Kein neues Paket.**

### F) Abhängigkeiten (Pakete)
- Keine neuen Pakete.

### G) Arbeitsteilung
- **/frontend:** Seite, Menüpunkt, Filterleiste (Mehrfachauswahl wie die Länderauswahl), Segmentleiste mit Dialogen, Trefferliste mit Blättern und leeren Zuständen, Export-Knopf, Texte.
- **/backend:** Datenbank-Abfrage der bewerbbaren Gäste (Seite, Gesamtzahl, Zahl ohne Kontaktdaten; ohne Blättern für den Export), Segment-Tabelle mit Regeln und Protokoll, Protokolleintrag je Export, Download-Adresse für die CSV-Datei, Server-Aktionen für Segmente, Typen neu erzeugen, Bereinigung bei gelöschtem Kunden (Kaskade).

## Implementation Notes (Frontend, 2026-11-12)

### Gebaut
- **Seite `/marketing`** (`src/app/(app)/marketing/page.tsx`), nur Inhaber des gewählten Kunden.
  - Prüfung im gemeinsamen Layout, damit Mitarbeiter eine echte 404-Antwort bekommen (wie bei „Ortstaxe“ und „Auswertungen“).
  - Menüpunkt „Marketing“ nach „Ortstaxe“ (Symbol Megafon), am Handy unter „Mehr“.
- **Filterleiste** (`src/components/marketing/marketing-filters.tsx`)
  - Aufenthalt von/bis als Monat + Jahr; nur Jahr gewählt → Jänner bzw. Dezember; nur Monat → laufendes Jahr.
  - „Mindestens Aufenthalte“: Auswahl 1–10.
  - Erreichbar per.
  - Mehrfachauswahlen für Objekt/Wohnung (Objekt als „ganzes Objekt“ über seinen Wohnungen, archivierte gekennzeichnet), Buchungsquelle, Herkunftsland (mit Suche) und Sprache (inkl. „Keine Angabe“).
  - Am Handy aufklappbar mit Anzahl aktiver Filter; „Filter zurücksetzen“.
  - Mehrfachauswahl `src/components/marketing/multi-select.tsx` aus Popover + Command; übernimmt beim Schließen.
- **Adresse:** `?von=2026-06&bis=2026-08&aufenthalte=2&objekt=…&wohnung=…&quelle=website,booking_com&land=DE,AT&sprache=de,none&erreichbar=email&segment=…&seite=2`.
- **Segmentleiste** (`segment-bar.tsx`)
  - Öffnen lädt die gespeicherten Filter in die Adresse.
  - „Als Segment speichern“ (Dialog, Name 1–60) öffnet danach das neue Segment.
  - Bei geänderten Filtern Hinweis „Filter geändert“ und „Segment aktualisieren“ (Rückfrage).
  - „Umbenennen“ (Dialog) und „Löschen“ (Rückfrage; die Filter bleiben stehen).
  - Doppelter Name → Meldung am Feld.
  - Gespeicherte, aber gelöschte Objekte/Wohnungen fallen aus dem Filter, Hinweis erscheint.
- **Trefferliste** (`marketing-list.tsx`): Tabelle ab 768 px, Karten am Handy, Name führt zur Gastseite, 50 je Seite.
- **Export:** Knopf „CSV exportieren“; die vorhandenen Export-Knöpfe (`report-export-buttons.tsx`) können jetzt auch nur CSV.
  - Dateiname aus `marketingFileName` (Server-Antwort hat Vorrang).
  - Ausgegraut ohne Treffer.
- **Regeln und Typen:** `src/lib/marketing.ts` (Adresse lesen/schreiben, Segmentfilter lesen, Vergleich, Anrede, Dateiname), `src/lib/validation/marketing.ts`.
- **Lesen:** `src/lib/marketing-data.ts`. **Aktionen:** `src/app/(app)/marketing/actions.ts`; nach Anlegen und Löschen leiten sie selbst weiter (Next-16-Problem mit `router.push`).
- **Texte:** `marketing.*`, `nav.marketing`.
- **Tests:** `src/lib/marketing.test.ts`; Navigation und PROJ-45-Menüreihenfolge angepasst.
- **Übergang bis /backend:**
  - Die Seite zeigt „Die Gästeliste für Marketing wird gerade eingerichtet.“
  - Die Segmentauswahl ist gesperrt.
  - Der Export meldet einen Fehler.
- **Sichttest** (gebaute App, Dev): Desktop und Handy ohne seitliches Scrollen, axe ohne Verstöße; Mitarbeiter: 404 und kein Menüpunkt.

### Erwartete Datenbank-Schnittstellen (für /backend)

**Tabelle `marketing_segments`**
- Spalten: `id`, `tenant_id`, `name` (getrimmt, 1–60), `filters` (jsonb), `created_at/by`, `updated_at/by`.
- Eindeutig je Kunde über `lower(name)` → Fehler 23505.
- Zugriffsregeln: Lesen, Anlegen, Ändern, Löschen nur `has_role(tenant_id, 'owner')`; deaktivierter Kunde → P0016.
- Protokoll über `enable_tenant_table`; Kaskade beim Löschen des Kunden.
- Form von `filters`: `{from, to, minStays, properties[], apartments[], sources[], countries[], languages[], reach}` (siehe `filtersPayload`).

**Funktion `marketing_guest_list(p_tenant_id uuid, p_filters jsonb, p_limit integer, p_offset integer) → jsonb`**
- Nur Inhaber (42501).
- `p_limit` null = alle (Export).
- Ergebnis: `{total, without_contact, rows: [...]}`.
- Felder je Zeile:
  - `id`, `last_name`, `first_name`, `title_prefix`, `title_suffix`, `gender`, `company_name`
  - `email` (nur `email_source = 'direct'`), `phone` (nur `phone_source = 'direct'`)
  - `street`, `postal_code`, `city`, `address_country`, `language`
  - `stay_count`, `last_stay`, `consent_on`
- Regeln laut Spec „Wer erscheint“, „Aufenthalt“ und „Filter“:
  - Stand `granted`.
  - Eigene Kontaktmöglichkeit: direkte E-Mail oder Straße + (PLZ oder Ort).
  - Aufenthalt = Buchung, nicht storniert, Anreise ≤ heute (Wien).
  - Zeitraum überschneidet [Monatsanfang von, Monatsende bis].
  - `minStays` zählt alle Aufenthalte.
  - Wohnungen = gewählte Wohnungen ∪ Wohnungen der gewählten Objekte; Wohnungs- und Quellenfilter wirken auf Aufenthalte im Zeitraum, falls gesetzt.
  - `languages` mit `'none'` für leere Sprache.
  - `reach` email/post.
- Sortierung: Nachname, Vorname, id.
- `without_contact`: Gäste mit `granted` ohne eigene Kontaktmöglichkeit; die übrigen Filter wirken dafür nicht.

**Download `/api/marketing/csv`**
- GET mit denselben Parametern wie die Seite.
- Nur Inhaber: 401 ohne Anmeldung, 404 für Mitarbeiter wie bei Ortstaxe.
- Spalten laut Spec, Dateiname `marketingFileName`, `no-store`.
- CSV-Baustein aus PROJ-16 (`csvText`, BOM, CRLF).

**Protokolleintrag je Export**
- Inhalt: Person, Zeitpunkt, Kunde, Filter, Segment-ID (falls `segment` in der Adresse) und Anzahl.
- Ohne Gastdaten.
- Nur für Inhaber, z. B. über eine Funktion `log_marketing_export`.

## Implementation Notes (Backend, 2026-11-12)

### Gebaut
- **Migration** `20261112072927_marketing_segments_export.sql` und Korrektur `20261112073305_marketing_guest_list_company.sql` (Fehler 42702: Firmenname hieß wie die alte Gastspalte `company_name`), auf Dev eingespielt. Typen neu erzeugt; Advisors nur mit dem bekannten Hinweis `auth_otp_long_expiry`.
- **Tabelle `marketing_segments`**
  - Name getrimmt, 1–60 Zeichen, eindeutig je Kunde über `lower(name)` (Fehler 23505).
  - `filters` als jsonb-Objekt.
  - Zugriffsregeln für Lesen, Anlegen, Ändern und Löschen: nur `has_role(tenant_id, 'owner')`.
  - Ändern nur von Name und Filtern (Spaltenrechte).
  - Deaktivierter Kunde → P0016.
  - Protokoll über `enable_tenant_table`; Kaskade mit dem Kunden.
- **`marketing_guest_list(p_tenant_id, p_filters, p_limit, p_offset) → jsonb`**
  - Rechte: läuft mit den Rechten der Person (security invoker) und prüft die Inhaber-Rolle (42501).
  - Gäste: Stand „granted“, nicht anonymisiert, eigene E-Mail (`email_source = 'direct'`) oder Straße + PLZ/Ort.
  - Ausgabe: E-Mail und Telefon nur, wenn direkt erfasst.
  - Aufenthalt: Buchung, nicht storniert, Anreise ≤ heute (Wien).
  - Zeitraum: Abreise > Monatsanfang „von“ und Anreise ≤ Monatsende „bis“.
  - Wohnungen: gewählte Wohnungen und alle Wohnungen der gewählten Objekte. Wohnung, Quelle und Zeitraum gelten für denselben Aufenthalt.
  - `minStays` zählt alle Aufenthalte des Gastes.
  - Eine unbekannte Wohnung ergibt keine Treffer (die App entfernt gelöschte Wohnungen vorher).
  - Ungültige Werte in den Filtern werden übergangen (Muster je Liste).
  - Blättern bis 1000 je Abruf, `p_limit` null = alle.
- **`log_marketing_export`** (nur Inhaber)
  - Eintrag im `audit_log` mit `table_name = 'marketing_exports'`, Person und Zeit.
  - `new_data`: Filter, Segment-ID und -Name, Anzahl; keine Gastdaten.
- **Download `/api/marketing/csv`** (`src/lib/marketing-export.ts`)
  - Ohne Anmeldung 401, offene 2FA bzw. Mitarbeiter 403, keine Treffer 404, fehlende Datenbank-Funktion 503.
  - Ablauf: Filter wie die Seite (gelöschte Objekte und Wohnungen entfernt), alle Zeilen, erst Protokoll, dann Datei. Scheitert das Protokoll → 500 ohne Datei.
  - CSV über `buildMarketingCsv`: Strichpunkt, BOM, CRLF, Formelschutz aus PROJ-16; Spalten aus `marketing.csv.columns`.
  - Dateiname `gaeste_[Kunde]_[JJJJ-MM-TT_HH-MM].csv`, `no-store`, keine Kopie auf dem Server.

### Tests
- `supabase/tests/marketing.integration.test.ts` (7):
  - Einwilligung und Kontakt, Plattform-Daten ausgeblendet, „Erreichbar per“.
  - Nur Inhaber.
  - Aufenthalte mit allen Filtern und Zählweise.
  - Land und Sprache, Blättern und Export ohne Blättern.
  - Segmente mit Zugriffsregeln, Namen und Protokoll.
  - Export-Protokoll.
- `src/app/api/marketing/marketing.test.ts` (3): Zugang, Filter an die Datenbank, Protokoll vor der Datei, Dateiname, BOM, Spalten, Formelschutz, Fehlerfälle.
- Grün:
  - Unit: 1074.
  - Integration: rls, operator, marketing-consent.
  - Lint und Build.
- **Durchstich im Browser** (gebaute App, Dev):
  - Liste mit Hinweis „ohne eigene Kontaktdaten“.
  - Filter Land.
  - Segment speichern, aktualisieren, umbenennen, öffnen, löschen.
  - CSV-Download mit richtigem Namen und ohne Plattform-Adresse; Protokolleintrag vorhanden.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
