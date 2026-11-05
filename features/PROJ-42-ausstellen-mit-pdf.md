# PROJ-42: Ausstellen mit PDF

## Status: Planned
**Created:** 2026-11-05
**Last Updated:** 2026-11-05

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Inhaber, Mitarbeiter, Mandantentrennung
- Requires: PROJ-5 (Betreiber-Admin): „Kunde löschen“ wird eingeschränkt
- Requires: PROJ-37 (Rechnungen nacherfassen): Rechnungsliste, Detailseite, Rechnungen je Buchung, eindeutige Nummer, PDF-Ablage, Nacherfassen als Korrekturweg
- Requires: PROJ-39 (Einstellungen → Rechnungen): Nummernkreis und Regel „nächste Nummer“, Warnung beim Ändern des Nummernkreises
- Requires: PROJ-40 (Rechnungsdaten sammeln): Entwürfe, Pflichtangaben, Änderungshinweis der Buchung, Abzüge
- Requires: PROJ-41 (Briefpapier): Rechnungsvorlage und PDF-Erzeugung, Meldungen zu Mängeln
- Wird genutzt von: PROJ-43 (Rechnungsübersicht ausbauen), PROJ-44 (Rechnungsstorno)

## Überblick
Der Inhaber macht aus einem Entwurf eine endgültige Rechnung. **Nummer vergeben, festschreiben und PDF ablegen geschehen in einem Schritt.** Entweder gelingt alles oder es ändert sich nichts. Danach lässt sich die Rechnung nicht mehr ändern oder löschen.

Hinweis zu älteren Specs: PROJ-37 bis PROJ-40 nennen für das Ausstellen teils „PROJ-41“. Seit der Gliederung vom 2026-11-01 ist das dieses Feature.

### Einstieg und Seite „Rechnung ausstellen“
- Knopf **„Ausstellen“** auf der Detailseite des Entwurfs, nur für Inhaber. Er führt immer auf die Seite, auch wenn Pflichtangaben offen sind; dort steht, was fehlt.
- Die Seite zeigt **Rechnungsdatum, Rechnungsnummer, Prüfungen, Häkchen und die PDF-Vorschau**. Am Handy stehen die Bereiche untereinander.
- Die Vorschau übernimmt Datum und Nummer und trägt bis zum Ausstellen immer den Aufdruck „Entwurf“.
- Der Knopf **„Rechnung ausstellen“** ist erst aktiv, wenn keine Sperre besteht und alle nötigen Häkchen gesetzt sind. Daneben steht, dass die Rechnung danach nicht mehr änderbar ist.
- Änderungen an Datum und Nummer gelten erst mit dem Ausstellen. Wer die Seite verlässt, findet den Entwurf unverändert vor.
- „Zurück zum Entwurf“ führt zur Detailseite des Entwurfs.

### Rechnungsdatum
- Vorbelegt mit dem Datum des Entwurfs, hier änderbar. Ändert es sich, rechnet die App Nummernvorschlag, Fristen und Vorschau neu.
- **In der Zukunft:** Sperre, mit „Datum auf heute setzen“. Der Entwurf selbst darf ein künftiges Datum behalten.
- **Passt nicht zur Nummernfolge:** nur Hinweis, mit „Datum auf heute setzen“. Das gilt, wenn eine niedrigere Nummer desselben Kreises ein späteres Datum oder eine höhere ein früheres Datum trägt, zum Beispiel „Die Rechnung 2026-0050 trägt ein späteres Datum (20.10.2026)“. Verglichen wird mit nacherfassten und ausgestellten Rechnungen.

### Rechnungsnummer
- Vorschlag nach der Regel aus PROJ-39, überschreibbar. Ein Knopf stellt den Vorschlag wieder her.

| Eingabe | Verhalten |
|---|---|
| Vorschlag | ohne Rückfrage |
| Freie Nummer unter dem Vorschlag im selben Format und Jahr | Hinweis „Füllt eine Lücke“ |
| Nummer über dem Vorschlag | Häkchen, Hinweis nennt die Folge: „Die nächste Nummer wäre danach 2026-9001“ |
| Anderes Format | Häkchen, Hinweis, dass diese Nummer nicht zur Folge zählt |
| Anderes Jahr als das des Rechnungsdatums | Häkchen |
| Schon vergeben | abgelehnt, auch Unterschiede in Groß-/Kleinschreibung und Leerzeichen; gilt auch für nacherfasste Rechnungen |
| Leer oder länger als 30 Zeichen | abgelehnt |

