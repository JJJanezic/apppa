# PROJ-40: Rechnungsdaten sammeln (Entwurf)

## Status: In Progress
**Created:** 2026-10-31
**Last Updated:** 2026-11-06

> Grundumfang in Produktion. Geplant (refine 2026-11-06): neue Schreibweise im Leistungsblock (Abschnitt „Leistungen: Schreibweise der USt“).

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): nur Inhaber erstellen, Mitarbeiter sehen, Mandantentrennung
- Requires: PROJ-7, PROJ-29, PROJ-33 (Gäste): Name mit Titeln, Geschlecht für {Anrede}, Wohnadresse, Firmenname, Firmenanschrift, UID
- Requires: PROJ-8, PROJ-30 (Buchungen): Buchungsdetail, Positionen, Optionen, Stornierung mit Stornogebühr, Mitreisende, Zeitraum
- Requires: PROJ-28, PROJ-38 (Stammdaten): Aussteller (Name, Anschrift, UID), Ort für Block 2b
- Requires: PROJ-32, PROJ-34, PROJ-35 (Positionen): negative Beträge, Reihenfolge, USt-Satz je Position, enthaltene USt je Satz
- Requires: PROJ-36 (Kleinunternehmer-Status): Regel je Buchung (Abreise bzw. Stornodatum)
- Requires: PROJ-37 (Rechnungen nacherfassen): Rechnungsliste, Rechnungsdetail, Abschnitt „Rechnungen“ im Buchungsdetail, Spalte und Filter in der Buchungsübersicht, gleiches Datenmodell mit Feld „Herkunft“
- Requires: PROJ-39 (Einstellungen → Rechnungen): Bausteine der Blöcke 4/6/7 mit Standard, Zahlungsregeln, Platzhalter samt Liste und Ersetzungsregel, Kleinunternehmer-Hinweis, Fußzeile
- Wird genutzt von: PROJ-41 (Ausstellen mit PDF): Entwurf → Nummer, Festschreiben, PDF; PROJ-42 (Übersicht ausbauen)

## Überblick
Drittes Paket der Gliederung des Rechnungsmoduls (PROJ-38 bis PROJ-42). Der Inhaber stellt aus einer Buchung einen **Rechnungsentwurf** zusammen. Der Entwurf wird **ohne Nummer** gespeichert, kann später weiterbearbeitet, angesehen (Vorschau) oder gelöscht werden. Eine Nummer wird nie reserviert; Nummer, Festschreiben und PDF kommen erst mit PROJ-41.

### Einstieg
- Knopf **„Rechnung“** auf der Buchungsdetailseite rechts außen, in einer Reihe mit „Bearbeiten“, „Mitreisende bearbeiten“, „Stornieren“. Nur für Inhaber.
- Aktiv, solange **Verrechnet + In Entwürfen < Gesamtpreis** der Buchung (bei stornierten Buchungen: < Stornogebühr). Sonst inaktiv mit Begründung (z. B. „Bereits vollständig verrechnet oder in Entwürfen“).
- **Buchungsarten:** Buchungen; Optionen (mit Hinweis „Buchung ist noch eine Option“); stornierte Buchungen nur mit Stornogebühr. Bei Sperren kein Knopf.
- Der Knopf öffnet die eigene Seite **„Rechnung erstellen“**. „Entwurf speichern“ führt zur Detailseite des Entwurfs, „Abbrechen“ zurück zur Buchung. Beim Verlassen mit ungespeicherten Änderungen erscheint eine Rückfrage.

### Arten
| Art | Inhalt | Rechnungsbetrag |
|---|---|---|
| **Rechnung** | Positionen aus der Buchung (Teilung nach Positionen) | Summe der Positionen |
| **Teilrechnung** | eine Zeile „Anzahlung für Aufenthalt in {Wohnung} vom {Anreise} bis {Abreise}“ über einen Prozentsatz oder Eurobetrag | der Teilbetrag |
| **Schlussrechnung** | alle noch nicht verrechneten Positionen in voller Höhe, darunter Abzüge früherer Teil-/Anzahlungsrechnungen | Summe der Positionen minus Abzüge |

Die Art ist im Entwurf änderbar. Die Anzahlung als Zahlungsbedingung innerhalb einer Rechnung (Block 6, PROJ-39) ist davon unabhängig.

### Positionen (Art Rechnung und Schlussrechnung)
- Übernommen werden Übernachtung, Zusatzkosten und ggf. Stornogebühr der Buchung mit Bezeichnung, Betrag brutto und USt-Satz in der Reihenfolge aus PROJ-34; bei stornierten Buchungen nur die Stornogebühr.
- Wie beim Nacherfassen: abwählen, Bezeichnung/Betrag/Satz ändern, eigene Positionen hinzufügen, Reihenfolge ändern. Höchstens 50 Positionen.
- Die Positionen sind eine **Kopie**. Die App merkt sich, aus welcher Buchungsposition eine Rechnungsposition stammt.
- **Vorauswahl:** Nur Buchungspositionen, die noch in keiner anderen Rechnung (Art Rechnung oder Schlussrechnung, Entwurf oder ausgestellt) dieser Buchung stehen, sind angewählt. Die übrigen sind abgewählt mit Hinweis „bereits in Rechnung 2026-0012“ bzw. „in Entwurf vom …“ und können trotzdem angewählt werden.
- Teilrechnungen „verbrauchen“ keine Positionen. Nacherfasste Rechnungen (PROJ-37) haben keine Verbindung zu Buchungspositionen und zählen für die Vorauswahl nicht; für sie gilt nur die Summe.

### Teilrechnung
- Eingabe **Prozent** (vom Gesamtpreis der Buchung, bis 2 Nachkommastellen) **oder Betrag** (Euro); das jeweils andere wird angezeigt.
- Die enthaltene USt wird **anteilig nach den USt-Sätzen der Buchungspositionen** aufgeteilt (auf Cent gerundet, Rundungsrest beim größten Anteil). Die Teilrechnung zeigt je Satz eine Zeile.
- Teilbetrag größer als 0. Übersteigt er mit Verrechnet + Entwürfen den Gesamtpreis: Hinweis, keine Sperre.

### Schlussrechnung: Abzüge
- Die Schlussrechnung listet andere Rechnungen dieser Buchung zum Abzug: Nummer bzw. „Entwurf“, Datum, Betrag, USt je Satz.
- **Teilrechnungen** aus der App (Entwurf oder ausgestellt) sind vorausgewählt. **Nacherfasste** Rechnungen der Buchung erscheinen abgewählt und sind anwählbar (z. B. Anzahlungsrechnung aus dem Altsystem). Andere Rechnungen (Art Rechnung) erscheinen nicht.
- Abgezogen wird je gewählter Rechnung ihr Betrag mit ihrer USt je Satz („abzüglich Teilrechnung 2026-0012 vom 03.10.2026“).
- Rechnungsbetrag 0 oder negativ (Anzahlung höher als Leistung) ist möglich, mit Hinweis.
- Ausstellen einer Schlussrechnung, die einen Teilrechnungs-Entwurf abzieht, ist erst nach dem Ausstellen dieser Teilrechnung möglich (Regel für PROJ-41).

### Empfänger (Block 1)
- Wahl **„Gast“** oder **„Firma“** des Hauptgasts. Hat der Gast eine Firma, ist „Firma“ vorausgewählt, sonst „Gast“; ohne Firma ist „Firma“ nicht wählbar.
- Gast: Name mit Titeln, Wohnadresse (Straße, PLZ, Ort, Staat). Firma: Firmenname, Rechnungsanschrift (PROJ-33), UID.
- Die Daten sind eine **Kopie** im Entwurf, alle Felder überschreibbar (so entsteht auch ein anderer Empfänger, z. B. ein Reisebüro). Spätere Änderungen am Gast wirken nicht. Ein Wechsel Gast/Firma belegt die Felder nach Rückfrage neu.

### Rechnungsdatum (Block 2b)
- Frei wählbar, vorbelegt mit heute, wird mit dem Entwurf gespeichert und beim Ausstellen (PROJ-41) übernommen.
- Liegt es in der Vergangenheit, erscheint ein Hinweis (keine Sperre). Prüfungen gegen die Nummernfolge folgen in PROJ-41.

### Gastnamen (Block 3)
Wahl je Rechnung: **„keine Gastnamen“** (immer vorausgewählt), „Hauptgast“, „Hauptgast mit Mitreisenden“. Namen mit Titeln, Mitreisende in der Reihenfolge der Buchung. Die Namen kommen immer aktuell aus der Buchung.

### Textblöcke (Blöcke 4, 6, 7)
- Je Block Auswahl eines Bausteins aus PROJ-39; der Standard ist vorausgewählt, ohne Standard beginnt der Block leer. „Kein Text“ ist wählbar.
- Der Text wird als **Kopie** übernommen und ist für diese Rechnung mit demselben beschränkten Editor änderbar (gleiche Platzhalter-Liste, gleiche Zulässigkeit je Block, unbekannte Platzhalter verhindern das Speichern). Ein anderer Baustein ersetzt den Text nach Rückfrage, wenn er geändert wurde.
- Spätere Änderungen an Bausteinen in den Einstellungen wirken nicht auf bestehende Entwürfe.
- Platzhalter bleiben im Entwurf als Platzhalter stehen und werden in der Vorschau mit den aktuellen Werten ersetzt; {Rechnungsnummer} ergibt „Entwurf“.
- **{Anrede} bei Firma als Empfänger:** im Entwurf wählbar „Sehr geehrte Damen und Herren“ (vorausgewählt) oder „Anrede des Hauptgasts“. Beim Gast als Empfänger gilt die Regel aus PROJ-39.
- {Betrag} ist der Rechnungsbetrag (bei der Schlussrechnung nach Abzügen).

### Zahlungsregeln (Block 6)
- Der gewählte Baustein setzt Anzahlung ja/nein, Prozent, Frist und Fälligkeit (Bezug „nach Rechnungsdatum“ oder „vor Anreise“, Tage); alle Werte sind je Rechnung änderbar, Grenzen wie PROJ-39.
- **Ohne Baustein:** Felder trotzdem vorhanden; Voreinstellung ohne Anzahlung, fällig 0 Tage nach Rechnungsdatum (sofort).
- **Rückfallregel:** Liegt eine berechnete Frist (Fälligkeit oder Anzahlung fällig) vor dem Rechnungsdatum, wird sie auf das Rechnungsdatum gesetzt; Hinweis „Fälligkeit liegt vor dem Rechnungsdatum, sofort fällig gesetzt“. „Anzahlung fällig“ liegt nie nach der Fälligkeit des Rests; sonst wird sie auf diese gesetzt, mit Hinweis.
- Die Fälligkeitsdaten werden aus Regel und Rechnungsdatum berechnet und angezeigt.

### Leistungen, USt und Kleinunternehmer (Block 5)
- Summe und enthaltene USt je Satz wie PROJ-35.
- **Kleinunternehmer-Status nach der Buchung** (PROJ-36: Abreise, bei stornierten Buchungen Stornodatum), für alle Rechnungen einer Buchung gleich. Im Entwurf bei jedem Öffnen neu ermittelt, festgehalten erst beim Ausstellen (PROJ-41). Bei Kleinunternehmer: keine USt-Ausweisung, Kleinunternehmer-Hinweis aus PROJ-39 nach Block 5 (nicht änderbar).
- **Nacherfasste Rechnungen (PROJ-37) bleiben unberührt:** Sie wurden bereits außerhalb der App ausgestellt; erfasst werden nur ihre Daten und das vorhandene PDF. Die Regel gilt nur für Rechnungen, die in der App entstehen.

### Leistungen: Schreibweise der USt (refine 2026-11-06)
Gilt für alle in der App erzeugten Rechnungen: Entwurfsvorschau, Musterrechnung im Briefpapier (PROJ-41) und ausgestellte PDFs (PROJ-42). Bereits ausgestellte PDFs bleiben unverändert.

| Stelle | Bisher | Neu |
|---|---|---|
| Leistungszeile | „Übernachtung · 10 %“ | „Übernachtung · (inkl. 10 % USt.)“ |
| Leistungszeile mit 0 % | „Nächtigungsabgabe · 0 %“ | „Nächtigungsabgabe · (inkl. 0 % USt.)“ |
| Teilrechnung, Anteil je Satz | „Anteil 10 %“ | „Anteil (inkl. 10 % USt.)“ |
| Summe der Leistungen (Schlussrechnung mit Abzug) | „Summe der Leistungen“ | „Summe der Leistungen (inkl. USt.)“ |
| Rechnungsbetrag | „Rechnungsbetrag“ | „Rechnungsbetrag (inkl. USt.)“ |
| USt-Tabelle, links | „10 %“ | „10 % aus € 409,09“ |

- **Betrag in der USt-Tabelle:** Summe der Nettobeträge zum Satz, also Bruttosumme des Satzes minus der darin enthaltenen USt. Bei der Schlussrechnung gilt der Betrag nach Abzug der Teilrechnungen, wie die USt in derselben Zeile. Format wie alle Beträge („€ 1.234,56“).
- **Ohne Zusatz bei den Summen:** Bei Kleinunternehmer-Rechnungen und bei Rechnungen ohne jede Position mit mehr als 0 % stehen „Summe der Leistungen“ und „Rechnungsbetrag“ ohne „(inkl. USt.)“. Leistungszeilen bei Kleinunternehmern bleiben ohne Satz wie bisher; 0-%-Zeilen ohne Kleinunternehmer erhalten „(inkl. 0 % USt.)“.
- **Unverändert:** Überschrift „Darin enthaltene Umsatzsteuer“, Abzugszeilen samt „darin USt 10 % € …“, Beträge rechts, Anordnung. Die Anzeige im Buchungsdetail („Endreinigung · 10 %“) ist keine Rechnung und bleibt.

