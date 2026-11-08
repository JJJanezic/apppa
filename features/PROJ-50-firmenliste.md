# PROJ-50: Firmenliste

## Status: In Progress
**Created:** 2026-11-08
**Last Updated:** 2026-11-08 (Backend)

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Rollen Inhaber/Mitarbeiter, gewählter Kunde
- Requires: PROJ-7 (Gäste-Datenbank): Gastformular, Gästeliste, Gast-Detail, Zusammenführen, Löschen/Anonymisieren, Änderungsprotokoll, Suche ohne Rücksicht auf Groß-/Kleinschreibung und Umlaute
- Requires: PROJ-33 (Firmenanschrift aufteilen): Firmenfelder Name, UID, Adresszeile 1/2, PLZ, Ort, Staat; bestehende Daten werden überführt
- Requires: PROJ-48 (Ort und Staat aus der PLZ): PLZ-Automatik in der Firmenanschrift
- Löst ab: PROJ-49 (Firmen wiederverwenden): Vorschläge beim Firmennamen und Kopie entfallen
- Wirkt mit: PROJ-8 (Manuelle Buchungen) und PROJ-37 (Rechnungen nacherfassen): „Neuer Gast“ verwendet dasselbe Gastformular und erhält die Firmenauswahl automatisch
- Wirkt mit: PROJ-40 (Rechnungsentwurf): Empfänger „Firma“ liest künftig die verknüpfte Firma des Hauptgasts (weiterhin als Kopie)
- Wirkt mit: PROJ-42/PROJ-44 (Ausstellen, Storno): Rechnungen speichern den Empfänger selbst und bleiben von Firmenänderungen unberührt

## Überblick
Firmen werden zu eigenen Einträgen je Kunde. Ein Gast ist mit höchstens einer Firma verknüpft. Die Firmendaten werden an einer Stelle gepflegt, und eine Änderung gilt für alle verknüpften Gäste. Im Gastformular wählt man „Keine Firma“, „Bestehende Firma“ (Suche, danach eine Karte nur zum Lesen) oder „Neue Firma“ (leere Felder). Die Firmen stehen unter „Gäste“ im neuen Reiter „Firmen“, mit Liste, Detailansicht samt Gästen, Buchungen und Rechnungen der Firma, Zusammenführen und Vorschlägen für doppelte Firmen. Bestehende Firmendaten der Gäste werden beim Ausliefern in die Liste überführt.

## User Stories
- Als **Inhaber** möchte ich Firmen als eigene Einträge pflegen, damit eine neue Rechnungsadresse nur einmal geändert werden muss und für alle Gäste dieser Firma gilt.
- Als **Inhaber** möchte ich beim Anlegen oder Bearbeiten eines Gastes eine bestehende Firma auswählen, damit ich Firmendaten nicht erneut eintippe und keine abweichenden Fassungen entstehen.
- Als **Mitarbeiter** möchte ich beim Anlegen eines neuen Gastes im Buchungsformular eine bestehende Firma wählen oder eine neue Firma anlegen, damit Dienstwohnungs-Buchungen schnell und mit richtiger Firma erfasst sind.
- Als **Inhaber oder Mitarbeiter** möchte ich je Firma die Gäste, Buchungen und an die Firma adressierten Rechnungen sehen, damit ich Rückfragen der Firma schnell beantworten kann.
- Als **Inhaber** möchte ich doppelte Firmen vorgeschlagen bekommen und zusammenführen, damit nach der Überführung und bei späteren Doppelungen eine saubere Liste entsteht.
- Als **Inhaber** möchte ich E-Mail, Webadresse und Ansprechpartner einer Firma hinterlegen, damit ich die Firma direkt kontaktieren kann.
- Als **Inhaber** möchte ich eine Firma löschen können, auch wenn noch Gäste verknüpft sind, damit ich nicht jeden Gast einzeln nachbearbeiten muss.
- Als **Inhaber** möchte ich, dass ausgestellte Rechnungen von Firmenänderungen unberührt bleiben, damit Belege unverändert bleiben.

## Geltungsbereich
- **Ort:** Navigationspunkt „Gäste“ bekommt zwei Reiter „Gäste“ und „Firmen“ (Adresse `/gaeste/firmen`, Detail je Firma). Kein neuer Menüpunkt.
- **Daten:** Firmen gehören zum gewählten Kunden. Nie sichtbar oder wählbar für andere Kunden.
- **Formulare:** gemeinsames Gastformular, Bereich „Firma“, an drei Stellen: Gästeseite (Anlegen/Bearbeiten), „Neuer Gast“ im Buchungsformular, „Neuer Gast“ beim Nacherfassen von Rechnungen. Dazu das Firmenformular im Reiter „Firmen“.

## Rechte

| Aktion | Inhaber | Mitarbeiter |
|---|---|---|
| Firmenliste, Firmendetail (mit Gästen, Buchungen, Rechnungen) ansehen | ✓ | ✓ |
| „Firma anlegen“ im Reiter „Firmen“ | ✓ | – |
| Firma bearbeiten, löschen, zusammenführen | ✓ | – |
| Mögliche doppelte Firmen ansehen und bearbeiten | ✓ | – |
| Änderungsprotokoll einer Firma | wird in der Datenbank geführt, keine Anzeige in der App (wie bei Gästen) | – |
| Im Gastformular „Bestehende Firma“ wählen oder „Neue Firma“ anlegen | ✓ (alle drei Stellen) | ✓ (nur beim neuen Gast im Buchungsformular, wie PROJ-7) |

## Regeln

### Firmendaten
| Feld | Pflicht | Regel |
|---|---|---|
| Firmenname | ja | max. 200 Zeichen; Leerzeichen am Rand werden entfernt |
| UID | nein | wie bisher am Gast (PROJ-7/PROJ-33) |
| Adresszeile 1, Adresszeile 2 | nein | je max. 200 Zeichen |
| PLZ, Ort, Staat | nein | wie PROJ-33; PLZ-Automatik aus PROJ-48 |
| E-Mail | nein | Formatprüfung wie beim Gast |
| Webadresse | nein | z. B. „www.firma.at“ oder „https://firma.at“; ohne „https://“ erlaubt; in der Anzeige als Link (neues Fenster) |
| Ansprechpartner | nein | ein freies Textfeld, max. 200 Zeichen |

### Gastformular, Bereich „Firma“
- Auswahl mit drei Punkten: **„Keine Firma“**, **„Bestehende Firma“**, **„Neue Firma“** (wie „Bestehender Gast“/„Neuer Gast“ im Buchungsformular).
- Ein neuer Gast startet mit „Keine Firma“. Ein Gast mit Firma öffnet beim Bearbeiten mit „Bestehende Firma“ und der Karte seiner Firma.
- **Bestehende Firma:** Suchfeld nach Firmenname oder UID (Groß-/Kleinschreibung, Umlaute, Akzente egal). Ein Treffer zeigt den Namen, darunter UID · „PLZ Ort“ · Adresszeile 1, soweit vorhanden. Nach der Auswahl erscheint eine **Karte nur zum Lesen** mit denselben Angaben und dem Knopf „Ändern“. Im Gastformular lässt sich die Firma nicht bearbeiten.
- **„Ändern“** öffnet wieder die Suche. Bis eine andere Firma gewählt und gespeichert ist, bleibt die bisherige Verknüpfung bestehen.
- **Neue Firma:** leere Felder für alle Firmendaten (siehe Tabelle). Firmenname ist Pflicht. Die Firma entsteht erst beim Speichern des Gastes (bzw. der Buchung mit neuem Gast) und wird sofort mit ihm verknüpft.
- **Gleicher Name bei „Neue Firma“:** Entspricht der eingetippte Name einer bestehenden Firma (Schreibung, Umlaute, Rand-Leerzeichen egal), erscheint unter dem Namen der Hinweis „Diese Firma gibt es bereits“ mit dem Knopf „Bestehende Firma verwenden“. Er wechselt zu „Bestehende Firma“ mit deren Karte. Gibt es mehrere gleichnamige Firmen, öffnet der Knopf die Suche mit dem Namen als Suchbegriff. Speichern als neue Firma bleibt möglich.
- **Keine Firma:** Speichern löst den Gast von seiner bisherigen Firma. Die Firma selbst bleibt bestehen.
- Wechsel zwischen den Auswahlpunkten vor dem Speichern verwirft die Eingaben des vorherigen Punkts ohne Rückfrage. Gespeichert wird erst mit „Speichern“.