Stellen zwei Personen gleichzeitig aus, gewinnt die erste. Die zweite erhält die Meldung „Nummer ist inzwischen vergeben“ und die neue nächste Nummer als Vorschlag. Vor einem erneuten Versuch muss sie den Knopf noch einmal drücken.

### Prüfungen
**Sperren** (Ausstellen nicht möglich, jede Meldung führt zur Stelle der Abhilfe):

| Prüfung | Abhilfe |
|---|---|
| Pflichtangabe fehlt (Liste aus PROJ-40, Regel in der Datenbank durchgesetzt) | Entwurf oder Stammdaten |
| Rechnungsdatum in der Zukunft | Datum ändern |
| Abgezogene Teilrechnung ist noch Entwurf | Teilrechnung zuerst ausstellen |
| Abgezogene Rechnung existiert nicht mehr | Entwurf neu speichern |
| Buchung wurde nach dem letzten Speichern des Entwurfs storniert | Entwurf anpassen und speichern |
| Zeichen, die die Schrift nicht kennt | Text ändern oder andere Schrift |
| Aussteller-Block passt auch bei 6 pt nicht in den Kopf | Stammdaten oder Briefpapier |
| Fußzeile wird gekürzt | Fußzeile kürzen |

**Häkchen** (Ausstellen nach bewusster Bestätigung möglich):

| Fall | Häkchen |
|---|---|
| Buchung seit dem Entwurf geändert (Preis, Positionen, Hauptgast) | „Entwurf trotzdem unverändert ausstellen“ |
| Buchung ist noch eine Option | „Buchung ist noch eine Option, trotzdem ausstellen“ |
| Nummer über dem Vorschlag, anderes Format oder anderes Jahr | „Diese Nummer trotzdem verwenden“ |
| Logo lässt sich nicht laden | „Ohne Logo ausstellen“ |

**Nur Hinweise:** Datum passt nicht zur Nummernfolge, Lücke, Fußzeile verkleinert, Summe über dem Gesamtpreis der Buchung, Rechnungsbetrag 0 oder negativ, Logo unscharf.

Geprüft wird das tatsächlich erzeugte PDF. Ändert sich der Stand zwischen Anzeige und Ausstellen (etwa Entwurf, Buchung, Briefpapier), prüft die App beim Ausstellen neu. Besteht dann eine neue Sperre oder ein neues Häkchen, wird nicht ausgestellt und die Seite zeigt den neuen Stand.

### Was festgeschrieben wird
- **Das abgelegte PDF ist die Rechnung.** Es trägt keinen Aufdruck „Entwurf“ und wird nie neu erzeugt.
- Zusätzlich hält die App fest: Nummer, Datum, Empfänger, Positionen, Abzüge, Beträge, USt je Satz, Kleinunternehmer-Status, Fristen, Aussteller und die Texte mit ersetzten Platzhaltern. Diese Werte dienen der Anzeige und den Summen.
- Spätere Änderungen an Buchung, Gast, Stammdaten, Logo, Briefpapier oder Bausteinen wirken nicht mehr.
- Das Ausstellen wird mit Person und Zeitpunkt protokolliert.

### Nach dem Ausstellen
- Die Seite wechselt zur **Detailseite der Rechnung** mit Meldung. Status „Ausgestellt“, alle festgehaltenen Angaben, Knopf „PDF öffnen“ (Download-Name mit Rechnungsnummer). Keine Knöpfe zum Bearbeiten, Löschen oder Ändern der Buchung.
- Dort steht ein kurzer Korrekturhinweis: Eine falsche Rechnung wird über eine außerhalb erstellte Gutschrift korrigiert, die mit negativen Beträgen nacherfasst wird, danach folgt eine neue Rechnung. Ist „Rechnungen nacherfassen“ ausgeschaltet, nennt der Hinweis auch diesen Schalter.
- **Rechnungsliste, Buchungsdetail, Buchungsübersicht:** Status „Ausgestellt“ und die Nummer statt „Entwurf“. Der Betrag wandert von „In Entwürfen“ zu „Verrechnet“. Die Buchung zählt beim Filter als „mit Rechnung“.
- **Andere Entwürfe:** Die Vorauswahl der Positionen zeigt „bereits in Rechnung 2026-0012“, die Abzüge der Schlussrechnung die Nummer.
- **Einstellungen → Rechnungen:** Die Nummernvorschau zählt die neue Nummer mit, die Warnung beim Ändern des Nummernkreises greift.

