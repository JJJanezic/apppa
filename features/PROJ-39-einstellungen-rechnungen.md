# PROJ-39: Einstellungen → Rechnungen

## Status: In Progress
**Created:** 2026-10-31
**Last Updated:** 2026-10-31

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Einstellungen nur für Inhaber, Mandantentrennung
- Requires: PROJ-5 (Betreiber-Admin): Kunden-Detailseite, Betreiber-Protokoll
- Requires: PROJ-28 (Kundenstammdaten): Konfliktschutz und Protokoll als Vorbild; Ort des Kunden für Block 2b
- Requires: PROJ-29 (Gast-Erweiterung): Titel und Geschlecht für den Platzhalter {Anrede}
- Requires: PROJ-36 (Kleinunternehmer-Status): Bedingung für den Kleinunternehmer-Hinweis
- Requires: PROJ-37 (Rechnungen nacherfassen): Schalter „Rechnungen nacherfassen“ (wird verschoben); nacherfasste Nummern zählen für die nächste Nummer
- Requires: PROJ-38 (Stammdaten): Reiter-Struktur der Einstellungen
- Wird genutzt von: PROJ-40 (Rechnungsdaten sammeln): Bausteine, Zahlungsregeln, Platzhalter im Entwurf; PROJ-41 (Ausstellen mit PDF): Nummernkreis, Fußzeile, Kleinunternehmer-Hinweis

## Überblick
Zweites Paket der Gliederung des Rechnungsmoduls (PROJ-38 bis PROJ-42). Die Einstellungen bekommen einen neuen Reiter **„Rechnungen“** (`/einstellungen/rechnungen`), Reihenfolge: **Stammdaten, Team, Wohnungen, Rechnungen**. Der Betreiber bekommt auf der Kunden-Detailseite einen gleichwertigen Abschnitt **„Rechnungen“**.

Hier wird nur **eingestellt**. Rechnungen entstehen erst mit PROJ-40 (Entwurf) und PROJ-41 (Ausstellen, PDF). Anordnung, Schriftart und Schriftgröße folgen mit PROJ-41.

### Aufbau einer Rechnung (Übersicht)
Die Übersicht zeigt alle Bereiche einer Rechnung und was davon in PROJ-39 eingestellt wird. Reihenfolge von oben nach unten.

| Bereich | Inhalt | Herkunft | In PROJ-39 einstellbar |
|---|---|---|---|
| Kopfzeile | Logo, Aussteller (Name, Adresse, UID) | Stammdaten (PROJ-28, PROJ-38) | nein |
| Block 1 Empfänger | Name, Adresse, PLZ, Ort, Staat, ggf. UID | Gast oder Firma, im Entwurf gewählt (PROJ-40) | nein |
| Block 2a | „Rechnung für“ [Wohnung] vom [Anreise] bis [Abreise] | Buchung | nein |
| Block 2b | [Ort des Kunden], [Rechnungsdatum] | Stammdaten, Entwurf | nein |
| Block 2c | [Rechnungsnummer] | Nummernkreis | **ja: Nummernkreis** |
| Block 3 | Hauptgast, wahlweise mit Mitreisenden | Buchung; Entscheidung nur beim Erstellen der einzelnen Rechnung (PROJ-40) | nein |
| Block 4 Einleitung | freier Text | Textbaustein | **ja: Bausteine** |
| Block 5 Leistungen | Positionen, Summe, USt je Satz | Buchung (PROJ-34/35) | nein |
| Kleinunternehmer-Hinweis | fester Satz, nur wenn der Kleinunternehmer-Status gilt (PROJ-36) | eigener Text | **ja: ein Text** |
| Block 6 Zahlungsmodalitäten | freier Text mit Zahlungsregeln (Anzahlung, Fälligkeit) | Textbaustein | **ja: Bausteine mit Zahlungsregeln** |
| Block 7 Abschlusstext | freier Text | Textbaustein | **ja: Bausteine** |
| Fußzeile | fester Text (z. B. Bankverbindung, Kontakt) | eigener Text | **ja: ein Text** |

### Inhalt des Reiters „Rechnungen“
Vier Abschnitte, jeder wird für sich gespeichert:

1. **Nummernkreis**: Format, Startnummer, Vorschau der nächsten Nummer
2. **Textbausteine** für Block 4 (Einleitung), Block 6 (Zahlungsmodalitäten) und Block 7 (Abschlusstext)
3. **Feste Texte**: Kleinunternehmer-Hinweis und Fußzeile
4. **Nacherfassen**: Schalter „Rechnungen nacherfassen“ (aus *Stammdaten* hierher verschoben, Verhalten wie PROJ-37)

### Nummernkreis
| Einstellung | Regel | Voreinstellung |
|---|---|---|
| Präfix | optional, bis 10 Zeichen (Buchstaben, Ziffern, `-`, `/`, `_`, `.`) | leer |
| Jahreszahl | mit oder ohne vierstellige Jahreszahl (JJJJ) des Rechnungsdatums | mit |
| Trennzeichen | zwischen Jahreszahl und laufender Nummer: `-`, `/`, `.` oder keines | `-` |
| Stellen | 3 bis 6, mit führenden Nullen; wird die Zahl größer, wächst die Nummer einfach weiter | 4 |
| Jährlich neu beginnen | ja/nein; „ja“ nur möglich, wenn die Jahreszahl enthalten ist | ja |
| Startnummer | ganze Zahl ab 1; gilt, solange es im laufenden Kreis noch keine passende Rechnung gibt; bei „jährlich neu“ nur für das Jahr, in dem sie eingetragen wurde, danach beginnt jedes Jahr bei 1 | 1 |

**Aufbau:** [Präfix][JJJJ][Trennzeichen][laufende Nummer], z. B. „2026-0012“, „R-2026/0012“, „R-00123“.

**Nächste Nummer:** höchste laufende Nummer aller Rechnungen des Kunden (nacherfasst und ausgestellt), deren Nummer zum eingestellten Format passt (bei „jährlich neu“: im Jahr des Rechnungsdatums), plus 1; gibt es keine, die Startnummer. Nummern in anderem Format (z. B. „ALT-17“) zählen nicht mit. Die **Vorschau** zeigt die nächste Nummer für ein Rechnungsdatum heute.

Vergeben wird die Nummer erst beim Ausstellen (PROJ-41); dort kann sie überschrieben werden (z. B. um Lücken aufzufüllen). Eine schon vergebene Nummer wird abgelehnt, eine Lücke ergibt nur einen Hinweis (PROJ-41).

### Textbausteine (Blöcke 4, 6, 7)
- Je Block eine Liste von **Bausteinen**, höchstens 20 je Block.
- Jeder Baustein hat einen **Namen** (Pflicht, bis 60 Zeichen, je Block eindeutig ohne Rücksicht auf Groß-/Kleinschreibung) und einen **Text** (Pflicht, bis 2.000 Zeichen ohne Formatierung).
- Höchstens ein Baustein je Block ist als **Standard** markiert. Der Standard ist im Entwurf (PROJ-40) vorausgewählt; ohne Standard beginnt der Block im Entwurf leer. Im Entwurf kann man einen anderen Baustein wählen, den Text für diese Rechnung ändern oder den Block leeren.
- Reihenfolge in der Liste: Standard zuerst, dann nach Name.
- Anlegen, Bearbeiten, Als Standard setzen, Standard aufheben, Löschen (mit Bestätigung).

**Zusätzlich bei Block 6 (Zahlungsmodalitäten): Zahlungsregeln je Baustein**
| Regel | Werte | Beispiel |
|---|---|---|
| Anzahlung | ja/nein | ja |
| Anzahlung in Prozent | 1 bis 100, bis 2 Nachkommastellen (nur bei „ja“) | 20 |
| Anzahlung fällig | 0 bis 365 Tage nach Rechnungsdatum (nur bei „ja“) | 3 |
| Fälligkeit (Rest bzw. Gesamtbetrag) | Bezug „Tage nach Rechnungsdatum“ oder „Tage vor Anreise“, 0 bis 365 Tage | 1 Tag vor Anreise |

Die Anzahlung ist eine Zahlungsbedingung innerhalb **einer** Rechnung, keine eigene Anzahlungsrechnung. Im Entwurf (PROJ-40) setzt die Wahl des Bausteins diese Werte; dort sind sie je Rechnung änderbar. Zahlungen erfassen und Fristen überwachen kommt mit dem Zahlungsmodul (PROJ-13).

### Editor
Ein kleiner, beschränkter Editor für Bausteine, Kleinunternehmer-Hinweis und Fußzeile:
- **Erlaubt:** fett, kursiv, Absätze, Zeilenumbruch, Aufzählung (Punkte) und nummerierte Liste
- **Nicht erlaubt:** freies HTML, Links, Farben, Schriftarten, Schriftgrößen, Bilder, Tabellen
- **Einfügen aus Word, E-Mail oder Webseite:** übrig bleiben nur die erlaubten Formatierungen
- **Platzhalter** werden über eine Auswahl „Platzhalter einfügen“ eingesetzt und im Editor als Markierung angezeigt. Von Hand getippte Platzhalter in richtiger Schreibweise werden ebenfalls erkannt; unbekannte (z. B. „{Gastname}“) führen zum Hinweis „Unbekannter Platzhalter: {Gastname}“ und verhindern das Speichern.
- **Vorschau** unter dem Editor: der Text so, wie er auf der Rechnung erscheinen würde, mit Platzhaltern gefüllt durch Beispieldaten (z. B. „Sehr geehrte Frau Mag. Muster“, „Top 1“, „14.10.2026“, „€ 450,00“).

