# PROJ-18: Statistische Auswertungen

## Status: Approved
**Created:** 2026-11-08
**Last Updated:** 2026-11-08

## Dependencies
- Requires: PROJ-1 (Supabase-Infrastruktur): Mandantentrennung (RLS)
- Requires: PROJ-4 (Kundenkonten & Rollen): Inhaber/Mitarbeiter, gewählter Kunde
- Requires: PROJ-6 (Wohnungsverwaltung): Objekte, Wohnungen, Anlage- und Archivierungsdatum
- Requires: PROJ-7 (Gäste-Datenbank): Herkunftsland des Hauptgasts, Anonymisieren
- Requires: PROJ-8, PROJ-30 (Buchungen): Arten Buchung/Option/Sperre, Storno mit Stornogebühr, tatsächliche Abreise, Erwachsene/Kinder, Preispositionen
- Requires: PROJ-14 (Dashboard): Kacheln, Kundenfilter, Rechte je Kunde (die Inhaber-Kacheln werden hier geändert)
- Requires: PROJ-15 (Ortstaxe je Wohnung): Ortstaxe-Kennzeichen der Positionen (nicht Umsatz)
- Requires: PROJ-35, PROJ-36 (USt je Position, Kleinunternehmer): enthaltene USt
- Requires: PROJ-41 (Briefpapier): Logo und Aussteller-Block für das PDF
- Requires: PROJ-45 (Zahlungserfassung): nur als Abgrenzung (Zahlungen sind nicht Grundlage)

## Überblick
Der bisher gesperrte Menüpunkt **„Auswertungen“** (`/auswertungen`, nur Inhaber) wird freigeschaltet. Er zeigt für den gewählten Kunden und einen wählbaren Zeitraum **Auslastung**, **Umsatz** und **Gästeherkunft**, jeweils mit dem Vorjahr verglichen und filterbar nach Objekt und Wohnung. Die Auswertung lässt sich als **PDF** (mit Briefpapier und Diagrammen) und als **CSV** (Rohdaten je Wohnung und Monat) exportieren.

Zusätzlich erhält der **Inhaber** auf dem Dashboard die vier Kacheln aus dem Design-Entwurf: Auslastung und Umsatz des laufenden Monats, Offene Rechnungen und Heute (An-/Abreisen).

## Rechenregeln

### Belegte Nächte
- Es zählen Nächte aus **Buchungen** (Art „Buchung“) von der Anreise bis zur **tatsächlichen Abreise**. Optionen gelten als frei. Stornierte Buchungen zählen nicht.
- Eine Nacht gehört zu dem Monat, in dem sie beginnt (Nacht vom 31.10. auf 01.11. → Oktober).
- Überschneiden sich zwei Buchungen in derselben Wohnung (Doppelbuchung), zählt die Nacht für die Auslastung **einmal**. Der Umsatz zählt für beide Buchungen.

### Gesperrte Nächte
- Nächte aus **Sperren** (nicht storniert) werden von den verfügbaren Nächten abgezogen und eigens ausgewiesen.
- Ist eine Nacht zugleich gebucht und gesperrt, gilt sie als belegt, nicht als gesperrt.

### Verfügbare Nächte
- Je Wohnung zählen die Nächte ab dem **ersten Tag des Monats, in dem ihre erste Buchung anreist** (Art „Buchung“, nicht storniert). Hat die Wohnung keine Buchung, zählt sie ab ihrer **Anlage**.
- Archivierte Wohnungen zählen bis zum Tag der Archivierung. Liegt danach noch eine belegte oder gesperrte Nacht, zählt diese Nacht als verfügbar, damit die Auslastung nie über 100 % steigt.
- **Verfügbare Nächte** = Nächte, an denen die Wohnung zählt, minus gesperrte Nächte.
- **Auslastung** = belegte Nächte ÷ verfügbare Nächte, auf ganze Prozent gerundet. Sind keine Nächte verfügbar, steht „–“.

### Umsatz
- **Grundlage** ist der Preis jeder Buchung (Art „Buchung“): Übernachtung und alle Zusatzpositionen einschließlich negativer Positionen (Rabatt, Gutschrift), **ohne** Positionen mit Ortstaxe-Kennzeichen (PROJ-15). Es gilt der Preis, der in der Buchung steht (auch nach Verlängerung mit der gewählten Preisregel, PROJ-30).
- Der Betrag wird **gleichmäßig auf die Nächte** bis zur tatsächlichen Abreise verteilt und dem Monat der jeweiligen Nacht zugerechnet. Rundungsreste in Cent gehen in die letzte Nacht, so dass die Summe genau stimmt.
- **Stornierte Buchungen mit Stornogebühr:** Die Gebühr zählt zum Umsatz im **Monat der Anreise**, mit ihrem eigenen USt-Satz. Sie erzeugt keine belegten Nächte. Sie zählt bei der Wohnung und beim Herkunftsland der Buchung.
- **Brutto** ist die Hauptzahl. Darunter steht klein **„inkl. € … USt“**, die enthaltene USt aus den Positionen (PROJ-35), nach derselben Verteilung. Ist die enthaltene USt 0 (z. B. Kleinunternehmer), steht „ohne USt“.
- Rechnungen und Zahlungen sind **nicht** Grundlage. Provisionen von booking.com/Airbnb werden nicht abgezogen.

### Weitere Kennzahlen
- **Durchschnittspreis je Nacht** = Umsatz brutto ohne Stornogebühren ÷ belegte Nächte. Keine belegten Nächte: „–“.
- **Buchungen** = Anzahl der Buchungen (Art „Buchung“, nicht storniert) mit **Anreise** im Zeitraum.
- **Durchschnittliche Aufenthaltsdauer** = Nächte dieser Buchungen (Anreise bis tatsächliche Abreise, auch über das Zeitraumende hinaus) ÷ Anzahl, eine Nachkommastelle.
- **Gästenächte** = Personen (Erwachsene + Kinder) × belegte Nächte im Zeitraum.
- **Ankünfte** = Personen (Erwachsene + Kinder) der Buchungen mit Anreise im Zeitraum.

### Vorjahresvergleich
- Verglichen wird mit **denselben Monaten des Vorjahres** und demselben Objekt-/Wohnungsfilter, nach denselben Regeln.
- Darstellung: Vorjahreswert klein unter dem Wert, dazu die Veränderung: bei der Auslastung in **Prozentpunkten** („+4 Pp.“), sonst in **Prozent** („+12 %“), mit Pfeil nach oben bzw. unten, ohne Farbwertung.
- Ist der Vorjahreswert 0 oder nicht bestimmbar (keine verfügbaren Nächte), steht beim Vorjahr „–“ und keine Veränderung.

## Seite „Auswertungen“

### Zugriff
- Nur **Inhaber** des gewählten Kunden. Die Auswertung gilt immer für den **aktuell gewählten Kunden**.
- Mitarbeiter sehen den Menüpunkt nicht. Direkter Aufruf der Seite oder der Exporte zeigt „Kein Zugriff“ bzw. liefert keine Daten, auch serverseitig geprüft.
- Der Menüpunkt ist nicht mehr als „bald verfügbar“ gekennzeichnet.

### Zeitraum und Filter (oben)
- **Jahr**, **Von Monat**, **Bis Monat** (innerhalb des Jahres, „Bis“ nicht vor „Von“) wie in den Ortstaxen-Berichten (PROJ-16).
- **Standard beim Öffnen:** laufendes Jahr, Jänner bis Dezember, künftige Monate eingeschlossen.
- **Schnellwahl:** „Dieses Jahr“, „Letztes Jahr“, „Letzter Monat“, „Letztes Quartal“ (jeweils ganz abgelaufen, außer „Dieses Jahr“).
- **Objekt:** „Alle Objekte“ (Standard) oder ein Objekt. **Wohnung:** „Alle Wohnungen“ (Standard) oder eine Wohnung des gewählten Objekts (ohne Objektwahl: alle Wohnungen). Archivierte Wohnungen sind wählbar und als „archiviert“ gekennzeichnet.
- Reicht der Zeitraum in den laufenden Monat oder in die Zukunft, erscheint der Hinweis **„Zeitraum noch nicht abgeschlossen – enthält auch künftige Buchungen.“**
- Zeitraum und Filter stehen in der Adresse (Neu laden, Lesezeichen, „Zurück“). Ungültige Werte führen auf den Standard zurück. Gehört die Wohnung nicht zum Objekt, gilt „Alle Wohnungen“.

### Kennzahlen-Kacheln
| Kachel | Wert | Zusatzzeile | Vorjahr |
|---|---|---|---|
| Auslastung | „62 %“ | „1.180 von 1.900 Nächten, 45 gesperrt“ | ✓ (Pp.) |
| Umsatz | „€ 84.320,00“ | „inkl. € 7.910,00 USt“ | ✓ |
| Durchschnittspreis je Nacht | „€ 71,46“ | – | ✓ |
| Buchungen | „143“ | „Ø 8,3 Nächte“ | ✓ (Anzahl) |
| Gästenächte | „3.410“ | „1.020 Ankünfte“ | ✓ |

