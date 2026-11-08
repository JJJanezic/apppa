# PROJ-16: Ortstaxen-Berichte

## Status: In Progress
**Created:** 2026-11-08
**Last Updated:** 2026-11-08

## Dependencies
- Requires: PROJ-1 (Supabase-Infrastruktur): Mandantentrennung (RLS)
- Requires: PROJ-4 (Kundenkonten & Rollen): Inhaber/Mitarbeiter, gewählter Kunde
- Requires: PROJ-6 (Wohnungsverwaltung): Objekt mit Gemeinde, archivierte Wohnungen
- Requires: PROJ-7 (Gäste-Datenbank): Hauptgast, Anonymisieren
- Requires: PROJ-8, PROJ-30 (Buchungen): Arten Buchung/Option/Sperre, Storno, tatsächliche Abreise, Erwachsene/Kinder
- Requires: PROJ-14 (Dashboard): Monatszuordnung der Ortstaxe (ganze Personennächte über die vereinnahmten Nächte, Funktion `tourist_tax_monthly`); Kennzeichnung der Alt-Positionen
- Requires: PROJ-15 (Ortstaxe je Wohnung): Abgabe-Positionen mit Ortstaxe-Kennzeichen, Tarif-Verweis, abgabepflichtige Personennächte, Befreiungen
- Requires: PROJ-41 (Briefpapier): Logo und Aussteller-Block für das PDF

## Überblick
Der bisher gesperrte Menüpunkt **„Ortstaxe“** (`/ortstaxe`, nur Inhaber) wird freigeschaltet. Er zeigt für den gewählten Kunden und einen frei wählbaren Zeitraum (Jahr, von–bis Monat) die Ortstaxe **je Gemeinde**: abgabepflichtige und befreite Personennächte sowie den Betrag. Darunter steht die Liste der eingerechneten Buchungen. Der Bericht lässt sich als **PDF** (mit Briefpapier, Beilage zur Meldung an die Gemeinde) und als **CSV** (für Excel) exportieren. Die Zahlen stimmen mit dem Dashboard-Abschnitt „Ortstaxe“ (PROJ-14) überein.

## Seite „Ortstaxe“

### Zugriff
- Nur **Inhaber** des gewählten Kunden. Der Bericht gilt immer für den **aktuell gewählten Kunden** (wie Rechnungen und Zahlungen).
- Mitarbeiter sehen den Menüpunkt nicht. Ein direkter Aufruf der Adresse oder der Exporte liefert keine Daten (Hinweis „Kein Zugriff“ wie auf anderen Inhaber-Seiten), auch serverseitig geprüft.
- Der Menüpunkt „Ortstaxe“ ist nicht mehr als „bald verfügbar“ gekennzeichnet.

### Zeitraum und Filter (oben)
- **Jahr:** Auswahl. Standard ist das Jahr des letzten abgelaufenen Monats.
- **Von Monat / Bis Monat:** innerhalb des gewählten Jahres. „Bis“ darf nicht vor „Von“ liegen.
- **Schnellwahl:** „Letzter Monat“, „Letztes Quartal“, „Letztes Jahr“, jeweils der letzte **ganz abgelaufene** Zeitraum. Beispiel am 08.11.2026: Oktober 2026; Juli–September 2026; Jänner–Dezember 2025. Die Schnellwahl stellt Jahr, Von und Bis ein.
- **Standard beim Öffnen:** letzter abgelaufener Monat.
- **Gemeinde:** „Alle Gemeinden“ (Standard) oder eine einzelne Gemeinde. Angeboten werden die Gemeinden, die im gewählten Zeitraum Ortstaxe haben. Der Filter wirkt auf Bildschirm, PDF und CSV gleichermaßen.
- Reicht der Zeitraum in den laufenden Monat oder in die Zukunft, erscheint der Hinweis **„Zeitraum noch nicht abgeschlossen – Werte können sich noch ändern.“** Die Auswahl ist trotzdem erlaubt.
- Zeitraum und Gemeinde stehen in der Adresse: Neu laden, Lesezeichen und „Zurück“ zeigen denselben Bericht. Ungültige Werte in der Adresse (z. B. Monat 13, Bis vor Von) führen auf den Standard zurück.

### Übersicht je Gemeinde
| Gemeinde | Abgabepflichtige Personennächte | Befreite Personennächte | Betrag |
|---|---|---|---|
| Saalbach | 412 | 38 | € 1.030,00 |
| Zell am See | 96 | 4 | € 240,00 |
| **Gesamt** | **508** | **42** | **€ 1.270,00** |

- Je Gemeinde eine Zeile, alphabetisch. Die Zeile „Gesamt“ erscheint nur bei mehr als einer Gemeinde.
- Eine Gemeinde erscheint, wenn sie im Zeitraum Ortstaxe hat.
- Fehlen bei Alt-Positionen oder Prozent-Tarifen die Personennächte (siehe Zählregeln), zählen in den Summen nur die bekannten Werte. Unter der Zeile steht dann der Hinweis „inkl. N Positionen ohne Personennächte“.
- Darüber steht der Zeitraum in Worten, z. B. „Oktober 2026“, „Juli – September 2026“ oder „2025“ (bei Jänner–Dezember).

### Buchungsliste
- **Je Gemeinde gruppiert** (Zwischenüberschrift mit dem Gemeindenamen). Innerhalb der Gruppe wird nach **Anreise** sortiert, bei gleicher Anreise nach Buchungsnummer.
- **Eine Zeile je Buchung.** Hat eine Buchung mehrere Abgabe-Positionen (z. B. Tarifwechsel im Aufenthalt), werden sie in der Zeile zusammengezählt.
- **Spalten:**
  - Nr. (auf dem Bildschirm ein Link zur Buchung)
  - Hauptgast (Nachname Vorname; anonymisierte Gäste als „Anonymisiert“)
  - Wohnung
  - Aufenthalt (Anreise – tatsächliche Abreise)
  - Personen (Erwachsene + Kinder)
  - Abgabepflichtige Personennächte im Zeitraum
  - Befreite Personennächte im Zeitraum
  - Betrag im Zeitraum
