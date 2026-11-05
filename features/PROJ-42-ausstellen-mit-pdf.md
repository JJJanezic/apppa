# PROJ-42: Ausstellen mit PDF

## Status: Deployed
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
- Die Seite wechselt zur **Detailseite der Rechnung** mit Meldung. Status „ausgestellt“, alle festgehaltenen Angaben, Knopf „PDF öffnen“ (Download-Name mit Rechnungsnummer). Keine Knöpfe zum Bearbeiten, Löschen oder Ändern der Buchung.
- Dort steht ein kurzer Korrekturhinweis: Eine falsche Rechnung wird über eine außerhalb erstellte Gutschrift korrigiert, die mit negativen Beträgen nacherfasst wird, danach folgt eine neue Rechnung. Ist „Rechnungen nacherfassen“ ausgeschaltet, nennt der Hinweis auch diesen Schalter.
- **Rechnungsliste, Buchungsdetail, Buchungsübersicht:** Status „ausgestellt“ und die Nummer statt „Entwurf“. Der Betrag wandert von „In Entwürfen“ zu „Verrechnet“. Die Buchung zählt beim Filter als „mit Rechnung“.
- **Andere Entwürfe:** Die Vorauswahl der Positionen zeigt „bereits in Rechnung 2026-0012“, die Abzüge der Schlussrechnung die Nummer.
- **Einstellungen → Rechnungen:** Die Nummernvorschau zählt die neue Nummer mit, die Warnung beim Ändern des Nummernkreises greift.

### Abgezogene nacherfasste Rechnungen
Zieht eine ausgestellte Schlussrechnung eine nacherfasste Rechnung ab, gilt für diese nacherfasste Rechnung:
- **Gesperrt:** Löschen und Ändern von Positionen, Beträgen, Kleinunternehmer-Schalter und Buchungsverknüpfung. Die Meldung nennt die Schlussrechnung.
- **Weiter änderbar:** Nummer, Datum, Empfänger, Gast und PDF, damit sich Erfassungsfehler noch beheben lassen. Die festgeschriebene Fassung und das PDF der Schlussrechnung nennen weiterhin die Angaben vom Zeitpunkt des Ausstellens.

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
- [x] Angenommen ein Inhaber öffnet die Detailseite eines Entwurfs, wenn die Seite lädt, dann gibt es den Knopf „Ausstellen“
- [x] Angenommen ein Mitarbeiter öffnet einen Entwurf, wenn die Seite lädt, dann gibt es keinen Knopf „Ausstellen“, und ein direkter Aufruf der Seite oder des Ausstellens wird abgelehnt
- [x] Angenommen ein Betreiber ohne Mitgliedschaft, wenn er das Ausstellen direkt aufruft, dann wird es abgelehnt
- [x] Angenommen ein deaktivierter Kunde, wenn der Inhaber einen Entwurf öffnet, dann ist Ausstellen nicht möglich
- [x] Angenommen ein Entwurf mit offenen Pflichtangaben, wenn der Inhaber „Ausstellen“ wählt, dann öffnet sich die Seite und nennt jede offene Angabe mit Link zur Abhilfe
- [x] Angenommen die Seite „Rechnung ausstellen“, wenn sie lädt, dann zeigt sie Datum, vorgeschlagene Nummer, Prüfungen und die PDF-Vorschau mit Aufdruck „Entwurf“
- [x] Angenommen die Seite ist am Handy (375 px) geöffnet, wenn der Inhaber sie bedient, dann stehen die Bereiche untereinander, ohne seitliches Scrollen und mit Bedienelementen von mindestens 44 px
- [x] Angenommen Datum oder Nummer wurden geändert, wenn die Vorschau aktualisiert ist, dann zeigt sie beide samt ersetztem Platzhalter {Rechnungsnummer} und neu berechneten Fristen
- [x] Angenommen Datum oder Nummer wurden geändert, wenn der Inhaber die Seite ohne Ausstellen verlässt, dann ist der Entwurf unverändert
- [x] Angenommen ein bestehender Entwurf aus PROJ-40, wenn keine Sperre besteht, dann lässt er sich ohne Nacharbeit ausstellen

### Rechnungsdatum
- [x] Angenommen ein Datum in der Zukunft, wenn die Seite es prüft, dann ist „Rechnung ausstellen“ gesperrt und „Datum auf heute setzen“ wird angeboten
- [x] Angenommen ein Entwurf mit künftigem Datum, wenn der Inhaber ihn speichert, dann bleibt das wie bisher möglich
- [x] Angenommen die höchste Nummer 2026-0050 trägt den 20.10.2026 und das Datum ist der 14.10.2026, wenn die Seite lädt, dann erscheint ein Hinweis mit dieser Rechnung und Ausstellen bleibt möglich
- [x] Angenommen dieser Hinweis, wenn der Inhaber „Datum auf heute setzen“ wählt, dann ändern sich Datum, Fristen und Vorschau und der Hinweis verschwindet
- [x] Angenommen „jährlich neu“ und das Datum wechselt ins Vorjahr, wenn die Seite neu rechnet, dann schlägt sie die nächste Nummer dieses Jahres vor
- [x] Angenommen der Inhaber hat die Nummer von Hand geändert, wenn das Datum danach geändert wird, dann bleibt seine Nummer stehen und wird neu geprüft

### Rechnungsnummer
- [x] Angenommen Rechnungen bis 2026-0041, wenn die Seite lädt, dann ist 2026-0042 vorgeschlagen und braucht keine Bestätigung
- [x] Angenommen eine freie Nummer unter dem Vorschlag, wenn sie eingegeben wird, dann erscheint „Füllt eine Lücke“ ohne Häkchen
- [x] Angenommen eine Nummer über dem Vorschlag, wenn sie eingegeben wird, dann nennt die Seite die danach folgende Nummer und verlangt das Häkchen
- [x] Angenommen eine Nummer in anderem Format oder mit anderem Jahr als dem des Datums, wenn sie eingegeben wird, dann verlangt die Seite das Häkchen
- [x] Angenommen eine vergebene Nummer, auch nacherfasst oder in anderer Schreibung, wenn sie eingegeben wird, dann ist Ausstellen gesperrt
- [x] Angenommen zwei Personen stellen gleichzeitig mit derselben Nummer aus, wenn beide absenden, dann gelingt es genau einer, die andere erhält die Meldung und einen neuen Vorschlag und ihr Entwurf bleibt unverändert
- [x] Angenommen eine eingegebene Nummer, wenn der Knopf „Vorschlag übernehmen“ gewählt wird, dann steht wieder die vorgeschlagene Nummer im Feld