### Pflichtangaben-Prüfung
Im Entwurf und in der Vorschau sichtbare Liste „Pflichtangaben“ mit ✓ bzw. Fehlertext und Link zum Feld. Speichern ist bei Fehlern möglich, Ausstellen (PROJ-41) nicht. Die Rechnungsnummer fehlt im Entwurf immer und gilt nicht als Fehler.

| Angabe | Pflicht |
|---|---|
| Aussteller: Name und Anschrift (Stammdaten) | immer |
| Rechnungsdatum | immer |
| Zeitraum des Aufenthalts | immer (aus der Buchung) |
| Mindestens eine Position bzw. Teilbetrag > 0 | immer |
| Beträge und USt je Satz (bzw. Kleinunternehmer-Hinweis) | immer (berechnet) |
| Empfänger: Name und Anschrift (Adresse, PLZ, Ort, Staat) | ab € 400 brutto Rechnungsbetrag |
| UID des Ausstellers | ab € 400 brutto, wenn kein Kleinunternehmer-Status |
| UID des Empfängers | ab € 10.000 brutto |

### Vorschau
- Knopf **„Vorschau“** im Formular und auf der Detailseite öffnet eine eigene Ansicht in Seitenform; „Zurück zum Entwurf“ ohne Datenverlust (auch mit ungespeicherten Änderungen).
- Reihenfolge wie PROJ-39: Kopfzeile (Aussteller), Block 1, 2a, 2b, 2c („Entwurf“), 3, 4, 5, Kleinunternehmer-Hinweis, 6, 7, Fußzeile. Platzhalter ersetzt. Deutlich als „Entwurf“ gekennzeichnet.
- **Alle Datumsangaben auf der Rechnung ohne Wochentag** („14.10.2026“), auch in Block 2a/2b; Beträge wie PROJ-31.
- Schlicht gestaltet; Logo, Schriftart und Anordnung folgen mit dem PDF (PROJ-41). Lesbar ab 375 px.

### Entwurf ansehen, bearbeiten, löschen
- **Detailseite des Entwurfs:** Status „Entwurf“, Art, Empfänger, Rechnungsdatum, Positionen bzw. Teilbetrag/Abzüge, Summen, Pflichtangaben-Liste; Knöpfe „Bearbeiten“, „Vorschau“, „Löschen“ (mit Bestätigung).
- **Buchung geändert:** Wurden Preis, Positionen, Stornostatus oder Hauptgast der Buchung nach dem letzten Speichern des Entwurfs geändert, zeigen Detailseite und Formular „Die Buchung wurde seit dem Entwurf geändert“ mit dem Knopf „Positionen neu übernehmen“ (ersetzt nach Rückfrage die Positionen; Vorauswahl wie beim Anlegen). Ohne Klick bleibt der Entwurf unverändert. Zeitraum, Wohnung und Gastnamen sind immer aktuell.
- **Rechnungsliste** (PROJ-37): Entwürfe erscheinen mit Nummer „–“, Datum = Rechnungsdatum des Entwurfs, Status „Entwurf“ und Art (bei Teil-/Schlussrechnung).
- **Buchungsdetail:** Abschnitt „Rechnungen“ listet Entwürfe mit Status „Entwurf“; unter „Verrechnet: € …“ (nur nacherfasst und ausgestellt) steht „In Entwürfen: € …“.
- **Buchungsübersicht** (Spalte „Rechnungen“): Entwürfe erscheinen als „Entwurf“ (Link zur Detailseite). Beim Filter „ohne/mit Rechnung“ zählen Entwürfe **nicht** als Rechnung.

### Wer darf was
| Aktion | Inhaber | Mitarbeiter | Betreiber |
|---|---|---|---|
| Knopf „Rechnung“, Entwurf anlegen, bearbeiten, löschen | ✓ | – | – |
| Entwurf in Liste, Detail und Buchungsdetail sehen, Vorschau | ✓ | ✓ | – |

## User Stories
- Als **Inhaber** möchte ich aus einer Buchung mit einem Klick einen Rechnungsentwurf mit allen Positionen, Texten und Zahlungsbedingungen erhalten, damit ich eine Rechnung nicht mehr von Hand zusammenstellen muss.
- Als **Inhaber** möchte ich Übernachtung und Zusatzkosten auf verschiedene Rechnungen aufteilen (z. B. Übernachtung an die Firma, Extras an den Gast), damit jeder Empfänger nur seinen Teil erhält und keine Position doppelt verrechnet wird.
- Als **Inhaber** möchte ich eine Teilrechnung über eine Anzahlung und später eine Schlussrechnung mit Abzug der Anzahlung erstellen, damit die Umsatzsteuer richtig ausgewiesen ist, ohne dass ich sie selbst aufteile.
- Als **Inhaber** möchte ich wählen, ob die Rechnung an den Gast oder seine Firma geht, und die Anschrift für diese Rechnung anpassen, damit auch Dienstreisen und Sonderfälle richtig adressiert sind.
- Als **Inhaber** möchte ich vor dem Ausstellen sehen, ob alle Pflichtangaben vorhanden sind, damit keine fehlerhafte Rechnung hinausgeht.
- Als **Inhaber** möchte ich die Rechnung so sehen, wie sie der Empfänger bekommt, damit Texte, Beträge und Fristen stimmen.
- Als **Inhaber** möchte ich einen Entwurf speichern und später fertigstellen, damit ich Rechnungen in Ruhe vorbereiten kann.
- Als **Mitarbeiter** möchte ich sehen, welche Rechnungen für eine Buchung vorbereitet sind, damit ich bei Fragen des Gastes Auskunft geben kann.

## Out of Scope
- Nummer vergeben, überschreiben, Lückenhinweis, Festschreiben, PDF, Logo/Schriftart/Anordnung auf der Rechnung (PROJ-41)
- Prüfung des Rechnungsdatums gegen die Nummernfolge; Regel „Schlussrechnung erst nach Ausstellen der abgezogenen Teilrechnungen“ (PROJ-41)
- „Rechnung erstellen“ aus der Rechnungsübersicht, Rechnungen ohne Buchung, Jahres-/Betragsfilter (PROJ-42)
- Storno-Prozess, Stornorechnung, Gutschrift (eigenes Teilprojekt)
- Zahlungen erfassen und Fristen überwachen (PROJ-13)
- Versand per E-Mail (PROJ-22); englische Rechnungen (PROJ-23)
- Reverse Charge oder weitere Hinweisblöcke für Firmen
- Mehrere Hauptempfänger oder Aufteilung einer Position auf mehrere Rechnungen nach Anteilen (außer über die Teilrechnung)
- Verbindung nacherfasster Rechnungspositionen mit Buchungspositionen
- Freie Rechnungsempfänger aus der Gäste-Datenbank (anderer Gast als der Hauptgast) als eigene Auswahl
- Zugang des Betreibers zu Entwürfen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Knopf „Rechnung“
- [ ] Angenommen ein Inhaber öffnet eine Buchung ohne Rechnungen, wenn die Seite lädt, dann steht rechts außen neben „Bearbeiten“, „Mitreisende bearbeiten“ und „Stornieren“ der aktive Knopf „Rechnung“
- [ ] Angenommen ein Mitarbeiter öffnet eine Buchung, wenn die Seite lädt, dann gibt es keinen Knopf „Rechnung“
- [ ] Angenommen eine Sperre, wenn der Inhaber sie öffnet, dann gibt es keinen Knopf „Rechnung“
- [ ] Angenommen eine Buchung über € 500 mit einem Entwurf über € 500, wenn der Inhaber die Buchung öffnet, dann ist „Rechnung“ inaktiv und eine Begründung ist sichtbar
- [ ] Angenommen eine Buchung über € 500 mit einer nacherfassten Rechnung über € 200 und einem Entwurf über € 100, wenn der Inhaber die Buchung öffnet, dann ist „Rechnung“ aktiv
- [ ] Angenommen der Inhaber löscht den einzigen Entwurf einer voll verrechneten Buchung, wenn er die Buchung wieder öffnet, dann ist „Rechnung“ wieder aktiv
- [ ] Angenommen eine Option, wenn der Inhaber „Rechnung“ wählt, dann öffnet sich „Rechnung erstellen“ mit dem Hinweis „Buchung ist noch eine Option“
- [ ] Angenommen eine stornierte Buchung ohne Stornogebühr, wenn der Inhaber sie öffnet, dann ist „Rechnung“ inaktiv mit Begründung
- [ ] Angenommen eine stornierte Buchung mit Stornogebühr € 120, wenn der Inhaber „Rechnung“ wählt, dann enthält der Entwurf nur die Stornogebühr, und der Knopf ist inaktiv, sobald € 120 verrechnet oder in Entwürfen sind
- [ ] Angenommen ein Mitarbeiter sendet das Anlegen, Ändern oder Löschen eines Entwurfs direkt an den Server, wenn die Anfrage ankommt, dann wird sie abgelehnt

### Seite „Rechnung erstellen“ und Speichern
- [ ] Angenommen der Inhaber wählt „Rechnung“, wenn die Seite lädt, dann sieht er Art (vorausgewählt „Rechnung“), Empfänger, Rechnungsdatum (heute), Gastnamen („keine Gastnamen“), Positionen, Einleitung, Zahlungsmodalitäten und Abschlusstext
- [ ] Angenommen gültige Angaben, wenn der Inhaber „Entwurf speichern“ wählt, dann landet er auf der Detailseite des Entwurfs mit Status „Entwurf“ und ohne Nummer
- [ ] Angenommen ungespeicherte Änderungen, wenn der Inhaber die Seite verlassen will, dann erscheint eine Rückfrage
- [ ] Angenommen ein Fehler beim Speichern (z. B. Verbindungsabbruch), wenn der Inhaber speichert, dann erscheint eine Fehlermeldung und die Eingaben bleiben erhalten
- [ ] Angenommen zwei Inhaber bearbeiten denselben Entwurf und einer hat gespeichert, wenn der andere speichert, dann erhält er den Hinweis „Der Entwurf wurde inzwischen geändert“ mit „Aktuelle Fassung laden“, und seine Änderung wird nicht gespeichert
- [ ] Angenommen ein Entwurf wird angelegt, geändert oder gelöscht, wenn jemand das Änderungsprotokoll ansieht, dann ist der Vorgang mit Person und Zeitpunkt vermerkt
- [ ] Angenommen die Seite wird am Handy (375 px) geöffnet, wenn der Inhaber einen Entwurf erstellt, dann sind alle Felder, Editoren und Knöpfe ohne seitliches Scrollen bedienbar und mindestens 44 px groß

### Positionen und Teilung nach Positionen
- [ ] Angenommen eine Buchung mit Übernachtung, Reinigung und Rabatt, wenn der Inhaber einen Entwurf (Art Rechnung) beginnt, dann sind alle drei mit Bezeichnung, Betrag und USt-Satz in der Reihenfolge aus PROJ-34 angewählt
- [ ] Angenommen ein Entwurf enthält die Übernachtung, wenn der Inhaber einen zweiten Entwurf beginnt, dann ist die Übernachtung abgewählt mit „in Entwurf vom …“ und die übrigen Positionen sind angewählt
- [ ] Angenommen eine Position ist bereits verrechnet, wenn der Inhaber sie trotzdem anwählt, dann wird sie übernommen
- [ ] Angenommen der Inhaber ändert Betrag oder Satz einer Position oder fügt eine eigene hinzu, wenn er speichert, dann stehen genau diese Werte im Entwurf, und die Buchung bleibt unverändert
- [ ] Angenommen alle Positionen sind abgewählt (Art Rechnung), wenn der Inhaber speichert, dann wird gespeichert und die Pflichtangaben-Liste zeigt „Keine Position“
- [ ] Angenommen eine Teilrechnung zur Buchung, wenn der Inhaber einen Entwurf (Art Rechnung) beginnt, dann gelten alle Positionen als noch nicht verrechnet

### Teilrechnung
- [ ] Angenommen eine Buchung über € 1.000 (Übernachtung € 900 zu 10 %, Reinigung € 100 zu 20 %), wenn der Inhaber eine Teilrechnung mit 20 % erstellt, dann beträgt sie € 200,00 mit € 180,00 zu 10 % und € 20,00 zu 20 % und der enthaltenen USt je Satz
- [ ] Angenommen der Inhaber gibt statt Prozent einen Betrag von € 250,00 ein, wenn der Wert übernommen ist, dann wird der Prozentsatz (25 %) angezeigt
- [ ] Angenommen ein Teilbetrag von 0 oder leer, wenn der Inhaber speichert, dann erscheint eine Fehlermeldung
- [ ] Angenommen Teilbetrag plus Verrechnet und Entwürfe liegt über dem Gesamtpreis, wenn der Betrag eingegeben ist, dann erscheint ein Hinweis, und Speichern bleibt möglich
- [ ] Angenommen die Buchung ist Kleinunternehmer-Buchung, wenn eine Teilrechnung erstellt wird, dann wird keine USt ausgewiesen und der Kleinunternehmer-Hinweis steht nach Block 5

### Schlussrechnung
- [ ] Angenommen eine Buchung über € 1.000 mit einer Teilrechnung über € 200, wenn der Inhaber eine Schlussrechnung beginnt, dann enthält sie alle Positionen in voller Höhe, die Teilrechnung ist zum Abzug vorausgewählt, und der Rechnungsbetrag ist € 800,00
- [ ] Angenommen der Abzug, wenn die Schlussrechnung angezeigt wird, dann steht je Teilrechnung eine Zeile „abzüglich Teilrechnung … vom …“ mit Betrag und USt je Satz
- [ ] Angenommen eine nacherfasste Rechnung zur Buchung, wenn der Inhaber eine Schlussrechnung beginnt, dann erscheint sie abgewählt und kann zum Abzug angewählt werden
- [ ] Angenommen eine Rechnung (Art Rechnung) zur Buchung, wenn der Inhaber eine Schlussrechnung beginnt, dann erscheint sie nicht bei den Abzügen, und ihre Positionen sind abgewählt
- [ ] Angenommen die Abzüge übersteigen die Positionen, wenn die Schlussrechnung berechnet wird, dann ist der Rechnungsbetrag 0 oder negativ (rot, „-€“) mit Hinweis