### Reiter „Firmen“: Liste
- Spalten: Firmenname, UID, „PLZ Ort“, Staat, Anzahl Gäste (auch „0“). Firmen mit Platzhalternamen (siehe Überführung) tragen den Hinweis „Name fehlt“.
- Suche nach Firmenname und UID (Groß-/Kleinschreibung, Umlaute egal). Sortierung alphabetisch nach Firmenname. Seitenweise ab 50 Einträgen. Am Handy als Karten.
- Inhaber: Knopf „Firma anlegen“ und Link „X mögliche doppelte Firmen“ (nur wenn es solche gibt).
- Leerer Zustand: Hinweis, dass Firmen beim Anlegen von Gästen oder hier entstehen. Inhaber sehen „Firma anlegen“.

### Reiter „Firmen“: Detail
- Kopf: Firmenname; Angaben UID, Rechnungsadresse, E-Mail (als Mail-Link), Webadresse (als Link), Ansprechpartner.
- **Gäste:** alle verknüpften Gäste mit Link zur Gastseite.
- **Buchungen:** alle Buchungen, deren Hauptgast heute mit der Firma verknüpft ist, neueste zuerst, Spalten wie in der Buchungsübersicht (Nummer, Zeitraum, Wohnung, Gast, Betrag, Status), Link zum Buchungsdetail.
- **Rechnungen:** alle Rechnungen zu diesen Buchungen mit Empfänger „Firma“, samt Gutschriften zu diesen Rechnungen; neueste zuerst; Spalten wie in der Rechnungsübersicht (Nummer, Datum, Empfänger, Betrag, Status, Zahlungsstatus), Link zum Rechnungsdetail.
- Leere Abschnitte zeigen einen kurzen Hinweis („Keine Buchungen“ usw.).
- Inhaber: „Bearbeiten“, „Mit anderer Firma zusammenführen“, „Firma löschen“. Das Änderungsprotokoll wird in der Datenbank geführt, eine Anzeige gibt es nicht (wie bei Gästen).

### Gästeliste und Gast-Detail
- Der Firmenname beim Gast führt als Link zum Firmendetail.
- Die Suche der Gästeliste findet Gäste weiterhin über den Firmennamen, nun über die verknüpfte Firma. Ändert sich der Firmenname, finden alle verknüpften Gäste den neuen Namen.
- Gast-Detail zeigt im Abschnitt „Firma“ die Daten der verknüpften Firma.

### Firma bearbeiten
- Nur Inhaber, im Reiter „Firmen“. Die Änderung gilt sofort für alle verknüpften Gäste und für alle künftigen Rechnungsentwürfe.
- Bestehende Rechnungsentwürfe, ausgestellte, nacherfasste und stornierte Rechnungen bleiben unverändert (Empfänger als Kopie, PROJ-40/42).
- Schutz vor Überschreiben wie beim Gast: Hat jemand anderer die Firma inzwischen gespeichert, erscheint ein Hinweis und nichts wird überschrieben.

### Firma löschen
- Nur Inhaber, nach Bestätigung, endgültig.
- Hat die Firma verknüpfte Gäste, nennt der Dialog deren Anzahl. Nach dem Löschen haben diese Gäste keine Firma mehr.
- Rechnungen und Entwürfe bleiben unverändert.
- Personenbezogene Altwerte der Firma (Ansprechpartner, E-Mail) werden aus dem Änderungsprotokoll entfernt, wie beim Löschen eines Gastes.

### Firmen zusammenführen
- Nur Inhaber, aus dem Firmendetail („Mit anderer Firma zusammenführen“, zweite Firma per Suche) oder aus der Liste möglicher doppelter Firmen.
- Feldwahl wie beim Zusammenführen von Gästen: je Angabe wählt der Inhaber die Fassung, die bleibt: Firmenname, UID, Rechnungsadresse (als Ganzes: Adresszeile 1/2, PLZ, Ort, Staat), E-Mail, Webadresse, Ansprechpartner.
- Alle Gäste beider Firmen hängen danach an der verbleibenden Firma, die andere Firma wird gelöscht.
- Hinweis, dass der Schritt endgültig ist, und Bestätigung. Eintrag im Änderungsprotokoll mit beiden Firmen, Person und Zeitpunkt.
- Nicht möglich: dieselbe Firma zweimal oder Firmen verschiedener Kunden.

### Mögliche doppelte Firmen
- Paare von Firmen desselben Kunden mit gleichem Firmennamen oder gleicher UID. Groß-/Kleinschreibung, Umlaute, Akzente und Leerzeichen am Rand zählen nicht. Platzhalternamen „Firma ohne Namen“ bilden untereinander keine Paare über den Namen.
- Liste für Inhaber unter `/gaeste/firmen/dubletten`, je Paar „Zusammenführen“ und „Keine doppelte Firma“. „Keine doppelte Firma“ blendet das Paar dauerhaft aus.

### Gast zusammenführen, löschen, anonymisieren
- **Zusammenführen zweier Gäste:** Unter „Firma“ wählt der Inhaber wie bisher, welche Verknüpfung bleibt: die Firma des einen oder des anderen Gastes oder keine (wenn einer keine Firma hat).
- **Gast löschen/anonymisieren:** Die Verknüpfung wird entfernt. Die Firma bleibt in der Liste, auch wenn sie danach keine Gäste mehr hat (Anzahl „0“). Der Inhaber löscht verwaiste Firmen bei Bedarf selbst.

### Rechnungsentwurf (PROJ-40)
- Empfänger „Firma“ ist wählbar, wenn der Hauptgast mit einer Firma verknüpft ist. Die Felder werden aus der Firma (Name, Adresse, UID) kopiert und bleiben im Entwurf überschreibbar. Sonst unverändert.

### Überführung der bestehenden Daten
- Einmalig beim Ausliefern, je Kunde getrennt.
- Jeder Gast mit mindestens einem Firmenfeld (Name, UID, Adresszeile 1/2, PLZ, Ort, Staat) wird mit genau einer Firma verknüpft.
- Gleiche Fassungen werden zu einer Firma: alle 7 Felder stimmen überein, Groß-/Kleinschreibung und Leerzeichen am Rand zählen nicht. Übernommen werden die Werte des zuletzt geänderten Gastes. Jede abweichende Fassung wird eine eigene Firma. Es gehen keine Daten verloren.
- Fassungen ohne Firmennamen werden mit dem Platzhalter „Firma ohne Namen“ überführt und in der Liste mit „Name fehlt“ gekennzeichnet. Der Platzhalter enthält keinen Gastnamen.
- E-Mail, Webadresse und Ansprechpartner bleiben bei überführten Firmen leer.
- Anonymisierte Gäste haben keine Firmendaten und bleiben ohne Firma.
- Altdaten über 200 Zeichen in Adresszeile 1 (PROJ-33) werden unverändert übernommen. Die Längenprüfung greift erst beim nächsten Bearbeiten der Firma.
- Die Firmenfelder am Gast entfallen danach. Ihre bisherigen Werte im Änderungsprotokoll des Gastes bleiben lesbar.

### Ablösung PROJ-49
- Die Vorschläge beim Firmennamen (PROJ-49) entfallen vollständig.

## Out of Scope
- **Mehrere Firmen je Gast:** ein Gast hat höchstens eine Firma
- **Firma ohne Ansprechperson als Gast / Buchung direkt auf eine Firma:** weiterhin nicht vorgesehen; eine Buchung hat immer einen Hauptgast (PROJ-7, PROJ-8)
- **Firma im Gastformular bearbeiten:** nur im Reiter „Firmen“
- **Mitarbeiter bearbeiten, löschen oder führen Firmen zusammen:** nur Inhaber
- **Nacherfasste Altrechnungen mit Freitext-Empfänger** im Abschnitt „Rechnungen“ der Firma: erscheinen nicht, weil sie keine Empfänger-Art „Firma“ tragen
- **Rechnungen an den Gast persönlich** im Abschnitt „Rechnungen“ der Firma: bewusst nicht
- **Feste Zuordnung Rechnung → Firma** beim Ausstellen: nicht vorgesehen; Zuordnung läuft über die heutige Verknüpfung des Hauptgasts und den Empfänger „Firma“
- **Summen, Umsatz oder Auswertungen je Firma** (z. B. in „Auswertungen“, PROJ-18): später möglich
- **Firmenfilter in Buchungs- oder Rechnungsübersicht:** nicht vorgesehen
- **Automatisches Bereinigen ähnlicher Schreibweisen** („Muster GmbH“/„Muster G.m.b.H.“): von Hand über Zusammenführen
- **Automatisches Löschen verwaister Firmen:** nicht vorgesehen
- **Mehrere Ansprechpartner, Telefonnummer oder strukturierte Ansprechpartner-Felder:** ein Freitextfeld
- **UID-Prüfung über VIES:** nicht vorgesehen
- **Export der Firmenliste (CSV):** nicht vorgesehen; Marketing-Export kommt mit PROJ-19
- **Firmen anderer Kunden:** nie sichtbar, auch nicht für Personen mit mehreren Kunden oder den Betreiber

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Reiter und Rechte
- [ ] Angenommen ein Inhaber öffnet „Gäste“, wenn die Seite erscheint, dann sieht er die Reiter „Gäste“ und „Firmen“, und „Firmen“ führt zu `/gaeste/firmen`
- [ ] Angenommen ein Mitarbeiter öffnet den Reiter „Firmen“, wenn die Seite erscheint, dann sieht er Liste und Detail, aber keine Knöpfe „Firma anlegen“, „Bearbeiten“, „Zusammenführen“, „Löschen“ und keinen Dubletten-Link
- [ ] Angenommen ein Mitarbeiter versucht, eine Firma direkt (z. B. über die Adresse) zu ändern, zu löschen oder zusammenzuführen, wenn er die Aktion auslöst, dann wird sie abgelehnt
- [ ] Angenommen eine Firma gehört zu einem anderen Kunden, wenn jemand ihre Adresse aufruft, dann erscheint „Seite nicht gefunden“

