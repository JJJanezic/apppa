# PROJ-49: Firmen wiederverwenden

## Status: In Progress
**Created:** 2026-11-08
**Last Updated:** 2026-11-08

## Dependencies
- Requires: PROJ-7 (Gäste-Datenbank): Firma als Zusatzangabe am Gast, Gastformular, Suche ohne Rücksicht auf Groß-/Kleinschreibung und Umlaute
- Requires: PROJ-33 (Firmenanschrift aufteilen): Firmenname, UID und Rechnungsadresse in Feldern (Adresszeile 1/2, PLZ, Ort, Staat)
- Requires: PROJ-48 (Ort und Staat aus der PLZ): Automatik in der Firmenanschrift, die übernommene Werte nicht überschreiben darf
- Wirkt mit: PROJ-8 (Manuelle Buchungen) und PROJ-37 (Rechnungen nacherfassen). Beide verwenden dasselbe Gastformular und erhalten das Verhalten automatisch.
- Wirkt mit: PROJ-40 (Rechnungsentwurf): Empfänger „Firma“ liest die Firmendaten des Gastes. Daran ändert sich nichts.

## Überblick
Bei Dienstwohnungen buchen oft mehrere Personen derselben Firma. Bisher müssen Firmenname, UID und Rechnungsadresse bei jedem Gast neu eingetippt werden. Künftig schlägt die App beim Tippen des Firmennamens Firmen vor, die schon bei anderen Gästen desselben Kunden erfasst sind. Ein Klick übernimmt Firmenname, UID und Rechnungsadresse in das Formular.

Die Daten werden **kopiert**, nicht verknüpft. Nach der Übernahme gehören sie allein diesem Gast. Eine spätere Änderung bei einem Gast wirkt nicht auf andere Gäste. Es gibt keine eigene Firmenliste.

## User Stories
- Als **Inhaber** möchte ich beim Anlegen eines Gastes eine bereits erfasste Firma auswählen, damit ich Firmenname, UID und Rechnungsadresse nicht erneut eintippen muss.
- Als **Mitarbeiter** möchte ich beim Anlegen eines neuen Gastes im Buchungsformular die Firma eines früheren Gastes übernehmen, damit Dienstwohnungs-Buchungen schnell und mit richtiger Rechnungsadresse erfasst sind.
- Als **Inhaber** möchte ich bei einem bestehenden Gast nachträglich die Firma eines anderen Gastes übernehmen, damit ich unvollständige Firmendaten rasch ergänze.
- Als **Inhaber** möchte ich unterschiedliche Fassungen derselben Firma (z. B. alte und neue Adresse) getrennt sehen, damit ich bewusst die richtige wähle.
- Als **Inhaber** möchte ich, dass ein gewählter Vorschlag alle Firmenfelder vollständig setzt, damit keine Mischung aus zwei Firmen entsteht.
- Als **Inhaber** möchte ich weiterhin jede neue Firma frei eintippen können, damit die Vorschläge mich nie einschränken.
- Als **Inhaber** möchte ich, dass die Änderung der Firmendaten bei einem Gast andere Gäste nicht verändert, damit ich jeden Gast gezielt pflegen kann.

## Geltungsbereich
- **Formulare:** nur das gemeinsame Gastformular, Bereich „Firma“, Feld „Firmenname“. Es kommt an drei Stellen vor: Gästeseite (Anlegen und Bearbeiten), „Neuer Gast“ im Buchungsformular, „Neuer Gast“ beim Nacherfassen von Rechnungen.
- **Rollen:** alle, die dieses Formular nutzen dürfen (Inhaber und Mitarbeiter). Keine neuen Rechte. Mitarbeiter bearbeiten bestehende Gäste weiterhin nicht.
- **Herkunft der Vorschläge:** Gäste des gerade gewählten Kunden. Nie Firmen anderer Kunden.

## Regeln

### Vorschläge suchen
- Die Vorschläge erscheinen beim Tippen ins Feld „Firmenname“, sobald dort mindestens 2 Zeichen stehen (Leerzeichen am Rand zählen nicht).
- Gefunden wird jede Firma, deren Name den eingegebenen Text irgendwo enthält. Groß-/Kleinschreibung, Umlaute und Akzente spielen keine Rolle (wie die Gästesuche in PROJ-7).
- Gesucht wird nur im Firmennamen, nicht in UID oder Adresse.
- Berücksichtigt werden Gäste des gewählten Kunden mit Firmennamen. Ausgenommen ist der Gast, der gerade bearbeitet wird.
- Anonymisierte und gelöschte Gäste haben keine Firmendaten mehr und liefern daher keine Vorschläge.

