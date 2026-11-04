# PROJ-41: Briefpapier

## Status: In Progress
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
| mittig | zentriert unter dem Logo, zweizeilig: Name, darunter die übrigen Angaben mit „·“ getrennt |

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
- [ ] Angenommen das Logo steht mittig und der Aussteller-Block ist sichtbar, wenn die Vorschau erscheint, dann steht der Block zweizeilig zentriert unter dem Logo und ein Logo mit 25 mm Höhe wird nicht verkleinert
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
- **Logo mittig, 35 mm, mit Aussteller-Block:** Über dem zweizeiligen Block bleiben etwa 26 mm. Das Logo wird entsprechend verkleinert und das Formular nennt das in einem Hinweis; das Adressfeld bleibt an seiner Stelle.
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
- [ ] Drucktest vor dem Deploy: Passt das Adressfeld (45 mm von oben, 20 mm von links, 85 × 45 mm) ins tatsächlich verwendete Fensterkuvert? Die Maße aus ÖNORM A 1080 konnten nicht belegt werden; öffentlich auffindbar war nur die zurückgezogene Ausgabe von 1999 ohne Maßangaben
- [x] Gastnamen in nicht lateinischer Schrift? Kommen laut Nutzer nicht vor, keine eigene Behandlung nötig (2026-11-04)
- [x] Leistungszeitraum in einer eigenen Zeile? Nein, es bleibt bei der bisherigen Zeile (Nutzer, 2026-11-04)
- [x] Dürfen Name, Anschrift und UID nach § 11 UStG auch nur in der Fußzeile stehen? Ja, vom Nutzer am 2026-11-04 bestätigt
- [x] Reichen etwa 1.000 Pixel für den Druck, und ab wann erscheint „unscharf“? Siehe Technical Decisions
- [x] Wie erscheint die Vorschau auf Handys? Einheitlich als gezeichnete Seiten, siehe Technical Decisions

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
| Logo mittig: Aussteller-Block zweizeilig | Im 35 mm hohen Kopf ließe ein sechszeiliger Block dem Logo nur etwa 11 mm; zweizeilig passt der Standard von 25 mm (Nutzerentscheidung bei der Architektur) | 2026-11-04 |
| Rechnungsmerkmale dürfen in der Fußzeile stehen | Vom Nutzer als § 11 UStG entsprechend bestätigt | 2026-11-04 |
| Keine eigene Behandlung nicht lateinischer Gastnamen; Leistungszeitraum in der bisherigen Zeile | Nutzerentscheidung | 2026-11-04 |
| Keine Absenderzeile über dem Adressfeld | Passt zu Ausstellerdaten in der Fußzeile; später ergänzbar | 2026-11-04 |
| „Auf Standard zurücksetzen“, wirksam erst mit „Speichern“ | Sicherer Ausstieg beim Ausprobieren (von Claude ergänzt, Freigabe mit dieser Spec) | 2026-11-04 |
| Hinweis, wenn die Fußzeile mehr als ein Drittel der Seite belegt; keine Sperre | Fußzeile steht auf jeder Seite und kann bis 2.000 Zeichen haben (von Claude ergänzt, Freigabe mit dieser Spec) | 2026-11-04 |
| Offene Entwürfe folgen immer dem aktuellen Briefpapier; nacherfasste und ausgestellte Rechnungen ändern sich nie | Entwürfe sind nicht festgeschrieben; Rechnungen dürfen sich nachträglich nicht ändern | 2026-11-04 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine Vorlage erzeugt auf dem Server ein echtes PDF, die Vorschau zeigt dieses PDF | Vorschau und ausgestellte Rechnung können nicht auseinanderlaufen; die frühere Prüfung „Vorschau und PDF umbrechen gleich“ aus PROJ-39 entfällt | 2026-11-04 |
| `@react-pdf/renderer` statt Headless-Browser oder eigener Seitenberechnung | Läuft ohne schweren Browser in der Serverfunktion, baut auf React auf, Fähigkeiten im Vorab-Versuch bestätigt | 2026-11-04 |
| Version exakt festgelegt; Fußzeile wird in einem ersten Durchgang gemessen | Wiederholte Elemente reservieren keinen Platz; die Messung nutzt interne Layoutdaten, die sich ändern können, darum feste Version und Test | 2026-11-04 |
| Jede Erzeugung in einem eigenen kurzlebigen Arbeitsprozess mit frisch geladenen Schriften | Vorab-Versuch: gemeinsamer Schriftzustand kann Buchstaben verlieren, frische Schriften im selben Prozess lassen den Speicher wachsen. Auf einer Rechnung ist ein fehlender Buchstabe nicht hinnehmbar; schützt auch bei parallelen Anfragen | 2026-11-04 |
| Anzeige mit `pdfjs-dist` statt eingebettetem PDF | Die App verbietet Einbetten per Sicherheitsheader, und eingebettete PDFs erscheinen auf Handys uneinheitlich; so sieht die Vorschau überall gleich aus. Wird nur bei Bedarf geladen, die App bleibt sonst schnell | 2026-11-04 |
| Schnittstellen eigener Art statt Server-Aktionen für die Vorschau | Veraltete Anfragen lassen sich abbrechen, Server-Aktionen laufen nacheinander und blockierten beim Ausprobieren; PDFs sind Binärdaten | 2026-11-04 |
| Briefpapier als Abschnitt der Rechnungseinstellungen statt eigener Tabelle | Zeile je Kunde, Rechte, Vorbelegung, Stempel und Protokoll gibt es dort schon; andere Korrespondenz gibt es noch nicht, ein Umzug wäre später möglich | 2026-11-04 |
| Logo liest der Server mit dem geheimen Schlüssel erst nach geprüftem Zugriff | Mitarbeiter sehen das Logo in der Entwurfsvorschau, die Speicherregeln aus PROJ-38 bleiben unverändert | 2026-11-04 |
| Vorschau-PDFs werden nicht gespeichert und nicht zwischengespeichert | Enthalten bei Entwürfen Gästedaten; Ablage gehört zum Ausstellen (PROJ-42) | 2026-11-04 |
| Adressfeld vorläufig 45 mm von oben, 20 mm von links, 85 × 45 mm; zentrale Festlegung, Drucktest vor Deploy | Die Maße aus ÖNORM A 1080 waren nicht öffentlich auffindbar; die Werte stammen aus der deutschen Kuvertnorm DIN 676 und müssen zu den tatsächlichen Kuverts passen | 2026-11-04 |
| Hinweis „unscharf“ unter etwa 150 Bildpunkten je Zoll in der tatsächlichen Druckgröße | 1.000 Pixel an der längsten Seite reichen für die meisten Fälle; berechnet wird aus Bild- und Druckgröße | 2026-11-04 |
| Schriften vollständig statt beschnitten als einzelne Dateien | Mehr Zeichen für Gastnamen; je Erzeugung werden nur die benötigten geladen. Einzeldateien sind nötig, weil die Erzeugung keine variablen Schriften nutzen kann; vier der sechs liegen nur variabel vor und werden einmalig umgewandelt | 2026-11-04 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Grundgedanke
Es gibt **eine einzige Rechnungsvorlage**, die auf dem Server ein echtes PDF erzeugt. Reiter „Briefpapier“, Entwurfsvorschau und später das Ausstellen (PROJ-42) nutzen dieselbe Vorlage. Was der Kunde in der Vorschau sieht, ist also bereits das PDF, einschließlich Umbruch und Seitenaufteilung. Die Inhalte kommen unverändert aus der bestehenden Rechenregel der Entwurfsvorschau (PROJ-40).

