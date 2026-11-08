# PROJ-49: Firmen wiederverwenden

## Status: Planned
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
