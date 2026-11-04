# PROJ-39: Einstellungen → Rechnungen

## Status: Approved
**Created:** 2026-10-31
**Last Updated:** 2026-11-04

> Der Grundumfang ist seit v1.17.0 in Produktion. Der Status gilt für die Editor-Erweiterung vom 2026-11-04 (Abschnitt „Editor: Erweiterung“).

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

Hier wird nur **eingestellt**. Rechnungen entstehen erst mit PROJ-40 (Entwurf) und PROJ-41 (Ausstellen, PDF). Anordnung sowie Grundschrift und Grundgröße aller Rechnungen folgen mit PROJ-41. Je Text lassen sich Schriftart, Schriftgröße und Ausrichtung seit der Erweiterung vom 2026-11-04 hier abweichend festlegen.

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
- **Zusätzlich je Text:** Schriftart, Schriftgröße und Ausrichtung, HTML-Code eingeschränkt bearbeitbar (siehe „Editor: Erweiterung“)
- **Nicht erlaubt:** freies HTML, Links, Farben, Bilder, Tabellen; Schriftart, Schriftgröße oder Ausrichtung nur für einen Teil des Texts
- **Einfügen aus Word, E-Mail oder Webseite:** übrig bleiben nur die erlaubten Formatierungen
- **Platzhalter** werden über eine Auswahl „Platzhalter einfügen“ eingesetzt und im Editor als Markierung angezeigt. Von Hand getippte Platzhalter in richtiger Schreibweise werden ebenfalls erkannt; unbekannte (z. B. „{Gastname}“) führen zum Hinweis „Unbekannter Platzhalter: {Gastname}“ und verhindern das Speichern.
- **Vorschau** unter dem Editor: der Text so, wie er auf der Rechnung erscheinen würde, mit Platzhaltern gefüllt durch Beispieldaten (z. B. „Sehr geehrte Frau Mag. Muster“, „Top 1“, „14.10.2026“, „€ 450,00“).

### Editor: Erweiterung (2026-11-04)
Gilt für alle Texte mit diesem Editor: Bausteine, Kleinunternehmer-Hinweis, Fußzeile und die Textblöcke im Rechnungsentwurf (PROJ-40).

**Schriftart, Schriftgröße und Ausrichtung gelten immer für den ganzen Text**, nicht für Markierungen oder einzelne Absätze.

| Einstellung | Auswahl | Ohne Auswahl |
|---|---|---|
| Schriftart | Arimo (wie Arial), Tinos (wie Times), Carlito (wie Calibri), Source Sans 3, Source Serif 4, Open Sans | „Standard“ |
| Schriftgröße | 6 bis 24 pt in Schritten von 0,5 pt, freie Eingabe (Komma oder Punkt) | „Standard“ (leeres Feld) |
| Ausrichtung | linksbündig, zentriert, rechtsbündig, Blocksatz | linksbündig |

- **„Standard“** folgt ab PROJ-41 der Grundschrift und Grundgröße aus dem Briefpapier. Bis dahin bleibt es bei der bisherigen Darstellung der Vorschau. Bestehende Texte stehen auf „Standard“ und linksbündig und sehen unverändert aus.
- **Listen** bleiben bei jeder Ausrichtung linksbündig. Schriftart und Schriftgröße gelten auch für sie.
- **Schreibfläche und Vorschau** zeigen Schriftart, Schriftgröße und Ausrichtung so, wie sie gewählt sind.
- **Einfügen aus Word, E-Mail oder Webseite** übernimmt weder Schriftart noch Schriftgröße noch Ausrichtung.
- **Entwurf (PROJ-40):** Die Wahl eines Bausteins übernimmt seinen Text samt diesen Einstellungen als Kopie. Sie sind je Rechnung änderbar.