### Empfänger
- [ ] Angenommen der Hauptgast hat eine Firma, wenn der Entwurf beginnt, dann ist „Firma“ gewählt und Firmenname, Rechnungsanschrift und UID sind eingetragen
- [ ] Angenommen der Hauptgast hat keine Firma, wenn der Entwurf beginnt, dann ist „Gast“ gewählt mit Name samt Titeln und Wohnadresse, und „Firma“ ist nicht wählbar
- [ ] Angenommen der Inhaber überschreibt die Anschrift, wenn er speichert, dann steht die geänderte Anschrift im Entwurf, und der Gast bleibt unverändert
- [ ] Angenommen ein Entwurf ist gespeichert, wenn danach die Firma am Gast geändert wird, dann bleibt der Empfänger im Entwurf unverändert
- [ ] Angenommen der Inhaber wechselt von „Firma“ auf „Gast“ nach eigenen Änderungen, wenn er wechselt, dann erscheint eine Rückfrage, bevor die Felder neu belegt werden

### Rechnungsdatum und Gastnamen
- [ ] Angenommen der Inhaber setzt das Rechnungsdatum auf gestern, wenn das Datum übernommen ist, dann erscheint ein Hinweis, und Speichern bleibt möglich
- [ ] Angenommen ein gespeicherter Entwurf mit Rechnungsdatum 15.10.2026, wenn er am 31.10.2026 wieder geöffnet wird, dann steht weiterhin 15.10.2026
- [ ] Angenommen die Firma ist Empfänger, wenn der Entwurf beginnt, dann ist bei den Gastnamen „keine Gastnamen“ vorausgewählt
- [ ] Angenommen „Hauptgast mit Mitreisenden“, wenn die Vorschau geöffnet wird, dann stehen in Block 3 Hauptgast und Mitreisende mit Titeln in der Reihenfolge der Buchung

### Textblöcke und Platzhalter
- [ ] Angenommen in Block 4 gibt es einen Standard, wenn der Entwurf beginnt, dann ist er gewählt und sein Text eingetragen; ohne Standard ist der Block leer
- [ ] Angenommen der Inhaber ändert den Text für diese Rechnung, wenn er speichert, dann bleibt der Baustein in den Einstellungen unverändert
- [ ] Angenommen ein geänderter Text, wenn der Inhaber einen anderen Baustein wählt, dann erscheint eine Rückfrage, bevor der Text ersetzt wird
- [ ] Angenommen ein Baustein wird in den Einstellungen geändert, wenn ein bestehender Entwurf geöffnet wird, dann enthält er weiterhin den alten Text
- [ ] Angenommen der Inhaber tippt „{Gastname}“, wenn er speichert, dann erscheint „Unbekannter Platzhalter: {Gastname}“, und nichts wird gespeichert
- [ ] Angenommen die Firma ist Empfänger, wenn die Vorschau geöffnet wird, dann ergibt {Anrede} „Sehr geehrte Damen und Herren“; ist „Anrede des Hauptgasts“ gewählt, die Anrede des Hauptgasts nach PROJ-39
- [ ] Angenommen {Rechnungsnummer} im Text, wenn die Vorschau geöffnet wird, dann steht dort „Entwurf“

### Zahlungsregeln
- [ ] Angenommen Baustein „Anzahlung 20 %, Rest vor Anreise“, Rechnungsdatum 01.10.2026, Anreise 14.10.2026, Betrag € 450,00, wenn der Baustein gewählt ist, dann ergeben sich Anzahlung € 90,00 fällig 04.10.2026 und Rest € 360,00 fällig 13.10.2026
- [ ] Angenommen der Inhaber ändert den Prozentsatz für diese Rechnung auf 30 %, wenn er speichert, dann bleibt der Baustein in den Einstellungen bei 20 %
- [ ] Angenommen kein Zahlungsbaustein, wenn der Entwurf beginnt, dann ist der Betrag am Rechnungsdatum fällig
- [ ] Angenommen „1 Tag vor Anreise“ und Rechnungsdatum nach der Anreise, wenn die Fälligkeit berechnet wird, dann ist sie das Rechnungsdatum mit dem Hinweis „Fälligkeit liegt vor dem Rechnungsdatum, sofort fällig gesetzt“
- [ ] Angenommen „Anzahlung fällig“ läge nach der Fälligkeit des Rests, wenn berechnet wird, dann wird sie auf die Fälligkeit des Rests gesetzt, mit Hinweis

### Kleinunternehmer und USt
- [ ] Angenommen die Abreise der Buchung fällt in eine Kleinunternehmer-Zeit, wenn der Entwurf angezeigt wird, dann wird keine USt ausgewiesen und der Kleinunternehmer-Hinweis steht nach Block 5, unabhängig vom Rechnungsdatum
- [ ] Angenommen nach dem Speichern wird der Kleinunternehmer-Verlauf geändert, wenn der Entwurf wieder geöffnet wird, dann gilt der neue Status
- [ ] Angenommen eine nacherfasste Rechnung, wenn PROJ-40 eingespielt ist, dann bleibt ihre Anzeige unverändert (Verhalten wie PROJ-37)

### Schreibweise der USt (refine 2026-11-06)
- [ ] Angenommen eine Rechnung mit Übernachtung 10 % und Endreinigung 10 %, wenn die Vorschau erscheint, dann lauten die Zeilen „Übernachtung · (inkl. 10 % USt.)“ und „Endreinigung · (inkl. 10 % USt.)“
- [ ] Angenommen eine Position Nächtigungsabgabe mit 0 % und eine Übernachtung mit 10 %, wenn die Vorschau erscheint, dann lautet die Zeile „Nächtigungsabgabe · (inkl. 0 % USt.)“ und der Rechnungsbetrag „Rechnungsbetrag (inkl. USt.)“
- [ ] Angenommen eine Teilrechnung nach Betrag mit Anteilen zu 10 % und 20 %, wenn die Vorschau erscheint, dann lauten die Anteile „Anteil (inkl. 10 % USt.)“ und „Anteil (inkl. 20 % USt.)“
- [ ] Angenommen eine Schlussrechnung mit Abzug, wenn die Vorschau erscheint, dann lauten die Summen „Summe der Leistungen (inkl. USt.)“ und „Rechnungsbetrag (inkl. USt.)“
- [ ] Angenommen Positionen zu 10 % mit zusammen € 450,00 brutto, wenn die USt-Tabelle erscheint, dann steht links „10 % aus € 409,09“ und rechts „€ 40,91“
- [ ] Angenommen eine Schlussrechnung zieht eine Teilrechnung ab, wenn die USt-Tabelle erscheint, dann ist der Nettobetrag je Satz der Wert nach Abzug, passend zur USt in derselben Zeile
- [ ] Angenommen eine Kleinunternehmer-Rechnung, wenn die Vorschau erscheint, dann haben Zeilen und Summen keinen Zusatz und es gibt keine USt-Tabelle (wie bisher)
- [ ] Angenommen eine Rechnung nur mit 0-%-Positionen, wenn die Vorschau erscheint, dann stehen die Zeilen mit „(inkl. 0 % USt.)“, der Rechnungsbetrag ohne Zusatz, und es gibt keine USt-Tabelle
- [ ] Angenommen eine ausgestellte Rechnung (PROJ-42), wenn ihr PDF erzeugt wird, dann hat es die neue Schreibweise; vorher ausgestellte PDFs bleiben unverändert
- [ ] Angenommen das Briefpapier (PROJ-41), wenn die Musterrechnung erscheint, dann zeigt sie die neue Schreibweise

### Pflichtangaben
- [ ] Angenommen ein Rechnungsbetrag von € 300 und ein Empfänger ohne Anschrift, wenn die Pflichtangaben geprüft werden, dann gibt es keinen Fehler zur Anschrift
- [ ] Angenommen ein Rechnungsbetrag von € 500 und ein Empfänger ohne PLZ, wenn die Pflichtangaben geprüft werden, dann zeigt die Liste den Fehler mit Link zum Feld
- [ ] Angenommen ein Aussteller ohne UID, kein Kleinunternehmer, Rechnungsbetrag € 500, wenn geprüft wird, dann zeigt die Liste „UID des Ausstellers fehlt“ mit Verweis auf die Stammdaten; bei Kleinunternehmer-Status nicht
- [ ] Angenommen ein Rechnungsbetrag von € 12.000 und eine Firma ohne UID, wenn geprüft wird, dann zeigt die Liste „UID des Empfängers fehlt“
- [ ] Angenommen ein Entwurf mit Fehlern in der Pflichtangaben-Liste, wenn der Inhaber speichert, dann wird gespeichert
- [ ] Angenommen ein vollständiger Entwurf, wenn die Liste angezeigt wird, dann haben alle Angaben ein ✓ und die fehlende Nummer ist kein Fehler

### Vorschau
- [ ] Angenommen ein Entwurf, wenn der Inhaber „Vorschau“ wählt, dann sieht er Kopfzeile, Blöcke 1–7, ggf. Kleinunternehmer-Hinweis und Fußzeile in der Reihenfolge aus PROJ-39, mit ersetzten Platzhaltern und deutlich als „Entwurf“ gekennzeichnet
- [ ] Angenommen die Vorschau, wenn sie Datumsangaben zeigt, dann stehen alle ohne Wochentag („14.10.2026“), auch in Block 2a und 2b
- [ ] Angenommen ungespeicherte Änderungen im Formular, wenn der Inhaber „Vorschau“ und dann „Zurück zum Entwurf“ wählt, dann sind alle Eingaben erhalten
- [ ] Angenommen ein Mitarbeiter öffnet einen Entwurf, wenn er „Vorschau“ wählt, dann sieht er die Vorschau ohne Bearbeitungsknöpfe

### Detail, Listen und Buchungsänderung
- [ ] Angenommen ein Entwurf existiert, wenn ein Nutzer die Rechnungsliste öffnet, dann steht er mit Nummer „–“, Rechnungsdatum, Empfänger, Buchung, Betrag und Status „Entwurf“ (ggf. mit Art)
- [ ] Angenommen eine Buchung mit nacherfasster Rechnung € 200 und Entwurf € 100, wenn ein Nutzer das Buchungsdetail öffnet, dann stehen „Verrechnet: € 200,00“ und „In Entwürfen: € 100,00“
- [ ] Angenommen eine Buchung hat nur einen Entwurf, wenn der Filter „ohne Rechnung“ gewählt ist, dann erscheint die Buchung, und in der Spalte „Rechnungen“ steht „Entwurf“ als Link
- [ ] Angenommen der Inhaber wählt „Löschen“ auf der Detailseite, wenn er bestätigt, dann ist der Entwurf entfernt; bricht er ab, bleibt er erhalten
- [ ] Angenommen nach dem Speichern wird der Preis der Buchung geändert, wenn der Entwurf geöffnet wird, dann erscheint „Die Buchung wurde seit dem Entwurf geändert“ mit „Positionen neu übernehmen“
- [ ] Angenommen der Inhaber wählt „Positionen neu übernehmen“ und bestätigt, wenn die Positionen ersetzt sind, dann entsprechen sie der aktuellen Buchung mit Vorauswahl wie beim Anlegen
- [ ] Angenommen die Buchung wird storniert (ohne Stornogebühr), wenn ein bestehender Entwurf geöffnet wird, dann bleibt er erhalten und zeigt den Hinweis

## Edge Cases
- **Buchung voll verrechnet durch nacherfasste Rechnungen über den Gesamtpreis hinaus:** Knopf inaktiv; Hinweis „Verrechnet mehr als Gesamtpreis“ wie PROJ-37.
- **Gesamtpreis 0 oder negativ** (z. B. Rabatt größer als Leistung): Knopf inaktiv, da nichts zu verrechnen ist.
- **Buchungspreis sinkt unter die Summe der Entwürfe:** Knopf inaktiv; Entwürfe zeigen den Änderungshinweis.
- **Position doppelt verrechnet** (Inhaber wählt bewusst eine bereits verrechnete Position an): erlaubt; Summenhinweis, wenn der Gesamtpreis überschritten wird.
- **Teilrechnung bei Buchung nur mit Positionen zu einem Satz:** eine USt-Zeile; bei Kleinunternehmer keine.
- **Rundung bei anteiliger USt-Aufteilung:** Rundungsrest beim größten Anteil, damit die Summe genau dem Teilbetrag entspricht.
- **Schlussrechnung zieht einen Teilrechnungs-Entwurf ab, der danach gelöscht wird:** Der Abzug entfällt; die Schlussrechnung zeigt den Hinweis „Abgezogene Rechnung existiert nicht mehr“ und rechnet neu.
- **Mehrere Teilrechnungen:** alle zum Abzug vorausgewählt.
- **Art von Teilrechnung auf Rechnung geändert:** Teilbetrag entfällt nach Rückfrage, Positionen werden mit Vorauswahl übernommen.
- **Hauptgast der Buchung wird gewechselt:** Empfängerkopie bleibt; Gastnamen (Block 3) und {Gast}/{Anrede} folgen der Buchung; Änderungshinweis erscheint.
- **Gast wird anonymisiert:** Empfängerkopie im Entwurf bleibt; Block 3 und {Gast} zeigen „Gelöschter Gast“.
- **Gast ohne Geschlecht** (Gast als Empfänger): {Anrede} „Sehr geehrte/r …“ wie PROJ-39.
- **Gast ohne Wohnadresse, Rechnung ≥ € 400:** Pflichtangaben-Fehler, Speichern möglich.
- **Kleinunternehmer-Status ändert sich zwischen Teil- und Schlussrechnung:** beide richten sich nach der Buchung, daher gleich; Sonderfall Anzahlung vor Statuswechsel siehe Open Questions.
- **Stammdaten unvollständig** (Aussteller ohne Anschrift): Pflichtangaben-Fehler mit Verweis auf *Einstellungen → Stammdaten*.
- **Kein Baustein in Block 4/6/7 vorhanden:** Auswahl leer, Block bleibt leer, frei beschreibbar.
- **Platzhalter für Anzahlung im Text, Anzahlung für diese Rechnung ausgeschaltet:** Hinweis „Platzhalter {Anzahlung} ohne Anzahlung“; Speichern verhindert wie bei unbekannten Platzhaltern.
- **Gleichzeitiges Anlegen zweier Entwürfe** über den Rest des Gesamtpreises: beide werden gespeichert; der Knopf ist danach inaktiv, Summenhinweis.
- **Wohnung oder Zeitraum der Buchung geändert:** Blöcke 2a/3 und Platzhalter folgen der Buchung; Fristen „vor Anreise“ werden neu berechnet; Änderungshinweis nur bei Preis/Positionen/Storno/Hauptgast.
- **Sehr lange Firmennamen, IBAN, Bezeichnungen am Handy:** werden umgebrochen, kein seitliches Scrollen.