### Fassungen zusammenfassen
- Zwei Gäste haben dieselbe Fassung einer Firma, wenn Firmenname, UID, Adresszeile 1, Adresszeile 2, PLZ, Ort und Staat übereinstimmen. Groß-/Kleinschreibung und Leerzeichen am Rand zählen dabei nicht.
- Gleiche Fassungen erscheinen als ein Vorschlag. Angezeigt und übernommen werden die Werte des Gastes, der zuletzt geändert wurde.
- Unterschiedliche Fassungen erscheinen jeweils als eigener Vorschlag.

### Anzeige der Vorschläge
- Jeder Vorschlag zeigt in der ersten Zeile den Firmennamen, darunter UID, „PLZ Ort“ und Adresszeile 1, soweit vorhanden. Leere Teile entfallen ohne Lücken oder Trennzeichen.
- Reihenfolge: zuletzt geänderte Fassung zuerst.
- Höchstens 8 Vorschläge. Bei mehr Treffern grenzt weiteres Tippen ein. Es gibt keinen Hinweis auf weitere Treffer.
- Gibt es keine Treffer, erscheint keine Liste und kein Hinweis.

### Bedienung
- Auswahl mit Pfeiltasten und Enter, mit der Maus oder per Touch. Esc schließt die Liste, der getippte Text bleibt stehen.
- Die Liste schließt sich auch, wenn das Feld verlassen wird, ohne dass etwas übernommen wird.
- Ohne Auswahl bleibt „Firmenname“ ein normales Textfeld. Jede neue Firma kann frei eingetippt werden.

### Übernehmen
- Ein gewählter Vorschlag setzt Firmenname, UID, Adresszeile 1, Adresszeile 2, PLZ, Ort und Staat genau so wie im Vorschlag. Leere Werte des Vorschlags leeren auch das Formularfeld.
- Es gibt keine Rückfrage, auch wenn schon Firmenfelder befüllt waren. Gespeichert wird erst mit „Speichern“, bis dahin ist alles korrigierbar.
- Übernommene Werte gelten als von Hand eingegeben. Die PLZ-Automatik aus PROJ-48 überschreibt Ort und Staat der Firma nicht, solange die PLZ nicht selbst geändert wird.
- Nach der Übernahme sind alle Felder frei änderbar und es gelten die Prüfregeln aus PROJ-7 und PROJ-33.
- Nur der Bereich „Firma“ wird befüllt. Name, Kontakt, Privatadresse und alle übrigen Gastfelder bleiben unverändert.
- Die übernommenen Daten sind eine Kopie. Weder der Quell-Gast noch andere Gäste werden verändert. Es entsteht keine Verbindung zwischen den Gästen.

## Out of Scope
- **Eigene Firmenliste mit Verknüpfung** (Firma als eigener Eintrag, Änderung wirkt auf alle Gäste der Firma): bewusst nicht gewählt; kann später als eigenes Feature ergänzt werden
- **Firmendaten bei allen Gästen einer Firma gemeinsam ändern** (z. B. bei Umzug der Firma)
- **Liste „Alle Gäste der Firma X“** im Gast-Detail oder als eigene Seite
- **Suche nach UID oder Adresse** in den Vorschlägen
- **Hinweis „Firma bereits vorhanden“**, wenn ein eingetippter Name einer erfassten Firma entspricht, aber kein Vorschlag gewählt wurde
- **Bereinigen ähnlicher Schreibweisen** (z. B. „Muster GmbH“ und „Muster G.m.b.H.“): beide erscheinen als eigene Vorschläge
- **Firmen anderer Kunden** als Vorschläge, auch nicht für Betreiber oder Personen mit mehreren Kunden
- **Vorschläge im Rechnungsentwurf** (PROJ-40) oder bei der Empfängerangabe einer nacherfassten Rechnung ohne Gast: unverändert
- **Änderungen am Zusammenführen, Anonymisieren oder Änderungsprotokoll**: Die Firmendaten bleiben Felder am Gast wie bisher
- **Firma ohne Ansprechperson** als eigener Gast: weiterhin nicht vorgesehen (PROJ-7)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Vorschläge erscheinen
- [ ] Angenommen beim gewählten Kunden hat ein Gast die Firma „Muster GmbH“, wenn ein Inhaber im Gastformular beim Firmennamen „mu“ tippt, dann erscheint „Muster GmbH“ als Vorschlag
- [ ] Angenommen beim gewählten Kunden hat ein Gast die Firma „Muster GmbH“, wenn ein Inhaber nur „m“ tippt, dann erscheint keine Vorschlagsliste
- [ ] Angenommen ein Gast hat die Firma „Hotel Müller KG“, wenn „muller“ getippt wird, dann erscheint „Hotel Müller KG“ als Vorschlag
- [ ] Angenommen ein Gast hat die Firma „Hotel Muster KG“, wenn „MUSTER“ getippt wird, dann erscheint „Hotel Muster KG“ als Vorschlag
- [ ] Angenommen ein Gast hat die UID „ATU12345678“ und den Firmennamen „Muster GmbH“, wenn beim Firmennamen „ATU123“ getippt wird, dann erscheint dieser Vorschlag nicht
- [ ] Angenommen kein Gast hat eine passende Firma, wenn getippt wird, dann erscheint weder eine Liste noch ein Hinweis
- [ ] Angenommen ein Mitarbeiter legt im Buchungsformular einen neuen Gast an, wenn er beim Firmennamen „mu“ tippt, dann erscheinen dieselben Vorschläge wie für einen Inhaber
- [ ] Angenommen ein Inhaber legt beim Nacherfassen einer Rechnung einen neuen Gast an, wenn er beim Firmennamen tippt, dann erscheinen Vorschläge wie auf der Gästeseite