### Je Monat
- **Balkendiagramm** je Monat des Zeitraums, umschaltbar zwischen „Auslastung“ und „Umsatz“ (Standard „Auslastung“); das Vorjahr als blasser Balken neben dem Monat. Beim Zeigen bzw. Antippen eines Balkens erscheinen Monat, Wert und Vorjahr.
- **Tabelle** darunter: Monat, Auslastung, belegte Nächte, gesperrte Nächte, Umsatz brutto (USt klein darunter), Durchschnittspreis je Nacht, jeweils mit Vorjahr. Unten eine Summenzeile „Gesamt“ (Auslastung und Durchschnittspreis aus den Summen berechnet, nicht gemittelt).

### Je Wohnung
- Tabelle: Wohnung (nach Objekt gruppiert), Auslastung, belegte Nächte, gesperrte Nächte, Umsatz brutto (USt klein darunter), Durchschnittspreis je Nacht, jeweils mit Vorjahr.
- Standard-Sortierung nach Objekt und Wohnung. Ein Klick auf eine Spaltenüberschrift sortiert nach dieser Spalte (auf-/absteigend); dann entfällt die Gruppierung nach Objekt.
- Es erscheinen Wohnungen, die im Zeitraum verfügbare Nächte oder Umsatz haben. Archivierte sind gekennzeichnet.
- Ist eine einzelne Wohnung gefiltert, **entfällt** der Abschnitt.

### Gästeherkunft
- Tabelle je **Herkunftsland des Hauptgasts** (deutscher Ländername): Ankünfte, Gästenächte, Umsatz brutto, Anteil an den Gästenächten in %, jeweils mit Vorjahr.
- Sortiert nach Gästenächten absteigend. Die ersten **10 Länder** stehen einzeln, die übrigen werden als **„Übrige Länder“** zusammengefasst und lassen sich aufklappen.
- Ankünfte zählen nach Anreise im Zeitraum, Gästenächte und Umsatz nach Nächten im Zeitraum (wie die amtliche Tourismusstatistik).
- Mitreisende zählen mit dem Land des Hauptgasts. Anonymisierte Gäste behalten ihr Land und zählen mit.

### Leerer Zustand
- Keine verfügbaren Nächte und kein Umsatz im Zeitraum: **„Für den gewählten Zeitraum liegen keine Daten vor.“** Die Exporte sind deaktiviert.
- Kunde ohne Wohnungen: zusätzlich „Wohnungen legen Sie unter Einstellungen → Wohnungen an.“ mit Link.
- Leere Einzelabschnitte (z. B. keine Ankünfte): Abschnitt mit kurzem Leertext, z. B. „Im Zeitraum keine Anreisen.“

### Darstellung am Handy
- Kacheln zweispaltig, Abschnitte untereinander. Tabellen dürfen seitlich scrollen, die erste Spalte (Monat, Wohnung, Land) bleibt stehen. Die Seite selbst scrollt nicht seitlich.

## Exporte

### PDF
- Briefpapier (Logo, Aussteller-Block wie PROJ-16), Titel **„Auswertung“**, Zeitraum in Worten (z. B. „Jänner – Dezember 2026“), Filter (Objekt/Wohnung oder „Alle Wohnungen“), Stand mit Datum und Uhrzeit in der Fußzeile.
- Inhalt: Kennzahlen mit Vorjahr, **zwei Balkendiagramme** (Auslastung und Umsatz je Monat, jeweils mit Vorjahr), Tabelle „Je Monat“, Tabelle „Je Wohnung“ (entfällt bei einzelner Wohnung), Tabelle „Gästeherkunft“ mit **allen Ländern ausgeschrieben**.
- Hinweis „Zeitraum noch nicht abgeschlossen“ wird übernommen.
- Dateiname: `Auswertung_<Zeitraum>_<Objekt/Wohnung oder Alle>_Stand-2026-11-08.pdf`.

### CSV
- Eine Zeile **je Wohnung und Monat** des Zeitraums. Spalten: Monat (`2026-10`), Objekt, Wohnung, verfügbare Nächte, belegte Nächte, gesperrte Nächte, Auslastung (%), Umsatz brutto, enthaltene USt, Gästenächte, Ankünfte.
- Nur Zeilen mit verfügbaren Nächten oder Umsatz. Keine Summenzeilen, kein Vorjahr, keine Gästeherkunft.
- Format wie PROJ-16: Strichpunkt, Komma als Dezimalzeichen, Beträge ohne „€“ mit zwei Nachkommastellen, UTF-8 mit BOM, Schutz vor Formeln (Texte, die mit `=`, `+`, `-`, `@` beginnen), korrekte Behandlung von Strichpunkt und Anführungszeichen.
- Dateiname: `Auswertung_<Zeitraum>_<Objekt/Wohnung oder Alle>_Stand-2026-11-08.csv`.

## Dashboard (Änderung an PROJ-14)

### Inhaber
Hat die Person im Dashboard-Kundenfilter mindestens einen Kunden, bei dem sie **Inhaber** ist, sieht sie diese vier Kacheln (wie im Design-Entwurf):

| Kachel | Wert | Zusatzzeile |
|---|---|---|
| Auslastung [laufender Monat] | „62 %“ | „118 von 190 Nächten“ |
| Umsatz [laufender Monat] | Brutto | „inkl. € … USt“ |
| Offene Rechnungen | Summe offen | „N Rechnungen, davon M überfällig“ (wie bisher) |
| Heute | „2 / 3“ | „Anreisen / Abreisen“; bei Bedarf zusätzlich „davon N ohne Rechnung“ |

- Auslastung und Umsatz nach den Rechenregeln oben, für den ganzen laufenden Monat (auch künftige Nächte), über **alle Wohnungen der Kunden im Filter, bei denen die Person Inhaber ist**. Offene Rechnungen und Heute gelten wie bisher für alle Kunden im Filter.
- „Heute“ zählt An- und Abreisen wie die bisherigen Kacheln „Anreisen heute“ und „Abreisen heute“.
- Ein Klick auf Auslastung oder Umsatz öffnet „Auswertungen“ für den laufenden Monat, wenn der Filter **genau einen** Inhaber-Kunden umfasst (bei einem anderen als dem gewählten Kunden mit Kundenwechsel wie bei den Zeilen). Umfasst er mehrere, sind die Kacheln nicht anklickbar.
- Die Kacheln „Anreisen heute“ (mit „N Gäste“), „Abreisen heute“ und „Belegt heute“ entfallen für den Inhaber. Die Belegung steht weiterhin in der Unterzeile, die Personen im Abschnitt „Heute“.

### Mitarbeiter
- Umfasst der Filter keinen Kunden, bei dem die Person Inhaber ist, bleiben die **bisherigen vier Kacheln** (Anreisen heute, Abreisen heute, Belegt heute, Offene Rechnungen) unverändert.
- Umsatz und Auslastung werden für Mitarbeiter nicht berechnet und nicht ausgeliefert.

## User Stories
- Als **Inhaber** möchte ich die Auslastung meiner Wohnungen je Monat sehen, damit ich schwache Zeiten erkenne und Preise oder Mindestaufenthalte anpasse.
- Als **Inhaber** möchte ich den Umsatz brutto mit der enthaltenen USt sehen, damit ich mein Geschäft einschätzen und die Umsatzsteuer abschätzen kann.
- Als **Inhaber** möchte ich jeden Wert mit dem Vorjahr vergleichen, damit ich trotz Saisonschwankungen sehe, ob es besser oder schlechter läuft.
- Als **Inhaber** möchte ich die Zahlen je Wohnung sehen und nach Objekt oder Wohnung filtern, damit ich erkenne, welche Wohnung schwächelt.
- Als **Inhaber** möchte ich sehen, aus welchen Ländern meine Gäste kommen, damit ich meine Werbung gezielt ausrichten kann.
- Als **Inhaber** möchte ich die Auswertung als PDF und CSV exportieren, damit ich sie an Bank oder Steuerberatung weitergeben oder in Excel weiterrechnen kann.
- Als **Inhaber** möchte ich Auslastung und Umsatz des laufenden Monats auf dem Dashboard sehen, damit ich den Stand ohne Seitenwechsel kenne.
- Als **Mitarbeiter** soll ich keine Umsätze und Auswertungen sehen, weil diese dem Inhaber vorbehalten sind.

## Out of Scope
- **Auswertung nach Kanälen** (booking.com, Airbnb, direkt, Buchungsquellen) → als Prüfpunkt bei PROJ-11 (Buchungsimport aus Channex); Entscheidung beim Spec-Interview zu PROJ-11
- Stornoquote
- Feld „vermietet ab“ je Wohnung (genauere verfügbare Nächte) → bei Bedarf über `/refine PROJ-18`
- Nettoumsatz als Hauptzahl; Umsatz nach Abzug von Provisionen und Zahlungsgebühren (PROJ-45)
- Umsatz nach Rechnungsdatum oder Zahlungseingang (stehen in „Rechnungen“ und „Zahlungen“)
- Bettenauslastung (nach Personenkapazität)
- Vergleich mit dem Vormonat oder frei wählbaren Zeiträumen
- Mehrfachauswahl von Wohnungen
- Auswertung über mehrere Kunden auf der Seite „Auswertungen“ (nur Dashboard-Kacheln gehen über Kunden)
- Gästeherkunft in der CSV
- Prognosen, gespeicherte Berichte, automatischer Versand
- Auswertungen für Mitarbeiter oder den Betreiber

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugriff
- [ ] Angenommen ein Inhaber, wenn er das Menü öffnet, dann ist „Auswertungen“ ohne Kennzeichen „bald verfügbar“ anwählbar
- [ ] Angenommen ein Mitarbeiter, wenn er das Menü öffnet, dann sieht er „Auswertungen“ nicht
- [ ] Angenommen ein Mitarbeiter, wenn er `/auswertungen` oder die Export-Adressen direkt aufruft, dann erhält er „Kein Zugriff“ bzw. keine Daten
- [ ] Angenommen ein Inhaber bei Kunde A und Kunde B mit gewähltem Kunden A, wenn er „Auswertungen“ öffnet, dann enthalten alle Werte nur Daten von Kunde A