## Technical Requirements
- Rechte serverseitig durchgesetzt (Inhaber nur eigener Kunde schreibend, Mitarbeiter lesend, Betreiber kein Zugriff)
- Prüfregeln (Positionen, Teilbetrag, Platzhalter, Zahlungsregeln) gleich in Oberfläche und Server; Platzhalter-Liste und Ersetzung aus PROJ-39 wiederverwenden
- Berechnungen (Summen, USt je Satz, anteilige Aufteilung, Fristen, Kleinunternehmer-Regel) an einer Stelle, nutzbar von Entwurf, Vorschau und später PROJ-41
- Formatierter Text wie PROJ-39 (kein freies HTML)
- Entwürfe nie mit Nummer; Nummern-Eindeutigkeit aus PROJ-37 bleibt unberührt
- Deutsche Texte über die bestehende i18n-Struktur
- Responsiv ab 375 px; Chrome, Firefox, Safari

## Open Questions
- [ ] Steuerberater: Weg „Teilrechnung mit anteiliger USt, Schlussrechnung mit Abzug je Satz“ bestätigen
- [ ] Steuerberater: Grenzen der Pflichtangaben (€ 400 Kleinbetragsrechnung, € 10.000 UID des Empfängers, UID des Ausstellers bei Kleinunternehmern) bestätigen
- [ ] Steuerberater: Anzahlung vor einem Statuswechsel Kleinunternehmer ↔ USt-pflichtig — reicht die Regel „nach der Buchung“?
- [ ] Soll die Rechnung auch den Leistungszeitraum in einer eigenen Zeile nennen, oder genügt Block 2a? (PROJ-41 mit dem PDF-Layout)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Entwurf wird ohne Nummer gespeichert (weiterbearbeiten, löschen, Status „Entwurf“) | PROJ-40 hat so vor PROJ-41 bleibenden Nutzen; Teil- und Schlussrechnung in Ruhe vorbereitbar; nie reservierte Nummern | 2026-10-31 |
| „Verrechnet“ nur nacherfasst + ausgestellt, „In Entwürfen“ getrennt; Knopf-Sperre bei Verrechnet + Entwürfe ≥ Gesamtpreis | Ehrliche Summe; verhindert versehentlich doppelte Entwürfe; Löschen gibt den Knopf frei | 2026-10-31 |
| App merkt sich die Herkunft jeder Rechnungsposition; Vorauswahl nur noch nicht verrechneter Positionen | Übliche Aufteilung (Übernachtung an Firma, Extras an Gast) ohne Nachdenken richtig; nacherfasste zählen nur über die Summe | 2026-10-31 |
| Arten Rechnung / Teilrechnung / Schlussrechnung; Teilrechnung mit anteiliger USt, Schlussrechnung mit Abzug je Satz | Üblicher Weg nach österreichischem UStG; App teilt die Steuer selbst auf | 2026-10-31 |
| Teilrechnungen verbrauchen keine Positionen | Erst die Schlussrechnung verrechnet die Leistung | 2026-10-31 |
| Abzüge: Teilrechnungen vorausgewählt, nacherfasste anwählbar, Art Rechnung nicht | Normalfall ohne Zutun richtig; Anzahlungen aus dem Altsystem abziehbar | 2026-10-31 |
| Empfänger Gast oder Firma des Hauptgasts, Firma vorausgewählt wenn vorhanden; Kopie, alle Felder überschreibbar | Wie Vorbelegung in PROJ-37; Sonderfälle (Reisebüro) ohne eigene Wahl | 2026-10-31 |
| {Anrede} bei Firma wählbar: „Sehr geehrte Damen und Herren“ (vorausgewählt) oder Anrede des Hauptgasts | Nutzerentscheidung | 2026-10-31 |
| Kleinunternehmer-Status nach der Buchung (PROJ-36), im Entwurf jeweils neu ermittelt; nur für in der App erstellte Rechnungen | Leistungszeitpunkt maßgeblich; Buchungsdetail und Rechnung zeigen dasselbe; nacherfasste Rechnungen sind bereits ausgestellt und werden nur erfasst (Nutzer, 2026-10-31); schließt offene Frage aus PROJ-36/39 | 2026-10-31 |
| Rechnungsdatum im Entwurf frei wählbar, vorbelegt mit heute, gespeichert | Nutzerentscheidung; Prüfung gegen die Nummernfolge in PROJ-41 | 2026-10-31 |
| Fälligkeit ohne Baustein = Rechnungsdatum; Fristen vor dem Rechnungsdatum auf dieses gesetzt, mit Hinweis | Ohne Vereinbarung sofort fällig; keine Frist in der Vergangenheit; schließt offene Frage aus PROJ-39 | 2026-10-31 |
| Pflichtangaben nach § 11 UStG mit Grenzen € 400 / € 10.000; Fehler verhindern nur das Ausstellen | Gesetzliche Kleinbetragsrechnung; Kleinunternehmer ohne UID nicht blockiert; Entwürfe vorbereitbar | 2026-10-31 |
| Vorschau als eigene Ansicht über Knopf; alle Datumsangaben auf der Rechnung ohne Wochentag | Formular ist breit; am Handy gut lesbar; einheitlich mit den Platzhaltern; schließt offene Frage aus PROJ-39 | 2026-10-31 |
| Block 3: „keine Gastnamen“ / „Hauptgast“ / „Hauptgast mit Mitreisenden“, immer „keine Gastnamen“ vorausgewählt | Nutzerentscheidung | 2026-10-31 |
| Knopf für Buchungen, Optionen (mit Hinweis) und stornierte mit Stornogebühr | Anzahlung macht die Option fix (Baustein aus PROJ-39); Stornogebühr muss verrechenbar sein | 2026-10-31 |
| Buchungsänderung: Hinweis mit „Positionen neu übernehmen“, kein automatisches Nachziehen | Inhaber behält Kontrolle über angepasste Beträge | 2026-10-31 |
| Eigene ganze Seite „Rechnung erstellen“ statt Panel | Viel Inhalt (drei Editoren, Zahlungsregeln); per Adresse wieder öffenbar | 2026-10-31 |
| Teilbetrag und Summenüberschreitung nur Hinweis, keine Sperre im Entwurf | Wie PROJ-37; Sperre wirkt nur auf den Knopf | 2026-10-31 |
| Entwürfe zählen beim Filter „ohne/mit Rechnung“ nicht als Rechnung, erscheinen aber in der Spalte als „Entwurf“ | „ohne Rechnung“ soll zeigen, was noch nicht verrechnet ist; Entwurf ist sichtbar | 2026-10-31 |
| Mitarbeiter sehen Entwürfe samt Vorschau, ohne Bearbeiten | Wie bei nacherfassten Rechnungen (PROJ-37) | 2026-10-31 |
| Schreibweise im Leistungsblock: „· (inkl. 10 % USt.)“ je Zeile, „Anteil (inkl. 10 % USt.)“, „(inkl. USt.)“ bei Summe der Leistungen und Rechnungsbetrag, USt-Tabelle „10 % aus € [Netto]“ | Nutzerwunsch 2026-11-06; macht die Bruttobeträge auf der Rechnung ausdrücklich | 2026-11-06 |
| 0-%-Zeilen erhalten „(inkl. 0 % USt.)“; Summen ohne Zusatz, wenn keine Position mehr als 0 % hat, und bei Kleinunternehmern | Nutzerentscheidung 2026-11-06: einheitliche Zeilen; „inkl. USt.“ bei der Summe nur, wenn tatsächlich USt enthalten ist | 2026-11-06 |
| Bausteintexte als Kopie im Entwurf, Platzhalter erst in der Vorschau ersetzt | Änderungen an Einstellungen wirken nicht auf Entwürfe (PROJ-39); Werte wie Zeitraum bleiben aktuell | 2026-10-31 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Entwürfe in derselben Rechnungstabelle wie PROJ-37; „Herkunft“ bekommt den Wert „Entwurf“ (PROJ-41 ergänzt „ausgestellt“), Nummer bei Entwürfen leer | Liste, Rechnungen je Buchung, Spalte und Summen funktionieren ohne zweite Quelle; Ausstellen wird in PROJ-41 ein Zustandswechsel statt Umkopieren; leere Nummern stören weder Eindeutigkeit noch Nummernvorschlag | 2026-10-31 |
| Prüfung „hat ausgestellte Rechnungen“ (PROJ-39) fragt künftig gezielt nach „ausgestellt“ statt „nicht nacherfasst“ | Sonst würde schon der erste Entwurf die Warnung beim Ändern des Nummernkreises auslösen | 2026-10-31 |
| Empfänger als eigene Felder an der Rechnung (Art Gast/Firma, Name, Adresszeilen, PLZ, Ort, Staat, UID); das bisherige Freitextfeld bleibt für nacherfasste Rechnungen und als Anzeigename | Pflichtangaben-Prüfung braucht einzelne Felder; nacherfasste Rechnungen bleiben unverändert | 2026-10-31 |
| Herkunft jeder Rechnungsposition: „Übernachtung“, „Stornogebühr“ oder eine bestimmte Zusatzkosten-Position der Buchung | Grundlage für die Vorauswahl „noch nicht verrechnet“ | 2026-10-31 |
| Zusatzkosten-Positionen einer Buchung behalten beim Speichern der Buchung ihre Kennung (bisher bei jedem Speichern neu angelegt) | Ohne stabile Kennung ginge die Verbindung Rechnungsposition → Buchungsposition bei jeder Buchungsänderung verloren; gelöschte Zusatzkosten verlieren die Verbindung bewusst | 2026-10-31 |
| „Buchung geändert“ über einen Fingerabdruck der preisrelevanten Buchungsdaten (Positionen, Beträge, Sätze, Stornostatus) und des Hauptgasts, am Entwurf gespeichert | Hinweis erscheint nur bei Änderungen, die Positionen oder Empfänger betreffen, nicht bei jeder Änderung an Notiz oder Mitreisenden; Hauptgast ergänzt nach QA BUG-3 (Nutzerentscheidung 2026-10-31: die Empfängerkopie soll nicht unbemerkt veralten) | 2026-10-31 |
| Teilrechnung speichert die Eingabe (Prozent oder Betrag) und die daraus berechneten Zeilen je USt-Satz | Anzeige, Summen und Abzug in der Schlussrechnung lesen feste Werte; Aufteilung ist beim Speichern nachvollziehbar festgelegt | 2026-10-31 |
| Abzüge der Schlussrechnung als eigene Verknüpfung Schlussrechnung → abgezogene Rechnung; Betrag und Sätze werden aus der abgezogenen Rechnung gelesen; Gesamtbetrag der Schlussrechnung wird neu gebildet, wenn sich eine abgezogene Rechnung ändert oder gelöscht wird | Keine doppelte Datenhaltung; Liste und Summen bleiben stimmig | 2026-10-31 |
| Textblöcke als Kopie im selben strukturierten Format wie PROJ-39 (kein HTML), mit Verweis auf den gewählten Baustein nur zur Anzeige | Sicherheit und Prüfung wie bei den Bausteinen; Änderungen an Bausteinen wirken nicht auf Entwürfe | 2026-10-31 |
| Platzhalter bleiben im gespeicherten Text, ersetzt wird beim Anzeigen mit derselben Regel wie PROJ-39 | Zeitraum, Fristen und Namen sind immer aktuell; PROJ-41 ersetzt beim Ausstellen endgültig | 2026-10-31 |
| Alle Rechenregeln des Entwurfs (Positionen-Vorauswahl, Teilbetrag mit Rundung, Abzüge, Fälligkeiten mit Rückfallregel, Kleinunternehmer nach Buchung, Pflichtangaben) in einer gemeinsamen Rechen-Bibliothek, die Browser und Server nutzen | Formular, Detailseite, Vorschau und später PROJ-41 rechnen gleich; gut mit Unit-Tests abzudecken | 2026-10-31 |
| Speichern über eine geschützte Datenbank-Funktion je Entwurf (Anlegen/Ändern) und eine zum Löschen, wie `save_invoice` | Rechte, Konfliktschutz, Summenregel beim Anlegen, Gesamtbetrag und Protokoll an einer Stelle; Anfragen am Formular vorbei sind abgesichert | 2026-10-31 |
| Pflichtangaben werden im Entwurf nur angezeigt, nicht vom Server erzwungen | Speichern mit Lücken ist ausdrücklich erlaubt; durchgesetzt wird erst beim Ausstellen (PROJ-41) mit derselben Regel | 2026-10-31 |
| Vorschau als eine Darstellung, die sowohl auf einer eigenen Seite (gespeicherter Entwurf) als auch direkt im Formular (ungespeicherter Stand) läuft | „Vorschau“ aus dem Formular verliert keine Eingaben; Mitarbeiter und Detailseite nutzen dieselbe Darstellung; PROJ-41 kann sie als Vorlage fürs PDF nehmen | 2026-10-31 |
| Aussteller-Angaben, Fußzeile und Kleinunternehmer-Hinweis für die Vorschau liest der Server über eine Funktion, die nur diese Felder liefert | Mitarbeiter haben keinen Zugang zu Stammdaten und Rechnungseinstellungen, sollen die Vorschau aber sehen | 2026-10-31 |
| PROJ-37-Änderung: Kleinunternehmer-Kennzeichen kommt als Schalterwert vom Formular; die Speicherfunktion übernimmt ihn, statt ihn aus dem Rechnungsdatum zu bilden | Umsetzung des Refine vom 2026-10-31; gemeinsam mit PROJ-40 gebaut und ausgeliefert | 2026-10-31 |
| Keine neuen Pakete | Editor (Tiptap), Formulare, Prüfung und Oberflächenbausteine sind vorhanden | 2026-10-31 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Rechnungen** (PROJ-37): eine Tabelle für Rechnungen mit Positionen, Feld „Herkunft“ (bisher nur „nacherfasst“), Gesamtbetrag und Kleinunternehmer-Kennzeichen, beide von der Datenbank gebildet; geschützte Speicher- und Löschfunktion mit Konfliktschutz; Änderungsprotokoll; Rechnungsliste, Detailseite, Abschnitt „Rechnungen“ im Buchungsdetail, Spalte und Filter in der Buchungsübersicht.
- **Rechnungseinstellungen** (PROJ-39): Bausteine je Block mit Standard und Zahlungsregeln; beschränkter Editor; Platzhalter-Liste mit Zulässigkeit je Block; Regeln für {Anrede}, Gastname mit Titeln, Zahlungsbeträge/Fristen und das Ersetzen der Platzhalter (Datum ohne Wochentag); Kleinunternehmer-Hinweis und Fußzeile.
- **Rechenregeln**: USt je Satz (PROJ-35), Kleinunternehmer-Status je Buchung (PROJ-36), Positionen aus der Buchung in der Reihenfolge aus PROJ-34.
- **Buchungsdetail** mit Knopfreihe „Bearbeiten“, „Mitreisende bearbeiten“, „Stornieren“.

