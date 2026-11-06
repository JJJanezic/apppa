# PROJ-44: Rechnungsstorno (Gutschrift zu Rechnung)

## Status: Deployed
**Created:** 2026-11-06
**Last Updated:** 2026-11-06

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): nur Inhaber stellen aus, Mitarbeiter sehen, Mandantentrennung
- Requires: PROJ-37 (Rechnungen nacherfassen): Rechnungsliste, Rechnungen je Buchung, Spalte und Filter in der Buchungsübersicht
- Requires: PROJ-39 (Einstellungen → Rechnungen): Nummernkreis, Fußzeile, Kleinunternehmer-Hinweis
- Requires: PROJ-40 (Rechnungsdaten sammeln): Abzüge in Schlussrechnungen, Hinweis bei weggefallenem Abzug, Knopf „Rechnung“
- Requires: PROJ-41 (Briefpapier): Gestaltung, PDF-Erzeugung
- Requires: PROJ-42 (Ausstellen mit PDF): Nummernvorschlag, Prüfungen, Festschreiben, PDF ablegen in einem Schritt
- Wird genutzt von: PROJ-45 (Zahlungserfassung): stornierte Rechnungen sind nicht mehr zahlbar; PROJ-43 (Rechnungsübersicht): Status „storniert“

## Überblick
Eine in der App ausgestellte Rechnung lässt sich nicht ändern (PROJ-42). Bisher wurde eine falsche Rechnung über eine außerhalb erstellte, nacherfasste Gutschrift korrigiert. PROJ-44 bringt das in die App: Zu einer ausgestellten Rechnung erstellt der Inhaber eine **Gutschrift zu Rechnung [Nummer]**, die sie **vollständig** aufhebt. Danach kann er aus der Buchung wie gewohnt eine neue, richtige Rechnung erstellen.

### Einstieg
- Knopf **„Gutschrift erstellen“** auf der Detailseite einer **in der App ausgestellten** Rechnung (Art Rechnung, Teilrechnung oder Schlussrechnung), nur für Inhaber.
- Nicht vorhanden bei: Entwürfen, nacherfassten Rechnungen (PROJ-37), bereits stornierten Rechnungen, Gutschriften.
- Gesperrt mit Begründung bei einer **Teilrechnung, die in einer ausgestellten Schlussrechnung abgezogen ist**: „Zuerst die Schlussrechnung [Nummer] stornieren“ (mit Link).
- Bei nacherfassten Rechnungen erklärt ein kurzer Hinweis den bisherigen Weg: Gutschrift außerhalb erstellen und mit negativen Beträgen nacherfassen.

### Seite „Gutschrift ausstellen“
Eigene Seite, kein gespeicherter Entwurf. Ausstellen geschieht in einem Schritt wie bei Rechnungen (PROJ-42): prüfen, PDF erzeugen, ablegen, Nummer vergeben und festschreiben.

| Bereich | Inhalt | Änderbar |
|---|---|---|
| Verweis | „zu Rechnung [Nummer] vom [Datum]“ | nein |
| Empfänger | wie in der Rechnung (Stand beim Ausstellen der Rechnung) | nein |
| Zeitraum, Wohnung, Gastnamen | wie in der Rechnung | nein |
| Positionen | alle Positionen der Rechnung mit negativen Beträgen und gleichem USt-Satz; bei Schlussrechnungen samt Abzugszeilen, ebenfalls gespiegelt | nein |
| Kleinunternehmer | wie in der Rechnung (samt Hinweis) | nein |
| Gutschriftsdatum | vorbelegt mit heute | ja |
| Grund | Freitext, optional, bis 300 Zeichen, eine Zeile auf der Gutschrift | ja |
| Nummer | Vorschlag aus dem Nummernkreis der Rechnungen, überschreibbar | ja |
| Vorschau | PDF der Gutschrift mit Aufdruck „Entwurf“ | – |

Keine Textbausteine (Einleitung, Zahlungsmodalitäten, Schlusstext) und keine Zahlungsregeln.

### Nummer
- **Derselbe Nummernkreis wie Rechnungen** (PROJ-39). Vorschlag und Überschreiben wie in PROJ-42: Duplikat abgelehnt, Lücke nur Hinweis, Nummer über dem Vorschlag, anderes Format oder anderes Jahr mit Häkchen „Diese Nummer trotzdem verwenden“.
- Nach dem Ausstellen zählt die Nummer für den nächsten Vorschlag wie jede Rechnungsnummer.

### Datum
- **Sperre:** Gutschriftsdatum vor dem Rechnungsdatum oder in der Zukunft.
- **Hinweis:** Datum passt nicht zur Nummernfolge (wie PROJ-42).

### Dokument (PDF)
Gestaltung wie eine Rechnung (Briefpapier, Adressfeld, Aussteller-Block, Fußzeile aus dem aktuellen Stand), mit diesen Unterschieden:
- Überschrift **„Gutschrift“**, darunter „Gutschriftsnummer: [Nummer]“ und „zu Rechnung [Nummer] vom [Datum]“
- „Grund: …“ als eigene Zeile, wenn angegeben
- Positionen und Beträge **negativ** („-€ 390,00“), Zeilen mit „(inkl. 10 % USt.)“ wie in PROJ-40
- Summe **„Gutschriftsbetrag (inkl. USt.)“** negativ; ohne Zusatz bei Kleinunternehmern oder nur 0 % (Regel aus PROJ-40)
- USt-Tabelle negativ („10 % aus -€ 409,09“, „-€ 40,91“)
- Kleinunternehmer-Hinweis, wenn die Rechnung ihn hatte
- Keine Einleitung, kein Schlusstext, keine Zahlungsmodalitäten

### Wirkung
- **Rechnung:** Status **„storniert“** mit Link zur Gutschrift; die Gutschrift verweist auf die Rechnung. Beide stehen in der Liste „Rechnungen“ und unter „Rechnungen dieser Buchung“.
- **Buchung:** Rechnung und Gutschrift heben sich auf (zusammen € 0,00). Die Buchung gilt wieder als **nicht verrechnet**: Knopf „Rechnung“ wieder aktiv, Filter „ohne Rechnung“ zeigt sie (es zählt die Summe), Spalte „Rechnungen“ zeigt beide Belege, die Rechnung als storniert gekennzeichnet.
- **Schlussrechnung storniert:** Ihre abgezogenen Teilrechnungen gelten wieder als nicht abgezogen und können in einer neuen Schlussrechnung abgezogen werden.
- **Offener Entwurf zieht eine jetzt stornierte Teilrechnung ab:** Der Abzug fällt weg, mit dem bestehenden Hinweis (wie bei einer gelöschten abgezogenen Rechnung, PROJ-40).
- **Kein zweites Mal:** Eine stornierte Rechnung kann nicht erneut storniert, eine Gutschrift nicht storniert werden. Gutschriften sind wie Rechnungen unveränderlich und nicht löschbar.
- **Übergangshinweis in PROJ-42** („Gutschrift außerhalb erstellen und nacherfassen“) entfällt bei in der App ausgestellten Rechnungen; an seiner Stelle steht der Knopf.

### Wer darf was
| Rolle | Darf |
|---|---|
| Inhaber | Gutschrift erstellen und ausstellen; alles sehen |
| Mitarbeiter | Gutschriften in Liste und Detail sehen, PDF öffnen; kein Knopf |
| Betreiber | keine Gutschriften ausstellen |
| Deaktivierter Kunde | nichts ändern |

## User Stories
- Als **Inhaber** möchte ich eine fehlerhafte, bereits ausgestellte Rechnung mit einem Klick per Gutschrift aufheben, damit ich sie nicht außerhalb der App korrigieren und nacherfassen muss.
- Als **Inhaber** möchte ich nach der Gutschrift aus derselben Buchung eine neue, richtige Rechnung erstellen, damit der Gast eine korrekte Rechnung bekommt.
- Als **Inhaber** möchte ich einen Grund auf der Gutschrift angeben, damit Gast und Steuerberater die Korrektur nachvollziehen.
- Als **Inhaber** möchte ich sehen, welche Rechnungen storniert sind und durch welche Gutschrift, damit meine Belege lückenlos nachvollziehbar sind.
- Als **Inhaber** möchte ich, dass die App mich daran hindert, eine bereits abgezogene Teilrechnung allein zu stornieren, damit die Schlussrechnung nicht falsch wird.
- Als **Mitarbeiter** möchte ich Gutschriften sehen, damit ich Rückfragen des Gastes beantworten kann.