```
Daten des Kunden + Briefpapier + Entwurf oder Musterrechnung
        |
        v
Inhalte der Rechnung (bestehende Regel aus PROJ-40)
        |
        v
Rechnungsvorlage auf dem Server -> PDF
        |
        +--> Reiter „Briefpapier“: Musterrechnung
        +--> Entwurfsvorschau: mit Aufdruck „Entwurf“
        +--> PROJ-42: ohne Aufdruck, festgeschrieben und abgelegt
```

### Seitenaufbau
Die Maße sind eine zentrale Festlegung und lassen sich nach dem Drucktest an einer Stelle ändern:

| Bereich | Festlegung |
|---|---|
| Seitenrand links und rechts | 20 mm |
| Kopf | 8 bis 43 mm von oben, also 35 mm hoch |
| Adressfeld | 45 mm von oben, 20 mm von links, 85 × 45 mm |
| Aussteller-Block | höchstens 10 pt, einfacher Zeilenabstand, unabhängig von Grundgröße und Abstandsstufe |
| Adressfeld-Text | höchstens 11 pt, einfacher Zeilenabstand, damit er im Kuvertfenster bleibt |
| Logo mit Aussteller-Block daneben | höchstens 95 mm breit |
| Logo ohne Block oder mittig | höchstens 170 mm breit |
| Logo mittig mit Aussteller-Block | Block zweizeilig: Name, darunter die übrigen Angaben mit „·“ getrennt; verfügbar für das Logo: etwa 26 mm Höhe |

