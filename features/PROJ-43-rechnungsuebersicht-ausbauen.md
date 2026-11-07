# PROJ-43: Rechnungsübersicht ausbauen

## Status: Approved
**Created:** 2026-11-07
**Last Updated:** 2026-11-07

## Dependencies
- Requires: PROJ-37 (Rechnungen nacherfassen): Rechnungsliste mit Suche, Blättern, Karten am Handy, „Rechnung nacherfassen“, Buchungssuche (Gastname, Wohnung, Zeitraum)
- Requires: PROJ-40 (Rechnungsdaten sammeln): Entwurf aus der Buchung, Regel „Rechnung möglich, solange Verrechnet + In Entwürfen < Gesamtpreis bzw. Stornogebühr“
- Requires: PROJ-42 (Ausstellen mit PDF): Status „ausgestellt“
- Requires: PROJ-44 (Rechnungsstorno): Gutschrift, Status „storniert“
- Requires: PROJ-45 (Zahlungserfassung): Zahlungsstatus offen/teilweise/bezahlt/überzahlt, „überfällig“, Bezahlt/Offen je Rechnung (Lesesicht der Datenbank)

## Überblick
Die Rechnungsliste (Menüpunkt „Rechnungen“) bekommt Filter, eine Summenzeile und einen zweiten Einstieg zum Erstellen einer Rechnung.

**Filter** (über der Liste, alle wirken zusammen und mit der bestehenden Suche):

| Filter | Werte | Standard |
|---|---|---|
| Jahr | „Alle Jahre“; Jahre von 7 zurück bis 5 voraus (absteigend); freie Eingabe eines anderen Jahres (vierstellig) | „Alle Jahre“ |
| Status | Alle, Entwurf, ausgestellt, nacherfasst, storniert, Gutschrift | Alle |
| Zahlung | Alle, noch nicht bezahlt (offen + teilweise), offen, teilweise, bezahlt, überzahlt, überfällig | Alle |
| Betrag von / bis | Rechnungsbetrag brutto wie in der Spalte „Betrag“; österreichisches Format („1.200,50“); negativ erlaubt; Grenzen inklusive; leer = ohne Grenze | leer |

- Das **Jahr** richtet sich nach dem Rechnungsdatum (auch bei Entwürfen).
- **Status:** „ausgestellt“ und „nacherfasst“ zeigen nur nicht stornierte Rechnungen; „storniert“ zeigt stornierte Rechnungen (ohne die Gutschriften); „Gutschrift“ zeigt die Gutschriften.
- **Zahlung:** Jeder Wert außer „Alle“ zeigt nur Rechnungen mit Zahlungsstatus (aus PROJ-45); Entwürfe, stornierte Rechnungen, Gutschriften und nacherfasste Rechnungen ≤ 0 fallen weg. „überfällig“ zeigt alle überfälligen Rechnungen (offen oder teilweise).
- Die gewählten Filter stehen in der Adresse; neue Filter setzen das Blättern auf Seite 1 zurück.
- **Filter zurücksetzen:** Knopf erscheint, sobald mindestens ein Filter oder die Suche gesetzt ist; führt zur ungefilterten Liste.
- **Rückweg:** „Zurück zur Liste“ auf der Rechnungsdetailseite führt zur zuletzt gefilterten Liste (Filter, Suche, Seite). Der Menüpunkt „Rechnungen“ beginnt immer ohne Filter.
- **Handy:** Filter in einem aufklappbaren Bereich „Filter“ mit Anzahl gesetzter Filter, z. B. „Filter (2)“; Suche bleibt sichtbar.

**Anzahl und Summen** (unter den Filtern bzw. unter der Liste, über alle Seiten der gefilterten Liste):
- Anzahl wie bisher („12 Rechnungen“ bzw. „3 Treffer“).
- **Rechnungsbetrag:** Summe der Beträge aller gefilterten Rechnungen ohne Entwürfe. Stornierte Rechnungen und Gutschriften zählen mit (heben sich auf, Gutschriften sind negativ).
- **Bezahlt:** „Beglichen“ der gefilterten Rechnungen (Eingegangen + Provision + Zahlungsgebühr, wie „Bezahlt“ im Buchungsdetail), Rückzahlungen an Gutschriften abgezogen.
- **Offen:** Summe der offenen Beträge der gefilterten zahlbaren Rechnungen; nur Beträge über 0 (Überzahlungen mindern „Offen“ nicht). Stornierte Rechnungen, Gutschriften und Entwürfe zählen nicht.
- Negative Summen erscheinen wie überall „-€ 50,00“ in Rot (PROJ-32).

**Rechnung erstellen aus der Übersicht** (nur Inhaber):
- Knopf „Rechnung erstellen“ im Seitenkopf neben „Rechnung nacherfassen“ (dieser nur bei eingeschaltetem Schalter wie bisher); auch im Leerzustand.
- Öffnet eine Buchungssuche (Gastname, Wohnung, Zeitraum, Buchungsnummer) wie beim Nacherfassen.
- Treffer: Buchungen, Optionen und stornierte Buchungen; Sperren erscheinen nicht. Wählbar ist eine Buchung genau dann, wenn auf ihrer Detailseite der Knopf „Rechnung“ aktiv wäre (PROJ-40); Optionen öffnen das Formular mit dem Hinweis „Buchung ist noch eine Option“. Nicht wählbare Buchungen erscheinen mit derselben Begründung wie in der Buchung (z. B. „Bereits vollständig verrechnet oder in Entwürfen“) und lassen sich nicht wählen.
- Nach der Wahl öffnet sich dasselbe Entwurfsformular wie über den Knopf „Rechnung“ in der Buchung; Abbrechen führt zurück zur Rechnungsliste.

## User Stories
- Als **Inhaber** möchte ich alle noch nicht bezahlten Rechnungen auf einen Blick sehen und wissen, wie viel insgesamt offen ist, damit ich gezielt nachfragen kann.
- Als **Inhaber** möchte ich die überfälligen Rechnungen filtern, damit ich Mahnungen nicht vergesse.
- Als **Inhaber** möchte ich die Rechnungen eines Jahres mit ihrer Summe sehen, damit ich die Zahlen mit meiner Buchhaltung bzw. dem Steuerberater abgleichen kann.
- Als **Inhaber** möchte ich eine Rechnung über einen Betrag wiederfinden, wenn ein Gast nur den Betrag nennt.
- Als **Inhaber** möchte ich direkt aus der Rechnungsliste eine Rechnung zu einer Buchung erstellen, ohne erst die Buchung zu suchen.
- Als **Inhaber** möchte ich nach dem Öffnen einer Rechnung zur gefilterten Liste zurückkehren, damit ich eine Liste offener Rechnungen nacheinander abarbeiten kann.
- Als **Mitarbeiter** möchte ich die Rechnungsliste ebenso filtern und die Summen sehen, damit ich z. B. bei der Schlüsselübergabe offene Beträge prüfen kann.