### Sperren
- [x] Angenommen eine fehlende Pflichtangabe, wenn jemand am Formular vorbei ausstellt, dann lehnt der Server ab
- [x] Angenommen eine Schlussrechnung zieht einen Teilrechnungs-Entwurf ab, wenn die Seite lädt, dann ist Ausstellen gesperrt und ein Link führt zur Teilrechnung
- [x] Angenommen diese Teilrechnung wurde ausgestellt, wenn die Seite neu lädt, dann ist die Sperre weg und der Abzug nennt die Nummer
- [x] Angenommen eine abgezogene Rechnung existiert nicht mehr, wenn die Seite lädt, dann ist Ausstellen gesperrt, bis der Entwurf neu gespeichert ist
- [x] Angenommen die Buchung wurde seit dem letzten Speichern storniert, wenn die Seite lädt, dann ist Ausstellen gesperrt, bis der Entwurf angepasst und gespeichert ist
- [x] Angenommen der Entwurf wurde nach dem Storno gespeichert, wenn die Seite lädt, dann besteht diese Sperre nicht mehr
- [x] Angenommen ein Text enthält ein Zeichen, das die Schrift nicht kennt, wenn die Seite lädt, dann ist Ausstellen gesperrt und das Zeichen wird genannt
- [x] Angenommen der Aussteller-Block passt auch bei 6 pt nicht, wenn die Seite lädt, dann ist Ausstellen gesperrt, mit Link zu Stammdaten und Briefpapier
- [x] Angenommen die Fußzeile wird gekürzt, wenn die Seite lädt, dann ist Ausstellen gesperrt, mit Link zur Fußzeile
- [x] Angenommen die Fußzeile wird nur verkleinert, wenn die Seite lädt, dann erscheint nur ein Hinweis

### Häkchen
- [x] Angenommen die Buchung wurde seit dem Entwurf geändert, aber nicht storniert, wenn die Seite lädt, dann erscheint das Häkchen mit Link zum Entwurf und der Knopf ist bis zur Bestätigung inaktiv
- [x] Angenommen das Häkchen ist gesetzt, wenn ausgestellt wird, dann entspricht die Rechnung genau dem Entwurf
- [x] Angenommen die Buchung ist eine Option, wenn die Seite lädt, dann erscheint das zugehörige Häkchen
- [x] Angenommen eine Option, wenn ihre Rechnung ausgestellt ist, dann ist der Status der Buchung unverändert
- [x] Angenommen das Logo lässt sich nicht laden, wenn die Seite lädt, dann erscheint das Häkchen „Ohne Logo ausstellen“ und das PDF enthält kein Logo
- [x] Angenommen mehrere Fälle treffen zu, wenn ein Häkchen fehlt, dann bleibt der Knopf inaktiv
- [x] Angenommen ein Häkchen ist gesetzt und der Fall ändert sich (etwa andere Nummer), wenn die Seite neu prüft, dann ist das Häkchen wieder leer

### Ausstellen
- [x] Angenommen keine Sperre und alle Häkchen gesetzt, wenn der Inhaber „Rechnung ausstellen“ wählt, dann hat die Rechnung Nummer, Status „ausgestellt“ und ein abgelegtes PDF ohne Aufdruck
- [x] Angenommen die PDF-Erzeugung oder Ablage scheitert, wenn ausgestellt wird, dann bleibt es ein Entwurf ohne Nummer, die Nummer bleibt frei, eine Meldung erscheint und ein neuer Versuch ist möglich
- [x] Angenommen ein Doppelklick auf den Knopf, wenn ausgestellt wird, dann entsteht genau eine Rechnung
- [x] Angenommen die Antwort geht unterwegs verloren, wenn der Inhaber es erneut versucht, dann entsteht keine zweite Rechnung und er landet bei der ausgestellten
- [x] Angenommen der Entwurf wurde in einem anderen Fenster geändert, wenn ausgestellt wird, dann wird nicht ausgestellt und die Seite zeigt den neuen Stand
- [x] Angenommen die Seite ist offen und danach entsteht ein neuer Mangel, wenn ausgestellt wird, dann wird nicht ausgestellt und die Seite zeigt ihn
- [x] Angenommen eine Rechnung wurde ausgestellt, wenn das Protokoll angesehen wird, dann stehen Person und Zeitpunkt darin

### Festschreiben
- [x] Angenommen eine ausgestellte Rechnung, wenn Buchung, Gast, Stammdaten, Logo, Briefpapier oder Bausteine geändert werden, dann bleiben ihr PDF und ihre Angaben unverändert
- [x] Angenommen eine ausgestellte Rechnung, wenn der Gast anonymisiert wird, dann bleiben PDF und Empfänger unverändert
- [x] Angenommen eine ausgestellte Rechnung, wenn jemand sie am Formular vorbei ändern oder löschen will, dann lehnt der Server ab, auch beim Inhaber
- [x] Angenommen eine ausgestellte Rechnung, wenn jemand PDF oder Buchungsverknüpfung ersetzen oder entfernen will, dann lehnt der Server ab
- [x] Angenommen ein Entwurf wird ausgestellt, wenn die Buchung Kleinunternehmer-Status hat, dann ist dieser an der Rechnung festgehalten, und ein späterer Statuswechsel ändert sie nicht

### Detailseite und Listen
- [x] Angenommen eine ausgestellte Rechnung, wenn der Inhaber sie öffnet, dann sieht er Status, Angaben, „PDF öffnen“ und den Korrekturhinweis, aber weder Bearbeiten noch Löschen
- [x] Angenommen „Rechnungen nacherfassen“ ist ausgeschaltet, wenn der Korrekturhinweis erscheint, dann nennt er den Schalter
- [x] Angenommen ein Mitarbeiter, wenn er die ausgestellte Rechnung öffnet, dann kann er das PDF öffnen und nichts ändern
- [x] Angenommen ein Nutzer eines anderen Kunden, wenn er Rechnung oder PDF direkt aufruft, dann wird es abgelehnt
- [x] Angenommen eine ausgestellte Rechnung, wenn die Rechnungsliste lädt, dann zeigt sie Nummer und Status „ausgestellt“
- [x] Angenommen ein Entwurf über € 500, wenn er ausgestellt ist, dann steigt „Verrechnet“ um € 500 und „In Entwürfen“ sinkt um € 500
- [x] Angenommen eine Buchung mit ausgestellter Rechnung, wenn die Buchungsübersicht nach „mit Rechnung“ filtert, dann erscheint sie, mit Nummer als Link
- [x] Angenommen eine ausgestellte Rechnung enthält eine Position, wenn ein neuer Entwurf zur Buchung entsteht, dann ist die Position abgewählt mit „bereits in Rechnung …“
- [x] Angenommen eine Rechnung wurde ausgestellt, wenn der Inhaber den Nummernkreis ändert, dann erscheint die Warnung aus PROJ-39
- [x] Angenommen eine Rechnung 2026-0042 wurde ausgestellt, wenn die Nummernvorschau lädt, dann zeigt sie 2026-0043