### Kunde löschen (Betreiber)
Hat der Kunde eine ausgestellte Rechnung innerhalb der Aufbewahrungsfrist, lässt er sich nicht löschen. Der Dialog nennt die Anzahl und verweist auf „Deaktivieren“. Die Frist endet 7 Jahre nach dem Ende des Kalenderjahres des Rechnungsdatums. Nacherfasste Rechnungen und Entwürfe sperren das Löschen nicht.

### Wer darf was
| Aktion | Inhaber | Mitarbeiter | Betreiber |
|---|---|---|---|
| Rechnung ausstellen | ✓ | – | – |
| Ausgestellte Rechnung und PDF sehen | ✓ | ✓ | – |
| Ausgestellte Rechnung ändern oder löschen | – | – | – |
| Löschsperre beim Kunden sehen (nur Anzahl) | – | – | ✓ |

## User Stories
- Als **Inhaber** möchte ich aus einem Entwurf mit einem Schritt eine endgültige Rechnung samt PDF machen, damit ich keine Rechnung außerhalb der App mehr schreiben muss.
- Als **Inhaber** möchte ich vor dem Ausstellen genau sehen, wie die Rechnung mit Nummer und Datum aussieht, damit ich Fehler noch beheben kann.
- Als **Inhaber** möchte ich die vorgeschlagene Nummer überschreiben, damit ich Lücken aus dem Altbestand auffüllen kann, ohne mich versehentlich zu vertippen.
- Als **Inhaber** möchte ich, dass offensichtlich falsche Rechnungen gar nicht erst ausgestellt werden und Ungewöhnliches eine Bestätigung braucht, damit ich keinen Beleg korrigieren muss.
- Als **Inhaber** möchte ich meine gesammelten Entwürfe ohne Nacharbeit ausstellen, damit die Vorbereitung nicht umsonst war.
- Als **Inhaber** möchte ich, dass eine ausgestellte Rechnung unveränderlich bleibt, damit ich meine Aufbewahrungspflicht erfülle.
- Als **Mitarbeiter** möchte ich ausgestellte Rechnungen und ihre PDFs öffnen, damit ich Gästen Auskunft geben kann.
- Als **Betreiber** möchte ich nicht versehentlich aufbewahrungspflichtige Rechnungen eines Kunden löschen können.

