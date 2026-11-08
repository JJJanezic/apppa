# PROJ-48: Ort und Staat aus der PLZ

## Status: In Progress
**Created:** 2026-11-08
**Last Updated:** 2026-11-08

## Dependencies
- Requires: PROJ-7 (Gäste-Datenbank): Gastformular mit Anschrift (PLZ, Ort, Land der Gastanschrift)
- Requires: PROJ-33 (Firmenanschrift aufteilen): Firmenanschrift mit PLZ, Ort, Staat
- Requires: PROJ-29 (Gast-Erweiterung): aktueller Stand des gemeinsamen Gastformulars
- Wirkt mit: PROJ-8 (Manuelle Buchungen) und PROJ-37 (Rechnungen nacherfassen). Beide verwenden dasselbe Gastformular und erhalten das Verhalten automatisch.

## Überblick
Gibt man im Gastformular eine österreichische (4 Ziffern) oder deutsche (5 Ziffern) PLZ ein, füllt die App „Ort“ und „Staat“ selbst aus. Das gilt für die Anschrift des Gastes und für die Firmenanschrift (Rechnungsadresse). Beide Felder bleiben frei überschreibbar. Was jemand von Hand eingetragen hat oder was schon gespeichert war, wird nie überschrieben.

## User Stories
- Als Vermieter (Inhaber) möchte ich nach der PLZ den Ort nicht mehr tippen müssen, damit ich Gäste schneller und ohne Tippfehler erfasse.
- Als Mitarbeiter möchte ich beim Anlegen eines Gastes im Buchungsformular, z. B. bei der Schlüsselübergabe, Ort und Staat aus der PLZ übernehmen, damit die Meldedaten vollständig und richtig sind.
- Als Vermieter möchte ich bei der Firmenanschrift (Rechnungsadresse) ebenfalls Ort und Staat aus der PLZ erhalten, damit die Rechnungsanschrift korrekt ist.
- Als Vermieter möchte ich bei einer PLZ mit mehreren Orten den richtigen Ort aus einer kurzen Liste wählen, damit kein falscher Ort eingetragen wird.
- Als Vermieter möchte ich, dass ein von Hand eingetragener oder bereits gespeicherter Ort nicht überschrieben wird, damit ich Sonderfälle (Ortsteil, abweichende Schreibweise) behalte.
- Als Vermieter mit Gästen aus der Schweiz oder Italien möchte ich, dass bei gewähltem anderem Staat nichts automatisch passiert, damit keine falschen österreichischen oder deutschen Orte entstehen.

## Geltungsbereich
- **Formulare:** nur das gemeinsame Gastformular, also die Gästeseite (Anlegen/Bearbeiten), das Gast-Anlegen im Buchungsformular und das Gast-Anlegen beim Nacherfassen von Rechnungen
- **Anschriften:** Gastanschrift (PLZ → Ort, „Land“ der Gastanschrift) und Firmenanschrift (PLZ → Ort, „Staat“ der Firma). Beide arbeiten unabhängig voneinander.
- **Länder:** Österreich (4 Ziffern) und Deutschland (5 Ziffern)
- **Ortsname:** Postort, also der Name, den die Post für die Anschrift führt, nicht der Gemeindename
- **Rollen:** alle, die Gäste anlegen oder bearbeiten dürfen (Inhaber und Mitarbeiter). Keine eigenen Rechte nötig.

## Regeln

### Erkennen der PLZ
- Erkannt wird, sobald die PLZ vollständig ist. Es braucht kein Verlassen des Feldes.
- Leerzeichen und Länderpräfixe werden beim Erkennen ignoriert, z. B. „A-6020“, „A 6020“, „AT-6020“, „D-80331“, „DE 80331“. Die PLZ bleibt im Feld so stehen, wie sie eingegeben wurde.
- Der Staat für das Nachschlagen ergibt sich so:
  - Staat leer: 4 Ziffern → Österreich, 5 Ziffern → Deutschland. Ein Präfix (A/AT bzw. D/DE) muss dazu passen, sonst passiert nichts.
  - Staat Österreich oder Deutschland: nachgeschlagen wird nur in der Liste dieses Staates
  - anderer Staat, z. B. Schweiz oder Italien: es passiert nichts
- Steht die PLZ nicht in der Liste, bleiben Ort und Staat unverändert. Es gibt keinen Hinweis und das Speichern ist nicht eingeschränkt.