**HTML-Code:** Ein Umschalter „Code“ in der Werkzeugleiste zeigt statt der Schreibfläche ein Textfeld mit dem HTML des Texts. Das HTML wird nur für die Bearbeitung erzeugt; gespeichert wird weiter die geprüfte Struktur.
- **Erlaubte Tags:** `<p>`, `<br>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, dazu ein äußeres `<div>` nur für die drei Einstellungen. Es erscheint nur, wenn etwas abweichend eingestellt ist, z. B. `<div style="font-family: Arimo; font-size: 10.5pt; text-align: justify">…</div>`.
- **Nicht Erlaubtes** wird beim Zurückschalten und beim Speichern entfernt, sein Text bleibt erhalten. Das gilt auch für andere Stilangaben, Attribute und ungültige Werte (z. B. `font-size: 40pt`, unbekannte Schrift). Ein Hinweis nennt, was entfernt wurde, z. B. „Entfernt: <a>, style an <p>“.
- **Speichern im Code-Modus:** Wurde nichts entfernt, wird gespeichert. Wurde etwas entfernt, wird nicht gespeichert: Die Schreibfläche erscheint mit dem bereinigten Text und dem Hinweis, damit der Nutzer das Ergebnis prüfen kann.
- **Fehlerhaftes HTML** (z. B. nicht geschlossene Tags) wird so gut wie möglich gelesen; das Ergebnis ist in der Vorschau sichtbar.
- **Platzhalter** sind im Code normaler Text und werden wie bisher geprüft.
- **Im Code-Modus** sind die übrigen Werkzeuge und „Platzhalter einfügen“ gesperrt. Die Vorschau zeigt den aktuellen Stand.

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
- Als **Inhaber** möchte ich je Text Schriftart, Schriftgröße und Ausrichtung wählen, damit z. B. die Fußzeile klein und zentriert und der Einleitungstext im Blocksatz steht.
- Als **Inhaber** möchte ich den HTML-Code eines Texts direkt bearbeiten, damit ich vorhandenes HTML übernehmen und die Struktur gezielt korrigieren kann, ohne dass die Rechnung dadurch beschädigt werden kann.

## Out of Scope
- Rechnungsentwurf, Ersetzen der Platzhalter, Wahl der Bausteine je Rechnung, Block 3 (Gastnamen ja/nein, mit Mitreisenden), Empfänger Gast/Firma (PROJ-40)
- Nummer vergeben, überschreiben, Lückenhinweis, Fußzeile/Hinweis auf der Rechnung, PDF (PROJ-41)
- Anordnung der Blöcke, Grundschrift und Grundgröße aller Rechnungen, Position und Größe des Logos (PROJ-41, Briefpapier)
- Umsetzung von Schriftart, Schriftgröße und Ausrichtung im PDF (mit dem PDF-Erzeuger, PROJ-41/PROJ-42)
- Schriftart, Schriftgröße oder Ausrichtung für einzelne Markierungen oder Absätze
- Freies HTML und weitere Tags (Tabellen, Links, Farben, Bilder)
- Eigene hochgeladene Schriften; echte Arial, Times New Roman oder Calibri (nicht frei einbettbar)
- Syntax-Hervorhebung oder Autovervollständigung im Code-Feld
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
- [ ] Angenommen der Inhaber schreibt einen Baustein, wenn er Text markiert, dann kann er ihn fett oder kursiv setzen und Aufzählungen bzw. nummerierte Listen anlegen; weitere Formatierungen für markierten Text gibt es nicht
- [ ] Angenommen der Inhaber fügt formatierten Text aus Word oder einer Webseite ein, wenn der Text im Editor steht, dann sind nur fett, kursiv, Absätze und Listen erhalten; Links, Farben, Schriftarten, Schriftgrößen, Ausrichtung, Bilder und Tabellen sind entfernt; die Einstellungen des Texts bleiben unverändert
- [ ] Angenommen der Inhaber wählt „Platzhalter einfügen“ in einem Baustein von Block 4 oder 7, wenn die Auswahl erscheint, dann enthält sie {Anrede}, {Gast}, {Wohnung}, {Anreise}, {Abreise}, {Nächte}, {Rechnungsnummer}, {Rechnungsdatum}, {Betrag}
- [ ] Angenommen der Inhaber wählt „Platzhalter einfügen“ in einem Baustein von Block 6, wenn die Auswahl erscheint, dann enthält sie zusätzlich {Fälligkeitsdatum} und, nur bei Anzahlung, {Anzahlung}, {Anzahlung fällig} und {Restbetrag}
- [ ] Angenommen der Inhaber tippt „{Wohnung}“ von Hand, wenn der Text im Editor steht, dann wird der Platzhalter wie ein eingefügter erkannt
- [ ] Angenommen der Text enthält „{Gastname}“ oder einen in diesem Block nicht erlaubten Platzhalter, wenn gespeichert wird, dann erscheint „Unbekannter Platzhalter: {Gastname}“ bzw. ein Hinweis, dass er hier nicht erlaubt ist, und nichts wird gespeichert
- [ ] Angenommen der Inhaber bearbeitet einen Baustein, wenn er tippt, dann zeigt die Vorschau darunter den Text mit Beispieldaten, z. B. „Sehr geehrte Frau Mag. Muster“ für {Anrede} und „14.10.2026“ (ohne Wochentag) für {Anreise}
- [ ] Angenommen ein Zahlungsbaustein mit 20 % Anzahlung binnen 3 Tagen und Fälligkeit 1 Tag vor Anreise, wenn die Vorschau erscheint, dann sind {Anzahlung}, {Anzahlung fällig}, {Restbetrag} und {Fälligkeitsdatum} mit den daraus berechneten Beispielwerten gefüllt
- [ ] Angenommen jemand sendet am Editor vorbei HTML mit Skripten, Links oder Stilangaben, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt oder auf die erlaubten Formatierungen bereinigt; gespeichert wird nie etwas anderes

### Schriftart, Schriftgröße und Ausrichtung
- [ ] Angenommen der Inhaber bearbeitet einen Baustein, den Kleinunternehmer-Hinweis, die Fußzeile oder einen Textblock im Entwurf, wenn die Werkzeugleiste erscheint, dann kann er Schriftart, Schriftgröße und Ausrichtung wählen
- [ ] Angenommen der Inhaber öffnet die Schriftauswahl, wenn die Liste erscheint, dann enthält sie „Standard“, Arimo (wie Arial), Tinos (wie Times), Carlito (wie Calibri), Source Sans 3, Source Serif 4 und Open Sans
- [ ] Angenommen der Inhaber gibt 10,5 ein, wenn er das Feld verlässt, dann gilt für den ganzen Text 10,5 pt; ein leeres Feld bedeutet „Standard“
- [ ] Angenommen der Inhaber gibt 5, 25 oder 10,3 ein, wenn die Eingabe geprüft wird, dann erscheint ein Hinweis auf 6 bis 24 pt in Schritten von 0,5 pt, und nichts wird gespeichert
- [ ] Angenommen der Inhaber wählt Schriftart, Schriftgröße oder Ausrichtung, wenn nur ein Teil des Texts markiert ist, dann gilt die Wahl trotzdem für den ganzen Text
- [ ] Angenommen der Inhaber wählt Arimo, 11 pt und Blocksatz, wenn er speichert und den Text neu öffnet, dann zeigen Werkzeugleiste, Schreibfläche und Vorschau diese Werte
- [ ] Angenommen ein Text enthält einen Absatz und eine Liste und ist zentriert, wenn er angezeigt wird, dann ist der Absatz zentriert und die Liste linksbündig in derselben Schriftart und Größe
- [ ] Angenommen ein Text von vor der Erweiterung, wenn er geöffnet wird, dann stehen Schriftart und Größe auf „Standard“, die Ausrichtung auf linksbündig, und er sieht aus wie zuvor
- [ ] Angenommen der Inhaber ändert nur die Schriftart eines Bausteins, wenn er speichert, dann zählt das wie eine Textänderung für Konfliktschutz, Bausteinstand und Protokoll (ohne Textinhalt)
- [ ] Angenommen im Entwurf wird ein Baustein mit Tinos, 12 pt gewählt, wenn der Text übernommen wird, dann hat die Kopie diese Werte; eine Änderung im Entwurf ändert den Baustein nicht
- [ ] Angenommen im Entwurf wurde nur die Schriftgröße eines übernommenen Texts geändert, wenn ein anderer Baustein gewählt wird, dann erscheint dieselbe Rückfrage wie bei einem geänderten Text
- [ ] Angenommen die Entwurfsvorschau (PROJ-40) wird geöffnet, wenn Texte eigene Einstellungen haben, dann erscheinen sie darin mit Schriftart, Schriftgröße und Ausrichtung
- [ ] Angenommen jemand sendet am Editor vorbei eine unbekannte Schrift, eine Größe außerhalb von 6 bis 24 pt, eine Größe außerhalb der 0,5-pt-Schritte oder eine unbekannte Ausrichtung, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt; auch die Datenbank lehnt solche Werte ab

### HTML-Code
- [ ] Angenommen der Inhaber schaltet auf „Code“, wenn das Feld erscheint, dann zeigt es den Text als HTML samt aktueller Einstellungen; zurückgeschaltet ist der Text unverändert, wenn nichts bearbeitet wurde
- [ ] Angenommen der Inhaber ändert im Code `<p>` in `<ul><li>`, `font-size` auf 9pt und `text-align` auf right, wenn er zurückschaltet, dann zeigen Schreibfläche und Werkzeugleiste Liste, 9 pt und rechtsbündig
- [ ] Angenommen der Code enthält `<a href="…">Link</a>`, `<table>` oder `<span style="color:red">`, wenn zurückgeschaltet wird, dann bleibt der Text, die Tags sind entfernt, und ein Hinweis nennt sie
- [ ] Angenommen der Code enthält `<script>` oder `onerror`, wenn er verarbeitet wird, dann läuft nichts davon und der Hinweis nennt die Entfernung; der Inhalt von `<script>` wird nicht zu Text
- [ ] Angenommen der Code enthält `font-size: 40pt` oder eine unbekannte Schrift, wenn zurückgeschaltet wird, dann steht der betroffene Wert auf „Standard“, und der Hinweis nennt ihn
- [ ] Angenommen im Code-Modus wurde nichts Unzulässiges geschrieben, wenn „Speichern“ gewählt wird, dann wird gespeichert
- [ ] Angenommen im Code-Modus wurde Unzulässiges geschrieben, wenn „Speichern“ gewählt wird, dann wird nicht gespeichert, und der Nutzer sieht die Schreibfläche mit bereinigtem Text und Hinweis
- [ ] Angenommen der Code enthält `{Gastname}`, wenn gespeichert wird, dann erscheint wie im Editor „Unbekannter Platzhalter: {Gastname}“
- [ ] Angenommen der Inhaber tippt im Code, wenn die Vorschau sichtbar ist, dann zeigt sie den aktuellen Stand
- [ ] Angenommen ein Text enthält `<`, `>` oder `&` als normale Zeichen, wenn zwischen Editor und Code gewechselt wird, dann bleiben die Zeichen unverändert (im Code als `&lt;`, `&gt;`, `&amp;`)
- [ ] Angenommen der Code-Modus ist aktiv, wenn die Werkzeugleiste erscheint, dann sind nur der Umschalter und ein Hinweis auf die erlaubten Tags aktiv
- [ ] Angenommen ein deaktivierter Kunde oder eine sonstige Nur-Lesen-Ansicht, wenn der Text erscheint, dann gibt es keinen Code-Umschalter und keine Formatauswahl

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
- **Schrift lädt nicht** (langsame Verbindung): Schreibfläche und Vorschau zeigen eine Ersatzschrift, die gespeicherte Wahl bleibt erhalten.
- **Code nur mit Tags und ohne Text:** gilt als leer (Pflichtfeld-Meldung bzw. leere Fußzeile).
- **Text außerhalb eines Absatzes oder mehrere `<div>` im Code:** Der Text wird zu Absätzen; nur das äußere `<div>` zählt, weitere werden entfernt und im Hinweis genannt.
- **Zeichengrenze im Code:** Es zählt der Text ohne Tags wie im Editor. Code über 200.000 Zeichen wird mit Hinweis abgewiesen und nie gekürzt; der bisherige Stand bleibt.
- **Sehr große Schrift am Handy:** Die Schreibfläche bricht um, kein seitliches Scrollen.
- **Bereits gespeicherte Entwürfe:** behalten ihren Text und stehen auf „Standard“ und linksbündig.

## Technical Requirements
- Rechte serverseitig durchgesetzt (Inhaber nur eigener Kunde, Betreiber alle aktiven Kunden schreibend, Mitarbeiter keine Rechte)
- Formatierter Text wird serverseitig auf die erlaubten Formatierungen geprüft bzw. bereinigt; kein freies HTML
- HTML aus dem Code-Feld wird nie als HTML gespeichert oder ausgegeben, nur in die geprüfte Struktur übersetzt; beim Lesen darf nichts daraus ausgeführt oder nachgeladen werden
- Schriften frei lizenziert und im PDF einbettbar, je Schrift mit normal, fett, kursiv und fett-kursiv (geprüft, siehe Tech Design I); nur auf den Seiten mit Editor oder Entwurfsvorschau laden
- PROJ-41 nutzt für die Grundschrift dieselbe Schriftenliste
- Prüfregeln (Grenzen, Platzhalter, Nummernformat) gleich in Oberfläche und Server
- Regel „nächste Nummer“ an einer Stelle, nutzbar von der Vorschau hier und vom Ausstellen in PROJ-41
- Deutsche Texte über die bestehende i18n-Struktur
- Responsiv ab 375 px Breite; Chrome, Firefox, Safari

## Open Questions
- [ ] Wortlaut des Kleinunternehmer-Hinweises mit Steuerberater abstimmen (Stand der Kleinunternehmerregelung ab 2025)
- [x] Bestimmt sich der Kleinunternehmer-Status einer Rechnung nach dem Rechnungsdatum oder nach der Buchung (PROJ-36: Abreise bzw. Stornodatum)? → Nach der Buchung (PROJ-40, 2026-10-31)
- [x] Wie entsteht das Fälligkeitsdatum, wenn im Entwurf kein Zahlungsbaustein gewählt ist, und was gilt, wenn „vor Anreise“ vor dem Rechnungsdatum liegt? → Fällig am Rechnungsdatum; frühere Fristen werden auf das Rechnungsdatum gesetzt, mit Hinweis (PROJ-40, 2026-10-31)
- [x] Erscheinen auch die Datumsangaben in Block 2a/2b ohne Wochentag? → Ja, alle Datumsangaben auf der Rechnung ohne Wochentag (PROJ-40, 2026-10-31)
- [x] Wie lautet {Anrede} bei Firmen als Empfänger (z. B. „Sehr geehrte Damen und Herren“)? → Im Entwurf wählbar, vorausgewählt „Sehr geehrte Damen und Herren“, alternativ Anrede des Hauptgasts (PROJ-40, 2026-10-31)
- [x] Eingabe im Entwurf vor dem Aktivwerden des Formulars geht verloren → behoben im Entwurf (BUG-4, 2026-11-04)
- [ ] Haben andere vom Server gelieferte Formulare dieselbe Lücke wie der Entwurf (BUG-4), z. B. Buchung, Gast, Einstellungen? Nicht geprüft; `useAdoptEarlyInput` ist wiederverwendbar
- [ ] PROJ-41: Schriften als TTF- oder WOFF-Dateien samt Lizenztexten ablegen und prüfen, dass Vorschau und PDF gleich umbrechen

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
| Schriftart, Schriftgröße und Ausrichtung je ganzem Text, nicht je Markierung oder Absatz; „Standard“ folgt dem Briefpapier (PROJ-41) | Wunsch des Nutzers; ergibt ein einheitliches Rechnungsbild und ergänzt die Grundschrift, statt sie zu ersetzen | 2026-11-04 |
| Sechs freie Schriften: Arimo, Tinos, Carlito, Source Sans 3, Source Serif 4, Open Sans | Arial, Times und Calibri sind nicht frei einbettbar; Arimo, Tinos und Carlito haben dieselben Zeichenbreiten | 2026-11-04 |
| Schriftgröße frei von 6 bis 24 pt in 0,5-pt-Schritten | Wunsch des Nutzers statt fester Liste | 2026-11-04 |
| HTML-Code nur mit erlaubten Tags plus den drei Einstellungen; Unzulässiges wird entfernt und benannt; ändert die Entscheidung „kein HTML“ nur für die Bearbeitung | Direkte Bearbeitung ohne die Sicherheit und PDF-Fähigkeit aufzugeben; freies HTML hätte einen Browser auf dem Server für das PDF verlangt | 2026-11-04 |
| Speichern im Code-Modus bricht ab, wenn etwas entfernt wurde | Der Nutzer soll das bereinigte Ergebnis sehen, bevor es gespeichert wird; so geht nichts unbemerkt verloren | 2026-11-04 |
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
| Einstellungen als optionaler Teil des gespeicherten Texts, keine neuen Spalten | Eine Prüfregel deckt Bausteine, feste Texte und Entwürfe ab; Konfliktschutz, Protokoll und Kopie in den Entwurf funktionieren ohne eigenen Bau; alte Texte bleiben gültig | 2026-11-04 |
| Code-Feld wird bei jeder Eingabe im Browser in die Struktur übersetzt, mit dem eingebauten Lesewerkzeug | HTML erreicht den Server nie; Vorschau und Prüfungen laufen ohne Sonderweg; keine neuen Pakete | 2026-11-04 |
| Formulare fragen vor dem Speichern offene Code-Felder ab | Nur so kann das Speichern abbrechen, wenn etwas entfernt wurde; die Formularprüfung kennt das Entfernte nicht | 2026-11-04 |
| Zu langer Code wird abgewiesen statt gekürzt, Grenze 200.000 Zeichen statt 20.000 | HTML aus Word ist groß, das meiste fällt beim Lesen weg; ein Kürzen zerstörte den Text ohne Hinweis (BUG-2) | 2026-11-04 |
| Früh Eingegebenes wird beim Aktivwerden des Entwurfs übernommen (`useAdoptEarlyInput`), nicht die Eingabe gesperrt | Nichts geht verloren und die Felder flackern nicht ausgegraut (BUG-4) | 2026-11-04 |
| Schriften im Browser beim Bauen mitgeliefert (`next/font`), ohne Vorladen; PDF-Dateien erst mit PROJ-41 | Keine Verbindung zu Google, DSGVO-freundlich, übrige App nicht langsamer; React-PDF braucht ohnehin andere Dateien (TTF/WOFF, nicht variabel) | 2026-11-04 |
| Gespeichert bleibt die strukturierte Beschreibung, ergänzt um die drei Einstellungen je Text; Datenbank und App prüfen die erlaubten Werte; HTML ist nur eine Bearbeitungsansicht | Freies HTML bleibt nicht speicherbar, PDF kann weiter direkt aus der Struktur setzen; alte Texte bleiben gültig | 2026-11-04 |

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

### I) Editor-Erweiterung: Schrift, Größe, Ausrichtung, HTML-Code (2026-11-04)

**Ausgangslage:** Alle Rechnungstexte (Bausteine, Kleinunternehmer-Hinweis, Fußzeile, Entwurfstexte) laufen über denselben Editor, dieselbe Anzeige und dieselbe Datenbankprüfung. Die Erweiterung wird deshalb an diesen drei Stellen gebaut und wirkt überall.

**Oberfläche**
```
Text-Editor (gemeinsamer Baustein, erweitert)
+-- Werkzeugleiste (bricht am Handy um, Bedienelemente mindestens 44 px)
|   +-- Fett · Kursiv · Aufzählung · Nummerierte Liste
|   +-- Schriftart (Auswahl: Standard + 6 Schriften, jede in ihrer eigenen Gestalt)   NEU
|   +-- Schriftgröße (Zahlenfeld mit „pt“, leer = Standard)                            NEU
|   +-- Ausrichtung (vier Umschalter, immer genau einer aktiv)                         NEU
|   +-- Code (Umschalter)                                                              NEU
|   +-- Platzhalter einfügen
+-- Schreibfläche ODER Code-Feld (mehrzeiliges Textfeld in Festbreitenschrift)         NEU
+-- Hinweis „Entfernt: …“ (nach dem Bereinigen, bis zur nächsten Bearbeitung)          NEU
+-- Zeichenzähler
```
Vorschau im Editor und Entwurfsvorschau zeigen die Einstellungen über die vorhandene Textanzeige. Neue shadcn-Bausteine sind nicht nötig (Select, Input, Textarea und Toggle sind vorhanden).

**Datenmodell (in Worten)**
Keine neuen Spalten und keine Datenumstellung. Der gespeicherte Text bekommt einen optionalen Teil „Einstellungen“ mit bis zu drei Angaben:
- Schriftart: feste Kennung aus der Liste; fehlt = Standard
- Schriftgröße: Zahl von 6 bis 24 in 0,5er-Schritten; fehlt = Standard
- Ausrichtung: zentriert, rechtsbündig oder Blocksatz; fehlt = linksbündig

Alte Texte haben diesen Teil nicht und bleiben damit gültig und unverändert. Bausteine, feste Texte und Entwürfe nutzen dieselbe Prüfung, darum genügt eine Änderung an der Prüfregel in der Datenbank. Die Migration muss vor dem neuen Code in jede Umgebung; die laufende App kommt mit der erweiterten Prüfung zurecht.

Weil die Einstellungen Teil des Texts sind, greifen ohne eigenen Bau: Konfliktschutz und Bausteinstand, Protokoll ohne Textinhalt, Kopie in den Entwurf und die Rückfrage bei geändertem Text. Das setzt voraus, dass die App die Einstellungen beim Vergleich immer in derselben Reihenfolge führt, weil die Datenbank die Reihenfolge nicht garantiert; Tests sichern das ab.

**HTML-Code**
Das HTML existiert nur im Browser, während das Code-Feld offen ist. Zwei Übersetzungen an einer Stelle in der App:
- **Text → HTML** beim Einschalten
- **HTML → Text** bei jeder Eingabe, zusammen mit der Liste des Entfernten

Der Server bekommt wie bisher nur die geprüfte Struktur und nie HTML. Gelesen wird mit dem eingebauten Lesewerkzeug des Browsers, das bereits beim Einfügen aus Word verwendet wird. Es führt keine Skripte aus und lädt keine Bilder nach. Der Inhalt von `<script>` und `<style>` wird verworfen.

Weil jede Eingabe sofort übersetzt wird, funktionieren Vorschau, Zeichenzähler, Platzhalterprüfung und „ungespeicherte Änderungen“ auch im Code-Modus ohne Sonderweg. Wer nur umschaltet und nichts ändert, ändert den Text nicht.

**Speichern im Code-Modus:** Das Formular fragt vor dem Speichern alle offenen Code-Felder ab. Hat eines davon etwas entfernt, wechselt es zur Schreibfläche mit Hinweis, und das Speichern unterbleibt. Das Formular erfährt das über eine kleine gemeinsame Abfrage, die in drei Formulare eingebaut wird: Baustein, feste Texte und Entwurf.

**Schriften**
| Schrift | Lizenz | Normal, fett, kursiv, fett-kursiv | Zeichen für Mitteleuropa |
|---|---|---|---|
| Arimo | Apache 2.0 | ja | ja |
| Tinos | Apache 2.0 | ja | ja |
| Carlito | SIL OFL | ja | ja |
| Source Sans 3 | SIL OFL | ja | ja |
| Source Serif 4 | SIL OFL | ja | ja |
| Open Sans | SIL OFL | ja | ja |

- **Im Browser** kommen die Schriften über denselben Weg wie die App-Schrift: Sie werden beim Bauen mitgeliefert. Beim Seitenaufruf gibt es keine Verbindung zu Google, das ist auch für die DSGVO wichtig.
- **Geladen** wird nur auf Seiten mit Editor oder Entwurfsvorschau und nur die Schrift, die tatsächlich angezeigt wird. Die übrige App wird nicht langsamer.
- **Im PDF (PROJ-41):** React-PDF kann die Browser-Dateien nicht verwenden, es braucht einzelne TTF- oder WOFF-Dateien statt variabler Schriften. PROJ-41 legt dafür dieselben Schriften als solche Dateien samt Lizenztexten ab und prüft, dass Vorschau und PDF gleich umbrechen.

**Tests (Plan)**
- Unit: Hin- und Rückübersetzung ohne Änderung, Entferntes samt Liste, ungültige Werte, Sonderzeichen `<`, `>`, `&`, kaputtes HTML, Skripte; Normalisierung und strenge Prüfung mit Einstellungen
- Integration: Datenbank nimmt gültige Werte an und lehnt ungültige ab; alte Texte bleiben gültig; Bausteinstand ändert sich bei reiner Formatänderung
- E2E: Auswahl, Speichern und erneutes Öffnen; Code-Modus mit und ohne Entferntes; Entwurf übernimmt Einstellungen; Handy 375 px

**Pakete:** keine neuen.

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

**Offen für `/backend`** (Schnittstelle, die das Frontend erwartet; erledigt, siehe Implementation Notes (Backend)):
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

### Korrekturen nach QA (Frontend, 2026-10-31)
- **BUG-1 (Fokus nach „Platzhalter einfügen“):** `rich-text-editor.tsx` merkt sich die Auswahl eines Platzhalters. Beim Schließen des Menüs verhindert `onCloseAutoFocus` dann den Sprung zum Menüknopf und setzt den Fokus in die Schreibfläche. Ohne Auswahl (Escape, Klick daneben) bleibt der Fokus wie üblich auf dem Knopf.
- **BUG-2 (doppelter Aufbau, Schreibflächen ohne Namen):** Die Ursache lag nicht in PROJ-39.
  - `SidebarProvider` setzt nach dem Laden `isMobile` (bei 375 px auf `true`). Diese Kontextänderung erreicht die noch gestreamte Seite hinter `loading.tsx`. React kann sie dann nicht mehr hydrieren und baut sie im Browser neu auf, während der Server-Inhalt versteckt (`div#S:0[hidden]`) noch ankommt. Nachgestellt mit Playwright; im React-Quelltext bestätigt: jede Kontextänderung oberhalb einer wartenden Grenze führt zum Neuaufbau.
  - Die App nutzt die Seitenleiste ohne Schublade (`collapsible="none"`, unter 1024 px die untere Leiste) und braucht `isMobile` nicht. Neue Option `detectMobile` in `ui/sidebar.tsx` (nach dem Muster von `keyboardShortcut`), `useIsMobile(enabled)` in `hooks/use-mobile.tsx`; `(app)/layout.tsx` setzt `detectMobile={false}`. Das betrifft alle Seiten der App und behebt den Neuaufbau überall bei 375 px.
  - Zusätzlich setzt der Editor `aria-labelledby` jetzt im selben Effekt wie die übrigen ARIA-Angaben, mit der aktuellen Bezeichnung.
  - Nachgeprüft gegen den Produktions-Build, je 16 Ladevorgänge bei 375 px (Chrome) und in Firefox: immer genau ein Formular, alle Schreibflächen mit Namen. Im Dev-Modus (`npm run dev`) gibt es weiterhin vereinzelte `useId`-Abweichungen ab der App-Hülle. Sie treten im Build nicht auf und betreffen nicht nur PROJ-39.