## Out of Scope
- Stornorechnung und Gutschrift in der App (PROJ-44); bis dahin Gutschrift außerhalb erstellen und nacherfassen
- Rücknahme, Ungültig-Markierung oder Bearbeiten ausgestellter Rechnungen
- Jahres- und Betragsfilter, „Rechnung erstellen“ aus der Übersicht (PROJ-43)
- Rechnungen ohne Buchung (Entwürfe entstehen nur aus Buchungen, PROJ-40)
- Versand per E-Mail und Vermerk „versendet“ (PROJ-22)
- Zahlungen erfassen und Fristen überwachen (PROJ-13)
- Strukturierte E-Rechnung (zum Beispiel ebInterface, ZUGFeRD)
- Sammel-Ausgabe aller PDFs, siehe Open Questions
- Mehrere Nummernkreise gleichzeitig
- Englische Rechnungen (PROJ-23)
- Änderungen an Vorlage und Anordnung der Rechnung (PROJ-41)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Einstieg und Seite
- [ ] Angenommen ein Inhaber öffnet die Detailseite eines Entwurfs, wenn die Seite lädt, dann gibt es den Knopf „Ausstellen“
- [ ] Angenommen ein Mitarbeiter öffnet einen Entwurf, wenn die Seite lädt, dann gibt es keinen Knopf „Ausstellen“, und ein direkter Aufruf der Seite oder des Ausstellens wird abgelehnt
- [ ] Angenommen ein Betreiber ohne Mitgliedschaft, wenn er das Ausstellen direkt aufruft, dann wird es abgelehnt
- [ ] Angenommen ein deaktivierter Kunde, wenn der Inhaber einen Entwurf öffnet, dann ist Ausstellen nicht möglich
- [ ] Angenommen ein Entwurf mit offenen Pflichtangaben, wenn der Inhaber „Ausstellen“ wählt, dann öffnet sich die Seite und nennt jede offene Angabe mit Link zur Abhilfe
- [ ] Angenommen die Seite „Rechnung ausstellen“, wenn sie lädt, dann zeigt sie Datum, vorgeschlagene Nummer, Prüfungen und die PDF-Vorschau mit Aufdruck „Entwurf“
- [ ] Angenommen die Seite ist am Handy (375 px) geöffnet, wenn der Inhaber sie bedient, dann stehen die Bereiche untereinander, ohne seitliches Scrollen und mit Bedienelementen von mindestens 44 px
- [ ] Angenommen Datum oder Nummer wurden geändert, wenn die Vorschau aktualisiert ist, dann zeigt sie beide samt ersetztem Platzhalter {Rechnungsnummer} und neu berechneten Fristen
- [ ] Angenommen Datum oder Nummer wurden geändert, wenn der Inhaber die Seite ohne Ausstellen verlässt, dann ist der Entwurf unverändert
- [ ] Angenommen ein bestehender Entwurf aus PROJ-40, wenn keine Sperre besteht, dann lässt er sich ohne Nacharbeit ausstellen

### Rechnungsdatum
- [ ] Angenommen ein Datum in der Zukunft, wenn die Seite es prüft, dann ist „Rechnung ausstellen“ gesperrt und „Datum auf heute setzen“ wird angeboten
- [ ] Angenommen ein Entwurf mit künftigem Datum, wenn der Inhaber ihn speichert, dann bleibt das wie bisher möglich
- [ ] Angenommen die höchste Nummer 2026-0050 trägt den 20.10.2026 und das Datum ist der 14.10.2026, wenn die Seite lädt, dann erscheint ein Hinweis mit dieser Rechnung und Ausstellen bleibt möglich
- [ ] Angenommen dieser Hinweis, wenn der Inhaber „Datum auf heute setzen“ wählt, dann ändern sich Datum, Fristen und Vorschau und der Hinweis verschwindet
- [ ] Angenommen „jährlich neu“ und das Datum wechselt ins Vorjahr, wenn die Seite neu rechnet, dann schlägt sie die nächste Nummer dieses Jahres vor
- [ ] Angenommen der Inhaber hat die Nummer von Hand geändert, wenn das Datum danach geändert wird, dann bleibt seine Nummer stehen und wird neu geprüft

### Rechnungsnummer
- [ ] Angenommen Rechnungen bis 2026-0041, wenn die Seite lädt, dann ist 2026-0042 vorgeschlagen und braucht keine Bestätigung
- [ ] Angenommen eine freie Nummer unter dem Vorschlag, wenn sie eingegeben wird, dann erscheint „Füllt eine Lücke“ ohne Häkchen
- [ ] Angenommen eine Nummer über dem Vorschlag, wenn sie eingegeben wird, dann nennt die Seite die danach folgende Nummer und verlangt das Häkchen
- [ ] Angenommen eine Nummer in anderem Format oder mit anderem Jahr als dem des Datums, wenn sie eingegeben wird, dann verlangt die Seite das Häkchen
- [ ] Angenommen eine vergebene Nummer, auch nacherfasst oder in anderer Schreibung, wenn sie eingegeben wird, dann ist Ausstellen gesperrt
- [ ] Angenommen zwei Personen stellen gleichzeitig mit derselben Nummer aus, wenn beide absenden, dann gelingt es genau einer, die andere erhält die Meldung und einen neuen Vorschlag und ihr Entwurf bleibt unverändert
- [ ] Angenommen eine eingegebene Nummer, wenn der Knopf „Vorschlag übernehmen“ gewählt wird, dann steht wieder die vorgeschlagene Nummer im Feld