- Ragt der Aufenthalt über den Zeitraum hinaus, zählen nur die Nächte im Zeitraum. Die Zeile bekommt den Hinweis **„anteilig“**.
- Zeilen mit Alt-Positionen ohne bekannte Personennächte bekommen den Hinweis **„Alt-Position“**. Bei Prozent-Tarifen lautet der Hinweis **„Prozent-Tarif“**.
- Am Handy darf die Liste seitlich scrollen. Die Spalte „Nr.“ bleibt dabei stehen.

### Leerer Zustand
- Keine Ortstaxe im gewählten Zeitraum: **„Im gewählten Zeitraum keine Ortstaxe erfasst.“** Die Exporte sind deaktiviert.
- Hat der Kunde noch nie Ortstaxe-Tarife hinterlegt, folgt zusätzlich: „Tarife hinterlegen Sie je Wohnung unter Einstellungen → Wohnungen.“ mit Link.

## Zählregeln (wie im Dashboard, PROJ-14)
- **Was zählt:** Positionen mit Ortstaxe-Kennzeichen (PROJ-15), automatisch berechnet oder von Hand geändert, in **Buchungen**. Optionen, Sperren und stornierte Buchungen zählen nicht. Archivierte Wohnungen zählen mit.
- **Gemeinde:** aktuelle Gemeinde des Objekts der Wohnung.
- **Zuordnung zum Zeitraum:** dieselbe Verteilung wie im Dashboard (ganze Personennächte über die vereinnahmten Nächte, sonst anteilig in Cent). Der Bericht für einen Monat zeigt denselben Betrag wie das Dashboard für diesen Monat, und Quartale bzw. Jahre sind die Summe ihrer Monate.
- **Abgabepflichtige Personennächte:** bei automatisch berechneten Positionen die gespeicherte Zahl (PROJ-15), auf die Nächte im Zeitraum verteilt wie der Betrag.
- **Befreite Personennächte:** Personen (Erwachsene + Kinder) × Nächte im Zeitraum, minus abgabepflichtige Personennächte im Zeitraum. Das sind Befreiungen nach Alter und persönliche Befreiungen zusammen.
- **Alt-Positionen** (vor PROJ-15 von Hand angelegt, per Migration als Ortstaxe gekennzeichnet):
  - Ist der Betrag ein Vielfaches des Tarifs je Person und Nacht, gilt Betrag ÷ Tarif als abgabepflichtige Personennächte.
  - Sonst sind die abgabepflichtigen Personennächte unbekannt („–“).
  - Befreite Personennächte sind bei Alt-Positionen immer unbekannt („–“).
- **Prozent-Tarife:** Für sie speichert PROJ-15 keine Personennächte. Beide Spalten zeigen „–“, der Betrag zählt normal.

## Exporte
Beide Knöpfe stehen oben rechts neben dem Filter: **„PDF“** und **„CSV“**. Sie verwenden immer den eingestellten Zeitraum und die eingestellte Gemeinde.

### PDF
- Briefkopf aus dem Briefpapier (PROJ-41): Logo, Aussteller-Block (sofern eingeschaltet), Grundschrift.
- Titel „Ortstaxe“, Zeitraum in Worten, Gemeinde (oder „Alle Gemeinden“), Kunde mit Anschrift.
- **Einzelne Gemeinde:** Übersicht dieser Gemeinde und ihre Buchungsliste. Das ist die Beilage für genau diese Gemeinde.
- **Alle Gemeinden:** zuerst die Gesamtübersicht, danach jede Gemeinde auf einer neuen Seite mit ihrer Übersichtszeile und Buchungsliste.
- In der Fußzeile jeder Seite **„Stand: Mo, 08.11.2026, 14:32“** und „Seite X von Y“.
- Der Hinweis „Zeitraum noch nicht abgeschlossen“ steht auch im PDF, wenn er auf dem Bildschirm steht.
- Hochformat A4. Lange Listen brechen auf Folgeseiten um, der Tabellenkopf wird wiederholt.
- Dateiname: `Ortstaxe_<Zeitraum>_<Gemeinde oder Alle>.pdf`, z. B. `Ortstaxe_2026-10_Saalbach.pdf`, `Ortstaxe_2026-07-bis-09_Alle.pdf`.
- Das PDF wird bei jedem Aufruf neu erzeugt und nicht gespeichert.

### CSV
- Eine Zeile je Buchung und Gemeinde, mit der Gemeinde als erster Spalte. Danach folgen die Spalten der Buchungsliste und der Hinweis („anteilig“, „Alt-Position“, „Prozent-Tarif“).
- Keine Summenzeilen. Summen bildet man in Excel.
- Strichpunkt als Trennzeichen, Komma bei Dezimalzahlen, Beträge ohne „€“ mit zwei Nachkommastellen (z. B. `1030,00`), Datum `TT.MM.JJJJ`, UTF-8 mit BOM (Umlaute in Excel korrekt).
- Unbekannte Personennächte bleiben leer.
- Erste Zeile: Spaltenüberschriften. Am Dateiende steht keine Stand-Zeile, der Zeitpunkt steht im Dateinamen: `Ortstaxe_<Zeitraum>_<Gemeinde oder Alle>_Stand-2026-11-08.csv`.

## Dashboard
- Im Dashboard-Abschnitt „Ortstaxe“ (PROJ-14) gibt es **keinen** Knopf „Meldung vorbereiten“. Der Abschnitt bleibt unverändert.

## User Stories
- Als **Inhaber** möchte ich die Ortstaxe eines abgelaufenen Monats je Gemeinde mit Personennächten und Betrag sehen, damit ich die Meldung an die Gemeinde ohne Nachrechnen ausfüllen kann.
- Als **Inhaber** möchte ich per Schnellwahl den letzten Monat, das letzte Quartal oder das letzte Jahr wählen, weil meine Gemeinden in unterschiedlichen Abständen abrechnen.
- Als **Inhaber** möchte ich die Buchungen sehen, aus denen sich die Summe ergibt, damit ich jede Zahl gegenüber der Gemeinde belegen kann.
- Als **Inhaber** möchte ich ein PDF nur für eine Gemeinde mit meinem Briefkopf, damit ich es dieser Gemeinde als Beilage schicken und selbst ablegen kann.
- Als **Inhaber** möchte ich eine CSV-Datei, damit ich in Excel filtern und nachrechnen kann.
- Als **Inhaber** möchte ich, dass Bericht und Dashboard dieselben Zahlen zeigen, damit ich mich auf beide verlassen kann.
- Als **Mitarbeiter** soll ich den Bericht nicht sehen, weil Mitarbeiter keine Preise und Abgabebeträge sehen.