### Firmenliste
- [ ] Angenommen der Kunde hat Firmen, wenn der Reiter „Firmen“ geöffnet wird, dann zeigt die Liste Firmenname, UID, „PLZ Ort“, Staat und Anzahl Gäste, alphabetisch nach Firmenname
- [ ] Angenommen eine Firma „Hotel Müller KG“ mit UID „ATU12345678“, wenn „muller“ oder „ATU123“ gesucht wird, dann erscheint sie in der Liste
- [ ] Angenommen eine Firma hat keine verknüpften Gäste, wenn die Liste erscheint, dann zeigt sie bei der Anzahl „0“
- [ ] Angenommen eine Firma heißt „Firma ohne Namen“ aus der Überführung, wenn die Liste erscheint, dann trägt sie den Hinweis „Name fehlt“
- [ ] Angenommen der Kunde hat keine Firmen, wenn ein Inhaber den Reiter öffnet, dann sieht er den leeren Zustand mit „Firma anlegen“
- [ ] Angenommen mehr als 50 Firmen, wenn die Liste erscheint, dann ist sie seitenweise geteilt
- [ ] Angenommen ein Handy (375 px), wenn die Liste erscheint, dann werden die Firmen als Karten ohne waagrechtes Scrollen gezeigt

### Firma anlegen und bearbeiten (Inhaber)
- [ ] Angenommen ein Inhaber klickt „Firma anlegen“, wenn er ohne Firmennamen speichert, dann erscheint eine Fehlermeldung beim Firmennamen und nichts wird gespeichert
- [ ] Angenommen ein Inhaber gibt die E-Mail „info@firma“ ein, wenn er speichert, dann erscheint die bekannte Fehlermeldung für ungültige E-Mail-Adressen
- [ ] Angenommen ein Inhaber gibt die Webadresse „www.firma.at“ ein, wenn er speichert, dann wird sie gespeichert und im Detail als Link angezeigt
- [ ] Angenommen ein Inhaber gibt im Firmenformular die PLZ „1010“ ein, wenn Ort und Staat leer sind, dann füllt die PLZ-Automatik „Wien“ und „Österreich“ wie in PROJ-48
- [ ] Angenommen drei Gäste sind mit „Muster GmbH“ verknüpft, wenn der Inhaber die Rechnungsadresse der Firma ändert, dann zeigen alle drei Gäste die neue Adresse
- [ ] Angenommen eine Rechnung an „Muster GmbH“ ist ausgestellt, wenn der Inhaber die Adresse der Firma ändert, dann zeigt die Rechnung und ihr PDF weiterhin die alte Adresse
- [ ] Angenommen ein Rechnungsentwurf mit Empfänger „Firma“ besteht, wenn der Inhaber die Firma ändert, dann bleibt der Empfänger im Entwurf unverändert
- [ ] Angenommen zwei Inhaber bearbeiten dieselbe Firma, wenn der zweite nach dem ersten speichert, dann erscheint ein Hinweis auf die zwischenzeitliche Änderung und nichts wird überschrieben
- [ ] Angenommen ein Inhaber ändert eine Firma, wenn das Änderungsprotokoll in der Datenbank geprüft wird, dann ist die Änderung mit Person, Zeitpunkt, alten und neuen Werten festgehalten

### Firmendetail
- [ ] Angenommen eine Firma mit E-Mail, Webadresse und Ansprechpartner, wenn das Detail geöffnet wird, dann zeigt es alle Angaben, die E-Mail als Mail-Link und die Webadresse als Link
- [ ] Angenommen zwei Gäste sind mit der Firma verknüpft, wenn das Detail geöffnet wird, dann stehen beide im Abschnitt „Gäste“ mit Link zur Gastseite
- [ ] Angenommen ein verknüpfter Gast hat drei Buchungen, wenn das Detail geöffnet wird, dann stehen alle drei im Abschnitt „Buchungen“, neueste zuerst, mit Link zum Buchungsdetail
- [ ] Angenommen zu einer Buchung eines verknüpften Gastes gibt es eine Rechnung mit Empfänger „Firma“ und eine mit Empfänger „Gast“, wenn das Detail geöffnet wird, dann steht nur die Rechnung mit Empfänger „Firma“ im Abschnitt „Rechnungen“
- [ ] Angenommen eine Rechnung an die Firma wurde storniert, wenn das Detail geöffnet wird, dann stehen Rechnung und Gutschrift im Abschnitt „Rechnungen“
- [ ] Angenommen ein Gast wechselt von Firma A zu Firma B, wenn das Detail von Firma A geöffnet wird, dann erscheinen seine Buchungen und Rechnungen dort nicht mehr, sondern bei Firma B
- [ ] Angenommen eine Firma ohne Gäste, wenn das Detail geöffnet wird, dann zeigen die Abschnitte „Gäste“, „Buchungen“ und „Rechnungen“ je einen Hinweis statt leerer Tabellen
- [ ] Angenommen ein Mitarbeiter öffnet das Detail, wenn es erscheint, dann sieht er Gäste, Buchungen und Rechnungen, aber keine Knöpfe zum Bearbeiten, Zusammenführen oder Löschen

### Gastformular: Auswahl
- [ ] Angenommen ein Inhaber legt einen neuen Gast an, wenn er den Bereich „Firma“ öffnet, dann ist „Keine Firma“ gewählt
- [ ] Angenommen „Bestehende Firma“ ist gewählt, wenn „mu“ getippt wird, dann erscheinen Firmen des gewählten Kunden, deren Name oder UID „mu“ enthält, mit Name und darunter UID · „PLZ Ort“ · Adresszeile 1
- [ ] Angenommen eine Firma wurde gewählt, wenn die Karte erscheint, dann zeigt sie die Angaben nur zum Lesen und einen Knopf „Ändern“, aber keine Eingabefelder
- [ ] Angenommen ein Gast ist mit „Muster GmbH“ verknüpft, wenn der Inhaber ihn bearbeitet, dann öffnet der Bereich „Firma“ mit „Bestehende Firma“ und der Karte von „Muster GmbH“
- [ ] Angenommen die Karte von „Muster GmbH“ wird gezeigt, wenn der Inhaber „Ändern“ klickt, eine andere Firma wählt und speichert, dann ist der Gast mit der anderen Firma verknüpft und „Muster GmbH“ bleibt unverändert bestehen
- [ ] Angenommen die Karte wird gezeigt, wenn der Inhaber „Ändern“ klickt und das Formular ohne Speichern schließt, dann bleibt die bisherige Verknüpfung erhalten
- [ ] Angenommen ein Gast ist mit einer Firma verknüpft, wenn der Inhaber „Keine Firma“ wählt und speichert, dann hat der Gast keine Firma und die Firma bleibt in der Liste
- [ ] Angenommen „Bestehende Firma“ ist gewählt, aber noch keine Firma ausgesucht, wenn gespeichert wird, dann erscheint ein Hinweis, eine Firma zu wählen oder „Keine Firma“ zu nehmen, und nichts wird gespeichert