Die Regel „wie groß wird das Logo tatsächlich?“ ist eine gemeinsame Rechenregel für Formular und PDF. So stimmen Hinweis und Ergebnis überein.

### Komponenten

```
Einstellungen
+-- Reiterleiste: neu „Briefpapier“ (fünf Reiter, am Handy wischbar)
+-- Reiter „Briefpapier“ (nur Inhaber)
|   +-- Briefpapier-Formular
|   |   +-- Schrift: Grundschrift, Grundgröße
|   |   +-- Abstände: Zeilenabstand, Absatzabstand
|   |   +-- Logo: Position, Höhe; Hinweise (kein Logo, verkleinert, unscharf)
|   |   +-- Aussteller-Block: Schalter; Hinweis auf die Fußzeile
|   |   +-- „Auf Standard zurücksetzen“, „Speichern“
|   +-- PDF-Vorschau
|       +-- Seitenansicht, Hinweis „wird aktualisiert“, „Erneut versuchen“
|       +-- „PDF öffnen“
+-- Reiter „Rechnungen“ (PROJ-39)
    +-- Baustein-Vorschau: folgt Grundschrift und Grundgröße

Betreiber: Kunden-Detailseite
+-- Abschnitt „Briefpapier“: dasselbe Formular und dieselbe Vorschau

Rechnungsentwurf (PROJ-40)
+-- Vorschau-Seite und Vorschau im Formular: PDF-Vorschau statt bisheriger Darstellung
```

Wiederverwendet werden die Reiterleiste, der Schutz vor ungespeicherten Änderungen, der Konfliktschutz und das Protokoll aus PROJ-38 und PROJ-39, die Schriftenliste, die Nummernregel und die Inhaltsregel der Entwurfsvorschau. Die bisherige Darstellung der Entwurfsvorschau entfällt, damit es nur eine Fassung gibt. Die Prüfungen ihrer Inhalte wandern auf die Inhaltsregel und den Text im PDF.

### Datenmodell
Die Rechnungseinstellungen (eine Zeile je Kunde, PROJ-39) bekommen einen Abschnitt „Briefpapier“:

- Grundschrift (eine der sechs, Standard Carlito)
- Grundschriftgröße (8 bis 14 pt, 0,5er-Schritte, Standard 11)
- Zeilenabstand, Absatzabstand (eng, normal, weit; Standard normal)
- Logo-Position (links, mittig, rechts; Standard links)
- Logo-Höhe (10 bis 35 mm, ganze mm, Standard 25)
- Aussteller-Block anzeigen (Standard ja)
- Änderungsstempel des Abschnitts für den Konfliktschutz

Bestehende und neue Kunden erhalten die Standardwerte automatisch, es ist keine Nacharbeit an Entwürfen nötig. Geschrieben wird nur über eine eigene Speicherfunktion mit Prüfung von Rechten und Werten in der Datenbank und mit Protokolleintrag ohne Werte. Die Lesefunktion für die Entwurfsvorschau, die schon Aussteller und Fußzeile auch für Mitarbeiter liefert, bekommt die Briefpapier-Werte dazu. PDFs der Vorschau werden nicht gespeichert.

