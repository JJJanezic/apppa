# PROJ-41: Briefpapier

## Status: Planned
**Created:** 2026-11-04
**Last Updated:** 2026-11-04

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Inhaber, Mitarbeiter, Mandantentrennung
- Requires: PROJ-5 (Betreiber-Admin): Kunden-Detailseite, Betreiber-Protokoll
- Requires: PROJ-28 (Kundenstammdaten): Daten des Aussteller-Blocks
- Requires: PROJ-38 (Stammdaten und Logo): Logo des Kunden
- Requires: PROJ-39 (Einstellungen → Rechnungen): Schriftenliste, Texte, Fußzeile, Kleinunternehmer-Hinweis, Nummernkreis; „Standard“ je Text folgt ab hier dem Briefpapier
- Requires: PROJ-40 (Rechnungsdaten sammeln): Entwurfsvorschau, die künftig gestaltet erscheint
- Wird genutzt von: PROJ-42 (Ausstellen mit PDF): gleiche Gestaltung für die ausgestellte Rechnung

## Überblick
Die Einstellungen bekommen einen neuen Reiter **„Briefpapier“** (`/einstellungen/briefpapier`). Reihenfolge: **Stammdaten, Team, Wohnungen, Briefpapier, Rechnungen**. Der Betreiber bekommt auf der Kunden-Detailseite einen gleichwertigen Abschnitt **„Briefpapier“**.

Hier legt der Kunde einmal fest, wie seine Rechnungen aussehen. Die Reihenfolge der Bereiche ist fest. Einstellbar sind nur Einzelwerte. Eine Vorschau mit Musterrechnung zeigt das Ergebnis, und auch die Vorschau eines Rechnungsentwurfs (PROJ-40) erscheint künftig in dieser Gestaltung.

Hinweis zu älteren Specs: PROJ-38, PROJ-39 und PROJ-40 nennen teils „PROJ-41“ für Ausstellen, Nummernvergabe und PDF. Seit der Gliederung vom 2026-11-01 ist das **PROJ-42**. PROJ-41 ist nur die Gestaltung.

### Einstellungen

| Einstellung | Werte | Standard |
|---|---|---|
| Grundschrift | Arimo, Tinos, Carlito, Source Sans 3, Source Serif 4, Open Sans (Liste aus PROJ-39) | Carlito |
| Grundschriftgröße | 8 bis 14 pt in 0,5er-Schritten | 11 pt |
| Zeilenabstand | eng, normal, weit | normal |
| Absatzabstand | eng, normal, weit | normal |
| Logo-Position | links, mittig, rechts | links |
| Logo-Höhe | 10 bis 35 mm in ganzen Millimetern | 25 mm |
| Aussteller-Block anzeigen | ja, nein | ja |

Texte mit eigener Schrift, Größe oder Ausrichtung aus PROJ-39 behalten diese. Texte auf „Standard“ folgen Grundschrift und Grundschriftgröße.

### Aufbau der Rechnung
A4 hochformatig, Schrift schwarz. Feste Reihenfolge wie in PROJ-39 und PROJ-40:

1. Kopf: Logo und Aussteller-Block
2. Empfänger im Adressfeld (passend für das Fensterkuvert, ÖNORM A 1080), ohne Absenderzeile
3. Ort und Rechnungsdatum
4. Titel mit Rechnungsnummer, Zeitraum und Gastnamen
5. Einleitung
6. Leistungen mit Summen und USt je Satz
7. Kleinunternehmer-Hinweis (falls zutreffend)
8. Zahlungsmodalitäten
9. Abschlusstext
10. Fußzeile

### Kopf
Der **Aussteller-Block** enthält Name, zweite Namenszeile, Adresse, PLZ und Ort, Staat und UID aus den Stammdaten (PROJ-28). Leere Felder entfallen.

| Logo-Position | Aussteller-Block |
|---|---|
| links | rechts daneben |
| rechts | links daneben |
| mittig | zentriert unter dem Logo |