## Out of Scope
- Knopf „Meldung vorbereiten“ im Dashboard → entfällt (Nutzerentscheidung)
- Meldung als „abgegeben“ festschreiben, gespeicherte PDFs, Hinweis auf Änderungen nach der Meldung → späteres eigenes Feature
- Exportformate einzelner Gemeinde- oder Tourismusverband-Portale → nicht geplant, je Gemeinde verschieden
- Direkte Übermittlung an die Gemeinde (E-Mail, Schnittstelle) → nicht geplant; E-Mail-Versand allgemein PROJ-22
- Bericht über mehrere Kunden auf einmal → jeder Kunde meldet selbst; Kunde wechseln wie überall
- Zeitraum über einen Jahreswechsel (z. B. Nov 2025 – Feb 2026) → nur innerhalb eines Jahres
- Abgabe-Zustand von Buchungen „noch nicht berechnet“ nachträglich berechnen → bleibt bei PROJ-15 (Buchung öffnen und neu berechnen)
- Gesetzliches Gästeblatt und Meldewesen → PROJ-26
- Auswertungen zu Auslastung, Umsatz und Herkunft → PROJ-18
- Eigene Felder für befreite Personennächte je Grund (Alter, persönlich) getrennt ausweisen → nicht in dieser Version
- Historische Gemeinde einer Wohnung (Objekt hat die Gemeinde gewechselt) → aktuelle Gemeinde wie im Dashboard

## Acceptance Criteria

### Zugriff
- [ ] Angenommen ein Inhaber, wenn er das Menü öffnet, dann ist „Ortstaxe“ wählbar und führt zu `/ortstaxe`
- [ ] Angenommen ein Mitarbeiter, wenn er das Menü öffnet, dann gibt es keinen Menüpunkt „Ortstaxe“
- [ ] Angenommen ein Mitarbeiter, wenn er `/ortstaxe` oder einen Export direkt aufruft, dann erhält er keine Daten und sieht den Hinweis „Kein Zugriff“
- [ ] Angenommen die Person ist Inhaberin bei A und Mitarbeiterin bei B und hat B gewählt, wenn sie `/ortstaxe` aufruft, dann erhält sie keine Daten von B
- [ ] Angenommen Kunde A gewählt, wenn der Bericht erscheint, dann enthält er nur Buchungen von Kunde A

### Zeitraum und Filter
- [ ] Angenommen heute ist der 08.11.2026, wenn der Inhaber `/ortstaxe` ohne Angaben öffnet, dann zeigt der Bericht Oktober 2026 und „Alle Gemeinden“
- [ ] Angenommen heute ist der 08.11.2026, wenn er „Letztes Quartal“ wählt, dann ist Juli bis September 2026 eingestellt
- [ ] Angenommen heute ist der 08.11.2026, wenn er „Letztes Jahr“ wählt, dann ist Jänner bis Dezember 2025 eingestellt und der Zeitraum heißt „2025“
- [ ] Angenommen heute ist der 15.01.2027, wenn er „Letzter Monat“ wählt, dann ist Dezember 2026 eingestellt
- [ ] Angenommen der Inhaber wählt November 2026 (laufender Monat), wenn der Bericht erscheint, dann steht der Hinweis „Zeitraum noch nicht abgeschlossen – Werte können sich noch ändern.“
- [ ] Angenommen ein abgelaufener Zeitraum, wenn der Bericht erscheint, dann gibt es diesen Hinweis nicht
- [ ] Angenommen der Inhaber hat März bis Mai 2026 und Gemeinde Saalbach gewählt, wenn er die Seite neu lädt, dann ist derselbe Bericht eingestellt
- [ ] Angenommen eine Adresse mit Monat 13 oder „bis“ vor „von“, wenn sie aufgerufen wird, dann erscheint der Standard (letzter abgelaufener Monat)
- [ ] Angenommen der Inhaber wählt „Von“ Mai, wenn er „Bis“ auswählen will, dann sind Monate vor Mai nicht wählbar
- [ ] Angenommen Gemeinde Saalbach gewählt, wenn der Bericht erscheint, dann zeigen Übersicht und Buchungsliste nur Saalbach

### Übersicht
- [ ] Angenommen Wohnungen in zwei Gemeinden mit Ortstaxe im Zeitraum, wenn der Bericht erscheint, dann gibt es je Gemeinde eine Zeile (alphabetisch) und eine Zeile „Gesamt“
- [ ] Angenommen nur eine Gemeinde, wenn der Bericht erscheint, dann gibt es keine Zeile „Gesamt“
- [ ] Angenommen der Dashboard-Abschnitt „Ortstaxe“ zeigt für „Okt 2026“ bei Saalbach € 290,00, wenn der Bericht für Oktober 2026 erscheint, dann zeigt er bei Saalbach ebenfalls € 290,00
- [ ] Angenommen der Bericht für Juli bis September 2026, wenn er erscheint, dann ist der Betrag je Gemeinde die Summe der Monatsberichte Juli, August und September
- [ ] Angenommen eine Buchung mit 2 Erwachsenen und 1 Kind unter der Altersbefreiung, 3 Nächte im Oktober, automatisch berechnet, wenn der Bericht für Oktober erscheint, dann zählt sie 6 abgabepflichtige und 3 befreite Personennächte
- [ ] Angenommen ein Erwachsener mit Häkchen „Von der Ortstaxe befreit“, wenn der Bericht erscheint, dann zählen seine Nächte zu den befreiten Personennächten
- [ ] Angenommen eine Alt-Position, deren Betrag kein Vielfaches des Tarifs ist, wenn der Bericht erscheint, dann zählen in der Übersicht nur die bekannten Personennächte und darunter steht „inkl. 1 Position ohne Personennächte“ (bei mehreren „inkl. N Positionen …“)

