# PROJ-35: Umsatzsteuersatz je Position

## Status: Planned
**Created:** 2026-10-29
**Last Updated:** 2026-10-29

## Dependencies
- Requires: PROJ-8 (Manuelle Buchungen) — Übernachtungspreis, Zusatzkosten, Stornogebühr, Rollenregeln für Preise
- Requires: PROJ-32 (Negative Beträge bei Zusatzkosten) — negative Positionen, Bezeichnungs-Vorschläge
- Requires: PROJ-34 (Preispositionen ordnen) — gleiche Formularzeile; der Satz wandert mit seiner Position
- Requires: PROJ-36 (Kleinunternehmer-Status) — Regel, ob für eine Buchung „Kleinunternehmer“ gilt
- Vorbereitung für: Rechnungsmodul (Ausweis der Umsatzsteuer je Satz)

## Überblick
Preise werden weiterhin **brutto** erfasst. Neu bekommt jeder Betrag einer Buchung – Übernachtungspreis, jede Zusatzposition und die Stornogebühr – einen Umsatzsteuersatz in Prozent mit zwei Nachkommastellen. Sinnvolle Sätze werden vorbelegt und sind je Position überschreibbar. Das Bezeichnungsfeld der Zusatzkosten bekommt eine sichtbare Auswahl mit „Reinigung“ (10 %) und „Nächtigungsabgabe“ (0 %); frei eingetippte Positionen starten mit 20 %. Das Buchungs-Detail zeigt den Satz je Position und darunter die darin enthaltene Umsatzsteuer je Satz.

Gilt für eine Buchung laut PROJ-36 „Kleinunternehmer – keine Umsatzsteuer“, sind alle USt-Angaben ausgeblendet: keine Felder „USt %“, keine Sätze im Detail, keine Aufstellung. Stattdessen steht unter dem Endbetrag „Keine Umsatzsteuer (Kleinunternehmer)“. Im Hintergrund werden die Sätze trotzdem mit denselben Vorbelegungen gespeichert, damit ein späterer Wechsel zur Regelbesteuerung keine Nacharbeit erfordert.

## User Stories
- Als **Inhaber** möchte ich jeder Position einer Buchung einen Umsatzsteuersatz zuordnen, damit die Rechnung später die Steuer je Satz richtig ausweist.
- Als **Inhaber** möchte ich häufige Positionen („Reinigung“, „Nächtigungsabgabe“) aus einer Liste wählen, damit Bezeichnung und Satz ohne Tippen stimmen.
- Als **Inhaber** möchte ich weiterhin eigene Positionen frei eintragen und deren vorgeschlagenen Satz (20 %) bei Bedarf ändern.
- Als **Inhaber** möchte ich im Buchungs-Detail sehen, wie viel Umsatzsteuer je Satz im Endbetrag steckt, damit ich die Sätze vor der Rechnungsstellung prüfen kann.
- Als **Inhaber** möchte ich auch der Stornogebühr einen Satz geben, damit eine Storno-Rechnung korrekt ist.
- Als **Inhaber** möchte ich, dass meine bestehenden Buchungen automatisch sinnvolle Sätze erhalten, damit ich nicht jede einzeln nachpflegen muss.
- Als **Inhaber, der Kleinunternehmer ist,** möchte ich keine Steuerfelder und keine Steuerbeträge sehen, damit die App mir keine Umsatzsteuer vorrechnet, die ich nicht schulde.

## Out of Scope
- Netto-Erfassung von Preisen (Preise bleiben brutto)
- Erfassung des Kleinunternehmer-Status samt Verlauf und Regel je Buchung (PROJ-36)
- Pflichthinweis „Kleinunternehmer“ auf Rechnungen (Rechnungsmodul)
- Sätze bei Kleinunternehmern von Hand einsehen oder ändern (erst nach Wechsel zur Regelbesteuerung sichtbar)
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

### Kleinunternehmer (PROJ-36)
- [ ] Angenommen für die Buchung gilt „Kleinunternehmer“, wenn ein Inhaber das Buchungsformular öffnet, dann gibt es weder beim Übernachtungspreis noch bei den Zusatzpositionen ein Feld „USt %“
- [ ] Angenommen für die Buchung gilt „Kleinunternehmer“, wenn ein Inhaber das Detail öffnet, dann stehen bei den Positionen keine Sätze, die Aufstellung „darin enthaltene USt“ entfällt und unter dem Endbetrag steht „Keine Umsatzsteuer (Kleinunternehmer)“
- [ ] Angenommen ein Kleinunternehmer legt eine Buchung an, wenn er speichert, dann werden die Sätze mit den Vorbelegungen gespeichert (Übernachtung 10,00, „Reinigung“ aus der Auswahl 10,00, „Nächtigungsabgabe“ 0,00, sonstige 20,00)
- [ ] Angenommen ein Kleinunternehmer bearbeitet eine bestehende Buchung, wenn er speichert, dann bleiben die gespeicherten Sätze bestehender Positionen unverändert und neue Positionen erhalten die Vorbelegung
- [ ] Angenommen ein Inhaber ändert im Formular die Abreise so, dass sie auf die andere Seite eines Stichtags fällt, wenn das Datum übernommen wird, dann erscheinen bzw. verschwinden die Felder „USt %“ sofort; bereits eingetragene Sätze bleiben erhalten
- [ ] Angenommen am heutigen Tag gilt „Kleinunternehmer“, wenn der Inhaber eine Buchung storniert, dann hat das Stornoformular kein Feld „USt %“ und die Stornogebühr wird mit 0,00 gespeichert
- [ ] Angenommen eine stornierte Buchung, wenn das Detail angezeigt wird, dann entscheidet das Stornodatum, ob Sätze und Aufstellung oder der Kleinunternehmer-Hinweis erscheinen
- [ ] Angenommen der Status-Verlauf wird geändert (PROJ-36), wenn danach eine betroffene Buchung angezeigt wird, dann richtet sich die Anzeige nach dem neuen Verlauf; gespeicherte Sätze und Beträge bleiben unverändert
- [ ] Angenommen ein Kunde wechselt zur Regelbesteuerung, wenn eine Buchung nach dem Stichtag angezeigt wird, die vorher als Kleinunternehmer-Buchung angelegt wurde, dann erscheinen die im Hintergrund gespeicherten Sätze samt Aufstellung
- [ ] Angenommen ein Mitarbeiter, wenn er Formular oder Detail einer Kleinunternehmer-Buchung sieht, dann sieht er auch den Kleinunternehmer-Hinweis nicht (keine Preise, PROJ-8)