## Rollen
| Aktion | Inhaber | Mitarbeiter | Betreiber ohne Mitgliedschaft |
|---|---|---|---|
| Filter, Summen, Rückweg | ✓ | ✓ | – (Hinweis wie bisher) |
| „Rechnung erstellen“ aus der Übersicht | ✓ | – | – |

## Out of Scope
- Rechnung ohne Buchung mit frei eingegebenen Positionen (eigenes Feature, falls gewünscht)
- Sortierbare Spalten (Sortierung bleibt Rechnungsdatum absteigend, dann Nummer); bei Bedarf per `/refine`
- Gemerkte Filter über den Menüpunkt hinaus (Browser-Speicher)
- Mehrfachauswahl in den Filtern
- Filter nach offenem Betrag (offene Rechnungen über den Zahlungsfilter)
- Filter nach Monat, Zeitraum, Wohnung, Buchungsquelle oder Rechnungsart (Teil-/Schlussrechnung)
- Export der Liste (CSV/Excel) und Sammel-Download der PDFs
- Mahnungen, Zahlungserinnerungen, E-Mail-Versand (PROJ-22)
- Auswertungen über Rechnungen hinaus (PROJ-18), offene Zahlungen auf dem Dashboard (PROJ-14)
- Änderungen am Entwurfsformular, an Zahlungsstatus oder Fälligkeit (PROJ-40, PROJ-45)

## Acceptance Criteria

### Jahresfilter
- [ ] Angenommen ein Nutzer öffnet „Rechnungen“ über den Menüpunkt, wenn die Liste erscheint, dann steht der Jahresfilter auf „Alle Jahre“ und alle Rechnungen sind gelistet
- [ ] Angenommen es ist 2026, wenn der Nutzer den Jahresfilter öffnet, dann enthält er „Alle Jahre“ und die Jahre 2031 bis 2019 absteigend sowie eine Möglichkeit, ein anderes Jahr einzugeben
- [ ] Angenommen Rechnungen mit Rechnungsdatum 31.12.2025 und 01.01.2026, wenn der Nutzer „2026“ wählt, dann erscheint nur die Rechnung vom 01.01.2026
- [ ] Angenommen der Nutzer gibt „2012“ ein, wenn er bestätigt, dann zeigt die Liste die Rechnungen aus 2012 und der Filter zeigt „2012“
- [ ] Angenommen der Nutzer gibt „20x6“ oder „12“ ein, wenn er bestätigt, dann erscheint ein Hinweis „Bitte ein vierstelliges Jahr eingeben“ und der Filter bleibt unverändert
- [ ] Angenommen ein Entwurf mit Rechnungsdatum 2026, wenn „2026“ gewählt ist, dann erscheint der Entwurf in der Liste

### Statusfilter
- [ ] Angenommen ausgestellte, nacherfasste, stornierte Rechnungen, Gutschriften und Entwürfe, wenn der Nutzer „Entwurf“ wählt, dann erscheinen nur Entwürfe
- [ ] Angenommen eine ausgestellte und eine stornierte ausgestellte Rechnung, wenn der Nutzer „ausgestellt“ wählt, dann erscheint nur die nicht stornierte
- [ ] Angenommen eine nacherfasste Rechnung, wenn der Nutzer „nacherfasst“ wählt, dann erscheint sie
- [ ] Angenommen eine stornierte Rechnung mit Gutschrift, wenn der Nutzer „storniert“ wählt, dann erscheint die stornierte Rechnung, nicht die Gutschrift
- [ ] Angenommen eine Gutschrift, wenn der Nutzer „Gutschrift“ wählt, dann erscheint nur die Gutschrift

### Zahlungsfilter
- [ ] Angenommen Rechnungen mit Status offen, teilweise, bezahlt und überzahlt, wenn der Nutzer „noch nicht bezahlt“ wählt, dann erscheinen die offene und die teilweise bezahlte Rechnung
- [ ] Angenommen dieselben Rechnungen, wenn der Nutzer nacheinander „offen“, „teilweise“, „bezahlt“, „überzahlt“ wählt, dann erscheint jeweils nur die Rechnung mit diesem Status
- [ ] Angenommen eine offene überfällige, eine teilweise überfällige und eine offene nicht fällige Rechnung, wenn der Nutzer „überfällig“ wählt, dann erscheinen die beiden überfälligen
- [ ] Angenommen ein Entwurf, eine stornierte Rechnung, eine Gutschrift und eine nacherfasste Rechnung über € 0,00, wenn irgendein Zahlungswert außer „Alle“ gewählt ist, dann erscheint keine davon
- [ ] Angenommen „Status: storniert“ und „Zahlung: offen“, wenn die Liste erscheint, dann ist sie leer mit dem Hinweis „Keine Rechnungen gefunden“ und „Filter zurücksetzen“

### Betragsfilter
- [ ] Angenommen Rechnungen über € 99,99, € 100,00, € 500,00 und € 500,01, wenn der Nutzer „von 100“ und „bis 500“ eingibt, dann erscheinen die Rechnungen über € 100,00 und € 500,00
- [ ] Angenommen nur „von 1.200,50“ ist eingegeben, wenn die Liste erscheint, dann sind alle Rechnungen ab € 1.200,50 gelistet
- [ ] Angenommen eine Gutschrift über -€ 450,00, wenn der Nutzer „bis -1“ eingibt, dann erscheint die Gutschrift
- [ ] Angenommen „von 500“ und „bis 100“, wenn der Nutzer die Eingabe bestätigt, dann erscheint der Hinweis „‚Von‘ darf nicht größer als ‚Bis‘ sein“ und der Betragsfilter wird nicht angewendet
- [ ] Angenommen der Nutzer gibt „abc“ oder mehr als zwei Nachkommastellen ein, wenn er bestätigt, dann erscheint ein Hinweis am Feld und der Betragsfilter wird nicht angewendet