### Seiten und Bausteine der Oberfläche
```
Buchungsdetail (/buchungen/[id])
+-- Knopfreihe: Bearbeiten · Mitreisende bearbeiten · Stornieren · „Rechnung“ (neu, rechts außen, nur Inhaber)
|   +-- inaktiv mit Begründung (voll verrechnet/in Entwürfen, Sperre, Storno ohne Gebühr)
+-- Abschnitt „Rechnungen“ (erweitert)
    +-- Entwürfe mit Status „Entwurf“ und Art
    +-- „Verrechnet: € …“ und neu „In Entwürfen: € …“

Rechnung erstellen (/rechnungen/neu?buchung=…) und Entwurf bearbeiten (/rechnungen/[id]/bearbeiten)
+-- Kopf: Buchung (Gast · Wohnung · Zeitraum), Hinweise (Option, „Buchung wurde seit dem Entwurf geändert“ + „Positionen neu übernehmen“)
+-- Art: Rechnung · Teilrechnung · Schlussrechnung
+-- Empfänger: Gast / Firma, Felder (Name, Adresszeilen, PLZ, Ort, Staat, UID); bei Firma Wahl der Anrede
+-- Rechnungsdatum (mit Hinweis bei Vergangenheit)
+-- Gastnamen: keine · Hauptgast · Hauptgast mit Mitreisenden
+-- je nach Art:
|   +-- Positionen (wie Nacherfassen: anwählen, ändern, hinzufügen, ordnen; Hinweis „bereits in Rechnung …“)
|   +-- Teilbetrag (Prozent oder Betrag, Aufteilung je Satz)
|   +-- Positionen + Abzüge (Liste der abziehbaren Rechnungen mit Auswahl)
+-- Summen: Gesamtbetrag, USt je Satz bzw. Kleinunternehmer-Hinweis
+-- Einleitung · Zahlungsmodalitäten (+ Zahlungsregeln, berechnete Fristen, Rückfall-Hinweise) · Abschlusstext
|   +-- je Block: Bausteinauswahl, Editor aus PROJ-39
+-- Pflichtangaben-Liste (✓ / Fehler mit Sprung zum Feld)
+-- Knöpfe: Vorschau · Entwurf speichern · Abbrechen (Rückfrage bei ungespeicherten Änderungen)

Entwurf-Detail (/rechnungen/[id], bestehende Detailseite erweitert)
+-- Status „Entwurf“, Art, Empfänger, Datum, Positionen/Teilbetrag/Abzüge, Summen, Pflichtangaben
+-- Hinweis „Buchung wurde seit dem Entwurf geändert“ (+ Knopf für Inhaber)
+-- Inhaber: Bearbeiten · Vorschau · Löschen   ·   Mitarbeiter: Vorschau

Vorschau (/rechnungen/[id]/vorschau bzw. Ansicht innerhalb des Formulars)
+-- Kopfzeile (Aussteller) · Block 1 · 2a · 2b · 2c „Entwurf“ · 3 · 4 · 5 (+ Kleinunternehmer-Hinweis) · 6 · 7 · Fußzeile
+-- „Zurück zum Entwurf“

Rechnungsliste (/rechnungen): Entwürfe mit Nummer „–“, Status „Entwurf“ (+ Art)
Buchungsübersicht: Spalte „Rechnungen“ zeigt „Entwurf“-Link; Filter ohne/mit Rechnung zählt Entwürfe nicht

PROJ-37-Formular „Rechnung nacherfassen“: neuer Schalter „Ohne Umsatzsteuer (Kleinunternehmer)“
```

### Datenmodell (in Worten)
**Rechnung (bestehende Tabelle, erweitert)**
- Herkunft: „nacherfasst“, neu „Entwurf“ (PROJ-41: „ausgestellt“)
- Nummer: bei Entwürfen leer; bei nacherfassten weiterhin Pflicht und je Kunde eindeutig
- Art: Rechnung, Teilrechnung oder Schlussrechnung (nur bei Entwürfen/ausgestellten)
- Rechnungsdatum, Buchung (bei Entwürfen Pflicht), Gast (Hauptgast)
- Empfänger: Art (Gast/Firma), Name, Adresszeile 1/2, PLZ, Ort, Staat, UID; dazu der bestehende Anzeigename (für Liste und Suche)
- Anrede bei Firma: „Damen und Herren“ oder „Hauptgast“
- Gastnamen: keine / Hauptgast / Hauptgast mit Mitreisenden
- Teilrechnung: Eingabe als Prozent oder Betrag
- Texte der Blöcke 4, 6, 7 als formatierter Text (Kopie), jeweils mit Verweis auf den gewählten Baustein
- Zahlungsregeln dieser Rechnung: Anzahlung ja/nein, Prozent, Frist; Fälligkeit (Bezug, Tage)
- Fingerabdruck der Buchung beim letzten Speichern (für „Buchung geändert“)
- Gesamtbetrag (von der Datenbank gebildet), Kleinunternehmer-Kennzeichen (nacherfasst: Schalterwert; Entwurf: nur Momentaufnahme, angezeigt wird der aktuelle Status nach der Buchung)
- Änderungsstempel und Protokoll wie bisher

**Rechnungsposition (bestehend, erweitert)**
- Bezeichnung, Betrag brutto, USt-Satz, Reihenfolge wie bisher
- neu: Herkunft in der Buchung (Übernachtung, Stornogebühr, bestimmte Zusatzkosten-Position oder keine), bei Teilrechnungen Kennzeichen „Anteil je Satz“

**Abzug (neu)**: Schlussrechnung → abgezogene Rechnung (Teilrechnung oder nacherfasste Rechnung derselben Buchung). Betrag und Sätze kommen aus der abgezogenen Rechnung.

**Buchung (Änderung)**: Zusatzkosten-Positionen behalten beim Speichern ihre Kennung.

Gespeichert in: Supabase (PostgreSQL), getrennt je Kunde wie bisher. Lesen: Inhaber und Mitarbeiter des Kunden; Schreiben nur Inhaber über die geschützten Funktionen; Betreiber kein Zugriff auf Entwürfe.

### Regeln an einer Stelle
Eine gemeinsame Rechen-Bibliothek liefert für Formular, Detailseite und Vorschau (und später PROJ-41):
- **Vorauswahl der Positionen** aus Buchung und anderen Rechnungen der Buchung
- **Teilbetrag**: Prozent ↔ Betrag, Aufteilung je USt-Satz mit Rundungsrest beim größten Anteil
- **Schlussrechnung**: Positionen minus Abzüge, USt je Satz
- **Summen**: „Verrechnet“, „In Entwürfen“, Regel für den Knopf „Rechnung“
- **Fälligkeiten**: aus Zahlungsregeln und Rechnungsdatum, Rückfall auf das Rechnungsdatum, Anzahlung nie nach dem Rest
- **Kleinunternehmer** nach der Buchung (bestehende Regel aus PROJ-36)
- **Pflichtangaben** mit den Grenzen € 400 / € 10.000
- **Platzhalter-Werte** inkl. {Anrede} bei Firma; Ersetzen mit der Regel aus PROJ-39

### Server
- **Entwurf speichern** (eine geschützte Funktion für Anlegen und Ändern): nur Inhaber des Kunden; Buchung des eigenen Kunden, keine Sperre, stornierte nur mit Stornogebühr; beim **Anlegen** Summenregel (Verrechnet + Entwürfe < Gesamtpreis bzw. Stornogebühr); Konfliktschutz („inzwischen geändert“); Prüfung von Positionen, Teilbetrag (> 0), Zahlungsregeln (Grenzen aus PROJ-39), Texten (Struktur, Länge, Platzhalter je Block) und Abzügen (nur Teilrechnungen bzw. nacherfasste Rechnungen derselben Buchung); bildet Gesamtbetrag, speichert Fingerabdruck, schreibt Positionen und Abzüge in einem Schritt.
- **Entwurf löschen**: nur Inhaber, nur Entwürfe; Schlussrechnungen, die ihn abziehen, verlieren den Abzug und werden neu berechnet.
- **Vorschau-Daten**: liefert Aussteller (Name, Anschrift, UID), Ort, Fußzeile und Kleinunternehmer-Hinweis für Inhaber und Mitarbeiter.
- **Buchung speichern** (bestehend): Zusatzkosten mit Kennung erhalten.
- **Rechnung nacherfassen** (bestehend, PROJ-37-Änderung): übernimmt den Schalterwert für das Kleinunternehmer-Kennzeichen.
- **Lesen**: Rechnungsliste, Rechnungen je Buchung und Buchungsübersicht kennen den Status „Entwurf“; der Filter „ohne/mit Rechnung“ zählt nur nacherfasste (später auch ausgestellte) Rechnungen; die Prüfung „hat ausgestellte Rechnungen“ (PROJ-39) fragt gezielt nach „ausgestellt“.

### Seitenablauf
- „Rechnung“ → `/rechnungen/neu?buchung=…`: Server lädt Buchung, Hauptgast, Mitreisende, andere Rechnungen der Buchung, Bausteine, Vorschau-Daten; Formular wird vorbelegt.
- „Entwurf speichern“ leitet in der Server-Aktion selbst auf die Detailseite weiter (Lehre aus PROJ-39: Weiterleiten im Browser nach dem Speichern geht in Next 16 sporadisch verloren).
- „Vorschau“ im Formular zeigt die Vorschau-Darstellung mit dem aktuellen Formularstand ohne Seitenwechsel; „Zurück zum Entwurf“ blendet das Formular wieder ein.
- Speichern lädt Rechnungsliste, Buchungsdetail und Buchungsübersicht neu (Summen, Knopf, Spalte).

### Abhängigkeiten
Keine neuen Pakete.

### Für /backend
- Migration: Herkunft „Entwurf“, Nummer bei Entwürfen leer, neue Felder an Rechnung und Position, Abzugstabelle, Speicher-/Löschfunktion für Entwürfe, Vorschau-Daten-Funktion; `save_booking` mit stabilen Zusatzkosten-Kennungen; `save_invoice` mit Kleinunternehmer-Schalter; Prüfung „ausgestellt“ in den Rechnungseinstellungen
- Integrationstests: Rechte (Mitarbeiter, fremder Kunde, Betreiber), Summenregel beim Anlegen, Konfliktschutz, Prüfregeln, Abzüge und Neuberechnung beim Löschen, stabile Zusatzkosten-Kennungen, Kleinunternehmer-Schalter beim Nacherfassen

### Für /qa
- Unit-Tests der Rechen-Bibliothek (Rundung, Rückfallregel, Grenzen der Pflichtangaben, Vorauswahl)
- E2E: Rechnung erstellen aus Buchung, Teilung nach Positionen, Teil- und Schlussrechnung, Empfänger Firma/Gast, Vorschau ohne Datenverlust, Knopf-Sperre, Mitarbeiter-Ansicht, Handy 375 px

## Implementation Notes (Frontend)
**Stand 2026-10-31.** Oberfläche, Regeln, Server-Aktionen und Lesefunktionen sind gebaut; die Datenbank (Migration, Funktionen) fehlt noch (`/backend`, Schnittstelle unten). Bis dahin schlagen Laden und Speichern der Entwürfe fehl.