### Buchungsliste
- [ ] Angenommen drei Buchungen in Saalbach, wenn der Bericht erscheint, dann stehen sie unter der Zwischenüberschrift „Saalbach“ nach Anreise sortiert
- [ ] Angenommen zwei Buchungen mit gleicher Anreise, wenn der Bericht erscheint, dann steht die mit der kleineren Buchungsnummer zuerst
- [ ] Angenommen eine Buchung vom 30.09. bis 03.10.2026 mit 2 Personen, wenn der Bericht für Oktober erscheint, dann zeigt die Zeile 4 abgabepflichtige Personennächte, den Oktober-Anteil des Betrags und den Hinweis „anteilig“
- [ ] Angenommen eine Buchung mit zwei Abgabe-Positionen (Tarifwechsel im Aufenthalt), wenn der Bericht erscheint, dann gibt es eine Zeile mit den zusammengezählten Werten
- [ ] Angenommen eine Buchung mit früherer tatsächlicher Abreise, wenn der Bericht erscheint, dann zeigt „Aufenthalt“ die tatsächliche Abreise
- [ ] Angenommen ein anonymisierter Hauptgast, wenn der Bericht erscheint, dann steht „Anonymisiert“ und die Zahlen bleiben erhalten
- [ ] Angenommen ein Klick auf die Buchungsnummer, wenn er erfolgt, dann öffnet sich das Buchungsdetail
- [ ] Angenommen eine Alt-Position ohne bekannte Personennächte, wenn der Bericht erscheint, dann zeigen beide Personennächte-Spalten „–“ und die Zeile den Hinweis „Alt-Position“
- [ ] Angenommen eine Position nach Prozent-Tarif, wenn der Bericht erscheint, dann zeigen beide Personennächte-Spalten „–“, die Zeile den Hinweis „Prozent-Tarif“ und der Betrag zählt mit
- [ ] Angenommen eine Option, eine Sperre und eine stornierte Buchung mit Ortstaxe-Positionen, wenn der Bericht erscheint, dann zählt keine davon
- [ ] Angenommen eine von Hand angelegte Position ohne Ortstaxe-Kennzeichen, wenn der Bericht erscheint, dann zählt sie nicht
- [ ] Angenommen eine archivierte Wohnung mit Ortstaxe im Zeitraum, wenn der Bericht erscheint, dann zählt sie bei ihrer Gemeinde
- [ ] Angenommen ein Handy (375 px), wenn der Bericht erscheint, dann scrollt nur die Liste seitlich, die Spalte „Nr.“ bleibt stehen und die Seite scrollt nicht seitlich

### Leerer Zustand
- [ ] Angenommen keine Ortstaxe im gewählten Zeitraum, wenn der Bericht erscheint, dann steht „Im gewählten Zeitraum keine Ortstaxe erfasst.“ und die Knöpfe „PDF“ und „CSV“ sind deaktiviert
- [ ] Angenommen der Kunde hat noch keine Ortstaxe-Tarife, wenn der Bericht erscheint, dann steht zusätzlich der Hinweis mit Link zu Einstellungen → Wohnungen

### PDF
- [ ] Angenommen Gemeinde Saalbach und Oktober 2026, wenn der Inhaber „PDF“ wählt, dann erhält er `Ortstaxe_2026-10_Saalbach.pdf` mit Briefkopf, Titel, Zeitraum, Gemeinde, Übersicht und Buchungsliste nur von Saalbach
- [ ] Angenommen „Alle Gemeinden“ mit zwei Gemeinden, wenn er „PDF“ wählt, dann steht vorn die Gesamtübersicht und jede Gemeinde beginnt auf einer neuen Seite
- [ ] Angenommen ein PDF, wenn es erzeugt wird, dann steht auf jeder Seite „Stand: [Wochentag, Datum, Uhrzeit]“ und „Seite X von Y“
- [ ] Angenommen eine Buchungsliste über mehrere Seiten, wenn das PDF erzeugt wird, dann wiederholt sich der Tabellenkopf auf jeder Folgeseite
- [ ] Angenommen im Briefpapier ist der Aussteller-Block abgeschaltet, wenn das PDF erzeugt wird, dann fehlt er auch hier
- [ ] Angenommen ein laufender Zeitraum, wenn das PDF erzeugt wird, dann enthält es den Hinweis „Zeitraum noch nicht abgeschlossen“
- [ ] Angenommen der Bericht auf dem Bildschirm, wenn das PDF erzeugt wird, dann stimmen alle Zahlen überein

### CSV
- [ ] Angenommen Oktober 2026 und „Alle Gemeinden“, wenn der Inhaber „CSV“ wählt, dann erhält er `Ortstaxe_2026-10_Alle_Stand-[Datum].csv` mit Überschriftszeile und einer Zeile je Buchung, die Gemeinde in der ersten Spalte
- [ ] Angenommen die CSV wird in Excel (deutsch) geöffnet, wenn sie angezeigt wird, dann stehen die Werte in getrennten Spalten, Umlaute sind korrekt und Beträge wie `1030,00` sind Zahlen
- [ ] Angenommen eine Alt-Position ohne bekannte Personennächte, wenn die CSV erzeugt wird, dann sind beide Personennächte-Felder leer und der Hinweis lautet „Alt-Position“
- [ ] Angenommen die CSV, wenn sie erzeugt wird, dann enthält sie keine Summenzeilen
- [ ] Angenommen ein Gastname mit Strichpunkt oder Anführungszeichen, wenn die CSV erzeugt wird, dann bleibt die Spaltenaufteilung korrekt
- [ ] Angenommen ein Gastname, der mit `=`, `+`, `-` oder `@` beginnt, wenn die CSV erzeugt wird, dann wird er in Excel nicht als Formel ausgeführt

### Dashboard
- [ ] Angenommen PROJ-16 ist live, wenn der Dashboard-Abschnitt „Ortstaxe“ erscheint, dann gibt es dort keinen Knopf „Meldung vorbereiten“