### Sperren
- [ ] Angenommen eine fehlende Pflichtangabe, wenn jemand am Formular vorbei ausstellt, dann lehnt der Server ab
- [ ] Angenommen eine Schlussrechnung zieht einen Teilrechnungs-Entwurf ab, wenn die Seite lädt, dann ist Ausstellen gesperrt und ein Link führt zur Teilrechnung
- [ ] Angenommen diese Teilrechnung wurde ausgestellt, wenn die Seite neu lädt, dann ist die Sperre weg und der Abzug nennt die Nummer
- [ ] Angenommen eine abgezogene Rechnung existiert nicht mehr, wenn die Seite lädt, dann ist Ausstellen gesperrt, bis der Entwurf neu gespeichert ist
- [ ] Angenommen die Buchung wurde seit dem letzten Speichern storniert, wenn die Seite lädt, dann ist Ausstellen gesperrt, bis der Entwurf angepasst und gespeichert ist
- [ ] Angenommen der Entwurf wurde nach dem Storno gespeichert, wenn die Seite lädt, dann besteht diese Sperre nicht mehr
- [ ] Angenommen ein Text enthält ein Zeichen, das die Schrift nicht kennt, wenn die Seite lädt, dann ist Ausstellen gesperrt und das Zeichen wird genannt
- [ ] Angenommen der Aussteller-Block passt auch bei 6 pt nicht, wenn die Seite lädt, dann ist Ausstellen gesperrt, mit Link zu Stammdaten und Briefpapier
- [ ] Angenommen die Fußzeile wird gekürzt, wenn die Seite lädt, dann ist Ausstellen gesperrt, mit Link zur Fußzeile
- [ ] Angenommen die Fußzeile wird nur verkleinert, wenn die Seite lädt, dann erscheint nur ein Hinweis

### Häkchen
- [ ] Angenommen die Buchung wurde seit dem Entwurf geändert, aber nicht storniert, wenn die Seite lädt, dann erscheint das Häkchen mit Link zum Entwurf und der Knopf ist bis zur Bestätigung inaktiv
- [ ] Angenommen das Häkchen ist gesetzt, wenn ausgestellt wird, dann entspricht die Rechnung genau dem Entwurf
- [ ] Angenommen die Buchung ist eine Option, wenn die Seite lädt, dann erscheint das zugehörige Häkchen
- [ ] Angenommen eine Option, wenn ihre Rechnung ausgestellt ist, dann ist der Status der Buchung unverändert
- [ ] Angenommen das Logo lässt sich nicht laden, wenn die Seite lädt, dann erscheint das Häkchen „Ohne Logo ausstellen“ und das PDF enthält kein Logo
- [ ] Angenommen mehrere Fälle treffen zu, wenn ein Häkchen fehlt, dann bleibt der Knopf inaktiv
- [ ] Angenommen ein Häkchen ist gesetzt und der Fall ändert sich (etwa andere Nummer), wenn die Seite neu prüft, dann ist das Häkchen wieder leer

### Ausstellen
- [ ] Angenommen keine Sperre und alle Häkchen gesetzt, wenn der Inhaber „Rechnung ausstellen“ wählt, dann hat die Rechnung Nummer, Status „Ausgestellt“ und ein abgelegtes PDF ohne Aufdruck
- [ ] Angenommen die PDF-Erzeugung oder Ablage scheitert, wenn ausgestellt wird, dann bleibt es ein Entwurf ohne Nummer, die Nummer bleibt frei, eine Meldung erscheint und ein neuer Versuch ist möglich
- [ ] Angenommen ein Doppelklick auf den Knopf, wenn ausgestellt wird, dann entsteht genau eine Rechnung
- [ ] Angenommen die Antwort geht unterwegs verloren, wenn der Inhaber es erneut versucht, dann entsteht keine zweite Rechnung und er landet bei der ausgestellten
- [ ] Angenommen der Entwurf wurde in einem anderen Fenster geändert, wenn ausgestellt wird, dann wird nicht ausgestellt und die Seite zeigt den neuen Stand
- [ ] Angenommen die Seite ist offen und danach entsteht ein neuer Mangel, wenn ausgestellt wird, dann wird nicht ausgestellt und die Seite zeigt ihn
- [ ] Angenommen eine Rechnung wurde ausgestellt, wenn das Protokoll angesehen wird, dann stehen Person und Zeitpunkt darin