**Regeln** (Browser und Server, mit Unit-Tests):
- `src/lib/invoice-drafts.ts` (36 Tests): Arten, Empfänger-/Gastnamen-/Anrede-Auswahl, Herkunft der Positionen (`nights`, `cancellation_fee`, `charge:<Kennung>` ↔ Spalten `source_kind`/`source_charge_id`), `bookingDraftLines`, `invoiceSums` (Verrechnet = nicht Entwurf), `invoiceButtonState` (Begründungen `cancelledNoFee`/`nothingToBill`/`overBilled`/`fullyBilled`), `preselectLines` (nur Art Rechnung/Schlussrechnung zählen; ausgestellte vor Entwürfen im Hinweis), `amountFromPercent`/`percentFromAmount`, `splitByVat` (Rundungsrest beim größten Anteil), `partialLabel`, `deductionCandidates`, `draftTotals` (Schlussrechnung: USt je Satz = USt der Positionen minus die auf den abgezogenen Rechnungen ausgewiesene USt), `paymentSchedule` mit Rückfallregel, `recipientFromGuest`, `guestNames`, `draftSalutation`, `draftPlaceholderValues` ({Rechnungsnummer} = „Entwurf“, Fristen nach Rückfallregel), `requiredChecks` (Grenzen € 400 / € 10.000), `bookingFingerprint` (FNV-1a über Positionen, Beträge, Sätze, Bezeichnungen, Stornostatus).
- `src/lib/validation/invoice-drafts.ts` (12 Tests): `draftSchema` – nur angewählte Positionen werden geprüft und gespeichert; Teilbetrag > 0 (Prozent 0,01–100 oder Betrag); Zahlungsregeln wie PROJ-39 („Anzahlung: nein“ verwirft Prozent/Frist); Texte mit Länge und Platzhaltern je Block ({Anzahlung} ohne Anzahlung verhindert das Speichern); Abzüge nur bei Schlussrechnung. `liveDraftPayment` für die laufende Anzeige.
- `src/lib/invoice-preview.ts`: `buildPreviewModel` – eine Darstellung für Formular (ungespeichert), Detailseite und Vorschau-Seite.

**Oberfläche** `src/components/invoice-drafts/`:
- `draft-form` (Seite „Rechnung erstellen“/„Entwurf bearbeiten“): Kopf mit Buchung, Hinweise (Option, storniert, „Buchung wurde seit dem Entwurf geändert“ + „Positionen neu übernehmen“ mit Rückfrage), Art (Wechsel von Teilrechnung mit Teilbetrag nach Rückfrage), Empfänger Gast/Firma (Firma nur mit Firmenname; Wechsel nach eigenen Änderungen mit Rückfrage), Anrede bei Firma, Rechnungsdatum (Hinweis bei Vergangenheit), Gastnamen, Positionen bzw. Teilbetrag (Prozent ↔ Betrag, Aufteilung je Satz) bzw. Abzüge, Summen mit USt je Satz bzw. Kleinunternehmer, Hinweise „0 oder negativ“ und „über dem Gesamtpreis“, drei Textblöcke, Zahlungsregeln mit berechneten Fristen und Rückfall-Hinweisen, Pflichtangaben, Knöpfe „Entwurf speichern“, „Vorschau“, „Abbrechen“. Vorschau blendet das Formular nur aus (keine Eingabe geht verloren). Beim Bearbeiten stehen die übrigen Buchungspositionen abgewählt unter den gespeicherten.
- `draft-lines`: Positionen mit Auswahlkästchen, Hinweis „bereits in Rechnung …“ / „in Entwurf vom …“, sortierbar (Baustein aus PROJ-34), Bezeichnungsauswahl und Satz (PROJ-35).
- `draft-text-block`: Bausteinauswahl („Kein Text“, Standard gekennzeichnet), Editor aus PROJ-39 (bei Ersetzen neu aufgebaut), Rückfrage beim Ersetzen eines geänderten Texts; Zahlungsmodalitäten setzen die Zahlungsregeln.
- `invoice-preview`: Seitenform in der Reihenfolge aus PROJ-39, Kennzeichen „Entwurf“, Datumsangaben ohne Wochentag, Abzüge mit USt je Satz.
- `required-checks`: ✓/Fehler, „Zum Feld“ (Formular: Sprung und Fokus; Detailseite: Link `…/bearbeiten#feld`), „Zu den Stammdaten“ (nur Inhaber).
- `draft-detail` und `draft-actions`: Detailseite (Inhaber: Bearbeiten, Vorschau, Löschen mit Bestätigung; Mitarbeiter: Vorschau). Der Knopf „Positionen neu übernehmen“ auf der Detailseite führt ins Formular, dort mit Rückfrage.
- `use-unsaved-guard`: Rückfrage beim Verlassen (Browser-Rückfrage bei Neuladen/Schließen, eigener Dialog bei Links innerhalb der App und „Abbrechen“).

**Seiten:**
- `/rechnungen/neu?buchung=…` (nur Inhaber; ohne Rest zu verrechnen statt Formular die Begründung), `/rechnungen/[id]/bearbeiten` (nur Inhaber), `/rechnungen/[id]/vorschau` (alle Mitglieder), `/rechnungen/[id]` verzweigt bei Entwürfen auf die Entwurf-Detailseite.
- Buchungsdetail: Knopf „Rechnung“ rechts außen (nur Inhaber, nicht bei Sperren), inaktiv mit sichtbarer Begründung; gilt auch im Kalender-Panel. Abschnitt „Rechnungen“: Entwürfe als „Entwurf“ mit Art, darunter „In Entwürfen: € …“.
- Rechnungsliste: Nummer „–“, Status „Entwurf“ + Art. Buchungsübersicht: Spalte zeigt „Entwurf“ als Link; Filter ohne/mit Rechnung über eine eigene Verknüpfung `billed` ohne Entwürfe.
- Einstellungen → Rechnungen: Prüfung „hat ausgestellte Rechnungen“ fragt jetzt `origin = 'issued'`.

**PROJ-37-Änderung (Kleinunternehmer-Schalter):** Formular „Rechnung nacherfassen“ mit Schalter „Ohne Umsatzsteuer (Kleinunternehmer)“; beim Anlegen nach dem Status am Rechnungsdatum vorgeschlagen und mitgeführt, bis der Inhaber ihn umlegt; beim Bearbeiten der gespeicherte Wert. Schalter ein blendet die Satzfelder aus. Die Aktion sendet `small_business` an `save_invoice`.

**Server-Aktionen** (`src/app/(app)/rechnungen/actions.ts`): `saveInvoiceDraft` (liest die Buchung selbst, prüft mit `draftSchema`, rechnet die Teilrechnungs-Zeilen mit `splitByVat` und den Fingerabdruck, leitet zur Detailseite weiter) und `deleteInvoiceDraft` (leitet zur Buchung weiter). Lesefunktionen in `src/lib/invoice-drafts-data.ts`.

**Abweichungen/Entscheidungen beim Bauen:**
- „Buchung geändert“ stellt nur der Inhaber fest (Mitarbeiter lesen keine Buchungspreise); Mitarbeiter sehen den Hinweis nicht.
- Der Hinweis „in Entwurf vom …“ nennt das Rechnungsdatum des anderen Entwurfs.
- Nach dem Löschen eines Entwurfs geht es zur Buchung (dort ist der Knopf „Rechnung“ wieder aktiv).

**Offen für `/backend`** (Schnittstelle, die das Frontend erwartet):
- **Tabelle `invoices`** (erweitert):
  - `origin` zusätzlich `'draft'` (PROJ-41: `'issued'`); `number` und `number_key` bei Entwürfen `null` (Eindeutigkeit und Nummernvorschlag nur über vorhandene Nummern); `booking_id` bei Entwürfen Pflicht.
  - neue Spalten: `kind` (`invoice`/`partial`/`final`, nur Entwurf/ausgestellt), `recipient_kind` (`guest`/`company`), `recipient_name`, `recipient_line1`, `recipient_line2`, `recipient_postal_code`, `recipient_city`, `recipient_country`, `recipient_vat_id` (Texte oder null), `company_salutation` (`generic`/`guest`), `guest_names` (`none`/`main`/`all`), `partial_mode` (`percent`/`amount`), `partial_percent` numeric(5,2), `partial_amount_cents`, `intro_block_id`/`payment_block_id`/`closing_block_id` (uuid, nur Anzeige; beim Löschen des Bausteins null), `intro_text`/`payment_text`/`closing_text` (jsonb wie `isRichDoc` oder null), `deposit_percent` numeric(5,2), `deposit_days`, `due_days`, `due_basis`, `booking_fingerprint` (Text), `deduction_removed` boolean (default false; `delete_invoice_draft` setzt es bei Schlussrechnungen, die den gelöschten Entwurf abzogen; Speichern setzt es zurück).
  - `recipient` (Anzeigename für Liste/Suche) = `recipient_name` (leer → „–“ o. Ä., Spalte bleibt nicht leer).
- **Tabelle `invoice_lines`**: neu `source_kind` (`nights`/`cancellation_fee`/`charge` oder null) und `source_charge_id` (uuid, nur bei `charge`; beim Löschen der Zusatzkosten-Position null).
- **Tabelle `invoice_deductions`** (`invoice_id`, `deducted_invoice_id`, `tenant_id`, `created_at`), Fremdschlüssel `invoice_deductions_invoice_fkey` (invoice_id, tenant_id) und `invoice_deductions_deducted_fkey` (deducted_invoice_id, tenant_id) auf `invoices`; Lesen für Mitglieder, kein direktes Schreiben.
- **`save_invoice_draft(p_input jsonb) → uuid`**: `p_input` = `{ id|null, updated_at|null, tenant_id, booking_id, kind, invoice_date, recipient_kind, recipient {name, line1, line2, postal_code, city, country, vat_id}, company_salutation, guest_names, partial {mode, percent ("20.00"|null), amount_cents}|null, lines [{label, amount_cents, vat_rate ("10.00"), source_kind, source_charge_id}], deduction_ids [uuid], texts {intro|payment|closing: {block_id|null, body|null}}, payment {deposit_percent|null, deposit_days|null, due_days, due_basis}, booking_fingerprint }`.
  - Prüft: Inhaber des Kunden (2FA/aktiv wie gehabt), Buchung des Kunden, keine Sperre, storniert nur mit Stornogebühr; beim **Anlegen** Summenregel (nacherfasst + ausgestellt + Entwürfe < Gesamtpreis bzw. Stornogebühr, sonst P0920); beim Ändern nur Entwürfe (P0923) und Konfliktschutz über `updated_at` (P0903); Positionen ≤ 50 (bei `partial` ≥ 1 Zeile, Summe = `amount_cents` > 0), `source_charge_id` gehört zur Buchung; Zahlungsregeln (Grenzen PROJ-39; ohne Anzahlung beide null); Texte (Struktur, ≤ 2.000 Zeichen, Platzhalter je Block wie `save_invoice_text_block`, {Anzahlung}/{Anzahlung fällig}/{Restbetrag} nur mit Anzahlung); Abzüge nur bei `final`, nur Teilrechnungen (Entwurf/ausgestellt) oder nacherfasste Rechnungen derselben Buchung, nicht sich selbst (P0921); sonst P0922.
  - Bildet `total_cents` (Summe der Positionen minus Summe der abgezogenen Rechnungen), `recipient`, setzt `deduction_removed = false`, schreibt Positionen und Abzüge vollständig neu, Protokoll (Anlegen/Ändern mit Person und Zeit; nie Texte). Ändert sich ein Teilrechnungs-Entwurf, werden Schlussrechnungen, die ihn abziehen, im `total_cents` neu gebildet.
- **`delete_invoice_draft(p_invoice_id uuid) → uuid`** (Buchung des Entwurfs): nur Inhaber, nur Entwürfe (P0923); entfernt Abzüge auf ihn, setzt bei diesen Schlussrechnungen `deduction_removed = true` und bildet `total_cents` neu; Protokoll.
- **`invoice_preview_data(p_tenant_id uuid) → jsonb`** für Inhaber und Mitarbeiter: `{ issuer: {name, name_line2, address_line1, address_line2, postal_code, city, country, vat_id}, footer, small_business_note, vat_status: [{valid_from, small_business}] }`.
- **`booking_invoices`**: je Rechnung zusätzlich `origin` (schon vorhanden) und `kind`; `number` bei Entwürfen null.
- **`save_invoice`** (PROJ-37-Änderung): `p_input.small_business` (boolean) übernehmen statt aus dem Rechnungsdatum bilden.
- **`save_booking`**: Zusatzkosten-Positionen behalten ihre Kennung (Abgleich statt Löschen/Neuanlegen); gelöschte Positionen lösen `invoice_lines.source_charge_id` (null).
- **Lesen:** RLS für die neuen Spalten/Tabellen wie `invoices`; Betreiber ohne Zugriff auf Entwürfe. Buchungsübersicht nutzt `billed:invoices(id)` mit Filter `billed.origin=neq.draft`.
- **Fehlercodes:** P0920 nichts zu verrechnen, P0921 Abzug ungültig, P0922 Inhalt ungültig, P0923 kein Entwurf; dazu die bestehenden (P0901/42501, P0902, P0903, P0908, P0016).
- Nach der Migration die Typen neu erzeugen (`src/types/database.ts` ist von Hand vorbereitet).

### Schreibweise der USt (Frontend, 2026-11-06)
- Kein eigenes Tech Design (Nutzerfreigabe 2026-11-06): nur Texte an einer Stelle, keine Datenbank, keine neuen Bausteine oder Pakete
- `src/lib/invoice-pdf/view.ts` (gemeinsam für Entwurfsvorschau, Musterrechnung und ausgestellte PDFs): Leistungszeilen über Text `lineVat` „{label} · (inkl. {rate} USt.)“; Summen „Summe der Leistungen (inkl. USt.)“/„Rechnungsbetrag (inkl. USt.)“ nur, wenn keine Kleinunternehmer-Rechnung und mindestens eine Position über 0 %; USt-Tabelle links `vatBase` „{rate} aus {net}“ mit Netto = Brutto − USt je Satz (bei Schlussrechnungen die Werte nach Abzug)
- `messages/de.json` (`invoiceDrafts.preview`): `partialShare` „Anteil (inkl. {rate} USt.)“, neu `lineVat`, `subtotalVat`, `totalVat`, `vatBase`
- Unverändert: Detailansichten in der App (Entwurf, ausgestellte und nacherfasste Rechnung, Buchung) – sie sind keine Rechnungsdokumente; Abzugszeilen „darin USt …“
- Bereits ausgestellte PDFs bleiben, weil sie abgelegt sind
- Tests: Unit `view.test.ts` +4 mit den echten deutschen Texten (Zeilen inkl. 0 %, Teilrechnung, Schlussrechnung mit Abzug und Netto nach Abzug, Kleinunternehmer und nur 0 %); E2E PROJ-41 neu „Musterrechnung mit (inkl. 10 % USt.) …“; Regression PROJ-40 Vorschau/Teil-/Schlussrechnung/Kleinunternehmer 18, PROJ-42 PDF 6, PROJ-41 Musterrechnung grün; Unit gesamt grün
- Nebenbei behoben: wackeliger E2E PROJ-40 „Kleinunternehmer-Buchung“ (QA PROJ-39 BUG-1) wartet jetzt auf den Text der PDF-Vorschau; 4/4 grün
- Hinweis: Die Musterrechnung (`src/lib/invoice-pdf/sample.ts`) setzt die Endreinigung mit 20 % an, damit zwei Sätze erscheinen; in Buchungen ist der Vorschlag 10 %