### Gastformular: Neue Firma
- [ ] Angenommen „Neue Firma“ ist gewählt, wenn der Bereich erscheint, dann sind alle Firmenfelder leer (Name, UID, Adresszeile 1/2, PLZ, Ort, Staat, E-Mail, Webadresse, Ansprechpartner)
- [ ] Angenommen „Neue Firma“ mit Name „Neue Firma AG“, wenn der Gast gespeichert wird, dann gibt es die Firma in der Firmenliste und der Gast ist mit ihr verknüpft
- [ ] Angenommen „Neue Firma“ ohne Firmennamen, wenn gespeichert wird, dann erscheint eine Fehlermeldung beim Firmennamen und weder Gast noch Firma werden gespeichert
- [ ] Angenommen es gibt „Muster GmbH“, wenn bei „Neue Firma“ „muster gmbh“ getippt wird, dann erscheint „Diese Firma gibt es bereits“ mit „Bestehende Firma verwenden“
- [ ] Angenommen der Hinweis wird gezeigt, wenn „Bestehende Firma verwenden“ geklickt wird, dann wechselt die Auswahl zu „Bestehende Firma“ mit der Karte von „Muster GmbH“
- [ ] Angenommen der Hinweis wird gezeigt, wenn der Nutzer trotzdem speichert, dann entsteht eine zweite Firma „muster gmbh“ und das Paar erscheint unter „mögliche doppelte Firmen“
- [ ] Angenommen ein Mitarbeiter legt im Buchungsformular einen neuen Gast an, wenn er „Bestehende Firma“ oder „Neue Firma“ nutzt, dann funktioniert beides wie beim Inhaber und Buchung, Gast und gegebenenfalls Firma werden gemeinsam gespeichert
- [ ] Angenommen das Speichern der Buchung mit neuem Gast und neuer Firma scheitert, wenn die Fehlermeldung erscheint, dann ist weder Buchung noch Gast noch Firma angelegt und die Eingaben bleiben erhalten
- [ ] Angenommen ein Inhaber erfasst eine Rechnung nach und legt dabei einen neuen Gast an, wenn er den Bereich „Firma“ öffnet, dann gibt es dieselbe Auswahl wie auf der Gästeseite

### Löschen (Inhaber)
- [ ] Angenommen eine Firma ohne Gäste, wenn der Inhaber „Firma löschen“ bestätigt, dann ist sie aus der Liste verschwunden
- [ ] Angenommen eine Firma mit 3 verknüpften Gästen, wenn der Inhaber „Firma löschen“ wählt, dann nennt der Dialog „3 Gäste“ und nach der Bestätigung haben diese Gäste keine Firma mehr
- [ ] Angenommen eine gelöschte Firma war Empfänger einer Rechnung, wenn die Rechnung geöffnet wird, dann ist sie unverändert
- [ ] Angenommen eine Firma mit Ansprechpartner wurde gelöscht, wenn das Änderungsprotokoll durchsucht wird, dann enthält es keine Altwerte von Ansprechpartner und E-Mail mehr

### Zusammenführen und Dubletten (Inhaber)
- [ ] Angenommen „Muster GmbH“ (mit UID) und „muster gmbh“ (ohne UID, neuere Adresse), wenn der Inhaber sie zusammenführt, dann kann er je Angabe wählen und die Rechnungsadresse nur als Ganzes übernehmen
- [ ] Angenommen das Zusammenführen ist bestätigt, wenn es abgeschlossen ist, dann hängen alle Gäste beider Firmen an der verbleibenden Firma, die andere Firma ist gelöscht und das Protokoll hält beide Firmen, Person und Zeitpunkt fest
- [ ] Angenommen ein Inhaber öffnet den Zusammenführen-Dialog, wenn er erscheint, dann weist er darauf hin, dass der Schritt endgültig ist, und verlangt eine Bestätigung
- [ ] Angenommen zwei Firmen mit gleichem Namen (Schreibung egal) oder gleicher UID, wenn ein Inhaber den Reiter „Firmen“ öffnet, dann erscheint „1 mögliche doppelte Firma“ (bzw. „X mögliche doppelte Firmen“)
- [ ] Angenommen ein Paar in der Dubletten-Liste, wenn der Inhaber „Keine doppelte Firma“ wählt, dann erscheint das Paar nicht mehr
- [ ] Angenommen zwei Firmen „Firma ohne Namen“ ohne gleiche UID, wenn die Dubletten-Liste erscheint, dann bilden sie kein Paar
- [ ] Angenommen ein Inhaber wählt im Zusammenführen-Dialog dieselbe Firma als zweite Firma, wenn er bestätigen will, dann ist das nicht möglich

### Gäste zusammenführen, löschen, anonymisieren
- [ ] Angenommen Gast A ist mit Firma X, Gast B mit Firma Y verknüpft, wenn der Inhaber die Gäste zusammenführt, dann wählt er unter „Firma“ X oder Y und der verbleibende Gast ist mit der gewählten Firma verknüpft
- [ ] Angenommen ein Gast ist der einzige Gast der Firma X, wenn er anonymisiert wird, dann ist die Verknüpfung entfernt und Firma X bleibt mit „0“ Gästen in der Liste
- [ ] Angenommen ein Gast ohne Buchungen ist mit Firma X verknüpft, wenn er gelöscht wird, dann bleibt Firma X bestehen

### Gästeliste, Gast-Detail, Rechnungsentwurf
- [ ] Angenommen ein Gast ist mit „Muster GmbH“ verknüpft, wenn die Gästeliste erscheint, dann steht der Firmenname beim Gast und führt zum Firmendetail
- [ ] Angenommen „Muster GmbH“ wird in „Muster Holding GmbH“ umbenannt, wenn in der Gästeliste „holding“ gesucht wird, dann erscheinen alle verknüpften Gäste
- [ ] Angenommen der Hauptgast einer Buchung ist mit einer Firma verknüpft, wenn ein Rechnungsentwurf mit Empfänger „Firma“ erstellt wird, dann stehen Name, Adresse und UID der Firma als überschreibbare Kopie im Entwurf
- [ ] Angenommen der Hauptgast hat keine Firma, wenn ein Rechnungsentwurf erstellt wird, dann ist Empfänger „Firma“ nicht wählbar

### Überführung
- [ ] Angenommen zwei Gäste haben „Muster GmbH“ mit sonst gleichen Feldern und einer zusätzlich Rand-Leerzeichen, wenn überführt wird, dann gibt es eine Firma mit den Werten des zuletzt geänderten Gastes und beide Gäste sind verknüpft
- [ ] Angenommen zwei Gäste haben „Muster GmbH“ mit verschiedenen Adressen, wenn überführt wird, dann entstehen zwei Firmen und das Paar erscheint unter „mögliche doppelte Firmen“
- [ ] Angenommen ein Gast hat nur eine UID ohne Firmennamen, wenn überführt wird, dann entsteht eine Firma „Firma ohne Namen“ mit dieser UID und dem Hinweis „Name fehlt“
- [ ] Angenommen gleiche Firmendaten bei zwei verschiedenen Kunden, wenn überführt wird, dann entsteht je Kunde eine eigene Firma
- [ ] Angenommen ein Gast ohne Firmendaten, wenn überführt wird, dann hat er danach keine Firma
- [ ] Angenommen die Überführung ist abgeschlossen, wenn jeder Gast mit Firmendaten geprüft wird, dann zeigt er dieselben Firmendaten wie vorher

### Ablösung PROJ-49
- [ ] Angenommen „Neue Firma“ ist gewählt, wenn im Firmennamen getippt wird, dann erscheinen keine Vorschläge aus PROJ-49