## Out of Scope
- **Teilgutschrift** (nur einzelne Positionen oder ein Betrag): später; bis dahin Vollstorno und neue Rechnung
- **Gutschrift zu nacherfassten Rechnungen:** weiter außerhalb erstellen und nacherfassen (Nachfassen dient nur dem Onboarding)
- **Eigener Nummernkreis für Gutschriften**
- **Storno einer Gutschrift** (Rückgängigmachen): nicht vorgesehen; stattdessen neue Rechnung
- **Automatisch neue Rechnung** nach der Gutschrift: der Inhaber erstellt sie selbst aus der Buchung
- **Zahlungen, Rückzahlungen, Status bezahlt/offen:** PROJ-45
- **Status „storniert“ als Filter in der Rechnungsübersicht:** PROJ-43
- **Versand an den Gast:** kein E-Mail-Versand (PRD)
- **Gespeicherter Gutschrift-Entwurf**

## Acceptance Criteria

### Einstieg
- [ ] Angenommen eine in der App ausgestellte Rechnung, wenn der Inhaber ihre Detailseite öffnet, dann gibt es den Knopf „Gutschrift erstellen“
- [ ] Angenommen ein Entwurf, eine nacherfasste Rechnung, eine stornierte Rechnung oder eine Gutschrift, wenn die Detailseite geöffnet wird, dann gibt es keinen Knopf „Gutschrift erstellen“
- [ ] Angenommen eine nacherfasste Rechnung, wenn der Inhaber ihre Detailseite öffnet, dann erklärt ein Hinweis den Weg über eine außerhalb erstellte, nacherfasste Gutschrift
- [ ] Angenommen eine Teilrechnung ist in einer ausgestellten Schlussrechnung abgezogen, wenn der Inhaber ihre Detailseite öffnet, dann ist „Gutschrift erstellen“ gesperrt mit „Zuerst die Schlussrechnung [Nummer] stornieren“ und Link
- [ ] Angenommen ein Mitarbeiter, wenn er eine ausgestellte Rechnung öffnet, dann sieht er keinen Knopf; die Seite „Gutschrift ausstellen“ ist für ihn nicht erreichbar

### Seite „Gutschrift ausstellen“
- [ ] Angenommen der Inhaber öffnet die Seite, wenn sie erscheint, dann zeigt sie den Verweis „zu Rechnung [Nummer] vom [Datum]“, Empfänger, Zeitraum, Gastnamen und alle Positionen mit negativen Beträgen und gleichem Satz, ohne Bearbeitungsmöglichkeit
- [ ] Angenommen die Seite erscheint, wenn der Inhaber nichts ändert, dann ist das Gutschriftsdatum heute und die Nummer der nächste Vorschlag aus dem Nummernkreis
- [ ] Angenommen der Inhaber trägt einen Grund ein, wenn er die Vorschau öffnet, dann steht „Grund: …“ auf der Gutschrift; ohne Grund fehlt die Zeile
- [ ] Angenommen ein Grund über 300 Zeichen, wenn der Inhaber ausstellt, dann erscheint eine Meldung mit der Grenze und nichts wird ausgestellt
- [ ] Angenommen ein Gutschriftsdatum vor dem Rechnungsdatum oder in der Zukunft, wenn die Seite prüft, dann ist „Ausstellen“ gesperrt mit Meldung am Datum
- [ ] Angenommen ein Datum, das nicht zur Nummernfolge passt, wenn die Seite prüft, dann erscheint ein Hinweis, ausstellen bleibt möglich
- [ ] Angenommen eine bereits vergebene Nummer, wenn der Inhaber ausstellt, dann wird abgelehnt mit Meldung und neuem Vorschlag
- [ ] Angenommen eine Nummer über dem Vorschlag, in anderem Format oder anderem Jahr, wenn die Seite prüft, dann ist ausstellen erst nach dem Häkchen „Diese Nummer trotzdem verwenden“ möglich
- [ ] Angenommen die Seite enthält keine Bausteine, wenn sie erscheint, dann gibt es weder Einleitung, Zahlungsmodalitäten noch Schlusstext

### Dokument
- [ ] Angenommen eine Rechnung mit Übernachtung € 390,00 und Endreinigung € 60,00 zu 10 %, wenn die Gutschrift ausgestellt ist, dann lauten die Zeilen „Übernachtung · (inkl. 10 % USt.)  -€ 390,00“ und „Endreinigung · (inkl. 10 % USt.)  -€ 60,00“, die Summe „Gutschriftsbetrag (inkl. USt.)  -€ 450,00“ und die USt-Tabelle „10 % aus -€ 409,09  -€ 40,91“
- [ ] Angenommen die Gutschrift ist ausgestellt, wenn das PDF geöffnet wird, dann lautet die Überschrift „Gutschrift“, darunter „Gutschriftsnummer: [Nummer]“ und „zu Rechnung [Nummer] vom [Datum]“
- [ ] Angenommen eine Kleinunternehmer-Rechnung, wenn ihre Gutschrift ausgestellt ist, dann steht der Kleinunternehmer-Hinweis darauf, ohne USt-Tabelle und ohne „(inkl. … USt.)“
- [ ] Angenommen eine Schlussrechnung mit Abzug, wenn ihre Gutschrift ausgestellt ist, dann sind Positionen, Abzugszeilen und Summen gespiegelt, sodass der Gutschriftsbetrag das Negative des Rechnungsbetrags ist
- [ ] Angenommen eine Teilrechnung nach Betrag, wenn ihre Gutschrift ausgestellt ist, dann sind Anzahlungszeile und Anteile je Satz gespiegelt

### Ausstellen und Wirkung
- [ ] Angenommen alle Prüfungen sind erfüllt, wenn der Inhaber „Ausstellen“ wählt, dann ist die Gutschrift festgeschrieben, ihr PDF abgelegt und die Detailseite der Gutschrift erscheint
- [ ] Angenommen die Gutschrift ist ausgestellt, wenn die Rechnung geöffnet wird, dann zeigt sie „storniert“ mit Link zur Gutschrift; die Gutschrift zeigt den Link zur Rechnung
- [ ] Angenommen die einzige Rechnung einer Buchung ist storniert, wenn die Buchungsübersicht mit „ohne Rechnung“ gefiltert wird, dann erscheint die Buchung; die Spalte „Rechnungen“ zeigt beide Belege, die Rechnung als storniert
- [ ] Angenommen die einzige Rechnung einer Buchung ist storniert, wenn der Inhaber die Buchung öffnet, dann ist der Knopf „Rechnung“ aktiv und eine neue Rechnung lässt sich erstellen und ausstellen
- [ ] Angenommen eine Schlussrechnung mit abgezogener Teilrechnung ist storniert, wenn der Inhaber eine neue Schlussrechnung anlegt, dann kann er dieselbe Teilrechnung wieder abziehen, und die Teilrechnung lässt sich nun auch selbst stornieren
- [ ] Angenommen ein offener Entwurf zieht eine Teilrechnung ab, wenn diese storniert wird, dann fällt der Abzug im Entwurf weg und der bestehende Hinweis erscheint
- [ ] Angenommen eine Rechnung wurde storniert, wenn jemand sie erneut stornieren will (Oberfläche oder am Formular vorbei), dann wird abgelehnt
- [ ] Angenommen eine Gutschrift, wenn jemand sie ändern, löschen oder stornieren will (auch am Formular vorbei), dann wird abgelehnt
- [ ] Angenommen zwei Inhaber stellen gleichzeitig eine Gutschrift zur selben Rechnung aus, wenn beide abschicken, dann entsteht genau eine Gutschrift; der zweite erhält eine Meldung „Rechnung wurde inzwischen storniert“
- [ ] Angenommen die PDF-Erzeugung scheitert, wenn ausgestellt wird, dann entsteht keine Gutschrift, keine Nummer wird verbraucht, und die Seite meldet den Fehler mit Eingaben erhalten