### Zusammenwirken, Adresse, Rückweg
- [ ] Angenommen Jahr, Status, Zahlung, Betrag und Suche sind gesetzt, wenn die Liste erscheint, dann erfüllt jede gelistete Rechnung alle Bedingungen
- [ ] Angenommen der Nutzer ist auf Seite 3, wenn er einen Filter ändert, dann zeigt die Liste Seite 1
- [ ] Angenommen gesetzte Filter, wenn der Nutzer die Adresse kopiert und in einem neuen Tab öffnet, dann erscheint dieselbe gefilterte Liste
- [ ] Angenommen gesetzte Filter, wenn der Nutzer eine Rechnung öffnet und „Zurück zur Liste“ wählt, dann erscheint die Liste mit denselben Filtern, derselben Suche und derselben Seite
- [ ] Angenommen gesetzte Filter, wenn der Nutzer den Menüpunkt „Rechnungen“ wählt, dann erscheint die Liste ohne Filter
- [ ] Angenommen ein Filter oder die Suche ist gesetzt, wenn der Nutzer „Filter zurücksetzen“ wählt, dann erscheint die ungefilterte Liste; ohne gesetzten Filter ist der Knopf nicht sichtbar
- [ ] Angenommen ungültige Werte in der Adresse (z. B. `?jahr=abc&zahlung=xyz`), wenn die Seite lädt, dann werden diese Werte ignoriert und die Liste erscheint ohne Fehler
- [ ] Angenommen ein Handy, wenn die Liste erscheint, dann sind die Filter unter „Filter“ zusammengeklappt, die Anzahl gesetzter Filter steht daneben, und die Suche ist sichtbar

### Summen
- [ ] Angenommen eine gefilterte Liste über mehrere Seiten, wenn sie erscheint, dann stehen Rechnungsbetrag, Bezahlt und Offen über alle Seiten der gefilterten Liste
- [ ] Angenommen ein Entwurf über € 300,00 in der Liste, wenn die Summen erscheinen, dann ist er im Rechnungsbetrag nicht enthalten
- [ ] Angenommen eine stornierte Rechnung über € 450,00 und ihre Gutschrift über -€ 450,00, wenn beide in der Liste sind, dann tragen sie zusammen € 0,00 zum Rechnungsbetrag und nichts zu Offen bei
- [ ] Angenommen eine Rechnung über € 400,00 mit € 450,00 bezahlt und eine Rechnung über € 200,00 ohne Zahlung, wenn die Summen erscheinen, dann zeigt Offen € 200,00 und Bezahlt € 450,00
- [ ] Angenommen eine Gutschrift mit Rückzahlung € 100,00, wenn die Summen erscheinen, dann ist die Rückzahlung von Bezahlt abgezogen
- [ ] Angenommen „Zahlung: noch nicht bezahlt“ und „Jahr: 2026“, wenn die Liste erscheint, dann zeigt Offen die Summe aller 2026 noch offenen Beträge
- [ ] Angenommen keine Rechnung passt zum Filter, wenn die Liste erscheint, dann gibt es keine Summenzeile

### Rechnung erstellen aus der Übersicht
- [ ] Angenommen ein Inhaber, wenn er die Rechnungsliste öffnet, dann steht im Seitenkopf „Rechnung erstellen“ (bei eingeschaltetem Schalter daneben „Rechnung nacherfassen“), auch im Leerzustand
- [ ] Angenommen ein Mitarbeiter, wenn er die Rechnungsliste öffnet, dann gibt es keinen Knopf „Rechnung erstellen“
- [ ] Angenommen der Inhaber wählt „Rechnung erstellen“, wenn er mindestens 2 Zeichen eines Gastnamens, einer Wohnung, eines Zeitraums oder einer Buchungsnummer eingibt, dann erscheinen passende Buchungen mit Gast, Wohnung und Zeitraum
- [ ] Angenommen eine Buchung, deren Knopf „Rechnung“ in der Buchung aktiv ist, wenn der Inhaber sie in der Suche wählt, dann öffnet sich das Entwurfsformular mit denselben Vorbelegungen wie über den Knopf „Rechnung“ in der Buchung
- [ ] Angenommen eine vollständig verrechnete Buchung, wenn sie in der Suche erscheint, dann ist sie nicht wählbar und zeigt dieselbe Begründung wie in der Buchung
- [ ] Angenommen eine stornierte Buchung mit noch nicht verrechneter Stornogebühr, wenn der Inhaber sie wählt, dann enthält der Entwurf nur die Stornogebühr (wie PROJ-40)
- [ ] Angenommen eine Option, wenn der Inhaber sie wählt, dann öffnet sich das Entwurfsformular mit dem Hinweis „Buchung ist noch eine Option“
- [ ] Angenommen eine Sperre passt zum Suchbegriff, wenn die Treffer erscheinen, dann ist sie nicht dabei
- [ ] Angenommen der Inhaber bricht das Entwurfsformular ab, das über die Rechnungsliste geöffnet wurde, wenn er bestätigt, dann erscheint wieder die Rechnungsliste
- [ ] Angenommen der Inhaber speichert den Entwurf, wenn die Speicherung gelingt, dann geht es weiter wie beim Entwurf aus der Buchung (PROJ-40)
- [ ] Angenommen ein Mitarbeiter ruft die Adresse der Buchungssuche bzw. des Entwurfsformulars direkt auf, wenn die Seite lädt, dann ist der Zugriff verweigert wie in PROJ-40

## Edge Cases
- **Buchung wird zwischen Suche und Wahl vollständig verrechnet** (z. B. zweiter Tab): Beim Öffnen bzw. Speichern greift die bestehende Prüfung aus PROJ-40 mit ihrer Meldung.
- **Rechnung ändert Status während die gefilterte Liste offen ist** (z. B. Zahlung erfasst): Liste zeigt den Stand beim Laden; nach „Zurück zur Liste“ neu geladen; eine jetzt bezahlte Rechnung fällt aus „noch nicht bezahlt“ heraus.
- **Überfällig wechselt um Mitternacht:** „überfällig“ richtet sich nach dem heutigen Tag in Wien (wie PROJ-45).
- **Seite in der Adresse größer als die Seitenzahl** (z. B. nach Filterwechsel per Adresse): Hinweis „Auf dieser Seite stehen keine Rechnungen“ wie bisher, mit „Filter zurücksetzen“.
- **Jahr ohne Rechnungen:** leere Liste mit „Keine Rechnungen gefunden“ und „Filter zurücksetzen“, keine Summen.
- **Frei eingegebenes Jahr außerhalb der Auswahl** (z. B. 2012): bleibt im Filter sichtbar und in der Adresse; Jahre vor 1990 oder nach 2099 werden mit Hinweis abgelehnt.
- **Betrag mit Punkt als Dezimaltrennzeichen** („100.50“): wird wie im übrigen Betragsfeld der App behandelt (PROJ-31); mehrdeutige Eingabe ergibt einen Hinweis.
- **Zahlungsfilter bei nacherfasster Rechnung mit Betrag > 0:** hat einen Zahlungsstatus (PROJ-45) und wird mitgefiltert.
- **Überzahlte und offene Rechnungen gemischt:** „Offen“ zählt nur positive offene Beträge; eine Überzahlung verringert die Summe nicht.
- **Kunde ohne Rechnungen:** Leerzustand wie bisher, für Inhaber mit „Rechnung erstellen“ (und ggf. „Rechnung nacherfassen“); keine Filter.
- **Betreiber ohne Mitgliedschaft:** Hinweis wie bisher, keine Filter.
- **Viele Rechnungen** (z. B. 5.000): Liste und Summen laden unter einer Sekunde.

