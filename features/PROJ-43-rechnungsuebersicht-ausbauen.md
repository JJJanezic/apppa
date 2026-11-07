# PROJ-43: Rechnungsübersicht ausbauen

## Status: Planned
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
- **Bezahlt:** Summe der Zahlungen an den gefilterten Rechnungen, Rückzahlungen abgezogen.
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

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