### Herkunft
- [ ] Angenommen die Firma „Muster GmbH“ ist nur bei einem Gast eines anderen Kunden erfasst, wenn beim gewählten Kunden „mu“ getippt wird, dann erscheint sie nicht
- [ ] Angenommen ein Inhaber bearbeitet den einzigen Gast mit der Firma „Muster GmbH“, wenn er beim Firmennamen „mu“ tippt, dann erscheint kein Vorschlag aus diesem Gast selbst
- [ ] Angenommen ein Gast mit Firma wurde anonymisiert, wenn nach seinem früheren Firmennamen gesucht wird, dann erscheint kein Vorschlag aus diesem Gast

### Fassungen
- [ ] Angenommen zwei Gäste haben „Muster GmbH“ mit identischer UID und Rechnungsadresse, wenn „mu“ getippt wird, dann erscheint genau ein Vorschlag
- [ ] Angenommen zwei Gäste haben „Muster GmbH“ und „muster gmbh “ mit sonst gleichen Feldern, wenn „mu“ getippt wird, dann erscheint genau ein Vorschlag mit den Werten des zuletzt geänderten Gastes
- [ ] Angenommen ein Gast hat „Muster GmbH, Hauptstraße 1“ und ein anderer „Muster GmbH, Ringstraße 5“, wenn „mu“ getippt wird, dann erscheinen zwei Vorschläge
- [ ] Angenommen zwei Gäste haben dieselbe Firmenadresse, aber nur einer eine UID, wenn „mu“ getippt wird, dann erscheinen zwei Vorschläge
- [ ] Angenommen mehrere Fassungen passen, wenn die Liste erscheint, dann steht die Fassung des zuletzt geänderten Gastes oben

### Anzeige
- [ ] Angenommen ein Vorschlag mit Name „Muster GmbH“, UID „ATU12345678“, Adresszeile 1 „Hauptstraße 1“, PLZ „1010“, Ort „Wien“, wenn die Liste erscheint, dann zeigt der Vorschlag „Muster GmbH“ und darunter UID, „1010 Wien“ und „Hauptstraße 1“
- [ ] Angenommen ein Vorschlag hat nur einen Firmennamen, wenn die Liste erscheint, dann zeigt er nur den Namen ohne leere Zeilen oder Trennzeichen
- [ ] Angenommen 12 Fassungen passen, wenn die Liste erscheint, dann zeigt sie höchstens 8 Vorschläge

### Bedienung
- [ ] Angenommen die Vorschlagsliste ist offen, wenn der Nutzer mit Pfeil nach unten einen Vorschlag markiert und Enter drückt, dann wird dieser Vorschlag übernommen und die Liste schließt sich
- [ ] Angenommen die Vorschlagsliste ist offen, wenn der Nutzer einen Vorschlag mit Maus oder Finger antippt, dann wird er übernommen
- [ ] Angenommen die Vorschlagsliste ist offen, wenn der Nutzer Esc drückt, dann schließt sich die Liste und der getippte Text bleibt stehen
- [ ] Angenommen der Nutzer tippt „Neue Firma AG“, für die es keinen Vorschlag gibt, wenn er speichert, dann wird „Neue Firma AG“ wie bisher gespeichert
- [ ] Angenommen die Liste ist offen, wenn der Nutzer das Feld per Tab verlässt, dann schließt sich die Liste und kein Vorschlag wird übernommen