### Zeitraum und Filter
- [ ] Angenommen heute ist der 08.11.2026, wenn der Inhaber „Auswertungen“ öffnet, dann ist Jänner–Dezember 2026 gewählt und der Hinweis „Zeitraum noch nicht abgeschlossen – enthält auch künftige Buchungen.“ erscheint
- [ ] Angenommen heute ist der 08.11.2026, wenn der Inhaber „Letztes Quartal“ wählt, dann ist Juli–September 2026 gewählt und kein Hinweis erscheint
- [ ] Angenommen der Inhaber wählt ein Objekt, wenn er die Wohnungsauswahl öffnet, dann werden nur Wohnungen dieses Objekts angeboten, archivierte gekennzeichnet
- [ ] Angenommen eine Adresse mit Monat 13 oder einer Wohnung eines anderen Objekts, wenn die Seite lädt, dann gelten Standardzeitraum bzw. „Alle Wohnungen“
- [ ] Angenommen ein gewählter Zeitraum und Filter, wenn der Inhaber die Seite neu lädt, dann erscheint dieselbe Auswertung

### Auslastung
- [ ] Angenommen eine Wohnung mit Buchungen seit 2025 und im Oktober 2026 eine Buchung über 10 Nächte und eine Sperre über 1 Nacht, wenn Oktober 2026 ausgewertet wird, dann zeigt die Auslastung 10 von 30 Nächten (33 %) und „1 gesperrt“
- [ ] Angenommen eine Option im Oktober, wenn Oktober ausgewertet wird, dann zählen ihre Nächte als frei und ihr Preis nicht zum Umsatz
- [ ] Angenommen eine stornierte Buchung, wenn ausgewertet wird, dann zählen ihre Nächte nicht als belegt
- [ ] Angenommen eine Buchung vom 28.10. bis 03.11., wenn Oktober ausgewertet wird, dann zählen 4 Nächte (28.–31.10.) zum Oktober und 2 zum November
- [ ] Angenommen eine Buchung mit geplanter Abreise 10.10. und tatsächlicher Abreise 08.10., wenn ausgewertet wird, dann zählen die Nächte bis 08.10.
- [ ] Angenommen eine im Oktober 2026 angelegte Wohnung, deren erste Buchung im März 2025 anreist, wenn 2025 ausgewertet wird, dann zählt sie ab 01.03.2025 als verfügbar
- [ ] Angenommen eine Wohnung ohne Buchungen, am 15.10.2026 angelegt, wenn Oktober ausgewertet wird, dann zählt sie mit 17 verfügbaren Nächten
- [ ] Angenommen eine am 20.10. archivierte Wohnung, wenn Oktober ausgewertet wird, dann zählt sie mit 19 verfügbaren Nächten; ab November nicht mehr
- [ ] Angenommen eine Nacht ist zugleich gebucht und gesperrt, wenn ausgewertet wird, dann zählt sie als belegt und nicht als gesperrt
- [ ] Angenommen zwei sich überschneidende Buchungen in derselben Wohnung, wenn ausgewertet wird, dann zählt jede Nacht einmal als belegt und die Auslastung übersteigt nie 100 %

### Umsatz
- [ ] Angenommen eine Buchung über 4 Nächte mit Übernachtung € 400,00, Endreinigung € 60,00, Rabatt -€ 20,00 und Ortstaxe € 20,00, wenn ausgewertet wird, dann beträgt ihr Umsatz € 440,00, je Nacht € 110,00
- [ ] Angenommen eine Buchung über 3 Nächte mit € 100,00 Umsatz, davon 2 Nächte im Oktober, wenn Oktober ausgewertet wird, dann zählen € 66,66 bzw. € 66,67 so, dass Oktober und November zusammen genau € 100,00 ergeben
- [ ] Angenommen Übernachtung € 330,00 mit 10 % USt, wenn der Umsatz erscheint, dann steht darunter „inkl. € 30,00 USt“
- [ ] Angenommen ein Kleinunternehmer-Kunde, wenn der Umsatz erscheint, dann steht darunter „ohne USt“
- [ ] Angenommen eine stornierte Buchung mit Anreise im Dezember und Stornogebühr € 80,00, wenn Dezember ausgewertet wird, dann zählen € 80,00 zum Umsatz, aber keine Nächte und nicht zum Durchschnittspreis
- [ ] Angenommen eine Buchung wurde verlängert und der Preis nach der gewählten Regel neu berechnet, wenn ausgewertet wird, dann zählt der aktuelle Preis verteilt auf die tatsächlichen Nächte

### Kacheln und Vorjahr
- [ ] Angenommen Oktober 2026 mit 1.180 belegten von 1.900 verfügbaren Nächten und 45 gesperrten, wenn die Kachel erscheint, dann zeigt sie „62 %“ und „1.180 von 1.900 Nächten, 45 gesperrt“
- [ ] Angenommen 3 Buchungen mit Anreise im Zeitraum mit 2, 5 und 7 Nächten, wenn die Kachel „Buchungen“ erscheint, dann zeigt sie „3“ und „Ø 4,7 Nächte“
- [ ] Angenommen 2 Buchungen mit 2 und 3 Personen über je 4 Nächte im Zeitraum, wenn „Gästenächte“ erscheint, dann zeigt sie 20 und „5 Ankünfte“
- [ ] Angenommen Auslastung 62 % und im Vorjahr 58 %, wenn die Kachel erscheint, dann steht darunter „Vorjahr 58 %“ und „↑ +4 Pp.“
- [ ] Angenommen Umsatz € 11.200,00 und im Vorjahr € 10.000,00, wenn die Kachel erscheint, dann steht „↑ +12 %“
- [ ] Angenommen im Vorjahr gab es keine verfügbaren Nächte, wenn die Kacheln erscheinen, dann steht beim Vorjahr „–“ und keine Veränderung
- [ ] Angenommen ein Wohnungsfilter, wenn die Vorjahreswerte erscheinen, dann gelten sie für dieselbe Wohnung

### Je Monat
- [ ] Angenommen Jänner–Dezember, wenn der Abschnitt „Je Monat“ erscheint, dann zeigt das Diagramm 12 Monate mit Vorjahresbalken und die Tabelle 12 Zeilen mit Summenzeile „Gesamt“
- [ ] Angenommen der Inhaber schaltet auf „Umsatz“, wenn das Diagramm neu erscheint, dann zeigt es den Umsatz brutto je Monat mit Vorjahr
- [ ] Angenommen die Summenzeile, wenn sie berechnet wird, dann ist die Auslastung belegte ÷ verfügbare Nächte aller Monate (nicht der Mittelwert der Monatsprozente)

### Je Wohnung
- [ ] Angenommen „Alle Wohnungen“, wenn der Abschnitt erscheint, dann steht je Wohnung mit verfügbaren Nächten oder Umsatz eine Zeile, nach Objekt gruppiert
- [ ] Angenommen ein Klick auf „Umsatz“, wenn die Tabelle neu erscheint, dann ist sie nach Umsatz sortiert ohne Objektgruppen; ein zweiter Klick kehrt die Reihenfolge um
- [ ] Angenommen eine einzelne Wohnung ist gefiltert, wenn die Seite erscheint, dann gibt es keinen Abschnitt „Je Wohnung“

### Gästeherkunft
- [ ] Angenommen Gäste aus 13 Ländern, wenn der Abschnitt erscheint, dann stehen 10 Länder einzeln, nach Gästenächten sortiert, und darunter „Übrige Länder“ mit der Summe der restlichen 3, aufklappbar
- [ ] Angenommen ein anonymisierter Hauptgast aus Deutschland, wenn ausgewertet wird, dann zählt seine Buchung bei Deutschland
- [ ] Angenommen eine Buchung mit Anreise am 28.09. und Abreise am 03.10., wenn Oktober ausgewertet wird, dann zählen ihre Gästenächte im Oktober, aber keine Ankünfte

### Leerer Zustand
- [ ] Angenommen ein Kunde ohne Wohnungen, wenn der Inhaber „Auswertungen“ öffnet, dann erscheint „Für den gewählten Zeitraum liegen keine Daten vor.“ mit dem Hinweis auf Einstellungen → Wohnungen, und die Exporte sind deaktiviert

### PDF
- [ ] Angenommen Jänner–Dezember 2026 und „Alle Wohnungen“, wenn der Inhaber „PDF“ wählt, dann erhält er `Auswertung_2026_Alle_Stand-[Datum].pdf` mit Briefpapier, Kennzahlen, zwei Diagrammen, „Je Monat“, „Je Wohnung“ und „Gästeherkunft“ mit allen Ländern
- [ ] Angenommen eine einzelne Wohnung ist gefiltert, wenn das PDF erzeugt wird, dann nennt es die Wohnung und enthält keine Tabelle „Je Wohnung“