### So läuft eine Vorschau ab
1. **Auslösen:** Das Formular wartet etwa eine Sekunde nach der letzten Änderung und sendet seinen Stand an den Server. Eine noch laufende ältere Anfrage wird abgebrochen.
2. **Prüfen:** Der Server prüft Anmeldung, Rolle und Kunde und lädt Stammdaten, Texte und Logo selbst. Aus dem Browser kommen nur die Formularwerte, nie Aussteller oder Logo.
3. **Erzeugen:** Der Server misst zuerst die Fußzeile und setzt danach das Dokument mit dem passenden Platz am Seitenende.
4. **Zurückgeben:** Das PDF kommt zusammen mit Seitenzahl, Anteil der Fußzeile und tatsächlicher Logogröße zurück. Daraus entstehen die Hinweise im Formular. Die Antwort darf nicht zwischengespeichert werden.
5. **Anzeigen:** Der Browser zeichnet die Seiten. Die alte Fassung bleibt sichtbar, bis die neue fertig ist.

Beim Entwurf läuft es ebenso. Der ungespeicherte Stand kommt als Formularwert, Buchung, Abzüge und Stammdaten lädt der Server selbst. Für das Logo liest der Server die Datei mit dem geheimen Schlüssel, aber erst, nachdem er den Zugriff auf den Entwurf geprüft hat. Mitarbeiter sehen das Logo so im PDF und bekommen keinen Link zur Datei.

### Für /frontend und /backend
- **/frontend:** Reiter, Formular, PDF-Anzeige, Vorlage und Vorschau-Schnittstelle, Musterrechnung, Schriftdateien, Entwurfsvorschau. Bis zur Migration nutzt die Vorschau die Formularwerte; die erste Aufgabe ist der Nachweis, dass die Erzeugung im Next-16-Build und auf Vercel läuft, samt Schriftdateien.
- **/backend:** Abschnitt in den Rechnungseinstellungen, Speicherfunktion, Protokoll, Lesefunktion für Mitarbeiter, Logo-Zugriff, Rechte und Integrationstests.
- **Deploy:** Migration vor dem Code. Der Drucktest mit echtem Kuvert muss vor dem Deploy erledigt sein.

### Abhängigkeiten
- `@react-pdf/renderer` (exakt festgelegte Version 4.9.0): erzeugt das PDF auf dem Server
- `pdfjs-dist`: zeigt das PDF im Browser, wird nur bei Bedarf geladen
- Schriftdateien: sechs Familien mit je vier Schnitten (normal, fett, kursiv, fett kursiv) als einzelne TTF-Dateien samt Lizenztexten (OFL)

### Ergebnis des Vorab-Versuchs (2026-11-04)
Mit der genannten Version wurde außerhalb des Projekts ein Wegwerf-Versuch gemacht, in Node, noch nicht in Next.js und nicht auf Vercel:

- **Bestätigt:** Fußzeile mit wechselnder Höhe auf jeder Seite, ohne Überlappung; „Seite x von y“; Zeilen werden nicht getrennt; Blocksatz; „Š“, „ő“, „ž“, „€“ in Carlito. Etwa 20 Millisekunden je Dokument ohne Serverstart.
- **Fehler gefunden:** Wurde im selben Serverprozess zuvor ein anderes Dokument erzeugt, fehlte in einem Testaufbau der erste Buchstabe aller Zeilen („osition“ statt „Position“). Andere Abfolgen zeigten das nicht. Die genaue Ursache ist nicht geklärt, der Fehler folgt aber dem gemeinsam genutzten Schriftzustand: Frisch geladene Schriften je Erzeugung beseitigten ihn in allen geprüften Fällen.
- **Folge:** Frische Schriften je Erzeugung ließen den Speicher im selben Prozess wachsen (etwa 3,5 MB je Dokument). Darum läuft jede Erzeugung abgeschirmt in einem eigenen, kurzlebigen Arbeitsprozess. Das ist noch nicht praktisch nachgewiesen und Teil des ersten Nachweises unter /frontend.