### Platzhalter
Datumsangaben in Platzhaltern stehen **ohne Wochentag** (bewusste Ausnahme von PROJ-31). Beträge wie PROJ-31 („€ 450,00“). Ersetzt werden die Platzhalter erst im Entwurf (PROJ-40).

| Platzhalter | Ergibt (Beispiel) | Erlaubt in |
|---|---|---|
| {Anrede} | „Sehr geehrte Frau Dr. Huber“ / „Sehr geehrter Herr Huber“; ohne bekanntes Geschlecht „Sehr geehrte/r Maria Huber“ | Blöcke 4, 6, 7 |
| {Gast} | „Dr. Maria Huber“ (Hauptgast, mit Titeln) | Blöcke 4, 6, 7 |
| {Wohnung} | „Top 3“ | Blöcke 4, 6, 7 |
| {Anreise} | „14.10.2026“ | Blöcke 4, 6, 7 |
| {Abreise} | „17.10.2026“ | Blöcke 4, 6, 7 |
| {Nächte} | „3“ | Blöcke 4, 6, 7 |
| {Rechnungsnummer} | „2026-0012“ | Blöcke 4, 6, 7 |
| {Rechnungsdatum} | „31.10.2026“ | Blöcke 4, 6, 7 |
| {Betrag} | „€ 450,00“ (Rechnungsbetrag) | Blöcke 4, 6, 7 |
| {Fälligkeitsdatum} | „13.11.2026“ (Fälligkeit des Rests bzw. ohne Anzahlung des Gesamtbetrags) | Block 6 |
| {Anzahlung} | „€ 90,00“ (Prozent vom Rechnungsbetrag, auf Cent gerundet) | Block 6, nur Bausteine mit Anzahlung |
| {Anzahlung fällig} | „03.11.2026“ | Block 6, nur Bausteine mit Anzahlung |
| {Restbetrag} | „€ 360,00“ (Rechnungsbetrag minus Anzahlung) | Block 6, nur Bausteine mit Anzahlung |

Kleinunternehmer-Hinweis und Fußzeile kennen **keine** Platzhalter.

### Feste Texte
| Text | Regel | Voreinstellung |
|---|---|---|
| Kleinunternehmer-Hinweis | genau ein Text, Pflicht (darf nicht leer sein), bis 500 Zeichen; erscheint nach Block 5 nur, wenn für die Rechnung der Kleinunternehmer-Status gilt; im Entwurf weder änderbar noch entfernbar | „Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG“ |
| Fußzeile | genau ein Text, optional, bis 2.000 Zeichen; erscheint auf jeder Rechnung unverändert; im Entwurf nicht änderbar | leer |

### Vorbelegung
Bestehende und neue Kunden erhalten dieselbe Vorbelegung als **eigene Kopie**. Alles ist kundenspezifisch änderbar und löschbar; spätere Änderungen an den Beispielen der App wirken nicht auf bestehende Kunden.

| Block | Baustein (Name) | Text | Standard |
|---|---|---|---|
| 4 Einleitung | „Dank für den Aufenthalt“ | „{Anrede}, vielen Dank für Ihren Aufenthalt in {Wohnung} vom {Anreise} bis {Abreise}. Wir erlauben uns, wie folgt zu verrechnen:“ | ja |
| 6 Zahlungsmodalitäten | „Überweisung 14 Tage“ | „Bitte überweisen Sie den Betrag von {Betrag} bis {Fälligkeitsdatum}.“ — ohne Anzahlung, fällig 14 Tage nach Rechnungsdatum | ja |
| 6 Zahlungsmodalitäten | „Anzahlung 20 %, Rest vor Anreise“ | „Bitte überweisen Sie die Anzahlung von {Anzahlung} bis {Anzahlung fällig}, damit Ihre Buchung fix ist. Den Restbetrag von {Restbetrag} bitten wir bis {Fälligkeitsdatum} zu begleichen.“ — Anzahlung 20 % binnen 3 Tagen, Rest 1 Tag vor Anreise | nein |
| 7 Abschlusstext | „Nächster Besuch“ | „Wir freuen uns auf Ihren nächsten Besuch!“ | ja |

Dazu: Kleinunternehmer-Hinweis mit Gesetzestext, Fußzeile leer, Nummernkreis JJJJ-NNNN jährlich neu ohne Präfix, Startnummer 1.

### Wer darf was
| Aktion | Inhaber | Betreiber | Mitarbeiter |
|---|---|---|---|
| Reiter bzw. Abschnitt „Rechnungen“ sehen | ✓ (*Einstellungen → Rechnungen*) | ✓ (Kunden-Detailseite, jeder Kunde) | – („Seite nicht gefunden“) |
| Nummernkreis, Bausteine, feste Texte, Schalter ändern | ✓ | ✓ bei aktiven Kunden; bei deaktivierten nur ansehen | – |

## User Stories
- Als **Inhaber** möchte ich das Format meiner Rechnungsnummern so einstellen, wie ich es aus meinem bisherigen System kenne, damit die Nummernfolge nach den nacherfassten Rechnungen nahtlos weiterläuft.
- Als **Inhaber** möchte ich vor dem Speichern sehen, welche Nummer die nächste Rechnung bekommt, damit ich Fehler im Format sofort bemerke.
- Als **Inhaber** möchte ich für Einleitung, Zahlungsmodalitäten und Abschlusstext mehrere Textbausteine anlegen und einen als Standard markieren, damit ich für die übliche Rechnung nichts schreiben muss und für Sonderfälle passende Texte bereitliegen.
- Als **Inhaber** möchte ich in Bausteinen Platzhalter wie {Anrede}, {Wohnung} oder {Fälligkeitsdatum} verwenden, damit die Texte automatisch zur jeweiligen Buchung passen.
- Als **Inhaber** möchte ich für einen Zahlungsbaustein eine Anzahlung (Prozent, Frist) und die Fälligkeit des Rests (z. B. 1 Tag vor Anreise) festlegen, damit Beträge und Termine auf der Rechnung automatisch stimmen.
- Als **Inhaber** möchte ich beim Schreiben eines Bausteins sofort sehen, wie er mit Beispieldaten aussieht, damit Satzbau und Fristen stimmen.
- Als **Inhaber** möchte ich eine Fußzeile mit Bankverbindung und Kontakt einmal anlegen, damit sie auf jeder Rechnung steht.
- Als **Inhaber mit Kleinunternehmer-Status** möchte ich, dass der gesetzliche Hinweis automatisch auf der Rechnung steht und nicht vergessen werden kann.
- Als **Betreiber** möchte ich beim Onboarding Nummernkreis und Bausteine mit dem Kunden einrichten, damit seine erste Rechnung richtig nummeriert ist.
- Als **Inhaber** möchte ich alle Rechnungseinstellungen an einer Stelle finden, auch den Schalter „Rechnungen nacherfassen“.

## Out of Scope
- Rechnungsentwurf, Ersetzen der Platzhalter, Wahl der Bausteine je Rechnung, Block 3 (Gastnamen ja/nein, mit Mitreisenden), Empfänger Gast/Firma (PROJ-40)
- Nummer vergeben, überschreiben, Lückenhinweis, Fußzeile/Hinweis auf der Rechnung, PDF (PROJ-41)
- Anordnung der Blöcke, Schriftart, Schriftgröße, Position und Größe des Logos (PROJ-41, „Einstellungen → Rechnungen Teil 2“)
- Zahlungen erfassen, Überwachung der Anzahlungsfrist, automatisches Verfallen einer Option (PROJ-13 bzw. später)
- Eigene Anzahlungsrechnung bzw. Teilung nach Betrag (PROJ-40)
- Bankverbindung, Telefon, E-Mail, Webseite als eigene Stammdatenfelder (bewusst als freier Fußzeilen-Text)
- Platzhalter in Fußzeile und Kleinunternehmer-Hinweis
- Mehrere Nummernkreise gleichzeitig (z. B. je Objekt) und ein eigener Nummernkreis für Gutschriften/Stornorechnungen (Storno-Teilprojekt)
- Mehrsprachige Bausteine bzw. englische Rechnungen (PROJ-23)
- Zentrale Vorlagen des Betreibers für alle Kunden; Bausteine zwischen Kunden kopieren
- Weitere Hinweisblöcke (z. B. Reverse Charge bei Firmen)
- Zugang oder Leseansicht für Mitarbeiter

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Reiter und Zugang
- [ ] Angenommen ein Inhaber öffnet die Einstellungen, wenn die Reiter erscheinen, dann lauten sie in dieser Reihenfolge „Stammdaten“, „Team“, „Wohnungen“, „Rechnungen“
- [ ] Angenommen ein Inhaber klickt auf „Rechnungen“, wenn die Seite lädt, dann ist die Adresse `/einstellungen/rechnungen`, der Reiter ist markiert, der Browser-Tab trägt den Titel „Rechnungen“ und die Abschnitte Nummernkreis, Textbausteine, Feste Texte und Nacherfassen sind sichtbar
- [ ] Angenommen ein Mitarbeiter ruft `/einstellungen/rechnungen` auf, wenn die Seite lädt, dann erhält er „Seite nicht gefunden“
- [ ] Angenommen ein Mitarbeiter versucht, Rechnungseinstellungen auf anderem Weg als über die Oberfläche zu lesen oder zu ändern, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt
- [ ] Angenommen ein Inhaber von Kunde A, wenn er versucht, Einstellungen oder Bausteine von Kunde B zu lesen oder zu ändern, dann wird das abgelehnt