### Übernehmen
- [ ] Angenommen die Firmenfelder sind leer, wenn der Vorschlag „Muster GmbH“ mit UID, Adresszeile 1, PLZ, Ort und Staat gewählt wird, dann stehen genau diese Werte in den Firmenfeldern
- [ ] Angenommen im Formular stehen bereits UID „ATU99999999“ und Adresszeile 2 „Top 5“, wenn ein Vorschlag mit anderer UID und ohne Adresszeile 2 gewählt wird, dann steht die UID des Vorschlags im Feld und Adresszeile 2 ist leer
- [ ] Angenommen ein Vorschlag wurde übernommen, wenn der Nutzer danach die PLZ der Firma nicht ändert, dann ändert die PLZ-Automatik (PROJ-48) Ort und Staat der Firma nicht
- [ ] Angenommen ein Vorschlag wurde übernommen, wenn der Nutzer danach die PLZ der Firma ändert, dann arbeitet die PLZ-Automatik wie in PROJ-48 beschrieben
- [ ] Angenommen ein Vorschlag wurde übernommen, wenn der Nutzer anschließend z. B. die Adresszeile 2 ändert und speichert, dann wird der geänderte Wert gespeichert
- [ ] Angenommen ein Vorschlag wird übernommen, wenn das Formular angezeigt wird, dann sind Name, Kontakt, Privatadresse und alle übrigen Gastfelder unverändert
- [ ] Angenommen ein Vorschlag wurde übernommen, wenn der Nutzer das Formular ohne Speichern schließt, dann ist beim Gast nichts geändert
- [ ] Angenommen ein Vorschlag mit einer Adresszeile über 200 Zeichen (Altdaten aus PROJ-33) wird übernommen, wenn gespeichert wird, dann erscheint die bekannte Fehlermeldung für zu lange Adresszeilen und nichts wird gespeichert

### Kopie statt Verknüpfung
- [ ] Angenommen Gast B hat die Firma von Gast A übernommen und gespeichert, wenn danach die Rechnungsadresse bei Gast A geändert wird, dann bleibt die Rechnungsadresse bei Gast B unverändert
- [ ] Angenommen Gast B hat die Firma von Gast A übernommen, wenn gespeichert wird, dann sind die Firmendaten von Gast A unverändert und es gibt keinen neuen Eintrag im Änderungsprotokoll von Gast A
- [ ] Angenommen ein Vorschlag wurde übernommen und gespeichert, wenn das Änderungsprotokoll des bearbeiteten Gastes angezeigt wird, dann erscheinen die Firmenfelder wie jede andere Änderung von Hand

## Edge Cases
- **Firma nur mit Adresse, ohne Firmennamen:** liefert keinen Vorschlag, weil nur im Firmennamen gesucht wird
- **Ähnliche Schreibweisen** („Muster GmbH“, „Muster G.m.b.H.“): erscheinen als getrennte Vorschläge; keine automatische Bereinigung
- **Vorschläge laden nicht** (Netzwerkfehler, Zeitüberschreitung): keine Liste und keine Fehlermeldung; das Feld bleibt ein normales Textfeld und Speichern funktioniert
- **Gleichzeitige Änderung:** Ändert ein anderer Nutzer die Firmendaten eines Gastes, während die Liste offen ist, wird die beim Öffnen geladene Fassung übernommen. Der bestehende Schutz vor Überschreiben aus PROJ-7 gilt unverändert für den bearbeiteten Gast
- **Altdaten über 200 Zeichen** (PROJ-33): werden übernommen; die Längenprüfung greift beim Speichern
- **Vorschlag nach Teilübernahme:** Wer nach der Übernahme den Firmennamen wieder ändert, bekommt erneut Vorschläge; ein neuer Vorschlag ersetzt wieder alle Firmenfelder
- **Bereich „Firma“ zugeklappt:** Die Vorschläge erscheinen erst, wenn der Bereich geöffnet ist und im Firmennamen getippt wird
- **Viele Gäste:** auch bei einigen tausend Gästen erscheinen die Vorschläge ohne spürbare Verzögerung
- **Handy:** Die Liste ist mit dem Finger bedienbar und wird von der Bildschirmtastatur nicht verdeckt