### Rechte
- [ ] Angenommen ein Mitarbeiter, ein fremder Inhaber oder der Betreiber, wenn eine Gutschrift am Formular vorbei ausgestellt werden soll, dann wird abgelehnt
- [ ] Angenommen ein deaktivierter Kunde, wenn eine Gutschrift ausgestellt werden soll, dann wird abgelehnt
- [ ] Angenommen ein Mitarbeiter, wenn er die Liste „Rechnungen“ oder eine Buchung öffnet, dann sieht er Gutschriften samt PDF

### Allgemein
- [ ] Angenommen die Seite am Handy (375 px), wenn der Inhaber eine Gutschrift ausstellt, dann ist alles ohne seitliches Scrollen bedienbar, Bedienelemente mindestens 44 px

## Edge Cases
- **Rechnung, deren Buchung inzwischen geändert oder storniert wurde:** Die Gutschrift spiegelt die Rechnung, nicht die Buchung; keine Sperre.
- **Stammdaten, Briefpapier oder Fußzeile haben sich seit der Rechnung geändert:** Aussteller-Block, Gestaltung und Fußzeile kommen aus dem aktuellen Stand; Empfänger, Positionen und Kleinunternehmer aus der Rechnung.
- **Rechnung mit negativem oder 0-Betrag** (Rabatte): Die Gutschrift spiegelt; ein Gutschriftsbetrag von € 0,00 oder positiv ist zulässig (Hinweis wie in PROJ-42).
- **Rechnung ohne Buchung** (nur bei nacherfassten möglich): nicht betroffen, da keine Gutschrift zu nacherfassten Rechnungen.
- **Gutschriftsdatum in einem neuen Jahr** bei „jährlich neu“: Vorschlag folgt dem Jahr des Gutschriftsdatums wie bei Rechnungen.
- **Logo nicht ladbar, Zeichen ohne Glyph, Fußzeile gekürzt, Aussteller-Block zu groß:** dieselben Sperren und Häkchen wie in PROJ-42.
- **Kunde löschen (Betreiber):** Gutschriften zählen wie ausgestellte Rechnungen für die Löschsperre (PROJ-42).
- **Schlussrechnung storniert, deren Teilrechnung schon in einer zweiten Schlussrechnung steckt:** nicht möglich, da eine Teilrechnung nur in einer gültigen Schlussrechnung abgezogen sein kann.

## Technical Requirements
- Rechte serverseitig durchgesetzt (nur Inhaber des eigenen, aktiven Kunden)
- Gutschrift und Status „storniert“ entstehen in einem Schritt; höchstens eine Gutschrift je Rechnung, auch bei gleichzeitigen Anfragen
- Gutschriften unveränderlich wie ausgestellte Rechnungen (PROJ-42), PDF privat abgelegt, 7 Jahre Aufbewahrung
- Nummer eindeutig im gemeinsamen Nummernkreis mit Rechnungen
- Deutsche Texte über die bestehende i18n-Struktur; responsiv ab 375 px; Chrome, Firefox, Safari

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Rechnungstabelle:** Nacherfasste Rechnungen, Entwürfe und ausgestellte Rechnungen liegen in einer Tabelle, mit Art (Rechnung, Teilrechnung, Schlussrechnung) und Herkunft. Nummern sind je Kunde eindeutig, über alle Belege hinweg.
- **Festgeschriebene Fassung:** Jede ausgestellte Rechnung trägt eine vollständige Kopie dessen, was auf ihr steht: Empfänger, Zeitraum, Gastnamen, Positionen, Abzüge, USt je Satz, Kleinunternehmer samt Hinweis (PROJ-42). Daraus lässt sich die Gutschrift bilden, ohne die Buchung anzufassen.
- **Ausstellen in einem Schritt:** Prüfen → PDF → ablegen → in einem Datenbankschritt Nummer vergeben und festschreiben, nur über den Server (PROJ-42). Unveränderlichkeit, Löschsperre beim Kunden und Bereinigung liegengebliebener Dateien gelten für alles mit Herkunft „ausgestellt“.
- **Summen:** „Verrechnet“ ist die Summe aller nacherfassten und ausgestellten Belege einer Buchung. Der Knopf „Rechnung“ ist aktiv, solange sie unter dem Gesamtpreis liegt.
- **Weggefallener Abzug:** Für gelöschte abgezogene Rechnungen gibt es schon den Hinweis im Entwurf samt neu gebildetem Betrag (PROJ-40).

### Grundidee
Die Gutschrift ist **ein eigener Beleg in derselben Rechnungstabelle**: Herkunft „ausgestellt“, neue Art **„Gutschrift“**, mit Verweis auf die stornierte Rechnung und derselben Buchung. Die Rechnung selbst wird **nicht verändert**. „Storniert“ ist kein gespeichertes Feld, sondern ergibt sich daraus, dass eine Gutschrift auf sie verweist.

Damit fällt fast alles Übrige von selbst ab:
- Gutschriften sind unveränderlich, nicht löschbar und zählen für die Löschsperre beim Kunden, ohne neue Regeln.
- Gemeinsamer Nummernkreis: Die Nummer steht in derselben Spalte, Eindeutigkeit und „nächste Nummer“ berücksichtigen Gutschriften automatisch.
- Rechnung und Gutschrift erscheinen in „Rechnungen“ und „Rechnungen dieser Buchung“. Ihre Summe ist € 0,00, damit wird der Knopf „Rechnung“ wieder aktiv.
- Die Schutzregel der Datenbank für ausgestellte Rechnungen braucht keine Ausnahme, weil niemand die Rechnung ändert.

### Ablauf des Ausstellens
```
Inhaber drückt „Gutschrift ausstellen“
  |
  v
1. Server prüft Anmeldung, Rolle, Kunde aktiv, Rechnung noch nicht storniert,
   keine gültige Schlussrechnung zieht sie ab, Datum, Grund, Nummer, Häkchen
  |
  v
2. Server bildet die Gutschrift aus der festgeschriebenen Fassung der Rechnung
   (gespiegelt) und dem aktuellen Briefpapier, erzeugt das PDF ohne Aufdruck
   und prüft dessen Meldungen
  |
  v
3. Server legt das PDF unter zufälligem Namen ab
  |
  v
4. Datenbank in einem einzigen Schritt: Rechnung sperren, alles nochmals
   prüfen, Gutschrift mit Nummer, Datum, Grund, Verweis, Positionen, PDF,
   Fassung und Protokoll anlegen; offene Entwürfe verlieren den Abzug
   einer jetzt stornierten Teilrechnung
  |
  +-- gelingt  --> Detailseite der Gutschrift
  +-- scheitert --> Datei wird entfernt, nichts angelegt, Meldung auf der Seite
```
Gleichzeitige Anfragen: Die Datenbank erlaubt **höchstens eine Gutschrift je Rechnung**. Der zweite Inhaber erhält „Rechnung wurde inzwischen storniert“ mit Link zur Gutschrift. Ein zweiter Versuch derselben Anfrage (Antwort unterwegs verloren) führt zur schon ausgestellten Gutschrift.