### Schalter „Rechnungen nacherfassen“
- [ ] Angenommen ein Inhaber öffnet *Einstellungen → Stammdaten*, wenn die Seite lädt, dann gibt es dort keinen Schalter „Rechnungen nacherfassen“ mehr
- [ ] Angenommen ein Inhaber öffnet *Einstellungen → Rechnungen*, wenn die Seite lädt, dann steht der Schalter im Abschnitt „Nacherfassen“ mit dem bisher gespeicherten Zustand
- [ ] Angenommen ein Inhaber schaltet ihn aus und speichert, wenn er die Rechnungsliste öffnet, dann fehlt der Knopf „Rechnung nacherfassen“ (Verhalten wie PROJ-37)
- [ ] Angenommen ein Link oder Hinweis in der App verweist auf den Schalter (z. B. aus PROJ-37), wenn der Nutzer ihm folgt, dann landet er auf *Einstellungen → Rechnungen*

### Nummernkreis
- [ ] Angenommen ein Kunde ohne geänderte Einstellungen, wenn der Inhaber den Abschnitt „Nummernkreis“ öffnet, dann ist eingestellt: kein Präfix, mit Jahreszahl, Trennzeichen „-“, 4 Stellen, jährlich neu, Startnummer 1
- [ ] Angenommen der Inhaber ändert eine Einstellung, wenn die Vorschau aktualisiert ist, dann zeigt sie sofort die nächste Nummer im neuen Format (z. B. „R-2026/0001“), noch vor dem Speichern
- [ ] Angenommen der Inhaber lässt das Präfix leer, wenn er speichert, dann wird gespeichert und die Nummer beginnt direkt mit der Jahreszahl bzw. der laufenden Nummer
- [ ] Angenommen ein Präfix mit mehr als 10 Zeichen oder unzulässigen Zeichen (z. B. Leerzeichen, „#“), wenn gespeichert wird, dann erscheint eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen „ohne Jahreszahl“ ist gewählt, wenn der Inhaber „jährlich neu beginnen“ einschalten will, dann ist das nicht möglich und ein Hinweis erklärt, dass dafür die Jahreszahl nötig ist
- [ ] Angenommen eine Startnummer von 0, eine negative Zahl oder keine ganze Zahl, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen es gibt nacherfasste Rechnungen „2026-0041“ und „2026-0042“ und das Format ist JJJJ-NNNN jährlich neu, wenn die Vorschau erscheint, dann lautet die nächste Nummer „2026-0043“, unabhängig von der Startnummer
- [ ] Angenommen es gibt eine nacherfasste Rechnung „ALT-17“ und keine passende Nummer im Format JJJJ-NNNN, wenn die Vorschau erscheint, dann lautet die nächste Nummer „2026-“ plus Startnummer mit 4 Stellen
- [ ] Angenommen „jährlich neu“ und die letzte passende Rechnung ist „2025-0118“, wenn die Vorschau im Jahr 2026 erscheint, dann lautet die nächste Nummer „2026-0001“ (bzw. die Startnummer, wenn sie im Jahr 2026 eingetragen wurde)
- [ ] Angenommen „ohne Jahreszahl“, Präfix „R-“, 5 Stellen und die höchste passende Nummer ist „R-00123“, wenn die Vorschau erscheint, dann lautet die nächste Nummer „R-00124“
- [ ] Angenommen 3 Stellen und die höchste passende Nummer ist „2026-999“, wenn die Vorschau erscheint, dann lautet die nächste Nummer „2026-1000“
- [ ] Angenommen der Kunde hat noch keine Rechnung in der App **ausgestellt**, wenn der Inhaber den Nummernkreis ändert und speichert, dann wird ohne Rückfrage gespeichert
- [ ] Angenommen der Kunde hat bereits Rechnungen in der App ausgestellt, wenn der Inhaber den Nummernkreis ändert und speichert, dann erscheint der Hinweis „Es wurden bereits Rechnungen mit diesem Nummernkreis ausgestellt. Eine Änderung kann die fortlaufende Nummerierung unterbrechen.“ und erst nach Bestätigung wird gespeichert
- [ ] Angenommen der Nummernkreis wurde geändert, wenn bestehende Rechnungen angezeigt werden, dann tragen sie unverändert ihre bisherigen Nummern

### Textbausteine
- [ ] Angenommen ein bestehender oder neuer Kunde, wenn der Inhaber den Abschnitt „Textbausteine“ öffnet, dann sieht er die Vorbelegung (Einleitung 1, Zahlungsmodalitäten 2, Abschlusstext 1 Baustein), mit Kennzeichnung des Standards
- [ ] Angenommen der Inhaber legt in einem Block einen Baustein mit Name und Text an, wenn er speichert, dann erscheint er in der Liste dieses Blocks
- [ ] Angenommen Name oder Text fehlen, wenn gespeichert wird, dann erscheinen Fehlermeldungen und nichts wird gespeichert
- [ ] Angenommen ein Name mit mehr als 60 Zeichen oder ein Text mit mehr als 2.000 Zeichen, wenn gespeichert wird, dann erscheint eine Fehlermeldung mit der Grenze
- [ ] Angenommen im Block gibt es schon einen Baustein „Nächster Besuch“, wenn der Inhaber einen zweiten „nächster besuch“ im selben Block anlegt, dann erscheint „Dieser Name ist in diesem Block bereits vergeben“; in einem anderen Block ist der Name erlaubt
- [ ] Angenommen ein Block hat 20 Bausteine, wenn der Inhaber einen weiteren anlegen will, dann ist „Baustein hinzufügen“ gesperrt mit dem Hinweis auf die Höchstzahl
- [ ] Angenommen ein Block hat einen Standard, wenn der Inhaber einen anderen Baustein als Standard setzt, dann ist nur noch dieser Standard
- [ ] Angenommen der Inhaber hebt den Standard auf, wenn er speichert, dann hat der Block keinen Standard und zeigt den Hinweis „Kein Standard – der Block beginnt im Entwurf leer“
- [ ] Angenommen der Inhaber löscht einen Baustein, wenn er die Bestätigung annimmt, dann verschwindet er; war er der Standard, hat der Block danach keinen Standard
- [ ] Angenommen der Inhaber ändert die vorbelegten Bausteine, wenn ein anderer Kunde seine Einstellungen öffnet, dann sieht dieser weiterhin seine eigenen Bausteine
- [ ] Angenommen die Liste eines Blocks, wenn sie angezeigt wird, dann steht der Standard oben, danach die übrigen nach Name

### Zahlungsregeln (Block 6)
- [ ] Angenommen der Inhaber bearbeitet einen Baustein in Block 6, wenn das Formular erscheint, dann gibt es zusätzlich „Anzahlung“ (ja/nein) und „Fälligkeit“ (Tage, Bezug „nach Rechnungsdatum“ oder „vor Anreise“)
- [ ] Angenommen „Anzahlung: ja“, wenn das Formular erscheint, dann sind „Prozent“ und „fällig … Tage nach Rechnungsdatum“ Pflichtfelder
- [ ] Angenommen ein Prozentsatz unter 1, über 100 oder mit mehr als 2 Nachkommastellen, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen eine Frist unter 0, über 365 oder keine ganze Zahl, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen ein Baustein in Block 6 ohne Anzahlung, wenn der Text {Anzahlung}, {Anzahlung fällig} oder {Restbetrag} enthält, dann erscheint der Hinweis „Dieser Platzhalter ist nur bei Bausteinen mit Anzahlung möglich“ und Speichern ist nicht möglich
- [ ] Angenommen „Anzahlung: nein“ wird nach dem Ausfüllen von Prozent und Frist gewählt, wenn gespeichert wird, dann werden Prozent und Frist nicht gespeichert

### Editor, Platzhalter und Vorschau
- [ ] Angenommen der Inhaber schreibt einen Baustein, wenn er Text markiert, dann kann er ihn fett oder kursiv setzen und Aufzählungen bzw. nummerierte Listen anlegen; weitere Formatierungen gibt es nicht
- [ ] Angenommen der Inhaber fügt formatierten Text aus Word oder einer Webseite ein, wenn der Text im Editor steht, dann sind nur fett, kursiv, Absätze und Listen erhalten; Links, Farben, Schriftarten, Bilder und Tabellen sind entfernt
- [ ] Angenommen der Inhaber wählt „Platzhalter einfügen“ in einem Baustein von Block 4 oder 7, wenn die Auswahl erscheint, dann enthält sie {Anrede}, {Gast}, {Wohnung}, {Anreise}, {Abreise}, {Nächte}, {Rechnungsnummer}, {Rechnungsdatum}, {Betrag}
- [ ] Angenommen der Inhaber wählt „Platzhalter einfügen“ in einem Baustein von Block 6, wenn die Auswahl erscheint, dann enthält sie zusätzlich {Fälligkeitsdatum} und, nur bei Anzahlung, {Anzahlung}, {Anzahlung fällig} und {Restbetrag}
- [ ] Angenommen der Inhaber tippt „{Wohnung}“ von Hand, wenn der Text im Editor steht, dann wird der Platzhalter wie ein eingefügter erkannt
- [ ] Angenommen der Text enthält „{Gastname}“ oder einen in diesem Block nicht erlaubten Platzhalter, wenn gespeichert wird, dann erscheint „Unbekannter Platzhalter: {Gastname}“ bzw. ein Hinweis, dass er hier nicht erlaubt ist, und nichts wird gespeichert
- [ ] Angenommen der Inhaber bearbeitet einen Baustein, wenn er tippt, dann zeigt die Vorschau darunter den Text mit Beispieldaten, z. B. „Sehr geehrte Frau Mag. Muster“ für {Anrede} und „14.10.2026“ (ohne Wochentag) für {Anreise}
- [ ] Angenommen ein Zahlungsbaustein mit 20 % Anzahlung binnen 3 Tagen und Fälligkeit 1 Tag vor Anreise, wenn die Vorschau erscheint, dann sind {Anzahlung}, {Anzahlung fällig}, {Restbetrag} und {Fälligkeitsdatum} mit den daraus berechneten Beispielwerten gefüllt
- [ ] Angenommen jemand sendet am Editor vorbei HTML mit Skripten, Links oder Stilangaben, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt oder auf die erlaubten Formatierungen bereinigt; gespeichert wird nie etwas anderes

### Feste Texte
- [ ] Angenommen ein bestehender oder neuer Kunde, wenn der Inhaber die festen Texte öffnet, dann steht im Kleinunternehmer-Hinweis „Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG“ und die Fußzeile ist leer
- [ ] Angenommen der Inhaber leert den Kleinunternehmer-Hinweis, wenn er speichert, dann erscheint „Der Kleinunternehmer-Hinweis darf nicht leer sein“ und nichts wird gespeichert
- [ ] Angenommen der Inhaber formuliert den Kleinunternehmer-Hinweis um, wenn er speichert, dann ist der neue Text gespeichert
- [ ] Angenommen der Inhaber schreibt Bankverbindung und Kontakt in die Fußzeile, wenn er speichert, dann ist der Text nach dem Neuladen unverändert da
- [ ] Angenommen eine Fußzeile über 2.000 Zeichen oder ein Kleinunternehmer-Hinweis über 500 Zeichen, wenn gespeichert wird, dann erscheint eine Fehlermeldung mit der Grenze
- [ ] Angenommen der Inhaber wählt im Editor der festen Texte, wenn die Werkzeugleiste erscheint, dann gibt es kein „Platzhalter einfügen“; getippte Platzhalter werden als unbekannt gemeldet
- [ ] Angenommen der Kunde ist kein Kleinunternehmer, wenn er die festen Texte öffnet, dann kann er den Hinweis trotzdem bearbeiten, und ein Satz erklärt, dass er nur bei Kleinunternehmer-Status auf der Rechnung erscheint

### Betreiber
- [ ] Angenommen der Betreiber öffnet die Detailseite eines aktiven Kunden, wenn die Seite lädt, dann gibt es einen Abschnitt „Rechnungen“ mit Nummernkreis, Textbausteinen, festen Texten und Schalter, gleich bedienbar wie beim Inhaber
- [ ] Angenommen der Betreiber ändert den Nummernkreis eines aktiven Kunden, wenn sich der Inhaber danach anmeldet, dann sieht er die Änderung unter *Einstellungen → Rechnungen*
- [ ] Angenommen ein Kunde ist deaktiviert, wenn der Betreiber dessen Detailseite öffnet, dann sieht er alle Rechnungseinstellungen, kann aber nichts ändern
- [ ] Angenommen ein Kunde ist deaktiviert, wenn eine Änderung auf anderem Weg als über die Oberfläche beim Server ankommt, dann wird sie abgelehnt

### Schutz und Protokoll
- [ ] Angenommen Betreiber und Inhaber haben denselben Abschnitt (bzw. denselben Baustein) geöffnet und einer hat gespeichert, wenn der andere speichert, dann erhält er den Hinweis „Die Einstellungen wurden inzwischen geändert“ mit „Aktuelle Fassung laden“, und seine Änderung wird nicht gespeichert
- [ ] Angenommen ein Baustein wurde gelöscht, während ein anderer Nutzer ihn bearbeitet, wenn dieser speichert, dann erhält er einen Hinweis, dass der Baustein nicht mehr existiert
- [ ] Angenommen eine Einstellung wird geändert oder ein Baustein angelegt, geändert oder gelöscht, wenn jemand das Betreiber-Protokoll ansieht, dann ist der Vorgang mit Person, Zeitpunkt und betroffenem Abschnitt bzw. Bausteinnamen vermerkt, ohne den Text selbst

### Allgemein
- [ ] Angenommen ein Fehler beim Speichern (z. B. Verbindungsabbruch), wenn der Nutzer speichert, dann erscheint eine Fehlermeldung, die Eingaben bleiben im Formular stehen und gespeichert ist weiterhin der bisherige Stand
- [ ] Angenommen der Reiter wird am Handy (375 px Breite) geöffnet, wenn der Nutzer Bausteine bearbeitet und den Nummernkreis ändert, dann sind Editor, Vorschau und alle Knöpfe ohne seitliches Scrollen bedienbar und Bedienelemente mindestens 44 px groß
- [ ] Angenommen das Feature wird eingespielt, wenn bestehende Kunden ihre Einstellungen öffnen, dann haben sie die Vorbelegung, und der Zustand des Schalters „Rechnungen nacherfassen“ ist unverändert

## Edge Cases
- **Startnummer kleiner als die höchste passende Nummer:** Die höchste Nummer + 1 gewinnt; die Vorschau zeigt das, ein Hinweis erklärt, dass die Startnummer nur ohne passende Rechnungen gilt.
- **Startnummer im Dezember, Ausstellen im Jänner** (jährlich neu): Im neuen Jahr beginnt die Folge bei 1; die Startnummer galt nur für das Jahr, in dem sie eingetragen wurde.
- **Format ohne Jahreszahl, aber nacherfasste Nummern mit Jahreszahl:** Nur Nummern, die genau zum Format passen (Präfix + Ziffern), zählen.
- **Präfix endet mit Ziffer** (z. B. „R1“): Zulässig; die Erkennung passender Nummern stützt sich auf Präfix, Jahreszahl und Trennzeichen, Mehrdeutigkeiten zeigt die Vorschau.
- **Nacherfasste Nummer mit anderer Stellenzahl** (z. B. „2026-12“ bei 4 Stellen): Zählt als laufende Nummer 12 mit, wenn sie sonst zum Format passt.
- **Kein Standard in Block 6:** Im Entwurf gibt es dann keine Fälligkeit aus dem Baustein; wie das Fälligkeitsdatum ohne Baustein entsteht, klärt PROJ-40.
- **Fälligkeit „vor Anreise“ liegt vor dem Rechnungsdatum** (Last-Minute-Buchung, Rechnung nach der Anreise): Behandlung im Entwurf (PROJ-40), hier nur gespeichert.
- **Anzahlung 100 %:** Zulässig; {Restbetrag} ergibt € 0,00.
- **Gleichzeitiges Anlegen zweier Bausteine mit gleichem Namen** durch Inhaber und Betreiber: Der zweite wird mit der Meldung zum doppelten Namen abgelehnt.
- **Gleichzeitiges Setzen zweier verschiedener Standards:** Es bleibt höchstens ein Standard je Block; der zweite Speichervorgang erhält den Konflikthinweis.
- **Baustein, der gerade der Standard ist, wird gelöscht:** Block hat danach keinen Standard (siehe Kriterien).
- **Bausteine ändern, während ein Entwurf offen ist** (ab PROJ-40): Der Entwurf hat bereits eine Kopie; Änderungen wirken nur auf neue Entwürfe.
- **Leerer Text nach Entfernen aller Zeichen, nur Formatierung oder Leerzeilen:** gilt als leer (Pflichtfeld-Meldung bzw. leere Fußzeile).
- **Sehr lange Wörter oder IBAN in der Fußzeile am Handy:** werden umgebrochen, kein seitliches Scrollen.

## Technical Requirements
- Rechte serverseitig durchgesetzt (Inhaber nur eigener Kunde, Betreiber alle aktiven Kunden schreibend, Mitarbeiter keine Rechte)
- Formatierter Text wird serverseitig auf die erlaubten Formatierungen geprüft bzw. bereinigt; kein freies HTML
- Prüfregeln (Grenzen, Platzhalter, Nummernformat) gleich in Oberfläche und Server
- Regel „nächste Nummer“ an einer Stelle, nutzbar von der Vorschau hier und vom Ausstellen in PROJ-41
- Deutsche Texte über die bestehende i18n-Struktur
- Responsiv ab 375 px Breite; Chrome, Firefox, Safari

## Open Questions
- [ ] Wortlaut des Kleinunternehmer-Hinweises mit Steuerberater abstimmen (Stand der Kleinunternehmerregelung ab 2025)
- [ ] Bestimmt sich der Kleinunternehmer-Status einer Rechnung nach dem Rechnungsdatum oder nach der Buchung (PROJ-36: Abreise bzw. Stornodatum)? Klärung in PROJ-40
- [ ] Wie entsteht das Fälligkeitsdatum, wenn im Entwurf kein Zahlungsbaustein gewählt ist, und was gilt, wenn „vor Anreise“ vor dem Rechnungsdatum liegt? Klärung in PROJ-40
- [ ] Erscheinen auch die Datumsangaben in Block 2a/2b ohne Wochentag? Klärung in PROJ-40/41
- [ ] Wie lautet {Anrede} bei Firmen als Empfänger (z. B. „Sehr geehrte Damen und Herren“)? Klärung in PROJ-40 mit der Empfängerwahl

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigener Reiter „Rechnungen“ als vierter Reiter; Betreiber-Abschnitt auf der Kunden-Detailseite | Alles zu Rechnungen an einer Stelle; gleiche Struktur wie Stammdaten (PROJ-38) | 2026-10-31 |
| Übersicht aller Rechnungsbereiche im Spec; einstellbar sind nur Nummernkreis, Bausteine der Blöcke 4/6/7, Kleinunternehmer-Hinweis und Fußzeile | Gliederung des Nutzers (Blöcke 1–7); automatisch gefüllte Bereiche brauchen keine Einstellung; Layout folgt in PROJ-41 | 2026-10-31 |
| Mehrere Bausteine je Block, höchstens einer als Standard (Standard optional) | Wunsch des Nutzers; bei Zahlungsmodalitäten unterscheiden sich die Fälle (Anzahlung, Überweisung, Firma); ohne Standard beginnt der Block leer | 2026-10-31 |
| Block 3 (Gastnamen, Mitreisende) ohne Einstellung, nur je Rechnung | Nutzer: wird weder je Kunde noch je Buchung, sondern beim Ausstellen entschieden | 2026-10-31 |
| Kleinunternehmer-Hinweis nach Block 5, ein Text, Pflicht, im Entwurf fest | Gesetzlich vorgeschrieben; kann so nie fehlen oder verstümmelt werden | 2026-10-31 |
| Fußzeile als ein frei geschriebener Text, auf jeder Rechnung unverändert, keine Stammdatenfelder für Bank/Kontakt | Nutzer: einmal erstellt, immer gleich; frei gestaltbar wie bisher gewohnt | 2026-10-31 |
| Zahlungsregeln (Anzahlung %, Frist; Fälligkeit nach Rechnungsdatum oder vor Anreise) je Baustein in Block 6 | Text und Zahlen passen zusammen; Anzahlung (z. B. 20 % in 3 Tagen) und Rest (1 Tag vor Anreise) sind der übliche Ablauf beim Nutzer | 2026-10-31 |
| Anzahlung als Zahlungsbedingung innerhalb einer Rechnung, keine eigene Anzahlungsrechnung | So beschreibt der Nutzer den Ablauf; Zahlungserfassung kommt später (PROJ-13) | 2026-10-31 |
| Zahlungs-Platzhalter nur in Block 6, Anzahlungs-Platzhalter nur bei Bausteinen mit Anzahlung | Nur dort sind die Werte sicher bekannt; verhindert leere oder falsche Beträge im Text | 2026-10-31 |
| Datum in Platzhaltern ohne Wochentag | Wunsch des Nutzers; Rechnungstext, nicht App-Oberfläche (Ausnahme von PROJ-31) | 2026-10-31 |
| Nummernformat aus Bausteinen (Präfix optional, Jahr, Trennzeichen, Stellen, jährlich neu, Startnummer) mit Vorschau | Kunden bringen eigene Formate aus dem Altsystem mit; Folge läuft nach dem Nacherfassen nahtlos weiter | 2026-10-31 |
| Nächste Nummer = höchste passende Nummer + 1, nur Nummern im eingestellten Format zählen | Nacherfasste Altnummern in fremdem Format dürfen die Folge nicht stören | 2026-10-31 |
| Nummernkreis bleibt nach dem ersten Ausstellen änderbar, mit Warnung und Bestätigung | Getrennte Nummernkreise sind erlaubt; bei manchen Kunden müssen Lücken aufgefüllt werden; Tippfehler korrigierbar | 2026-10-31 |
| Inhaber und Betreiber dürfen bearbeiten; Mitarbeiter kein Zugang | Betreiber richtet beim Onboarding ein; gleiche Rechte wie Stammdaten | 2026-10-31 |
| Schalter „Rechnungen nacherfassen“ wandert aus Stammdaten in den Reiter „Rechnungen“ | Gehört inhaltlich zu Rechnungen; nur der Ort ändert sich | 2026-10-31 |
| Vorbelegung mit Beispiel-Bausteinen als eigene, änderbare Kopie je Kunde | Zeigt sofort, wie Platzhalter und Zahlungsregeln wirken; erste Rechnung ohne Vorarbeit; Nutzer: kundenspezifisch überarbeitbar | 2026-10-31 |
| Vorschau mit Beispieldaten im Editor | Satzbau von {Anrede} und berechnete Fristen sofort prüfbar | 2026-10-31 |
| Beschränkter Editor (fett, kursiv, Absätze, Listen), kein HTML | Sicher und druckbar; reicht für Rechnungstexte | 2026-10-31 |
| Grenzen: 20 Bausteine je Block, Name 60, Text 2.000, Hinweis 500 Zeichen, Anzahlung 1–100 %, Fristen 0–365 Tage | Großzügig für die Praxis, schützt vor Missbrauch und unlesbaren Rechnungen | 2026-10-31 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Tabellen „Rechnungseinstellungen“ (eine Zeile je Kunde) und „Textbausteine“ statt Felder am Kunden | Rechnungsdaten an einer Stelle für PROJ-40/41; Stammdaten bleiben unberührt | 2026-10-31 |
| Ein Änderungsstempel je Abschnitt; bei Bausteinen je Baustein; „Standard setzen“ prüft den bisherigen Standard des Blocks | Konflikthinweis genau dort, wo zwei dasselbe bearbeiten; auch zwei gleichzeitige Standards werden erkannt | 2026-10-31 |
| Schalter „Rechnungen nacherfassen“ zieht in die Rechnungseinstellungen um (Wert übernommen); Stammdaten- und Rechnungs-Speicherfunktion angepasst | Umschalten ändert die Stammdaten nicht mehr, kein falscher Konflikt; alle Rechnungseinstellungen beisammen | 2026-10-31 |
| Formatierter Text als strukturierte Beschreibung (Absätze, Listen, fett/kursiv, Umbruch) statt HTML; Datenbank prüft Struktur, Länge und Platzhalter | Freies HTML ist damit gar nicht speicherbar; auch Anfragen am Formular vorbei sind abgesichert; PDF (PROJ-41) kann daraus direkt setzen | 2026-10-31 |
| Editor Tiptap (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`), auf erlaubte Formate beschränkt, nur auf dieser Seite geladen | Verbreitet, frei nutzbar, React-tauglich; filtert Eingefügtes automatisch auf die erlaubten Formate | 2026-10-31 |
| Platzhalter als normaler Text „{Name}“, Liste mit Zulässigkeit je Block an einer Stelle in der App (Datenbank prüft dieselbe Liste) | Getippte und eingefügte Platzhalter sind gleich; Markierung, Prüfung und späteres Ersetzen (PROJ-40) nutzen eine Quelle | 2026-10-31 |
| Vorschau mit festem Beispiel-Datensatz (Rechnungsdatum 01.10.2026, Anreise 14.10.2026, € 450,00) im Browser | Stabile, prüfbare Vorschau; Fristen „vor Anreise“ ergeben stets sinnvolle Daten | 2026-10-31 |
| Regel „nächste Nummer“ als eine Rechenregel in der App (Format + vorhandene Nummern + Datum); Vorschau rechnet im Browser, PROJ-41 nutzt sie für den Vorschlag | Vorschau ohne Wartezeit vor dem Speichern; Nummer ist in PROJ-41 ohnehin überschreibbar, Doppelte verhindert die Eindeutigkeit in der Datenbank | 2026-10-31 |
| „Jährlich neu“ vergleicht die Jahreszahl **in der Nummer** mit dem Jahr des Rechnungsdatums; Jahr der Startnummer wird gespeichert | Altnummern mit abweichendem Rechnungsdatum (z. B. Jänner-Rechnung fürs Vorjahr) stören die Folge nicht; Startnummer gilt nur im Eintragungsjahr | 2026-10-31 |
| Vorbelegung per Migration für bestehende Kunden und automatisch beim Anlegen neuer Kunden (unabhängig vom Anlageweg) | Jeder Kunde hat sofort eine eigene, änderbare Kopie | 2026-10-31 |
| Betreiber-Protokoll mit neuen Aktionsarten und Bausteinbezeichnung, ohne Textinhalt | Nachvollziehbar wer was geändert hat; Rechnungstexte können Bankdaten enthalten und gehören nicht ins Protokoll | 2026-10-31 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Einstellungen-Reiter** als Links (`settings-tabs`), nur für Inhaber; Mitarbeiter erhalten „Seite nicht gefunden“ (PROJ-4/38).
- **Stammdaten-Formular** für Inhaber und Betreiber mit einer geschützten Datenbank-Funktion: Rechte, „Kunde aktiv?“, Schutz vor gleichzeitigen Änderungen, Eintrag im Betreiber-Protokoll mit geänderten Feldern (PROJ-28/36/37/38). Dieses Muster wird übernommen.
- **Schalter „Rechnungen nacherfassen“** liegt heute als Feld am Kunden, wird über das Stammdaten-Formular gespeichert und von der Rechnungs-Speicherfunktion (PROJ-37) geprüft.
- **Rechnungen** (PROJ-37) mit je Kunde eindeutiger Nummer und Herkunft „nacherfasst“; „ausgestellt“ kommt mit PROJ-41.
- **Seitenpanel** (`detail-panel`, rechts, am Handy bildschirmfüllend), **Bestätigungsdialog** (`confirm-dialog`), shadcn-Bausteine Switch, Select, Radio-Group, Dropdown-Menü, Badge, Alert.
- Der Design-Entwurf (`docs/design/`) enthält für Einstellungen keine eigene Vorlage. Der neue Reiter folgt dem Aufbau von Stammdaten und Team: Abschnitte untereinander, Panels von rechts.

### A) Seiten und Bausteine

```
Einstellungen (nur Inhaber)
+-- Reiter: Stammdaten · Team · Wohnungen · Rechnungen      (NEU: vierter Reiter)
+-- /einstellungen/stammdaten
|   +-- Stammdaten-Formular OHNE Schalter „Rechnungen nacherfassen“
+-- /einstellungen/rechnungen  (NEU, Titel „Rechnungen“)
    +-- Rechnungseinstellungen (gemeinsamer Baustein für Inhaber und Betreiber)
        +-- Abschnitt „Nummernkreis“
        |   +-- Präfix (Textfeld) · mit/ohne Jahreszahl · Trennzeichen (Auswahl) · Stellen (Auswahl 3–6)
        |   +-- Schalter „Jährlich neu beginnen“ (gesperrt ohne Jahreszahl, mit Hinweis)
        |   +-- Startnummer
        |   +-- Vorschau „Nächste Nummer: 2026-0043“ (rechnet sofort beim Tippen)
        |   +-- Hinweis, wenn eine höhere passende Nummer die Startnummer überholt
        |   +-- Speichern (bei bereits ausgestellten Rechnungen: Bestätigungsdialog mit Warnung)
        +-- Abschnitt „Textbausteine“
        |   +-- Gruppe „Einleitung“ / „Zahlungsmodalitäten“ / „Abschlusstext“
        |       +-- Liste: Name · Kennzeichen „Standard“ · Kurztext · Menü (Bearbeiten, Als Standard
        |       |   setzen / Standard aufheben, Löschen mit Bestätigung)
        |       +-- Hinweis „Kein Standard – der Block beginnt im Entwurf leer“
        |       +-- Knopf „Baustein hinzufügen“ (gesperrt ab 20, mit Hinweis)
        |       +-- Seitenpanel „Baustein bearbeiten“ / „Neuer Baustein“
        |           +-- Name
        |           +-- nur Zahlungsmodalitäten: Anzahlung ja/nein → Prozent, fällig nach … Tagen;
        |           |   Fälligkeit: … Tage, Bezug „nach Rechnungsdatum“ / „vor Anreise“
        |           +-- Text-Editor (siehe unten) mit „Platzhalter einfügen“
        |           +-- Vorschau mit Beispieldaten
        |           +-- Speichern / Abbrechen
        +-- Abschnitt „Feste Texte“
        |   +-- Kleinunternehmer-Hinweis (Editor ohne Platzhalter) + Erklärsatz zur Bedingung
        |   +-- Fußzeile (Editor ohne Platzhalter)
        |   +-- Speichern
        +-- Abschnitt „Nacherfassen“
            +-- Schalter „Rechnungen nacherfassen“ + Speichern

Text-Editor (gemeinsamer Baustein)
+-- Werkzeugleiste: Fett · Kursiv · Aufzählung · Nummerierte Liste · [Platzhalter einfügen ▾]
+-- Schreibfläche: Platzhalter farbig markiert, unbekannte bzw. hier unzulässige rot mit Meldung darunter
+-- Zeichenzähler „1.234 / 2.000“
+-- Vorschau: der Text, wie er auf der Rechnung stünde

Betreiber → Kunden-Detailseite
+-- Abschnitt „Stammdaten“ (ohne Schalter)
+-- NEU: Abschnitt „Rechnungen“ = derselbe Baustein; bei deaktiviertem Kunden nur Ansicht ohne Knöpfe
+-- Protokoll: neue Einträge (siehe E)
```

- **Ein gemeinsamer Baustein für Inhaber und Betreiber**, wie beim Stammdaten-Formular. Er bekommt den Kunden, die Rolle und „nur ansehen“ mitgegeben.
- **Jeder Abschnitt speichert für sich** und hat einen eigenen Speichern-Knopf. Ein Fehler in einem Abschnitt lässt die Eingaben in den anderen stehen.
- **Bausteine bearbeiten im Seitenpanel**. Bausteinlisten, Name, Zahlungsregeln, Editor und Vorschau passen so auch am Handy (375 px) untereinander, und das Muster kennt man aus Buchungen und Rechnungen.
- **Verweise auf den Schalter** (z. B. Hinweise in der Rechnungsliste aus PROJ-37) zeigen künftig auf `/einstellungen/rechnungen`.

### B) Datenmodell (in Worten)

**Neue Tabelle „Rechnungseinstellungen“**: genau eine Zeile je Kunde.
- Nummernkreis: Präfix (leer oder bis 10 zulässige Zeichen), mit Jahreszahl ja/nein, Trennzeichen (`-`, `/`, `.` oder keines), Stellen (3–6), jährlich neu ja/nein (ja nur mit Jahreszahl), Startnummer (ab 1), **Jahr der Startnummer** (wird beim Speichern einer geänderten Startnummer automatisch gesetzt; nötig für „gilt nur im Jahr, in dem sie eingetragen wurde“)
- Kleinunternehmer-Hinweis (formatierter Text, Pflicht, bis 500 Zeichen)
- Fußzeile (formatierter Text, optional, bis 2.000 Zeichen)
- Schalter „Rechnungen nacherfassen“ (aus der Kunden-Tabelle hierher verschoben, Wert je Kunde übernommen)
- **Ein Änderungsstempel je Abschnitt** (Nummernkreis, Feste Texte, Nacherfassen). So stört das Speichern eines Abschnitts nicht den, der gerade einen anderen bearbeitet.

**Neue Tabelle „Textbausteine“**: beliebig viele Zeilen je Kunde.
- Kunde, Block (Einleitung / Zahlungsmodalitäten / Abschlusstext), Name (bis 60 Zeichen), Text (formatiert, bis 2.000 Zeichen), Standard ja/nein, Änderungsstempel, angelegt/geändert von
- nur bei Zahlungsmodalitäten: Anzahlung in Prozent (1–100, 2 Nachkommastellen) und Anzahlungsfrist (0–365 Tage), beide gemeinsam oder beide leer; Fälligkeit in Tagen (0–365) mit Bezug „nach Rechnungsdatum“ / „vor Anreise“ (Pflicht)

**Regeln in der Datenbank** (gelten auch bei Anfragen am Formular vorbei):
- Name je Kunde und Block eindeutig, ohne Rücksicht auf Groß-/Kleinschreibung. Zwei gleichzeitige Anlagen mit gleichem Namen scheitern daher beim zweiten Mal.
- Höchstens ein Standard je Kunde und Block
- Höchstens 20 Bausteine je Block (beim Anlegen geprüft, gegen gleichzeitiges Anlegen gesperrt)
- Zahlungsfelder nur bei Zahlungsmodalitäten, Grenzen wie in der Spec
- Formatierter Text nur in der erlaubten Struktur (siehe C), Zeichengrenzen auf den reinen Text gerechnet, Platzhalter nur aus der für den Block erlaubten Liste

**Formatierter Text** wird **nicht als HTML** gespeichert, sondern als kleine, strukturierte Beschreibung: Absätze und Listen, darin Textstücke mit „fett“/„kursiv“ und Zeilenumbrüche. Platzhalter stehen als normaler Text, z. B. „{Wohnung}“, darin. Die Datenbank kennt nur diese Bausteine. Alles andere (Links, Farben, Bilder, Skripte) lässt sich so gar nicht ablegen.

**Vorbelegung:**
- Die Migration legt für **jeden bestehenden Kunden** die Einstellungszeile und die vier Beispiel-Bausteine aus der Spec an, jeweils als eigene Kopie. Der bisherige Schalterwert wird übernommen.
- **Neue Kunden** bekommen dasselbe automatisch beim Anlegen, egal über welchen Weg sie entstehen.
- Spätere Änderungen an den Beispielen in der App betreffen nur neu angelegte Kunden.

**Löschen eines Kunden** entfernt Einstellungen und Bausteine mit, wie bei allen Kundendaten.

### C) Editor, Platzhalter und Vorschau

- **Editor-Paket Tiptap** (frei nutzbar, verbreitet, für React gebaut). Es ist so eingestellt, dass nur fett, kursiv, Absätze, Zeilenumbruch, Aufzählung und nummerierte Liste existieren.
  - **Einfügen aus Word/E-Mail/Webseite:** Der Editor behält von eingefügtem Inhalt nur, was er kennt. Links werden zu normalem Text, Tabellen zu Absätzen, Bilder, Farben und Schriftarten fallen weg.
  - Der Editor wird **nur auf dieser Seite** geladen. Die übrige App wird dadurch nicht langsamer.
- **Platzhalter:** Eine Liste in der App legt fest, welche Platzhalter es gibt und in welchem Block sie erlaubt sind (Anzahlungs-Platzhalter nur bei Bausteinen mit Anzahlung). Editor-Markierung, „Platzhalter einfügen“, Prüfung beim Speichern und später das Ersetzen im Entwurf (PROJ-40) greifen alle auf diese Liste zu. Ob ein Platzhalter eingefügt oder getippt wurde, macht keinen Unterschied, denn beide sind derselbe Text.
- **Vorschau:** Sie entsteht im Browser aus dem formatierten Text. Die Platzhalter werden durch einen **festen Beispiel-Datensatz** ersetzt: Frau Mag. Maria Muster, Top 1, Anreise 14.10.2026, Abreise 17.10.2026, 3 Nächte, Rechnungsdatum 01.10.2026, Rechnungsnummer im eingestellten Format, Betrag € 450,00.
  - Anzahlung, Anzahlungsfrist, Restbetrag und Fälligkeit werden aus den Zahlungsregeln des Bausteins **berechnet**. Bei 20 % in 3 Tagen und Rest 1 Tag vor Anreise ergibt das € 90,00 bis 04.10.2026 und € 360,00 bis 13.10.2026.
  - Feste Beispielwerte statt „heute“ halten die Vorschau stabil und prüfbar.
- **Datumsangaben** in Platzhaltern ohne Wochentag, Beträge wie PROJ-31. Dafür kommt eine eigene Formatregel neben die bestehenden.
- Dieselbe Umwandlung „formatierter Text + Werte → Rechnungstext“ nutzen später Entwurf (PROJ-40) und PDF (PROJ-41).

### D) Nummernkreis: Regel „nächste Nummer“

- **Eine Rechenregel in der App** mit drei Eingaben: Format, Liste der vorhandenen Rechnungsnummern des Kunden, Rechnungsdatum. Sie gibt die nächste Nummer zurück.
  - Gezählt werden nur Nummern, die genau zum Format passen: Präfix (ohne Rücksicht auf Groß-/Kleinschreibung), gegebenenfalls vier Ziffern Jahr, Trennzeichen, dann nur Ziffern. Andere Stellenzahl zählt mit („2026-12“ = 12).
  - **Jährlich neu:** Nur Nummern, deren Jahreszahl dem Jahr des Rechnungsdatums entspricht. Ohne passende Nummer gilt die Startnummer, wenn sie in diesem Jahr eingetragen wurde, sonst 1.
  - **Nicht jährlich neu:** höchste passende laufende Nummer über alle Jahre + 1, sonst die Startnummer.
  - Mehr Ziffern als Stellen: Die Nummer wächst weiter („2026-1000“).
- **Vorschau ohne Wartezeit:** Die Seite lädt einmal die Rechnungsnummern des Kunden (nur die Nummern, wenige Tausend Zeichen). Danach rechnet der Browser bei jeder Eingabe neu, noch vor dem Speichern.
- **PROJ-41** nutzt dieselbe Regel für den Nummernvorschlag beim Ausstellen. Doppelte Nummern verhindert dort weiterhin die Eindeutigkeit in der Datenbank. Überschreiben ist ohnehin erlaubt, die Regel muss also nicht zusätzlich in der Datenbank stecken.
- **Warnung beim Ändern:** Die Seite weiß, ob der Kunde schon Rechnungen mit Herkunft „ausgestellt“ hat. Bis PROJ-41 ist das nie der Fall, deshalb wird bis dahin ohne Rückfrage gespeichert. Die Prüfung ist trotzdem schon eingebaut.
- Bestehende Rechnungsnummern werden nie umgeschrieben.

### E) Speichern, Rechte, Schutz und Protokoll

Gespeichert wird über **geschützte Datenbank-Funktionen**, nie direkt in die Tabellen:

| Funktion | Zweck | Konfliktschutz |
|---|---|---|
| Nummernkreis speichern | alle Nummernkreis-Felder | Stempel „Nummernkreis“ |
| Feste Texte speichern | Kleinunternehmer-Hinweis, Fußzeile | Stempel „Feste Texte“ |
| Nacherfassen speichern | Schalter | Stempel „Nacherfassen“ |
| Baustein anlegen | neuer Baustein in einem Block | Name eindeutig, Höchstzahl |
| Baustein ändern | Name, Text, Zahlungsregeln | Stempel des Bausteins; gelöscht → eigene Meldung |
| Standard setzen/aufheben | genau ein bzw. kein Standard je Block | Prüft, ob der Standard des Blocks seit dem Laden gewechselt hat. So bekommt auch das zweite von zwei gleichzeitigen „Als Standard setzen“ den Konflikthinweis |
| Baustein löschen | mit Bestätigung | gelöscht → eigene Meldung |

Jede Funktion prüft:
- Inhaber des eigenen Kunden **oder** Betreiber mit 2FA
- Kunde aktiv; bei deaktiviertem Kunden lehnt sie ab, auch am Formular vorbei
- Inhalt (Grenzen, Struktur, Platzhalter)

**Rechte:**

| Aktion | Inhaber | Mitarbeiter | Betreiber (2FA) |
|---|---|---|---|
| Einstellungen und Bausteine lesen | ✓ eigener Kunde | – (auch nicht am Formular vorbei) | ✓ alle Kunden |
| Ändern über die Funktionen | ✓ eigener, aktiver Kunde | – | ✓ aktive Kunden |
| Direkt in die Tabellen schreiben | – | – | – |

PROJ-40/41 lesen die Bausteine später beim Erstellen auf dem Server. Wie Mitarbeiter dabei mitwirken, entscheiden diese Specs.

**Gleiche Prüfregeln in Oberfläche und Server:** Eine gemeinsame Prüfbeschreibung (Zod) für Formular und Server-Aktion liefert die deutschen Fehlermeldungen. Die Datenbank prüft dieselben Grenzen noch einmal als letzte Sicherung. Diese doppelte Pflege ist bewusst, wie bei Rechnungen und Stammdaten.

**Betreiber-Protokoll:** Einträge mit Person und Zeitpunkt, **nie mit dem Text selbst**:
- „Rechnungseinstellungen geändert: Nummernkreis“ (bzw. Kleinunternehmer-Hinweis, Fußzeile, Nacherfassen)
- „Textbaustein angelegt / geändert / gelöscht: Einleitung – Dank für den Aufenthalt“ (geändert mit Feldern wie Name, Text, Zahlungsregeln, Standard)

Das Protokoll bekommt dafür neue Aktionsarten und ein Feld für die Bezeichnung des betroffenen Bausteins. Wie bei den Stammdaten werden Änderungen von Inhaber und Betreiber eingetragen.

### F) Schalter „Rechnungen nacherfassen“ umziehen
- Der Wert wandert von der Kunden-Tabelle in die Rechnungseinstellungen. Jeder Kunde behält seinen Zustand.
- Die Stammdaten-Funktion und das Stammdaten-Formular verlieren den Schalter. Das Protokollfeld „Rechnungen nacherfassen“ bleibt für alte Einträge lesbar.
- Die Rechnungs-Speicherfunktion (PROJ-37) und die Rechnungsliste lesen den Schalter künftig aus den Rechnungseinstellungen. Ihr Verhalten bleibt gleich.
- Vorteil gegenüber „Feld bleibt am Kunden“: Das Umschalten ändert die Stammdaten nicht mehr. Wer gleichzeitig Stammdaten bearbeitet, bekommt also keinen falschen Konflikthinweis.

### G) Abhängigkeiten (Pakete)
- `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`: beschränkter Text-Editor (nicht benötigte Teile wie Überschriften, Links, Code, Zitate werden abgeschaltet)

Alles andere ist vorhanden (shadcn/ui, react-hook-form, Zod, next-intl).

### H) Tests (Plan)
- **Unit:**
  - Regel „nächste Nummer“ mit allen Beispielen aus den Kriterien und Grenzfällen
  - Platzhalter-Erkennung und -Zulässigkeit je Block
  - Prüfung des formatierten Texts (Struktur, Länge auf reinen Text, „nur Formatierung“ = leer)
  - Vorschau-Werte (Anzahlung, Fristen, Rundung, 100 %)
- **Integration (Datenbank):**
  - Rechte Inhaber/Mitarbeiter/fremder Inhaber/Betreiber mit und ohne 2FA, deaktivierter Kunde
  - Konflikte je Abschnitt und Standard, gelöschter Baustein
  - doppelter Name, 21. Baustein
  - unzulässige Struktur und Platzhalter am Formular vorbei
  - Vorbelegung für bestehende und neue Kunden, Schalter-Umzug, Protokoll ohne Text
- **E2E:**
  - Reiter und Zugang
  - Nummernkreis mit Vorschau
  - Baustein anlegen/Standard/löschen
  - Einfügen formatierten Texts
  - feste Texte, Schalter am neuen Ort
  - Betreiber-Abschnitt
  - Handy 375 px mit 44-px-Bedienelementen

## Implementation Notes (Frontend)
**Stand 2026-10-31.**

**Regeln** (Browser und Server, mit Unit-Tests):
- `src/lib/rich-text.ts`: formatierter Text als Teilmenge des Tiptap-Formats (Absätze, Aufzählung, nummerierte Liste, Text mit fett/kursiv, Zeilenumbruch).
  - `normalizeDoc` bringt jedes Editor-Dokument auf diese Struktur: Attribute, Links, Farben und Bilder fallen weg, Überschriften werden Absätze, verschachtelte Listen werden flach.
  - `isRichDoc` prüft streng ohne zusätzliche Angaben (Server-Prüfung am Editor vorbei).
  - `docLength`/`isDocEmpty` rechnen auf den reinen Text. Umbrüche zählen nicht, nur Leerzeichen und Leerzeilen gelten als leer.
- `src/lib/invoice-numbering.ts`: `formatInvoiceNumber`, `parseInvoiceNumber`, `nextInvoiceNumber` (eine Regel für die Vorschau hier und den Vorschlag in PROJ-41) und `sameNumbering`. Präfix ohne Rücksicht auf Groß-/Kleinschreibung. Bei „jährlich neu“ zählt die Jahreszahl in der Nummer. Die Startnummer gilt dann nur im Jahr `startYear`.
- `src/lib/invoice-texts.ts`:
  - Blöcke `intro`/`payment`/`closing`, Grenzen (`INVOICE_TEXT_LIMITS`), Liste der Platzhalter mit Zulässigkeit (`all`/`payment`/`deposit`), `placeholderIssues` (unknown/notHere/depositOnly; in festen Texten alles „unbekannt“)
  - `salutation`, `guestTitledName`, `paymentFigures` (Anzahlung auf Cent gerundet), `placeholderValues`/`fillPlaceholders` (Datum ohne Wochentag) für PROJ-40/41
  - fester Beispiel-Datensatz der Vorschau
- `src/lib/validation/invoice-settings.ts`: `numberingSchema`, `fixedTextsSchema` (leere Fußzeile → null), `textBlockSchema` (bei „Anzahlung: nein“ werden Prozent und Frist verworfen) und `previewPaymentRules`.

**Oberfläche** `src/components/invoice-settings/`:
- `invoice-settings` (gemeinsam für Inhaber und Betreiber; `level` 2 bzw. 3 für die Überschriften, `readOnly` bei deaktiviertem Kunden, Hinweis bei nicht lesbaren Daten)
- `numbering-section`: Präfix, Jahreszahl (Schalter), Trennzeichen, Stellen, „jährlich neu“, Startnummer. Die Vorschau „Nächste Nummer“ rechnet bei jeder Eingabe neu und zeigt einen Hinweis, wenn passende Nummern die Startnummer überholen. Nach dem ersten Ausstellen wird erst nach Bestätigung gespeichert.
- `text-blocks-section`: drei Gruppen mit Liste (Standard oben, Kennzeichen „Standard“, Kurztext), Menü Bearbeiten/Als Standard setzen/Standard aufheben/Löschen (mit Bestätigung), „Baustein hinzufügen“ ab 20 gesperrt, Hinweis ohne Standard
- `text-block-panel`: Seitenpanel mit Name (doppelte Namen schon im Browser geprüft), Zahlungsregeln bei Zahlungsmodalitäten, Text, Vorschau
- `fixed-texts-section`: Kleinunternehmer-Hinweis und Fußzeile, ohne Platzhalter
- `backfill-section`: Schalter „Rechnungen nacherfassen“
- `rich-text-editor` (Tiptap, per `next/dynamic` nur hier geladen):
  - Werkzeugleiste mit shadcn-`Toggle` (neu installiert) und „Platzhalter einfügen“
  - Platzhalter-Markierung über ein ProseMirror-Plugin: erlaubte farbig, unbekannte bzw. unzulässige rot gewellt. Beim Umschalten der Anzahlung wechselt die Markierung sofort.
  - Zeichenzähler
- `rich-text-field`: Bezeichnung, Hinweis, Meldung, Vorschau
- `rich-text-view`: Ausgabe mit gefüllten Platzhaltern
- `section-shell`: Abschnitt und Konflikthinweis „Aktuelle Fassung laden“
- **Speichern-Knöpfe mit eigenem Namen** („Nummernkreis speichern“, „Feste Texte speichern“, „Schalter speichern“, „Baustein speichern“), weil auf der Betreiber-Seite mehrere Formulare untereinander stehen. Bestehende E2E-Tests suchen „Speichern“ deshalb jetzt mit `exact: true`.

**Seiten:**
- `/einstellungen/rechnungen` (Titel „Rechnungen“), vierter Reiter
- Betreiber-Detailseite: neuer Abschnitt „Rechnungen“ nach den Stammdaten
- Stammdaten-Formular ohne Schalter: Schema, Laden (`MASTER_DATA_COLUMNS`) und Speichern senden `invoice_backfill_enabled` nicht mehr
- Rechnungsliste: liest den Schalter aus `invoice_settings.backfill_enabled`, nur für Inhaber (Mitarbeiter lesen keine Einstellungen)
- Meldung `invoices.errors.backfillDisabled` verweist auf *Einstellungen → Rechnungen*

**Server-Aktionen** `src/app/(app)/einstellungen/rechnungen/actions.ts`:
- Aktionen: `saveInvoiceNumbering`, `saveInvoiceFixedTexts`, `saveInvoiceBackfill`, `saveInvoiceTextBlock`, `setInvoiceTextBlockDefault`, `deleteInvoiceTextBlock`
- Gemeinsam für Inhaber (nur der gewählte Kunde) und Betreiber. 2FA und Aktiv-Status prüft die Datenbank.
- Lesen über `src/lib/invoice-settings-data.ts` (`loadInvoiceSettings`, `getOwnInvoiceSettings`) und Umwandlung in `src/lib/invoice-settings.ts`.

**Betreiber-Protokoll:** neue Aktionen `invoice_settings`, `text_block_created/updated/deleted` mit `target_block`/`target_label`. Feldnamen aus `invoiceSettings.logFields`.

**Texte:** Namespace `invoiceSettings`, `settings.invoices`, `operator.invoiceSettingsTitle`, `operator.log.*`.

**Pakete:** `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` (3.32), `@radix-ui/react-toggle` (über shadcn `toggle`).

**Typen:** `src/types/database.ts` von Hand ergänzt (`invoice_settings`, `invoice_text_blocks`, `operator_log.target_block/target_label`, sechs Funktionen). `/backend` erzeugt die Typen neu.

**Tests:**
- Unit:
  - `rich-text.test.ts`
  - `invoice-numbering.test.ts` (alle Nummernbeispiele der Kriterien)
  - `invoice-texts.test.ts`
  - `validation/invoice-settings.test.ts`
  - `validation/tenant.test.ts` angepasst
  - `npm test`: 54 Dateien, 623 Tests grün
- Lint, Typprüfung und Produktions-Build laufen durch.
- E2E: neue Datei `tests/PROJ-39-einstellungen-rechnungen.spec.ts`; PROJ-37 (Schalter an neuer Stelle, Prüfung in `invoice_settings`) und PROJ-38 (vier Reiter) angepasst. Gegen den gebauten Server (desktop):
  - Reiter, Adresse, Titel und „Seite nicht gefunden“ für Mitarbeiter: grün
  - Abschnitte und Schalter: rot. Die Tabelle `invoice_settings` fehlt noch, die Seite zeigt den Hinweis „konnten nicht geladen werden“. Das wird mit `/backend` grün.

**Offen für `/backend`** (Schnittstelle, die das Frontend erwartet):
- **Tabelle `invoice_settings`** (eine Zeile je Kunde, `tenant_id` Primärschlüssel):
  - Nummernkreis: `number_prefix` (leer oder bis 10 Zeichen `[A-Za-z0-9-/_.]`), `number_with_year`, `number_separator` (`-`, `/`, `.`, leer), `number_digits` (3–6), `number_yearly_reset` (nur mit Jahreszahl), `number_start` (≥ 1), `number_start_year` (beim Speichern einer geänderten Startnummer: aktuelles Jahr in Wiener Zeit), `numbering_updated_at`
  - Feste Texte: `small_business_note` (jsonb, Pflicht, ≤ 500 Zeichen), `footer` (jsonb oder null, ≤ 2.000), `texts_updated_at`
  - Schalter: `backfill_enabled`, `backfill_updated_at`
  - Lesen nur Inhaber des Kunden und Admin mit 2FA (Mitarbeiter: keine Zeile), kein direktes Schreiben
- **Tabelle `invoice_text_blocks`**:
  - Spalten: `id`, `tenant_id`, `block` (`intro`/`payment`/`closing`), `name` (1–60), `name_key` (Kleinschreibung, eindeutig je Kunde + Block), `body` (jsonb, ≤ 2.000), `is_default` (höchstens einer je Kunde + Block), `deposit_percent` numeric(5,2) 1–100 und `deposit_days` 0–365 (gemeinsam oder beide null), `due_days` 0–365 und `due_basis` (`after_invoice`/`before_arrival`). Zahlungsfelder nur und Pflicht bei `payment`. Dazu Standardfelder.
  - Höchstens 20 je Block; Rechte wie oben
- **Struktur von `body`/`small_business_note`/`footer`** wie `isRichDoc`:
  - doc → paragraph | bulletList | orderedList; listItem → paragraph+; Inline: text (nicht leer, marks nur bold/italic, je höchstens einmal) | hardBreak; keine weiteren Schlüssel
  - Länge = Zeichen aller Text-Knoten
  - Platzhalter `\{[^{}\n]{1,40}\}` nur aus der Liste in `invoice-texts.ts`, je Block; feste Texte keine
- **Funktionen** (prüfen Inhaber des Kunden oder Admin mit 2FA, Kunde aktiv, Inhalt; schreiben `operator_log`):
  - `save_invoice_numbering(p_tenant_id, p_expected_updated_at, p_data {prefix, with_year, separator, digits, yearly_reset, start})`
  - `save_invoice_fixed_texts(p_tenant_id, p_expected_updated_at, p_data {small_business_note, footer})`
  - `save_invoice_backfill(p_tenant_id, p_expected_updated_at, p_enabled)`
  - `save_invoice_text_block(p_input {tenant_id, id|null, updated_at|null, block, name, body, deposit_percent, deposit_days, due_days, due_basis}) → uuid`
  - `set_invoice_text_block_default(p_tenant_id, p_block, p_block_id|null, p_expected_default_id|null)`: Konflikt, wenn der Standard des Blocks nicht mehr `p_expected_default_id` ist
  - `delete_invoice_text_block(p_tenant_id, p_block_id)`
- **Fehlercodes:**
  - P0910 Stand veraltet
  - P0911 Baustein nicht vorhanden
  - P0912 Höchstzahl
  - P0913 Name vergeben
  - P0914 Inhalt ungültig
  - P0016 deaktiviert
  - P0011 Kunde fehlt
  - 42501 keine Rechte
- **`operator_log`:**
  - neue Spalten `target_block`, `target_label`
  - Aktionen `invoice_settings` (`changed_fields`: `numbering`, `small_business_note`, `footer`, `backfill`) und `text_block_created/updated/deleted` (Block + Name; bei `updated` `changed_fields`: `name`, `body`, `payment_rules`, `is_default`)
  - nie der Text selbst; Inhaber- und Betreiber-Änderungen
- **Vorbelegung:** für bestehende Kunden (Schalterwert aus `tenants.invoice_backfill_enabled` übernehmen) und bei jedem neuen Kunden, Texte wie in der Spec (`DEFAULT_SMALL_BUSINESS_NOTE`; Bausteine als Absätze; Zahlungsregeln 14 Tage nach Rechnungsdatum bzw. 20 % / 3 Tage / 1 Tag vor Anreise)
- **Umzug des Schalters:**
  - `tenants.invoice_backfill_enabled` entfernen
  - `update_tenant_master_data` ohne diesen Schlüssel
  - `save_invoice` (P0905) liest `invoice_settings.backfill_enabled`
- Nach der Migration die Typen neu erzeugen

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