## Implementation Notes (Backend)
**Stand 2026-10-31.** Migration `supabase/migrations/20261031175615_invoice_drafts.sql`, in Dev eingespielt; Typen neu erzeugt (entsprechen der Handvorbereitung); Advisors ohne Befund zur Datenbank (nur die bekannten Auth-Einstellungen in Dev).

**Datenbank:**
- `invoices`: Nummer nullbar, Prüfung „Entwurf ⇔ keine Nummer“; Herkunft `backfilled`/`draft`/`issued`; neue Spalten wie in der Schnittstelle oben, mit Prüfregeln je Spalte (Längen, Werte, Texte über `rich_text_valid` je Block, {Anzahlung} nur mit Anzahlung, Teilbetrag nur bei Teilrechnung). Verweise auf Bausteine mit `on delete set null`. Keine Pflicht für `booking_id` als Tabellenregel (würde das Löschen eines Kunden über die Kaskade stören); erzwungen in `save_invoice_draft`.
- `invoice_lines`: `source_kind`, `source_charge_id` (Fremdschlüssel auf `booking_charges`, `on delete set null`). Bezeichnung in der Tabelle bis 300 Zeichen, weil die Teilrechnungs-Zeile „Anzahlung für Aufenthalt in {Objekt · Wohnung} vom … bis …“ länger als 100 werden kann; eigene Bezeichnungen begrenzen `save_invoice` und `save_invoice_draft` weiter auf 100.
- `invoice_deductions` (Primärschlüssel Schlussrechnung + abgezogene Rechnung), Kaskade auf beiden Seiten, nur Lesen per RLS. Kein eigenes Protokoll; Änderungen stehen über die Schlussrechnung im Protokoll.
- **RLS-Änderung:** Der Betreiber liest bei `invoices`, `invoice_lines` und `invoice_deductions` keine Entwürfe mehr (Spec „Wer darf was“); Mitglieder unverändert. `booking_invoices` liefert dem Betreiber ebenfalls keine Entwürfe.

**Funktionen:**
- `save_invoice_draft`: Prüfungen und Fehlercodes wie in der Schnittstelle. Summenregel nur beim Anlegen, ohne Sperre der Buchung (gleichzeitige Entwürfe werden beide gespeichert, Edge Case). Ändern: nur Entwürfe, Konfliktschutz, Buchung bleibt. Abzüge werden entdoppelt. `guest_id` = aktueller Hauptgast. `small_business` = Momentaufnahme nach der Buchung (Abreise bzw. Stornodatum in Wien). Bausteinverweise nur für eigene Bausteine desselben Blocks, sonst still `null` (z. B. inzwischen gelöscht). Wird eine Teilrechnung zur Rechnung/Schlussrechnung, verlieren Schlussrechnungen den Abzug (`deduction_removed`); bleibt sie Teilrechnung, wird deren Betrag neu gebildet.
- `delete_invoice_draft`: nur Inhaber, nur Entwürfe; Abzüge auf ihn entfallen mit `deduction_removed = true` und neuem Betrag; gibt die Buchung zurück.
- `invoice_preview_data`: für Mitglieder (Inhaber und Mitarbeiter), sonst 42501; Betreiber nicht.
- Hilfen: `booking_billable_cents` (gleiche Regel wie bisher in `booking_invoices`), `invoice_total_cents`, `refresh_deducting_totals`, `detach_deductions`, `json_uuid`.
- `save_invoice` (PROJ-37-Änderung): übernimmt `small_business` (boolean); fehlt der Wert, wie bisher nach dem Rechnungsdatum. Ändert nur nacherfasste Rechnungen (sonst P0902). Ändert sich eine nacherfasste Rechnung, wird der Betrag abziehender Schlussrechnungs-Entwürfe neu gebildet; wechselt ihre Buchung, entfällt der Abzug.
- `delete_invoice`: nur nacherfasste Rechnungen (Entwürfe über `delete_invoice_draft`); Abzüge entfallen wie oben.
- `invoice_numbers`: ohne leere Nummern.
- `save_booking`: Zusatzkosten werden abgeglichen statt neu angelegt (bekannte Kennung dieser Buchung → ändern, nur bei Abweichung; ohne bzw. fremde/doppelte Kennung → neu; fehlende → löschen, Rechnungspositionen verlieren die Verbindung).

**Frontend-Anpassung:** Das Buchungsformular führt die Kennung der Zusatzkosten mit (`Charge.id`, Formularfeld `chargeId`, Aktion sendet `charges[].id`); ohne das hätte `save_booking` die Kennungen nicht behalten können.

**Tests:** `supabase/tests/invoice-drafts.integration.test.ts` (21 Tests: Rechte inkl. Betreiber, Speichern/Ändern/Protokoll, Trennung Entwurf ↔ nacherfasst, Kleinunternehmer nach Buchung, Summenregel, Sperre/Storno, Prüfregeln P0922, Bausteinverweise, Abzüge P0921 und Neuberechnung, stabile Zusatzkosten-Kennungen, Lesen wie die App inkl. Buchungsfilter); `invoices.integration.test.ts` um den Kleinunternehmer-Schalter ergänzt. Unit 516/516, Integration (Rechnungen, Einstellungen, Buchungen, RLS, Gäste, Betreiber, Entwürfe) grün, Build grün.

## QA Test Results

**Tested:** 2026-10-31
**App URL:** http://localhost:3000 (gebauter Server; Safari gegen `npm run dev`), Supabase „apppa-dev“
**Tester:** QA Engineer (AI)

**Automatisierte Tests**
- E2E `tests/PROJ-40-rechnungsdaten-sammeln.spec.ts`: 29 Tests, davon 26 grün und 3 rot (die drei Bug-Tests BUG-1 und BUG-2). Abläufe im Projekt desktop, Layout auf desktop, tablet und mobile.
- Firefox: Kernabläufe grün, rot nur der bekannte BUG-1.
- Safari (WebKit): Vorbelegung und Schlussrechnung grün. Im Vorschau-Test übernimmt WebKit-Automation das per `fill` gesetzte native Datumsfeld nicht. Dasselbe Muster nutzt die ganze App (Buchung, Sperre, Nacherfassen), daher sehr wahrscheinlich eine Grenze der Testautomatisierung und kein PROJ-40-Fehler. Bitte einmal im echten Safari prüfen.
- Integration `supabase/tests/invoice-drafts.integration.test.ts`: 21/21 grün.
- Unit `src/lib/invoice-drafts.test.ts`: 37/37 grün, neu sind die genauen Grenzwerte € 399,99 / € 400,00 / € 9.999,99 / € 10.000,00.
- `npm test` gesamt: 712/713 grün. Rot ist nur der bekannte RLS-Test „Person ohne Mitgliedschaft“: Das Dev-Protokoll hat wieder viele Testreste, und die Abfrage reißt die 8-Sekunden-Grenze. Kein Bezug zu PROJ-40; die Bereinigung braucht die Zustimmung des Nutzers.
- Regression E2E (desktop) grün: PROJ-37 komplett (ein Ausreißer, einzeln wiederholt grün), PROJ-34, PROJ-32, PROJ-8 (Anlegen, Optionen/Storno, Bearbeiten), PROJ-9 (Detailpanel, Anlegen per Klick), PROJ-39 (Nummernkreis).

### Acceptance Criteria Status

#### Knopf „Rechnung“ (10)
- [x] Inhaber: aktiver Knopf rechts außen neben „Stornieren“; Mitarbeiter und Sperre: kein Knopf (E2E)
- [x] € 500 mit Entwurf € 500 → inaktiv mit Begründung; nacherfasst € 200 + Entwurf € 100 → aktiv; Entwurf löschen → wieder aktiv (E2E)
- [x] Option mit Hinweis; storniert ohne Gebühr inaktiv mit Begründung; storniert mit Gebühr € 120 → nur die Gebühr, danach inaktiv (E2E)
- [x] Mitarbeiter am Formular vorbei → abgelehnt (Integration P0901; Server-Aktion `requireOwner`)

#### Seite „Rechnung erstellen“ und Speichern (7)
- [x] Vorbelegung (Art, Empfänger, Rechnungsdatum heute, „Keine Gastnamen“, Positionen, drei Textblöcke) (E2E)
- [x] Speichern → Detailseite „Rechnung (Entwurf)“, „Wird beim Ausstellen vergeben“ (E2E)
- [ ] BUG-1: Rückfrage beim Verlassen kommt bei Links und „Abbrechen“, aber nicht bei der Zurück-Taste des Browsers
- [x] Fehler beim Speichern: Meldung, Eingaben bleiben (per Code-Durchsicht: `setError`, das Formular bleibt stehen)
- [x] Zwei Inhaber: „Der Entwurf wurde inzwischen geändert“, Änderung nicht gespeichert; „Aktuelle Fassung laden“ zeigt die neue Fassung (E2E)
- [x] Protokoll mit Person beim Anlegen, Ändern und Löschen (E2E + Integration)
- [x] 375 px: kein seitliches Scrollen, Felder und Knöpfe mindestens 44 px, keine WCAG-2.1-AA-Verstöße (E2E auf mobile, tablet, desktop)

#### Positionen (6)
- [x] Übernachtung, Reinigung, Rabatt in der Reihenfolge der Buchung angewählt (E2E)
- [x] Zweiter Entwurf: Übernachtung abgewählt mit „in Entwurf vom 20.10.2026“; bewusst angewählt wird übernommen (E2E)
- [x] Eigene Beträge und Positionen gespeichert, Buchung und Gast unverändert (E2E)
- [x] Alle abgewählt: speicherbar, Pflichtangaben „Keine Position“ (E2E)
- [x] Teilrechnung verbraucht keine Positionen (E2E + Unit)

#### Teilrechnung (5)
- [x] 20 % von € 1.000 → € 200 (€ 180 zu 10 %, € 20 zu 20 %) mit USt je Satz (E2E)
- [x] Betrag € 250,00 → „entspricht 25 %“ wird angezeigt (E2E). Speichern über „Betrag“ siehe BUG-2.
- [ ] BUG-2: Teilbetrag 0 → Fehlermeldung nur ohne vorherigen Wechsel Prozent/Betrag. Nach einem Wechsel keine Meldung, und auch gültige Beträge lassen sich nicht speichern.
- [x] Über dem Gesamtpreis: Hinweis, Speichern möglich (E2E)
- [x] Kleinunternehmer: keine USt, Hinweis nach Block 5 (E2E)

#### Schlussrechnung (5)
- [x] Alle Positionen voll, Teilrechnung vorausgewählt, Betrag € 800,00 (E2E)
- [x] Abzugszeile „abzüglich Teilrechnung (Entwurf) vom 03.10.2026“ mit Betrag und USt je Satz (E2E)
- [x] Nacherfasste Rechnung abgewählt und anwählbar; Rechnung (Art Rechnung) nicht bei den Abzügen, ihre Positionen abgewählt (E2E)
- [x] Abzüge > Leistungen → negativ in Rot mit Hinweis (E2E)

#### Empfänger (5)
- [x] Firma vorausgewählt mit Firmenname, Rechnungsanschrift, UID; ohne Firma „Gast“ mit Titeln, „Firma“ nicht wählbar (E2E)
- [x] Überschriebene Anschrift gespeichert, Gast unverändert (E2E); spätere Gast-Änderung wirkt nicht (Kopie in der Datenbank, Integration)
- [x] Wechsel Firma → Gast nach Änderungen mit Rückfrage (E2E)

#### Rechnungsdatum und Gastnamen (4)
- [x] Vergangenheit mit Hinweis, Speichern möglich (E2E); gespeichertes Datum bleibt (Datenbank, Integration)
- [x] Firma → „Keine Gastnamen“; „Hauptgast mit Mitreisenden“ in der Vorschau in Reihenfolge mit Titeln (E2E)

#### Textblöcke und Platzhalter (7)
- [x] Standard vorausgewählt; geänderter Text bleibt beim Baustein unverändert; Baustein in den Einstellungen geändert → Entwurf behält den alten Text; Ersetzen nur nach Rückfrage (E2E)
- [x] „Unbekannter Platzhalter: {Gastname}“ verhindert das Speichern (E2E)
- [x] {Anrede} bei Firma „Sehr geehrte Damen und Herren“ bzw. Anrede des Hauptgasts; {Rechnungsnummer} → „Entwurf“ (E2E)

#### Zahlungsregeln (5)
- [x] Spec-Beispiel: € 90,00 fällig 04.10.2026, Rest € 360,00 fällig 13.10.2026 (E2E + Unit)
- [x] 30 % je Rechnung, Baustein bleibt bei 20 % (E2E)
- [x] Ohne Zahlungsbaustein am Rechnungsdatum fällig; Fälligkeit vor dem Rechnungsdatum → sofort mit Hinweis (E2E); Anzahlung nie nach dem Rest (Unit)