### CSV
- [ ] Angenommen Oktober–Dezember und 3 Wohnungen mit verfügbaren Nächten, wenn der Inhaber „CSV“ wählt, dann enthält die Datei eine Überschriftszeile und 9 Zeilen, ohne Summen und ohne Vorjahr
- [ ] Angenommen die CSV wird in Excel (deutsch) geöffnet, wenn sie angezeigt wird, dann stehen die Werte in getrennten Spalten, Umlaute sind korrekt und Beträge wie `1030,00` sind Zahlen
- [ ] Angenommen ein Wohnungsname, der mit `=` beginnt oder einen Strichpunkt enthält, wenn die CSV erzeugt wird, dann wird er nicht als Formel ausgeführt und die Spalten bleiben korrekt

### Dashboard
- [ ] Angenommen ein Inhaber am 08.11.2026, wenn er das Dashboard öffnet, dann sieht er die Kacheln „Auslastung November“, „Umsatz November“, „Offene Rechnungen“ und „Heute“
- [ ] Angenommen heute 2 Anreisen und 3 Abreisen, davon 1 ohne Rechnung, wenn der Inhaber das Dashboard öffnet, dann zeigt „Heute“ „2 / 3“, „Anreisen / Abreisen“ und „davon 1 ohne Rechnung“
- [ ] Angenommen ein Mitarbeiter, wenn er das Dashboard öffnet, dann sieht er unverändert „Anreisen heute“, „Abreisen heute“, „Belegt heute“ und „Offene Rechnungen“
- [ ] Angenommen eine Person ist Inhaberin bei A und Mitarbeiterin bei B, Filter „Alle Kunden“, wenn sie das Dashboard öffnet, dann zählen Auslastung und Umsatz nur Kunde A, Offene Rechnungen und Heute beide Kunden
- [ ] Angenommen ein Mitarbeiter ruft die Daten des Dashboards ab, wenn sie ausgeliefert werden, dann enthalten sie keine Umsatz- oder Auslastungswerte
- [ ] Angenommen der Filter umfasst genau einen Inhaber-Kunden, wenn der Inhaber auf „Umsatz November“ klickt, dann öffnet sich „Auswertungen“ für November 2026 dieses Kunden (bei Bedarf mit Kundenwechsel)
- [ ] Angenommen der Filter umfasst zwei Inhaber-Kunden, wenn das Dashboard erscheint, dann sind Auslastung und Umsatz nicht anklickbar
- [ ] Angenommen Auslastung November auf dem Dashboard und auf „Auswertungen“ für November mit „Alle Wohnungen“, wenn beide verglichen werden, dann stimmen die Werte überein

### Handy
- [ ] Angenommen ein Inhaber am Handy (375 px), wenn er „Auswertungen“ öffnet, dann stehen die Kacheln zweispaltig, die Abschnitte untereinander, Tabellen scrollen seitlich mit stehender erster Spalte und die Seite scrollt nicht seitlich

## Edge Cases
- **Buchung ändert sich nach dem Export:** Die Auswertung rechnet immer aus den aktuellen Daten. PDF und CSV zeigen ihren Stand (Fußzeile bzw. Dateiname).
- **Nacherfasste Altbuchungen:** Eine Wohnung zählt ab dem Monat ihrer ersten Buchung als verfügbar, auch wenn sie später angelegt wurde. Monate davor erscheinen ohne verfügbare Nächte („–“).
- **Buchung nach Archivierung:** Belegte oder gesperrte Nächte nach dem Archivierungsdatum zählen als verfügbar, die Auslastung bleibt ≤ 100 %.
- **Endbetrag unter 0** (z. B. hohe Gutschrift): wird so verteilt und mindert den Umsatz; Anzeige mit „-€“ in Rot (PROJ-32).
- **Buchung mit 0 Nächten** kann es nicht geben (Abreise nach Anreise). Stornogebühren ohne Nächte zählen nur zum Umsatz.
- **Verschobene Wohnung** (anderes Objekt): zählt beim aktuellen Objekt, auch für das Vorjahr.
- **Zeitraum ganz in der Zukunft:** erlaubt; zeigt den Buchungsstand mit Hinweis.
- **Kundenwechsel in anderem Tab:** Die Seite gilt für den gewählten Kunden zum Zeitpunkt des Ladens; Exporte prüfen Inhaberrolle und Kunden serverseitig erneut.
- **Viele Länder in der Herkunft:** Bildschirm zeigt 10 plus „Übrige Länder“, das PDF alle.

## Technical Requirements
- Performance: Seite und Dashboard-Kacheln mit 5.000 Buchungen je Kunde unter 2 s; PDF unter 10 s
- Security: Nur Inhaber des gewählten Kunden; Prüfung serverseitig (RLS bzw. Rollenprüfung), auch für Exporte und Dashboard-Werte
- Zahlen- und Datumsformate nach PROJ-31
- Browser: Chrome, Firefox, Safari, mobil

## Open Questions
- [ ] Kanal-Auswertung: beim Spec-Interview zu PROJ-11 entscheiden
- [ ] Feld „vermietet ab“ je Wohnung, falls die Regel „ab erster Buchung“ in der Praxis zu ungenau ist
- [ ] Soll der Umsatz später wahlweise nach Abzug der Plattform-Provisionen (PROJ-45) gezeigt werden?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Umsatz = Buchungsbetrag ohne Ortstaxe, anteilig je Nacht im Monat der Nacht | Passt zur Auslastung (gleiche Nächte, gleiche Monate) und ist auch für noch nicht abgerechnete und künftige Buchungen vollständig; Rechnungen/Zahlungen haben eigene Übersichten | 2026-11-08 |
| Stornogebühr im Monat der Anreise | Nutzerentscheidung mit Option 1; Gebühr hat keine Nächte | 2026-11-08 |
| Brutto als Hauptzahl, enthaltene USt klein darunter | Nutzerentscheidung: Brutto erkennt man aus Buchungen wieder, USt bleibt sichtbar | 2026-11-08 |
| Sperren ziehen von verfügbaren Nächten ab, Optionen gelten als frei | Quote misst die tatsächlich vermietbaren Nächte; Optionen sind unverbindlich | 2026-11-08 |
| Zeitraum wie PROJ-16, Standard laufendes Jahr inkl. künftiger Monate | Bekannte Bedienung; zeigt Buchungsstand für den Rest des Jahres | 2026-11-08 |
| Vorjahresvergleich immer sichtbar | Ferienvermietung ist saisonal; Vormonat wenig aussagekräftig | 2026-11-08 |
| Filter Objekt → Wohnung, keine Mehrfachauswahl | Passt zur Struktur und bleibt am Handy einfach; „Je Wohnung“ deckt den Vergleich ab | 2026-11-08 |
| Fünf Kacheln (Auslastung, Umsatz, Ø-Preis, Buchungen mit Ø-Dauer, Gästenächte) | Übliche Steuergrößen; Gästenächte = „Nächtigungen“ der Tourismusstatistik | 2026-11-08 |
| Diagramm umschaltbar Auslastung/Umsatz über der Monatstabelle | Saison auf einen Blick, spart Platz am Handy | 2026-11-08 |
| Abschnitt „Je Wohnung“ mit Vorjahr, sortierbar | Zeigt, welche Wohnung schwächelt | 2026-11-08 |
| Kanäle nicht in PROJ-18, Prüfpunkt bei PROJ-11 | Nutzer hat sich noch nicht festgelegt; erst mit Channex-Import sind Plattform-Buchungen vollständig | 2026-11-08 |
| Gästeherkunft nach Land des Hauptgasts mit Ankünften, Gästenächten, Umsatz, Anteil; Top 10 + „Übrige Länder“ | Begriffe der amtlichen Statistik; Mitreisende haben kein eigenes Land | 2026-11-08 |
| Export PDF (mit Diagrammen) und CSV | Nutzerentscheidung; PDF für Bank/Steuerberatung, CSV zum Weiterrechnen | 2026-11-08 |
| CSV mit einer Zeile je Wohnung und Monat, ohne Summen/Vorjahr/Herkunft | Saubere Rohdaten für Pivot in Excel | 2026-11-08 |
| Dashboard-Kacheln für Inhaber wie Design-Entwurf (Auslastung, Umsatz, Offene Rechnungen, Heute An/Ab) | Nutzerwunsch; löst die PROJ-14-Entscheidung „keine Auslastung/Umsatz auf dem Dashboard“ ab. Bleibt in PROJ-18, weil dieselben Rechenregeln gelten und beide zusammen ausgeliefert werden sollen | 2026-11-08 |
| Mitarbeiter behalten die bisherigen vier Kacheln | Keine Umsätze für Mitarbeiter; für sie ändert sich nichts | 2026-11-08 |
| Bei gemischten Rollen zählen Auslastung/Umsatz nur Inhaber-Kunden | Rechte je Kunde wie im übrigen Dashboard | 2026-11-08 |
| Verfügbar ab Monat der ersten Buchung, sonst ab Anlage; bis Archivierung | Vernünftige Werte ohne neues Feld, auch bei nacherfassten Altbuchungen | 2026-11-08 |
| Ø-Preis ohne Stornogebühren; Doppelbuchungs-Nächte einmal belegt | Stornogebühren haben keine Nächte; Auslastung bleibt ≤ 100 % | 2026-11-08 |
| Veränderung zum Vorjahr ohne Farbwertung | Steigende Werte sind nicht immer gut (z. B. Gästenächte bei weniger Umsatz); neutrale Darstellung | 2026-11-08 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Keine neuen Tabellen, Berechnung bei jedem Aufruf | Zahlen sind immer aktuell, keine Synchronisierung nötig; gleiches Muster wie PROJ-16 | 2026-11-08 |
| Rechenkern in der Datenbank, Zeilen je Wohnung und Monat | Verteilung je Nacht über tausende Buchungen gehört nah an die Daten; übertragen werden nur wenige hundert verdichtete Zeilen | 2026-11-08 |
| Vorjahr im selben Aufruf | Ein Datenbankaufruf statt zwei; gleiche Regeln garantiert | 2026-11-08 |
| Kacheln, Summen, Vorjahr und Sortierung in einer Regeldatei im Programm | Seite, PDF, CSV und Dashboard rechnen identisch; einfach mit Unit-Tests prüfbar | 2026-11-08 |
| USt je Buchung wie im Buchungsdetail berechnen, dann auf Nächte verteilen | Summe über alle Monate stimmt centgenau mit dem Buchungsdetail überein | 2026-11-08 |
| Eigenes Balkendiagramm statt Diagramm-Paket (z. B. recharts) | Kein neues Paket; dieselbe Darstellung lässt sich mit @react-pdf/renderer ins PDF zeichnen, was mit recharts nicht geht | 2026-11-08 |
| PDF als weitere Dokumentart im vorhandenen PDF-Arbeitsprozess | Briefpapier, Schriften und Lastgrenze sind dort schon gelöst (PROJ-16) | 2026-11-08 |
| Dashboard-Werte über eigene Funktion nur für Inhaber-Kunden | Mitarbeiter erhalten keine Umsatzdaten, auch nicht über die Antwort an den Browser | 2026-11-08 |
| Mitarbeiter auf /auswertungen: „Seite nicht gefunden“ statt „Kein Zugriff“ | Einheitlich mit allen Inhaber-Bereichen (wie PROJ-16-Abweichung) | 2026-11-08 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-18 braucht **keine neuen Tabellen**. Alle Zahlen werden bei jedem Aufruf aus Buchungen, Preispositionen, Wohnungen und Gästen berechnet, wie bei den Ortstaxen-Berichten (PROJ-16). Gebaut werden:
1. ein **Rechenkern in der Datenbank**, der je Wohnung und Monat die Grundzahlen liefert (Nächte, Umsatz, USt, Gäste), dazu eine Auswertung je Herkunftsland,
2. eine **Regeldatei im Programm**, die daraus Kacheln, Monats-, Wohnungs- und Ländertabellen samt Vorjahr bildet (für Seite, PDF, CSV und Dashboard gleich),
3. die Seite **„Auswertungen“** mit Filtern, Kacheln, Diagramm und Tabellen,
4. zwei Download-Adressen für **PDF und CSV**,
5. die neuen **Inhaber-Kacheln auf dem Dashboard**.