### Festschreiben
- [ ] Angenommen eine ausgestellte Rechnung, wenn Buchung, Gast, Stammdaten, Logo, Briefpapier oder Bausteine geändert werden, dann bleiben ihr PDF und ihre Angaben unverändert
- [ ] Angenommen eine ausgestellte Rechnung, wenn der Gast anonymisiert wird, dann bleiben PDF und Empfänger unverändert
- [ ] Angenommen eine ausgestellte Rechnung, wenn jemand sie am Formular vorbei ändern oder löschen will, dann lehnt der Server ab, auch beim Inhaber
- [ ] Angenommen eine ausgestellte Rechnung, wenn jemand PDF oder Buchungsverknüpfung ersetzen oder entfernen will, dann lehnt der Server ab
- [ ] Angenommen ein Entwurf wird ausgestellt, wenn die Buchung Kleinunternehmer-Status hat, dann ist dieser an der Rechnung festgehalten, und ein späterer Statuswechsel ändert sie nicht

### Detailseite und Listen
- [ ] Angenommen eine ausgestellte Rechnung, wenn der Inhaber sie öffnet, dann sieht er Status, Angaben, „PDF öffnen“ und den Korrekturhinweis, aber weder Bearbeiten noch Löschen
- [ ] Angenommen „Rechnungen nacherfassen“ ist ausgeschaltet, wenn der Korrekturhinweis erscheint, dann nennt er den Schalter
- [ ] Angenommen ein Mitarbeiter, wenn er die ausgestellte Rechnung öffnet, dann kann er das PDF öffnen und nichts ändern
- [ ] Angenommen ein Nutzer eines anderen Kunden, wenn er Rechnung oder PDF direkt aufruft, dann wird es abgelehnt
- [ ] Angenommen eine ausgestellte Rechnung, wenn die Rechnungsliste lädt, dann zeigt sie Nummer und Status „Ausgestellt“
- [ ] Angenommen ein Entwurf über € 500, wenn er ausgestellt ist, dann steigt „Verrechnet“ um € 500 und „In Entwürfen“ sinkt um € 500
- [ ] Angenommen eine Buchung mit ausgestellter Rechnung, wenn die Buchungsübersicht nach „mit Rechnung“ filtert, dann erscheint sie, mit Nummer als Link
- [ ] Angenommen eine ausgestellte Rechnung enthält eine Position, wenn ein neuer Entwurf zur Buchung entsteht, dann ist die Position abgewählt mit „bereits in Rechnung …“
- [ ] Angenommen eine Rechnung wurde ausgestellt, wenn der Inhaber den Nummernkreis ändert, dann erscheint die Warnung aus PROJ-39
- [ ] Angenommen eine Rechnung 2026-0042 wurde ausgestellt, wenn die Nummernvorschau lädt, dann zeigt sie 2026-0043

### Kunde löschen
- [ ] Angenommen ein Kunde mit einer ausgestellten Rechnung innerhalb der Frist, wenn der Betreiber ihn löschen will, dann ist es gesperrt, der Dialog nennt die Anzahl und verweist auf „Deaktivieren“
- [ ] Angenommen derselbe Kunde, wenn das Löschen am Dialog vorbei aufgerufen wird, dann lehnt der Server ab
- [ ] Angenommen ein Kunde nur mit nacherfassten Rechnungen und Entwürfen, wenn der Betreiber ihn löscht, dann geht es wie bisher
- [ ] Angenommen ein Kunde mit ausgestellten Rechnungen, wenn der Betreiber ihn deaktiviert, dann geht das und die Rechnungen bleiben lesbar