## Edge Cases
- **Buchung ändert sich nach dem Export** (z. B. frühere Abreise): Der Bericht rechnet immer aus den aktuellen Daten. Das frühere PDF zeigt seinen Stand in der Fußzeile.
- **Buchung mit Abgabe-Zustand „noch nicht berechnet“ ohne Ortstaxe-Position:** zählt nicht, wie im Dashboard.
- **Aufenthalt über den Jahreswechsel** (30.12.2025 – 03.01.2026): Im Bericht 2025 zählen 2 Nächte, im Bericht Jänner 2026 2 Nächte, beide mit „anteilig“.
- **Ortstaxe-Position ohne Nächte** (Abreise = Anreise nach Korrektur): zählt im Monat der Anreise wie im Dashboard. Die Personennächte sind 0, befreite Personennächte 0.
- **Abgabepflichtige Personennächte größer als Personen × Nächte** (Personenzahl nachträglich verringert, Abgabe von Hand stehen gelassen): Befreite Personennächte werden nicht negativ, sondern 0.
- **Wohnung wechselt das Objekt bzw. Objekt die Gemeinde:** zählt zur aktuellen Gemeinde, wie im Dashboard.
- **Gemeinde im Filter hat im neu gewählten Zeitraum keine Ortstaxe:** Der Filter springt auf „Alle Gemeinden“ zurück.
- **Sehr viele Buchungen** (z. B. ganzes Jahr, mehrere Hundert Buchungen): Die Liste wird vollständig angezeigt, ohne Seitenumbruch auf dem Bildschirm. Das PDF bricht auf Folgeseiten um.
- **Kunde wechselt, während der Bericht offen ist:** Nach dem Kundenwechsel erscheint der Bericht des neuen Kunden mit Standard-Zeitraum, sofern die Person dort Inhaber ist.
- **Export-Erzeugung scheitert** (z. B. Netzwerk): Es erscheint die Meldung „Export konnte nicht erstellt werden. Bitte erneut versuchen.“ Der Bericht bleibt sichtbar.
- **Kein Logo hinterlegt:** Das PDF erscheint ohne Logo, wie die Rechnung.

## Technical Requirements
- Mandantentrennung und Inhaber-Recht auf Datenbankebene, auch für die Exporte
- Gleiche Verteilregel wie das Dashboard (eine Regel an einer Stelle). Bericht und Dashboard dürfen nicht auseinanderlaufen
- Bericht für ein ganzes Jahr bei 5.000 Buchungen in unter 2 Sekunden, PDF in unter 5 Sekunden
- CSV-Export gegen Formel-Einschleusung geschützt
- Deutsch, österreichische Datums- und Betragsformate (PROJ-31)
- Responsiv (Handy 375 px ohne seitliches Scrollen der Seite)

## Open Questions
- [ ] Buchungen, bei denen gar keine Ortstaxe anfällt (z. B. „Wohnsitz angemeldet“ oder alle Personen befreit), haben eventuell keine Abgabe-Position und fehlen dann im Bericht samt ihren befreiten Personennächten. Klären, ob Gemeinden solche Nächtigungen als „befreit“ gemeldet haben wollen (dann Erweiterung über die Buchungen statt über die Positionen)
- [ ] Verlangt eine Gemeinde die Meldung nach Abreise- oder Anreisemonat statt nach Nächten (aus PROJ-14 übernommen)? Dann wäre eine Ausnahme je Gemeinde nötig
- [ ] Reicht die Regel für Alt-Positionen in der Praxis, oder sollen Alt-Positionen nachträglich mit Personennächten ergänzt werden können? („wir machen das jetzt einmal so“)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Übersicht je Gemeinde mit abgabepflichtigen und befreiten Personennächten und Betrag, darunter die Buchungsliste | Gemeindeformulare verlangen meist Nächtigungen, nicht nur den Betrag; die Liste belegt jede Zahl | 2026-11-08 |
| Anzeige auf dem Bildschirm sowie Export als PDF und CSV | Nutzerentscheidung; PDF als Beilage und Ablage, CSV zum Nachrechnen in Excel | 2026-11-08 |
| PDF mit Briefpapier (PROJ-41) | Einheitliches Erscheinungsbild mit den Rechnungen, kein zweites Gestaltungsmodell | 2026-11-08 |
| Kein Format einzelner Gemeindeportale | Je Gemeinde verschieden; CSV deckt die Weiterverarbeitung ab | 2026-11-08 |
| Befreite Personennächte = Personen × Nächte − abgabepflichtige Personennächte | Kein eigenes Feld vorhanden; aus den vorhandenen Daten ableitbar | 2026-11-08 |
| Alt-Positionen: Betrag ÷ Tarif, wenn ganzzahlig, sonst „–“; befreite Nächte immer „–“; Summen nur aus bekannten Werten mit Hinweis | Nutzerentscheidung („einmal so“); keine erfundenen Zahlen | 2026-11-08 |
| Zeitraum: Jahr + von/bis Monat, Schnellwahl letzter Monat/Quartal/Jahr, Standard letzter abgelaufener Monat | Gemeinden melden monatlich, quartalsweise oder jährlich | 2026-11-08 |
| Laufende/künftige Zeiträume wählbar, mit Hinweis | Vorschau auf die laufende Meldung ohne Fehlinterpretation | 2026-11-08 |
| Zeitraum und Gemeinde in der Adresse | Neu laden, Lesezeichen und „Zurück“ funktionieren | 2026-11-08 |
| Kein Knopf „Meldung vorbereiten“ im Dashboard | Nutzerentscheidung: ergibt keinen Sinn, der Menüpunkt genügt | 2026-11-08 |
| Nur Inhaber, nur gewählter Kunde | Mitarbeiter sehen keine Abgabebeträge (PROJ-15); jeder Kunde meldet selbst | 2026-11-08 |
| Gemeindefilter für Bildschirm, PDF und CSV gemeinsam; PDF „Alle“ mit einer Seite je Gemeinde | PDF je Gemeinde als Beilage; alle drei Ansichten stimmen überein | 2026-11-08 |
| Nichts festschreiben; „Stand“ mit Datum und Uhrzeit auf PDF und im CSV-Dateinamen | Einfach für die erste Version; Meldeprotokoll ist ein späteres Feature | 2026-11-08 |
| Liste je Gemeinde nach Anreise, eine Zeile je Buchung, Hinweis „anteilig“ | Gut nachvollziehbar; Teil-Aufenthalte im Zeitraum sichtbar | 2026-11-08 |
| Gleiche Zählregeln wie im Dashboard (nur Buchungen, Kennzeichen, archivierte Wohnungen, aktuelle Gemeinde) | Bericht und Dashboard zeigen gleiche Zahlen | 2026-11-08 |
| Zeitraum nur innerhalb eines Jahres | Meldezeiträume der Gemeinden liegen im Kalenderjahr; einfachere Auswahl | 2026-11-08 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Gemeinsamer Rechenkern in der Datenbank: Verteilung je Position und Monat inkl. Personennächte; `tourist_tax_monthly` (Dashboard) und die neue Berichtsfunktion bauen beide darauf auf | Eine Regel an einer Stelle; Bericht und Dashboard können nicht auseinanderlaufen; Dashboard-Ergebnis bleibt unverändert (Test vergleicht) | 2026-11-08 |
| Neue Berichtsfunktion liefert je Buchung und Gemeinde die Summen im Zeitraum samt Kennzeichen „anteilig“, „Alt-Position“, „Prozent-Tarif“; nur Inhaber-Kunden | Nur fertige Zeilen statt aller Positionen übertragen; Inhaber-Prüfung wie bei PROJ-14 in der Datenbank | 2026-11-08 |
| Personennächte je Monat aus der Verteilung (Betrag ÷ Tarif), nicht aus dem gespeicherten Feld der Position | So rechnet das Dashboard schon; gilt für automatische und Alt-Positionen gleich und passt immer zum Monatsbetrag | 2026-11-08 |
| Befreite Personennächte nur, wenn alle Positionen der Buchung bekannte Personennächte haben; nie unter 0 | Keine erfundenen Zahlen bei Alt-Positionen und Prozent-Tarifen | 2026-11-08 |
| Keine neue Tabelle, keine Spalte | Bericht wird immer aus den aktuellen Daten berechnet (kein Festschreiben) | 2026-11-08 |
| Bericht als Server-Seite, Filter in der Adresse | Wie Rechnungen/Zahlungen; Neu laden, Lesezeichen, „Zurück“ | 2026-11-08 |
| Zeitraum, Schnellwahl, Gruppierung, Summen, Hinweise und CSV-Aufbau als reine Regeln mit Unit-Tests | Gut testbar ohne Datenbank, von Seite, PDF und CSV gemeinsam genutzt | 2026-11-08 |
| PDF über den bestehenden PDF-Arbeitsprozess der Rechnungen (React-PDF), erweitert um eine zweite Dokumentart „Bericht“ | Gleiche Schriften, Briefpapier, Logo und Lastgrenze; kein zweites PDF-Werkzeug | 2026-11-08 |
| CSV auf dem Server erzeugt, Strichpunkt, Komma, UTF-8 mit BOM; Felder mit `= + - @` am Anfang mit vorangestelltem Hochkomma | Excel (deutsch) öffnet sie direkt; Schutz vor Formel-Einschleusung | 2026-11-08 |
| Exporte als eigene Download-Adressen; Knopf lädt im Hintergrund und speichert die Datei, bei Fehler Meldung auf der Seite | Fehlermeldung statt leerer Fehlerseite; Bericht bleibt sichtbar | 2026-11-08 |
| Keine neuen Pakete | React-PDF und alles Weitere ist vorhanden | 2026-11-08 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-16 braucht **keine neuen Tabellen**. Der Bericht wird bei jedem Aufruf aus den bestehenden Buchungen und Abgabe-Positionen berechnet. Gebaut werden:
1. eine Berichtsfunktion in der Datenbank, die denselben Rechenkern wie das Dashboard nutzt,
2. die Seite „Ortstaxe“ mit Filter, Übersicht und Buchungsliste,
3. zwei Download-Adressen für PDF und CSV.