- **BUG-4 (Tabellen beim Einfügen):** neue Funktion `src/lib/paste-html.ts` `tablesToBlocks` (mit Unit-Test) als `transformPastedHTML`. Jede Tabelle wird durch ihre Zellen als eigene Blöcke ersetzt, verschachtelte Tabellen von innen nach außen. Jede Zelle wird so ein eigener Absatz.
- **BUG-5 (Schließen-Knopf 40 px):** `detail-panel.tsx` und das „Mehr“-Blatt in `shell/bottom-nav.tsx` mit `p-3.5` statt `p-3`, also 44 × 44 px. Das gilt für alle Seitenpanels der App.
- **E2E angepasst:** Die Umgehung für BUG-1 in der Platzhalter-Prüfung ist entfernt. Die Prüfung des Einfügens erwartet „Zelle A“ und „Zelle B“ als eigene Absätze. Die 44-px-Prüfung bei 375 px nimmt den Schließen-Knopf nicht mehr aus.
- **Tests:** `npm test` (unit) 467 grün, Lint und Typprüfung sauber, Produktions-Build läuft durch. E2E PROJ-39 gegen den Build:
  - desktop: 26/26 grün
  - Firefox: 24 grün, 1 übersprungen (künstliches Einfügen), 1 rot. Rot ist der Grenzfall „mehr als 1.000 Rechnungen“, also BUG-3. Er ist dem Backend zugeordnet und noch offen. Auf desktop war er nur zufällig grün, weil alle Testrechnungen dasselbe Datum haben.
- **Offen per `/backend`:** BUG-3 und BUG-6 (erledigt, siehe Implementation Notes (Backend) → Korrekturen nach QA)

### Korrektur BUG-7 (Frontend, 2026-10-31)
- **Ursache:** Der Fokus kam erst nach dem Ausblenden des Menüs in die Schreibfläche. Zusätzlich wartet `focus()` von Tiptap einen Frame. In dieser Zeit hatte noch der Menüeintrag die Tasten.
- **Korrektur in `rich-text-editor.tsx`:**
  - Das Platzhalter-Menü ist jetzt gesteuert (`open`/`onOpenChange`).
  - `onSelect` verhindert das Standard-Schließen und schließt das Menü sofort mit `flushSync`. Damit endet die Fokusfalle des Menüs.
  - Danach setzt `editor.view.focus()` den Fokus synchron in die Schreibfläche, dann wird der Platzhalter eingefügt.
  - `onCloseAutoFocus` verhindert weiterhin den Sprung zum Menüknopf (BUG-1).
- **Tests (E2E PROJ-39, Editor-Prüfungen):**
  - BUG-7 in Chrome gegen den Build 3 von 3 grün
  - Chrome: Platzhalter, BUG-1, BUG-2, Fett/Listen/Einfügen 9 grün
  - Firefox (Build) und Safari (`npm run dev`): Platzhalter, BUG-1, BUG-7 je 6 grün