### Befüllen
- **Ort** wird nur gesetzt, wenn das Feld leer ist oder in dieser Bearbeitung automatisch befüllt wurde und seither nicht von Hand geändert wurde
- **Staat** folgt derselben Regel: Er wird nur gesetzt, wenn er leer ist oder in dieser Bearbeitung automatisch befüllt wurde
- Ein von Hand getippter, aus einer Liste gewählter oder beim Öffnen schon gespeicherter Wert gilt als „von Hand“ und wird nie überschrieben
- Wird ein automatisch gesetzter Ort von Hand geändert, gilt er ab dann als „von Hand“
- Wird die PLZ geleert oder zu einer unbekannten PLZ geändert, bleibt ein automatisch gesetzter Ort stehen. Er wird nicht gelöscht.

### Mehrere Orte zu einer PLZ
- Gehören zu einer PLZ mehrere Postorte, bleibt der Ort leer. Ein zuvor automatisch gesetzter Ort wird geleert.
- Unter dem Feld „Ort“ erscheinen die passenden Orte zum Anklicken. Die Liste ist mit Tastatur und Touch bedienbar.
- Der Staat wird trotzdem nach den Regeln oben befüllt
- Ein Klick übernimmt den Ort und schließt die Liste. Der übernommene Ort gilt als „von Hand“.
- Die Liste verschwindet, wenn der Ort von Hand eingegeben wird oder die PLZ sich ändert
- Die Liste erscheint nur, wenn der Ort nach der Befüllungsregel überhaupt gesetzt werden dürfte

## Out of Scope
- **Weitere Formulare:** Empfängeranschrift im Rechnungsentwurf (PROJ-40), Kundenstammdaten (PROJ-28), Objektanschrift (PROJ-6, hat bereits die Gemeindeauswahl). Bewusst ausgenommen, siehe Entscheidungen.
- **Weitere Länder** (Schweiz, Italien, Liechtenstein usw.). Kann später ergänzt werden.
- **Umgekehrte Richtung:** PLZ aus dem Ort vorschlagen
- **Straßennamen** vorschlagen oder prüfen
- **Prüfung der PLZ:** keine Fehlermeldung bei unbekannter oder unpassender PLZ, kein Abgleich von Ort und PLZ beim Speichern
- **Nachträgliches Befüllen bestehender Gäste:** Gespeicherte Gäste ohne Ort werden nicht automatisch ergänzt. Es wirkt nur bei Eingaben im Formular.
- **Gemeindezuordnung des Gastes** (Statistik Austria) für Meldewesen oder Auswertungen, siehe PROJ-26 (Gästeblatt)
- **Mitreisende:** haben keine eigene Anschrift
- **Firmendaten anderer Gäste wiederverwenden:** eigenes Feature PROJ-49

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Grundfall Österreich und Deutschland
- [ ] Angenommen das Gastformular ist geöffnet und Ort sowie Land der Gastanschrift sind leer, wenn der Nutzer als PLZ „6020“ eingibt, dann steht im Ort „Innsbruck“ und als Land „Österreich“, ohne dass das Feld verlassen werden muss
- [ ] Angenommen Ort und Land der Gastanschrift sind leer, wenn der Nutzer als PLZ „80331“ eingibt, dann steht im Ort „München“ und als Staat „Deutschland“
- [ ] Angenommen Ort und Staat sind leer, wenn der Nutzer „A-6020“ bzw. „D-80331“ eingibt, dann werden Ort und Staat wie ohne Präfix befüllt und die PLZ bleibt „A-6020“ bzw. „D-80331“
- [ ] Angenommen die Firmenanschrift ist aufgeklappt und deren Ort und Staat sind leer, wenn der Nutzer dort eine bekannte PLZ eingibt, dann werden Ort und Staat der Firma befüllt und die Gastanschrift bleibt unverändert
- [ ] Angenommen der Nutzer gibt die PLZ der Gastanschrift ein, wenn Ort und Staat befüllt werden, dann bleiben Ort und Staat der Firmenanschrift unverändert (und umgekehrt)