### A) Seitenaufbau

```
Seite „Ortstaxe“ (/ortstaxe, nur Inhaber)
+-- Seitenkopf „Ortstaxe“ mit Kundenname
|   +-- rechts: Knöpfe „PDF“ und „CSV“ (deaktiviert ohne Daten)
+-- Filterleiste
|   +-- Jahr, Von Monat, Bis Monat
|   +-- Schnellwahl: Letzter Monat | Letztes Quartal | Letztes Jahr
|   +-- Gemeinde: Alle Gemeinden | einzelne Gemeinde
+-- Hinweis „Zeitraum noch nicht abgeschlossen …“ (nur bei laufendem/künftigem Zeitraum)
+-- Übersicht (Karte)
|   +-- Zeitraum in Worten
|   +-- Tabelle: Gemeinde | Abgabepflichtige PN | Befreite PN | Betrag
|   +-- Zeile „Gesamt“ (nur bei mehreren Gemeinden)
|   +-- Hinweis „inkl. N Positionen ohne Personennächte“
+-- Buchungsliste (Karte)
|   +-- je Gemeinde: Zwischenüberschrift
|       +-- Zeilen: Nr. (Link) | Hauptgast | Wohnung | Aufenthalt | Personen | PN | befreit | Betrag | Hinweis
+-- Leerer Zustand „Im gewählten Zeitraum keine Ortstaxe erfasst.“ (+ Tarif-Hinweis mit Link)
+-- Meldung „Export konnte nicht erstellt werden …“ (nur nach fehlgeschlagenem Export)
```

- Die Seite wird auf dem Server erzeugt. Nur die Filterleiste und die Export-Knöpfe laufen im Browser.
- Die Filter ändern die Adresse (Jahr, Von, Bis, Gemeinde). Die Seite lädt dann neu, wie bei Rechnungen und Zahlungen.
- Gestaltung nach dem App-Entwurf (`docs/design/app-entwurf-quelltext.html`): Karten, Tabellen und Beträge wie in der Rechnungs- und Zahlungsübersicht. Beträge stehen rechtsbündig in Ziffern gleicher Breite.
- Am Handy scrollt die Buchungsliste in einem eigenen Bereich seitlich (mit Tastaturfokus wie die Dashboard-Tabelle, PROJ-14 BUG-2). Die Spalte „Nr.“ bleibt stehen.
- Die Zeilen sind keine Overlay-Links. Nur die Nummer ist ein Link (Safari-Zeilenklick, PROJ-29).
- Menüpunkt „Ortstaxe“ wird freigeschaltet (bisher „bald verfügbar“). Er bleibt nur für Inhaber sichtbar.

### B) Daten

**Neu gespeichert:** nichts.

**Gelesen:**
- Buchungen: Nummer, Art, Storno, Anreise, tatsächliche und geplante Abreise, Erwachsene, Kinder, Hauptgast, Wohnung
- Abgabe-Positionen: Kennzeichen „Ortstaxe“, Betrag, Tarif-Verweis
- Tarife der Wohnung: Art (je Person und Nacht oder Prozent), Betrag, „gültig ab“
- Wohnung → Objekt → Gemeinde (auch archivierte Wohnungen)
- Gast: Name, anonymisiert ja/nein
- Briefpapier, Logo und Stammdaten des Kunden (nur für das PDF)