### Seiten und Bausteine der Oberfläche
```
Rechnungs-Detailseite (besteht)
+-- ausgestellte Rechnung, nicht storniert, Inhaber
|   +-- Knopf „Gutschrift erstellen“ (neu, ersetzt den Übergangshinweis)
|   +-- gesperrt: „Zuerst die Schlussrechnung [Nummer] stornieren“ mit Link
+-- ausgestellte Rechnung, storniert
|   +-- Status „storniert“ mit Link zur Gutschrift
+-- Gutschrift (neue Darstellung, aus ihrer Fassung)
|   +-- Überschrift „Gutschrift [Nummer]“, „zu Rechnung [Nummer] vom [Datum]“ mit Link
|   +-- Grund, Positionen, Summen und USt je Satz negativ
|   +-- „PDF öffnen“; keine Knöpfe zum Ändern, Löschen oder Stornieren
+-- nacherfasste Rechnung, Inhaber
    +-- Hinweis auf den bisherigen Weg (außerhalb erstellen, nacherfassen)

Seite „Gutschrift ausstellen“ (neu, /rechnungen/[id]/gutschrift, nur Inhaber)
+-- Formularbereich
|   +-- Verweis, Empfänger, Zeitraum, Gastnamen, Positionen (nur lesen)
|   +-- Gutschriftsdatum mit „Datum auf heute setzen“
|   +-- Grund (eine Zeile, Zeichenzähler bis 300)
|   +-- Gutschriftsnummer mit „Vorschlag übernehmen“ und Hinweis zur Folge
|   +-- Prüfungen: Sperren, Häkchen, Hinweise (wie PROJ-42)
|   +-- Knopf „Gutschrift ausstellen“ mit Fortschritt und Hinweis auf die Endgültigkeit
|   +-- „Zurück zur Rechnung“
+-- PDF-Vorschau mit Aufdruck „Entwurf“ (besteht, PROJ-41/42), übernimmt Datum, Grund und Nummer

Rechnungsliste, „Rechnungen dieser Buchung“, Spalte „Rechnungen“ der Buchungsübersicht (bestehen)
+-- Gutschriften mit Art „Gutschrift“ und negativem Betrag
+-- stornierte Rechnungen mit Kennzeichen „storniert“
```
Die Seite „Gutschrift ausstellen“ folgt im Aufbau der Seite „Rechnung ausstellen“ (PROJ-42), auch am Handy. Dieselben Bausteine für Datum, Nummer, Prüfliste und Vorschau werden wiederverwendet.

### Gutschrift bilden (Spiegelung)
- **Quelle ist die festgeschriebene Fassung der Rechnung**, nicht die Buchung. Spätere Änderungen an Buchung, Gast oder Preisen wirken nicht.
- **Gespiegelt** werden Positionen, Anzahlungszeile und Anteile je Satz (Teilrechnung), Zwischensumme, Abzugszeilen und Gesamtbetrag (Schlussrechnung) sowie die USt je Satz. Die Beträge werden **genau umgekehrt übernommen, nicht neu berechnet**. So ergibt die Summe aus Rechnung und Gutschrift auch nach Rundung je Satz exakt € 0,00.
- **Aus der Rechnung:** Empfänger, Zeitraum, Wohnung, Gastnamen, Kleinunternehmer-Status samt Hinweistext.
- **Aktuell:** Aussteller-Block, Briefpapier, Logo, Fußzeile (Nutzerentscheidung in der Spec).
- **Entfällt:** Einleitung, Zahlungsmodalitäten, Fristen, Schlusstext.

### Dokument
Eine Vorlage für alle Belege (PROJ-41). Die Gutschrift ist eine weitere Art darin, mit eigenen Texten: Überschrift „Gutschrift“, Zeile „Gutschriftsnummer: …“, Zeile „zu Rechnung … vom …“, optional „Grund: …“, Summe „Gutschriftsbetrag (inkl. USt.)“ bzw. „Gutschriftsbetrag“ (Regel aus PROJ-40). Abschnitte ohne Inhalt (Einleitung, Zahlung, Schluss) fallen weg wie heute schon leere Bausteine. Alle Texte kommen aus der bestehenden Übersetzungsdatei.

### Prüfregel
Eine eigene, schlanke Prüfregel für Gutschriften, die dieselben Teile wie PROJ-42 nutzt:
- **Sperren:** Datum vor dem Rechnungsdatum oder in der Zukunft; Grund zu lang; Nummer vergeben; Rechnung inzwischen storniert; Teilrechnung in gültiger Schlussrechnung abgezogen; Logo nicht ladbar, gekürzte Fußzeile (wie PROJ-42)
- **Häkchen:** Nummer über dem Vorschlag, anderes Format oder anderes Jahr; Zeichen ohne Glyph, übergroßer Aussteller-Block (wie PROJ-42)
- **Hinweise:** Datum passt nicht zur Nummernfolge; Gutschriftsbetrag € 0,00 oder positiv

Nicht geprüft werden Buchungsstand, Pflichtangaben des Entwurfs und Überverrechnung: Die Gutschrift hängt nur an der Rechnung. Seite und Server nutzen dieselbe Regel; sie läuft beim Ausstellen auf dem Server neu.

### Datenmodell (in Worten)
Neu an der Rechnungstabelle:
- **Art „Gutschrift“** zusätzlich zu Rechnung, Teilrechnung und Schlussrechnung
- **Storniert Rechnung:** Verweis von der Gutschrift auf die Rechnung. Höchstens eine Gutschrift je Rechnung (in der Datenbank eindeutig). Nur bei Gutschriften gesetzt, und dort immer
- **Grund:** optional, bis 300 Zeichen, nur bei Gutschriften

Eine Gutschrift übernimmt von der Rechnung: Buchung, Gastverknüpfung, Empfängerfelder, Kleinunternehmer-Status. Ihre Positionen stehen negativ in der Positionstabelle (ohne Verknüpfung zu Zusatzkosten der Buchung). **Abzugszeilen** stehen nur in der Fassung und im PDF, **nicht** als Abzug in der Abzugstabelle; sonst würde die Gutschrift die Teilrechnung selbst „abziehen“. Der Gesamtbetrag ist das Negative des Rechnungsbetrags. Felder, die nur Entwürfe und Rechnungen brauchen (Fristen, Bausteine, Teilung), bleiben leer; die bestehenden Prüfregeln der Tabelle bekommen dafür eine Ausnahme für die Art „Gutschrift“.

Für bestehende Belege ändert sich nichts, eine Datenmigration ist nicht nötig.

### „Storniert“ und „abgezogen“ an allen Stellen
- **Status „storniert“** wird beim Lesen ermittelt (Gutschrift vorhanden) und mit Nummer und Link der Gutschrift geliefert: Rechnungsliste, Detailseite, „Rechnungen dieser Buchung“, Spalte „Rechnungen“.
- **„Abgezogen“ zählt nur noch durch gültige Schlussrechnungen**, also ausgestellte und nicht stornierte. Das betrifft die Sperre „Zuerst die Schlussrechnung stornieren“, die bestehende Sperre für abgezogene nacherfasste Rechnungen (PROJ-42) und das Ausstellen einer neuen Schlussrechnung. Die Abzüge der stornierten Schlussrechnung bleiben als Geschichte erhalten.
- **Abziehbar in neuen Schlussrechnungen:** stornierte Rechnungen und Gutschriften nicht mehr; Teilrechnungen einer stornierten Schlussrechnung wieder. Das Ausstellen einer Schlussrechnung prüft zusätzlich in der Datenbank, dass keine ihrer Teilrechnungen storniert oder schon in einer gültigen Schlussrechnung abgezogen ist.
- **Offener Entwurf:** Beim Storno einer Teilrechnung entfernt der Datenbankschritt ihre Abzüge aus Entwürfen über die bestehende Funktion. Der Entwurf zeigt den bekannten Hinweis und einen neu gebildeten Betrag.

### Buchungsübersicht: Filter „ohne Rechnung“
Bisher gilt: keine verknüpfte Rechnung außer Entwürfen. Neu zählt **die Summe der verrechneten Belege**: Die Buchung gilt als „ohne Rechnung“, wenn sie keine hat oder deren Summe € 0,00 ist (Rechnung + Gutschrift). „Mit Rechnung“ ist das Gegenteil. Die Datenbank liefert dazu je Buchung die verrechnete Summe als Lesesicht mit den Rechten des Lesenden, und der Filter nutzt sie statt der bisherigen Verknüpfung. Er wirkt weiter über alle Monate, mit Seiten zu je 50.