## Technical Requirements (optional)
- Sicherheit: Vorschläge nur aus dem gewählten Kunden; Mandantentrennung und Rollenregeln aus PROJ-7 unverändert
- Keine Änderung am Datenmodell der Firma am Gast (PROJ-33)
- Bedienbar per Tastatur und für Bildschirmleser wie die übrigen Auswahllisten der App
- Browser: Chrome, Firefox, Safari (Desktop und mobil)

## Open Questions
- [ ] Reichen 8 Vorschläge und 2 Zeichen Mindestlänge in der Praxis? Nach den ersten Wochen im Pilotbetrieb prüfen
- [ ] Braucht es später eine echte Firmenliste mit Verknüpfung (z. B. für gemeinsame Adressänderung oder „Alle Gäste der Firma“)? Bei Bedarf als eigenes Feature

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Firmendaten kopieren statt eigene Firmenliste mit Verknüpfung | Datenmodell, Zusammenführen, Anonymisieren und Rechnungen bleiben unverändert; kleiner Umfang für die Pilotphase; Firmenliste später ergänzbar | 2026-11-08 |
| Jede unterschiedliche Fassung ist ein eigener Vorschlag; gleiche Fassungen zusammengefasst; zuletzt geänderte zuerst | Keine stille Übernahme veralteter oder unvollständiger Daten; Nutzer wählt bewusst | 2026-11-08 |
| Vorschlag ersetzt alle Firmenfelder vollständig, auch mit leeren Werten, ohne Rückfrage | Keine Mischung aus zwei Firmen; Rückfrage wäre ein Extra-Klick für einen seltenen Fall; bis zum Speichern korrigierbar | 2026-11-08 |
| Übernommene Werte gelten als von Hand eingegeben (PROJ-48-Automatik überschreibt nicht) | Gewählte Fassung soll unverändert ankommen | 2026-11-08 |
| Ab 2 Zeichen, „enthält“-Suche wie die Gästesuche, nur im Firmennamen, höchstens 8 Vorschläge | Kurze, überschaubare Liste; gleiche Suchlogik wie bekannt; UID-Suche nicht nötig | 2026-11-08 |
| Nur Gäste des gewählten Kunden, ohne den bearbeiteten Gast | Mandantentrennung; eigene Fassung als Vorschlag wäre sinnlos | 2026-11-08 |
| Vorschläge an allen drei Stellen des Gastformulars, für Inhaber und Mitarbeiter | Größter Nutzen beim Anlegen im Buchungsformular; Mitarbeiter sehen Firmendaten ohnehin in Gästeliste und Detail | 2026-11-08 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Keine Änderung an der Gast-Tabelle; Vorschläge werden bei jeder Anfrage aus den bestehenden Firmenfeldern gebildet | Kopie-Prinzip ohne eigene Firmenliste; keine Daten doppelt halten; nichts zu migrieren oder beim Anonymisieren zusätzlich zu leeren | 2026-11-08 |
| Neue Lesefunktion in der Datenbank, die sucht, Fassungen zusammenfasst, sortiert und auf 8 begrenzt | Zusammenfassen und „zuletzt geändert“ sind in der Datenbank einfach und schnell; der Browser bekommt nur 8 fertige Zeilen statt aller Gäste | 2026-11-08 |
| Die Funktion läuft mit den Rechten der angemeldeten Person (bestehende Leseregel „Mitglieder lesen Gäste“) | Mandantentrennung durch die vorhandene Regel; Inhaber und Mitarbeiter dürfen Gäste ohnehin lesen; keine neuen Rechte | 2026-11-08 |
| Vergleich über die bestehende Vereinheitlichung der Gastsuche (Kleinbuchstaben, ohne Akzente) | Gleiches Suchverhalten wie die Gästesuche (PROJ-7), keine zweite Regel | 2026-11-08 |
| Zuerst über den vorhandenen Suchindex vorfiltern, dann genau im Firmennamen prüfen | Der Suchtext enthält den Firmennamen bereits; schnell auch bei vielen Gästen, kein neuer Index | 2026-11-08 |
| Neue Server-Aktion „Firmenvorschläge“ neben der Gastsuche, ab 2 Zeichen, mit kurzer Tipp-Verzögerung | Gleiches Muster wie die Gastsuche (PROJ-7); gewählter Kunde kommt vom Server, nicht vom Browser | 2026-11-08 |
| Der bearbeitete Gast wird über eine optionale Angabe an das Gastformular ausgeschlossen | Nur die Gästeseite kennt einen bestehenden Gast; Buchungs- und Rechnungsformular legen immer neue Gäste an | 2026-11-08 |
| Vorschlagsliste unter dem Feld mit der vorhandenen Auswahllisten-Komponente (Command), als Eingabefeld mit Liste nach ARIA-Muster | shadcn-Komponente schon installiert; Tastatur und Bildschirmleser wie in der übrigen App; kein neues Paket | 2026-11-08 |
| Beim Übernehmen wird der Merker „automatisch befüllt“ der Firmen-PLZ-Automatik (PROJ-48) zurückgesetzt | Sonst könnte ein früher automatisch eingetragener Ort als „überschreibbar“ gelten und die übernommene Fassung verändern | 2026-11-08 |
| Fehler beim Laden der Vorschläge werden still ignoriert | Spec: Feld bleibt normales Textfeld, keine Fehlermeldung | 2026-11-08 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Kleine Erweiterung ohne neue Seiten, Tabellen oder Pakete. Das Feld „Firmenname“ im gemeinsamen Gastformular bekommt eine Vorschlagsliste. Die Vorschläge holt der Browser beim Tippen über eine neue Server-Aktion. Diese ruft eine neue Lesefunktion in der Datenbank auf. Die Funktion sucht in den Firmenfeldern der Gäste des gewählten Kunden, fasst gleiche Fassungen zusammen und liefert höchstens 8 Zeilen. Wählt der Nutzer einen Vorschlag, setzt das Formular die sieben Firmenfelder. Gespeichert wird wie bisher erst mit „Speichern“.