### A) Seitenaufbau

```
Seite „Auswertungen“ (/auswertungen, nur Inhaber)
+-- Seitenkopf „Auswertungen“ mit Kundenname
|   +-- rechts: Knöpfe „PDF“ und „CSV“ (deaktiviert ohne Daten)
+-- Filterleiste
|   +-- Schnellwahl: Dieses Jahr | Letztes Jahr | Letzter Monat | Letztes Quartal
|   +-- Jahr, Von Monat, Bis Monat
|   +-- Objekt: Alle Objekte | einzelnes Objekt
|   +-- Wohnung: Alle Wohnungen | einzelne Wohnung (archivierte gekennzeichnet)
+-- Hinweis „Zeitraum noch nicht abgeschlossen – enthält auch künftige Buchungen.“
+-- Kacheln (5): Auslastung | Umsatz | Ø-Preis je Nacht | Buchungen | Gästenächte
|   +-- je Kachel: Wert, Zusatzzeile, Vorjahr mit Veränderung (Pfeil, ohne Farbe)
+-- Karte „Je Monat“
|   +-- Umschalter Auslastung | Umsatz
|   +-- Balkendiagramm (Monat, Vorjahr blass daneben, Wert beim Zeigen/Antippen)
|   +-- Tabelle mit Summenzeile „Gesamt“
+-- Karte „Je Wohnung“ (entfällt bei einzelner Wohnung)
|   +-- Tabelle, nach Objekt gruppiert, Spaltenköpfe sortierbar
+-- Karte „Gästeherkunft“
|   +-- Tabelle: 10 Länder + „Übrige Länder“ (aufklappbar)
+-- Leerer Zustand „Für den gewählten Zeitraum liegen keine Daten vor.“ (+ Hinweis Wohnungen)
+-- Meldung „Export konnte nicht erstellt werden …“ (nur nach fehlgeschlagenem Export)
```

- Die Seite wird auf dem Server erzeugt. Im Browser laufen nur Filterleiste, Diagramm-Umschalter, Sortierung der Wohnungstabelle, „Übrige Länder“ aufklappen und Export-Knöpfe.
- Filter stehen in der Adresse (`?jahr=&von=&bis=&objekt=&wohnung=`), die Seite lädt dann neu, wie bei der Ortstaxe.
- Gestaltung nach dem App-Entwurf: Kacheln wie im Dashboard (Symbol, Bezeichnung, große Zahl, Zusatzzeile), Karten und Tabellen wie in der Ortstaxe-Seite, Beträge rechtsbündig in Ziffern gleicher Breite.
- Tabellen scrollen am Handy in eigenem Bereich mit Tastaturfokus; erste Spalte bleibt stehen. Keine Overlay-Links auf Zeilen (Safari).
- Menüpunkt „Auswertungen“ wird freigeschaltet (bisher „bald verfügbar“), nur für Inhaber.

**Dashboard (Änderung):**
```
Kacheln
+-- Inhaber-Kunde im Filter vorhanden:
|   Auslastung [Monat] | Umsatz [Monat] | Offene Rechnungen | Heute „2 / 3“
+-- sonst (nur Mitarbeiter): bisherige vier Kacheln, unverändert
```
- Auslastung und Umsatz sind ein Link zu „Auswertungen“ (laufender Monat), wenn genau ein Inhaber-Kunde im Filter ist; bei einem anderen als dem gewählten Kunden über den bestehenden Kundenwechsel (`/kunde-wechseln` mit Ziel).
- „Offene Rechnungen“ und „Heute“ nutzen die vorhandenen Dashboard-Daten.

### B) Daten

**Neu gespeichert:** nichts.

**Gelesen:**
- Buchungen: Art, Storno und Stornodatum, Anreise, tatsächliche Abreise, Erwachsene, Kinder, Hauptgast, Wohnung
- Beträge: verrechneter Übernachtungspreis (nach Preisregel bei Verlängerung, PROJ-30) mit USt-Satz, Zusatzpositionen mit USt-Satz und Ortstaxe-Kennzeichen, Stornogebühr mit USt-Satz
- Kleinunternehmer-Status des Kunden zum maßgeblichen Tag (bestehende Regel aus PROJ-36)
- Wohnungen: Objekt, Name, Anlage- und Archivierungsdatum
- Gast: Herkunftsland
- Briefpapier, Logo und Stammdaten (nur PDF)

**Rechenkern (Datenbank), eine Zeile je Wohnung und Monat:**
- verfügbare, belegte und gesperrte Nächte (nach den Regeln der Spec: ab Monat der ersten Buchung bzw. Anlage, bis Archivierung, Doppelbuchungs-Nächte einmal, gebucht vor gesperrt)
- Umsatz brutto und enthaltene USt aus Buchungen (gleichmäßig je Nacht, Rest in die letzte Nacht)
- Stornogebühren brutto und USt (im Anreisemonat)
- Gästenächte, Ankünfte, Zahl der Buchungen mit Anreise und deren Aufenthaltsnächte gesamt

Die USt wird **je Buchung** berechnet wie im Buchungsdetail (Brutto je Satz → enthaltene USt, auf den Cent gerundet; bei Kleinunternehmer 0) und dann wie der Umsatz auf die Nächte verteilt. So stimmt die Summe einer Buchung über alle Monate genau mit dem Buchungsdetail überein.

**Auswertung je Herkunftsland:** dieselbe Grundlage, gruppiert nach Land statt Wohnung: Ankünfte, Gästenächte, Umsatz brutto.

**Abfragen:**
- Eine Funktion liefert für den gewählten Kunden, Zeitraum und Filter die Zeilen je Wohnung und Monat für den **Zeitraum und das Vorjahr** in einem Aufruf (höchstens einige Dutzend Wohnungen × 24 Monate, also wenige hundert Zeilen).
- Eine zweite Funktion liefert die Länderzeilen für Zeitraum und Vorjahr.
- Eine dritte Funktion liefert für das Dashboard Auslastung und Umsatz des laufenden Monats über mehrere Kunden (nur die, bei denen die Person Inhaber ist).
- Alle prüfen die Inhaber-Rolle je Kunde selbst (wie `tourist_tax_monthly`). Mitarbeiter und fremde Kunden erhalten eine leere Antwort.

