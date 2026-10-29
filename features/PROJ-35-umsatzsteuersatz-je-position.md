# PROJ-35: Umsatzsteuersatz je Position

## Status: Planned
**Created:** 2026-10-29
**Last Updated:** 2026-10-29

## Dependencies
- Requires: PROJ-8 (Manuelle Buchungen) — Übernachtungspreis, Zusatzkosten, Stornogebühr, Rollenregeln für Preise
- Requires: PROJ-32 (Negative Beträge bei Zusatzkosten) — negative Positionen, Bezeichnungs-Vorschläge
- Requires: PROJ-34 (Preispositionen ordnen) — gleiche Formularzeile; der Satz wandert mit seiner Position
- Vorbereitung für: Rechnungsmodul (Ausweis der Umsatzsteuer je Satz)

## Überblick
Preise werden weiterhin **brutto** erfasst. Neu bekommt jeder Betrag einer Buchung – Übernachtungspreis, jede Zusatzposition und die Stornogebühr – einen Umsatzsteuersatz in Prozent mit zwei Nachkommastellen. Sinnvolle Sätze werden vorbelegt und sind je Position überschreibbar. Das Bezeichnungsfeld der Zusatzkosten bekommt eine sichtbare Auswahl mit „Reinigung“ (10 %) und „Nächtigungsabgabe“ (0 %); frei eingetippte Positionen starten mit 20 %. Das Buchungs-Detail zeigt den Satz je Position und darunter die darin enthaltene Umsatzsteuer je Satz.

## User Stories
- Als **Inhaber** möchte ich jeder Position einer Buchung einen Umsatzsteuersatz zuordnen, damit die Rechnung später die Steuer je Satz richtig ausweist.
- Als **Inhaber** möchte ich häufige Positionen („Reinigung“, „Nächtigungsabgabe“) aus einer Liste wählen, damit Bezeichnung und Satz ohne Tippen stimmen.
- Als **Inhaber** möchte ich weiterhin eigene Positionen frei eintragen und deren vorgeschlagenen Satz (20 %) bei Bedarf ändern.
- Als **Inhaber** möchte ich im Buchungs-Detail sehen, wie viel Umsatzsteuer je Satz im Endbetrag steckt, damit ich die Sätze vor der Rechnungsstellung prüfen kann.
- Als **Inhaber** möchte ich auch der Stornogebühr einen Satz geben, damit eine Storno-Rechnung korrekt ist.
- Als **Inhaber** möchte ich, dass meine bestehenden Buchungen automatisch sinnvolle Sätze erhalten, damit ich nicht jede einzeln nachpflegen muss.

## Out of Scope
- Netto-Erfassung von Preisen (Preise bleiben brutto)
- Einstellung „keine Umsatzsteuer“ (z. B. Kleinunternehmer) samt Rechnungshinweis: kommt mit dem Rechnungsmodul
- Vom Kunden selbst pflegbare Liste von Bezeichnungen und Sätzen
- Steuersätze je Wohnung oder in den Wohnungsstammdaten
- Rechnung bzw. Rechnungsdarstellung (Rechnungsmodul)
- Anzeige von Sätzen oder Steuer in der Buchungsliste
- Sätze für Mitarbeiter sichtbar (sehen keine Preise, PROJ-8)
- Automatische Steuerlogik für Rabatte (Rabatt bekommt seinen Satz wie jede freie Position)
- Bisherige Vorschläge „Haustier“, „Frühstück“, „Parkplatz“, „Rabatt“ (entfallen aus der Auswahl; weiterhin frei eintippbar)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Eingabe im Buchungsformular
- [ ] Angenommen ein Inhaber im Buchungsformular, wenn der Preisbereich angezeigt wird, dann gibt es beim Übernachtungspreis und in jeder Zusatzposition ein Feld „USt %“
- [ ] Angenommen eine neue Buchung, wenn das Formular geöffnet wird, dann steht beim Übernachtungspreis „10,00“
- [ ] Angenommen der Inhaber fügt eine Zusatzposition hinzu, wenn sie erscheint, dann steht im Feld „USt %“ „20,00“
- [ ] Angenommen das Feld „USt %“, wenn „13“ eingegeben und das Feld verlassen wird, dann steht dort „13,00“; „5,5“ wird zu „5,50“
- [ ] Angenommen das Feld „USt %“ ist leer, enthält Text, einen Wert unter 0 oder über 100 oder mehr als zwei Nachkommastellen, wenn gespeichert wird, dann erscheint beim Feld eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen „0“ bzw. „100“, wenn gespeichert wird, dann werden die Grenzwerte akzeptiert

