# PROJ-52: Marketing: Segmente und CSV-Export

## Status: Planned
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
| Keine Obergrenze für die Anzahl exportierter Gäste | Nutzerentscheid; Pilotkunden haben wenige hundert Gäste | 2026-11-12 |
| Dateiname `gaeste_[Kundenname]_[JJJJ-MM-TT_HH-MM].csv` | Nutzervorgabe; Kunde und Zeitpunkt sind auf einen Blick erkennbar, mehrere Exporte am selben Tag überschreiben sich nicht | 2026-11-12 |

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