### Komponenten (was sich in der Oberfläche ändert)
```
Gastformular (gemeinsamer Baustein, unverändert an drei Stellen eingebunden)
+-- Bereich „Firma“ (aufklappbar, wie bisher)
    +-- Firmenname  ← NEU: Eingabefeld mit Vorschlagsliste
    |   +-- Vorschlagsliste (ab 2 Zeichen, höchstens 8 Einträge)
    |       +-- Eintrag: Firmenname
    |           darunter klein: UID · „PLZ Ort“ · Adresszeile 1 (leere Teile entfallen)
    +-- UID-Nummer (unverändert)
    +-- Rechnungsadresse: Adresszeile 1/2, PLZ | Ort, Staat (unverändert, PLZ-Automatik aus PROJ-48)

Eingebunden in:
+-- Gästeseite: Gast anlegen / bearbeiten   → übergibt beim Bearbeiten den eigenen Gast zum Ausschließen
+-- Buchungsformular: „Neuer Gast“           → nichts auszuschließen
+-- Rechnung nacherfassen: „Neuer Gast“      → nichts auszuschließen
```

**Neuer Baustein „Firmenname mit Vorschlägen“:**
- Ein normales Textfeld, das zusätzlich eine Liste öffnet. Ohne Auswahl verhält es sich exakt wie bisher, mit Längenprüfung und Fehlermeldung.
- Bedienung nach dem üblichen Muster für Eingabefelder mit Liste: Pfeiltasten, Enter, Esc, Maus und Touch. Der Bildschirmleser bekommt die Anzahl der Treffer angesagt.
- Kurze Verzögerung beim Tippen (wie bei der Gastsuche, ca. 0,2 s). Kommt eine Antwort an, während schon weitergetippt wurde, wird sie verworfen.
- Die Liste schließt sich bei Esc, beim Verlassen des Feldes und nach einer Auswahl. Tab wählt nichts aus (vgl. Safari-Fehler BUG-1 in PROJ-48).
- Auf dem Handy liegt die Liste direkt unter dem Feld. Das Formular scrollt so, dass sie über der Bildschirmtastatur sichtbar ist.

**Übernehmen eines Vorschlags:**
- Setzt Firmenname, UID, Adresszeile 1 und 2, PLZ, Ort und Staat. Leere Werte leeren das jeweilige Feld.
- Die Felder gelten als geändert. Bereits angezeigte Prüffehler werden neu geprüft.
- Der Merker der Firmen-PLZ-Automatik („Ort/Staat wurden automatisch befüllt“) wird zurückgesetzt. Die übernommenen Werte gelten damit als von Hand eingegeben. Erst eine neue Eingabe im PLZ-Feld startet die Automatik wieder.
- Gastanschrift und alle übrigen Gastfelder werden nicht angefasst.

### Datenmodell
Keine Änderung. Die Firma bleibt eine Gruppe von sieben Feldern am Gast (PROJ-33): Firmenname, UID, Adresszeile 1, Adresszeile 2, PLZ, Ort, Staat. Jeder Gast hat bereits „zuletzt geändert am“.