### Rechte
- **Ausstellen:** nur über die neue Schnittstelle. Der Schreibschritt in der Datenbank ist nur für den Server freigegeben. Er prüft Person (Inhaber des Kunden), Kunde aktiv, Rechnung und Datei selbst und nennt die handelnde Person im Protokoll.
- **Lesen:** unverändert. Alle Mitglieder des Kunden sehen Gutschriften samt PDF; die RLS-Regeln bleiben, wie sie sind.
- **Seite „Gutschrift ausstellen“:** für Mitarbeiter und Betreiber nicht erreichbar (Weiterleitung zur Rechnung).

### Schnittstellen
- **Vorschau und Prüfung:** Die bestehende Vorschau-Schnittstelle nimmt zusätzlich „Gutschrift zu Rechnung X“ mit Datum, Grund und Nummer an und liefert PDF und Prüfliste. Nichts wird gespeichert. Veraltete Anfragen werden abgebrochen (PROJ-41).
- **Ausstellen:** eigene Schnittstelle unter `/api/rechnungen/[id]/gutschrift`, gebaut wie das Ausstellen in PROJ-42, weil Arbeitsprozess und Schriften nur dort mitgeliefert werden. Danach folgt ein vollständiger Seitenaufruf der Gutschrift.

### Übergangshinweis aus PROJ-42
Der Hinweis „Erstelle außerhalb der App eine Gutschrift …“ steht künftig nur noch bei **nacherfassten** Rechnungen (Inhaber), angepasst auf diesen Fall. Bei ausgestellten Rechnungen steht stattdessen der Knopf.

### Für /frontend und /backend
- **/frontend:** Seite „Gutschrift ausstellen“, Spiegelung aus der Fassung, Prüfregel, Art „Gutschrift“ in Vorlage und Texten, Knopf samt Sperre auf der Detailseite, Detailansicht der Gutschrift, Kennzeichen „storniert“ in Liste, Buchungsdetail und Spalte, Abziehbarkeit im Entwurf, Hinweis bei nacherfassten Rechnungen. Bis zur Migration zeigt die Seite die Prüfungen, und das Ausstellen meldet „wird eingerichtet“.
- **/backend:** Neue Felder, Art „Gutschrift“ und Ausnahmen in den Tabellenregeln, Schreibfunktion mit Sperre gegen Gleichzeitigkeit, Abzugsregeln mit gültigen Schlussrechnungen (Sperre, Ausstellen, nacherfasste Rechnungen), Lesefunktionen mit Status „storniert“, Summe je Buchung für den Filter, Schnittstelle mit Ablage.

### Für /qa
- Gleichzeitiges Stornieren derselben Rechnung, Doppelklick, Abbruch nach der Ablage
- Direkte Versuche am Formular vorbei: zweite Gutschrift, Gutschrift zu Gutschrift, nacherfasster Rechnung oder Entwurf, abgezogene Teilrechnung, Mitarbeiter, Betreiber, fremder Kunde, deaktivierter Kunde
- Spiegelung exakt: Summe Rechnung + Gutschrift = € 0,00 je Satz, auch bei Rundung, Schlussrechnung mit Abzug und Teilrechnung nach Betrag
- Ablauf Schlussrechnung stornieren → neue Schlussrechnung mit derselben Teilrechnung → Teilrechnung stornieren
- Filter „ohne/mit Rechnung“ mit stornierten Rechnungen, nacherfassten Gutschriften und Seitenwechsel
- PDF und Ablage auf Staging unter Vercel

### Abhängigkeiten
Keine neuen Pakete.

## Implementation Notes (Frontend)

**Gebaut:** Seite `/rechnungen/[id]/gutschrift` mit dem gespiegelten Inhalt der Rechnung (nur lesen), Datum, Grund mit Zähler, Nummer mit Vorschlag, Prüfliste, Häkchen und PDF-Vorschau mit Aufdruck „Entwurf“. Dazu der Knopf „Gutschrift erstellen“ auf der Detailseite, gesperrt bei abgezogener Teilrechnung mit Link zur Schlussrechnung. Eine stornierte Rechnung zeigt den Hinweis samt Link zur Gutschrift, die Gutschrift ihren Verweis auf die Rechnung. Neu ist auch die Detailansicht der Gutschrift (Art, Gutschriftsdatum, Rechnung, Grund, ohne Fälligkeit, „Gutschriftsbetrag“). Kennzeichen „Gutschrift“ und „storniert“ stehen in der Rechnungsliste, unter „Rechnungen dieser Buchung“ und in der Spalte „Rechnungen“ der Buchungsübersicht („(storniert)“). Der Korrekturhinweis aus PROJ-42 steht nur noch bei nacherfassten Rechnungen (Inhaber). Stornierte Rechnungen und Gutschriften sind in neuen Schlussrechnungen nicht abziehbar.

**Regeln und Dateien**
- `src/lib/invoice-credit.ts`: `mirrorAmounts`, `creditPreviewModel`, `creditSnapshot`, `creditChecks`, `creditEntry`, `cleanCreditReason` (Tests: `invoice-credit.test.ts`, 23)
- `src/lib/invoice-issue.ts`: Nummern- und PDF-Prüfung als `addNumberChecks`/`addPdfChecks` herausgelöst (gleiches Ergebnis für Rechnungen); neue Sperren und Hinweis; `IssuedSnapshot.credit`
- `src/lib/invoice-credit-data.ts`: `getCreditNotesFor` (Rechnung → Gutschrift), `getValidFinalDeducting`
- `src/lib/invoice-issue-data.ts`: `loadCreditState`, `creditChecksFor`
- PDF: `InvoicePreviewModel.credit`, `PdfView.references`; Überschrift, Nummer, Verweis, Grund, „Gutschriftsbetrag“ in `view.ts`/`document.tsx`
- `src/app/api/rechnungen/vorschau/route.ts`: Anfrage `{ creditFor, credit: { invoiceDate, number, reason } }`, nur Inhaber
- `src/app/api/rechnungen/[id]/gutschrift/route.ts`: Ausstellen; antwortet `notReady`, solange die Datenbankfunktion fehlt
- `src/components/invoice-credit/`: `credit-form.tsx`, `credit-status.tsx`

**Abweichungen vom Tech Design**
- Die Spiegelung lebt in der Fassung: `kind` der Gutschrift-Fassung ist die Art der stornierten Rechnung (für die Anzahlungszeile), die Gutschrift erkennt man an `credit` in der Fassung und an der Spalte `kind = 'credit_note'`.
- „Verrechnet“ im Buchungsformular (Ortstaxe automatisch, PROJ-15) zählt jetzt nach der Summe der Belege statt „irgendein Beleg“, passend zur Buchung „wieder offen“.

**Schnittstelle für /backend** (umgesetzt, siehe Implementation Notes (Backend))
- `invoices.kind` erlaubt `'credit_note'`; neue Spalten `credited_invoice_id` (Fremdschlüssel auf die Rechnung desselben Kunden, eindeutig, nur und immer bei Gutschriften) und `credit_reason` (bis 300 Zeichen); Prüfregeln der Tabelle mit Ausnahme für Gutschriften (keine Fristen, Bausteine, Teilung)
- RPC `public.issue_credit_note(p_input jsonb)`, nur `service_role`, liefert die ID der Gutschrift. Eingabe: `invoice_id, tenant_id, actor_id, number, invoice_date, reason, total_cents, lines [{label, amount_cents, vat_rate}], pdf_path, pdf_sha256, without_logo, snapshot`. Prüft Person (Inhaber), Kunde aktiv, Rechnung ausgestellt und keine Gutschrift, keine gültige Schlussrechnung zieht sie ab, Datum (nicht vor der Rechnung, nicht in der Zukunft), Nummer, Betrag = −Rechnungsbetrag, Datei. Sperrt die Rechnung, legt die Gutschrift an (Buchung, Gast, Empfängerfelder, Kleinunternehmer aus der Rechnung), entfernt Abzüge einer stornierten Teilrechnung aus Entwürfen (`detach_deductions`), Protokoll. Fehlercodes, die die Schnittstelle auswertet: P0904 Nummer vergeben, **P0934** schon storniert, **P0935** abgezogen, P0901/P0016 keine Rechte bzw. Kunde deaktiviert
- „Abgezogen“ nur durch gültige Schlussrechnungen: `issued_final_deducting`, `check_deducted_invoice`/`save_invoice`/`delete_invoice`; `issue_invoice` lehnt stornierte und schon gültig abgezogene Teilrechnungen ab
- `booking_invoices` darf so bleiben (Kennzeichen „storniert“ ergänzt die App); Filter „ohne/mit Rechnung“ in `src/lib/bookings-data.ts` auf die Summe je Buchung umstellen (Lesesicht), bisher noch die alte Verknüpfung
- Danach: Typen neu erzeugen, Umgehungen entfernen (`as 'id'` in `invoice-credit-data.ts`, `CreditRpc` in der Schnittstelle), Rückfall für die fehlende Spalte (`42703`) entfernen