- Das Seitenverhältnis des Logos bleibt immer erhalten.
- Der Kopf ragt nie in das Adressfeld. Reicht der Platz nicht, wird das Logo verkleinert und das Formular nennt das in einem Hinweis.
- Ohne Logo oder ohne Aussteller-Block bleibt der jeweils andere Teil an seinem Platz. Sind beide nicht vorhanden, bleibt der Kopf leer. Das Adressfeld bleibt immer an derselben Stelle.

### Ausstellerdaten in der Fußzeile
Ist der Aussteller-Block abgeschaltet, erscheint im Formular dauerhaft der Hinweis, dass Name, Anschrift und ab € 400 die UID im Fußzeilentext stehen müssen, mit Link zur Fußzeile. Die App ergänzt und prüft den Fußzeilentext nicht. Die Verantwortung liegt beim Kunden. Die Pflichtangaben-Prüfung aus PROJ-40 prüft die Stammdaten unverändert weiter.

### Mehrere Seiten
- Logo, Aussteller-Block und Adressfeld stehen nur auf Seite 1.
- Die Fußzeile steht auf jeder Seite.
- Nur bei mehrseitigen Rechnungen: „Seite 1 von 2“ auf jeder Seite, ab Seite 2 auch die Rechnungsnummer.
- Eine Leistungszeile wird nie getrennt. Die Gesamtsumme steht nie allein am Anfang einer Seite.

### Vorschau im Reiter
- Musterrechnung mit den echten Stammdaten, dem Logo, dem jeweiligen Standard-Baustein und der Fußzeile des Kunden sowie erfundenen Gast- und Buchungsdaten; deutlich als „Muster“ gekennzeichnet.
- Die Musternummer folgt dem Nummernkreis des Kunden und verbraucht keine Nummer. USt-Ausweis bzw. Kleinunternehmer-Hinweis richten sich nach dem aktuellen Status des Kunden.
- Fehlt ein Standard-Baustein, steht an seiner Stelle ein neutraler Mustertext.
- Aktualisiert sich etwa eine Sekunde nach der letzten Änderung und zeigt auch den ungespeicherten Stand. Bis dahin bleibt die alte Fassung sichtbar, mit dem Hinweis „Vorschau wird aktualisiert“.
- Am Desktop stehen Einstellungen und Vorschau nebeneinander, am Handy untereinander.

### Rechte

| Aktion | Inhaber | Betreiber | Mitarbeiter |
|---|---|---|---|
| Briefpapier ansehen und ändern | ja, eigener Kunde | ja, alle aktiven Kunden; bei deaktivierten nur ansehen | nein, „Seite nicht gefunden“ |
| Gestaltete Entwurfsvorschau inkl. Logo | ja | nein (kein Zugriff auf Entwürfe, PROJ-40) | ja, nur ansehen, kein direkter Zugriff auf die Logodatei |

## User Stories
- Als **Inhaber** möchte ich Schrift, Größe und Abstände meiner Rechnungen einmal festlegen, damit alle Rechnungen einheitlich aussehen.
- Als **Inhaber** möchte ich Position und Höhe meines Logos festlegen, damit es zu seiner Form und zu meinem Auftritt passt.
- Als **Inhaber** möchte ich den Aussteller-Block im Kopf abschalten, damit meine Betriebsdaten nur in der Fußzeile stehen.
- Als **Inhaber** möchte ich Werte gefahrlos ausprobieren und das Ergebnis sofort sehen, ohne dass sich vor dem Speichern etwas ändert.
- Als **Inhaber** möchte ich einen Rechnungsentwurf in der endgültigen Gestaltung sehen, damit ich vor dem Ausstellen weiß, wie die Rechnung aussieht.
- Als **Mitarbeiter** möchte ich Entwürfe in derselben Gestaltung sehen, damit ich bei Fragen des Gastes Auskunft geben kann.
- Als **Betreiber** möchte ich das Briefpapier beim Onboarding einrichten, damit die erste Rechnung des Kunden gleich richtig aussieht.