### Editor-Erweiterung (Frontend, 2026-11-04)
- `src/lib/rich-text.ts`: optionale Einstellungen `attrs` am Dokument (Schriftart, Größe, Ausrichtung). `normalizeDoc` behält nur gültige Werte in fester Reihenfolge, `isRichDoc` prüft streng, `parseFontSize` liest die Eingabe (Komma oder Punkt). Linksbündig wird nicht gespeichert.
- `src/lib/rich-text-html.ts` (neu, nur im Browser): `docToHtml` und `htmlToDoc`; `htmlToDoc` liefert zusätzlich die Liste des Entfernten. Liest mit `DOMParser`, der nichts ausführt und nichts nachlädt.
- `rich-text-fonts.ts` (neu): sechs Schriften über `next/font/google`, ohne Vorladen; `richTextStyle` setzt die Darstellung in Schreibfläche und `RichTextView`. Die Werte sind dynamisch, darum hier Inline-Stile statt Tailwind.
- `rich-text-editor.tsx`: Werkzeugleiste mit Schriftart, Schriftgröße, Ausrichtung und Code; Code-Feld (`Textarea`, höchstens 200.000 Zeichen, siehe QA BUG-2). Tiptap kennt die Einstellungen nicht, sie werden beim Speichern des Inhalts wieder angehängt.
- `rich-text-guard.tsx` (neu): Formulare fragen vor dem Speichern ihre Editoren ab; eingebaut in Baustein, feste Texte und Entwurf.
- Abweichung vom Spec: `<b>` und `<i>` im Code werden still als fett und kursiv übernommen statt entfernt, weil sie dasselbe bedeuten und sonst Formatierung verloren ginge.
- Ergänzung zum Spec: Die Schriftauswahl zeigt jeden Eintrag in seiner eigenen Schrift; die Schrift lädt erst beim Öffnen der Liste.
- Tests: 572 Unit-Tests grün. E2E grün: neuer Block „Editor-Erweiterung“ (Desktop, Handy), PROJ-39 Editor, feste Texte, Barrierefreiheit, PROJ-40 Texte und Vorschau. Firefox und Safari sind noch nicht geprüft.
- Bestehende Tests angepasst: Knopfzahl der Werkzeugleiste; PROJ-40 sucht das Textfeld jetzt mit Namen, weil die Schriftgröße ebenfalls ein Textfeld ist; `openCreate` wartet auf den Editor.

**Backend (2026-11-04):** erledigt, siehe „Editor-Erweiterung (Backend)“.

**Für /qa:** Eingabe direkt nach dem Laden des Entwurfs. Füllt ein Test das Rechnungsdatum aus, bevor das Formular aktiv ist, zeigt das Feld den neuen Wert, das Formular rechnet aber mit dem heutigen Datum. Das bestand schon vor dieser Erweiterung (1 von 6 Läufen), mit ihr trat es im selben Test öfter auf (4 von 5 Läufen, kleine Stichprobe). Ursache und Größe des Zeitfensters sind nicht gemessen. In den Tests überbrückt `openCreate` die Lücke; behoben ist sie damit nicht. Vor PROJ-42 klären, weil das Datum dort festgeschrieben wird.

## Implementation Notes (Backend)
**Stand 2026-10-31.** Migration `20261031110516_invoice_settings.sql` ist in Dev („apppa-dev“) eingespielt (vom Nutzer freigegeben wegen neuer Zugriffsregeln), die Typen sind neu erzeugt. Die Advisors melden nur die bekannten Auth-Hinweise (`auth_otp_long_expiry`, `auth_leaked_password_protection`, Runbook).

**Datenbank**
- **`invoice_settings`** (eine Zeile je Kunde, eindeutig über `tenant_id`, mit `id` für das Änderungsprotokoll):
  - Nummernkreis mit Prüfregeln: Präfix-Muster, Trennzeichen, 3–6 Stellen, Startnummer ≥ 1, „jährlich neu“ nur mit Jahreszahl. Dazu `number_start_year`.
  - `small_business_note` (Pflicht, ≤ 500) und `footer` (null oder ≤ 2.000), beide ohne Platzhalter
  - `backfill_enabled`
  - Stempel je Abschnitt: `numbering_updated_at`, `texts_updated_at`, `backfill_updated_at`
- **`invoice_text_blocks`**:
  - `name_key` eindeutig je Kunde und Block; höchstens ein Standard je Block (Teil-Index)
  - Zahlungsfelder nur bei `payment`, Fälligkeit dort Pflicht; Anzahlung (Prozent und Frist) nur gemeinsam
  - Text-Prüfung mit den für Block und Anzahlung erlaubten Platzhaltern. Diese Regeln greifen auch beim Schreiben mit dem geheimen Schlüssel.
- **Zugriff (RLS):** Lesen nur Inhaber des Kunden und Admin mit 2FA (Mitarbeiter, fremde Inhaber und anonyme Anfragen sehen nichts). Kein direktes Schreiben. Änderungsprotokoll über `private.enable_tenant_table`. Beim Löschen des Kunden fallen beide Tabellen mit.
- **Prüfung des formatierten Texts** (`private.rich_*`, gleiche Regeln wie `src/lib/rich-text.ts`):
  - Struktur streng (nur doc/paragraph/Listen/text/hardBreak, Marken bold/italic, keine weiteren Schlüssel)
  - Länge ohne Umbrüche, leer bei nur Leerraum
  - Platzhalter aus `private.invoice_placeholders(block, mit Anzahlung)`, gleiche Liste wie `invoice-texts.ts`
  - Falsche Typen ergeben „ungültig“ statt eines Abbruchs.
- **Funktionen** (Hülle in `public`, Logik in `private`; jede prüft „Inhaber oder Admin mit 2FA“ (sonst 42501) und sperrt die Kundenzeile über `private.lock_tenant` (P0011/P0016)):
  - `save_invoice_numbering`: Konflikt P0910; das Jahr der Startnummer wird bei geänderter Startnummer gesetzt (Wiener Zeit); ohne Änderung kein Eintrag
  - `save_invoice_fixed_texts`: leere Fußzeile wird null
  - `save_invoice_backfill`
  - `save_invoice_text_block`:
    - Neu: Höchstzahl 20 je Block (P0912)
    - Ändern: Stand des Bausteins (P0910), gelöscht (P0911), Block bleibt fest
    - Name vergeben → P0913, auch bei gleichzeitigem Anlegen
    - Bei anderen Blöcken werden Zahlungsfelder ignoriert
  - `set_invoice_text_block_default`: P0910, wenn der Standard des Blocks nicht mehr der erwartete ist; P0911 bei fremdem oder falschem Baustein
  - `delete_invoice_text_block`: P0911, wenn er nicht (mehr) existiert
  - Ungültiger Inhalt → P0914
- **Betreiber-Protokoll:** Spalten `target_block`, `target_label`. Aktionen `invoice_settings` (`numbering`, `small_business_note`, `footer`, `backfill`) und `text_block_created/updated/deleted` (`name`, `body`, `payment_rules`, `is_default`). Eingetragen werden Änderungen von Inhaber und Admin, nie der Text.
- **Vorbelegung:** `private.seed_invoice_settings` für alle bestehenden Kunden (Schalterwert aus `tenants` übernommen) und per Trigger `seed_invoice_settings` bei jedem neuen Kunden, egal über welchen Weg er entsteht.
- **Umzug des Schalters:** `save_invoice` liest `invoice_settings.backfill_enabled` (P0905 wie bisher). `update_tenant_master_data` ohne den Schalter; ein mitgeschickter alter Schlüssel wird ignoriert. `tenants.invoice_backfill_enabled` ist entfernt.

**Server:** Die Aktionen aus dem Frontend sind unverändert. Einzige Ausnahme: Bei `set_invoice_text_block_default` werden die null-Werte für die erzeugten Typen umgewandelt.

**Korrektur am Frontend:** Die Reiterleiste der Einstellungen war mit vier Reitern am Handy (375 px) 56 px zu breit, die Seite scrollte seitlich (PROJ-38-Handytest rot). Jetzt lässt sich die Leiste in sich wischen, die Linie liegt an der Liste, und der aktive Reiter wird ins Bild geholt.

**Tests**
- Integration `supabase/tests/invoice-settings.integration.test.ts` (13 Tests, grün):
  - Vorbelegung als eigene Kopie
  - Lesen je Rolle; kein direktes Schreiben
  - 42501 für Mitarbeiter, fremden Inhaber und Admin ohne 2FA
  - Nummernkreis (Speichern, Jahr der Startnummer, Konflikt, 10 ungültige Eingaben, Protokoll)
  - Feste Texte (Pflicht, Grenzen, Platzhalter, HTML/Attribute/Links/Bilder am Formular vorbei abgelehnt, leere Fußzeile, Konflikt, Protokoll ohne Text)
  - Schalter samt P0905 beim Nacherfassen
  - Bausteine (Name je Block eindeutig, Grenzen, Platzhalter, Konflikt, Block fest, gelöscht)
  - Zahlungsregeln (12 ungültige Eingaben, Tabellenregel 23514)
  - Standard (Wechsel, Konflikt, Aufheben, falscher Block, Löschen des Standards, Teil-Index 23505)
  - Höchstzahl 20; Admin bei deaktiviertem Kunden P0016, Inhaber 42501; Kunde löschen
- `invoices.integration.test.ts` auf `invoice_settings` umgestellt, dazu neu: „Stammdaten-Funktion ignoriert den alten Schlüssel“
- `npm test`: 55 Dateien, 636 Tests grün. Lint, Typprüfung und Produktions-Build laufen durch.
- E2E gegen den gebauten Server (desktop):
  - PROJ-39: 3 Tests grün, auch Abschnitte und Schalter
  - PROJ-37: Schalter-Tests grün (6)
  - PROJ-28: grün (19)
  - PROJ-38: grün (nach der Reiter-Korrektur)
  - PROJ-4: Mitarbeiter und 44-px-Layout grün

### Korrekturen nach QA (Backend, 2026-10-31)
Migration `20261031135815_invoice_settings_qa_fixes.sql`, in Dev eingespielt; Typen neu erzeugt; Advisors ohne Meldung.
- **BUG-3 (Vorschau liest höchstens 1.000 Nummern):** neue Funktion `public.invoice_numbers(p_tenant_id) → text[]`.
  - Gibt alle Rechnungsnummern als einen Array-Wert zurück. Die PostgREST-Grenze `max_rows` (1.000) gilt nur für Zeilen und greift deshalb nicht.
  - `security invoker`: RLS von `invoices` entscheidet, also nur Inhaber des Kunden und Admin mit 2FA. Für anon nicht aufrufbar.
  - `loadInvoiceSettings` ruft sie statt `select('number').limit(20000)` auf, `NUMBERS_LIMIT` entfällt. Dieselbe Funktion kann PROJ-41 für den Nummernvorschlag nutzen.
- **BUG-6 („Als Standard setzen“ ändert den Stand des Bausteins):** neue Spalte `invoice_text_blocks.content_updated_at`, nach dem Muster von `numbering_updated_at`/`texts_updated_at`.
  - `save_invoice_text_block` setzt sie bei jeder Inhaltsänderung (Name, Text, Zahlungsregeln) und prüft den Konflikt gegen sie.
  - Das Umschalten des Standards ändert nur `updated_at` (Trigger `set_audit_fields`), nicht den Inhaltsstand.
  - Das Frontend liest `content_updated_at` als `updatedAt` des Bausteins (`TEXT_BLOCK_COLUMNS`), der Parameter `p_input.updated_at` bleibt gleich.
  - Bestehende Zeilen starten mit `now()`, ohne Update. Ein Update hätte Trigger und Protokoll für jede Zeile ausgelöst.