## Edge Cases
- **Firma wird gelöscht, während ein Gastformular sie als Karte zeigt:** Beim Speichern erscheint „Diese Firma gibt es nicht mehr“ und die Auswahl springt auf „Bestehende Firma“ ohne Karte. Die übrigen Eingaben bleiben erhalten.
- **Firma wird zusammengeführt, während ein Gastformular die gelöschte Firma zeigt:** wie oben; der Nutzer wählt die verbleibende Firma neu.
- **Firma wird von einem Inhaber geändert, während ein anderes Gastformular ihre Karte zeigt:** Die Karte zeigt den Stand beim Öffnen. Verknüpft wird mit der Firma, nicht mit der angezeigten Fassung, und es gelten die aktuellen Daten.
- **Suche „Bestehende Firma“ lädt nicht** (Netzwerkfehler): Hinweis im Suchfeld wie im GuestPicker. „Keine Firma“ und „Neue Firma“ bleiben nutzbar.
- **Mehrere gleichnamige Firmen bei „Neue Firma“:** „Bestehende Firma verwenden“ öffnet die Suche mit dem Namen statt einer einzelnen Karte.
- **Ähnliche Schreibweisen** („Muster GmbH“, „Muster G.m.b.H.“): kein Dubletten-Vorschlag, außer die UID ist gleich; Zusammenführen von Hand.
- **Nacherfasste Altrechnungen** (Freitext-Empfänger ohne Art „Firma“): erscheinen im Firmendetail nicht.
- **Rechnungen nacherfasst mit Empfänger „Firma“** zu einer Buchung eines verknüpften Gastes: erscheinen, soweit sie die Art „Firma“ tragen.
- **Gast hat Buchungen bei mehreren Wohnungen/Objekten:** alle erscheinen bei der Firma.
- **Viele Gäste/Buchungen je Firma** (z. B. Dauerkunde mit hunderten Buchungen): Abschnitte laden ohne spürbare Verzögerung; bei mehr als 50 Einträgen seitenweise oder mit „Weitere anzeigen“.
- **Platzhalter „Firma ohne Namen“** wird beim Bearbeiten angezeigt und muss nicht geändert werden, kann aber mit einem richtigen Namen überschrieben werden; danach entfällt „Name fehlt“.
- **Altdaten über 200 Zeichen:** Die überführte Firma wird angezeigt. Beim Bearbeiten greift die Längenprüfung und verlangt eine Kürzung.
- **Gast-Änderungsprotokoll:** Frühere Einträge mit Firmenfeldern bleiben lesbar. Neue Einträge zeigen den Wechsel der Verknüpfung (alte Firma → neue Firma).
- **Handy:** Auswahl, Suche und Karte sind mit dem Finger bedienbar; die Suchliste wird von der Bildschirmtastatur nicht verdeckt.

## Technical Requirements (optional)
- Sicherheit: Firmen strikt je Kunde getrennt (Mandantentrennung wie PROJ-1/PROJ-7). Rollenregeln (nur Inhaber ändert, Mitarbeiter nur beim neuen Gast in der Buchung) auch in der Datenbank durchgesetzt.
- Buchung + neuer Gast + neue Firma sowie Zusammenführen und Löschen gelingen oder scheitern jeweils als Ganzes.
- Überführung verlustfrei und prüfbar (Zahl der Gäste mit Firmendaten vorher = Zahl der verknüpften Gäste nachher).
- Bedienbar per Tastatur und für Bildschirmleser wie die übrigen Auswahllisten.
- Browser: Chrome, Firefox, Safari (Desktop und mobil); neue Tabellen ohne Überlagerungs-Link auf der Zeile (Safari-Zeilenklick).

## Open Questions
- [ ] Anzeige des Änderungsprotokolls in der App (für Gäste, Firmen und weitere Bereiche) als eigenes Feature?
- [ ] Aufräum-Migration: alte Firmenspalten am Gast entfernen, sobald die Überführung in Produktion bestätigt ist
- [ ] Sollen Summen (Umsatz, offene Beträge) je Firma später ins Firmendetail oder in „Auswertungen“ (PROJ-18)?
- [ ] Soll die Kanalauswertung (PROJ-11) auch nach Firmen auswerten?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Firmen als eigene Einträge mit Verknüpfung statt Kopie (aus Refine PROJ-49) | Korrekturen nur an einer Stelle; keine auseinanderlaufenden Fassungen | 2026-11-08 |
| Verwaltung als Reiter „Firmen“ unter „Gäste“, kein eigener Menüpunkt | Firmen hängen inhaltlich an Gästen; Navigation bleibt schlank; laufende Daten gehören nicht in Einstellungen | 2026-11-08 |
| Mitarbeiter sehen Firmen, wählen/legen beim neuen Gast im Buchungsformular an, bearbeiten/löschen nicht | Gleiche Regel wie bei Gästen (PROJ-7); erste Buchung einer Firma darf nicht blockiert sein | 2026-11-08 |
| Löschen auch mit verknüpften Gästen; Dialog nennt Anzahl; Gäste danach ohne Firma | Firmendaten sind kaum Personendaten; Rechnungen sind durch Kopie abgesichert; Sperre würde Einzelnachbearbeitung erzwingen | 2026-11-08 |
| Zusammenführen mit Feldwahl, Rechnungsadresse als Ganzes | Typischer Fall: eine Fassung mit UID, eine mit neuerer Adresse; vertraut vom Gast-Zusammenführen; keine gemischten Adressen | 2026-11-08 |
| Überführung: gleiche Fassung (7 Felder, Schreibung/Rand egal) → eine Firma, sonst je eigene Firma | Kein Datenverlust; deutlich weniger Einträge als je Gast eine Firma; Rest über Zusammenführen | 2026-11-08 |
| Vorschläge „mögliche doppelte Firmen“ nach gleichem Namen oder gleicher UID | Fängt Überführungsreste und spätere Doppelungen; Ablauf wie Gäste-Dubletten | 2026-11-08 |
| Firmenname Pflicht; Altdaten ohne Namen mit Platzhalter „Firma ohne Namen“ und Hinweis „Name fehlt“ | Kein Datenverlust (UID/Adresse), einheitliches Modell; Platzhalter ohne Gastnamen, damit Anonymisieren keine Personendaten zurücklässt | 2026-11-08 |
| Firma bleibt bei Anonymisieren/Löschen des letzten Gastes bestehen | Firma kann mit anderem Mitarbeiter wieder buchen; kein Vernichten gepflegter Daten | 2026-11-08 |
| Zusatzfelder E-Mail, Webadresse, Ansprechpartner (ein Freitextfeld) | Wunsch des Nutzers: Firma direkt kontaktieren | 2026-11-08 |
| Liste mit Spalte Staat; Detail mit Gästen, Buchungen und Rechnungen | Wunsch des Nutzers: Rückfragen der Firma an einer Stelle beantworten | 2026-11-08 |
| Buchungen über die heutige Verknüpfung des Hauptgasts; Rechnungen nur mit Empfänger „Firma“ (inkl. Gutschriften) | Nutzerentscheidung: Firmendetail zeigt nur an die Firma adressierte Rechnungen | 2026-11-08 |
| „Neue Firma“ im Gastformular zeigt alle Felder | Angaben liegen beim ersten Anlegen oft vor; Mitarbeiter könnten sie sonst nicht erfassen | 2026-11-08 |
| Hinweis „Diese Firma gibt es bereits“ mit „Bestehende Firma verwenden“, Speichern bleibt möglich | Verhindert die meisten Doppelungen bei der Eingabe; gleichnamige Niederlassungen bleiben möglich | 2026-11-08 |
| Drei Auswahlpunkte „Keine Firma“/„Bestehende Firma“/„Neue Firma“, Start mit „Keine Firma“ | Zustand jederzeit sichtbar; Lösen ohne versteckten Knopf; keine versehentlich halb ausgefüllte neue Firma | 2026-11-08 |
| Firma löschen entfernt personenbezogene Altwerte (Ansprechpartner, E-Mail) aus dem Protokoll | Ansprechpartner und E-Mail können Personendaten sein; gleiche Behandlung wie beim Löschen eines Gastes | 2026-11-08 |
| Rechnungsentwurf kopiert künftig aus der Firma, sonst unverändert | Bestehendes Kopie-Prinzip aus PROJ-40 bleibt; ausgestellte Rechnungen unberührt | 2026-11-08 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Tabelle „Firmen“ je Kunde, Gast mit einer Verknüpfung (leer = keine Firma); Löschen der Firma leert die Verknüpfung automatisch | Eine Quelle für alle Gäste; Löschen mit verknüpften Gästen ohne Zusatzschritte | 2026-11-08 |
| Alte Firmenspalten am Gast bleiben ungenutzt als Sicherung stehen, Entfernen in späterer Aufräum-Migration | Rückweg bei Problemen mit der Überführung; gleiches Vorgehen wie bei den alten Statistik-Funktionen | 2026-11-08 |
| Überführung in einer Migration mit Zählprüfung (Abbruch bei Abweichung), ohne Protokolleinträge je Gast | Verlustfrei und prüfbar; Protokoll nicht mit Systemeinträgen fluten | 2026-11-08 |
| Merker „Name fehlt“ statt Erkennung am Platzhaltertext | Hinweis verschwindet sicher bei der ersten Namensänderung; ein Inhaber darf eine Firma bewusst so nennen | 2026-11-08 |
| Neue Datenbank-Funktion „Gast speichern“ für die Gästeseite statt direktem Tabellen-Schreiben | Neue Firma + Gast gelingen oder scheitern gemeinsam | 2026-11-08 |
| Mitarbeiter legen Firmen nur innerhalb von „Buchung speichern“ an; direktes Schreiben in die Firmentabelle nur für Inhaber | Gleiches Muster wie bei Gästen (PROJ-7); Rolle in der Datenbank durchgesetzt | 2026-11-08 |
| Gästesuche über Gastsuchtext oder Suchtext der verknüpften Firma (statt Firmenname im Gastsuchtext) | Umbenennung der Firma wirkt sofort, ohne alle Gäste umzuschreiben | 2026-11-08 |
| Firmendetail-Listen über die heutige Verknüpfung des Hauptgasts; Rechnungen über Empfänger-Art „Firma“ plus Gutschriften | Entspricht den Produktentscheidungen; keine neue Spalte an Rechnungen nötig | 2026-11-08 |
| Firmensuche, Dubletten, Zusammenführen und Panel nach Bauart der Gäste-Komponenten | Gleiche Bedienung, weniger neuer Code, bewährte Safari-/Handy-Lösungen | 2026-11-08 |
| Webadresse so gespeichert wie eingegeben, Link ergänzt „https://“ | Nutzer tippt „www.firma.at“; keine Umformung der Daten | 2026-11-08 |
| Änderungsprotokoll der Firma nur in der Datenbank, keine Anzeige in der App | Wie bei Gästen; Anzeige wäre ein eigenes, bereichsübergreifendes Feature (vom Nutzer bestätigt) | 2026-11-08 |
| Keine neuen Pakete | Alle Bausteine vorhanden | 2026-11-08 |
| Überführung als private Funktion `transfer_guest_companies`, in der Migration aufgerufen und behalten | Mit Probedaten in einer zurückgerollten Transaktion prüfbar; bei Bedarf für Staging/Prod nachvollziehbar | 2026-11-08 |
| Länge der Adresszeile 1 der Firma als `not valid`-Regel nach der Überführung | Altdaten über 200 Zeichen (PROJ-33) werden übernommen; Regel greift beim Bearbeiten | 2026-11-08 |
| Neue Firma im selben Vorgang über `guest_company_from_input` in save_guest, save_booking, save_invoice | Eine Stelle für „bestehende Firma prüfen / neue Firma anlegen“; Mitarbeiter legen Firmen nur innerhalb der Buchung an | 2026-11-08 |
| Eigene Migration für Aufrufrechte der privaten Funktionen | Schema „private“ vergibt keine Ausführungsrechte; erste Migration war in Dev schon eingespielt | 2026-11-08 |
| Keine Protokolleinträge und kein „zuletzt geändert“ während der Überführung (Trigger am Gast vorübergehend aus) | Wie im Tech Design: Protokoll nicht mit Systemeinträgen fluten, Reihenfolge „zuletzt geändert“ bleibt | 2026-11-08 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage im Code
- Die Firma steht heute als 7 Spalten direkt am Gast (`company_*`, PROJ-33). Diese Spalten lesen und schreiben neun Datenbank-Funktionen: Gast-Vorbereitung inkl. Suchtext, Gästeliste, Zusammenführen, Anonymisieren, Buchung speichern (neuer Gast), Rechnung nacherfassen (neuer Gast), Buchungssuche für Rechnungen, Rechnungsentwurf und die Vorschläge aus PROJ-49. In der App sind es rund 15 Dateien (Gastformular, Gästeliste, Gast-Detail, GuestPicker, Zusammenführen, Dubletten, Rechnungsentwurf, Nacherfassen, PDF-Muster).
- Gäste legt der Inhaber heute direkt in der Tabelle an. Mitarbeiter legen Gäste nur innerhalb von „Buchung speichern“ an (eine geschützte Datenbank-Funktion).
- Das Änderungsprotokoll wird für jede Tabelle automatisch in der Datenbank geführt. Eine Anzeige in der App gibt es bisher für keinen Bereich, auch nicht für Gäste.
- Wiederverwendbar sind die Reiter-Leiste der Einstellungen, GuestPicker (Suche mit Trefferliste), DetailPanel, PostalPlaceFields (PLZ-Automatik), Zusammenführen-Dialog und Dubletten-Liste der Gäste, Pagination sowie RadioGroup.