## Edge Cases
- **Lücke auffüllen mit altem Datum:** Nummer und Datum sind gewollt älter; Lücken- und Datumshinweis erscheinen, ohne Bestätigung.
- **Nummer über dem Vorschlag wird bewusst gewählt:** Die Folge läuft ab dort weiter; die Lücke darunter bleibt auffüllbar.
- **Nummer in fremdem Format** (zum Beispiel „ALT-17“): zählt nicht für die Folge, der Vorschlag ändert sich nicht.
- **Nummernkreis wird geändert, während die Seite offen ist:** Beim Ausstellen zählt der neue Stand; die Seite zeigt ihn, statt auszustellen.
- **Jahreswechsel:** Entwurf vom 30.12., Ausstellen am 02.01.: Das alte Datum bleibt vorbelegt, die Nummer stammt aus dem alten Jahr, und ein Datumshinweis erscheint, falls es dort schon spätere Rechnungen gibt.
- **Fristen:** Sie folgen dem Datum auf der Seite samt Rückfallregel aus PROJ-40. Beim Festschreiben gilt das Ergebnis.
- **Rechnungsbetrag 0 oder negativ** (Schlussrechnung nach hoher Anzahlung): Ausstellen mit Hinweis möglich.
- **Summe über dem Gesamtpreis:** nur Hinweis, wie PROJ-37 und PROJ-40.
- **Schlussrechnung zieht eine nacherfasste Rechnung ab:** keine Sperre, sie ist schon ausgestellt.
- **Teilrechnung ist ausgestellt, ihr Abzug liegt in einer offenen Schlussrechnung:** Die Schlussrechnung zeigt nun die Nummer; der Betrag bleibt gleich.
- **Kleinunternehmer-Status wechselt zwischen ausgestellter Teilrechnung und Schlussrechnung:** Die Teilrechnung bleibt wie ausgestellt. Die Schlussrechnung folgt der Buchung; die Seite zeigt einen Hinweis, wenn die Abzüge anders besteuert sind. Siehe Open Questions.
- **Gast ohne Hauptgast oder anonymisiert:** Empfängerkopie gilt; Block 3 und {Gast} zeigen „Gelöschter Gast“, wie im Entwurf, und werden so festgeschrieben, falls gewählt.
- **Stammdaten werden unvollständig, während die Seite offen ist:** neue Sperre beim Ausstellen.
- **Sitzung abgelaufen:** Hinweis zur Anmeldung, Eingaben auf der Seite gehen nicht auf den Entwurf über, nichts ist ausgestellt.
- **Sehr langer Entwurf:** Mehrseitige PDFs werden normal abgelegt; die Vorschau zeigt alle Seiten.
- **Keine Verbindung beim Ausstellen:** Meldung, Seite bleibt, erneuter Versuch möglich.

## Technical Requirements
- **Sicherheit:** Sämtliche Regeln (Rolle, Sperren, Eindeutigkeit, Unveränderlichkeit) gelten auf dem Server. Die Häkchen müssen beim Absenden mitkommen, damit das Ausstellen ohne Bestätigung abgelehnt wird.
- **Alles oder nichts:** Kein Zustand mit Nummer, aber ohne PDF, oder umgekehrt. Verwaiste Dateien werden bereinigt.
- **Datenschutz:** PDFs privat je Kunde, kein öffentlicher Link; Aussteller und Logo kommen nie aus dem Browser.
- **Aufbewahrung:** Ausgestellte Rechnungen und ihre PDFs werden nicht automatisch gelöscht.
- **Gleichheit:** Das abgelegte PDF entspricht der Vorschau bis auf den Aufdruck, einschließlich Umbruch und Seiten.
- **Leistung:** Ausstellen läuft ohne spürbare Blockade, mit sichtbarem Fortschritt und bleibt innerhalb der Grenzen der Serverfunktion.
- **Browser:** Chrome, Firefox, Safari; Handy ab 375 px.
- **Vor dem Bau klären:** PROJ-40 BUG-5 (Seite bleibt nach dem Speichern sporadisch auf dem Formular), damit das nach dem Ausstellen nicht auftritt.