### Abgezogene nacherfasste Rechnungen
- [x] Angenommen eine ausgestellte Schlussrechnung zieht eine nacherfasste Rechnung ab, wenn der Inhaber die nacherfasste Rechnung löschen will, dann wird es abgelehnt und die Meldung nennt die Schlussrechnung, auch am Formular vorbei
- [x] Angenommen dieselbe nacherfasste Rechnung, wenn der Inhaber Positionen, Beträge, Kleinunternehmer-Schalter oder Buchung ändern will, dann wird es abgelehnt und die Meldung nennt die Schlussrechnung
- [x] Angenommen dieselbe nacherfasste Rechnung, wenn der Inhaber Nummer, Datum, Empfänger, Gast oder PDF ändert, dann wird gespeichert, und PDF, festgeschriebene Fassung und Betrag der Schlussrechnung bleiben unverändert
- [x] Angenommen eine nacherfasste Rechnung wird nur von einem Schlussrechnungs-Entwurf abgezogen, wenn der Inhaber sie ändert oder löscht, dann geht das wie bisher und der Entwurf rechnet neu

### Kunde löschen
- [x] Angenommen ein Kunde mit einer ausgestellten Rechnung innerhalb der Frist, wenn der Betreiber ihn löschen will, dann ist es gesperrt, der Dialog nennt die Anzahl und verweist auf „Deaktivieren“
- [x] Angenommen derselbe Kunde, wenn das Löschen am Dialog vorbei aufgerufen wird, dann lehnt der Server ab
- [x] Angenommen ein Kunde nur mit nacherfassten Rechnungen und Entwürfen, wenn der Betreiber ihn löscht, dann geht es wie bisher
- [x] Angenommen ein Kunde mit ausgestellten Rechnungen, wenn der Betreiber ihn deaktiviert, dann geht das und die Rechnungen bleiben lesbar

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
- [x] Nacherfasste Rechnung, die eine ausgestellte Schlussrechnung abzieht: Darf sie noch gelöscht oder im Betrag geändert werden? Nein, siehe „Abgezogene nacherfasste Rechnungen“ (Nutzer, 2026-11-05)

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
| Nacherfasste Rechnung, die eine ausgestellte Schlussrechnung abzieht: Löschen und Ändern von Beträgen, Positionen, Kleinunternehmer-Schalter und Buchung gesperrt; Nummer, Datum, Empfänger, Gast und PDF bleiben änderbar | Schützt, was in die Rechnung eingeflossen ist; Erfassungsfehler bleiben korrigierbar. Schalter und Buchung gehören dazu, weil sie USt und Zuordnung des Abzugs bestimmen | 2026-11-05 |
| Das abgelegte PDF ist die Rechnung und wird nie neu erzeugt | Beleg bleibt auch bei Änderungen an Vorlage und Schriften unverändert | 2026-11-05 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Ausstellen ist ein Zustandswechsel in der bestehenden Rechnungstabelle | Vorbereitet seit PROJ-40; Entwürfe aus der Produktion bleiben ohne Migration ausstellbar | 2026-11-05 |
| Reihenfolge: prüfen, PDF erzeugen, ablegen, dann erst die Nummer in einem Datenbankschritt vergeben | Keine reservierte Nummer und kein Zustand mit Nummer ohne PDF; übrig gebliebene Dateien entfernt die vorhandene Bereinigung | 2026-11-05 |
| Eigene Schnittstelle unter `/api` statt Server-Aktion | Arbeitsprozess und Schriften werden laut Build-Einstellung nur für `/api` mitgeliefert; Lauf kann länger dauern | 2026-11-05 |
| Vollständiger Seitenaufruf nach dem Ausstellen | Umgeht das sporadische Hängenbleiben nach Server-Aktionen und zeigt sicher frische Daten | 2026-11-05 |
| Schreibschritt nur für den Server freigegeben, Person wird mitgegeben | Sonst könnte ein Aufruf am Server vorbei Pflichtangaben umgehen und ein selbst gewähltes PDF festschreiben | 2026-11-05 |
| Prüfung des Stands in der Datenbank, Pflichtangaben und PDF-Meldungen auf dem Server | Die Prüfregel lebt in der App, wo auch das PDF entsteht; die Datenbank sichert den Moment des Festschreibens (Entwurf, Buchung, Nummer, Abzüge) | 2026-11-05 |
| Festgeschriebene Fassung als zusammenhängende Kopie je Rechnung | Detailseite bleibt von späteren Änderungen unabhängig; keine vielen neuen Spalten für Werte, die nur angezeigt werden | 2026-11-05 |
| Prüfsumme des PDFs speichern | Geringer Aufwand; belegt bei einer Prüfung, dass die Datei unverändert ist | 2026-11-05 |
| Unveränderlichkeit in der Datenbank statt nur in den Funktionen | Hält auch bei späteren Funktionen oder Fehlern; die Sammelfunktionen aus PROJ-40 aktualisieren Gesamtbeträge sonst automatisch | 2026-11-05 |
| Vorschau liefert Prüfliste mit | Eine Anfrage je Änderung; Prüfung und PDF stammen aus derselben Erzeugung | 2026-11-05 |
| PDF-Meldung „gekürzt“ getrennt von „verkleinert“ | Nur das Kürzen sperrt laut Spec; heute fällt beides in eine Meldung | 2026-11-05 |
| Sperre abgezogener nacherfasster Rechnungen in der Datenbank | Sonst würden Betrag und Abzug der ausgestellten Schlussrechnung und ihr PDF auseinanderlaufen, weil Gesamtbeträge automatisch neu gebildet werden | 2026-11-05 |
| Keine neuen Pakete | Vorlage, Anzeige und Ablage bestehen seit PROJ-37 und PROJ-41 | 2026-11-05 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Rechnungstabelle:** Entwürfe liegen schon in derselben Tabelle wie nacherfasste Rechnungen. Die Herkunft „ausgestellt“ und die Regel „Nummer fehlt nur beim Entwurf“ sind in der Datenbank vorbereitet. Ausstellen ist ein Zustandswechsel, bestehende Entwürfe brauchen keine Datenmigration.
- **PDF:** Eine Vorlage, Erzeugung in einem eigenen Arbeitsprozess, Meldungen zu Zeichen, Aussteller-Block und Logo (PROJ-41). Der Aufdruck „Entwurf“ ist schon abschaltbar.
- **Nummern:** Regel „nächste Nummer“, Eindeutigkeit je Kunde in der Datenbank (PROJ-39, PROJ-37).
- **Ablage:** Privater Speicherbereich für Rechnungs-PDFs mit täglicher Bereinigung unbenutzter Dateien. Nutzer dürfen dort nichts ändern oder löschen (PROJ-37).
- **Listen und Summen:** „Verrechnet“, „In Entwürfen“, Vorauswahl und Warnung beim Nummernkreis kennen „ausgestellt“ bereits (PROJ-40).