**Geprüft**
- `npm run lint`, `tsc`, `npm run build`: ohne Fehler; Unit-Tests 719 grün (+23 neu)
- E2E `tests/PROJ-44-rechnungsstorno.spec.ts` (gebauter Server): Einstieg und Seite, Grund/Datum/Nummer, Mitarbeiter, nacherfasste Rechnung und Entwurf grün (Desktop); Layout grün (Desktop, Handy). Die Abläufe mit ausgestellter Gutschrift überspringen sich, bis die Spalte existiert
- PROJ-42-E2E angepasst (Knopf statt Hinweis; Schalter-Hinweis bei der nacherfassten Rechnung): betroffene Tests grün
- Am Bild geprüft: Seite am Handy, Detailseite am Desktop
- Nicht geprüft: Ausstellen selbst (Backend fehlt), Tablet, Firefox, Safari

## Implementation Notes (Backend)

**Migrationen (nur Dev, in dieser Reihenfolge):** `20261106082931_invoice_credit_notes.sql`, `20261106083354_invoice_credit_notes_history.sql`. RLS unverändert. `db advisors`: nur der bekannte Auth-Hinweis zur OTP-Dauer.

**Datenbank**
- `invoices`: Art `credit_note`; `credited_invoice_id` (Fremdschlüssel auf die Rechnung desselben Kunden, eindeutig: höchstens eine Gutschrift je Rechnung), `credit_reason` (bis 300 Zeichen); Prüfregel: Gutschrift immer ausgestellt und mit Verweis, sonst beides leer; Gutschriften ohne Fristen
- `public.issue_credit_note(p_input)`: nur `service_role`. Sperrt die Rechnung, prüft Person, Kunde, Art und Herkunft, Storno, gültige Schlussrechnung, Datum, Grund, Nummer, Betrag (= −Rechnungsbetrag) und Datei, legt die Gutschrift an und spiegelt die Positionen **aus der Rechnung** (nicht aus der Eingabe). Entfernt Abzüge der stornierten Rechnung aus Entwürfen (`private.detach_draft_deductions`, Hinweis „Abgezogene Rechnung existiert nicht mehr“). Fehler: P0901, P0016, P0902, P0903, P0904, P0906, P0907, **P0934** (Detail: Kennung der Gutschrift), **P0935** (Detail: Nummer der Schlussrechnung), 22023
- `private.issued_final_deducting`: nur gültige Schlussrechnungen. Damit sind abgezogene nacherfasste Rechnungen nach dem Storno der Schlussrechnung wieder änderbar und löschbar
- `public.issue_invoice`: lehnt Abzüge stornierter oder schon gültig abgezogener Rechnungen ab (P0930); sonst unverändert
- `private.protect_issued_children`: erlaubt nur die Positionen der Gutschrift im selben Vorgang und das Wegfallen von Abzügen einer stornierten Schlussrechnung (zweite Migration, aus dem Test „nacherfasste Rechnung löschen“)
- `public.billed_cents(bookings)`: verrechnete Summe je Buchung als filterbares Feld (Rechte des Lesenden)

**Server und App**
- Schnittstelle `/api/rechnungen/[id]/gutschrift` ruft `issue_credit_note` ohne Umgehung; P0902/P0906/P0935 → „blocked“, P0934 → „alreadyCredited“ mit Link
- Filter „ohne/mit Rechnung“ der Buchungsübersicht: `billed_cents = 0` bzw. `≠ 0` statt der Verknüpfung
- Übergangslösungen aus dem Frontend entfernt (Spalten-Rückfall, Typ-Umgehungen, Meldung „wird eingerichtet“)

**Abweichung vom Tech Design:** Statt einer Lesesicht ist die Summe je Buchung ein berechnetes Feld der Buchung (PostgREST kann danach filtern und zählen, ohne eigene Verknüpfung).

**Bewusst offen:** `save_invoice_draft` nimmt am Formular vorbei weiterhin eine stornierte Teilrechnung als Abzug an; Ausstellen lehnt sie dann ab (P0930), die Oberfläche bietet sie nicht an.

**Geprüft**
- Integration nacheinander (`--no-file-parallelism --maxWorkers=1`): `invoice-credit` 15 neu grün; `invoice-issue`, `invoices`, `invoice-drafts`, `invoice-settings`, `operator`, `bookings` grün; `rls`: 60/61, rot nur der bekannte Test „Person ohne Mitgliedschaft“ (Testreste im Protokoll von Dev, nicht PROJ-44)
- Unit 719 grün, Lint, Build ohne Fehler
- E2E Desktop (gebauter Server): PROJ-44 Ablauf bis zur Gutschrift samt Rechnung „storniert“, Buchung wieder offen, Buchungsübersicht mit Filter und „(storniert)“; PROJ-37 Spalte und Filter (6 Tests) grün
- Nicht geprüft: PDF und Ablage auf Vercel; Firefox, Safari, Tablet