### Staat bestimmt das Nachschlagen
- [ ] Angenommen als Land ist „Schweiz“ gewählt, wenn der Nutzer als PLZ „8001“ eingibt, dann bleiben Ort und Staat unverändert
- [ ] Angenommen als Staat ist „Österreich“ gewählt, wenn der Nutzer eine fünfstellige PLZ eingibt, dann bleiben Ort und Staat unverändert
- [ ] Angenommen als Staat ist „Deutschland“ gewählt und der Ort ist leer, wenn der Nutzer eine bekannte deutsche PLZ eingibt, dann wird der Ort befüllt und der Staat bleibt „Deutschland“
- [ ] Angenommen der Staat ist leer, wenn der Nutzer „D-6020“ eingibt (Präfix passt nicht zur Stellenzahl), dann bleiben Ort und Staat unverändert

### Überschreiben
- [ ] Angenommen im Ort steht ein von Hand getippter Wert, wenn der Nutzer eine bekannte PLZ eingibt, dann bleibt der Ort unverändert
- [ ] Angenommen ein bestehender Gast mit gespeichertem Ort wird bearbeitet, wenn der Nutzer die PLZ ändert, dann bleibt der gespeicherte Ort unverändert
- [ ] Angenommen der Ort wurde in dieser Bearbeitung aus „6020“ automatisch befüllt, wenn der Nutzer die PLZ auf „5020“ korrigiert, dann steht im Ort „Salzburg“
- [ ] Angenommen der Ort wurde automatisch befüllt und danach von Hand geändert, wenn der Nutzer die PLZ ändert, dann bleibt der von Hand geänderte Ort stehen
- [ ] Angenommen der Staat wurde aus „6020“ automatisch auf „Österreich“ gesetzt, wenn der Nutzer die PLZ auf „80331“ ändert, dann wechselt der Staat auf „Deutschland“ und der Ort auf „München“
- [ ] Angenommen der Staat wurde von Hand gewählt, wenn der Nutzer eine PLZ eines anderen Staates eingibt, dann bleibt der Staat unverändert und der Ort wird nicht befüllt
- [ ] Angenommen der Ort wurde automatisch befüllt, wenn der Nutzer die PLZ leert, dann bleibt der Ort stehen

### Mehrere Orte
- [ ] Angenommen der Ort ist leer, wenn der Nutzer eine PLZ mit mehreren Postorten eingibt, dann bleibt der Ort leer, unter dem Feld erscheinen alle passenden Orte zur Auswahl und der Staat wird nach den Regeln befüllt
- [ ] Angenommen die Auswahlliste ist sichtbar, wenn der Nutzer einen Ort anklickt, dann steht dieser Ort im Feld und die Liste verschwindet
- [ ] Angenommen die Auswahlliste ist sichtbar, wenn der Nutzer per Tabulator in die Liste wechselt und einen Ort mit der Eingabetaste wählt, dann wird dieser Ort übernommen
- [ ] Angenommen die Auswahlliste ist sichtbar, wenn der Nutzer selbst einen Ort tippt, dann verschwindet die Liste und der getippte Ort bleibt
- [ ] Angenommen der Ort wurde zuvor automatisch befüllt, wenn der Nutzer die PLZ auf eine PLZ mit mehreren Orten ändert, dann wird der Ort geleert und die Auswahlliste erscheint
- [ ] Angenommen im Ort steht ein von Hand eingetragener Wert, wenn der Nutzer eine PLZ mit mehreren Orten eingibt, dann erscheint keine Auswahlliste

### Unbekannte PLZ und Speichern
- [ ] Angenommen der Ort ist leer, wenn der Nutzer eine vollständige, aber nicht gelistete PLZ eingibt, dann bleiben Ort und Staat leer und es erscheint keine Meldung
- [ ] Angenommen der Ort wurde automatisch befüllt, wenn der Nutzer speichert, dann wird der Gast mit diesem Ort und Staat gespeichert wie bei einer Eingabe von Hand
- [ ] Angenommen eine PLZ ist nicht gelistet, wenn der Nutzer Ort und Staat von Hand einträgt und speichert, dann wird ohne Warnung gespeichert

### Einsatzorte des Formulars
- [ ] Angenommen ein Mitarbeiter legt im Buchungsformular einen neuen Gast an, wenn er eine bekannte PLZ eingibt, dann werden Ort und Staat wie auf der Gästeseite befüllt
- [ ] Angenommen ein Inhaber legt beim Nacherfassen einer Rechnung einen neuen Gast an, wenn er eine bekannte PLZ eingibt, dann werden Ort und Staat wie auf der Gästeseite befüllt
- [ ] Angenommen der Nutzer bearbeitet die Empfängeranschrift im Rechnungsentwurf, die Kundenstammdaten oder eine Objektanschrift, wenn er eine PLZ eingibt, dann passiert nichts automatisch