- **Dabei gefunden, Frontend (Rest von BUG-2):** Zwei weitere Ursachen für Schreibflächen ohne Namen oder mit veralteten ARIA-Angaben.
  - `useEditor` übernimmt nach jedem Rendern die `editorProps` neu. Nachträglich per `setProps` gesetzte Attribute (`aria-invalid`, `aria-describedby`, `aria-readonly`) gingen dadurch beim nächsten Rendern verloren. Jetzt stehen alle Attribute direkt in `editorProps.attributes` und werden je Rendern berechnet; ein Effekt schaltet nur noch `editable`.
  - Im Produktions-Build weicht `useId` zwischen Server und Browser zeitweise ab. Im Trace gesehen: Die Schreibfläche verwies auf eine Browser-ID, die Bezeichnung trug die Server-ID. Das betraf die Betreiber-Seite, der Test „deaktivierter Kunde“ war in 2 von 10 Läufen rot. Tiptap setzt die Attribute außerhalb von React, deshalb passt die Verknüpfung dann nicht mehr. `RichTextField` bildet die IDs jetzt fest aus dem Feldnamen (`rich-text-<name>`), danach 10 von 10 grün. Beschriftete Felder (`htmlFor`/`id`) sind nicht betroffen, weil beide Seiten den Server-Wert behalten.
  - **Offen:** Die Ursache der `useId`-Abweichung selbst ist nicht gefunden. Im Dev-Modus beginnt sie schon in der Seitenleiste beim Benutzermenü und betrifft die ganze App. Sie fällt nur dort auf, wo IDs außerhalb von React gesetzt werden (wie bei Tiptap) oder erst im Browser entstehen (Radix-Inhalte beim Öffnen).
- **E2E:** Die Prüfung der festen Texte kontrolliert jetzt `aria-invalid` und die zugängliche Beschreibung (Fehlermeldung) nach weiteren Eingaben.
- **Tests:**
  - Integration `invoice-settings.integration.test.ts`: 15 von 15 grün, davon neu „BUG-6: Standard umschalten …“ und „BUG-3: invoice_numbers liefert alle Nummern (über 1.000) …“ (Rechte: Inhaber, Admin mit 2FA, fremder Inhaber und Admin ohne 2FA leer, anon 42501).
  - `npm test`: 641 grün, 1 rot. Rot ist „Person ohne Mitgliedschaft …“ in `rls.integration.test.ts`, allein grün. Das ist der bekannte Fall mit Testresten im Dev-`audit_log` (Zeitgrenze 8 s), kein Bezug zu PROJ-39.
  - Lint, Typprüfung und Build sauber.
  - E2E PROJ-39 gegen den Build: desktop 26/26 grün, Grenzfall mit 1.100 Rechnungen auch in Firefox grün.
  - Firefox: 24 grün, 1 übersprungen, 1 einzelner Ausreißer im Konflikt-Test des Nummernkreises. „Aktuelle Fassung laden“ zeigte den alten Wert, danach 8 von 8 grün. Passt zum bekannten sporadischen Verhalten von Next 16 bei `router.refresh()` nach Server-Aktionen; der Code dort ist unverändert.

**Für `/qa`:** Abläufe in der Oberfläche als E2E ergänzen: Nummernkreis-Vorschau mit nacherfassten Nummern, Baustein anlegen/Standard/Löschen, Einfügen aus Word bzw. Webseite, Konfliktanzeige, Betreiber-Abschnitt (aktiv/deaktiviert), Handy 375 px im Rechnungs-Reiter, Firefox/Safari.

### Editor-Erweiterung (Backend, 2026-11-04)
- Migration `20261104172140_rich_text_attrs.sql`: neue Prüfung `private.rich_attrs_ok`; `private.rich_doc_ok` nimmt `attrs` an. Keine neuen Spalten, keine Datenumstellung, keine RLS-Änderung, keine neuen Schreibfunktionen. Vorhandene Zeilen werden nicht neu geprüft.
- Migration `20261104172539_rich_text_attrs_grant.sql`: Ausführungsrecht für `authenticated` und `service_role`. Ohne dieses Recht schlugen direkte Schreibzugriffe auf die Tabellen fehl, auch bei Texten ohne Einstellungen (von den Integrationstests gefunden). Beide Migrationen gehören zusammen und müssen in dieser Reihenfolge und vor dem neuen Code in Staging und Produktion.
- Beide nur in Dev eingespielt. Typen unverändert. Advisors: nur die zwei bekannten Auth-Warnungen (`auth_otp_long_expiry`, `auth_leaked_password_protection`), nichts zu dieser Änderung.
- Tests, alle gegen Dev grün:
  - `invoice-settings.integration.test.ts` (17): gültige und ungültige Werte über die Speicherfunktion und direkt in der Tabelle, Abgleich mit `isRichDoc`, Schriftliste aus `RICH_FONTS`, reine Formatänderung für Stand, Konflikt und Protokoll, gleiche Einstellungen in anderer Schlüsselreihenfolge sind keine Änderung
  - `invoice-drafts.integration.test.ts` (22): Einstellungen im Entwurf gespeichert, ungültige abgelehnt
  - E2E Desktop: speichern und neu öffnen, Code-Ansicht danach, alter Baustein bleibt Standard; Entwurf übernimmt die Einstellungen als Kopie, Vorschau, Rückfrage bei reiner Größenänderung, Baustein bleibt unverändert
- Nicht gelaufen: der gesamte `npm test`-Lauf und alle E2E-Dateien; das gehört zu `/qa`.

## QA Test Results

**Tested:** 2026-10-31
**App URL:** http://localhost:3000 (gebauter Server; Safari gegen `npm run dev`), Supabase „apppa-dev“
**Tester:** QA Engineer (AI)

**Umgebung:** Der Zugriff auf `.env.local` war gesperrt, die `grep`-Prüfung lief deshalb nicht. Abgesichert ist die Umgebung über `assertTestableProject` in beiden Test-Helfern (bricht bei Staging/Produktion ab).

**Automatisierte Tests**
- `npm test`: 634 grün, 2 übersprungen. Ein Hook-Timeout in `guests.integration.test.ts` („Dubletten“) trat nur im Gesamtlauf auf, allein läuft die Datei grün (15/15). Ursache ist Last, kein Fehler von PROJ-39.
- `npm run lint` und `tsc --noEmit` sind sauber.
- Unit-Tests: Die Regeln (`invoice-numbering`, `invoice-texts`, `rich-text`, `validation/invoice-settings`) waren aus /frontend vollständig abgedeckt, keine Ergänzung nötig.
- E2E `tests/PROJ-39-einstellungen-rechnungen.spec.ts`: 24 Tests (3 aus /frontend, 21 neu)
  - desktop: 23 grün, 1 rot (BUG-1)
  - Firefox: Editor, Bausteine, feste Texte und Schalter grün bis auf BUG-1 und BUG-2. Künstliches Einfügen ist in Firefox nicht möglich (Testgrenze), der Test wird dort übersprungen.
  - Safari: Editor (inkl. Einfügen), feste Texte und Schalter grün bis auf BUG-1
- Regression (desktop): PROJ-37 (30, 1 übersprungen), PROJ-38 (14), PROJ-28 (19) und PROJ-4 (Mitarbeiter, 44-px-Layout mit axe, alle Projekte) grün

### Acceptance Criteria Status

#### Reiter und Zugang
- [x] Reiter Stammdaten, Team, Wohnungen, Rechnungen; Adresse, Markierung, Tab-Titel, vier Abschnitte (E2E)
- [x] Mitarbeiter → „Seite nicht gefunden“ (E2E, 404)
- [x] Mitarbeiter am Formular vorbei abgelehnt (Integration: RLS ohne Zeilen, 42501; Server-Aktion `guard`)
- [x] Inhaber A kann Kunde B weder lesen noch ändern (Integration)

#### Schalter „Rechnungen nacherfassen“
- [x] Kein Schalter mehr in Stammdaten; im Abschnitt „Nacherfassen“ mit gespeichertem Zustand (E2E)
- [x] Ausgeschaltet → Rechnungsliste ohne „Rechnung nacherfassen“ (E2E PROJ-39 und PROJ-37)
- [x] Hinweis aus PROJ-37 verweist auf *Einstellungen → Rechnungen* (E2E PROJ-37)

#### Nummernkreis
- [x] Voreinstellung: kein Präfix, mit Jahr, „-“, 4 Stellen, jährlich neu, Start 1 (E2E)
- [x] Vorschau sofort vor dem Speichern („R-2026/0001“) (E2E)
- [x] Leeres Präfix speicherbar; Nummer beginnt mit der Jahreszahl (E2E)
- [x] Präfix „R #“ bzw. 11 Zeichen → Meldung, nichts gespeichert (E2E)
- [x] Ohne Jahreszahl: „jährlich neu“ gesperrt mit Hinweis (E2E)
- [x] Startnummer 0, -3, 1,5 → Meldung (E2E)
- [x] 2026-0041/0042 → 2026-0043, unabhängig von der Startnummer, mit Hinweis (E2E)
- [x] Nur „ALT-17“ und Vorjahr 2025-0118 → 2026-0001 (E2E)
- [x] Ohne Jahr, „R-“, 5 Stellen, R-00123 → R-00124 (E2E)
- [x] 3 Stellen, 2026-999 → 2026-1000 (E2E)
- [x] Ohne ausgestellte Rechnung ohne Rückfrage gespeichert (E2E). Die Warnung nach dem Ausstellen ist eingebaut, aber erst mit PROJ-41 prüfbar (es gibt noch keine Herkunft „ausgestellt“).
- [x] Bestehende Nummern unverändert (Code: keine Funktion schreibt `invoices.number`)

#### Textbausteine
- [x] Vorbelegung 1/2/1 mit Kennzeichen „Standard“ (E2E, Integration)
- [x] Anlegen erscheint in der Liste; Pflichtfelder; Name > 60 und Text > 2.000 mit Grenze (E2E)
- [x] „nächster besuch“ im selben Block abgelehnt, in anderem Block erlaubt (E2E)
- [x] 20 Bausteine → „Baustein hinzufügen“ gesperrt mit Hinweis (E2E)
- [x] Standard wechseln (nur einer), aufheben (Hinweis), Standard löschen (Bestätigung, danach ohne Standard) (E2E)
- [x] Anderer Kunde behält seine Bausteine (E2E)
- [x] Reihenfolge: Standard oben, dann nach Name (E2E)

#### Zahlungsregeln (Block 6)
- [x] Anzahlung ja/nein, Fälligkeit mit beiden Bezügen; Prozent und Frist bei „ja“ Pflicht (E2E)
- [x] Prozent 0, 100,5, 12,345 und Frist 366, -1, 2,5 → Meldung (E2E)
- [x] Anzahlungs-Platzhalter ohne Anzahlung → Hinweis, kein Speichern (E2E)
- [x] „Anzahlung: nein“ nach dem Ausfüllen → Prozent und Frist null in der Datenbank (E2E)

#### Editor, Platzhalter und Vorschau
- [x] Fett, Kursiv, Aufzählung, Nummerierte Liste, sonst keine Werkzeuge (E2E)
- [x] Einfügen von HTML mit Überschrift, Link, Farben, Schrift, Bild, Tabelle und Skript: nur fett/kursiv/Absätze/Liste bleiben, gespeichert ohne Fremdes, Skript läuft nicht (E2E Chrome, Safari). Siehe BUG-4 (Tabellenzellen).
- [x] Platzhalter-Auswahl Block 4/7 (9), Block 6 (+ Fälligkeitsdatum, mit Anzahlung + 3) (E2E). Siehe BUG-1 (Fokus).
- [x] Getipptes „{Wohnung}“ erkannt und in der Vorschau ersetzt (E2E)
- [x] „{Gastname}“ unbekannt, „{Fälligkeitsdatum}“ in Block 4 nicht erlaubt, nichts gespeichert (E2E)
- [x] Vorschau „Sehr geehrte Frau Mag. Muster … 14.10.2026“ ohne Wochentag (E2E)
- [x] 20 % / 3 Tage / 1 Tag vor Anreise → € 90,00 bis 04.10.2026, € 360,00 bis 13.10.2026 (E2E)
- [x] HTML, Attribute, Links, Bilder am Editor vorbei abgelehnt (Integration P0914)