### A) Seiten und Komponenten

```
Gäste (Navigationspunkt, unverändert)
+-- Reiter-Leiste „Gäste“ | „Firmen“ (neu, gleiche Bauart wie die Einstellungen-Reiter)
|
+-- /gaeste                      Gästeliste (unverändert, Firmenname wird Link zum Firmendetail)
+-- /gaeste/[id]                 Gast-Detail (Abschnitt „Firma“ zeigt die verknüpfte Firma mit Link)
+-- /gaeste/dubletten            Gäste-Dubletten (unverändert)
|
+-- /gaeste/firmen               Firmenliste (neu)
|   +-- Suche (Name, UID), Anzahl Treffer, Link „X mögliche doppelte Firmen“ (Inhaber)
|   +-- Knopf „Firma anlegen“ (Inhaber) -> Firmen-Panel
|   +-- Desktop: Tabelle Name (+ „Name fehlt“) · UID · PLZ Ort · Staat · Gäste
|   +-- Handy: Karten
|   +-- Seitenweise (50), leerer Zustand
|
+-- /gaeste/firmen/[id]          Firmendetail (neu)
|   +-- Kopf: Name, UID, Rechnungsadresse, E-Mail (Mail-Link), Webadresse (Link), Ansprechpartner
|   +-- Aktionen (Inhaber): Bearbeiten · Mit anderer Firma zusammenführen · Firma löschen
|   +-- Abschnitt „Gäste“ (Links zur Gastseite)
|   +-- Abschnitt „Buchungen“ (Spalten wie Buchungsübersicht, neueste zuerst, „Weitere anzeigen“ ab 50)
|   +-- Abschnitt „Rechnungen“ (nur Empfänger „Firma“ inkl. Gutschriften, Spalten wie Rechnungsübersicht)
|
+-- /gaeste/firmen/dubletten     Mögliche doppelte Firmen (neu, Inhaber)
    +-- je Paar: beide Karten · „Zusammenführen“ · „Keine doppelte Firma“

Firmen-Panel (neu, DetailPanel wie beim Gast): Anlegen/Bearbeiten
+-- Firmenfelder (neu, gemeinsam genutzt): Name*, UID, Adresszeile 1/2, PLZ/Ort/Staat (PostalPlaceFields), E-Mail, Webadresse, Ansprechpartner

Dialog „Firmen zusammenführen“ (neu, Bauart wie Gäste zusammenführen)
+-- zweite Firma per Firmensuche -> Feldwahl je Angabe (Rechnungsadresse als Block) -> Bestätigung

Dialog „Firma löschen“ (AlertDialog, nennt Anzahl verknüpfter Gäste)

Gastformular, Bereich „Firma“ (umgebaut, gilt für Gästeseite, Buchungsformular, Nacherfassen)
+-- RadioGroup: Keine Firma · Bestehende Firma · Neue Firma
+-- Bestehende Firma: Firmensuche (neu, Bauart GuestPicker) -> Firmenkarte (nur lesen) + „Ändern“
+-- Neue Firma: Firmenfelder (dieselbe Komponente wie im Panel)
    +-- Hinweis „Diese Firma gibt es bereits“ + „Bestehende Firma verwenden“
```

Entfallen: das Vorschlagsfeld beim Firmennamen aus PROJ-49 samt Server-Aktion.

### B) Datenmodell (in Worten)