### Bedienbarkeit
- [ ] Angenommen ein Screenreader ist aktiv, wenn Ort und Staat automatisch befüllt werden oder die Auswahlliste erscheint, dann wird dies angesagt
- [ ] Angenommen das Formular wird auf dem Handy bedient, wenn die Auswahlliste erscheint, dann ist jeder Eintrag mindestens 44 px hoch und ohne waagrechtes Scrollen erreichbar

## Edge Cases
- **Schweizer Gast, PLZ zuerst getippt:** Bei leerem Staat würde z. B. „8001“ als österreichische PLZ gelesen. Ist sie in AT nicht vergeben, passiert nichts. Ist sie vergeben, steht ein österreichischer Ort mit „Österreich“ im Formular. Wählt der Nutzer danach „Schweiz“, ist der Staat „von Hand“ und bleibt. Den automatisch gesetzten Ort korrigiert er von Hand. Bewusst in Kauf genommen (siehe Entscheidungen).
- **Langsame oder fehlende Verbindung beim Nachschlagen:** Das Formular bleibt bedienbar und nichts wird befüllt. Es kommt keine Fehlermeldung. Kommt eine Antwort erst, nachdem der Nutzer weitergetippt hat, wird sie nur für die aktuelle PLZ verwendet. Veraltete Antworten werden verworfen.
- **Schnelles Tippen bzw. Korrigieren:** Zwischenstände wie „602“ lösen nichts aus. Erst die vollständige PLZ zählt.
- **Eingefügte PLZ** mit Leerzeichen am Rand oder mittendrin („60 20“): wird wie „6020“ erkannt
- **PLZ mit Buchstaben oder zu vielen Ziffern** („6020a“, „602011“): wird nicht erkannt, nichts passiert
- **Formular verworfen:** Automatische Befüllungen werden nicht gespeichert. Beim erneuten Öffnen gelten gespeicherte Werte als „von Hand“.
- **Fehler beim Speichern:** Das Formular bleibt mit den Werten stehen. Die Herkunft der Werte (automatisch oder von Hand) bleibt für die laufende Bearbeitung erhalten.
- **Firmenanschrift zugeklappt:** Eingaben in der Gastanschrift wirken nie auf die Firmenanschrift, auch nicht im zugeklappten Zustand
- **PLZ ändert sich in der Postliste:** Gespeicherte Gäste bleiben unverändert. Die Liste wirkt nur bei neuen Eingaben.
- **„Herkunftsland“ des Gastes:** Das ist ein eigenes Feld und wird nie aus der PLZ befüllt. Befüllt wird nur „Land“ der Gastanschrift. Grund: Das Herkunftsland ist bewusst nicht vorbelegt (PROJ-7), weil es die Herkunftsstatistik verfälschen könnte.

## Technical Requirements (optional)
- Performance: Ort und Staat erscheinen spürbar sofort nach der letzten Ziffer (Ziel unter 300 ms)
- Daten: Postorte für AT und DE mit Herkunft und Lizenz dokumentiert. Die Pflege (Aktualisierung) ist im Runbook beschrieben.
- Security: Es verlassen keine Gastdaten den Browser. Das Nachschlagen geschieht im Browser selbst, die Ortslisten sind öffentliche offene Daten (siehe Tech Design).
- Browser Support: Chrome, Firefox, Safari (Desktop und mobil)