**Neue Lesefunktion „Firmenvorschläge“ (in der Datenbank):**
- Eingaben: Kunde, Suchtext, optional ein auszuschließender Gast
- Berücksichtigt nur Gäste dieses Kunden mit Firmennamen, die nicht anonymisiert sind, ohne den ausgeschlossenen Gast
- Treffer: Der vereinheitlichte Firmenname enthält den vereinheitlichten Suchtext. Vereinheitlicht heißt: Kleinbuchstaben, ohne Akzente, wie bei der Gästesuche.
- Fassung: Gäste werden zusammengefasst, wenn alle sieben Felder nach Kleinschreibung und ohne Leerzeichen am Rand übereinstimmen. Je Fassung wird der zuletzt geänderte Gast als Quelle der angezeigten Werte genommen.
- Reihenfolge: nach „zuletzt geändert“ der Fassung, neueste zuerst; höchstens 8 Zeilen
- Liefert je Zeile nur die sieben Firmenfelder, keine Gastnamen oder sonstigen Personendaten
- Läuft mit den Rechten der angemeldeten Person. Die bestehende Leseregel für Gäste (Mitglieder des Kunden und Betreiber) begrenzt damit automatisch auf den eigenen Kunden.

**Neue Server-Aktion „Firmenvorschläge“** (neben der bestehenden Gastsuche):
- Prüft Anmeldung und Mitgliedschaft (Inhaber oder Mitarbeiter) im gewählten Kunden, wie die Gastsuche
- Unter 2 Zeichen: leere Liste ohne Datenbankabfrage
- Suchtext auf 200 Zeichen begrenzt; ungültige Gast-Kennung zum Ausschließen wird ignoriert
- Fehler führen zu einer leeren Liste, im Browser ohne Meldung, auf dem Server protokolliert wie üblich

### Sicherheit und Datenschutz
- Mandantentrennung doppelt: Der Kunde kommt aus der Sitzung auf dem Server, und die Datenbank-Leseregel greift zusätzlich.
- Es werden nur Firmendaten zurückgegeben, keine Rückschlüsse darauf, welcher Gast sie trägt.
- Anonymisierte Gäste haben ohnehin keine Firmendaten. Die Funktion schließt sie trotzdem ausdrücklich aus.
- Keine Schreibrechte, keine neuen Rollenregeln. Das Speichern läuft unverändert über die bestehenden Wege (Gast speichern nur Inhaber, Buchung mit neuem Gast alle Mitglieder).

### Leistung
- Die Abfrage nutzt den vorhandenen Suchindex der Gäste (Suchtext enthält den Firmennamen) als Vorfilter und prüft dann genau im Firmennamen.
- Bei einigen tausend Gästen je Kunde bleibt die Antwort im Bereich weniger Millisekunden. Übertragen werden höchstens 8 kurze Zeilen.

### Tests (Hinweise für Frontend/Backend/QA)
- Datenbank: Zusammenfassen gleicher Fassungen (Groß-/Kleinschreibung, Leerzeichen), getrennte Fassungen, Reihenfolge, Grenze 8, Ausschluss des eigenen Gastes, anonymisierte Gäste, kein Zugriff auf andere Kunden, Mitarbeiter darf lesen
- Unit: Übernahme setzt alle sieben Felder inkl. Leeren; PLZ-Merker wird zurückgesetzt
- E2E: Tippen, Auswahl mit Tastatur und Maus, Esc, Tab ohne Übernahme; an allen drei Stellen; Mitarbeiter im Buchungsformular

### Abhängigkeiten (Pakete)
Keine neuen Pakete. Genutzt werden die vorhandene shadcn-Komponente „Command“, react-hook-form und die bestehende Vereinheitlichung der Gästesuche in der Datenbank.