## Out of Scope
- Nummer vergeben, festschreiben, PDF ablegen und herunterladen als Rechnung (PROJ-42)
- Änderbare Reihenfolge der Bereiche und mehrere fertige Vorlagen (bewusst feste Anordnung; später ergänzbar)
- Akzentfarbe und farbige Schrift (später ergänzbar)
- Absenderzeile über dem Adressfeld (später ergänzbar)
- Eigene Seitenränder, freie Abstandswerte, eigene oder hochgeladene Schriften
- Ausstellerdaten automatisch in die Fußzeile setzen; Prüfung des Fußzeilentexts auf Pflichtangaben
- Platzhalter in der Fußzeile (bewusst freier Text, PROJ-39)
- Logo hochladen oder ersetzen (bleibt in den Stammdaten, PROJ-38)
- Gestaltung anderer Korrespondenz wie Gästeblatt (Name ist vorbereitet, Umsetzung bei Bedarf)
- Zentrale Vorlagen des Betreibers für alle Kunden
- Änderungen an nacherfassten Rechnungen (PROJ-37)

## Acceptance Criteria

### Reiter und Zugang
- [ ] Angenommen ein Inhaber öffnet die Einstellungen, wenn die Reiter laden, dann lautet die Reihenfolge Stammdaten, Team, Wohnungen, Briefpapier, Rechnungen
- [ ] Angenommen ein Handy mit 375 px Breite, wenn die Reiter laden, dann lassen sich alle fünf Reiter erreichen, ohne dass die Seite seitlich scrollt
- [ ] Angenommen ein Mitarbeiter ruft `/einstellungen/briefpapier` auf, wenn die Seite lädt, dann erhält er „Seite nicht gefunden“
- [ ] Angenommen ein Mitarbeiter sendet eine Änderung des Briefpapiers direkt an den Server, wenn die Anfrage ankommt, dann wird sie abgelehnt
- [ ] Angenommen ein Inhaber sendet eine Änderung für einen anderen Kunden an den Server, wenn die Anfrage ankommt, dann wird sie abgelehnt

### Standardwerte
- [ ] Angenommen ein Kunde hat nichts eingestellt, wenn der Reiter lädt, dann stehen dort Carlito, 11 pt, Abstände „normal“, Logo links, 25 mm und Aussteller-Block sichtbar
- [ ] Angenommen ein bestehender Kunde mit Entwürfen, wenn PROJ-41 live geht, dann bleiben alle Entwürfe erhalten und erscheinen ohne Nacharbeit mit den Standardwerten
- [ ] Angenommen geänderte Werte, wenn der Inhaber „Auf Standard zurücksetzen“ wählt, dann zeigen Formular und Vorschau die Standardwerte und gespeichert wird erst mit „Speichern“

### Einstellen und Speichern
- [ ] Angenommen ein Inhaber wählt eine der sechs Schriften, wenn die Vorschau sich aktualisiert hat, dann erscheinen alle Texte auf „Standard“ und alle Rechnungsbereiche ohne eigene Textformatierung in dieser Schrift
- [ ] Angenommen eine Schriftgröße unter 8 pt, über 14 pt oder außerhalb der 0,5er-Schritte, wenn gespeichert wird, dann erscheint eine Fehlermeldung mit dem erlaubten Bereich und nichts wird gespeichert
- [ ] Angenommen eine Logo-Höhe unter 10 mm, über 35 mm oder mit Nachkommastellen, wenn gespeichert wird, dann erscheint eine Fehlermeldung mit dem erlaubten Bereich und nichts wird gespeichert
- [ ] Angenommen ein Inhaber wählt für Zeilen- oder Absatzabstand „eng“ oder „weit“, wenn die Vorschau sich aktualisiert hat, dann ist der jeweilige Abstand sichtbar kleiner bzw. größer als bei „normal“
- [ ] Angenommen ein Text hat in PROJ-39 eine eigene Schrift, Größe oder Ausrichtung, wenn die Grundwerte geändert werden, dann behält dieser Text seine eigenen Einstellungen
- [ ] Angenommen ungespeicherte Änderungen, wenn der Nutzer die Seite verlässt, dann erscheint eine Rückfrage
- [ ] Angenommen gültige Werte, wenn der Inhaber speichert, dann sind sie nach dem Neuladen unverändert da
- [ ] Angenommen Inhaber und Betreiber haben das Briefpapier geöffnet und einer hat gespeichert, wenn der andere speichert, dann erhält er den Hinweis „Die Einstellungen wurden inzwischen geändert“ mit „Aktuelle Fassung laden“ und seine Änderung wird nicht gespeichert
- [ ] Angenommen der Server ist nicht erreichbar, wenn gespeichert wird, dann erscheint eine Fehlermeldung und die Eingaben bleiben erhalten