### Ablauf des Ausstellens
```
Inhaber drückt „Rechnung ausstellen“
  |
  v
1. Server prüft Anmeldung, Rolle, Stand des Entwurfs, alle Sperren und Häkchen
  |
  v
2. Server erzeugt das endgültige PDF ohne Aufdruck und prüft dessen Meldungen
  |
  v
3. Server legt das PDF unter zufälligem Namen ab
  |
  v
4. Datenbank in einem einzigen Schritt: nochmals Stand und Nummer prüfen,
   Herkunft „ausgestellt“, Nummer, Datum, PDF, Fassung und Protokoll schreiben
  |
  +-- gelingt  --> Detailseite der Rechnung
  +-- scheitert --> Datei wird entfernt, Entwurf unverändert, Meldung auf der Seite
```
Die Nummer wird erst in Schritt 4 vergeben, also nie reserviert. Scheitert etwas davor, bleibt sie frei. Bleibt wegen eines Abbruchs doch eine Datei übrig, entfernt sie die tägliche Bereinigung, weil keine Rechnung auf sie zeigt. Ein zweiter Versuch derselben Anfrage findet keinen Entwurf mehr und führt zur bereits ausgestellten Rechnung.

### Seiten und Bausteine der Oberfläche
```
Entwurf-Detailseite (besteht)
+-- Knopf „Ausstellen“ (neu, nur Inhaber)

Seite „Rechnung ausstellen“ (neu, /rechnungen/[id]/ausstellen)
+-- Formularbereich
|   +-- Rechnungsdatum mit „Datum auf heute setzen“
|   +-- Rechnungsnummer mit „Vorschlag übernehmen“ und Hinweis zur Folge
|   +-- Prüfungen
|   |   +-- Sperren mit Link zur Abhilfe
|   |   +-- Häkchen
|   |   +-- Hinweise
|   +-- Knopf „Rechnung ausstellen“ mit Fortschritt und Hinweis auf die Endgültigkeit
|   +-- „Zurück zum Entwurf“
+-- PDF-Vorschau (besteht, PROJ-41), übernimmt Datum und Nummer

Rechnungs-Detailseite (besteht, neue Darstellung für „ausgestellt“)
+-- Status „ausgestellt“, Datum und Person
+-- Angaben aus der festgeschriebenen Fassung
+-- „PDF öffnen“
+-- Korrekturhinweis
(keine Knöpfe zum Bearbeiten, Löschen, PDF ersetzen oder Buchung ändern)

Betreiber: Gefahrenbereich des Kunden (besteht)
+-- Löschen gesperrt, mit Anzahl und Verweis auf „Deaktivieren“
```
Rechnungsliste, Buchungsdetail und Buchungsübersicht bleiben im Aufbau gleich. Sie zeigen nur den neuen Status und die Nummer.

### Regeln an einer Stelle
- **Prüfregel:** Eine einzige Regel ermittelt aus Entwurf, Buchung, anderen Rechnungen, Nummer, Datum und PDF-Meldungen die Listen „Sperren“, „Häkchen“ und „Hinweise“. Seite und Ausstellen nutzen dieselbe Regel, so können sie nicht auseinanderlaufen. Sie läuft bei jedem Ausstellen auf dem Server neu.
- **Nummernregel:** Die bestehende Regel bekommt eine Einordnung: Vorschlag, Lücke, über dem Vorschlag, anderes Format, anderes Jahr, vergeben. Dazu kommt der Vergleich mit den Daten der Nachbarn. Dafür liefert die Datenbank alle Nummern samt Datum.
- **Storno-Erkennung:** Die Buchung ist storniert und der gespeicherte Fingerabdruck aus PROJ-40 weicht ab. Eine eigene Spalte ist nicht nötig.
- **Fußzeile:** Die PDF-Erzeugung meldet bisher nur „verkleinert“, auch wenn zusätzlich gekürzt wurde. Sie meldet künftig beides getrennt, weil nur das Kürzen sperrt.

### Datenmodell (in Worten)
Neu an jeder ausgestellten Rechnung:
- **Ausgestellt am** und **ausgestellt von**
- **Festgeschriebene Fassung:** alle Werte, die auf der Rechnung stehen, als eine zusammenhängende Kopie: Aussteller, Empfänger, Zeitraum, Wohnung, Gastnamen, Positionen, Abzüge mit Nummer und Betrag, USt je Satz, Kleinunternehmer-Status, Texte mit ersetzten Platzhaltern, Fristen. Die Detailseite zeigt nur diese Kopie.
- **Prüfsumme des PDFs:** belegt später, dass die Datei unverändert ist
- **Ohne Logo ausgestellt:** vermerkt das gesetzte Häkchen

Beim Ausstellen gesetzt: Herkunft „ausgestellt“, Nummer, Rechnungsdatum, PDF-Speicherort, Kleinunternehmer-Status und Gesamtbetrag. Positionen und Abzüge bleiben in ihren Tabellen und werden damit ebenfalls unveränderlich.

Für die anderen Herkünfte bleiben die neuen Felder leer. Eine Datenmigration ist nicht nötig.

### Unveränderlichkeit
Sie wird in der Datenbank selbst durchgesetzt, nicht nur durch fehlende Knöpfe: Jeder Versuch, eine ausgestellte Rechnung, ihre Positionen oder Abzüge zu ändern oder zu löschen, wird abgelehnt.

Zwei enge Ausnahmen:
- **Gastverknüpfung:** Sie darf beim Zusammenführen von Gästen wechseln (PROJ-7). Rechnung und PDF ändern sich dabei nicht.
- **Kunde löschen:** Nach Ablauf der Aufbewahrungsfrist darf die Rechnung mit dem Kunden gelöscht werden.