## Technical Requirements
- Filter und Summen werden auf dem Server bzw. in der Datenbank gebildet; Zahlungsstatus, Bezahlt und Offen aus derselben Quelle wie PROJ-45 (Lesesicht), nicht im Browser berechnet.
- Nur Rechnungen des eigenen Kunden (bestehende Mandanten-Abschottung).
- Werte aus der Adresse werden geprüft; ungültige Werte werden ignoriert.
- Antwortzeit Liste mit Summen < 1 s bei 5.000 Rechnungen.

## Open Questions
- [ ] Keine offenen Fragen aus dem Interview.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| „Rechnung erstellen“ öffnet eine Buchungssuche und danach das bestehende Entwurfsformular; nicht wählbare Buchungen mit Begründung | Nutzerentscheidung; kein neuer Ablauf, gleiche Regeln wie der Knopf „Rechnung“ (PROJ-40) | 2026-11-07 |
| Keine Rechnung ohne Buchung | Positionen, Leistungszeitraum und Kleinunternehmer-Regel kommen aus der Buchung; wäre ein eigenes Feature | 2026-11-07 |
| Jahresfilter standardmäßig „Alle Jahre“ (ersetzt die Vorgabe „aktuelles Jahr“ vom 2026-10-30) | Nutzerentscheidung; offene Rechnungen aus dem Vorjahr verschwinden sonst im Jänner | 2026-11-07 |
| Jahresauswahl 7 Jahre zurück bis 5 voraus, freie Eingabe | Vorgabe des Nutzers vom 2026-10-30; 7 Jahre = Aufbewahrungsfrist | 2026-11-07 |
| Zwei getrennte Filter „Status“ und „Zahlung“, je ein Wert, plus „noch nicht bezahlt“ | Nutzerentscheidung; passt zu den zwei Spalten; häufigste Frage ohne Mehrfachauswahl | 2026-11-07 |
| Betragsfilter auf den Rechnungsbetrag brutto | Nutzerentscheidung; passt zur sichtbaren Spalte; offene Beträge über den Zahlungsfilter | 2026-11-07 |
| Summenzeile Rechnungsbetrag/Bezahlt/Offen über alle Seiten; Entwürfe ohne; Storno und Gutschrift heben sich auf | Nutzerentscheidung; wie die Seite „Zahlungen“ | 2026-11-07 |
| „Offen“ summiert nur positive offene Beträge | Eine Überzahlung bei einem Gast soll offene Beträge anderer Gäste nicht verdecken | 2026-11-07 |
| Filter in der Adresse; „Zurück zur Liste“ mit letzten Filtern; Menüpunkt ohne Filter; „Filter zurücksetzen“ | Nutzerentscheidung; Menüpunkt zeigt verlässlich alles, Abarbeiten einer gefilterten Liste bleibt bequem | 2026-11-07 |
| Keine sortierbaren Spalten | Nutzerentscheidung; Filter genügen, passt zur Kartenansicht am Handy | 2026-11-07 |
| Filter am Handy in aufklappbarem Bereich mit Anzahl | Platz auf kleinen Bildschirmen; Suche bleibt direkt erreichbar | 2026-11-07 |
| Mitarbeiter sehen Filter und Summen | Sie sehen Rechnungen und Zahlungen schon heute (PROJ-37/45) | 2026-11-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue Lesesicht „Rechnungsliste“ (Rechnung + Zahlungsstand aus PROJ-45) mit den Rechten des Nutzers | Filter, Anzahl und Blättern in einer Abfrage; eine Regel für den Zahlungsstand; Abschottung je Kunde bleibt | 2026-11-07 |
| Eigene Summenabfrage mit denselben Filtern | Summen über alle Seiten; Muster der Seite „Zahlungen“ | 2026-11-07 |
| „Bezahlt“ = Beglichen (inkl. Provision und Zahlungsgebühr), bei Gutschriften minus Rückzahlungen | Gleich wie „Bezahlt“ im Buchungsdetail und wie die Statusregel; sonst wirkte eine bezahlte booking.com-Rechnung in der Summe teilweise offen | 2026-11-07 |
| Filter in der Adresse, ungültige Werte ignoriert | Zurück, Neuladen und Links funktionieren; keine Fehlerseiten durch alte Links | 2026-11-07 |
| Rückweg über den Speicher des Browser-Tabs, Rückfall `/rechnungen` | Kurze Detailadressen, wirkt über Unterseiten; Menüpunkt bleibt ungefiltert | 2026-11-07 |
| Wählbarkeit der Buchungen in der Suche auf dem Server mit der Regel aus PROJ-40; erneute Prüfung beim Öffnen und Speichern | Preisregeln liegen auf dem Server; gleichzeitige Änderungen bleiben abgesichert | 2026-11-07 |
| Keine neuen Pakete, keine neuen Tabellen | Alles aus vorhandenen Daten und Bausteinen | 2026-11-07 |
| Liste und Summen über zwei Datenbankfunktionen (Kern `security definer` in `private` mit einmaliger Mitgliedsprüfung, Hülle in `public`) statt Lesesicht | Messung: Lesesicht mit RLS je Zeile 1,4 s bzw. > 8 s bei 5.000 Rechnungen; Funktionen 60–80 ms | 2026-11-07 |
| Zahlungsregel in `private.invoice_list_rows` neben der Lesesicht `invoice_payment_status` (PROJ-45 unverändert); Gleichheit per Integrationstest | Lesesicht aus PROJ-45 nicht anfassen (Rechnungsdetail, Buchung, Zahlungen); Abweichungen fallen im Test auf | 2026-11-07 |
| Anzahl der Treffer aus der Summenfunktion | Stimmt auch auf Seiten hinter dem Ende (vgl. PROJ-37 BUG-5) | 2026-11-07 |