### Logo und Kopf
- [ ] Angenommen ein Logo ist vorhanden, wenn die Position links, rechts oder mittig gewählt wird, dann stehen Logo und Aussteller-Block wie in der Tabelle „Kopf“ festgelegt
- [ ] Angenommen eine Logo-Höhe zwischen 10 und 35 mm, wenn genügend Platz ist, dann hat das Logo genau diese Höhe, sein Seitenverhältnis bleibt erhalten
- [ ] Angenommen ein Logo und ein Aussteller-Block passen zusammen nicht in den Kopf, wenn die Vorschau erscheint, dann ragt nichts in das Adressfeld, das Logo ist verkleinert und das Formular nennt das in einem Hinweis
- [ ] Angenommen ein Kunde ohne Logo, wenn der Reiter lädt, dann sind Position und Höhe nicht wählbar, und ein Hinweis verlinkt zu den Stammdaten; gespeicherte Werte bleiben erhalten
- [ ] Angenommen ein Logo wird später hochgeladen, wenn die Vorschau erscheint, dann gelten die gespeicherten Werte für Position und Höhe
- [ ] Angenommen ein kleines Logo mit großer Höhe, wenn es unscharf wirken könnte, dann erscheint ein Hinweis, und speichern bleibt möglich

### Aussteller-Block
- [ ] Angenommen der Inhaber schaltet den Aussteller-Block ab, wenn die Vorschau sich aktualisiert hat, dann steht im Kopf keine Ausstellerangabe und das Adressfeld bleibt an derselben Stelle
- [ ] Angenommen der Aussteller-Block ist abgeschaltet, wenn das Formular lädt, dann erscheint dauerhaft der Hinweis zu Name, Anschrift und UID im Fußzeilentext samt Link zur Fußzeile
- [ ] Angenommen der Aussteller-Block ist abgeschaltet und die Fußzeile ist leer, wenn das Formular lädt, dann sagt der Hinweis zusätzlich, dass die Fußzeile noch leer ist
- [ ] Angenommen der Aussteller-Block ist abgeschaltet, wenn die Rechnung erzeugt wird, dann fügt die App dem Fußzeilentext nichts hinzu
- [ ] Angenommen der Aussteller-Block ist abgeschaltet und die Stammdaten sind unvollständig, wenn die Pflichtangaben eines Entwurfs geprüft werden, dann meldet die Liste den Mangel wie in PROJ-40

### Mehrere Seiten
- [ ] Angenommen eine Rechnung passt auf eine Seite, wenn sie erscheint, dann steht dort keine Seitenzahl
- [ ] Angenommen eine Rechnung braucht zwei Seiten, wenn sie erscheint, dann zeigen beide „Seite x von 2“ und die Fußzeile, Seite 2 außerdem die Rechnungsnummer, aber weder Logo noch Aussteller-Block
- [ ] Angenommen eine lange Positionsliste, wenn ein Seitenwechsel nötig ist, dann wird keine Leistungszeile getrennt und die Gesamtsumme steht nicht allein am Anfang einer Seite
- [ ] Angenommen ein Entwurf ohne Nummer braucht zwei Seiten, wenn er erscheint, dann steht auf Seite 2 statt der Nummer der Text für die noch nicht vergebene Nummer aus PROJ-40