**Gemeinsamer Rechenkern (Datenbank):** Die Verteilung aus PROJ-14 wird aus `tourist_tax_monthly` herausgelöst. Für jede Abgabe-Position und jeden Monat liefert der Kern:
- Betrag im Monat
- abgabepflichtige Personennächte im Monat, sofern bekannt (Betrag ÷ Tarif, ganze Personennächte)
- Art der Position: mit Tarif je Person und Nacht, Prozent-Tarif, Alt-Position

`tourist_tax_monthly` summiert diesen Kern wie bisher. Ein Test stellt sicher, dass das Dashboard dieselben Zahlen wie vorher liefert.

**Neue Berichtsfunktion** (Kunde, von Monat, bis Monat). Sie liefert nur für Inhaber des Kunden eine Zeile je Buchung und Gemeinde mit:
- Buchungsnummer, Hauptgast (oder „anonymisiert“), Wohnung, Anreise, tatsächliche Abreise, Personen
- Betrag im Zeitraum (Summe der Monate)
- abgabepflichtige Personennächte im Zeitraum. Leer, wenn eine Position der Buchung keine bekannten Personennächte hat. Die bekannten Teile werden für die Gemeindesumme getrennt mitgeliefert.
- befreite Personennächte im Zeitraum: Personen × Nächte des Aufenthalts im Zeitraum, minus abgabepflichtige Personennächte. Den Wert gibt es nur, wenn alle Positionen bekannt sind. Er wird nie kleiner als 0.
- Kennzeichen: „anteilig“ (Aufenthalt ragt über den Zeitraum), „Alt-Position“, „Prozent-Tarif“, Zahl der Positionen ohne Personennächte

Mitarbeiter und fremde Kunden erhalten eine leere Antwort, wie bei `tourist_tax_monthly`.

**Ohne Tarife:** Für den Hinweis „Tarife hinterlegen …“ zählt die Seite, ob der Kunde überhaupt Ortstaxe-Tarife hat (bestehende Tabelle).

### C) Regeln im Programm (ohne Datenbank, mit Unit-Tests)
Eine gemeinsame Regeldatei für Seite, PDF und CSV:
- Filter aus der Adresse lesen und prüfen (Jahr, Von, Bis, Gemeinde). Ungültige Werte führen auf den Standard zurück. Eine Gemeinde ohne Daten im Zeitraum wird zu „Alle Gemeinden“.
- Schnellwahl und Standard (letzter abgelaufener Monat, letztes Quartal, letztes Jahr), auch über den Jahreswechsel.
- „Zeitraum noch nicht abgeschlossen“, wenn „bis“ den laufenden Monat erreicht.
- Zeitraum in Worten („Oktober 2026“, „Juli – September 2026“, „2025“) und der Teil des Dateinamens (`2026-10`, `2026-07-bis-09`).
- Gruppierung je Gemeinde (alphabetisch) und Sortierung nach Anreise, dann Nummer. Summen je Gemeinde und „Gesamt“, Hinweis „inkl. N Positionen ohne Personennächte“.
- CSV-Aufbau: Spaltenköpfe, Strichpunkt, Komma als Dezimalzeichen, Datum `TT.MM.JJJJ`, Anführungszeichen bei Bedarf, Schutz vor Formeln, BOM.

### D) Exporte
- **Zwei Download-Adressen** (PDF, CSV) mit denselben Filterangaben wie die Seite. Jede prüft selbst Anmeldung, gewählten Kunden und Inhaber-Rolle und lädt die Daten über dieselbe Berichtsfunktion. Ohne Recht gibt es keine Daten.
- **Knöpfe:** Sie laden die Datei im Hintergrund und speichern sie unter dem Dateinamen aus der Spec. Während des Ladens dreht sich ein Ladezeichen. Scheitert der Download, erscheint die Meldung „Export konnte nicht erstellt werden. Bitte erneut versuchen.“
- **PDF:** Der vorhandene PDF-Arbeitsprozess der Rechnungen (PROJ-41/42) bekommt eine zweite Dokumentart „Ortstaxe-Bericht“:
  - gleiche Schriften, Grundschrift und Logo aus dem Briefpapier, Aussteller-Block, wenn eingeschaltet
  - A4 hoch, Tabellenkopf auf Folgeseiten wiederholt, bei „Alle Gemeinden“ neue Seite je Gemeinde
  - Fußzeile mit „Stand“ und „Seite X von Y“
  - Die Lastgrenze (höchstens 3 gleichzeitig, dann Warteschlange) gilt gemeinsam mit den Rechnungen. Ist sie erreicht, kommt dieselbe Meldung wie beim Export-Fehler.
  - Das PDF wird nicht gespeichert.
- **CSV:** wird direkt erzeugt, nicht gespeichert, eine Zeile je Buchung und Gemeinde.
- „Stand“ (Datum, Uhrzeit) in österreichischer Zeit.

### E) Rechte und Sicherheit
- Seite: Inhaber-Bereich wie Einstellungen und Rechnungsliste. Mitarbeiter sehen „Kein Zugriff“.
- Datenbank: Die Berichtsfunktion prüft die Inhaber-Rolle je Kunde selbst (wie PROJ-14). Ein direkter Aufruf durch Mitarbeiter liefert nichts.
- Exporte: eigene Prüfung, nur der gewählte Kunde, keine Kunden-ID von außen.
- Filterwerte werden streng geprüft (Zahlen, Monat 1–12, Gemeindecode aus der Liste).

### F) Leistung
- Ziel aus der Spec: Ganzjahresbericht bei 5.000 Buchungen unter 2 Sekunden, PDF unter 5 Sekunden.
- Es gibt bereits den Teilindex auf Abgabe-Positionen (PROJ-14). /backend misst mit Testdaten und löscht sie danach.
- Übertragen werden nur die fertigen Zeilen je Buchung.