---

## Tech Design (Solution Architect)

**Stand 2026-11-07.** Die Rechnungsliste besteht schon (PROJ-37/44/45). PROJ-43 erweitert sie um Filter, Summen, Rückweg und den Einstieg „Rechnung erstellen“. Neue Daten werden nicht gespeichert. Es kommen nur eine Lesesicht und eine Summenabfrage in der Datenbank dazu.

### A) Aufbau der Seite

```
Rechnungen (/rechnungen)
+-- Seitenkopf
|   +-- NEU „Rechnung erstellen“ (nur Inhaber) → Dialog mit Buchungssuche
|   +-- „Rechnung nacherfassen“ (wie bisher, nur bei eingeschaltetem Schalter)
+-- Suche (wie bisher)
+-- NEU Filterleiste
|   +-- Jahr (Auswahl „Alle Jahre“, 7 zurück bis 5 voraus, „Anderes Jahr …“ mit Eingabefeld)
|   +-- Status (Auswahl)
|   +-- Zahlung (Auswahl)
|   +-- Betrag von / bis (zwei Betragsfelder, Hinweise am Feld)
|   +-- „Filter zurücksetzen“ (nur wenn etwas gesetzt ist)
|   +-- Handy: alles in einem aufklappbaren Bereich „Filter (n)“, Suche bleibt außen
+-- Anzahl (wie bisher)
+-- Liste (Tabelle bzw. Karten, wie bisher; Sortierung unverändert)
+-- NEU Summenzeile: Rechnungsbetrag · Bezahlt · Offen (nur wenn Treffer)
+-- Blättern (wie bisher, behält die Filter)
+-- Leerzustand bzw. „Keine Rechnungen gefunden“ mit „Filter zurücksetzen“

Dialog „Rechnung erstellen“ (nur Inhaber)
+-- Suchfeld (Gastname, Wohnung, Zeitraum, Buchungsnummer; ab 2 Zeichen)
+-- Treffer (höchstens 20): Gast · Wohnung · Zeitraum · Buchungsnummer, Kennzeichen Option/storniert
|   +-- wählbar → weiter zu „Rechnung erstellen“ (Entwurfsformular aus PROJ-40)
|   +-- nicht wählbar → ausgegraut mit Begründung (gleiche Texte wie am Knopf „Rechnung“)

Rechnungsdetail (/rechnungen/[id]) und Unterseiten
+-- „Zurück zur Liste“ → zuletzt gefilterte Liste (Filter, Suche, Seite)

Entwurfsformular (/rechnungen/neu?buchung=…)
+-- „Abbrechen“ führt zur Rechnungsliste, wenn es aus der Liste geöffnet wurde (sonst wie bisher zur Buchung)
```

Wiederverwendet werden: Suchfeld und Blättern der Rechnungsliste, Buchungssuche aus „Rechnung nacherfassen“ (gleiche Datenbanksuche, findet auch Buchungsnummern), Status- und Zahlungskennzeichen, Betragsanzeige und -eingabe (PROJ-31/32), Entwurfsformular und Knopf-Regel aus PROJ-40, shadcn/ui-Bausteine (Select, Input, Dialog, Collapsible, Button).

### B) Daten

**Nichts Neues gespeichert.** Alle Filter und Summen kommen aus vorhandenen Daten:

| Filter bzw. Summe | Quelle |
|---|---|
| Jahr | Rechnungsdatum |
| Status | Herkunft (Entwurf/ausgestellt/nacherfasst), Art (Gutschrift) und „storniert“ (es gibt eine Gutschrift dazu) |
| Zahlung, überfällig, Offen, Bezahlt | Lesesicht „Zahlungsstand je Rechnung“ aus PROJ-45 |
| Betrag | Rechnungsbetrag brutto |

**Neue Lesesicht „Rechnungsliste“** (in /backend durch Funktionen ersetzt, siehe „Umsetzung Backend“): Sie legt Rechnung und Zahlungsstand zusammen (Entwürfe ohne Zahlungsstand), mit den Kennzeichen „storniert“ und „Gutschrift“. So lassen sich Liste, Anzahl und Blättern mit allen Filtern in einer Abfrage bilden. Die Abschottung je Kunde gilt wie bei den Tabellen, weil die Lesesicht mit den Rechten des Nutzers liest.

**Neue Summenabfrage:** gleiche Filter wie die Liste, ergibt Rechnungsbetrag, Bezahlt und Offen über alle Seiten (Muster wie die Summen der Seite „Zahlungen“).

- **Rechnungsbetrag:** alle Treffer außer Entwürfen
- **Bezahlt:** „Beglichen“ (Eingegangen + Provision + Zahlungsgebühr) wie im Buchungsdetail, bei Gutschriften abzüglich der Rückzahlungen
- **Offen:** nur zahlbare Rechnungen, nur positive offene Beträge

**Filter in der Adresse:** `jahr`, `status`, `zahlung`, `von`, `bis` neben `q` und `seite`. Ungültige Werte fallen beim Lesen weg. Beträge stehen als Zahl in Cent bzw. im Klartext und werden mit derselben Regel geprüft wie die Eingabefelder.

**Rückweg:** Die Liste merkt sich ihre aktuelle Adresse im Speicher des Browser-Tabs (nur für diesen Tab, endet mit dem Tab). „Zurück zur Liste“ auf Rechnungsdetail und Unterseiten liest sie; fehlt sie (neuer Tab, privates Fenster), führt der Link zu `/rechnungen`. Der Menüpunkt verlinkt immer `/rechnungen` ohne Filter.

**Buchungssuche mit Wählbarkeit:** Die vorhandene Suche liefert die Treffer. Für diese höchstens 20 Buchungen rechnet der Server mit derselben Regel wie der Knopf „Rechnung“ (PROJ-40) aus, ob noch etwas zu verrechnen ist, und gibt die Begründung mit. Beim Öffnen des Formulars und beim Speichern prüft die App bzw. die Datenbank wie bisher noch einmal (zweiter Tab, gleichzeitige Änderung).

### C) Technische Entscheidungen (für PM erklärt)