### Vorschau im Reiter
- [ ] Angenommen ein Wert wird geändert, wenn etwa eine Sekunde nichts weiter geändert wird, dann zeigt die Vorschau den neuen Stand, obwohl nichts gespeichert wurde
- [ ] Angenommen die Vorschau wird erstellt, wenn sie noch nicht fertig ist, dann bleibt die alte Fassung sichtbar und ein Hinweis zeigt die Aktualisierung
- [ ] Angenommen der Nutzer ändert während der Erstellung weiter, wenn eine ältere Vorschau danach fertig wird, dann ersetzt sie die neuere nicht
- [ ] Angenommen ein ungültiger Wert steht im Formular, wenn die Vorschau aktualisiert würde, dann bleibt die letzte gültige Vorschau stehen und das Feld zeigt den Fehler
- [ ] Angenommen die Vorschau kann nicht erstellt werden, wenn der Fehler auftritt, dann erscheint eine Meldung mit „Erneut versuchen“ und Speichern bleibt möglich
- [ ] Angenommen die Musterrechnung, wenn sie erscheint, dann ist sie deutlich als „Muster“ gekennzeichnet und enthält die echten Stammdaten, das Logo, die Standard-Bausteine und die Fußzeile des Kunden
- [ ] Angenommen die aktuelle Nummer im Nummernkreis, wenn die Musterrechnung erstellt wird, dann wird keine Nummer verbraucht und der nächste Nummernvorschlag bleibt gleich
- [ ] Angenommen ein Kunde mit aktuellem Kleinunternehmer-Status, wenn die Musterrechnung erscheint, dann zeigt sie keine USt und den Kleinunternehmer-Hinweis
- [ ] Angenommen ein Handy mit 375 px Breite, wenn die Vorschau erscheint, dann steht sie unter den Einstellungen und ist ohne seitliches Scrollen der Seite lesbar oder lässt sich vollständig öffnen

### Gestaltete Entwurfsvorschau (PROJ-40)
- [ ] Angenommen ein gespeicherter Entwurf, wenn der Inhaber „Vorschau“ wählt, dann erscheint er in der Gestaltung des Briefpapiers und auf jeder Seite deutlich als „Entwurf“ gekennzeichnet
- [ ] Angenommen ein Entwurf mit ungespeicherten Änderungen, wenn der Inhaber im Formular „Vorschau“ wählt, dann zeigt die gestaltete Vorschau den ungespeicherten Stand und die Eingaben bleiben erhalten
- [ ] Angenommen das Briefpapier wurde geändert und gespeichert, wenn ein offener Entwurf danach angesehen wird, dann zeigt er die neue Gestaltung
- [ ] Angenommen eine nacherfasste Rechnung, wenn das Briefpapier geändert wird, dann bleiben ihr PDF und ihre Angaben unverändert
- [ ] Angenommen ein Mitarbeiter öffnet die Vorschau eines Entwurfs, wenn sie erscheint, dann sieht er die Gestaltung samt Logo ohne Bearbeitungsknöpfe und ohne direkten Zugriff auf die Logodatei
- [ ] Angenommen ein Text mit Schrift, Größe oder Ausrichtung aus PROJ-39, wenn die Vorschau erscheint, dann ist er genau so gesetzt
- [ ] Angenommen Teilrechnung, Schlussrechnung mit Abzügen oder Kleinunternehmer, wenn die Vorschau erscheint, dann stimmen Inhalte und Beträge mit der bisherigen Vorschau aus PROJ-40 überein
- [ ] Angenommen die gestaltete Vorschau kann nicht erstellt werden, wenn der Fehler auftritt, dann erscheint eine Meldung mit „Erneut versuchen“ und der Entwurf bleibt unverändert

### Betreiber
- [ ] Angenommen der Betreiber öffnet einen aktiven Kunden, wenn die Detailseite lädt, dann gibt es den Abschnitt „Briefpapier“ gleich bedienbar wie beim Inhaber samt Vorschau
- [ ] Angenommen der Betreiber speichert Werte eines aktiven Kunden, wenn sich der Inhaber danach anmeldet, dann sieht er sie im Reiter „Briefpapier“
- [ ] Angenommen ein deaktivierter Kunde, wenn der Betreiber die Detailseite öffnet, dann sieht er die Einstellungen, kann aber nichts ändern
- [ ] Angenommen eine Änderung wird gespeichert, wenn jemand das Betreiber-Protokoll ansieht, dann ist sie mit Person, Zeitpunkt und Abschnitt „Briefpapier“ vermerkt
- [ ] Angenommen der Betreiber öffnet die Musterrechnung, wenn sie erscheint, dann enthält sie keine echten Gäste- oder Buchungsdaten des Kunden