### Auswahl der Bezeichnung
- [ ] Angenommen eine Zusatzposition, wenn der Inhaber das Bezeichnungsfeld öffnet, dann sieht er eine sichtbare Auswahl mit genau „Reinigung“ und „Nächtigungsabgabe“
- [ ] Angenommen der Inhaber wählt „Reinigung“, wenn die Auswahl übernommen wird, dann ist die Bezeichnung „Reinigung“ und der Satz „10,00“
- [ ] Angenommen der Inhaber wählt „Nächtigungsabgabe“, wenn die Auswahl übernommen wird, dann ist der Satz „0,00“
- [ ] Angenommen eine Position mit von Hand gesetztem Satz „13,00“, wenn der Inhaber danach „Reinigung“ aus der Auswahl wählt, dann wird der Satz auf „10,00“ gesetzt
- [ ] Angenommen eine Position mit Satz „10,00“, wenn der Inhaber die Bezeichnung frei abändert (z. B. „Reinigung Extra“), dann bleibt der Satz „10,00“
- [ ] Angenommen der Inhaber tippt eine eigene Bezeichnung (z. B. „Parkplatz“), wenn er speichert, dann wird sie mit dem eingetragenen Satz gespeichert (vorgeschlagen 20,00)
- [ ] Angenommen die Auswahl, wenn sie mit der Tastatur bedient wird, dann lassen sich die Einträge mit Pfeiltasten wählen und mit Enter übernehmen; freie Eingabe bleibt möglich

### Stornogebühr
- [ ] Angenommen der Inhaber storniert eine Buchung mit Stornogebühr, wenn das Stornoformular erscheint, dann gibt es beim Betrag ein Feld „USt %“ mit „0,00“
- [ ] Angenommen eine stornierte Buchung, wenn das Detail angezeigt wird, dann zählt für die Steueraufstellung nur die Stornogebühr mit ihrem Satz

### Anzeige im Buchungs-Detail
- [ ] Angenommen eine Buchung mit Sätzen, wenn ein Inhaber das Detail öffnet, dann steht bei jeder Position der Satz neben der Bezeichnung (z. B. „Reinigung · 10 %“, „Übernachtung · 10 %“); Nachkommastellen nur, wenn nicht null (z. B. „5,5 %“)
- [ ] Angenommen Übernachtung € 300,00 (10 %), Reinigung € 60,00 (10 %), Parkplatz € 30,00 (20 %), Nächtigungsabgabe € 12,00 (0 %), wenn das Detail angezeigt wird, dann steht unter dem Endbetrag „darin enthaltene USt“ mit „10 %: € 32,73“ und „20 %: € 5,00“ und keine Zeile für 0 %
- [ ] Angenommen ein Satz kommt in mehreren Positionen vor, wenn die Steuer berechnet wird, dann werden die Bruttobeträge je Satz zuerst addiert und die Steuer (Brutto × Satz / (100 + Satz)) erst danach auf den Cent gerundet
- [ ] Angenommen eine negative Position (z. B. Rabatt -€ 50,00 mit 10 %), wenn die Steuer berechnet wird, dann mindert sie die Summe des Satzes 10 %
- [ ] Angenommen die Summe eines Satzes ist negativ, wenn sie angezeigt wird, dann erscheint der Steuerbetrag wie andere negative Beträge mit Minus in Rot (PROJ-32)
- [ ] Angenommen eine vorgezogene Abreise (PROJ-30), wenn die Steuer berechnet wird, dann gilt der abgerechnete anteilige Übernachtungspreis
- [ ] Angenommen alle Positionen haben 0 %, wenn das Detail angezeigt wird, dann entfällt die Aufstellung „darin enthaltene USt“

### Bestehende Buchungen
- [ ] Angenommen eine Buchung aus der Zeit vor PROJ-35, wenn die Umstellung erfolgt, dann erhält der Übernachtungspreis 10,00 %, Positionen „Reinigung“ 10,00 %, „Nächtigungsabgabe“ 0,00 %, alle übrigen Positionen 20,00 % und eine Stornogebühr 0,00 %
- [ ] Angenommen eine Position heißt „ reinigung “ oder „REINIGUNG“, wenn die Umstellung erfolgt, dann erhält sie 10,00 % (Vergleich ohne Groß-/Kleinschreibung und Rand-Leerzeichen)
- [ ] Angenommen die Umstellung ist erfolgt, wenn Beträge und Endbeträge angezeigt werden, dann sind sie unverändert

### Rollen und Zusammenspiel
- [ ] Angenommen ein Mitarbeiter, wenn er Buchungsformular oder Detail sieht, dann sieht er weder Sätze noch Steuerbeträge
- [ ] Angenommen ein Mitarbeiter bearbeitet eine Buchung, wenn er speichert, dann bleiben alle Sätze unverändert
- [ ] Angenommen ein Inhaber verschiebt eine Position (PROJ-34), wenn er speichert, dann behält die Position ihren Satz
- [ ] Angenommen jemand umgeht die Prüfung im Browser, wenn ein Satz außerhalb 0–100 oder mit mehr als zwei Nachkommastellen gesendet wird, dann lehnt die Datenbank ihn ab