### Umsetzung Frontend (2026-11-08)
- **Baustein** `src/components/guests/company-name-field.tsx`: Feld „Firmenname“ mit Vorschlagsliste, in `guest-fields.tsx` anstelle des bisherigen Textfelds. Die Suche startet nur bei Eingaben im Feld (0,2 s Verzögerung, ab 2 Zeichen). Veraltete Antworten werden verworfen. Fehler führen still zu einer leeren Liste. Ein Live-Bereich sagt die Trefferzahl und die Übernahme an.
- **Wiederverwendung statt neuem Kombinationsfeld:** `src/components/vat/label-combobox.tsx` (PROJ-35) bekam zwei optionale Erweiterungen: `detail` als zweite, kleinere Zeile je Eintrag und `filter={false}` für Listen, die schon passend vom Server kommen. Das bisherige Verhalten bei Zusatzkosten und Rechnungspositionen bleibt unverändert. Tab schließt die Liste ohne Übernahme.
- **Esc im Seitenpanel:** `src/components/detail-panel.tsx` lässt das Panel offen, wenn Esc in einem Kombinationsfeld mit offener Liste gedrückt wird. Die Regel gilt allgemein für alle Panels. Die bisherigen Einzel-Abfragen in Buchungs- und Rechnungsformular bleiben bestehen und schaden nicht.
- **Zusammenspiel mit PROJ-48:** `postal-place-fields.tsx` bietet über einen Ref `reset()` an. Das Gastformular ruft es für die Firmenanschrift nach jeder Übernahme auf. Damit gelten Ort und Staat als von Hand eingegeben, und eine laufende Nachschlage-Antwort wird verworfen.
- **Ausschluss des eigenen Gastes:** `GuestFields` hat die neue optionale Angabe `guestId`. Nur `guest-panel.tsx` übergibt sie beim Bearbeiten. Buchungsformular und Rechnungsnacherfassung legen immer neue Gäste an.
- **Logik** `src/lib/guests.ts`: Typ `CompanySuggestion`, Grenzen (2 Zeichen, 8 Vorschläge), `companySuggestionDetail` (UID · „PLZ Ort“ · Adresszeile 1). In `src/lib/validation/guests.ts`: `companyInputFromSuggestion` (alle sieben Felder, leere Werte als leere Felder). Unit-Tests in `guests.test.ts` und `validation/guests.test.ts`.
- **Server-Aktion** `suggestCompanies` in `src/app/(app)/gaeste/actions.ts`: alle Mitglieder, Kunde aus der Sitzung, Suchtext auf 200 Zeichen begrenzt, ungültige Gast-Kennung ignoriert. Sie ruft die Datenbankfunktion `guest_company_suggestions` auf. Deren Typ ist in `src/types/database.ts` vorab eingetragen, die Funktion selbst entsteht mit `/backend`. Bis dahin bleibt die Liste leer.
- **Messages:** `guests.panel.companySuggestions`, `companySuggestionsFound`, `companySuggestionApplied`.
- **Prüfung:** `tsc`, ESLint, Unit-Tests (65) und `npm run build` grün. E2E folgt nach `/backend`, weil die Vorschläge die Datenbankfunktion brauchen.

### Umsetzung Backend (2026-11-08)
- **Migration** `supabase/migrations/20261108142504_guest_company_suggestions.sql`: neue Lesefunktion `public.guest_company_suggestions(p_tenant_id, p_query, p_exclude_id)`. Sie läuft mit den Rechten der angemeldeten Person, Ausführen dürfen nur angemeldete Personen. Keine Änderung an Tabellen, Regeln oder Indizes.
  - Suchtext wie in der Gästesuche vereinheitlicht (`private.guest_norm`), auf 200 Zeichen begrenzt, LIKE-Platzhalter werden wörtlich genommen. Unter 2 Zeichen gibt es keine Treffer.
  - Vorfilter über den vorhandenen Suchindex (`search_text`), danach Prüfung genau im vereinheitlichten Firmennamen
  - Berücksichtigt nur nicht anonymisierte Gäste des Kunden mit Firmennamen. Der übergebene Gast ist ausgeschlossen.
  - Fassungen: Gruppiert wird nach allen sieben Feldern, kleingeschrieben und ohne Leerzeichen am Rand. Je Fassung zählen die Werte des zuletzt geänderten Gastes. Ausgabe nach „zuletzt geändert“, höchstens 8 Zeilen, nur Firmenfelder.
- **Dev:** eingespielt, `db:types` erzeugt. Der Typ war im Frontend bereits identisch eingetragen. Die Advisor-Prüfung meldet nur die bekannte Auth-Warnung zur OTP-Laufzeit, nichts zur neuen Funktion.
- **Server-Aktion** und Frontend wie unter „Umsetzung Frontend“, ohne weitere Änderung.
- **Integrationstest** `supabase/tests/guest-company-suggestions.integration.test.ts` (8 Tests, grün):
  - Umlaute und Schreibung, Mindestlänge, nur Firmenname (nicht Gastname oder UID), Platzhalter wörtlich
  - Fassungen zusammenfassen und trennen, Reihenfolge, Grenze 8
  - Ausschluss des eigenen und anonymisierter Gäste
  - Mitarbeiter liest, fremder Kunde sieht nichts
- **Regression:** `guests.integration.test.ts` (15) grün.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