## Edge Cases
- **Sehr breites Logo:** Wird auf den verfügbaren Platz in der Breite begrenzt und dadurch niedriger als eingestellt. Das Formular nennt das in einem Hinweis.
- **Logo mittig, 35 mm, mit Aussteller-Block:** Passt voraussichtlich nicht vollständig über das Adressfeld. Das Logo wird verkleinert, das Adressfeld bleibt an seiner Stelle.
- **Große Schrift und langer Aussteller-Block:** Der Kopf darf das Adressfeld nicht erreichen. Der Aussteller-Block nutzt deshalb eine feste, von der Grundschriftgröße begrenzte Darstellung.
- **Sehr lange Fußzeile (bis 2.000 Zeichen):** Sie steht auf jeder Seite. Belegt sie mehr als ein Drittel der Seite, nennt das Formular das in einem Hinweis. Die Rechnung bleibt erzeugbar und läuft auf weitere Seiten.
- **Aussteller-Block aus, kein Logo, leere Fußzeile:** Erlaubt. Die Rechnung hat dann einen leeren Kopf, und der Hinweis nennt die leere Fußzeile.
- **Stammdaten unvollständig:** Der Aussteller-Block zeigt, was da ist. In Vorschau und Pflichtangaben bleibt der Mangel sichtbar wie in PROJ-40.
- **Logo wird gelöscht:** Die Vorschau erscheint ohne Logo, gespeicherte Werte bleiben für ein neues Logo erhalten.
- **Logo lässt sich nicht laden:** Die Vorschau erscheint mit Hinweis ohne Logo. Für das Ausstellen entscheidet PROJ-42.
- **Lange Wörter, IBAN, Zeichen wie „Š“ oder „ő“:** Werden umgebrochen und richtig dargestellt; die Schriften decken erweitertes Latein ab.
- **Sehr viele Leerzeilen in einem Text:** Dürfen die Erzeugung nicht unbegrenzt verlangsamen (Hinweis aus der QA von PROJ-39).
- **Negative Positionen und Beträge:** Bleiben in der Darstellung erkennbar, obwohl die Schrift schwarz ist (Minuszeichen; „Rot“ aus PROJ-32 gilt nur in der App).
- **Schnelles Hin- und Herändern:** Es zählt nur die neueste Vorschau.

## Technical Requirements
- Vorschau im Reiter und gestaltete Entwurfsvorschau entsprechen dem späteren PDF aus PROJ-42, einschließlich Umbruch und Seitenaufteilung
- Umsetzung von Schriftart, Schriftgröße und Ausrichtung aus PROJ-39 in dieser Darstellung
- Die sechs Schriften sind eingebettet, ohne Verbindung zu Google beim Erzeugen; Lizenztexte werden abgelegt
- Rechte serverseitig durchgesetzt (Inhaber nur eigener Kunde, Betreiber alle aktiven Kunden, Mitarbeiter keine Rechte auf die Einstellungen)
- Musterrechnung enthält keine echten Gästedaten
- Aktualisierung der Vorschau im Reiter in der Regel unter 3 Sekunden nach der letzten Änderung
- Browser: Chrome, Firefox, Safari; ab 375 px Breite
- Texte in den Sprachdateien (Deutsch, mehrsprachig vorbereitet)