Die Sammelfunktionen zu Gesamtbeträgen und Abzügen aus PROJ-40 dürfen ausgestellte Rechnungen nicht mehr anfassen.

### Abgezogene nacherfasste Rechnungen
Speichern und Löschen nacherfasster Rechnungen prüfen in der Datenbank, ob eine ausgestellte Schlussrechnung sie abzieht, und lehnen die gesperrten Änderungen ab. Die festgeschriebene Fassung enthält Nummer und Betrag des Abzugs als Kopie, spätere Korrekturen an der nacherfassten Rechnung wirken dort nicht.

### Kunde löschen
Die Löschfunktion prüft die Frist in der Datenbank und lehnt ab, wenn eine ausgestellte Rechnung noch darunter fällt. Der Betreiber-Dialog zeigt die Anzahl schon vorher. Ein Aufruf am Dialog vorbei scheitert ebenfalls.

### Rechte
- **Ausstellen:** nur über die neue Schnittstelle. Der Schreibschritt in der Datenbank ist nur für den Server freigegeben. So kann niemand am Server vorbei eine Rechnung mit einem selbst gewählten PDF festschreiben. Der Server gibt die handelnde Person für das Protokoll mit.
- **Lesen:** wie bei nacherfassten Rechnungen, für alle Mitglieder des Kunden. Auf Datenbankebene darf der Betreiber schon heute nicht-Entwürfe lesen (PROJ-40); die Oberfläche bietet ihm dafür nichts an. PROJ-42 ändert daran nichts.

### Schnittstellen
- **Vorschau und Prüfung:** Die Entwurfsvorschau nimmt zusätzlich Datum und Nummer an und liefert neben dem PDF die Prüfliste. Weiterhin wird nichts gespeichert oder zwischengespeichert. Veraltete Anfragen werden abgebrochen, wie in PROJ-41.
- **Ausstellen:** eine eigene Schnittstelle unter `/api/rechnungen/…`. Der Browser wechselt danach mit einem vollständigen Seitenaufruf zur Rechnung.

### Für /frontend und /backend
- **/frontend:** Seite „Rechnung ausstellen“, Prüfregel, Nummerneinordnung, Vorschau mit Datum und Nummer, Detaildarstellung, Korrekturhinweis, Betreiber-Dialog. PROJ-40 BUG-5 klären, bevor die Weiterleitung gebaut wird. Bis zur Migration zeigt die Seite die Prüfungen, und das Ausstellen meldet „wird eingerichtet“.
- **/backend:** Neue Felder, Schreibfunktion, Unveränderlichkeit, Lesefunktion für Nummern mit Datum, Löschsperre, Ablage und Schnittstelle, Änderung an den Sammelfunktionen. Die RLS-Regeln bleiben unverändert.

### Für /qa
- Gleichzeitiges Ausstellen mit derselben Nummer, Doppelklick, Abbruch nach der Ablage
- Direkte Änderungsversuche an ausgestellten Rechnungen, Positionen, Abzügen und Dateien
- Vergleich von Vorschau und abgelegtem PDF (Seitenzahl, Umbruch, Text)
- PDF-Erzeugung und Ablage auf Staging unter Vercel
- Vorhandene Entwürfe aus der Produktion in Staging prüfen, soweit vergleichbare Testdaten vorliegen

### Abhängigkeiten
Keine neuen Pakete.

## Implementation Notes (Frontend)

**Gebaut:** Seite `/rechnungen/[id]/ausstellen` mit Datum, Nummer, Prüfliste, Häkchen und PDF-Vorschau; Knopf „Ausstellen“ auf dem Entwurf; Prüfregel und Nummerneinordnung; Vorschau mit Datum, Nummer und Prüfliste; Schnittstelle zum Ausstellen mit allen Prüfungen bis zum endgültigen PDF; Meldung „gekürzt“ der PDF-Erzeugung; Bestätigung und Korrekturhinweis auf der Detailseite; Löschsperre im Betreiber-Bereich.

**Regeln und Dateien**
- `src/lib/invoice-issue.ts`: `classifyInvoiceNumber`, `dateConflict`, `issueChecks`, `issueAllowed`, `retentionCutoff` (Tests: `invoice-issue.test.ts`)
- `src/lib/invoice-issue-data.ts`: `loadIssueState`, `checksFor`, `getNumberedInvoices`
- `src/app/api/rechnungen/vorschau/route.ts`: Anfrage `{ draftId, issue: { invoiceDate, number } }`, nur Inhaber; Prüfliste steht in den PDF-Meldungen
- `src/app/api/rechnungen/[id]/ausstellen/route.ts`: nimmt Datum, Nummer, Stand des Entwurfs und gesetzte Häkchen an
- `src/components/invoice-issue/`: `issue-form.tsx`, `issued-notes.tsx`
- `src/lib/invoice-pdf/respond.ts`: `renderInvoice` liefert PDF und Meldungen; `pdfResponse` baut darauf auf

**Abweichungen vom Tech Design**
- Nummern samt Datum liest die App seitenweise aus der Tabelle, bis eine leere Antwort kommt, statt über eine neue Datenbankfunktion. Die Grenze von PostgREST spielt so keine Rolle, und es braucht nichts Neues in der Datenbank.
- Die Häkchen tragen eine Kennung je Fall (bei der Nummer samt Nummer). Ändert sich der Fall, ist das Häkchen leer, und der Server verlangt die neue Kennung.
- „Datum auf heute setzen“ erscheint immer, wenn das Datum nicht heute ist, nicht nur bei Hinweisen.

**PROJ-40 BUG-5 (Seite bleibt nach „Entwurf speichern“ auf dem Formular, Befund aus PROJ-15 QA):** Nicht geklärt. Der betroffene Test lief 6 von 6 Mal grün, der Fehler ließ sich nicht nachstellen. Das Ausstellen ist nicht betroffen: Es läuft nicht über eine Server-Aktion, und danach folgt ein vollständiger Seitenaufruf. Der Befund bleibt bei PROJ-40 offen.

**Geprüft**
- `npm run lint`: ohne Fehler; Unit-Tests 676 grün; `render.integration.test.ts` 16 grün
- E2E `tests/PROJ-42-ausstellen-mit-pdf.spec.ts` im Desktop-Projekt grün; Layout auch im Handy-Projekt grün, im Tablet-Projekt nicht gelaufen
- Am Bild geprüft: Desktop und Handy
- Nicht geprüft: Firefox und Safari; Ablage und echtes Ausstellen (Backend fehlt); Darstellung ausgestellter Rechnungen und Löschsperre im Betreiber-Bereich mit echten Daten

## Implementation Notes (Backend)