- **Filtern in der Datenbank statt im Browser:** Summen und Anzahl müssen über alle Seiten stimmen, und es können Tausende Rechnungen sein. Die Datenbank liefert nur die 50 Zeilen der Seite und die Summen.
- **Zahlungsstand aus der Lesesicht von PROJ-45:** eine einzige Regel für Status, Offen und „überfällig“, damit Liste, Rechnungsdetail und Buchung nie auseinanderlaufen.
- **Filter in der Adresse:** Zurück-Knopf, Neuladen und Teilen eines Links funktionieren ohne Zusatzaufwand.
- **Rückweg über den Speicher des Browser-Tabs statt über die Adresse der Detailseite:** Die Detailadresse bleibt kurz, und der Rückweg funktioniert auch über die Unterseiten (Bearbeiten, Ausstellen, Gutschrift). Ein „Merken über den Menüpunkt hinaus“ ist das nicht: Der Menüpunkt beginnt immer leer.
- **Wählbarkeit in der Suche auf dem Server:** Die Preisregeln (Ortstaxe, Verlängerung, Stornogebühr) liegen schon auf dem Server. Die Suche verwendet sie, statt sie im Browser nachzubauen.
- **Leistung:** Für Kunde + Rechnungsdatum und für Zahlungen je Rechnung gibt es schon Indizes. /backend misst mit 5.000 Rechnungen; reicht es nicht, kommt ein Index für den Betrag dazu.

### D) Abhängigkeiten

Keine neuen Pakete.

### E) Aufteilung

- **/frontend:** Filterleiste samt Handy-Ansicht, Prüfung der Eingaben (Jahr, Betrag, von > bis), Lesen und Schreiben der Adresse, „Filter zurücksetzen“, Summenzeile, Leer- und Trefferzustände, Dialog „Rechnung erstellen“ mit Wählbarkeit und Begründung, Rückweg auf Detail und Unterseiten, „Abbrechen“ im Entwurfsformular aus der Liste, Texte in der Übersetzungsdatei. Bis zur Migration liest die Liste wie bisher (Filter ohne Wirkung auf Status/Zahlung, keine Summen).
- **/backend:** Lesesicht „Rechnungsliste“, Summenabfrage, Wählbarkeit in der Buchungssuche, Integrationstests (jede Filterregel, Summen inkl. Storno/Gutschrift/Überzahlung, fremder Kunde, Mitarbeiter), Messung mit 5.000 Rechnungen.

### Umsetzung Frontend (2026-11-07)

**Gebaut:**
- Filterleiste `src/components/invoices/invoice-filters.tsx`: Jahr (Auswahl „Alle Jahre“, 7 zurück bis 5 voraus, „Anderes Jahr …“ mit Eingabe und Hinweis; frei eingegebenes Jahr bleibt in der Auswahl sichtbar), Status, Zahlung, Betrag von/bis mit „Anwenden“ und Hinweisen (ungültiger Betrag, „von“ > „bis“); „Filter zurücksetzen“, sobald Filter oder Suche gesetzt sind; am Handy aufklappbar „Filter (n)“, ab 768 px immer offen.
- Regeln in `src/lib/invoices.ts`: Filter in der Adresse (`jahr`, `status`, `zahlung`, `von`, `bis` neben `q`, `seite`; Beträge als Euro mit Punkt, z. B. `von=-450&bis=1200.50`), ungültige Werte und „von“ > „bis“ fallen weg; Jahresauswahl, Prüfung der freien Jahreseingabe (1990–2099), Anzahl gesetzter Filter; Tests in `invoices.test.ts`.
- Suche und Blättern behalten die Filter; die Anzahl zeigt bei Suche oder Filtern „n Treffer“; Leerzustand „Keine Rechnungen gefunden“ mit „Filter zurücksetzen“.
- Summenzeile (Rechnungsbetrag, Bezahlt, Offen) unter der Liste, sobald die Datenbank Summen liefert.
- Rückweg `src/components/invoices/invoice-list-return.tsx`: Die Liste merkt sich ihre Adresse im Speicher des Browser-Tabs; „Zurück zur Liste“ (vorher „Alle Rechnungen“) auf Rechnungs- und Entwurfsdetail führt dorthin, sonst zu `/rechnungen`.
- „Rechnung erstellen“ (`create-invoice-button.tsx`, nur Inhaber, auch im Leerzustand) neben „Rechnung nacherfassen“ (jetzt als Umriss-Knopf); Dialog mit der Buchungssuche (`BookingPicker` mit `mode="draft"`): Treffer, deren Knopf „Rechnung“ inaktiv wäre, sind nicht wählbar und zeigen die Begründung; Fehlermeldung, wenn die Suche scheitert.
- Server-Aktion `searchDraftBookings` (gleiche Suche wie beim Nacherfassen, je Treffer die Regel des Knopfs über `getInvoiceButtonState` in `invoice-drafts-data.ts`).
- Entwurf aus der Liste: `/rechnungen/neu?buchung=…&von=liste`; Rückweg „Zurück zur Liste“ und „Abbrechen“ führen zur zuletzt gefilterten Liste (`DraftForm` mit `fromList`).
- Ohne Lesesicht (vor der Migration) liest die Liste die Tabelle: Jahr, Betrag, „Entwurf“, „Gutschrift“, „nacherfasst“ und „ausgestellt“ (ohne Storno-Ausschluss) wirken; bei Status- bzw. Zahlungsfilter erscheint ein Hinweis, Summen fehlen.

**Tests:** `tests/PROJ-43-rechnungsuebersicht-ausbauen.spec.ts` (Filter, freie Jahreseingabe, Adresse, Zurücksetzen, Mitarbeiter, Handy mit Barrierefreiheit, Rückweg, Rechnung erstellen mit Begründung und Abbrechen) grün; Regression PROJ-37 (Liste, Schalter, Mitarbeiter, Handy-Layout) und PROJ-40 (Knopf, Abbrechen) grün; Unit-Tests `src/lib` 730 grün; Build und Lint sauber.

### Umsetzung Backend (2026-11-07)

**Migrationen (nur Dev, Reihenfolge für /deploy):**
1. `20261107064552_invoice_list.sql`: erste Fassung als Lesesicht `invoice_list` + `invoice_list_totals` (wird von 2. wieder entfernt)
2. `20261107065310_invoice_list_functions.sql`: ersetzt beides durch Funktionen
3. `20261107065405_invoice_list_wrappers.sql`: Projektmuster (Kern in `private`, Hülle in `public`)