#### Feste Texte
- [x] Vorbelegung Gesetzestext, Fußzeile leer (E2E)
- [x] Leerer Hinweis → „darf nicht leer sein“; über 500 Zeichen → Grenze (E2E). Fußzeile über 2.000: Integration.
- [x] Umformulierter Hinweis und Fußzeile (IBAN) nach Neuladen da (E2E)
- [x] Kein „Platzhalter einfügen“; getippter „{Gast}“ unbekannt (E2E)
- [x] Erklärsatz zur Bedingung immer sichtbar (E2E)

#### Betreiber
- [x] Abschnitt „Rechnungen“ bei aktivem Kunden bedienbar; Inhaber sieht den geänderten Nummernkreis (E2E)
- [x] Deaktivierter Kunde: alles sichtbar, keine Speichern-/Menüknöpfe, Editoren nicht bearbeitbar, Baustein nur ansehen (E2E)
- [x] Deaktivierter Kunde am Formular vorbei → P0016 (Integration)

#### Schutz und Protokoll
- [x] Konflikt Nummernkreis: Hinweis „inzwischen geändert“, nichts überschrieben, „Aktuelle Fassung laden“ zeigt den neuen Stand (E2E)
- [x] Konflikt beim Standard (zwischenzeitlich aufgehoben) → Hinweis, nichts gesetzt (E2E)
- [x] Gelöschter Baustein beim Speichern → „existiert nicht mehr“ (E2E)
- [x] Protokoll „Rechnungseinstellungen geändert: Nummernkreis“, „Textbaustein angelegt: Abschlusstext – …“ mit Person; Text (Kontonummer) nicht im Protokoll (E2E)

#### Allgemein
- [x] Verbindungsabbruch: Meldung „Keine Verbindung …“, Eingabe bleibt, nichts gespeichert (E2E)
- [ ] Teilweise: 375 px ohne seitliches Scrollen (Seite und Panel), Bedienelemente ≥ 44 px (E2E). Ausnahme ist der Schließen-Knopf des gemeinsamen Seitenpanels mit 40 × 40 px (BUG-5, schon vorher vorhanden).
- [x] Bestehende Kunden mit Vorbelegung, Schalterwert übernommen (Integration)

### Edge Cases Status
- [x] Startnummer kleiner als höchste passende Nummer: höhere gewinnt, Hinweis (E2E)
- [x] Andere Stellenzahl zählt mit (2026-999 bei 3 Stellen, Unit)
- [x] Nur passende Formate zählen (ALT-17, Vorjahr) (E2E)
- [x] Anzahlung 100 % → Rest € 0,00 (Unit)
- [x] Gleichzeitiger Standard → Konflikt (E2E), gleichzeitiger gleicher Name → P0913 (Integration)
- [x] Nur Leerzeichen/Formatierung gilt als leer (Unit, E2E Pflichtfeld)
- [x] Lange IBAN in der Fußzeile am Handy: kein seitliches Scrollen
- [ ] Viele Rechnungen: siehe BUG-3

### Security Audit Results
- [x] Ohne Anmeldung kein Zugriff; Mitarbeiter: Seite 404, Tabellen ohne Zeilen, Funktionen 42501
- [x] Fremder Inhaber und Admin ohne 2FA: 42501 (Integration)
- [x] Kein direktes Schreiben in `invoice_settings`/`invoice_text_blocks` (nur `select` erteilt, RLS ohne Schreib-Policies)
- [x] Alle Funktionen `security definer` mit `search_path = ''`; Hüllen `security invoker`; Hilfsfunktionen für anon gesperrt
- [x] XSS: Gespeichert wird nur die strenge JSON-Struktur (Datenbank-CHECK, auch mit Service-Key); Ausgabe ohne `dangerouslySetInnerHTML`; eingefügtes `<script>`/`onerror` läuft nicht (E2E)
- [x] Deaktivierter Kunde serverseitig gesperrt (P0016)
- [x] Protokoll ohne Textinhalt (keine Bankdaten im Betreiber-Protokoll)
- [x] Grenzen (20 je Block, 2.000/500 Zeichen) in der Datenbank. Hinweis: Leere Absätze zählen nicht zur Zeichengrenze, ihre Anzahl ist nicht begrenzt. Das Server-Aktions-Limit von 1 MB begrenzt sie praktisch; direkt per RPC wäre ein großes Dokument speicherbar (nur für Inhaber/Betreiber des eigenen Kunden, kein Fremdzugriff). Kein eigener Bug, für PROJ-41 (PDF) im Blick behalten.

### Bugs Found

#### BUG-1: Fokus verlässt den Editor nach „Platzhalter einfügen“
- **Status:** behoben, in QA Runde 2 bestätigt
- **Severity:** Medium
- **Steps to Reproduce:**
  1. *Einstellungen → Rechnungen*, Baustein hinzufügen, „Hallo “ tippen
  2. „Platzhalter einfügen“ → „{Gast}“ wählen
  3. Weitertippen
  4. Expected: Text wird hinter „{Gast}“ eingefügt
  5. Actual: Nach dem Schließen des Menüs springt der Fokus auf den Knopf „Platzhalter einfügen“ zurück. Tastenanschläge gehen verloren, die Leertaste öffnet das Menü erneut. Tritt in Chrome, Firefox und Safari auf. Vermutliche Ursache: Radix `DropdownMenu` setzt den Fokus beim Schließen auf den Auslöser (`onCloseAutoFocus`) und überschreibt `editor.chain().focus()`.
- **Test:** `BUG-1: Nach „Platzhalter einfügen“ bleibt der Fokus in der Schreibfläche` (rot)
- **Priority:** Fix before deployment (Kernablauf beim Schreiben von Bausteinen)

#### BUG-2: Einstellungsbaum wird nach dem Laden manchmal neu aufgebaut; Editoren verlieren dann ihren Namen
- **Status:** behoben, in QA Runde 2 bestätigt
- **Severity:** Medium
- **Steps to Reproduce:**
  1. *Einstellungen → Rechnungen* bei 375 px öffnen (oft), in Firefox neu laden (oft), Desktop Chrome (selten)
  2. Expected: Seite wird einmal aufgebaut, Schreibflächen heißen „Kleinunternehmer-Hinweis“, „Fußzeile“ bzw. „Text“
  3. Actual:
     - ~100 ms lang stehen alle Formulare doppelt im DOM (Server-IDs `_R_…` und Client-IDs `_r_…`). Eingaben in dieser Zeit gehen verloren.
     - Danach zeigt `aria-labelledby` der Editoren mitunter auf eine nicht mehr vorhandene ID. Die Schreibflächen haben dann keinen zugänglichen Namen (Screenreader: „Textfeld“).
     - Die gespeicherten Daten sind richtig.
  4. Vermutliche Ursache: Der Unterbaum wird im Browser neu gerendert (neue `useId`-Werte), während der Tiptap-Editor seine ersten `editorProps.attributes` behält. `labelId` steht nicht in den Abhängigkeiten von `setProps`. Auf Stammdaten tritt der Neuaufbau nicht auf.
- **Test:** `openSettings` wartet auf ein einzelnes Formular. Der axe-Test und „Fußzeile bleibt nach Neuladen“ (Firefox) schlagen zeitweise fehl.
- **Priority:** Fix before deployment (Barrierefreiheit, verlorene Eingaben)

#### BUG-3: Vorschau „nächste Nummer“ liest höchstens 1.000 Rechnungsnummern
- **Status:** behoben, in QA Runde 2 bestätigt
- **Severity:** Low
- **Steps to Reproduce:**
  1. Kunde mit mehr als 1.000 Rechnungen, die höchste passende Nummer hat ein älteres Rechnungsdatum als die 1.000 neuesten
  2. Expected: höchste passende Nummer + 1
  3. Actual: PostgREST liefert höchstens `max_rows = 1000` Zeilen (`NUMBERS_LIMIT = 20_000` greift nicht). Geliefert werden die neuesten nach Rechnungsdatum (Index `invoices_list_idx`), die übrigen fehlen in der Rechnung, und die Vorschau schlägt eine zu kleine Nummer vor. Nachgeprüft: 1.100 Rechnungen → 1.000 Zeilen zurück.
- **Priority:** Fix spätestens mit PROJ-41 (dieselbe Regel liefert dort den Nummernvorschlag), z. B. nur passende Nummern serverseitig ermitteln oder seitenweise laden

#### BUG-4: Eingefügte Tabellen kleben die Zellen ohne Trennung zusammen
- **Status:** behoben, in QA Runde 2 bestätigt
- **Severity:** Low
- **Steps to Reproduce:** Tabelle mit „Zelle A | Zelle B“ aus Word/Webseite einfügen → Absatz „Zelle AZelle B“
- **Expected:** Zellen als eigene Absätze oder durch Leerzeichen getrennt (Tech Design: „Tabellen zu Absätzen“)
- **Priority:** Nice to have

#### BUG-5: Schließen-Knopf des Seitenpanels nur 40 × 40 px (schon vorher vorhanden)
- **Status:** behoben, in QA Runde 2 bestätigt
- **Severity:** Low
- **Steps to Reproduce:** Bei 375 px einen Baustein öffnen und den Knopf „Schließen“ (X oben rechts) messen: 40 × 40 px statt mindestens 44 px. Gemeinsames `DetailPanel` (`p-3` + 16-px-Symbol), betrifft alle Panels der App.
- **Priority:** Nice to have (eigene Korrektur am gemeinsamen Baustein)

#### BUG-6: „Als Standard setzen“ ändert den Stand des Bausteins (aus Code-Prüfung)
- **Status:** behoben, in QA Runde 2 bestätigt
- **Severity:** Low
- **Steps to Reproduce:** Nutzer A bearbeitet Baustein X im Panel; Nutzer B setzt X als Standard; A speichert → „Der Baustein wurde inzwischen geändert“, obwohl nur der Standard wechselte (der Trigger `set_audit_fields` setzt `updated_at` auch beim Umschalten von `is_default`).
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 65/66 bestanden, 1 teilweise (375 px: Schließen-Knopf, BUG-5); die Liste oben fasst verwandte Kriterien zusammen
- **Bugs Found:** 6 insgesamt (0 Critical, 0 High, 2 Medium, 4 Low)
- **Security:** Bestanden, keine Schwachstelle gefunden
- **Production Ready:** YES (keine Critical/High)
- **Recommendation:** BUG-1 und BUG-2 vor dem Deploy beheben (`/frontend`), BUG-3 spätestens mit PROJ-41
- **Entscheidung Nutzer (2026-10-31):** alle 6 Bugs vor dem Deploy beheben (BUG-1, 2, 4, 5 per `/frontend`; BUG-3, 6 per `/backend`), danach `/qa` Runde 2

### QA Runde 2 (2026-10-31)
**Gegenstand:** Korrekturen aus `/frontend` (7e36364) und `/backend` (e842524) für BUG-1 bis BUG-6, dazu die im Backend-Schritt gefundenen Editor-Korrekturen (ARIA-Angaben je Rendern, feste IDs).