**Migrationen (nur Dev):** `20261105093618_invoice_issue.sql`, `20261105093734_invoice_issue_error_code.sql` (die Löschsperre brauchte einen eigenen Code, P0017 war schon belegt). RLS unverändert. `db advisors`: nur der schon bekannte Auth-Hinweis zur OTP-Dauer.

**Datenbank**
- `invoices`: `issued_at`, `issued_by`, `issued_snapshot`, `pdf_sha256`, `issued_without_logo`; Prüfregel: die Felder sind genau bei „ausgestellt“ gesetzt
- `public.issue_invoice(p_input)`: nur `service_role`. Prüft Person, Kunde, Stand von Entwurf und Buchung, Datum, Nummer, Abzüge, Betrag und Datei, dann der Zustandswechsel. Setzt für diesen Vorgang die handelnde Person, damit das Protokoll sie nennt
- Trigger `a_protect_issued_*`: lehnen Änderungen an ausgestellten Rechnungen, Positionen und Abzügen ab (P0932), auch mit Systemrechten. Frei bleiben Gastverknüpfung und Herkunft der Textbausteine (Löschen eines Bausteins setzt sie zurück). Löschen geht nur, wenn der Kunde schon weg ist (Kaskade)
- `refresh_deducting_totals`, `detach_deductions`: nur noch Entwürfe
- `save_invoice`, `delete_invoice`: Sperre abgezogener nacherfasster Rechnungen (P0933, Nummer der Schlussrechnung im Detail)
- `admin_delete_tenant`: Löschsperre (P0019)

**Server**
- `src/app/api/rechnungen/[id]/ausstellen/route.ts`: Prüfungen → PDF → Ablage mit Systemrechten → `issue_invoice`; bei Fehlern wird die Datei entfernt
- Stand der Buchung: `bookings.updated_at`, vor dem Laden gelesen. Alle Preisänderungen setzen ihn
- `src/lib/invoice-issue-data.ts`: `issuedSnapshot` kopiert nur, was auf der Rechnung steht, nicht die ganze Buchung samt Mitreisenden

**Oberfläche ergänzt:** Detailseite aus der Fassung (`issued-detail.tsx`) mit Abzügen, USt je Satz der Fassung, Fristen, Person und Zeitpunkt; Meldungen für abgezogene nacherfasste Rechnungen und die Löschsperre.

**Abweichung vom Tech Design:** Die Stand-Prüfung der Buchung nutzt den Zeitstempel statt des Fingerabdrucks, weil die Datenbank den Fingerabdruck nicht berechnen kann. Gelesen wird er erst beim Absenden. Ändert sich die Buchung in den wenigen Sekunden bis zum Festschreiben, auch nur die Notiz, wird das Ausstellen einmal abgelehnt („neu laden“). Danach geht es.

**Bewusst offen:** Wird die Antwort nach dem Hochladen abgebrochen, bleibt eine Datei ohne Rechnung liegen; sie entfernt die tägliche Bereinigung nach 24 Stunden.

**Geprüft**
- Vitest nacheinander (`--no-file-parallelism --maxWorkers=1`): 926 grün, davon 23 neu in `supabase/tests/invoice-issue.integration.test.ts`
- E2E im gebauten Server, Desktop: `PROJ-42` (Ablauf bis zur Detailseite, PDF und Prüfsumme, Nummer inzwischen vergeben, Konflikt, Mitarbeiter, Betreiber), `PROJ-37` komplett, `PROJ-5` Löschen, `PROJ-40` Schlussrechnung und Detail
- Nicht geprüft: PDF und Ablage auf Vercel; Firefox, Safari, Tablet; Handy nur das Layout der Seite; Ablauf mit Logo-Fehler; Detailseite am Bild

## QA Test Results

**Getestet:** 2026-11-05, Dev (localhost, Supabase „apppa-dev“), gebauter Server; Safari gegen `npm run dev`

**Ergebnis:** 68 von 70 Abnahmekriterien erfüllt, 1 scheitert an BUG-1, 1 nicht ausgeführt. 1 High, 2 Medium, 3 Low. **Nicht produktionsreif (BUG-1), Status bleibt In Review.**

### Abnahmekriterien
- **Offen wegen BUG-1:** „Buchung … geändert, dann bleiben PDF und Angaben unverändert“: Das Ergebnis stimmt, aber die Änderung an der Buchung selbst wird teils abgelehnt.
- **Nicht ausgeführt:** „PDF-Erzeugung oder Ablage scheitert“: nur im Code gelesen (Antwort `pdfFailed`, Datei wird entfernt). Der Fehlerfall wurde nicht erzwungen.
- **Nur im Code, nicht einzeln ausgeführt:** Doppelklick (Knopf gesperrt, zweiter Aufruf der Schnittstelle getestet); „keine Verbindung“; „Sitzung abgelaufen“ nur als Antwort 401; Änderungen an Stammdaten, Logo und Briefpapier nach dem Ausstellen (PDF wird nie neu erzeugt).
- **Alle übrigen** sind durch `tests/PROJ-42-ausstellen-mit-pdf.spec.ts`, `src/lib/invoice-issue.test.ts` oder `supabase/tests/invoice-issue.integration.test.ts` belegt.

### Security Audit
- [x] Ohne Anmeldung 401, Mitarbeiter 403, fremder Inhaber 404 (Schnittstellen und Seite)
- [x] `issue_invoice` für Inhaber, Mitarbeiter und Betreiber nicht aufrufbar (42501); Mitarbeiter als handelnde Person abgelehnt
- [x] Inhaber schreibt direkt in die Tabellen: keine Wirkung; auch mit Systemrechten lehnt der Schutz Änderungen ab
- [x] PDF einer ausgestellten Rechnung: nicht überschreib- oder löschbar; Mitarbeiter liest, fremder Inhaber nicht
- [x] Häkchen werden auf dem Server geprüft; eine stornierte Buchung lässt sich auch mit gefälschtem Häkchen nicht ausstellen
- [x] HTML in Empfänger und Nummer wird nur als Text angezeigt
- [x] Ungültige Eingaben: 400, nichts wird ausgestellt
- [ ] Keine Mengenbegrenzung: Jede Vorschau startet einen Arbeitsprozess; nur für angemeldete Inhaber. Gilt schon seit PROJ-41 (BUG-6)
- Betreiber darf ausgestellte Rechnungen und PDFs auf Datenbankebene lesen (seit PROJ-37/40, bewusst unverändert)

### Bugs