### C) Regeln im Programm (ohne Datenbank, mit Unit-Tests)
Eine Regeldatei für Seite, PDF, CSV und Dashboard:
- Filter aus der Adresse lesen und prüfen; Standard laufendes Jahr; Schnellwahl inkl. Jahreswechsel; „Zeitraum noch nicht abgeschlossen“. Die Zeitraum-Regeln der Ortstaxe werden wiederverwendet, wo sie passen.
- Aus den Zeilen je Wohnung und Monat: Kacheln, Tabelle „Je Monat“ mit „Gesamt“ (Auslastung und Ø-Preis aus Summen), Tabelle „Je Wohnung“, jeweils mit Vorjahr.
- Veränderung: Prozentpunkte bei der Auslastung, sonst Prozent; „–“, wenn Vorjahr 0 oder nicht bestimmbar.
- Länder: Sortierung nach Gästenächten, Top 10 + „Übrige Länder“ (Bildschirm), alle (PDF); Ländernamen aus der vorhandenen Länderliste der Gäste.
- „inkl. € … USt“ bzw. „ohne USt“.
- Zeitraum in Worten und Dateinamen (`Auswertung_2026_Alle_Stand-2026-11-08.pdf`).
- CSV-Aufbau: Format wie PROJ-16 (die vorhandenen CSV-Bausteine werden gemeinsam genutzt).

### D) Diagramm
- **Eigenes, einfaches Balkendiagramm** ohne neues Paket: Balken je Monat, Vorjahresbalken blass daneben, Achse mit wenigen Hilfslinien. Farben aus den Design-Tokens, in Hell und Dunkel lesbar.
- Am Bildschirm zeigt Zeigen bzw. Antippen eines Balkens Monat, Wert und Vorjahr (Tooltip aus shadcn/ui); für Bildschirmleser gibt es die Tabelle darunter, das Diagramm selbst ist als Bild mit Beschreibung ausgezeichnet.
- Im PDF wird dieselbe Berechnung der Balkenhöhen mit den Zeichenbausteinen von `@react-pdf/renderer` gezeichnet. So sehen Bildschirm und PDF gleich aus.

### E) Exporte
- **Zwei Download-Adressen** (`/api/auswertungen/pdf`, `/api/auswertungen/csv`) mit denselben Filtern wie die Seite. Jede prüft Anmeldung, gewählten Kunden und Inhaber-Rolle selbst und lädt die Daten über dieselben Funktionen.
- **Knöpfe** wie bei der Ortstaxe (Laden im Hintergrund, Dateiname aus der Antwort, Fehlermeldung).
- **PDF:** neue Dokumentart „Auswertung“ im vorhandenen PDF-Arbeitsprozess (wie der Ortstaxe-Bericht): Briefpapier-Schriften, Logo, Aussteller-Block, A4 hoch, Tabellenkopf auf Folgeseiten wiederholt, Fußzeile mit „Stand“ und „Seite X von Y“. Gemeinsame Lastgrenze mit Rechnungen und Ortstaxe. Nicht gespeichert.
- **CSV:** direkt erzeugt, nicht gespeichert, eine Zeile je Wohnung und Monat.

### F) Rechte und Sicherheit
- Seite: Inhaber-Bereich wie Ortstaxe; Mitarbeiter erhalten wie dort „Seite nicht gefunden“ (die App behandelt alle Inhaber-Bereiche so; Daten gibt es keine).
- Datenbank: Inhaber-Prüfung je Kunde in jeder Funktion. Umsatzdaten liegen ohnehin nur für Inhaber lesbar vor (Beträge sind seit PROJ-8 Inhaber-Daten).
- Dashboard: Für Kunden, bei denen die Person nur Mitarbeiter ist, wird nichts berechnet oder ausgeliefert.
- Exporte: eigene Prüfung, nur der gewählte Kunde, keine Kunden-ID von außen; Objekt und Wohnung müssen zum Kunden gehören.

### G) Leistung
- Ziel aus der Spec: Seite und Dashboard-Kacheln bei 5.000 Buchungen unter 2 Sekunden, PDF unter 10 Sekunden.
- Die Berechnung je Nacht läuft in der Datenbank; übertragen werden nur die verdichteten Zeilen. Zwischenschritte werden wie in PROJ-16 einmal berechnet (materialized), damit die Datenbank sie nicht vervielfacht.
- Vorhandene Indizes auf Buchungen (Kunde/Anreise, Wohnung/Zeitraum) reichen voraussichtlich; /backend misst mit Testdaten und ergänzt bei Bedarf einen Index.

### H) Tests
- **Unit:** Regeldatei (Filter, Schnellwahl, Standard, Kacheln, Summen aus Summen, Veränderung Pp./%, „–“, Top 10 + Übrige, Sortierung, Dateinamen, CSV), Balkenhöhen.
- **Integration (Datenbank):**
  - Nächte: Monatsgrenze, tatsächliche Abreise, Option frei, Storno, Sperre, gebucht+gesperrt, Doppelbuchung, verfügbar ab erster Buchung/Anlage, Archivierung, Auslastung ≤ 100 %
  - Umsatz: Verteilung centgenau, Ortstaxe ausgenommen, negative Positionen, Verlängerung mit Preisregel, Stornogebühr im Anreisemonat, USt je Satz, Kleinunternehmer
  - Gleichheit: Summe einer Buchung über alle Monate = Buchungsbetrag ohne Ortstaxe; Dashboard-Monat = Seite für denselben Monat
  - Länder: anonymisierter Gast, Ankünfte nach Anreise
  - Rechte: Inhaberin bei A und Mitarbeiterin bei B, fremder Kunde, ohne Anmeldung
- **PDF:** Erzeugung mit allen Abschnitten, einzelne Wohnung, ohne Logo, viele Länder (mehrseitig)
- **E2E:** Menüpunkt nur Inhaber; Standardzeitraum, Schnellwahl, Objekt/Wohnung-Filter, Neu laden; Diagramm-Umschalter; Sortierung; „Übrige Länder“; leerer Zustand; PDF- und CSV-Download; Dashboard-Kacheln Inhaber/Mitarbeiter und Link; Handy 375 px; axe

### I) Was wohin gehört
- **/frontend:** Seite, Filterleiste, Kacheln, Diagramm, Tabellen, leerer Zustand, Export-Knöpfe, Regeldatei mit Unit-Tests, Texte, Menüpunkt freischalten, Dashboard-Kacheln für Inhaber (bis zum Backend zeigen die neuen Werte „–“ bzw. „wird eingerichtet“).
- **/backend:** Rechenkern und die drei Funktionen, Datenabruf für Seite und Dashboard, Download-Adressen, PDF-Dokumentart „Auswertung“, Integrationstests und Messung.

### Abhängigkeiten (Pakete)
Keine neuen. Genutzt werden `@react-pdf/renderer` (über den PDF-Arbeitsprozess) und vorhandene shadcn/ui-Bausteine (Card, Table, Select, Button, Alert, Tabs bzw. Toggle für den Umschalter, Tooltip, Collapsible).

### Umsetzung Frontend (2026-11-08)
**Gebaut:**
- `src/lib/statistics.ts` (reine Regeln, Unit-Tests in `statistics.test.ts`):
  - Filter aus der Adresse (`?jahr=&von=&bis=&objekt=&wohnung=`), Standard laufendes Jahr, Schnellwahl „Dieses Jahr“, „Letztes Jahr“, „Letzter Monat“, „Letztes Quartal“; Objekt/Wohnung gegen die Wohnungen des Kunden geprüft (`resolveStatsFilters`)
  - Summen je Monat, je Wohnung und gesamt mit Vorjahr (`buildStats`), Auslastung und Ø-Preis aus Summen, Veränderung in Pp. bzw. %, „Vorjahr –“ ohne Daten
  - Sortierung „Je Wohnung“ (absteigend → aufsteigend → zurück zur Gruppierung; „–“ immer am Ende)
  - Gästeherkunft (`buildOrigin`): Top 10 + „Übrige Länder“, Anteil an den Gästenächten
  - Diagramm-Maßstab (`chartModel`, `niceScale`) für Bildschirm und PDF
  - CSV (`buildStatsCsv`) und Dateinamen `Auswertung_<Zeitraum>_<Alle|Objekt|Objekt-Wohnung>_Stand-<Datum>.pdf|csv`