## Open Questions
- [ ] Vor dem ersten echten Ausstellen: Drucktest des Adressfelds mit dem tatsächlich verwendeten Fensterkuvert (aus PROJ-41 offen, nicht einzeln bestätigt)
- [ ] Steuerberater: Sind Rechnungsdaten außerhalb der Nummernreihenfolge zulässig, wenn die Nummern fortlaufend sind?
- [ ] Steuerberater: Reicht als Übergang bis PROJ-44 die außerhalb erstellte, nacherfasste Gutschrift?
- [ ] Steuerberater: Beginn und Länge der Aufbewahrungsfrist für die Löschsperre (angenommen: 7 Jahre ab Ende des Kalenderjahres des Rechnungsdatums)
- [ ] Steuerberater: Schlussrechnung, wenn sich der Kleinunternehmer-Status nach einer ausgestellten Teilrechnung geändert hat (offen aus PROJ-40)
- [ ] PROJ-43: Sammel-Ausgabe aller PDFs, damit ein Kunde beim Verlassen der App seine Rechnungen mitnehmen kann

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kein Rückweg in der App nach dem Ausstellen; Korrektur bis PROJ-44 über außerhalb erstellte, nacherfasste Gutschrift | Nichts am Beleg ändert sich, und es entsteht kein Sonderzustand, den das Storno wieder ablösen müsste; Zurücknehmen könnte schon verschickte Rechnungen verschwinden lassen | 2026-11-05 |
| Rechnungsstorno als PROJ-44, vor dem Channex-Block | Die Übergangslösung soll den Pilotstand nicht erreichen (Nutzer: als nächste freie Nummer vormerken) | 2026-11-05 |
| Datum passt nicht zur Nummernfolge: nur Hinweis mit „Datum auf heute setzen“ | Beim Auffüllen von Lücken ist das ältere Datum gerade richtig | 2026-11-05 |
| Unbekannte Zeichen, Aussteller-Überlauf, gekürzte Fußzeile sperren; fehlendes Logo mit Häkchen | Inhaltliche Mängel lassen sich danach kaum noch korrigieren und vorher leicht beheben; ein fehlendes Logo macht die Rechnung nicht falsch, ein Speicherproblem soll dringende Rechnungen nicht aufhalten | 2026-11-05 |
| Buchung geändert: Häkchen; Buchung storniert: Sperre, bis der Entwurf gespeichert ist | Abweichungen sind oft gewollt; „Positionen neu übernehmen“ überschreibt händische Änderungen. Eine Rechnung über Übernachtungen, die nicht stattfinden, ist fast immer falsch | 2026-11-05 |
| Vorschlag ohne Rückfrage, Lücke mit Hinweis, höher/anderes Format/anderes Jahr mit Häkchen und genannter Folge, Duplikat abgelehnt | Ein Tippfehler nach oben wäre dauerhaft, weil die Folge von der höchsten Nummer ausgeht; eine Sperre wäre aber für bewusste Sprünge und Vorjahres-Rechnungen zu streng | 2026-11-05 |
| Option: Ausstellen mit Häkchen, Buchungsstatus bleibt | Anzahlungsrechnung kann der Weg zur Fixierung sein; bewusst statt versehentlich | 2026-11-05 |
| Kunde mit ausgestellter Rechnung innerhalb der Frist nicht löschbar, nur deaktivierbar | Einziges Exemplar, Aufbewahrungspflicht geht vor; ein Fehlgriff wäre nicht rückgängig zu machen; nacherfasste bleiben ausgenommen, Original liegt im Altsystem | 2026-11-05 |
| Künftiges Datum sperrt das Ausstellen, Entwürfe dürfen es behalten | Entwurf kann bis zum Datum warten; schützt die Nummernfolge; einheitlich mit PROJ-37 | 2026-11-05 |
| Eigene Seite mit PDF statt Dialog | Kontrolle gehört zu einem unveränderbaren Beleg; Platz für Prüfungen und Häkchen, auch am Handy | 2026-11-05 |
| Aufdruck „Entwurf“ bis zuletzt, auch mit vorgesehener Nummer | Kein PDF vor dem Ausstellen, das wie eine echte Rechnung aussieht | 2026-11-05 |
| Datum und Nummer auf der Seite werden nur beim Ausstellen übernommen | Die Seite verändert den Entwurf nicht, Ausprobieren bleibt folgenlos | 2026-11-05 |
| Das abgelegte PDF ist die Rechnung und wird nie neu erzeugt | Beleg bleibt auch bei Änderungen an Vorlage und Schriften unverändert | 2026-11-05 |

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