### Bestehende Buchungen
- [ ] Angenommen eine Buchung aus der Zeit vor PROJ-35 (unabhängig vom Kleinunternehmer-Status), wenn die Umstellung erfolgt, dann erhält der Übernachtungspreis 10,00 %, Positionen „Reinigung“ 10,00 %, „Nächtigungsabgabe“ 0,00 %, alle übrigen Positionen 20,00 % und eine Stornogebühr 0,00 %
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
- **Kleinunternehmer, Abreise noch nicht eingegeben** (neues Formular): bis eine Abreise feststeht, richtet sich die Anzeige nach dem heutigen Status
- **Kleinunternehmer mit „Nächtigungsabgabe“:** Auswahl setzt im Hintergrund 0,00 wie sonst auch
- **Schmaler Bildschirm (375 px):** Griff (PROJ-34), Bezeichnung, Betrag, Satz und Löschen-Knopf bleiben ohne seitliches Scrollen bedienbar (bei Bedarf zweizeilig)

## Technical Requirements (optional)
- Satz mit zwei Nachkommastellen exakt speichern (keine Rundungsfehler durch Kommazahlen)
- Prüfregeln (0–100, zwei Nachkommastellen) in Browser und Datenbank
- Steuerberechnung an einer Stelle, damit Detail und späteres Rechnungsmodul gleich rechnen
- Ob USt-Angaben angezeigt werden, entscheidet ausschließlich die Regel aus PROJ-36
- Barrierefreiheit: Auswahl der Bezeichnung als zugängliches Kombinationsfeld (Tastatur, Screenreader), WCAG 2.1 AA
- Rollenregeln aus PROJ-8 unverändert (Sätze nur für Inhaber)

## Open Questions
- [ ] Fachliche Prüfung der Vorbelegungen (10 % Übernachtung/Reinigung, 0 % Nächtigungsabgabe/Stornogebühr, 20 % sonstige) durch den Nutzer bzw. Steuerberatung
- [x] Einstellung „keine Umsatzsteuer“ (Kleinunternehmer) samt Pflichthinweis → Status mit Verlauf in PROJ-36; PROJ-35 blendet USt-Angaben aus; Pflichthinweis auf Rechnungen bleibt beim Rechnungsmodul (2026-10-29)
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
| ~~Keine Kleinunternehmer-Einstellung in PROJ-35~~ (überholt, siehe unten) | Gehört mit Pflichthinweis ins Rechnungsmodul; noch keine Rechnungen | 2026-10-29 |
| Bestehende Buchungen nach denselben Regeln umstellen | Keine Nacharbeit; vor dem Rechnungsmodul unkritisch korrigierbar | 2026-10-29 |
| Detail zeigt Satz je Position und „darin enthaltene USt“ je Satz (ohne 0 %) | Vorschau auf die Rechnung; Sätze vorab prüfbar | 2026-10-29 |
| Steuer je Satz: erst Brutto summieren, dann runden | Übliche Rechnungslogik; vermeidet Rundungsdifferenzen je Zeile | 2026-10-29 |
| Nur Inhaber sehen und ändern Sätze | Mitarbeiter sehen keine Preise (PROJ-8) | 2026-10-29 |
| Kleinunternehmer doch vor dem Rechnungsmodul berücksichtigen; Status als eigenes Feature PROJ-36, das vor PROJ-35 gebaut wird | Viele Zielkunden sind Kleinunternehmer; ohne Einstellung zeigt PROJ-35 ihnen eine Steuer, die sie nicht schulden | 2026-10-29 |
| Bei Kleinunternehmern USt-Angaben ausblenden, Sätze aber still mit Vorbelegung speichern | Saubere Oberfläche; Wechsel zur Regelbesteuerung ohne Nacharbeit | 2026-10-29 |
| Kurzer Hinweis „Keine Umsatzsteuer (Kleinunternehmer)“ im Detail | Inhaber erkennt, dass die Einstellung greift, statt einen Fehler zu vermuten | 2026-10-29 |
| Stornogebühr bei Kleinunternehmern mit 0,00 speichern | Vorbelegung der Stornogebühr ist ohnehin 0,00; kein Unterschied | 2026-10-29 |

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