**Warum Funktionen statt Lesesicht (Abweichung vom Tech Design):** Messung mit 5.000 Rechnungen über die Lesesicht: Liste ca. 1,4 s, Summen über 8 s, Summen mit Suche Zeitüberschreitung. Ursache: Die RLS prüft die Mitgliedschaft (`private.is_member`) je Zeile, in der Zahlungsstand-Lesesicht ein zweites Mal; in der Summenfunktion wählte die Datenbank mit Parametern zudem einen schlechteren Plan. Jetzt prüfen die Funktionen die Mitgliedschaft **einmal** je Aufruf und lesen danach nur die Rechnungen dieses Kunden. Neu gemessen: Seite und Summen je ca. 60–80 ms (ohne Filter, mit Jahr + Zahlung, mit Suche, letzte Seite).

**Datenbank:**
- `private.invoice_list_rows(tenant)`: je Rechnung (inkl. Entwürfe) Listen-Status (`draft`/`issued`/`backfilled`/`cancelled`/`credit_note`), Zahlungsmodus, Zahlungsstatus, überfällig, Beglichen, Offen, Rückzahlungen, Buchungsnummer. Gleiche Zahlungsregel wie die Lesesicht `invoice_payment_status` aus PROJ-45 (die unverändert bleibt); ein Integrationstest vergleicht beide Rechnung für Rechnung. Nicht direkt aufrufbar.
- `public.invoice_list_page(tenant, Muster, Jahr, Status, Zahlung, von, bis, offset, limit)`: Seite der Liste, Datum absteigend, Nummer absteigend (Entwürfe zuerst), höchstens 100 Zeilen.
- `public.invoice_list_totals(…)`: Anzahl und Summen über alle Seiten (Rechnungsbetrag ohne Entwürfe; Bezahlt = Beglichen, Rückzahlungen an Gutschriften abgezogen; Offen = positive offene Beträge zahlbarer Rechnungen).
- Beide: Kern `security definer` in `private` mit eigener Prüfung „Mitglied des Kunden“ (sonst leer bzw. 0), Hülle in `public` mit den Rechten der Person. Keine neuen Tabellen, keine RLS-Änderung. Advisors: nur die bekannte Auth-Warnung „OTP-Ablauf“.

**App:** `getInvoicePage` (`src/lib/invoices-data.ts`) ruft beide Funktionen parallel auf; die Anzahl kommt aus den Summen (stimmt auch hinter der letzten Seite). Das Suchmuster wird für SQL von doppeltem auf einfachen Backslash umgestellt. Fehlen die Funktionen, gilt der Rückfall auf die Tabelle wie im Frontend beschrieben.

**Tests:**
- `supabase/tests/invoice-list.integration.test.ts` (10): Seite und Reihenfolge, Blättern, Anzahl; jeder Status- und Zahlungsfilter; Vergleich mit `invoice_payment_status`; Summen ohne und mit Filtern (Storno + Gutschrift, Rückzahlung, Überzahlung, Entwurf, Betrag ≤ 0); Jahr, Betragsgrenzen, Suche mit „_“ und „%“; Mitarbeiter; fremder Inhaber; fremder Kunde; ohne Anmeldung.
- E2E `tests/PROJ-43-…spec.ts` um „Zahlung und Summen“ ergänzt (noch nicht bezahlt, Summen, Kombination ohne Treffer, Mitarbeiter); alle PROJ-43-Tests (Desktop, Handy) grün.
- Regression grün: Integration Zahlungen, Rechnungen, Gutschriften, RLS; E2E PROJ-37 (Liste), PROJ-44 (Mitarbeiter-Liste), PROJ-45 (Spalte „Zahlung“); Unit 776; Build und Lint sauber.

**Offen für /qa:** Die Buchungssuche „Rechnung erstellen“ liest je Treffer (höchstens 20) Buchung und Rechnungen einzeln; Antwortzeit bei vielen Treffern prüfen.

## QA Test Results

**Tested:** 2026-11-07
**App URL:** http://localhost:3000 (gebauter Server, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)
**Stand:** 4999ca7 (Frontend cda49ca, Backend 4999ca7)

Hinweis: Die direkte Prüfung von `.env.local` auf die Dev-Kennung war in dieser Sitzung gesperrt. Ersatz: Die Test-Helfer lehnen Staging-/Produktionsadressen ab, und `supabase/.temp/project-ref` sowie alle Integrationsläufe zeigen auf Dev (`nizgfmvjplhegoosanmu`).

### Acceptance Criteria Status (47/47)

#### Jahresfilter (6/6)
- [x] Menüpunkt → „Alle Jahre“, alle Rechnungen (E2E)
- [x] Auswahl 2031–2019 absteigend + „Anderes Jahr …“ (Unit `invoiceYearOptions`, E2E)
- [x] 31.12.2025 / 01.01.2026 → nur 2026 (E2E)
- [x] Freies Jahr 2012 → Liste und Anzeige „2012“ (E2E)
- [x] „20x6“ bzw. „12“ → Hinweis, Filter unverändert (E2E, Unit)
- [x] Entwurf mit Rechnungsdatum 2026 erscheint unter 2026 (E2E)

#### Statusfilter (5/5)
- [x] Entwurf, ausgestellt (ohne stornierte), nacherfasst, storniert (ohne Gutschrift), Gutschrift (E2E „QA: Status in der Oberfläche“, Integration)

#### Zahlungsfilter (5/5)
- [x] noch nicht bezahlt = offen + teilweise; je Status genau einer; überfällig (offen oder teilweise); Entwurf/storniert/Gutschrift/≤ 0 ohne Status; storniert + offen → leer mit „Filter zurücksetzen“ (Integration, E2E)

#### Betragsfilter (5/5)
- [x] 100–500 inklusive; nur „von 1.200,50“; Gutschrift mit „bis -1“; „von“ > „bis“ → Hinweis, nicht angewendet; „abc“ → Hinweis (E2E, Integration, Unit)

#### Zusammenwirken, Adresse, Rückweg (8/8)
- [x] Alle Filter + Suche zusammen; Filterwechsel → Seite 1; Adresse in neuem Tab; „Zurück zur Liste“ mit Filtern, Suche und Seite (auch Seite 2); Menüpunkt ohne Filter; „Filter zurücksetzen“ nur bei gesetzten Filtern; ungültige Werte in der Adresse ignoriert; Handy „Filter (2)“ zugeklappt, Suche sichtbar (E2E Desktop, Handy, Firefox)