- Zeitraum-Funktionen der Ortstaxe (`tourist-tax-report.ts`) nehmen jetzt jeden Zeitraum (`ReportPeriod`) und werden mitbenutzt.
- `src/lib/statistics-data.ts`: Wohnungen des Kunden, Abruf der Datenbankfunktionen `statistics_rows`, `statistics_origin` (seitenweise) und `dashboard_statistics`; fehlt eine Funktion, gilt „ready: false“.
- Seite `src/app/(app)/auswertungen/page.tsx`: Kopf mit Export-Knöpfen, Filter, Hinweis „Zeitraum noch nicht abgeschlossen“, Kacheln, Karte „Je Monat“ (Diagramm + Tabelle), „Je Wohnung“, „Gästeherkunft“, leerer Zustand, „wird eingerichtet“ und Fehler.
- `src/components/statistics/`: `stats-filters`, `stats-kpis`, `stats-chart` (eigenes Balkendiagramm, Umschalter Auslastung/Umsatz, Legende, Werte beim Zeigen/Antippen über dem Diagramm; Diagramm als Bild mit Beschreibung), `stats-month-table`, `stats-apartment-table` (sortierbar, `aria-sort`), `stats-origin-table` („Übrige Länder“ aufklappbar), `stats-cells`, `compare` (Vorjahr mit Pfeil, ohne Farbe). Render-Test `stats-components.test.tsx`.
- Diagrammfarben: gewähltes Jahr `accent` (#0088b0), Vorjahr `neutral-500` (#9b9797), mit Farbprüfung (Farbsehschwäche ΔE 9,2, normal 15,1); das Grau ist bewusst blass, die Tabelle darunter und die Legende ersetzen Farbe allein.
- Export-Knöpfe allgemein gemacht: `src/components/report-export-buttons.tsx` (vorher `tourist-tax/export-buttons.tsx`), auch von der Ortstaxe genutzt.
- `KpiTile`: optionale Vorjahreszeile und Link über die ganze Kachel (bei anderem Kunden als Formular an `/kunde-wechseln`); `KpiGrid` mit 5 Spalten.
- Dashboard (`dashboard-kpis.tsx`): Inhaber-Kacheln Auslastung/Umsatz [Monat], Offene Rechnungen, Heute „An / Ab“ (+ „davon N ohne Rechnung“); Mitarbeiter unverändert. Bis zur Migration zeigen Auslastung und Umsatz „–“.
- Menüpunkt „Auswertungen“ freigeschaltet (`navigation.ts`, Unit-Test, E2E PROJ-2 jetzt mit `/kanaele`); E2E PROJ-14 an die neuen Inhaber-Kacheln angepasst. Texte unter `statistics` und `dashboard.kpi*` in `messages/de.json` (Du-Form wie in der App).

**Geprüft:** Unit- und Render-Tests grün; E2E PROJ-2 „Sichtbarkeit der Navigation“ (5) und PROJ-14 Kacheln (3) grün gegen den gebauten Server; Bildschirmfotos Desktop/Handy der Seite (ohne Daten) und des Dashboards angesehen.

**Abweichung:** Im leeren Zustand und überall sonst Du-Form („Wohnungen legst du …“) wie in der übrigen App statt der Sie-Form der Spec.

**Vertrag für /backend:**
- `statistics_rows(p_tenant_id uuid, p_from date, p_to date)` – nur Inhaber, sonst leer. Eine Zeile je Wohnung und Monat für die Monate von `p_from` bis `p_to` **und dieselben Monate des Vorjahres**; nur Zeilen mit einem Wert ≠ 0. Spalten: `apartment_id`, `month` (erster Tag des Monats), `available_nights`, `occupied_nights`, `blocked_nights`, `revenue_cents`, `revenue_vat_cents` (Buchungen ohne Ortstaxe und ohne Stornogebühr, je Nacht verteilt), `fee_cents`, `fee_vat_cents` (Stornogebühren im Anreisemonat), `guest_nights`, `arrivals` (Personen mit Anreise im Monat), `bookings` (Buchungen mit Anreise im Monat), `stay_nights` (deren Nächte gesamt). Feste Reihenfolge (für das seitenweise Laden).
- `statistics_origin(p_tenant_id uuid, p_from date, p_to date)` – nur Inhaber. Eine Zeile je Wohnung, Land und Zeitraum: `apartment_id`, `country`, `previous` (Vorjahr ja/nein), `arrivals`, `guest_nights`, `revenue_cents` (inkl. Stornogebühren). Feste Reihenfolge.
- `dashboard_statistics(p_tenant_ids uuid[], p_month date)` – nur Kunden, bei denen die Person Inhaber ist, je Kunde: `tenant_id`, `available_nights`, `occupied_nights`, `revenue_cents` (inkl. Stornogebühren), `vat_cents`.
- Download-Adressen `/api/auswertungen/pdf` und `/api/auswertungen/csv` mit denselben Parametern wie die Seite; CSV über `buildStatsCsv` mit `statistics.csv.columns`, PDF als Dokumentart „Auswertung“ (Kennzahlen, zwei Diagramme aus `chartModel`, Tabellen, alle Länder).

### Umsetzung Backend (2026-11-08)
**Migration** `20261108100012_statistics.sql` (nur Dev; Staging/Prod mit `/deploy`), keine neuen Tabellen:
- `private.statistics_months(von, bis)`: Monate des Zeitraums und dieselben Monate des Vorjahres; mehr als ein Jahr Zeitraum → leer (Schutz vor teuren Abfragen).
- Kern 1 `private.statistics_booking_parts(Kunden, Monate)`: je Buchung und Monat Nächte, Umsatz, USt, Stornogebühr mit USt, Gästenächte, Ankünfte, Buchungen, Aufenthaltsnächte, Herkunftsland (ohne Hauptgast „ZZ“). Umsatz = verrechneter Übernachtungspreis (`billed_nights_cents`) + Zusatzkosten ohne Ortstaxe; USt je Buchung je Satz gerundet wie `vatBreakdown`, Kleinunternehmer über `private.small_business_on` am Abreise- bzw. Stornotag; Verteilung ganzzahlig je Nacht, Rest in der letzten Nacht.
- Kern 2 `private.statistics_apartment_months(Kunden, Monate)`: je Wohnung und Monat verfügbare, belegte (Doppelbuchung einmal) und gesperrte Nächte nach den Regeln der Spec, dazu die Summen aus Kern 1.
- Lesefunktionen (private Definer + öffentliche Invoker wie PROJ-16): `statistics_rows`, `statistics_origin`, `dashboard_statistics`. Alle rechnen nur für Kunden, bei denen die Person Inhaber ist; die Kerne sind von außen nicht aufrufbar.
- `db advisors`: nur der bekannte Auth-Hinweis „OTP long expiry“, nichts aus dieser Migration.

**Exporte:**
- `/api/auswertungen/csv` und `/api/auswertungen/pdf` über `src/lib/statistics-export.ts` (Anmeldung, offene 2FA → 403, nur Inhaber des gewählten Kunden, 404 ohne Daten, 503 ohne Migration bzw. PDF ausgelastet, `no-store`, Dateiname mit UTF-8).
- PDF: neue Dokumentart `statistics` im Arbeitsprozess (`src/lib/statistics-pdf/` types, view, document; `renderStatsPdf`, gleiche Lastgrenze). Kennzahlen, zwei Balkendiagramme aus `chartModel`, Tabellen mit Vorjahr, alle Länder. Veränderung im PDF ohne Pfeil (nicht jede Briefpapier-Schrift hat Pfeile).
- Aussteller-Hilfen aus `tourist-tax-pdf/view.ts` exportiert und mitbenutzt.

**Frontend-Nachträge:** Diagramm mit Abstand oben (Achsenbeschriftung überlappte den Hinweis); Kacheln der Auswertung mit kleinerer Zahl (`KpiTile compact`), damit Beträge bei fünf Kacheln nicht anstoßen.

**Tests:** Integration `supabase/tests/statistics.integration.test.ts` (13, grün gegen Dev): Doppelbuchung, Sperre, Option/Storno, Verteilung centgenau, USt je Satz, Gäste nach Anreisemonat, Stornogebühr, Zählbeginn ab Anlage bzw. erster Buchung, Archivierung, Vorjahr, Summe = Buchungsbetrag, Kleinunternehmer, Herkunft, Dashboard = Seite, Zeitraum > 1 Jahr, Rechte, Kerne gesperrt. Route-Test `src/app/api/auswertungen/auswertungen.test.ts` (7), PDF mit echtem Arbeitsprozess `src/lib/statistics-pdf/render.integration.test.ts` (3). Alle Unit-Tests grün (891 vor den Nachträgen). Sichtprüfung mit Testdaten (Seite Desktop/Handy, Dashboard, CSV und PDF-Download mit Status 200).

**Messung** (Dev, 5.000 Buchungen, 25 Wohnungen, über die Datenschnittstelle): Dashboard 81–168 ms, ein Monat 167–263 ms, ganzes Jahr mit Vorjahr 313–408 ms, Gästeherkunft Jahr 316–363 ms. Kein zusätzlicher Index nötig. Hinweis: Das Löschen eines Kunden mit 5.000 Buchungen über die Datenschnittstelle überschreitet die Zeitgrenze; Messdaten wurden direkt in der Datenbank gelöscht.

## QA Test Results

**Tested:** 2026-11-08
**App URL:** http://localhost:3000 (gebauter Server, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)
**Stand:** Commit 749bf73 (inkl. zentrierter Dashboard-Kacheln)

Neue E2E-Datei `tests/PROJ-18-statistische-auswertungen.spec.ts` (16 Tests) mit festen Testdaten im Oktober 2025 und Vorjahr 2024. Dazu aus `/backend`: Integration `supabase/tests/statistics.integration.test.ts` (13), Route-Test (7), PDF mit echtem Arbeitsprozess (3), Unit- und Render-Tests (Regeldatei, Kacheln, Diagramm, Tabellen).

### Acceptance Criteria Status

#### Zugriff
- [x] Menüpunkt „Auswertungen“ für Inhaber ohne „bald verfügbar“ (E2E)
- [x] Mitarbeiter sieht den Menüpunkt nicht (E2E)
- [ ] BUG-1: Mitarbeiter, direkter Aufruf `/auswertungen`: Ansicht „Seite nicht gefunden“, keine Daten, aber Status 200 statt 404. Downloads antworten korrekt mit 403 (E2E)
- [x] Nur Daten des gewählten Kunden; Inhaberin bei A und Mitarbeiterin bei B erhält für B nichts (Integration)

#### Zeitraum und Filter
- [x] Standard laufendes Jahr Jänner–Dezember mit Hinweis „Zeitraum noch nicht abgeschlossen …“, Schnellwahl „Dieses Jahr“ markiert (E2E)
- [x] Schnellwahl „Letztes Quartal“ am 08.11.2026 → Juli–September ohne Hinweis (Unit); „Letztes Jahr“ (E2E)
- [x] Objekt gewählt → nur dessen Wohnungen; archivierte gekennzeichnet (E2E)
- [x] Monat 13 bzw. Wohnung eines anderen Objekts in der Adresse → Standard bzw. „Alle Wohnungen“ (E2E, Unit)
- [x] Neu laden zeigt dieselbe Auswertung (Filter in der Adresse, E2E über direkte Adressen)

#### Auslastung
- [x] Buchung 10 Nächte und Sperre 1 Nacht → „10 von 30 Nächten, 1 gesperrt“ (E2E, Integration)
- [x] Option und Storno zählen nicht (Integration)
- [x] Buchung über die Monatsgrenze nach Nächten aufgeteilt (Integration, E2E Top 2)
- [x] Tatsächliche Abreise maßgeblich (Rechenkern über `departure`; Integration)
- [x] Wohnung zählt ab Monat der ersten Buchung (Top 2 ab September), ohne Buchung ab Anlage (Integration, E2E)
- [x] Archivierte Wohnung zählt bis zur Archivierung, spätere belegte Nächte als verfügbar („5 von 22 Nächten“, E2E + Integration)
- [x] Gebucht und gesperrt → belegt; Doppelbuchung einmal, nie über 100 % (Integration)

#### Umsatz
- [x] Übernachtung + Endreinigung + Rabatt ohne Ortstaxe, je Nacht verteilt (Integration, E2E: € 1.960,00)
- [x] Rundungsrest in der letzten Nacht, Summe centgenau (Integration)
- [x] Enthaltene USt je Satz („inkl. € 178,17 USt“, E2E + Integration)
- [x] Kleinunternehmer: USt 0, Anzeige „ohne USt“ (Integration, Unit)
- [x] Stornogebühr im Anreisemonat, ohne Nächte, nicht im Ø-Preis (Integration, Unit)
- [x] Verlängerung: es zählt der verrechnete Preis (`billed_nights_cents`, Code-Prüfung + Integration)

#### Kacheln und Vorjahr
- [x] Auslastung „23 %“, „19 von 83 Nächten, 1 gesperrt“, „Vorjahr 16 %“, „+7 Pp.“ (E2E)
- [x] Umsatz mit Vorjahr „+292 %“, Ø-Preis „€ 103,16“, „Ø 7,0 Nächte“, „43“ Gästenächte mit „6 Ankünfte“ (E2E)
- [x] Vorjahr ohne Daten „Vorjahr –“ ohne Veränderung (Render-Test)
- [x] Filter wirkt auch auf das Vorjahr (Unit)

#### Je Monat
- [x] Diagramm mit Vorjahresbalken, Umschalter Auslastung/Umsatz (`aria-pressed`), Tabelle mit „Gesamt“ (E2E)
- [x] Gesamt-Auslastung aus Summen, nicht gemittelt (Unit)
- [x] Werte beim Zeigen/Antippen über dem Diagramm (Code-Prüfung, Sichtprüfung)

#### Je Wohnung
- [x] Nach Objekt gruppiert, nur Wohnungen mit Daten (Unit, E2E)
- [x] Klick sortiert absteigend (`aria-sort`), sortiert mit Objektname in der Zeile; zweiter Klick aufsteigend (E2E, Unit)
- [x] Einzelne Wohnung → kein Abschnitt (E2E)

#### Gästeherkunft
- [x] Zehn Länder einzeln, „Übrige Länder (n)“ aufklappbar (E2E, Render-Test)
- [x] Anonymisierter Gast zählt beim Land (Land bleibt beim Anonymisieren erhalten; Code-Prüfung)
- [x] Ankünfte nach Anreise, Gästenächte nach Nächten (Integration)

#### Leerer Zustand
- [x] Kunde ohne Wohnungen: Hinweis mit Link „Zu den Wohnungen“, Exporte deaktiviert (E2E)

#### PDF
- [x] Dateiname `Auswertung_2025-10_Alle_Stand-<Datum>.pdf`, gültiges PDF (E2E); Briefpapier, Kennzahlen, zwei Diagramme, alle Tabellen, alle Länder (PDF-Test + Sichtprüfung)
- [x] Einzelne Wohnung im PDF genannt, ohne „Je Wohnung“ (PDF-Test)

#### CSV
- [x] Eine Zeile je Wohnung und Monat, ohne Summen und Vorjahr, Dateiname mit Stand (E2E, Route-Test)
- [x] Excel-Format (BOM, Strichpunkt, Komma), Formelschutz und Strichpunkt im Namen (Route-Test, Unit)

#### Dashboard
- [x] Inhaber: „Auslastung [Monat]“, „Umsatz [Monat]“, „Offene Rechnungen“, „Heute“ mit „Anreisen / Abreisen“; ohne „Belegt heute“ (E2E, auch PROJ-14)
- [x] „davon N ohne Rechnung“ in der Kachel „Heute“ (E2E PROJ-14)
- [x] Mitarbeiter: bisherige vier Kacheln, keine Umsatzwerte (E2E)
- [x] Gemischte Rollen: Auslastung/Umsatz nur Inhaber-Kunden (Integration `dashboard_statistics`)
- [x] Mitarbeiter erhält keine Umsatzwerte (Funktion liefert nichts; Seite fragt sie nicht ab)
- [x] Klick auf Auslastung öffnet `/auswertungen` für den laufenden Monat (E2E); bei mehreren Inhaber-Kunden nicht anklickbar (Code-Prüfung)
- [x] Gleiche Zahlen wie die Seite (Integration)
- [x] Nachtrag Nutzerwunsch: Inhalt der Kacheln über der Zeitleiste zentriert (E2E prüft `text-align: center`)

#### Handy
- [x] 375 px: kein seitliches Scrollen der Seite, Monatstabelle scrollt im eigenen Bereich; 768 px passt die Tabelle (E2E mobile/tablet)

### Edge Cases Status
- [x] Buchung ändert sich nach Export: Seite rechnet immer neu, Exporte mit Stand
- [x] Nacherfasste Altbuchungen: Zählbeginn ab Monat der ersten Buchung (E2E Vorjahr 2024)
- [x] Buchung nach Archivierung: ≤ 100 % (E2E, Integration)
- [x] Negativer Umsatz: leerer Balken, rote Anzeige über `Amount` (Unit)
- [x] Zeitraum ganz in der Zukunft erlaubt, mit Hinweis (Code-Prüfung)
- [x] Viele Länder: Bildschirm 10 + „Übrige“, PDF alle (E2E, PDF-Test)
- [x] Zeitraum über ein Jahr direkt an der Datenbank: keine Daten (Integration)

### Security Audit Results
- [x] Ohne Anmeldung: Downloads 401 (E2E), Datenbankfunktionen ohne Daten (Integration)
- [x] Mitarbeiter: Seite ohne Daten, Downloads 403 (E2E), Funktionen leer (Integration)
- [x] Fremder Kunde: Funktionen leer; Objekt/Wohnung fremder Kunden in der Adresse werden verworfen (Integration, Route-Test)
- [x] Rechenkerne von außen nicht aufrufbar (Integration)
- [x] Eingaben: Adresse streng geprüft (Zahlen, UUID), CSV-Formelschutz, React/PDF ohne HTML-Einfügung
- [x] Last: PDF über die gemeinsame Lastgrenze (503 bei Auslastung, Route-Test); Abfragen < 0,5 s bei 5.000 Buchungen
- [ ] BUG-1 (Low): Statuscode 200 für Mitarbeiter, keine Daten betroffen

### Regression
- [x] PROJ-14 Dashboard: 15/15 (E2E desktop)
- [x] PROJ-16 Ortstaxen-Berichte: 11/11 (E2E desktop; Export-Knöpfe umgebaut)
- [x] PROJ-2 Navigation: 5/5 (E2E)
- [x] Unit: 891/891

### Browser
- [x] Chrome (desktop, mobile 375, tablet 768), Firefox (Stichprobe: Kacheln, Je Monat, Gästeherkunft, CSV, 4/4)
- [ ] Safari nicht geprüft (WebKit läuft nur gegen `npm run dev`)

### Bugs Found

#### BUG-1: Statuscode 200 statt 404 für Mitarbeiter auf `/auswertungen`
- **Severity:** Low
- **Steps to Reproduce:**
  1. Als Mitarbeiter anmelden und `/auswertungen` direkt aufrufen
  2. Erwartet: „Seite nicht gefunden“ mit Status 404 (wie `/ortstaxe` nach PROJ-16 BUG-1)
  3. Tatsächlich: Ansicht „Seite nicht gefunden“, keine Daten, aber Status 200
- **Ursache:** Der App-Rahmen (`src/app/(app)/layout.tsx`) prüft vor dem Streaming `/einstellungen`, `/betreiber` und `/ortstaxe`, aber nicht `/auswertungen`; `requireArea` in der Seite greift erst während des Streamings.
- **Priority:** Nice to have (E2E-Test erwartet 404 und schlägt bis zur Behebung fehl)

### Summary
- **Acceptance Criteria:** 55/56 passed
- **Bugs Found:** 1 total (0 critical, 0 high, 0 medium, 1 low)
- **Security:** Pass (BUG-1 ohne Datenzugriff)
- **Production Ready:** YES
- **Recommendation:** BUG-1 vor dem Deploy beheben (eine Zeile, wie bei PROJ-16), dann deployen

## Deployment
_To be added by /deploy_