#### Kleinunternehmer und USt (3)
- [x] Nach der Abreise, unabhängig vom Rechnungsdatum (E2E + Integration); neuer Verlauf wirkt beim Öffnen (Status wird je Aufruf ermittelt)
- [x] Nacherfasste Rechnungen unverändert (PROJ-37-Regression grün)

#### Pflichtangaben (6)
- [x] € 300 ohne Anschrift kein Fehler; € 500 ohne PLZ Fehler mit „Zum Feld“ (Fokus); UID des Ausstellers fehlt mit „Zu den Stammdaten“; € 12.000 ohne Empfänger-UID; speichern trotz Fehlern; vollständig alle ✓ (E2E + Unit)

#### Vorschau (4)
- [x] Reihenfolge Kopfzeile → Block 1 → 2b → 2c „Entwurf“ → 2a → 3 → 4 → 5 → 6 → 7 → Fußzeile, Kennzeichen „Entwurf“, Platzhalter ersetzt (E2E)
- [x] Alle Datumsangaben ohne Wochentag (E2E)
- [x] „Zurück zum Entwurf“ ohne Datenverlust (E2E)
- [x] Mitarbeiter: Vorschau ohne Bearbeitungsknöpfe (E2E)

#### Detail, Listen und Buchungsänderung (7)
- [x] Rechnungsliste: Nummer „–“, Rechnungsdatum, Empfänger, Betrag, „Entwurf“ + Art (E2E)
- [x] Buchungsdetail: „Verrechnet: € 200,00“, „In Entwürfen: € 100,00“ (E2E)
- [x] Filter „ohne Rechnung“ zeigt Buchung mit nur einem Entwurf, Spalte „Entwurf“ als Link (E2E + Integration)
- [x] Löschen: Abbrechen behält, Bestätigen entfernt (E2E)
- [x] Preis geändert → Hinweis + „Positionen neu übernehmen“; Bestätigen übernimmt die aktuellen Positionen (E2E)
- [x] Storno ohne Gebühr: Entwurf bleibt, Hinweis (Fingerabdruck enthält den Stornostatus; Unit + Integration)

### Edge Cases Status
- [x] Teilrechnung bei nur einem USt-Satz, Rundungsrest beim größten Anteil (Unit)
- [x] Abgezogener Teilrechnungs-Entwurf gelöscht → Abzug entfällt, Betrag neu, Hinweis auf Detailseite und im Formular (Integration); Teilrechnung wird zur Rechnung → Abzug entfällt (Integration)
- [x] Mehrere Teilrechnungen alle vorausgewählt (Unit)
- [x] Gleichzeitiges Anlegen zweier Entwürfe: beide gespeichert (Server sperrt bewusst nicht)
- [x] Lange Firmennamen am Handy umgebrochen (Layout-Test mit 110 Zeichen)
- [x] Platzhalter {Anzahlung} ohne Anzahlung verhindert das Speichern (Integration P0922, Unit)
- [ ] Spec-Widerspruch (kein Code-Fehler): Der Edge Case „Hauptgast gewechselt → Änderungshinweis erscheint“ widerspricht dem Edge Case „Änderungshinweis nur bei Preis/Positionen/Storno“. Gebaut ist die zweite Regel: Der Fingerabdruck enthält den Hauptgast nicht, ein Gastwechsel löst also keinen Hinweis aus. Bitte entscheiden; siehe BUG-3.
- [ ] Gelöschte abgezogene Rechnung: Der Hinweis erscheint auf Detailseite und im Formular, aber nicht auf der eigenen Vorschau-Seite `/rechnungen/[id]/vorschau` (BUG-5)

### Security Audit Results
- [x] Ohne Anmeldung kein Zugriff (Seiten hinter der Anmeldung, Funktionen nur für `authenticated`)
- [x] Mitarbeiter: kein Anlegen, Ändern oder Löschen (Server-Aktion + Datenbank P0901); `/rechnungen/neu` und `/bearbeiten` → „nicht gefunden“ (E2E)
- [x] Fremder Kunde: Detail, Vorschau, Bearbeiten und „Rechnung erstellen“ → „nicht gefunden“ (E2E); Datenbank lehnt fremde Buchungen, Zusatzkosten, Abzüge und Bausteine ab (Integration)
- [x] Betreiber sieht keine Entwürfe samt Positionen und Abzügen; `invoice_preview_data` lehnt ihn ab (Integration)
- [x] Manipulierte Eingaben: Gesamtbetrag, Teilbetrag-Aufteilung und Fingerabdruck bildet der Server; die Datenbank prüft Positionen, Summe der Teilrechnung, Texte und Abzüge (Integration, 22 Fälle P0922/P0921)
- [x] XSS: HTML im Empfängernamen und in der Adresse wird als Text angezeigt, kein Skript läuft (E2E); Texte nur als geprüfte JSON-Struktur, kein HTML
- [x] Direktes Schreiben in `invoices` oder `invoice_deductions` gesperrt (Integration)
- [x] Keine Geheimnisse im Browser; `invoice_preview_data` liefert Mitarbeitern nur Ausstellerdaten, Fußzeile und Kleinunternehmer-Verlauf (gewollt)
- [ ] Hinweis (kein Fehler): Speichern und Löschen von Entwürfen haben keine eigene Mengenbegrenzung, wie alle Formular-Aktionen der App. Zugang nur für angemeldete Inhaber.

### Bugs Found

#### BUG-1: Zurück-Taste des Browsers verlässt „Rechnung erstellen“ ohne Rückfrage
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Buchung öffnen → „Rechnung“
  2. Ein Feld ändern (z. B. Adresszeile 1)
  3. Zurück-Taste des Browsers (oder Wischgeste am Handy)
  4. Expected: Rückfrage „Seite verlassen?“ (Kriterium „wenn der Inhaber die Seite verlassen will“)
  5. Actual: Die Buchung öffnet sich ohne Rückfrage, die Eingaben sind verloren. Links, „Abbrechen“ und Neu laden fragen korrekt nach.
- **Ursache (vermutlich):** `useUnsavedGuard` fängt Klicks auf Links und `beforeunload` ab, aber nicht die Verlaufs-Navigation (`popstate`) des App-Routers.
- **Test:** `BUG-1: Zurück-Taste …` (rot, desktop und Firefox)
- **Priority:** Fix before deployment (Datenverlust beim Erstellen)

#### BUG-2: Teilrechnung lässt sich nach Wechsel Prozent ↔ Betrag nicht speichern, keine Meldung
- **Severity:** High
- **Steps to Reproduce:**
  1. „Rechnung erstellen“ → Art „Teilrechnung“
  2. „Eingabe als: Betrag“ wählen, € 250,00 eingeben (Anzeige „entspricht 25 %“ stimmt)
  3. „Entwurf speichern“
  4. Expected: Entwurf wird gespeichert (bzw. bei 0: „Bitte gib einen Teilbetrag größer als 0 ein.“)
  5. Actual: Nichts passiert. Keine Anfrage an den Server, keine Fehlermeldung, kein Feld markiert. Gilt nach jedem Wechsel zwischen Prozent und Betrag, auch zurück zu Prozent. Ohne Wechsel (nur Prozent) funktioniert es.
- **Ursache (vermutlich):** Prozent- und Betragsfeld stehen in `draft-form.tsx` als zwei `FormField` an derselben Stelle im Baum (Bedingung `partialMode === 'percent' ? … : …`). React verwendet die Instanz weiter; beim Namenswechsel verliert das ausgeblendete Feld seinen Wert (`undefined`). Die Prüfung `z.string()` scheitert dann an diesem unsichtbaren Feld, bevor die eigentliche Regel läuft. Abhilfe z. B. eigener `key` je Feld oder beide Werte beim Wechsel als Text erhalten.
- **Test:** zwei `BUG-2: …`-Tests (rot)
- **Priority:** Fix before deployment (Teilrechnung über Eurobetrag ist ein Kernablauf)

#### BUG-3: Spec-Widerspruch beim Wechsel des Hauptgasts (Änderungshinweis)
- **Severity:** Low (Entscheidung, kein Code-Fehler)
- **Details:** Edge Cases: „Hauptgast der Buchung wird gewechselt: … Änderungshinweis erscheint“ gegenüber „Änderungshinweis nur bei Preis/Positionen/Storno“. Gebaut ist die zweite Regel; Gastnamen und {Gast}/{Anrede} folgen ohnehin der Buchung, nur die Empfängerkopie bleibt alt.
- **Priority:** Spec per `/refine` klären (Fingerabdruck um Hauptgast erweitern oder Edge Case streichen)

#### BUG-4: Buchungslink im Kopf von „Rechnung erstellen“ kleiner als 44 px (Handy)
- **Severity:** Low
- **Details:** Der Textlink „Buchung 2026-…“ im grauen Kopfkasten ist niedriger als 44 px. Das Kriterium nennt nur Felder, Editoren und Knöpfe; als Touch-Ziel trotzdem knapp. Der Link „Zurück zur Buchung“ darüber erfüllt 44 px.
- **Priority:** Nice to have

#### BUG-5: Eigene Vorschau-Seite zeigt den Hinweis „Abgezogene Rechnung existiert nicht mehr“ nicht
- **Severity:** Low
- **Details:** Nach dem Löschen einer abgezogenen Teilrechnung zeigen Detailseite und Formular den Hinweis (`deduction_removed`). `/rechnungen/[id]/vorschau` rechnet zwar richtig, zeigt ihn aber nicht. Die Abzüge sind dort schon entfernt, deshalb ist `missingDeductions` 0.
- **Priority:** Nice to have

### Summary (Runde 1)
- **Acceptance Criteria:** 72/74 bestanden (2 mit Bugs: Rückfrage bei Zurück-Taste, Teilbetrag nach Wechsel Prozent/Betrag)
- **Bugs Found:** 5 total (0 critical, 1 high, 1 medium, 3 low)
- **Security:** Pass
- **Production Ready:** NO (Runde 1)

### QA Runde 2 (2026-10-31)
Alle fünf Bugs behoben (Nutzer: Option 3, BUG-3 entschieden mit „Ja“):
- **BUG-1** behoben: `use-unsaved-guard` legt bei der ersten Änderung einen zweiten Verlaufseintrag derselben Seite an (gleicher Router-Zustand). Die Zurück-Taste landet dort, die Rückfrage erscheint; „Weiter bearbeiten“ legt ihn neu an, „Verwerfen“ geht einen Schritt weiter zurück. Getestet in Chrome, Firefox und Safari. Nebenwirkung: Nach dem Verlassen per Link oder Speichern bleibt ein doppelter Verlaufseintrag derselben Seite zurück (einmal mehr „Zurück“).
- **BUG-2** behoben: eigener `key` für das Prozent- und das Betragsfeld der Teilrechnung. Speichern mit Betrag nach einem Wechsel und die Meldung bei 0 funktionieren (Chrome, Firefox, Safari).
- **BUG-3** behoben: Der Fingerabdruck enthält den Hauptgast; Hinweistext „(Preis, Positionen, Storno oder Hauptgast)“; Spec angepasst. Der Knopf „Positionen neu übernehmen“ ersetzt weiter nur die Positionen; den Empfänger belegt der Inhaber bei Bedarf über die Wahl Gast/Firma neu. Bestehende Entwürfe in Dev zeigen den Hinweis einmal (neuer Fingerabdruck).
- **BUG-4** behoben: Der Buchungslink im Kopf ist mindestens 44 px hoch; die Layoutprüfung erfasst Links wieder.
- **BUG-5** behoben: Die Vorschau (Seite und Formular) zeigt „Abgezogene Rechnung existiert nicht mehr“ auch bei `deduction_removed`.

Tests Runde 2:
- E2E PROJ-40 desktop: alle grün, inkl. der Bug-Tests (BUG-1 erweitert um „Weiter bearbeiten“/„Verwerfen“, neue Tests für BUG-3 und BUG-5). Ein Ausreißer (Datum vor der Übernahme durch React eingetragen) war bei dreifacher Wiederholung grün.
- Layout mobile/tablet/desktop grün; die Layoutprüfung übergeht jetzt unsichtbare Radix-Hilfsfelder (`aria-hidden`).
- Firefox: Bug-Tests und Rückfrage grün. Safari: BUG-1 und BUG-2 grün.
- `npm test`: 714/714 grün, auch der RLS-Test nach der Bereinigung des Dev-Protokolls (58.373 Waisenzeilen, vom Nutzer im SQL-Editor gelöscht).
- Offen, manuell: Rechnungsdatum einmal im echten Safari wählen (WebKit-Automation übernimmt `fill` bei nativen Datumsfeldern nicht).

### Summary
- **Acceptance Criteria:** 74/74 bestanden
- **Bugs Found:** 5 total, alle behoben
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment
- **Datum:** 2026-10-31, Version v1.18.0
- **Commit:** `8c009b6` (Branches `staging` und `production`); Staging vom Nutzer geprüft und für Production freigegeben
- **Staging:** https://staging.apppa.at
- **Production:** https://app.apppa.at
- **Migrationen:** `20261031175615_invoice_drafts.sql` (Staging und Produktion; Advisors nur bekannte Auth-Hinweise: Staging `auth_otp_long_expiry` + `auth_leaked_password_protection`, Produktion `auth_otp_long_expiry`)
- **Neue Pakete / Umgebungsvariablen / `config push`:** keine
- **Mit ausgeliefert:** PROJ-37-Änderung „Ohne Umsatzsteuer (Kleinunternehmer)“ je nacherfasster Rechnung; Buchhaltungs-Commit PROJ-39 (`dcc710a`)
- **Vorabprüfung:** Lint und Build grün; Unit-/Integrationstests im Gesamtlauf 710/714 (3 Zeitüberschreitungen unter Last, 1 bekannter RLS-Testrest), die vier Dateien einzeln nacheinander 67/67 grün
- **Tag:** `v1.18.0-PROJ-40` auf `8c009b6`
