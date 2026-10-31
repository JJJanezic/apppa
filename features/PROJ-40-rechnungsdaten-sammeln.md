# PROJ-40: Rechnungsdaten sammeln (Entwurf)

## Status: Architected
**Created:** 2026-10-31
**Last Updated:** 2026-10-31

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
- **Buchung geändert:** Wurden Preis, Positionen oder Stornostatus der Buchung nach dem letzten Speichern des Entwurfs geändert, zeigen Detailseite und Formular „Die Buchung wurde seit dem Entwurf geändert“ mit dem Knopf „Positionen neu übernehmen“ (ersetzt nach Rückfrage die Positionen; Vorauswahl wie beim Anlegen). Ohne Klick bleibt der Entwurf unverändert. Zeitraum, Wohnung und Gastnamen sind immer aktuell.
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
- **Wohnung oder Zeitraum der Buchung geändert:** Blöcke 2a/3 und Platzhalter folgen der Buchung; Fristen „vor Anreise“ werden neu berechnet; Änderungshinweis nur bei Preis/Positionen/Storno.
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
| Bausteintexte als Kopie im Entwurf, Platzhalter erst in der Vorschau ersetzt | Änderungen an Einstellungen wirken nicht auf Entwürfe (PROJ-39); Werte wie Zeitraum bleiben aktuell | 2026-10-31 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Entwürfe in derselben Rechnungstabelle wie PROJ-37; „Herkunft“ bekommt den Wert „Entwurf“ (PROJ-41 ergänzt „ausgestellt“), Nummer bei Entwürfen leer | Liste, Rechnungen je Buchung, Spalte und Summen funktionieren ohne zweite Quelle; Ausstellen wird in PROJ-41 ein Zustandswechsel statt Umkopieren; leere Nummern stören weder Eindeutigkeit noch Nummernvorschlag | 2026-10-31 |
| Prüfung „hat ausgestellte Rechnungen“ (PROJ-39) fragt künftig gezielt nach „ausgestellt“ statt „nicht nacherfasst“ | Sonst würde schon der erste Entwurf die Warnung beim Ändern des Nummernkreises auslösen | 2026-10-31 |
| Empfänger als eigene Felder an der Rechnung (Art Gast/Firma, Name, Adresszeilen, PLZ, Ort, Staat, UID); das bisherige Freitextfeld bleibt für nacherfasste Rechnungen und als Anzeigename | Pflichtangaben-Prüfung braucht einzelne Felder; nacherfasste Rechnungen bleiben unverändert | 2026-10-31 |
| Herkunft jeder Rechnungsposition: „Übernachtung“, „Stornogebühr“ oder eine bestimmte Zusatzkosten-Position der Buchung | Grundlage für die Vorauswahl „noch nicht verrechnet“ | 2026-10-31 |
| Zusatzkosten-Positionen einer Buchung behalten beim Speichern der Buchung ihre Kennung (bisher bei jedem Speichern neu angelegt) | Ohne stabile Kennung ginge die Verbindung Rechnungsposition → Buchungsposition bei jeder Buchungsänderung verloren; gelöschte Zusatzkosten verlieren die Verbindung bewusst | 2026-10-31 |
| „Buchung geändert“ über einen Fingerabdruck der preisrelevanten Buchungsdaten (Positionen, Beträge, Sätze, Stornostatus), am Entwurf gespeichert | Hinweis erscheint nur bei Änderungen, die die Positionen betreffen, nicht bei jeder Änderung an Notiz oder Mitreisenden | 2026-10-31 |
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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
