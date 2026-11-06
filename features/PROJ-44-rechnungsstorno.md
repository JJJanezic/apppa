# PROJ-44: Rechnungsstorno (Gutschrift zu Rechnung)

## Status: Planned
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

## Open Questions
- [ ] Steuerberater: Bezeichnung „Gutschrift“ für den Stornobeleg und Pflichtangaben darauf (Verweis auf Nummer und Datum der Rechnung) bestätigen
- [ ] Soll die Gutschrift in PROJ-45 automatisch als „Rückzahlung offen“ erscheinen, wenn die Rechnung schon bezahlt war? (Klärung in PROJ-45)

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
| _(von /architecture)_ | | |