**Umgebung:** Gebauter Server (`npm run build` + `npm run start`), Safari gegen `npm run dev`, Supabase „apppa-dev“. Der Zugriff auf `.env.local` war gesperrt. Abgesichert über `assertTestableProject` in beiden Test-Helfern; die Supabase-Verbindung zeigt nachweislich auf Dev (`nizgfmvjplhegoosanmu`). Vorher Testreste im Dev-`audit_log` bereinigt (67.077 Waisenzeilen, `VACUUM FULL`).

**Automatisierte Tests**
- Unit: 467 grün. Integration: 175/175 grün, nacheinander (`--no-file-parallelism`). Im parallelen Gesamtlauf fielen je Lauf 7 bis 8 wechselnde Tests mit Zeitüberschreitung bzw. `57014 statement timeout` aus. Ursache ist die Dev-Datenbank: Selbst einfache Inserts brauchten zeitweise 5 bis 9 s, nach einem Tag mit sehr vielen Testläufen. Ein Bezug zu PROJ-39 besteht nicht, nacheinander ist alles grün.
- Lint und Typprüfung sauber; Produktions-Build läuft durch (ein erster Versuch scheiterte an einem kurzzeitig fehlgeschlagenen Download von Google Fonts).
- E2E `tests/PROJ-39-einstellungen-rechnungen.spec.ts`: 30 Tests, davon 4 neu in Runde 2:
  - `BUG-2: 375 px – Seite wird einmal aufgebaut, Schreibflächen behalten ihren Namen` (3 Ladevorgänge, Formular zählt nie doppelt, alle Schreibflächen verweisen auf eine vorhandene Bezeichnung)
  - `BUG-2: Betreiber-Seite – Schreibflächen behalten nach jedem Laden ihren Namen` (4 Ladevorgänge)
  - `BUG-6: Standard wechselt, während das Panel offen ist – Speichern ohne Konflikt`
  - `BUG-7: Sofort nach „Platzhalter einfügen“ weitertippen …` (rot in Chrome, siehe unten)
  - Die AC-Prüfung der Platzhalter-Auswahl wartet jetzt, bis das Menü zu ist und der Fokus in der Schreibfläche steht (sofortiges Tippen prüft der BUG-7-Test).
- Ergebnisse:
  - **desktop (Chrome):** 29 grün, 1 rot (BUG-7). Im ersten Lauf war die Platzhalter-Prüfung einmal rot; Ursache war BUG-7, der Test ist entsprechend getrennt (danach 3/3 grün).
  - **Firefox:** 29 grün, 1 übersprungen (künstliches Einfügen, Testgrenze). BUG-7 tritt in Firefox nicht auf.
  - **Safari (gegen `npm run dev`):** 28 grün, 2 einzeln rot: Nummernkreis-Vorschau nach `reload` und Meldung „Baustein angelegt.“. Beide bei Wiederholung grün (2/2). Ursache ist der langsame Dev-Modus: `ready` wartet nur auf den App-Rahmen, nicht auf die Hydration des Seiteninhalts. Kein Produktfehler; Chrome und Firefox gegen den Build sind an denselben Stellen grün. BUG-7 ist in Safari grün.
- Regression gegen den Build (geänderte gemeinsame Bausteine: Seitenleiste/Layout, Seitenpanel, „Mehr“-Blatt):
  - PROJ-2 App-Shell desktop/tablet/mobile: 50 grün
  - PROJ-4 desktop/tablet/mobile (inkl. 44-px-Layout mit axe): 33 grün
  - PROJ-37 und PROJ-38: 40 grün, 1 übersprungen, 1 einzeln rot. Rot war PROJ-38 „kleines Logo“: Der Hinweis fehlte direkt nach dem Hochladen. Danach 4/4 grün; die Stelle läuft nur im Browser und ist von den Änderungen nicht berührt.
  - PROJ-29, PROJ-34, PROJ-3: 65 grün, 1 übersprungen

**Nachtest der Bugs**
- BUG-1: behoben. Fokus kehrt nach der Auswahl in die Schreibfläche zurück (Chrome, Firefox, Safari). Rest siehe BUG-7.
- BUG-2: behoben. Bei 375 px nie zwei Formulare, Schreibflächen auf Inhaber- und Betreiber-Seite immer mit Namen. Fehlerzustand (`aria-invalid`, Fehlermeldung als Beschreibung) bleibt auch nach weiteren Eingaben erhalten.
- BUG-3: behoben. Grenzfall mit 1.100 Rechnungen zeigt `…-1101` (Chrome, Firefox). Integrationstest: `invoice_numbers` liefert alle Nummern.
- BUG-4: behoben. „Zelle A“ und „Zelle B“ als eigene Absätze (Chrome, Safari; Firefox Testgrenze).
- BUG-5: behoben. Die 44-px-Prüfung bei 375 px nimmt den Schließen-Knopf nicht mehr aus und ist grün; PROJ-4-Layouttest grün.
- BUG-6: behoben. Standard wechselt bei offenem Panel, Speichern gelingt ohne Konfliktmeldung, der Baustein bleibt Standard; echte Inhaltsänderungen dazwischen bleiben ein Konflikt (Integrationstest).

**Sicherheit (Änderungen der Runde)**
- `invoice_numbers(p_tenant_id)`: `security invoker`, RLS von `invoices` gilt. Fremder Inhaber und Admin ohne 2FA bekommen ein leeres Ergebnis, anon `42501` (Integrationstest). Eine fremde `p_tenant_id` liefert nichts, eine Ausweitung gegenüber dem direkten Lesen der Tabelle gibt es nicht.
- `content_updated_at`: nur ein Zeitstempel, lesbar wie die übrigen Spalten; Schreiben weiterhin nur über die geprüften Funktionen.
- Feste IDs `rich-text-<feldname>`: keine Nutzereingaben in IDs (Feldnamen aus dem Code).
- Ergebnis: keine neue Schwachstelle.

#### BUG-7: Sofort nach „Platzhalter einfügen“ getippte Zeichen gehen ins Menü
- **Severity:** Low
- **Steps to Reproduce:**
  1. Baustein öffnen, „Hallo“ tippen
  2. „Platzhalter einfügen“ → „{Gast}“ wählen und ohne Pause „ und“ weitertippen
  3. Expected: `Hallo{Gast} und`
  4. Actual (Chrome, 3 von 3 Läufen): z. B. `Hallo{Gast}{Gast}und` oder `{Gast}nd`. Während das Menü ausblendet (etwa 100 bis 200 ms), hat noch der Menüeintrag den Fokus. Die Leertaste wählt ihn ein zweites Mal (doppelter Platzhalter, Leerzeichen fehlt), andere Zeichen gehen als Schnellsuche im Menü verloren. Firefox und Safari: nicht aufgetreten.
- **Test:** `BUG-7: Sofort nach „Platzhalter einfügen“ weitertippen – nichts geht verloren, kein doppelter Platzhalter` (rot in Chrome)
- **Hinweis für die Korrektur:** Fokus schon beim Auswählen in die Schreibfläche setzen, nicht erst nach dem Ausblenden, z. B. über ein gesteuertes Menü (`open`), das in `onSelect` sofort schließt.
- **Priority:** Nice to have. Der doppelte Platzhalter ist in der Vorschau sichtbar und schnell gelöscht; betroffen sind nur sehr schnelle Eingaben.
- **Stand:** behoben per `/frontend` (2026-10-31), Test in Chrome, Firefox und Safari grün; siehe Implementation Notes (Frontend) → Korrektur BUG-7

### Summary (Runde 2)
- **Bugs aus Runde 1:** alle 6 behoben und bestätigt
- **Neu:** 1 Bug (BUG-7, Low)
- **Acceptance Criteria:** alle bestanden, auch die bisher teilweise erfüllte 44-px-Prüfung bei 375 px
- **Security:** bestanden, keine Schwachstelle
- **Production Ready:** YES (keine Critical/High)
- **Recommendation:** Deploy möglich; BUG-7 vorher per `/frontend` beheben oder als bekannter Low-Bug mitnehmen

### QA Editor-Erweiterung (2026-11-04)

**Getestet:** 2026-11-04, http://localhost:3000, QA Engineer (AI). Gebauter Server; Safari gegen `npm run dev`; Supabase „apppa-dev“ (`.env.local` geprüft, keine Staging- oder Produktions-Kennung).

**Automatisierte Tests**
- Vitest komplett, nacheinander: 62 Dateien, 827 Tests grün, 1 erwarteter Fehlschlag (BUG-1), kein `57014`. Dieser Lauf war vor den Tests zu BUG-5 und BUG-6; danach nur noch Unit-Lauf: 609 grün, 5 erwartete Fehlschläge (BUG-1, BUG-5 dreimal, BUG-6). Lint und Typprüfung sauber, Build läuft durch.
- E2E Chrome Desktop: `PROJ-39` und `PROJ-40` vollständig grün. `PROJ-40` lief in zwei Paketen, weil die Hilfsfunktion `openCreate` im ersten Lauf bei Seiten ohne Formular wartete (Testfehler, korrigiert).
- E2E Handy (375 px) und Tablet (768 px): Editor mit Touch-Bedienung, 24 pt und langem Wort, keine seitliche Verschiebung; Bildschirmfotos angesehen.
- E2E Firefox: Editor-Erweiterung grün (2 übersprungen: künstliches Einfügen, Handy-Test).
- E2E Safari gegen `npm run dev`: Editor-Erweiterung und Entwurf grün. Einmal öffnete sich beim ersten Kompilieren das Panel nicht; in 2 weiteren Läufen nicht wiederholt, als Eigenheit des Entwicklungsservers eingestuft.
- Neu: Angriffs-Liste und 500 Zufallsdokumente für die HTML-Übersetzung; QA-Block in beiden E2E-Dateien.

**Nicht geprüft**
- E2E der übrigen Features: Die Änderung betrifft nur Rechnungstexte; die übrigen Features wurden nur über Vitest abgedeckt.
- PROJ-40 komplett in Firefox und Safari (nur die Editor-Abläufe).
- Echtes iPhone und echter Safari von Hand.
- Größe der Schriftdateien und Ladezeit auf einem langsamen Handy.

#### Acceptance Criteria Status: Schriftart, Schriftgröße und Ausrichtung (13/13)
- [x] Auswahl in Baustein, Kleinunternehmer-Hinweis, Fußzeile und Entwurf
- [x] Schriftenliste vollständig
- [x] 10,5 gilt für den ganzen Text; leer = Standard
- [x] 5, 25 und 10,3: Hinweis, nichts gespeichert
- [x] Teilmarkierung: Wahl gilt trotzdem für den ganzen Text
- [x] Speichern und neu öffnen: Werkzeugleiste, Schreibfläche, Vorschau
- [x] Zentrierter Text: Absatz zentriert, Liste linksbündig in derselben Schrift und Größe
- [x] Alte Texte: Standard, linksbündig
- [x] Reine Formatänderung zählt für Konfliktschutz, Bausteinstand und Protokoll (ohne Textinhalt)
- [x] Entwurf übernimmt die Werte als Kopie; Baustein bleibt unverändert
- [x] Nur Größe geändert: Rückfrage bei anderem Baustein
- [x] Entwurfsvorschau zeigt die Einstellungen
- [x] Am Editor vorbei: unbekannte Schrift, Größe außerhalb von Grenzen oder Schritten, unbekannte Ausrichtung abgelehnt, auch direkt in der Tabelle (`23514`)