#### BUG-1: Zusatzkosten-Position lässt sich nach dem Ausstellen nicht mehr aus der Buchung entfernen
- **Severity:** High
- **Schritte:** Buchung mit Zusatzkosten, Rechnung mit dieser Position ausstellen, Position aus der Buchung entfernen und speichern
- **Erwartet:** Buchung wird gespeichert, Rechnung bleibt unverändert
- **Tatsächlich:** Speichern scheitert (P0932), der Nutzer sieht eine allgemeine Fehlermeldung. Beim Entfernen setzt die Datenbank `source_charge_id` an der Rechnungsposition zurück, und das lehnt der Schutz ausgestellter Rechnungen ab
- **Hinweis zur Behebung:** `source_charge_id` beim Schutz freigeben oder beim Ausstellen leeren. Roter Test: `it.fails('BUG-1…')`
- **Priorität:** vor dem Deploy

#### BUG-2: Nummer mit unsichtbarem Zeichen gilt als neue Nummer
- **Severity:** Medium
- **Schritte:** `Z-1` ist vergeben, `Z-1` mit angehängtem Nullbreite-Zeichen (etwa aus einem kopierten Text) eingeben, Häkchen „anderes Format“ setzen, ausstellen
- **Tatsächlich:** Wird angenommen. Das PDF entfernt das Zeichen, zwei Rechnungen zeigen also dieselbe Nummer
- **Hinweis:** Roter Test `it.fails('BUG-2…')`
- **Priorität:** vor dem Deploy

#### BUG-3: Zeitweise sehr lange Antwortzeiten, ohne Meldung
- **Severity:** Medium
- **Beobachtet:** In den Läufen dieser Runde viermal, bei Wiederholung nicht: „Rechnung wird ausgestellt …“ über 30 s; „Entwurf speichern“ über 5 s gesperrt; Löschen einer nacherfassten Rechnung rund 20 s (normal 2 s); Detailseite über 5 s (normal rund 1,1 s)
- **Ursache:** nicht geklärt. Betroffen sind verschiedene Aktionen; die App-Seite selbst antwortete in derselben Zeit in Millisekunden. Vermutung: Dev-Datenbank oder -Speicher, oder viele gleichzeitige Prefetch-Anfragen. Nicht belegt
- **Folge:** Auf der Ausstellen-Seite gibt es keine eigene Zeitgrenze; der Nutzer sieht nur den gesperrten Knopf
- **Priorität:** auf Staging beobachten

#### BUG-4: Veralteter Nummernvorschlag ohne Ausweg
- **Severity:** Low
- **Schritte:** Seite offen, jemand anderes vergibt die vorgeschlagene Nummer, danach Datum ändern
- **Tatsächlich:** „schon vergeben“ erscheint, aber der Vorschlag bleibt und „Vorschlag übernehmen“ fehlt, bis die Seite neu geladen ist. Beim Absenden ist der Fall gelöst. Nur im Code nachvollzogen, nicht ausgeführt

#### BUG-5: Kleinigkeiten in der Oberfläche
- **Severity:** Low
- „Rechnung falsch?“ trägt `role="alert"`: Screenreader lesen den ruhigen Hinweis beim Laden sofort vor
- Bei einem Datumshinweis stehen bis zu zwei gleich benannte Knöpfe „Datum auf heute setzen“
- Status heißt „ausgestellt“ (klein, wie „nacherfasst“), die Spec schreibt „Ausgestellt“

#### BUG-6: Keine Mengenbegrenzung für Vorschau und Ausstellen
- **Severity:** Low
- Siehe Security Audit

### Offener Speichern-Fehler (BUG-5 aus PROJ-15), auf Wunsch des Nutzers bearbeitet
- **Befund im Code:** Next.js meldet die Weiterleitung einer Server-Aktion dem Aufrufer, bevor es die neue Seite anwendet. Darum erscheint „Entwurf gespeichert.“ schon, während die Adresse noch die alte ist. Zwei Wege führen zum gemeldeten Bild: Die Router-Aktion wird verworfen, oder die Zielseite braucht lange (siehe BUG-3)
- **Nachgestellt:** Kommt während des Speicherns eine andere Router-Navigation dazwischen, bleibt die Seite dauerhaft auf dem Formular, mit Erfolgsmeldung. Das ist jetzt ein fester Test
- **Natürliche Ursache weiter offen:** 68 Runden Speichern, davon 32 unter Last, liefen ohne Fehler. Welcher der beiden Wege die Läufe in PROJ-15 traf, ist nicht belegt
- **Behoben:** `callAction` wechselt selbst zum Ziel, wenn die Adresse nach 4 s unverändert ist (gilt für alle Aktionen mit Weiterleitung). „Entwurf speichern“ bleibt nach dem Erfolg gesperrt, damit kein zweiter Entwurf entsteht
- **Tests:** `tests/PROJ-40-rechnungsdaten-sammeln.spec.ts`, „Weiterleitung nach dem Speichern“

### Behebung (2026-11-05, alle sechs auf Wunsch des Nutzers)
Migration `20261105165825_invoice_issue_qa_fixes.sql`, nur in Dev. QA Runde 2 steht aus.
- **BUG-1:** Der Schutz lässt an Positionen nur noch das Lösen der Verbindung zu entfernten Zusatzkosten zu. Bezeichnung, Betrag und alle anderen Werte bleiben geschützt
- **BUG-2:** Nummern mit unsichtbaren Zeichen oder Zeilenumbrüchen werden abgelehnt: auf der Seite als Sperre, in `issue_invoice` als Absicherung. Gilt nur fürs Ausstellen, nicht fürs Nacherfassen
- **BUG-3:** Nur die Folge ist behoben, **die Ursache der langen Antwortzeiten ist weiter unbekannt.** Der Knopf gibt nach 65 s auf und meldet das mit „Seite neu laden“; die Schnittstelle darf bis 60 s laufen. Ein erneuter Versuch stellt keine zweite Rechnung aus. Auf Staging beobachten
- **BUG-4:** Ist der Vorschlag vergeben, rückt die Seite selbst zur nächsten freien Nummer weiter
- **BUG-5:** Hinweise tragen `role="note"` statt `alert`; „Datum auf heute setzen“ steht nur noch am Datumsfeld. Schreibweise: Die Spec sagt jetzt „ausgestellt“, passend zu „nacherfasst“ und „Entwurf“; die Oberfläche bleibt
- **BUG-6:** Teilweise behoben: Höchstens 3 PDF-Arbeitsprozesse je Server-Instanz, 12 warten, darüber hinaus wird abgelehnt. Das schützt den Speicher, gilt für alle PDF-Erzeugungen (auch Briefpapier), ist aber **keine Grenze je Person** und nicht instanzübergreifend. Das bräuchte einen eigenen Dienst