### G) Tests
- **Unit:** Regeldatei (Filter, Schnellwahl inkl. Jänner, Zeitraum in Worten, Dateiname, Gruppierung, Summen mit unbekannten Werten, CSV mit Strichpunkt, Anführungszeichen und Formelschutz, BOM)
- **Integration (Datenbank):**
  - Berichtsfunktion: Monatsgrenze und Jahreswechsel, „anteilig“, Tarifwechsel im Aufenthalt (eine Zeile), Alt-Position mit und ohne Vielfaches, Prozent-Tarif, befreite Personennächte (Alter, Häkchen), nie negativ, Option/Sperre/Storno ausgenommen, archivierte Wohnung, anonymisierter Gast
  - Gleichheit: Summe des Berichts je Monat entspricht `tourist_tax_monthly`
  - Rechte: Inhaberin bei A und Mitarbeiterin bei B, fremder Kunde, ohne Anmeldung
- **PDF:** Erzeugung mit einer und mehreren Gemeinden, mehrseitige Liste, ohne Logo, Aussteller-Block aus
- **E2E:**
  - Menüpunkt für Inhaber, kein Menüpunkt für Mitarbeiter
  - Standardzeitraum, Schnellwahl, Gemeindefilter, Neu laden mit gleichem Bericht
  - leerer Zustand mit deaktivierten Exporten
  - PDF- und CSV-Download (Dateiname, Inhalt der CSV)
  - Handy 375 px ohne seitliches Scrollen der Seite
  - axe

### H) Was wohin gehört
- **/frontend:** Seite, Filterleiste, Übersicht, Buchungsliste, leerer Zustand, Export-Knöpfe mit Fehlermeldung, Regeldatei mit Unit-Tests, Texte in der Übersetzungsdatei, Menüpunkt freischalten.
- **/backend:**
  - Rechenkern herauslösen, Berichtsfunktion, Datenabruf für die Seite
  - Download-Adressen PDF und CSV
  - PDF-Dokumentart „Ortstaxe-Bericht“ im Arbeitsprozess
  - Integrationstests und Messung

### Abhängigkeiten (Pakete)
Keine neuen. Genutzt werden das vorhandene `@react-pdf/renderer` (über den PDF-Arbeitsprozess) und die bestehenden shadcn/ui-Bausteine (Card, Table, Select, Button, Alert).

### Umsetzung Frontend (2026-11-08)
**Gebaut:**
- `src/lib/tourist-tax-report.ts` (reine Regeln, 38 Unit-Tests in `tourist-tax-report.test.ts`):
  - Filter aus der Adresse (`?jahr=&von=&bis=&gemeinde=`), Standard und Schnellwahl
  - Zeitraum offen, Zeitraumart, Dateischlüssel und Dateinamen
  - Gruppierung, Summen, Hinweise je Zeile
  - CSV-Aufbau mit BOM, Strichpunkt, Komma, CRLF, Anführungszeichen und Formelschutz
- `src/lib/tourist-tax-report-data.ts`: Abruf der Datenbankfunktion `tourist_tax_report` (nur Inhaber, gewählter Kunde; ohne Funktion „ready: false“ mit Hinweis) und `hasTouristTaxRates` für den Tarif-Hinweis.
- Seite `src/app/(app)/ortstaxe/page.tsx`:
  - Kopf mit Kundenname und Export-Knöpfen
  - Filter, Hinweis „Zeitraum noch nicht abgeschlossen“
  - Übersicht und Buchungsliste
  - leerer Zustand (mit Tarif-Hinweis, wenn keine Tarife), Fehler- und „wird eingerichtet“-Hinweis
- `src/components/tourist-tax/`:
  - `report-filters.tsx`: Schnellwahl als Links, Jahr/Von/Bis/Gemeinde als Auswahl. „Bis“-Monate vor „Von“ sind gesperrt; liegt „Von“ nach „Bis“, zieht „Bis“ mit.
  - `report-tables.tsx`: Übersicht und Buchungsliste. Am Handy kurze Spaltenköpfe in der Übersicht. Die Buchungsliste hat einen eigenen Scrollbereich mit Tastaturfokus und stehender Spalte „Nr.“.
  - `export-buttons.tsx`: lädt `/api/ortstaxe/pdf|csv` im Hintergrund. Der Dateiname kommt aus `Content-Disposition`, sonst aus der Seite. Fehlermeldung auf der Seite.
- Menüpunkt „Ortstaxe“ freigeschaltet (`navigation.ts`, Unit-Test und E2E PROJ-2 angepasst). Kommentar im Dashboard-Abschnitt ohne Knopf. Texte unter `touristTaxReport` in `messages/de.json` (Du-Form wie in der übrigen App).

**Abweichung:** Mitarbeiter, die `/ortstaxe` direkt aufrufen, sehen „Seite nicht gefunden“ (404) statt eines Hinweises „Kein Zugriff“. So handhabt die App alle Inhaber-Bereiche (`requireArea`), und Daten gibt es so oder so keine.

**Vertrag für /backend:**
- `tourist_tax_report(p_tenant_id uuid, p_from date, p_to date)` liefert je Buchung und Gemeinde:
  - Buchung und Gast: `booking_id`, `booking_number`, `guest_last_name`, `guest_first_name`, `guest_anonymized`
  - Wohnung und Gemeinde: `property_name`, `apartment_name`, `municipality_id`, `municipality_name`
  - Aufenthalt: `arrival`, `departure` (tatsächlich), `persons`
  - Zahlen: `amount_cents`, `taxable_person_nights` (null bei unbekannten Positionen), `known_taxable_person_nights`, `exempt_person_nights` (null, wenn nicht bestimmbar, sonst ≥ 0), `unknown_positions`
  - Kennzeichen: `partial`, `legacy`, `percent`
  - Nur für Inhaber, sonst leer.
- Download-Adressen `GET /api/ortstaxe/pdf` und `/api/ortstaxe/csv`:
  - gleiche Abfrageparameter wie die Seite, Filter mit `parseTaxReportFilters`
  - Antwort mit `Content-Disposition` (`filename*=UTF-8''…`, Name aus `taxReportFileName`)
  - Fehler mit Status ≠ 200
  - CSV aus `buildTaxReportCsv` mit `touristTaxReport.csv.columns`

**Sichtprüfung:** mit temporären Musterdaten (danach entfernt) bei 1440 px und 375 px. Die Seite scrollt nicht seitlich, die Browser-Konsole ist ohne Fehler, axe meldet keine Verstöße. Build, Lint und alle 829 Unit-Tests sind grün.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