### Umsetzung Frontend (2026-11-04)

**Gebaut:** Reiter und Betreiber-Abschnitt mit Formular und Vorschau, PDF-Vorlage, Arbeitsprozess, Schnittstellen für Muster und Entwurf, Anzeige, gestaltete Entwurfsvorschau, 24 Schriftdateien samt Lizenztexten. Die alte HTML-Vorschau ist entfernt.

**Nachweis:** Im gebauten Next-Server läuft die Erzeugung in einem frischen Arbeitsprozess, in etwa 120 ms bei einer einfachen Seite und 200 bis 260 ms bei einer vollen Rechnung. Die Dateien stehen in der Ablaufliste der Serverfunktion. **Auf Vercel ist das noch nicht geprüft; das geht erst mit dem Staging-Deploy.**

**Abweichungen vom Design:**
- Turbopack bündelt den Arbeitsprozess nicht. Darum baut `scripts/build-pdf-worker.mjs` (esbuild) ihn vor `dev`, `build` und `test` nach `pdf-worker-build/` (nicht im Git). Dadurch bindet die App React-PDF selbst nie ein.
- Eine Baustein-Vorschau gibt es in Einstellungen → Rechnungen nicht. Dort ändert sich nichts; „Standard“ folgt dem Briefpapier im PDF.
- Ist `bottom` an einem Text mit `render` gesetzt, setzt React-PDF 4.9.0 ihn gar nicht. Die Seitenzeile steht darum mit `top`, und mit einer leeren Rückgabe verschwindet ein ganzes wiederholtes Element. Tests sichern das ab.
- Hinweise zu Logo und Fußzeile kommen aus der Antwort der Vorschau, nicht aus dem Formular: so stimmen sie immer mit dem PDF überein.

**Offen für /backend:**
- Spalten in `invoice_settings`: `letterhead_font`, `letterhead_font_size`, `letterhead_line_spacing`, `letterhead_paragraph_spacing`, `letterhead_logo_position`, `letterhead_logo_height_mm`, `letterhead_show_issuer`, `letterhead_updated_at`, mit den Standardwerten und Prüfungen aus `src/lib/letterhead.ts`
- Funktion `save_invoice_letterhead(p_tenant_id, p_expected_updated_at, p_data)` mit den Schlüsseln `font`, `font_size`, `line_spacing`, `paragraph_spacing`, `logo_position`, `logo_height_mm`, `show_issuer`; Fehlercodes P0910, P0914, P0011, P0016, 42501; Protokolleintrag „letterhead“ ohne Werte. Bis dahin meldet Speichern „Diese Funktion wird gerade eingerichtet“.
- `invoice_preview_data` liefert zusätzlich `letterhead` mit denselben Schlüsseln. Bis dahin sehen Entwürfe die Standardwerte.
- `.select(... as 'footer')` in `letterhead-data.ts` und `rpc(... as never)` nach `npm run db:types` bereinigen.

**Für /qa:** Erste E2E in `tests/PROJ-41-briefpapier.spec.ts`; Speichern, Konflikt, Protokoll, Logo-Fälle, Mitarbeiter-Logo und Safari fehlen noch. PROJ-40-Tests sind auf die PDF-Vorschau umgestellt, nur mit Filter „Vorschau“ geprüft.

**Bekanntes Risiko außerhalb dieses Features:** `next build` scheitert zeitweise mit „next/font/google queries have exactly one entry“. Laut Build-Log betrifft es Source Serif 4 und eine Antwort von Google mit `gstatic.com/l/font?kit=…`-Adressen. Der Code dazu stammt aus PROJ-2 und PROJ-39; ohne die Änderungen dieses Features trat es in 3 Läufen nicht auf, mit ihnen in etwa 4 von 10, was bei so wenigen Läufen keine Aussage über die Ursache erlaubt. Kann auch auf Vercel einen Build abbrechen.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