#### Acceptance Criteria Status: HTML-Code (12/12)
- [x] Code zeigt HTML samt Einstellungen; ohne Bearbeitung unverändert zurück
- [x] Änderungen an Liste, Größe und Ausrichtung kommen zurück
- [x] `<a>`, `<table>`, `<span style>`: Text bleibt, Tags entfernt und genannt
- [x] `<script>`, `onerror`: läuft nicht (kein Dialog im Browser), genannt, Inhalt wird nicht zu Text
- [x] `font-size: 40pt`, unbekannte Schrift: Standard, genannt
- [x] Speichern im Code-Modus ohne Unzulässiges speichert
- [x] Speichern mit Unzulässigem: nichts gespeichert, Schreibfläche mit bereinigtem Text und Hinweis
- [x] `{Gastname}` im Code: gleiche Meldung wie im Editor
- [x] Vorschau folgt beim Tippen im Code
- [x] `<`, `>`, `&` bleiben erhalten
- [x] Im Code-Modus nur Umschalter und Hinweis aktiv
- [x] Deaktivierter Kunde: keine Werkzeugleiste, kein Code, keine Formatauswahl

#### Edge Cases
- [x] Nur Tags ohne Text gilt als leer; leere Fußzeile wird `null`, Pflichttext abgelehnt
- [x] Mehrere `<div>`, Text außerhalb eines Absatzes
- [x] Zeichengrenze zählt Text ohne Tags
- [x] 24 pt am Handy ohne seitliches Scrollen
- [x] Bestehende Entwürfe und Bausteine unverändert
- [ ] BUG-2: Obergrenze des Code-Felds
- [ ] Schrift lädt nicht (Ersatzschrift): nicht getestet; `display: swap` ist gesetzt

#### Security Audit
- [x] XSS: 35 Angriffsmuster (Skripte, `onerror`, `javascript:`, SVG, MathML, `meta`, `base`, `template`, `frameset`) ergeben immer eine gültige Struktur ohne aktive Inhalte. Nichts wird als HTML ausgegeben, kein `dangerouslySetInnerHTML`.
- [x] CSS-Einschleusung: Schrift, Größe und Ausrichtung sind feste Werte; `}body{…}`, `url(…)`, `expression(…)`, `!important` werden abgelehnt
- [x] Am Formular vorbei: Speicherfunktion und Tabellenprüfung lehnen ab, auch mit Service-Schlüssel; App und Datenbank waren bei allen geprüften Werten einig
- [x] Rechte: keine neuen Schreibfunktionen, keine RLS-Änderung; bestehende Rechte-Tests grün
- [x] Fremdverbindungen: keine Anfrage an Google, Schriften kommen vom eigenen Server; vor der Auswahl ist nur die App-Schrift geladen (Chrome, Safari)
- [x] Barrierefreiheit (axe): Panel mit Fehler, Code-Feld und Hinweis ohne Verstöße. axe sieht BUG-3 nicht.

#### Bugs Found

**BUG-1: Listenpunkt nur aus Leerzeichen wird geleert**
- **Severity:** Low
- **Steps:** Listenpunkt mit einem Leerzeichen anlegen, Code öffnen, etwas ändern, zurückschalten
- **Expected:** Leerzeichen bleibt. **Actual:** Punkt ist leer.
- **Test:** `it.fails` in `rich-text-html.test.ts`

**BUG-2: Zu langer Code wird stillschweigend abgeschnitten**
- **Severity:** Medium
- **Steps:** Im Code-Feld mehr als 20.000 Zeichen einfügen, z. B. HTML aus Word
- **Expected:** Hinweis oder vollständiger Text. **Actual:** Der Rest fehlt ohne jeden Hinweis. Beim Zurückschalten entsteht ein gekürzter Text; das gekürzte HTML meldet nichts als entfernt.
- **Test:** `BUG-2` mit `test.fail` in `PROJ-39-einstellungen-rechnungen.spec.ts`

**BUG-3: Aktiver Knopf in der Werkzeugleiste ist nicht erkennbar**
- **Severity:** Medium
- **Steps:** Baustein öffnen, „Blocksatz“ oder „Fett“ wählen, Knopf ansehen
- **Expected:** Der aktive Zustand ist deutlich sichtbar. **Actual:** Aktiver Knopf `#eae7e7` auf Hintergrund `#eae9e9`, Kontrast praktisch 1:1 (WCAG 1.4.11 verlangt 3:1). Screenreader bekommen den Zustand über `aria-pressed`.
- **Hinweis:** Schon im Grundumfang vorhanden, wiegt aber schwerer, weil bei der Ausrichtung immer genau ein Knopf aktiv sein soll. Betrifft den gemeinsamen Baustein `Toggle`; andere Stellen vor der Änderung prüfen.

**BUG-4: Eingabe vor dem Aktivwerden des Entwurfs geht verloren**
- **Severity:** Medium
- **Steps:** Entwurf öffnen, Rechnungsdatum sofort nach dem Erscheinen ausfüllen
- **Expected:** Das Datum gilt. **Actual:** Das Feld zeigt das neue Datum, Vorschau und Formular nehmen das heutige. Speichern wurde in diesem Zustand nicht geprüft.
- **Messung:** Lokal 207 bis 296 ms (6 Ladevorgänge) zwischen Erscheinen und Aktivwerden, Editor 15 bis 40 ms danach. Für einen Menschen am Desktop kaum erreichbar; langsame Handys nicht gemessen.
- **Hinweis:** Schon vor der Erweiterung vorhanden (1 von 6 Läufen). Im selben Test mit der Erweiterung 4 von 5, kleine Stichprobe; das Zeitfenster vor der Erweiterung wurde nicht gemessen. Betrifft vermutlich alle Felder des Formulars. Die Tests überbrücken es in `openCreate`. Vor PROJ-42 klären.

**BUG-5: Text in `<button>`, `<select>`, `<textarea>` geht verloren**
- **Severity:** Low
- **Steps:** `<button>Text</button>` im Code, zurückschalten
- **Expected:** Text bleibt (Spec). **Actual:** Tag genannt, Text weg.
- **Test:** `it.fails` in `rich-text-html.test.ts`

**BUG-6: Fett um eine Liste geht ohne Hinweis verloren**
- **Severity:** Low
- **Steps:** `<strong><ul><li>x</li></ul></strong>` im Code, zurückschalten
- **Expected:** Liste fett oder Hinweis. **Actual:** Liste nicht fett, kein Hinweis.
- **Test:** `it.fails` in `rich-text-html.test.ts`

#### Beobachtungen ohne Fehler
- Auf schmalen Bildschirmen bricht die Gruppe der Ausrichtungsknöpfe über zwei Zeilen um.
- Das Öffnen der Schriftauswahl lädt in Chrome alle sechs Schriften, weil jeder Eintrag in seiner Schrift erscheint.
- Der Build lädt jetzt sechs weitere Schriften von Google; in QA Runde 2 scheiterte ein Build einmal an einem solchen Download. Beim Deploy darauf achten.

#### Summary
- **Acceptance Criteria:** 25/25 bestanden
- **Bugs:** 6 (0 Critical, 0 High, 3 Medium, 3 Low)
- **Security:** keine Befunde
- **Production Ready:** JA nach den Regeln (keine Critical oder High). Empfehlung: BUG-2 und BUG-3 vor dem Deploy beheben.

### Korrekturen und QA Runde 2 Editor-Erweiterung (2026-11-04)

Auf Wunsch des Nutzers alle Fehler behoben.

- **BUG-1:** Ein Listenpunkt nur aus Leerzeichen bleibt erhalten.
- **BUG-2:** `maxLength` entfernt. Code über 200.000 Zeichen wird mit Hinweis abgewiesen, der bisherige Stand bleibt; nichts wird gekürzt.
- **BUG-3:** Aktiver `Toggle` jetzt `accent-700` mit weißem Symbol (5,3:1 zum Hintergrund, 6,4:1 zum Symbol); nur der Editor verwendet `Toggle`.
- **BUG-4:** `useAdoptEarlyInput` übernimmt beim Aktivwerden, was schon in den Feldern steht. Korrektur der ersten Beschreibung: Ohne die Korrektur springt das Feld beim Aktivwerden sichtbar auf den alten Wert zurück. Neue Prüfung hält das JavaScript zurück, bis die Eingabe erfolgt ist: ohne Korrektur 3 von 3 rot, mit Korrektur 3 von 3 grün, inklusive Speichern. Erste Proben mit Zufallszeitpunkt waren dafür zu schwach (ohne Korrektur nur 1 von 3 rot).
- **BUG-5:** Text in `<button>`, `<select>`, `<textarea>` bleibt, das Tag wird genannt.
- **BUG-6:** Fett bzw. kursiv um eine Liste bleibt erhalten.
- **BUG-7 (neu, Medium, seit PROJ-40 in Produktion):** Die Texte „{Anrede} richtet sich nach dem Hauptgast…“ und „Anrede im Text ({Anrede})“ lösten bei jedem Anzeigen einen `FORMATTING_ERROR` aus, weil `{Anrede}` als Variable galt. Klammern in `messages/de.json` maskiert; Test `BUG-7`. Nur zufällig entdeckt, weil ein Lauf gegen den Entwicklungsserver ging. Was Nutzer in Produktion dort sahen, wurde nicht geprüft. Alle übrigen Texte mit Großbuchstaben in Klammern durchgesehen: keine weiteren.

**Ergebnisse**
- Vitest komplett, nacheinander: 62 Dateien, 832 Tests grün, keine erwarteten Fehlschläge mehr. Lint und Typprüfung sauber, Build läuft durch.
- E2E Chrome Desktop: `PROJ-39` und `PROJ-40` vollständig grün, Server-Log ohne `FORMATTING_ERROR`.
- E2E Handy und Tablet: Editor grün, aktiver Knopf auf dem Bildschirmfoto klar erkennbar.
- E2E Firefox: BUG-2, BUG-3 und QA-Block grün. BUG-4 und PROJ-40 nicht in Firefox gelaufen.
- E2E Safari gegen `npm run dev`: BUG-2, BUG-3, BUG-4, BUG-7 grün.

**Unklar geblieben**
- Safari: Zweimal öffnete sich das Panel im ersten Test nach dem Start des Entwicklungsservers nicht; danach 5 von 5 grün. Vermutlich ein Klick vor dem Aktivwerden auf dem noch kompilierenden Server, nicht belegt. Am gebauten Server nicht beobachtet.
- Ein Build schlug einmal ohne erkennbaren Zusammenhang fehl; das Log wurde überschrieben, die Ursache ist unbekannt. Vermutung: Schriften-Download von Google. Beim Deploy darauf achten.
- BUG-4 ist nur im Entwurf behoben; andere Formulare siehe Open Questions.

**Summary Runde 2**
- **Acceptance Criteria:** 25/25 bestanden
- **Bugs:** alle 7 behoben, keine neuen offen
- **Production Ready:** JA

## Deployment
- **Datum:** 2026-10-31, Version v1.17.0
- **Commit:** `0ea941f` (Branches `staging` und `production`); Staging vom Nutzer geprüft und für Production freigegeben
- **Staging:** https://staging.apppa.at
- **Production:** https://app.apppa.at
- **Migrationen:** `20261031110516_invoice_settings.sql`, `20261031135815_invoice_settings_qa_fixes.sql` (Staging und Produktion; Advisors nur bekannte Auth-Hinweise: Staging `auth_otp_long_expiry` + `auth_leaked_password_protection`, Produktion `auth_otp_long_expiry`)
- **Neue Pakete:** `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`, `@radix-ui/react-toggle`
- **Neue Umgebungsvariablen / `config push`:** keine
- **Mit ausgeliefert:** Buchhaltungs-Commit PROJ-38 (`4a54071`)
- **Tag:** `v1.17.0-PROJ-39` auf `0ea941f`