**Neue Tabelle „Firmen“**, je Kunde:
- Kennung, Kunde
- Firmenname (Pflicht, bis 200 Zeichen), Merker „Name fehlt“ (nur aus der Überführung, fällt bei der ersten Namensänderung weg)
- UID, Adresszeile 1/2, PLZ, Ort, Staat (Regeln wie bisher am Gast)
- E-Mail, Webadresse (so gespeichert wie eingegeben; die Anzeige ergänzt „https://“ für den Link), Ansprechpartner (bis 200 Zeichen)
- Suchtext (von der Datenbank gepflegt: Name und UID in vereinheitlichter Form, also ohne Schreibung, Umlaute und Akzente, wie bei Gästen)
- angelegt/geändert am und von (für den Schutz vor Überschreiben und das Protokoll)

**Gast:** bekommt eine Verknüpfung „Firma“ (leer = keine Firma). Wird die Firma gelöscht, wird die Verknüpfung automatisch geleert. Die Verknüpfung ist nur innerhalb desselben Kunden möglich.

**Neue Tabelle „Keine doppelte Firma“:** gemerkte Firmenpaare, die nicht mehr vorgeschlagen werden (wie bei Gästen).

**Alte Firmenspalten am Gast:** werden ab PROJ-50 von nichts mehr gelesen oder geschrieben und bleiben bis zu einer späteren Aufräum-Migration als Sicherung stehen. Sie entfallen, sobald die Überführung in Produktion bestätigt ist.

**Änderungsprotokoll:** Die Firmentabelle wird an das bestehende automatische Protokoll angeschlossen. Beim Löschen einer Firma werden Ansprechpartner und E-Mail mit der vorhandenen Bereinigungsfunktion (PROJ-1/PROJ-7) aus den Altwerten entfernt. Am Gast erscheint ein Firmenwechsel als Änderung der Verknüpfung.

### C) Abläufe in der Datenbank

Alle Schritte, die gemeinsam gelingen müssen, laufen als geschützte Datenbank-Funktionen. Dort werden auch die Rollen geprüft, wie bisher bei Gästen.

| Ablauf | Umsetzung |
|---|---|
| Firma anlegen/bearbeiten (Inhaber, Reiter „Firmen“) | direkt in der Tabelle; Rechte: nur Inhaber darf schreiben, alle Mitglieder lesen; Schutz vor Überschreiben über „geändert am“ wie beim Gast |
| Gast speichern auf der Gästeseite (Inhaber) | **neue** Funktion „Gast speichern“: legt bei „Neue Firma“ zuerst die Firma an und verknüpft dann den Gast, in einem Schritt. Sie ersetzt das bisherige direkte Schreiben in die Gast-Tabelle |
| Buchung mit neuem Gast (auch Mitarbeiter) | bestehende Funktion „Buchung speichern“ nimmt statt Firmenfeldern entweder eine gewählte Firma oder Daten für eine neue Firma entgegen. Mitarbeiter dürfen hier eine Firma anlegen, sonst nirgends |
| Rechnung nacherfassen mit neuem Gast | bestehende Funktion wie oben umgestellt |
| Firma löschen | neue Funktion: Verknüpfungen leeren, Protokoll bereinigen, löschen |
| Firmen zusammenführen | neue Funktion (Bauart „Gäste zusammenführen“): Feldwahl übernehmen, Gäste umhängen, Dubletten-Merker aufräumen, zweite Firma löschen, Protokolleintrag |
| Gäste zusammenführen | bestehende Funktion: Feldwahl „Firma“ wählt jetzt die Verknüpfung statt sieben Felder |
| Gast anonymisieren | bestehende Funktion: leert die Verknüpfung, die Firma bleibt |
| Firmenliste | neue Lesefunktion mit Suche, Anzahl Gäste je Firma und Seiten |
| Firmensuche im Gastformular | dieselbe Lesefunktion, höchstens 8 Treffer ab 2 Zeichen (wie GuestPicker) |
| Gleicher Name bei „Neue Firma“ | Abfrage über den vereinheitlichten Namen, verzögert beim Tippen |
| Mögliche doppelte Firmen | neue Lesefunktion (Bauart Gäste-Dubletten): gleicher vereinheitlichter Name oder gleiche UID, ohne Paare aus „Keine doppelte Firma“; Platzhalternamen paaren nur über die UID |
| Gästeliste | Suche trifft Gastsuchtext **oder** Suchtext der verknüpften Firma. Eine Umbenennung der Firma wirkt dadurch sofort, ohne die Gäste umzuschreiben |
| Firmendetail: Buchungen | Buchungen, deren Hauptgast heute mit der Firma verknüpft ist |
| Firmendetail: Rechnungen | Rechnungen mit Empfänger-Art „Firma“ zu diesen Buchungen, dazu die Gutschriften zu diesen Rechnungen |
| Rechnungsentwurf, Rechnungs-Buchungssuche, PDF-Muster | lesen Firmendaten über die Verknüpfung des Hauptgasts |

### D) Überführung der Altdaten (eine Migration)
1. Firmentabelle, Verknüpfung am Gast und Dubletten-Merker anlegen.
2. Je Kunde die Gäste mit mindestens einem Firmenfeld nach den 7 Feldern gruppieren (Groß-/Kleinschreibung und Rand-Leerzeichen egal, nicht anonymisiert). Je Gruppe entsteht eine Firma mit den Werten des zuletzt geänderten Gastes, und alle Gäste der Gruppe werden verknüpft.
3. Gruppen ohne Firmennamen erhalten „Firma ohne Namen“ und den Merker „Name fehlt“.
4. Prüfung in derselben Migration: Die Zahl der Gäste mit Firmendaten muss gleich der Zahl der verknüpften Gäste sein, sonst bricht die Migration ab und nichts wird geändert.
5. Alle oben genannten Funktionen auf die Verknüpfung umstellen, die PROJ-49-Vorschlagsfunktion entfernen.
6. Altdaten über 200 Zeichen in Adresszeile 1 werden ohne Längenprüfung übernommen. Die Prüfung gilt erst beim Bearbeiten (wie PROJ-33).
7. Die Überführung schreibt keine Protokolleinträge je Gast, damit das Protokoll nicht mit Tausenden Systemeinträgen gefüllt wird.

Reihenfolge beim Ausliefern wie gewohnt: zuerst die Migration, dann der App-Code. Im kurzen Zeitfenster dazwischen würde eine Buchung mit neuem Gast über die alte App die Firmendaten nicht übernehmen. Deshalb ausliefern, wenn niemand arbeitet, und die Migration so bauen, dass alte Aufrufe nicht scheitern.

### E) Rechte (zusätzlich zur Datenbank auch in den Server-Aktionen)
- Lesen: alle Mitglieder des Kunden
- Anlegen/Bearbeiten/Löschen/Zusammenführen/Dubletten: nur Inhaber
- Mitarbeiter: Firma wählen oder neu anlegen nur innerhalb von „Buchung speichern“ mit neuem Gast
- Fremde Firmen (anderer Kunde): nicht lesbar, Detailseite „Seite nicht gefunden“

### F) Tests (Hinweis für /backend und /qa)
- Integrationstests: Überführung (gleiche/abweichende Fassung, ohne Namen, zwei Kunden, Zählprüfung), Rechte Inhaber/Mitarbeiter/fremder Kunde, Löschen mit Gästen und Protokollbereinigung, Zusammenführen, Dubletten-Paare, Buchung mit neuer Firma als Ganzes, Gästesuche nach Umbenennung
- E2E: ersetzt `tests/PROJ-49-firmen-wiederverwenden.spec.ts`. Der Integrationstest der PROJ-49-Vorschläge entfällt
- Bestehende Tests mit Firmenfeldern am Gast (Gäste, Buchungen, Rechnungsentwurf, Nacherfassen, PDF-Muster) auf die Verknüpfung umstellen

### G) Pakete
Keine neuen Pakete. Alle Bausteine sind vorhanden (shadcn RadioGroup, Command, Table, AlertDialog, Pagination, Tabs-Bauart der Einstellungen).

### Frontend-Umsetzung (2026-11-08)
**Gebaut**
- Reiter „Gäste“ | „Firmen“ (`src/components/guests/guest-tabs.tsx`) auf `/gaeste` und `/gaeste/firmen`
- Seiten: `/gaeste/firmen` (Liste mit Suche, Anzahl, Dubletten-Link, leerer Zustand, Seiten), `/gaeste/firmen/[id]` (Angaben, Gäste, Buchungen, Rechnungen an die Firma, Aktionen für Inhaber), `/gaeste/firmen/dubletten`
- Komponenten in `src/components/companies/`: `company-fields` (gemeinsame Felder mit PLZ-Automatik), `company-section` (Bereich „Firma“ im Gastformular: Keine/Bestehende/Neue Firma, Karte, „Ändern“ mit „Bei … bleiben“, Hinweis „Diese Firma gibt es bereits“), `company-picker`, `company-card`, `company-panel`, `create-company-button`, `company-actions` (Bearbeiten, Zusammenführen, Löschen mit Anzahl Gäste), `company-merge-dialog` (Feldwahl, Adresse als Ganzes), `company-duplicate-list`, `company-search`, `company-list`
- Typen und Regeln: `src/lib/companies.ts`, Prüfregeln `src/lib/validation/companies.ts`; Gastformular mit `companyMode`/`companyId` und Firmenfeldern (Präfix „company“), beim Speichern als `{ mode: none | existing | new }`
- Lesefunktionen `src/lib/companies-data.ts` (Liste, Detail, Gäste, Buchungen über `getCompanyBookings`, Rechnungen mit Empfänger „Firma“ inkl. Gutschriften, Dubletten); Aktionen `src/app/(app)/gaeste/firmen/actions.ts`
- Gast liest die Firma über die Verknüpfung (`company:companies!guests_company_fkey(...)`): Gast-Detail (Name als Link), Gästeliste (Firmenname als Link in der Tabelle), Zusammenführen von Gästen (Verknüpfung als Ganzes), Rechnungsentwurf, Rechnungs-Buchungssuche, Rechnung nacherfassen
- Gast speichern über die neue DB-Funktion `save_guest` (statt direktem Tabellen-Schreiben); Buchung und Rechnung mit neuem Gast schicken `company_id` bzw. `new_company` im `new_guest`
- Fehler `companyMissing` (P0707) in Gäste, Buchungen, Rechnungen: Meldung, Auswahl springt auf die Suche
- PROJ-49 entfernt: `company-name-field.tsx`, Aktion `suggestCompanies`, Unit-Tests, E2E `tests/PROJ-49-firmen-wiederverwenden.spec.ts`, Integrationstest `guest-company-suggestions`

**Vorab eingetragene DB-Typen (für /backend verbindlich)** in `src/types/database.ts`
- Tabelle `companies` (id, tenant_id, name, name_missing, vat_id, address_line1/2, postal_code, city, country, email, website, contact, search_text, name_key, created/updated_at/_by), Fremdschlüssel `guests_company_fkey` (company_id, tenant_id) → companies (id, tenant_id); Tabelle `company_duplicate_dismissals` (company_a, company_b, tenant_id, dismissed_at/_by)
- `company_list(p_tenant_id, p_query?, p_exact_name?, p_exclude_id?, p_limit?, p_offset?)` → id, name, name_missing, vat_id, address_line1, postal_code, city, country, guest_count, total; Sortierung nach Name; `p_exact_name` = gleicher vereinheitlichter Name
- `company_duplicate_pairs(p_tenant_id)` → company_a, company_b, reasons (`name`, `vatId`)
- `save_guest(p_input jsonb)` → uuid; Eingabe: tenant_id, Gastspalten, optional id + updated_at (Bearbeiten), email_source/phone_source, company_id oder new_company (Spalten wie `companyDbColumns`); Fehler P0701 Rolle, P0702 nicht gefunden, P0703 anonymisiert, P0705 Ausweisbild, **P0706 inzwischen geändert**, **P0707 Firma fehlt**
- `delete_company(p_company_id)`, `merge_companies(p_keep, p_remove, p_choice)` mit Feldern name, vatId, address, email, website, contact
- `guest_list` liefert zusätzlich `company_id`; `company_name` aus der verknüpften Firma; Suche auch über den Suchtext der Firma
- `save_booking`/`save_invoice`: `new_guest` enthält `company_id` bzw. `new_company`; P0707, wenn die Firma fehlt
- `name_missing` fällt in der Datenbank bei der ersten Namensänderung weg (die App sendet es nicht)

**Offen für /backend und /qa**
- Ohne Migration funktionieren Firmen-Seiten und Gast speichern noch nicht (Funktionen fehlen in Dev)
- E2E-Tests, die Gäste mit `company_*`-Spalten direkt anlegen oder das alte Firmenfeld bedienen, müssen umgestellt werden: PROJ-14, 15, 33, 37, 40, 41, 42, 43, 44, 45
- Firmen-Abschnitte im Detail zeigen höchstens 200 Buchungen bzw. Rechnungen mit Hinweis (statt Seiten)

### Backend-Umsetzung (2026-11-08)
**Migrationen (nur Dev):** `20261108164726_company_list.sql`, `20261108165414_company_list_grants.sql` (Aufrufrechte der privaten Funktionen)
- Tabellen `companies` (RLS: Lesen Mitglieder/Admin, Anlegen/Ändern nur Inhaber, kein direktes Löschen; Standardfelder + Protokoll über `enable_tenant_table`) und `company_duplicate_dismissals` (nur Inhaber); `guests.company_id` mit Fremdschlüssel (company_id, tenant_id) → companies, `on delete set null (company_id)`
- Trigger `companies_before_write`: Suchtext (Name, UID auch ohne Leerzeichen), Namensschlüssel; „Name fehlt“ fällt bei Namensänderung weg, außer er wird mitgesetzt (Zusammenführen)
- Überführung `private.transfer_guest_companies()` (bleibt für Nachprüfungen bestehen, verknüpft nur Gäste ohne Firma): Gruppen nach den 7 Feldern (lower/btrim), Werte des zuletzt geänderten Gastes, Platzhalter „Firma ohne Namen“ + Merker, Zählprüfung mit Abbruch; während der Überführung Protokoll- und „zuletzt geändert“-Trigger am Gast aus; danach Suchtext aller Gäste neu (ohne Firmenname). Länge Adresszeile 1 der Firma als `not valid`-Regel nach der Überführung (gilt für neue und geänderte Firmen)
- Alte Firmenspalten am Gast: Schreibrechte entzogen, Anonymisieren leert sie weiter; Entfernen in späterer Aufräum-Migration
- Neue Funktionen: `save_guest` (Inhaber; Anlegen/Bearbeiten mit P0706 bei veraltetem Stand), `private.guest_company_from_input` (bestehende Firma prüfen → P0707, neue Firma anlegen; auch für Mitarbeiter innerhalb `save_booking`), `company_list` (Suche nach Wörtern in Name/UID, `p_exact_name`, `p_exclude_id`, Anzahl Gäste), `company_duplicate_pairs`, `delete_company` (Rückgabe Anzahl Gäste, Protokoll bereinigt), `merge_companies`
- Umgestellt: `guests_before_write`, `guest_list` (neu angelegt, liefert `company_id`, Suche im Gast- oder Firmen-Suchtext), `merge_guests` (Verknüpfung), `anonymize_guest` (Verknüpfung leeren), `save_booking`, `save_invoice` (neuer Gast mit `company_id`/`new_company`), `search_invoice_bookings` (Firmenname über Verknüpfung); entfernt: `guest_company_suggestions`
- Typen neu erzeugt; Advisors: nur die bekannte Auth-Warnung „OTP long expiry“ (nicht aus dieser Migration)

**Tests**
- Überführung mit Probedaten in einer zurückgerollten Transaktion geprüft (gleiche Fassung inkl. Schreibung/Rand-Leerzeichen → eine Firma mit Werten des zuletzt geänderten Gastes; andere Adresse → eigene Firma; nur UID → „Firma ohne Namen“ mit Merker; Adresszeile 250 Zeichen übernommen; zweiter Kunde getrennt; Gast ohne Firma unverknüpft; Suchtext ohne Firmenname)
- Neu `supabase/tests/companies.integration.test.ts` (15): Rollen und Abschottung, Schreibsperre alte Spalten, Prüfregeln, Merker „Name fehlt“, save_guest (neue/bestehende/fremde Firma, P0706, P0707, P0701), Liste und Suche (Umlaute, UID, gleicher Name, Ausschluss), Gästesuche über Firmenname nach Umbenennung, Dubletten (Name, UID, Platzhalter, Ausblenden), Löschen (Verknüpfungen leer, Protokoll bereinigt), Zusammenführen (Feldwahl, Gäste umgehängt, Fehlerfälle), Gäste zusammenführen und anonymisieren
- Angepasst: `guests.integration` (Suche über Firma; Abschnitt PROJ-33 entfernt), `bookings.integration` (neuer Gast mit neuer Firma, alles oder nichts), `invoices.integration` (Firma über Verknüpfung)
- Grün: companies 15, guests + bookings 44, invoices + invoice-drafts 49, rls + guest-documents 33; Unit 937; Lint und Build

**Beim Ausliefern beachten:** Migration vor dem App-Code; in der Zwischenzeit übernimmt eine Buchung mit neuem Gast über die alte App keine Firmendaten (Felder werden ignoriert). Deshalb außerhalb der Arbeitszeiten ausliefern. Danach Zahl der Firmen und verknüpften Gäste in Staging/Prod prüfen.

### H) Abweichung von der Spec (bestätigt 2026-11-08)
Die Spec sah ein „Änderungsprotokoll der Firma“ zum Ansehen für Inhaber vor. In der App gibt es bisher **keine** Anzeige des Protokolls, auch nicht für Gäste (PROJ-7). Entschieden: Das Protokoll wird wie bei Gästen nur in der Datenbank geführt. Eine Anzeige kommt bei Bedarf als eigenes Feature für alle Bereiche. Rechte-Tabelle und Akzeptanzkriterien sind angepasst.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