## Open Questions
- [x] Datenquelle und Lizenz der Postorte für AT und DE, Aktualisierung: AT aus dem PLZ-Verzeichnis der RTR (CC BY 3.0 AT), DE aus GeoNames (CC BY 4.0), halbjährlich per Runbook (`/architecture` 2026-11-08)
- [x] Ortsteile in DE: Ortsteil-Einträge („Dresden Innere Altstadt“) entfallen, wenn der Hauptort („Dresden“) zur selben PLZ gehört; Großkunden-Einträge (Firmennamen) entfallen ganz (`/architecture` 2026-11-08)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Staat aus der Stellenzahl ableiten, wenn er leer ist (4 → AT, 5 → DE) | Am bequemsten für den häufigsten Fall (AT/DE-Gäste). Bei gewähltem anderem Staat passiert nichts. Das schützt Schweizer und italienische Anschriften, sofern der Staat zuerst gewählt wird. | 2026-11-08 |
| Ort/Staat nur überschreiben, wenn leer oder in dieser Bearbeitung automatisch befüllt | Korrigierte PLZ korrigiert auch den Ort. Von Hand Eingetragenes und Gespeichertes bleibt geschützt. | 2026-11-08 |
| Bei mehreren Orten Auswahlliste unter „Ort“, Ort bleibt leer | Kein stilles Raten des falschen Ortes. Ein Klick genügt. | 2026-11-08 |
| Nur das Gastformular (Gast- und Firmenanschrift) | Dort wird am häufigsten erfasst, auch in Buchungsformular und Rechnungsnacherfassung. Stammdaten und Objekte werden selten ausgefüllt, der Rechnungsentwurf übernimmt die Anschrift meist vom Gast. | 2026-11-08 |
| Postort statt Gemeindename | Entspricht der Postanschrift auf Briefen und Rechnungen und ergibt weniger Mehrfachtreffer. Die vorhandene Gemeindeliste (Statistik Austria) dient weiter der Ortstaxe. | 2026-11-08 |
| Sofort bei vollständiger PLZ, Präfixe wie „A-“/„D-“ werden erkannt | Schnellste Erfassung. Gäste und Plattformen liefern PLZ oft mit Präfix. Die PLZ selbst wird nicht verändert. | 2026-11-08 |
| Kein Hinweis bei unbekannter PLZ | PLZ und Ort sind Freitext. Ein Hinweis würde bei neuen PLZ oder Sonderfällen nur stören. | 2026-11-08 |
| Herkunftsland wird nie befüllt | Das Herkunftsland ist in PROJ-7 bewusst ohne Vorbelegung, wegen der Herkunftsstatistik. Die Anschrift sagt nichts sicher über die Herkunft. | 2026-11-08 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Nachschlagen im Browser aus zwei statischen Ortslisten (AT, DE) statt Datenbankabfrage je PLZ | Sofortige Anzeige ohne Serverweg (Ziel < 300 ms sicher erreichbar), keine Gastdaten verlassen den Browser, keine Datenbank-Änderung und kein Backend-Schritt nötig. Die Listen sind öffentliche offene Daten und dürfen ohne Anmeldung abrufbar sein | 2026-11-08 |
| Listen erst laden, wenn eine PLZ der passenden Länge eingegeben wird; danach vom Browser zwischengespeichert | AT ca. 18 KB, DE ca. 130 KB (komprimiert). Wer nur österreichische Gäste erfasst, lädt die deutsche Liste nie | 2026-11-08 |
| AT: PLZ-Verzeichnis der RTR (Daten der Österreichischen Post), nur gültige PLZ mit Adressierung | Amtliche Postorte, monatlich gepflegt, offene Lizenz CC BY 3.0 AT. Die vorhandene Gemeindeliste (Statistik Austria) enthält Gemeinden, nicht Postorte | 2026-11-08 |
| DE: GeoNames-Postleitzahlen (CC BY 4.0), bereinigt | Die amtlichen Daten der Deutschen Post sind kostenpflichtig. GeoNames ist frei und deckt alle Zustell-PLZ ab. Bereinigung: Großkunden-Einträge (Firmennamen) und Ortsteile neben dem Hauptort entfallen; übrig bleiben ca. 9.800 PLZ, davon ca. 2.000 mit mehreren Orten | 2026-11-08 |
| Rohdaten im Repository, Ortslisten per Skript erzeugt | Gleiches Muster wie die Gemeindeliste (`supabase/data/statistik-austria`, `scripts/build-municipalities.mts`): nachvollziehbar, wiederholbar, Aktualisierung per Runbook | 2026-11-08 |
| „Automatisch befüllt“ wird nur im Formular gemerkt, nicht gespeichert | Die Regel gilt nur für die laufende Bearbeitung (Spec: gespeicherte Werte gelten als „von Hand“). Keine Datenbankspalte nötig | 2026-11-08 |
| Quellenangabe als sehr kleine Zeile (11 px, gedämpft) unter „Ort“, sobald ein Ort automatisch eingetragen oder eine Auswahl angezeigt wird | Beide Lizenzen verlangen eine Namensnennung; die Zeile zeigt zugleich, dass der Ort aus der PLZ stammt (auch für Screenreader) | 2026-11-08 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Reines Frontend-Feature. Es gibt keine Datenbank-Änderung, keine neue Schnittstelle und keine Rechteprüfung. Das Gastformular schlägt die PLZ in zwei mitgelieferten Ortslisten nach, einer für Österreich und einer für Deutschland. Diese Listen werden aus offenen Daten erzeugt und mit der App ausgeliefert.