## Edge Cases
- **Komma oder Punkt:** „10,5“ und „10.5“ werden beide als 10,50 verstanden (wie bei Beträgen, PROJ-31)
- **Prozentzeichen eingetippt** („10 %“): wird toleriert und entfernt
- **Bezeichnung aus der Auswahl, dann Satz von Hand geändert:** der Hand-Satz bleibt, bis erneut ein Auswahl-Eintrag gewählt wird
- **Position ohne Betrag oder 0 €:** braucht trotzdem einen gültigen Satz; trägt 0 € zur Steuer bei
- **Sehr viele Positionen (20) mit unterschiedlichen Sätzen:** Aufstellung zeigt eine Zeile je Satz, aufsteigend sortiert
- **Rundung:** Rundung kaufmännisch auf den Cent je Satz; Summe der Steuerzeilen kann sich um Cents von der Summe gerundeter Einzelsteuern unterscheiden (gewollt, wie auf Rechnungen)
- **Stornierte Buchung ohne Stornogebühr:** keine Aufstellung
- **Option (unbestätigte Buchung):** Sätze werden wie bei Buchungen erfasst und angezeigt
- **Sperren:** haben keine Preise, daher keine Sätze
- **Schmaler Bildschirm (375 px):** Griff (PROJ-34), Bezeichnung, Betrag, Satz und Löschen-Knopf bleiben ohne seitliches Scrollen bedienbar (bei Bedarf zweizeilig)

## Technical Requirements (optional)
- Satz mit zwei Nachkommastellen exakt speichern (keine Rundungsfehler durch Kommazahlen)
- Prüfregeln (0–100, zwei Nachkommastellen) in Browser und Datenbank
- Steuerberechnung an einer Stelle, damit Detail und späteres Rechnungsmodul gleich rechnen
- Barrierefreiheit: Auswahl der Bezeichnung als zugängliches Kombinationsfeld (Tastatur, Screenreader), WCAG 2.1 AA
- Rollenregeln aus PROJ-8 unverändert (Sätze nur für Inhaber)

## Open Questions
- [ ] Fachliche Prüfung der Vorbelegungen (10 % Übernachtung/Reinigung, 0 % Nächtigungsabgabe/Stornogebühr, 20 % sonstige) durch den Nutzer bzw. Steuerberatung
- [ ] Einstellung „keine Umsatzsteuer“ (Kleinunternehmer) samt Pflichthinweis: Klärung im Spec des Rechnungsmoduls
- [ ] Soll die Auswahl der Bezeichnungen später je Kunde pflegbar sein? Klärung bei Bedarf (eigenes Feature)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Satz für Übernachtungspreis, jede Zusatzposition und Stornogebühr | Jede Rechnungszeile braucht einen Satz, auch Storno-Rechnungen | 2026-10-29 |
| Preise bleiben brutto; Steuer wird herausgerechnet | Wunsch des Nutzers; Gäste kennen Bruttopreise | 2026-10-29 |
| Satz in Prozent mit zwei Nachkommastellen, 0,00–100,00 | Vorgabe des Nutzers; deckt Sondersätze ab | 2026-10-29 |
| Vorbelegung: Übernachtung 10 %, freie Position 20 %, Stornogebühr 0 % | Beherbergung ermäßigt; sonstige Leistungen Normalsatz; Storno oft Schadenersatz – alles überschreibbar | 2026-10-29 |
| Sichtbare Auswahl nur mit „Reinigung“ (10 %) und „Nächtigungsabgabe“ (0 %); bisherige Vorschläge Haustier, Frühstück, Parkplatz, Rabatt entfallen | Vorgabe des Nutzers; nur Einträge mit bewusst festgelegtem Satz in der Liste | 2026-10-29 |
| Auswahl-Eintrag setzt den Satz immer; freies Tippen ändert einen gesetzten Satz nie | Vorhersehbar; kein unbemerktes Überschreiben | 2026-10-29 |
| Keine Kleinunternehmer-Einstellung in PROJ-35 | Gehört mit Pflichthinweis ins Rechnungsmodul; noch keine Rechnungen | 2026-10-29 |
| Bestehende Buchungen nach denselben Regeln umstellen | Keine Nacharbeit; vor dem Rechnungsmodul unkritisch korrigierbar | 2026-10-29 |
| Detail zeigt Satz je Position und „darin enthaltene USt“ je Satz (ohne 0 %) | Vorschau auf die Rechnung; Sätze vorab prüfbar | 2026-10-29 |
| Steuer je Satz: erst Brutto summieren, dann runden | Übliche Rechnungslogik; vermeidet Rundungsdifferenzen je Zeile | 2026-10-29 |
| Nur Inhaber sehen und ändern Sätze | Mitarbeiter sehen keine Preise (PROJ-8) | 2026-10-29 |

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