## Open Questions
- [ ] Steuerberater: Bezeichnung „Gutschrift“ für den Stornobeleg und Pflichtangaben darauf (Verweis auf Nummer und Datum der Rechnung) bestätigen
- [x] Soll die Gutschrift in PROJ-45 automatisch als „Rückzahlung offen“ erscheinen, wenn die Rechnung schon bezahlt war? → Ja, mit dem tatsächlich eingegangenen Betrag als Guthaben; alternativ Zahlung auf eine andere Rechnung umhängen (PROJ-45, 2026-11-06)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nur Vollstorno, keine Teilgutschrift | Deckt jeden Fehler ab (Vollstorno + neue Rechnung), rechtlich und für die Buchhaltung am klarsten; Teil-/Schlussrechnungen ohne Sonderfälle | 2026-11-06 |
| Beleg heißt „Gutschrift zu Rechnung [Nummer]“, nicht „Stornorechnung“ | Nutzerentscheidung | 2026-11-06 |
| Gemeinsamer Nummernkreis mit Rechnungen, Vorschlag überschreibbar wie in PROJ-42 | Keine neue Einstellung, lückenlose Folge | 2026-11-06 |
| Kein gespeicherter Entwurf; eigene Seite mit Datum, Grund, Nummer und Vorschau, Ausstellen in einem Schritt | Fast nichts einzustellen; alles Übrige ist durch die Rechnung festgelegt | 2026-11-06 |
| Keine Textbausteine und keine Zahlungsregeln auf der Gutschrift | Bei einer Gutschrift wird nichts verlangt | 2026-11-06 |
| Beträge auf der Gutschrift negativ, Summe „Gutschriftsbetrag (inkl. USt.)“ | Üblich bei Belegen; Summen über Rechnungen und Gutschriften bleiben verständlich | 2026-11-06 |
| Rechnung erhält Status „storniert“ mit Link; Buchung gilt wieder als nicht verrechnet; Filter „ohne Rechnung“ nach Summe | Filter soll zeigen, was noch zu verrechnen ist; neue Rechnung aus der Buchung ohne Umweg | 2026-11-06 |
| Abgezogene Teilrechnung erst nach Storno der Schlussrechnung stornierbar; Schlussrechnung jederzeit | Schlussrechnung bliebe sonst falsch | 2026-11-06 |
| Keine Gutschrift zu nacherfassten Rechnungen | Nacherfassen dient nur dem Onboarding; Empfänger dort nur als Text | 2026-11-06 |
| Rechte wie beim Ausstellen: Inhaber stellen aus, Mitarbeiter sehen, Betreiber nicht | Einheitlich mit PROJ-42 | 2026-11-06 |
| Empfänger, Positionen und Kleinunternehmer aus der Rechnung; Aussteller, Gestaltung und Fußzeile aktuell | Gutschrift muss die Rechnung spiegeln; Absenderdaten sollen aktuell sein (ohne Rückfrage festgelegt, zur Prüfung) | 2026-11-06 |
| Gutschriftsdatum nicht vor dem Rechnungsdatum und nicht in der Zukunft; Grund optional bis 300 Zeichen | Datum nach PROJ-42; Grund hilft beim Nachvollziehen (ohne Rückfrage festgelegt, zur Prüfung) | 2026-11-06 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Gutschrift als eigener Beleg in der Rechnungstabelle (Herkunft „ausgestellt“, neue Art „Gutschrift“) | Unveränderlichkeit, Löschsperre, Nummernkreis, Listen und Summen gelten ohne neue Regeln | 2026-11-06 |
| „Storniert“ wird aus der verweisenden Gutschrift ermittelt, nicht an der Rechnung gespeichert | Die ausgestellte Rechnung bleibt unberührt; die Schutzregel braucht keine Ausnahme | 2026-11-06 |
| Höchstens eine Gutschrift je Rechnung, eindeutig in der Datenbank; Rechnung im Schreibschritt gesperrt | Gleichzeitige Anfragen ergeben genau eine Gutschrift | 2026-11-06 |
| Gutschrift aus der festgeschriebenen Fassung der Rechnung, Beträge und USt je Satz exakt umgekehrt übernommen | Unabhängig von späteren Änderungen an der Buchung; Summe aus beiden ist auch nach Rundung € 0,00 | 2026-11-06 |
| Abzugszeilen der Schlussrechnung nur in Fassung und PDF der Gutschrift, nicht in der Abzugstabelle | Die Gutschrift würde sonst selbst als abziehende Rechnung gelten | 2026-11-06 |
| „Abgezogen“ zählt nur durch ausgestellte, nicht stornierte Schlussrechnungen; Abzüge der stornierten bleiben als Geschichte | Teilrechnungen werden nach dem Storno frei, ohne Daten zu löschen | 2026-11-06 |
| Ausstellen einer Schlussrechnung prüft in der Datenbank, dass keine Teilrechnung storniert oder schon gültig abgezogen ist | Bisher sicherte das nur die Oberfläche | 2026-11-06 |
| Filter „ohne Rechnung“: keine Belege oder Summe der verrechneten Belege € 0,00; Summe je Buchung als Lesesicht | Folgt der Spec („es zählt die Summe“); auch nacherfasste Gutschriften nach dem alten Weg zählen richtig. Folge: eine Rechnung über € 0,00 gilt ebenfalls als „ohne Rechnung“ | 2026-11-06 |
| Ausstellen über eigene Schnittstelle `/api/rechnungen/[id]/gutschrift`, Schreibschritt nur für den Server | Wie PROJ-42: Arbeitsprozess und Schriften nur unter /api; kein Festschreiben mit fremdem PDF | 2026-11-06 |
| Bestehende Vorschau-Schnittstelle und Vorlage um die Art „Gutschrift“ erweitert, eigene schlanke Prüfregel aus den Teilen von PROJ-42 | Ein PDF-Weg für alle Belege; Gutschrift braucht keine Buchungs- und Pflichtangaben-Prüfung | 2026-11-06 |

---

## QA Test Results

**Tested:** 2026-11-06
**App URL:** http://localhost:3000 (gebauter Server, Dev „apppa-dev“); Safari gegen `npm run dev`
**Tester:** QA Engineer (AI)
**Automatisiert:** `tests/PROJ-44-rechnungsstorno.spec.ts` (15 Tests), `supabase/tests/invoice-credit.integration.test.ts` (15), `src/lib/invoice-credit.test.ts` (23)

### Acceptance Criteria Status

#### Einstieg (5/5)
- [x] Knopf „Gutschrift erstellen“ auf in der App ausgestellter Rechnung (Inhaber)
- [x] Kein Knopf bei Entwurf, nacherfasster Rechnung, stornierter Rechnung, Gutschrift; Seite führt zurück
- [x] Nacherfasste Rechnung: Hinweis auf den bisherigen Weg
- [x] Abgezogene Teilrechnung: Knopf gesperrt, „Zuerst die Schlussrechnung [Nummer] stornieren.“ mit Link; Seite und Schnittstelle gesperrt
- [x] Mitarbeiter: kein Knopf, Seite leitet zur Rechnung, Schnittstellen 403

#### Seite „Gutschrift ausstellen“ (9/9)
- [x] Verweis, Empfänger, Zeitraum, Positionen negativ, nicht änderbar (nur Datum, Grund, Nummer)
- [x] Datum heute, Nummer = nächster Vorschlag aus dem gemeinsamen Kreis
- [x] Grund auf der Vorschau; ohne Grund keine Zeile
- [x] Grund über 300 Zeichen: Meldung, Ausstellen gesperrt (auch am Formular vorbei)
- [x] Datum vor der Rechnung / in der Zukunft: Meldung am Datum, gesperrt (auch am Formular vorbei)
- [x] Datum passt nicht zur Folge: Hinweis (gemeinsame Regel mit PROJ-42, Unit)
- [x] Vergebene Nummer: gesperrt; beim Absenden neue Nummer (Regel aus PROJ-42)
- [x] Nummer über dem Vorschlag / anderes Format: erst mit Häkchen
- [x] Keine Einleitung, Zahlungsmodalitäten, Schlusstext

#### Dokument (5/5)
- [x] Beispiel der Spec exakt (Zeilen, „Gutschriftsbetrag (inkl. USt.)“, USt-Tabelle; Unit); abgelegtes PDF mit -€ 900,00 / „10 % aus -€ 818,18 -€ 81,82“
- [x] Überschrift „Gutschrift“, „Gutschriftsnummer: …“, „zu Rechnung … vom …“, „Grund: …“, ohne Aufdruck
- [x] Kleinunternehmer: Hinweis, ohne USt-Tabelle und Zusatz (Unit)
- [x] Schlussrechnung: Positionen, Abzugszeile (inkl. „darin USt“) und Summen gespiegelt, Gutschriftsbetrag = −Rechnungsbetrag
- [x] Teilrechnung nach Betrag: Anzahlungszeile und Anteile gespiegelt (Unit)

#### Ausstellen und Wirkung (10/10)
- [x] Festgeschrieben, PDF abgelegt, Detailseite der Gutschrift
- [x] Rechnung „storniert“ mit Link zur Gutschrift, Gutschrift mit Link zur Rechnung
- [x] Buchungsübersicht: „ohne Rechnung“ zeigt die Buchung, „mit Rechnung“ nicht; Spalte zeigt beide Belege, „(storniert)“
- [x] Knopf „Rechnung“ in der Buchung wieder aktiv
- [x] Schlussrechnung storniert → neue Schlussrechnung zieht dieselbe Teilrechnung ab; nach deren Storno Teilrechnung selbst stornierbar (Integration, E2E)
- [x] Offener Entwurf verliert den Abzug, Hinweis „Abgezogene Rechnung existiert nicht mehr“, Betrag neu
- [x] Zweites Stornieren abgelehnt (Oberfläche, Schnittstelle, Datenbank)
- [x] Gutschrift nicht änderbar, löschbar oder stornierbar (auch mit Systemrechten)
- [x] Gleichzeitig: genau eine Gutschrift; zweiter Inhaber erhält „Rechnung wurde inzwischen storniert.“ mit Link
- [x] PDF-Erzeugung scheitert: keine Gutschrift, keine Nummer, keine Datei, Eingaben erhalten; neuer Versuch gelingt