### A) Komponenten
```
Gastformular (bestehend, src/components/guests/guest-fields.tsx)
+-- Anschrift
|   +-- PLZ (unverändert)
|   +-- Ort (Eingabefeld unverändert)
|   |   +-- NEU: Ortsauswahl bei mehreren Orten (Liste von Knöpfen, Tastatur/Touch, min. 44 px)
|   |   +-- NEU: Quellenzeile „Ort aus der PLZ · Daten: RTR, GeoNames“, sehr klein (11 px, gedämpft, wie Bildunterschriften im Design-System), nur nach automatischer Befüllung oder bei sichtbarer Auswahl
|   +-- Land (Länderauswahl unverändert)
+-- Firma (aufklappbar)
    +-- Rechnungsadresse
        +-- PLZ / Ort / Staat: dieselben Bausteine wie oben, unabhängig von der Gastanschrift

NEU: Baustein „Ort aus PLZ“ (wiederverwendbar, je Anschrift einmal eingesetzt)
+-- erkennt die vollständige PLZ (Präfix A/AT bzw. D/DE und Leerzeichen werden ignoriert)
+-- bestimmt das Land (gewähltes Land oder Stellenzahl bei leerem Land)
+-- lädt bei Bedarf die passende Ortsliste
+-- merkt sich je Feld (Ort, Land), ob es in dieser Bearbeitung automatisch befüllt wurde
+-- befüllt Ort und Land nach den Regeln der Spec oder zeigt die Ortsauswahl
+-- meldet Änderungen dem Screenreader (Live-Bereich)
```
Da das Gastformular auch im Buchungsformular und beim Nacherfassen von Rechnungen steckt, wirkt das Verhalten dort ohne weitere Arbeit. Rechnungsentwurf, Kundenstammdaten und Objektanschrift nutzen eigene Felder und bleiben unberührt.

### B) Daten
**Ortslisten** (je Land eine Datei, öffentlich abrufbar, ohne Gastdaten):
- je PLZ die zugehörigen Postorte, alphabetisch
- AT: ca. 2.200 PLZ, jede mit genau einem Postort (Stand RTR 04.11.2026)
- DE: 8.173 PLZ, davon 1.420 mit mehreren Orten (nach Bereinigung, siehe Umsetzung)

**Rohdaten und Herkunft** (im Repository, mit README zu Quelle, Lizenz, Stand und Pflicht-Quellenangabe):
- `supabase/data/rtr/`: PLZ-Verzeichnis der RTR (data.rtr.at, CC BY 3.0 AT). Übernommen werden nur gültige PLZ (ohne „gültig bis“) mit Adressierung.
- `supabase/data/geonames/`: GeoNames-Postleitzahlen DE (download.geonames.org, CC BY 4.0)

**Erzeugung:** Ein Skript (Muster wie `scripts/build-municipalities.mts`) bereinigt die Rohdaten und schreibt die beiden Ortslisten.
- DE: Einträge mit Firmenmerkmalen (z. B. „GmbH“, „AG“) entfallen. Damit fallen Großkunden-PLZ wie „80788 BMW AG“ ganz weg.
- DE: Ein Ortsteil („Hamburg Altstadt“) entfällt, wenn der Hauptort („Hamburg“) zur selben PLZ gehört.
- Doppelte Einträge werden zusammengefasst.

**Im Formular gemerkt, nicht gespeichert:** ob Ort bzw. Land in dieser Bearbeitung automatisch befüllt wurde. Gespeichert werden wie bisher nur PLZ, Ort und Land.

**Keine Änderung** an Tabellen, Server-Aktionen, Validierung oder Rechten.