#### Summen (7/7)
- [x] Über alle Seiten; Entwurf ohne; Storno + Gutschrift = 0 und nicht in Offen; Überzahlung mindert Offen nicht; Rückzahlung von Bezahlt abgezogen; „noch nicht bezahlt“ + Jahr; keine Summenzeile ohne Treffer (Integration, E2E)

#### Rechnung erstellen aus der Übersicht (11/11)
- [x] Knopf für Inhaber (auch Leerzustand), nicht für Mitarbeiter; Suche nach Gast, Wohnung, Zeitraum, Buchungsnummer; wählbare Buchung → Entwurfsformular; voll verrechnet bzw. storniert ohne Gebühr nicht wählbar mit Begründung; Option mit Hinweis; Sperre nicht gefunden; Abbrechen → Liste; Speichern wie PROJ-40; Mitarbeiter-Direktaufruf → „nicht gefunden“ (E2E)

### Edge Cases Status
- [x] Buchung zwischen Suche und Wahl verrechnet: Formular zeigt die Begründung statt des Formulars (bestehende Prüfung PROJ-40, Code geprüft)
- [x] Seite hinter dem Ende: Hinweis mit richtiger Anzahl (Integration: Anzahl aus den Summen)
- [x] Jahr ohne Rechnungen: Hinweis + „Filter zurücksetzen“, keine Summen (E2E)
- [x] Freies Jahr außerhalb der Auswahl bleibt sichtbar; < 1990 / > 2099 abgelehnt (E2E, Unit)
- [x] Betrag mit Punkt: Regel aus PROJ-31 („100.5“ = 100,50; „1.234“ = 1.234,00)
- [x] Nacherfasste Rechnung > 0 wird nach Zahlung gefiltert (Integration)
- [x] Kunde ohne Rechnungen: Leerzustand mit „Rechnung erstellen“ (E2E PROJ-37-Regression)
- [x] 5.000 Rechnungen: Seite und Summen je ca. 60–80 ms (Messung /backend)
- [x] Zusätzlich: Blättern über 55 Rechnungen behält die Filter; Tippen in der Suche behält Jahr und Status (E2E)

### Security Audit Results
- [x] Ohne Anmeldung: Funktionen liefern nichts (Integration)
- [x] Fremder Inhaber bzw. fremde Kunden-ID: leere Liste, Summen 0 (Integration); fremde Rechnungen nicht über die Suche (E2E)
- [x] Mitarbeiter: Liste und Summen ja, „Rechnung erstellen“ nein (Knopf fehlt, Seite „nicht gefunden“, Server-Aktion `requireOwner`)
- [x] Kern `private.invoice_list_rows` nicht direkt aufrufbar; Funktionen mit erhöhten Rechten prüfen die Mitgliedschaft selbst; Advisors ohne neue Meldung
- [x] Eingaben: HTML im Suchbegriff und in Filterwerten wird als Text gezeigt, kein Skript ausgeführt (E2E); Werte nur als Parameter an die Datenbank; „%“/„_“ als Zeichen (Integration)
- [x] Rückweg: gemerkte Adresse nur übernommen, wenn sie mit `/rechnungen` beginnt (kein fremdes Ziel)
- [x] Blättern begrenzt auf höchstens 100 Zeilen je Aufruf (Funktion)

### Bugs Found

#### BUG-1: Buchungssuche „Rechnung erstellen“ langsamer als beim Nacherfassen
- **Severity:** Low
- **Steps to Reproduce:**
  1. Kunde mit 20 Buchungen eines Gastes; Rechnungsliste → „Rechnung erstellen“
  2. Gastname eingeben
  3. Expected: Treffer etwa so schnell wie beim Nacherfassen
  4. Actual: Server-Antwort ca. 1,2–1,4 s (Nacherfassen ca. 0,35 s), weil je Treffer Buchung, Positionen und Rechnungen einzeln gelesen werden
- **Test:** `QA: Antwortzeit der Buchungssuche` (`test.fail`, wird grün unter 1 s)
- **Priority:** Nice to have

#### BUG-2: Platzhalter der Buchungssuche mit zu wenig Kontrast
- **Severity:** Low
- **Steps to Reproduce:**
  1. Rechnungsliste → „Rechnung erstellen“
  2. axe auf den Dialog
  3. Expected: keine Verstöße
  4. Actual: Platzhalter „Gastname, Wohnung oder Zeitraum“ 1,97:1 (#a5a3a3 auf #e5e4e4); gemeinsamer Baustein `Command`, betrifft auch „Rechnung nacherfassen“
- **Test:** `BUG-2: Dialog „Rechnung erstellen“ ohne axe-Fehler` (`test.fail`)
- **Priority:** Fix in next sprint

#### BUG-3: Nach dem Löschen einer Rechnung ungefilterte Liste
- **Severity:** Low
- **Steps to Reproduce:**
  1. Liste mit Filter (z. B. Jahr 2026) → nacherfasste Rechnung öffnen → „Löschen“ bestätigen
  2. Expected: zurück zur gefilterten Liste (wie „Zurück zur Liste“)
  3. Actual: `/rechnungen?geloescht=1` ohne Filter (nicht ausdrücklich im Spec gefordert)
- **Priority:** Nice to have

### Beobachtung (kein Bug)
- Am Handy liegt „Filter zurücksetzen“ im zugeklappten Bereich „Filter (n)“; ohne Treffer steht der Knopf zusätzlich im Hinweis.

### Tests
- E2E `tests/PROJ-43-rechnungsuebersicht-ausbauen.spec.ts`: 13 Tests (davon 2 `test.fail` für BUG-1/2); Desktop grün, Tablet- und Handy-Layout grün, Kernabläufe in Firefox grün (6/6). Safari nicht geprüft (nur gegen den Entwicklungsserver möglich, optional).
- Integration `supabase/tests/invoice-list.integration.test.ts`: 10 grün.
- Regression (nach /backend, Code seitdem unverändert): Integration Zahlungen, Rechnungen, Gutschriften, RLS; E2E PROJ-37 Liste/Layout, PROJ-40 Knopf/Abbrechen, PROJ-44 Mitarbeiter-Liste, PROJ-45 Spalte „Zahlung“; Unit 776. Gesamtlauf `npm run test:e2e` nicht gefahren (Läufe nur in kleinen Paketen).

### Summary
- **Acceptance Criteria:** 47/47 passed
- **Bugs Found:** 3 total (0 critical, 0 high, 0 medium, 3 low)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy; BUG-2 (gemeinsamer Baustein) im nächsten Durchgang beheben

## Deployment
_To be added by /deploy_