#### Rechte (3/3)
- [x] Mitarbeiter, fremder Inhaber (404), Betreiber (403), ohne Anmeldung (401): abgelehnt; Datenbankfunktion nur für den Server (42501)
- [x] Deaktivierter Kunde: abgelehnt
- [x] Mitarbeiter sieht Gutschrift in Liste, Buchung und Detail samt PDF

#### Allgemein (1/1)
- [x] 375 px, 768 px, 1440 px ohne seitliches Scrollen; Bedienelemente ≥ 44 px; Chrome, Firefox (3 Kernabläufe), Safari (2 Kernabläufe) grün

### Edge Cases Status
- [x] Buchung nach der Rechnung geändert: Gutschrift spiegelt die Rechnung (Fassung)
- [x] Stammdaten und Gast geändert: Aussteller aktuell, Empfänger aus der Rechnung (abgelegtes PDF)
- [x] Rechnung mit 0 oder negativem Betrag: Hinweis, kein Sperren (Unit)
- [x] Gutschrift zählt für die Löschsperre beim Kunden (Herkunft „ausgestellt“); Kaskade beim Löschen des Kunden funktioniert
- [x] Logo, Zeichen ohne Glyph, gekürzte Fußzeile, Aussteller-Block: dieselbe Prüfung wie PROJ-42 (Unit, gemeinsamer Code)
- [x] Nacherfasste Rechnung einer stornierten Schlussrechnung wieder änderbar und löschbar (Integration)
- [x] Am Formular vorbei: Schlussrechnung mit stornierter oder schon gültig abgezogener Teilrechnung lässt sich nicht ausstellen (P0930)
- [ ] Nicht geprüft: Gutschriftsdatum im neuen Jahr (Regel aus PROJ-39/42 unverändert); Logo-Fehler im Browser

### Security Audit Results
- [x] Authentifizierung: ohne Anmeldung 401 (Ausstellen) bzw. 403 (Vorschau)
- [x] Autorisierung: fremder Kunde 404 auf Seite, Vorschau und Schnittstelle; Mitarbeiter und Betreiber 403; Datenbankfunktion nur `service_role`
- [x] Positionen und Betrag kommen aus der Rechnung in der Datenbank; ein manipulierter Betrag wird abgelehnt (P0903)
- [x] Eingaben: ungültiges Datum, zu lange Nummer/Grund, falsche Typen, ungültige Kennung → 400
- [x] XSS im Grund: nur als Text angezeigt
- [x] Unveränderlichkeit in der Datenbank (Trigger), auch mit Systemrechten; direkte Inserts durch Inhaber abgelehnt
- [x] Rate-Limiting: wie PROJ-42 (Begrenzung je Instanz für PDF-Erzeugung)

### Bugs Found

#### BUG-1: Link „Zu Rechnung“ in der Detailansicht der Gutschrift nur durch Farbe erkennbar — behoben
- **Severity:** Medium (WCAG 2.1 AA, 1.4.1; axe „link-in-text-block“)
- **Steps to Reproduce:**
  1. Gutschrift ausstellen, ihre Detailseite am Desktop oder Tablet öffnen
  2. In „Angaben“ steht „Zu Rechnung: 2026-0001 · Di, 20.10.2026“
  3. Expected: Link unterstrichen (wie „Rechnung … vom …“ oben)
  4. Actual: Link ohne Unterstreichung direkt neben Text; axe meldet einen Verstoß (am Handy nicht)
- **Test:** `Layout: Detailseiten …` mit `test.fail` für Desktop/Tablet markiert
- **Priority:** Fix before deployment

#### BUG-2: Verweis auf die Rechnung doppelt auf der Detailseite der Gutschrift — behoben
- **Severity:** Low
- **Steps to Reproduce:** Detailseite der Gutschrift öffnen: oben „Gutschrift zu Rechnung … vom …“ und in „Angaben“ „Zu Rechnung“ mit denselben Angaben
- **Priority:** Nice to have

#### BUG-3: Zweiter Versuch derselben Anfrage meldet „inzwischen storniert“ — behoben
- **Severity:** Low (aus dem Code; nicht im Browser nachgestellt)
- **Steps to Reproduce:**
  1. „Gutschrift ausstellen“, die Antwort geht unterwegs verloren (Netz), der Inhaber versucht es erneut
  2. Expected: Weiterleitung zur eigenen Gutschrift (wie bei Rechnungen in PROJ-42)
  3. Actual: Meldung „Rechnung wurde inzwischen storniert.“ mit Link „Zur Gutschrift“ (Abhilfe vorhanden)
- **Priority:** Nice to have

### Hinweise (keine PROJ-44-Fehler)
- `rls.integration.test.ts` „Person ohne Mitgliedschaft“ rot: bekannte Testreste im Protokoll von Dev
- PROJ-42 „Runde 2: BUG-2 in der Oberfläche“ einmal rot im Paket, einzeln grün (Zeitverhalten der Vorschau)
- Offen vor echter Nutzung: Steuerberater (Bezeichnung „Gutschrift“, Pflichtangaben); PDF-Erzeugung und Ablage auf Vercel (Staging)

### Regression
- PROJ-42 (30 Tests), PROJ-37 (28), PROJ-40 (Knopf, Schluss-/Teilrechnung, BUG-5: 13), PROJ-15 (verrechnete Rechnung): grün
- Integration: invoice-credit, invoice-issue, invoices, invoice-drafts, invoice-settings, operator, bookings grün; Unit 719 grün; Lint und Typen ohne Fehler

### Summary
- **Acceptance Criteria:** 33/33 passed
- **Bugs Found:** 3 total (0 critical, 0 high, 1 medium, 2 low)
- **Security:** Pass
- **Production Ready:** YES (keine Critical/High)
- **Recommendation:** BUG-1 vor dem Deploy beheben (kleiner Eingriff), dann deployen

### Bugfix (2026-11-06, alle drei Befunde)
- **BUG-1 und BUG-2:** Die Zeile „Zu Rechnung“ in „Angaben“ entfällt; der Verweis steht nur noch über den Angaben als unterstrichener Link „Gutschrift zu Rechnung … vom …“ (`issued-detail.tsx`). Layout-Test ohne `test.fail`, grün auf Desktop, Tablet und Handy (axe ohne Verstöße)
- **BUG-3:** Ist die Rechnung schon storniert und stammt die Gutschrift von derselben Person mit derselben Nummer, antwortet die Schnittstelle mit der vorhandenen Gutschrift (`ok`), auch bei gleichzeitigem Doppelversuch (P0934). Ein anderer Inhaber erhält weiter „Rechnung wurde inzwischen storniert.“ (E2E jetzt mit zweitem Inhaber in eigenem Browserkontext)
- **Nachtest:** PROJ-44 E2E komplett grün (Desktop 15, Layout Tablet/Handy), Unit 719, Lint, Typen, Build
- **Status:** bleibt Approved, keine offenen Befunde

## Deployment

- **Datum:** 2026-11-06
- **Commit:** `a2eab65`, Tag `v1.26.0-PROJ-44`
- **Staging:** https://staging.apppa.at; Freigabe des Nutzers „liefere nach prod aus“ (Ready und PDF unter Vercel nicht einzeln bestätigt)
- **Produktion:** https://app.apppa.at, vom Nutzer als „Ready“ gemeldet
- **Migrationen** in Staging und Produktion, in dieser Reihenfolge: `20261106082931_invoice_credit_notes.sql`, `20261106083354_invoice_credit_notes_history.sql`. `db advisors`: nur der bekannte Auth-Hinweis
- **Vorprüfung:** Lint, Unit 719, Integration 273/274 (rot nur der bekannte RLS-Test wegen Testresten im Dev-Protokoll), Build, Secret-Scan
- **Mit ausgeliefert:** Skill `/clean-dev` und Runbook-Eintrag (nur Werkzeuge/Doku, keine App-Änderung)
- **Offen vor echter Nutzung:** Steuerberater (Bezeichnung „Gutschrift“, Pflichtangaben)