### C) Technische Entscheidungen (kurz begründet)
- **Im Browser statt am Server:** Die Anzeige kommt sofort, kein Gastdatum verlässt den Browser, und das Feature braucht keinen Backend-Teil.
- **Laden erst bei Bedarf:** Die deutsche Liste (ca. 130 KB) lädt nur, wenn eine fünfstellige PLZ eingegeben wird, danach liegt sie im Browser-Cache. Kann die Liste nicht geladen werden, passiert nichts. Es gibt keine Meldung, das Formular bleibt bedienbar.
- **Gemeindeliste bleibt getrennt:** Sie dient der Ortstaxe (Gemeinde). Für die Anschrift zählt der Postort.
- **Quellenangabe:** Die Lizenzen verlangen Namensnennung. Die Zeile unter „Ort“ erfüllt das und zeigt zugleich, woher der Ort stammt. Auf Wunsch des Nutzers sehr klein: kleinste Schrift des Design-Systems (11 px, gedämpfter Text).

### D) Pflege
Neuer Runbook-Abschnitt „PLZ-Ortslisten aktualisieren (PROJ-48)“ in `docs/runbooks/supabase.md`: halbjährlich neue RTR- und GeoNames-Dateien ablegen, README-Stand anpassen, Skript ausführen, mit dem nächsten Deploy ausliefern. Gespeicherte Gäste bleiben unverändert (Spec).

### E) Tests
- Unit-Tests (neben dem Baustein): PLZ-Erkennung mit Präfixen und Leerzeichen, Landbestimmung, Befüllungsregel (leer / automatisch / von Hand), mehrere Orte, unbekannte PLZ, Ladefehler
- Unit-Test des Erzeugungsskripts mit kleinen Beispieldaten (Ortsteil- und Firmenfilter)
- E2E: Gästeseite (6020, 80331, Präfix, Schweiz, mehrere Orte per Tastatur), je ein Durchlauf im Buchungsformular und beim Nacherfassen

### F) Abhängigkeiten (Pakete)
Keine neuen Pakete.

### Umsetzung Frontend (2026-11-08)
- **Baustein** `src/components/guests/postal-place-fields.tsx` (PLZ, Ort, Ortsauswahl, Quellenzeile 11 px, Live-Bereich für Screenreader), in `guest-fields.tsx` je einmal für Gast- und Firmenanschrift eingesetzt. Ausgelöst wird nur durch Eingaben im PLZ-Feld. Öffnen, Zurücksetzen oder Übernehmen eines Gastes lösen nichts aus.
- **Logik** `src/lib/postal-places.ts`: PLZ-Erkennung (Präfixe A/AT/D/DE, Leerzeichen), Listenwahl, Befüllungsregel, Laden der Listen, Bereinigung. Unit-Tests in `postal-places.test.ts`.
- **Ortslisten** `src/lib/postal-places-data/at.json` (2.234 PLZ) und `de.json` (8.173 PLZ). Erzeugt mit `scripts/build-postal-places.mts` aus `supabase/data/rtr/plz.json` (RTR, Version 61407 vom 04.11.2026) und `supabase/data/geonames/DE.txt` (Stand 08.11.2026). Runbook Abschnitt 16.
- **Abweichung Auslieferung:** Die Listen kommen nicht als Datei unter `public/`, sondern als eigene Bundle-Teile, die erst bei Bedarf geladen werden (`import()`). Gründe: Die Dateinamen enthalten einen Hash, dadurch dauerhaft zwischenspeicherbar und nach einer Aktualisierung automatisch neu. Sie liegen unter `_next/static`, wo die Sitzungsprüfung (`proxy.ts`) nicht läuft. Größe komprimiert: AT ca. 15 KB, DE ca. 87 KB.
- **Abweichung Bereinigung DE:** Der Firmenfilter allein reichte nicht, es blieben Behörden, Banken und Versicherungen mit eigener PLZ. Neu entfallen alle GeoNames-Einträge ohne Genauigkeitsangabe (Großkunden- und Postfach-PLZ). Danach bleiben 8.173 PLZ, das entspricht etwa der Zahl der Zustell-PLZ. Dabei gehen vereinzelt kleine Orte verloren (z. B. Marienborn bei 39365); der Ort wird dann von Hand eingetragen.
- **Messages:** `guests.postalPlaces` (Auswahl, Quellenangabe, Ansagen).
- **E2E** `tests/PROJ-48-plz-ort-staat.spec.ts` (5 Abläufe, Desktop) grün; Regression PROJ-33 (Desktop, Mobil) grün. Buchungsformular und Rechnungsnacherfassung nutzen dieselbe Komponente und werden in `/qa` geprüft.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