## Open Questions
- [ ] Genaue Maße des Adressfelds nach ÖNORM A 1080 in `/architecture` belegen und daraus den verfügbaren Platz im Kopf ableiten
- [ ] Bestätigen, dass Name, Anschrift und UID nach § 11 UStG auch nur in der Fußzeile stehen dürfen (Einschätzung im Gespräch, fachlich durch den Nutzer zu bestätigen)
- [ ] Reichen etwa 1.000 Pixel an der längsten Seite des Logos für den Druck? Ab welcher Pixeldichte erscheint der Hinweis „unscharf“? (offen aus PROJ-38)
- [ ] Wie erscheint die Vorschau auf Handys, die eingebettete PDFs schlecht darstellen? (`/architecture`)
- [ ] Soll die Rechnung den Leistungszeitraum in einer eigenen Zeile nennen, oder genügt die bisherige Zeile mit dem Zeitraum? (offen aus PROJ-40, Empfehlung: bisherige Zeile)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Reitername „Briefpapier“, zwischen „Wohnungen“ und „Rechnungen“ | Beschreibt die Sache und passt auch für spätere Korrespondenz; in PROJ-39 schon so genannt | 2026-11-04 |
| Feste Reihenfolge der Bereiche, nur Einzelwerte einstellbar; keine Vorlagen | Schützt vor unbrauchbaren Rechnungen, gut prüfbar; später erweiterbar | 2026-11-04 |
| Einstellbar: Grundschrift, Grundgröße, Zeilen- und Absatzabstand in drei Stufen, Logo-Position und -Höhe; keine Akzentfarbe | Nutzerliste vom 2026-11-01, Farbe war nur „ggf.“ und lässt sich später ergänzen | 2026-11-04 |
| Logo links, mittig oder rechts, Aussteller-Block gegenüber bzw. mittig darunter | Passt für breite und runde Logos, drei prüfbare Fälle | 2026-11-04 |
| Aussteller-Block abschaltbar; keine automatische Zeile und keine Prüfung in der Fußzeile, nur Hinweis | Nutzerentscheidung: Die Daten stehen beim Nutzer im frei definierbaren Fußzeilentext; die Verantwortung liegt beim Kunden | 2026-11-04 |
| Zusätzlicher Hinweis, wenn der Block aus und die Fußzeile leer ist | Prüft keinen Inhalt, zeigt aber den einzigen sicher erkennbaren Fall fehlender Angaben (von Claude ergänzt, Freigabe mit dieser Spec) | 2026-11-04 |
| Logo-Höhe 10 bis 35 mm in ganzen mm, Standard 25 mm | Nutzerentscheidung zum Standard; mm passt für jede Logoform, ganze mm genügen | 2026-11-04 |
| Standard Carlito, 11 pt; einstellbar 8 bis 14 pt in 0,5er-Schritten | Nutzerentscheidung; engere Spanne als je Text in PROJ-39, weil die Grundgröße auch die Leistungstabelle trägt | 2026-11-04 |
| Echte Gestaltung im Reiter und in der Entwurfsvorschau, mit Aufdruck „Entwurf“ | Der Nutzer sammelt echte Entwürfe; vor dem endgültigen Ausstellen ist die verlässliche Ansicht am wertvollsten | 2026-11-04 |
| Mitarbeiter sehen in der Entwurfsvorschau das Logo, ohne direkten Zugriff auf die Logodatei | Das Logo gehört zur Rechnung; PROJ-38 gibt ihnen keinen Lesezugriff auf die Datei | 2026-11-04 |
| Inhaber und Betreiber gleichwertig, Protokoll, Konfliktschutz wie PROJ-39 | Gleiches Muster wie Stammdaten und Rechnungen; Betreiber richtet beim Onboarding ein | 2026-11-04 |
| Fußzeile auf jeder Seite; Seitenzahl nur bei mehrseitigen Rechnungen, Nummer ab Seite 2 | Ausstellerdaten des Nutzers stehen in der Fußzeile; lose Blätter bleiben zuordenbar | 2026-11-04 |
| Vorschau automatisch nach etwa einer Sekunde, auch ungespeichert | Freies Ausprobieren, ohne dass offene Entwürfe sich sofort ändern | 2026-11-04 |
| Keine Absenderzeile über dem Adressfeld | Passt zu Ausstellerdaten in der Fußzeile; später ergänzbar | 2026-11-04 |
| „Auf Standard zurücksetzen“, wirksam erst mit „Speichern“ | Sicherer Ausstieg beim Ausprobieren (von Claude ergänzt, Freigabe mit dieser Spec) | 2026-11-04 |
| Hinweis, wenn die Fußzeile mehr als ein Drittel der Seite belegt; keine Sperre | Fußzeile steht auf jeder Seite und kann bis 2.000 Zeichen haben (von Claude ergänzt, Freigabe mit dieser Spec) | 2026-11-04 |
| Offene Entwürfe folgen immer dem aktuellen Briefpapier; nacherfasste und ausgestellte Rechnungen ändern sich nie | Entwürfe sind nicht festgeschrieben; Rechnungen dürfen sich nachträglich nicht ändern | 2026-11-04 |

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