### Tests
- **Vitest (in Paketen, nacheinander):** 676 Unit grün; Integration 256, davon 254 grün und 2 als bekannte Fehler markiert (BUG-1, BUG-2)
- **E2E Desktop:** `PROJ-42` komplett, teils in mehreren Läufen, weil einzelne Tests wegen BUG-3 zunächst rot waren und bei Wiederholung grün wurden; einige Zeitgrenzen wurden deshalb auf 20 s erhöht. Regression: `PROJ-37` (vor der Änderung an `callAction`), `PROJ-5` Löschen, `PROJ-40` Auswahl, `PROJ-8` Anlegen, Bearbeiten, Stornieren
- **Handy und Tablet:** Ausstellen-Seite und Detailseite ohne seitliches Scrollen und ohne automatisch erkennbare WCAG-Verstöße; Handy auch am Bild
- **Firefox:** Ablauf bis zur Detailseite und Nummernprüfung grün
- **Safari:** Ablauf bis zur Detailseite grün; der nachfolgende direkte Aufruf der Schnittstelle scheitert im Test mit „forbidden“, weil dieser Aufruf nicht aus dem Browser kommt. Der Rest des Tests lief darum dort nicht
- **Nicht geprüft:** Vercel; vollständige E2E-Suite aller Features; Datumsfeld im echten Safari; Drucktest

### Summary
- **Abnahmekriterien:** 68/70
- **Bugs:** 0 Critical, 1 High, 2 Medium, 3 Low
- **Security:** bestanden bis auf die fehlende Mengenbegrenzung (Low)
- **Production Ready:** NEIN, BUG-1 zuerst beheben

### QA Runde 2 (2026-11-05)

**Ergebnis:** 70 von 70 Abnahmekriterien erfüllt. BUG-1, BUG-2, BUG-4 und BUG-5 bestätigt behoben; BUG-3 und BUG-6 nur teilweise, wie unter „Behebung“ beschrieben. Keine neuen Fehler. 0 Critical, 0 High. **Produktionsreif nach den Regeln, Status Approved.**

**Neu geprüft**
- **BUG-1 in der Oberfläche:** Position im Buchungsformular entfernt, gespeichert; Betrag, Prüfsumme und Fassung der Rechnung unverändert, Position bleibt auf der Rechnung
- **BUG-2 in der Oberfläche:** Sperre mit Meldung, Aufruf am Knopf vorbei abgelehnt
- **PDF-Erzeugung scheitert** (Arbeitsprozess-Datei vorübergehend entfernt): Meldung, Entwurf ohne Nummer und PDF, keine Datei im Speicher, neuer Versuch gelingt
- **Nach dem Ausstellen geändert:** Stammdaten, Fußzeile, Kleinunternehmer-Verlauf, Gast anonymisiert: Spalten, Fassung und Datei gleich; Detailseite zeigt die alte Anschrift; Kleinunternehmer festgehalten
- **Pflichtangaben:** Sperren mit Link zu Stammdaten und Entwurf, Aufruf am Knopf vorbei abgelehnt; deaktivierter Kunde 403
- **Last:** 30 gleichzeitige Vorschauen: 24 fertig, 6 abgelehnt (Antwort 500), danach normal weiter

**Nur im Code, nicht ausgeführt**
- Datei wird entfernt, wenn der Datenbankschritt nach dem Hochladen scheitert (der Fall lässt sich nur mit genauem Timing erzwingen)
- Sperre „Aussteller-Block passt nicht“ auf der Seite (Regel und PDF-Meldung sind einzeln getestet)
- „Keine Verbindung“; Nummernkreis ändert sich, während die Seite offen ist

**Tests**
- **Vitest (in Paketen, nacheinander):** 678 Unit und 256 Integration grün
- **E2E Desktop:** `PROJ-42` komplett, `PROJ-37`, `PROJ-41` komplett, `PROJ-40` Auswahl (Erstellen, Teil- und Schlussrechnung, Empfänger, Weiterleitung), `PROJ-5` Löschen und `PROJ-8` Auswahl aus Runde 1
- **Handy und Tablet:** Layout und automatische WCAG-Prüfung grün
- **Firefox und Safari:** Ablauf bis zur Detailseite, BUG-1 bis BUG-5 in Teilen grün; Safari gegen `npm run dev`
- **Lange Antwortzeiten (BUG-3) traten wieder auf:** Ein Layout-Test aus `PROJ-37` lief einmal in die Zeitgrenze von 30 s, eine Anmeldung im Testaufbau scheiterte einmal; beide danach grün (2 von 2 in 24 s). Ursache weiter unbekannt

**Vor dem Deploy offen**
- PDF und Ablage auf Vercel, Antwortzeiten auf Staging beobachten (BUG-3)
- Drucktest des Adressfelds
- Fragen an den Steuerberater (Open Questions)
- Migrationen in dieser Reihenfolge: `20261105093618`, `20261105093734`, `20261105165825`

**Hinweis zur Prüfung der Umgebung:** Die Prüfung von `.env.local` wurde in dieser Runde abgelehnt und nicht wiederholt. Stattdessen: Datei seit dem 2026-10-26 unverändert, in Runde 1 als Dev bestätigt; Serverprotokoll und CLI nennen die Dev-Kennung.


## Deployment

- **Datum:** 2026-11-05
- **Commit:** `1c6dc37`, Tag `v1.22.0-PROJ-42`
- **Staging:** https://staging.apppa.at, vom Nutzer als „Ready“ gemeldet
- **Produktion:** https://app.apppa.at. Der erste Build scheiterte an `next/font/google` („queries have exactly one entry“), der Redeploy desselben Commits lief durch
- **Migrationen** in Staging und Produktion, in dieser Reihenfolge: `20261105093618_invoice_issue.sql`, `20261105093734_invoice_issue_error_code.sql`, `20261105165825_invoice_issue_qa_fixes.sql`. `db advisors`: nur der bekannte Auth-Hinweis
- **Nicht ausdrücklich bestätigt:** Ausstellen samt PDF und Ablage unter Vercel, Antwortzeiten (BUG-3), Smoke-Test in der Produktion, Drucktest des Adressfelds
- **Nachgeliefert 2026-11-05:** Schriften liegen jetzt im Projekt statt bei Google (`29f9033`), damit der Build nicht mehr an Google scheitert. Über Staging in die Produktion ausgeliefert (`edc3944`, Tag `v1.22.1`), beide Builds „Ready“, vom Nutzer geprüft
