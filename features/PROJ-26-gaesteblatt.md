# PROJ-26: Gästeblatt (Meldewesen)

## Status: Architected
**Created:** 2026-11-08
**Last Updated:** 2026-11-08

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Rollen Inhaber/Mitarbeiter, gewählter Kunde
- Requires: PROJ-7 (Gäste-Datenbank): Hauptgast mit Name, Geburtsdatum, Adresse, Staatsangehörigkeit (bisher „Herkunftsland“), Änderungsprotokoll, Anonymisieren
- Requires: PROJ-8 (Manuelle Buchungen): Buchung, Buchungsdetail, Mitreisende, Personenzahl
- Requires: PROJ-28 (Kundenstammdaten): Kundenname = Name des Beherbergungsbetriebes, Anschrift für die Datenschutz-Texte
- Requires: PROJ-29 (Gast-Erweiterung): Geschlecht (sechs Werte wie auf dem Formular), Reisedokument
- Requires: PROJ-30 (Buchungs-Erweiterung): Gästeblattnummer, Abreise geplant/tatsächlich, „Wohnsitz angemeldet“
- Requires: PROJ-39 (Einstellungen → Rechnungen): einfacher Texteditor mit Platzhaltern und Vorschau, hier für die Datenschutz-Texte wiederverwendet
- Requires: PROJ-41 (Briefpapier): Gestaltung der PDF-Ausgabe
- Wirkt mit: PROJ-18 (Auswertungen): „Gästeherkunft“ rechnet künftig mit dem Herkunftsland der Adresse
- Wird genutzt von: PROJ-19 (Marketing): Marketing-Einwilligung am Gast mit Datum und Quelle; Widerruf, Segmente und Export dort

## Überblick
Je Buchung entsteht ein digitales **Gästeverzeichnisblatt** nach dem Meldegesetz, das der Hauptgast am Tablet mit Stift (oder Finger, Maus) unterschreibt. Es hat zwei Seiten:
1. **Meldedaten**: Nachbau des amtlichen Formulars (Vorlage `docs/design/gaesteblatt-leer.png`) ohne den Reisegruppen-Teil. Daten kommen aus Buchung und Gast; Fehlendes wird direkt auf dem Blatt per Tastatur ergänzt und sofort an Gast bzw. Buchung gespeichert. → **Unterschrift 1**, „Weiter“.
2. **Datenschutz**: Teil A Information über die elektronische Verarbeitung (ohne Kästchen), Teil B freiwillige Marketing-Einwilligung (Kästchen, nicht vorausgewählt). → **Unterschrift 2**, „Fertig“.

Bei „Fertig“ wird das Blatt eingefroren, als PDF im privaten Speicher des Kunden abgelegt und mit der Buchung verknüpft. Alte Papier-Gästeblätter lassen sich als PDF zur Buchung hochladen. Ein neuer Menüpunkt „Gästeblätter“ listet alle Blätter, ein neuer Einstellungen-Reiter „Gästeblatt“ enthält die Datenschutz-Texte. Nebenbei wird das Gastfeld „Herkunftsland“ in „Staatsangehörigkeit“ umbenannt, und der Wohnsitzstaat der Adresse heißt künftig „Herkunftsland“.

## User Stories
- Als **Vermieter (Inhaber oder Mitarbeiter)** möchte ich bei der Schlüsselübergabe das Gästeblatt am Tablet öffnen und dem Gast zum Unterschreiben geben, damit die Meldepflicht ohne Papier erfüllt ist.
- Als **Gast** möchte ich fehlende Angaben (z. B. Geburtsdatum, Reisedokument) direkt auf dem Blatt eintippen, damit niemand sie später von einem Zettel abschreiben muss.
- Als **Vermieter** möchte ich, dass auf dem Blatt ergänzte Daten am Gast und an der Buchung gespeichert werden, damit sie für die nächste Buchung und für Rechnungen bereitstehen.
- Als **Inhaber** möchte ich die Marketing-Einwilligung eines Gastes mit Datum und Nachweis erfassen, damit ich Stammgäste später DSGVO-konform anschreiben darf (PROJ-19).
- Als **Vermieter** möchte ich unterschriebene Gästeblätter je Buchung und in einer Liste ansehen, damit ich sie bei einer Kontrolle der Gemeinde vorlegen kann.
- Als **Vermieter** möchte ich sehen, für welche Buchungen das Gästeblatt fehlt, damit keine Meldung vergessen wird.
- Als **Vermieter** möchte ich alte Papier-Gästeblätter als PDF zur Buchung hochladen, damit das Verzeichnis vollständig in der App liegt.
- Als **Inhaber** möchte ich die Datenschutz-Texte an meinen Betrieb anpassen, damit sie meine Kontaktdaten und meine Praxis richtig wiedergeben.

## Geltungsbereich
- Ein Gästeblatt **je Buchung**: Hauptgast plus alle Mitreisenden; unterschreibt der Hauptgast. Keine eigenen Blätter für einzelne Mitreisende, **keine Reisegruppen-Regelung**.
- Gästeblatt nur für Buchungen (Art „Buchung“), **nicht** für Optionen, Sperren, stornierte Buchungen und Buchungen mit „Wohnsitz angemeldet“.
- Nur **Deutsch**.

## Rechte
| Aktion | Inhaber | Mitarbeiter |
|---|---|---|
| Gästeblatt starten, unterschreiben lassen, ansehen | ja | ja |
| Auf dem Blatt Gast- und Buchungsdaten ergänzen und korrigieren (nur die Felder des Blatts) | ja | ja |
| „Neu unterschreiben lassen“ | ja | ja |
| Altes Gästeblatt hochladen | ja | ja |
| Menüpunkt „Gästeblätter“ | ja | ja |
| Einstellungen → Gästeblatt | ja | nein |
| Gästeblatt löschen | nein | nein |

## Regeln

### Umbenennung Staatsangehörigkeit / Herkunftsland
- Das Pflichtfeld am Gast „Herkunftsland“ heißt künftig **„Staatsangehörigkeit“**. Die gespeicherten Werte bleiben unverändert. Hinweis unter dem Feld: „Staatsangehörigkeit des Gastes, für das Gästeblatt.“
- Das Feld für den Wohnsitzstaat in der Gastadresse (heute „Land“/„Staat“) heißt künftig **„Herkunftsland“**.
- Überall, wo heute „Herkunftsland“/„Herkunft“ für das Pflichtfeld steht (Gastformular, Gast-Detail, Gästeliste Spalte und Filter, Zusammenführen, Anonymisieren-Texte, Pflichtfeld-Meldung), steht künftig „Staatsangehörigkeit“.
- **Auswertung „Gästeherkunft“ (PROJ-18)**: rechnet künftig mit dem Herkunftsland der Adresse; ist es leer, ersatzweise mit der Staatsangehörigkeit. Der Hinweistext erklärt das („Herkunftsland laut Adresse des Hauptgasts, sonst Staatsangehörigkeit; Mitreisende zählen mit.“). PDF und CSV der Auswertung folgen derselben Regel.
- Die Firmenanschrift (PROJ-33/50) behält „Staat“.

### Knopf und Abschnitt „Gästeblatt“ in der Buchung
- Das Buchungsdetail bekommt einen Abschnitt **„Gästeblatt“** (nur bei Buchungen, für die ein Gästeblatt vorgesehen ist).
- Inhalt je nach Stand:
  - **Kein Gästeblatt**: Text „Noch kein Gästeblatt“, Knöpfe **„Gästeblatt“** (startet die Unterschrift) und **„Gästeblatt hochladen“**.
  - **Unterschrieben**: „Unterschrieben am [Datum, Uhrzeit]“, Lfd.-Nr., Marketing-Einwilligung ja/nein, Knöpfe **„Gästeblatt ansehen“** und **„Neu unterschreiben lassen“** (mit Rückfrage), „Gästeblatt hochladen“ (mit Rückfrage „Bestehendes Gästeblatt ersetzen?“).
  - **Hochgeladen**: „Hochgeladen am [Datum] von [Name]“, ggf. „unterschrieben am [Datum]“, Knöpfe „Gästeblatt ansehen“, „Gästeblatt“ (neu unterschreiben, mit Rückfrage), „Gästeblatt hochladen“ (ersetzen, mit Rückfrage).
  - Ersetzte Blätter stehen darunter als „Frühere Gästeblätter“ (ansehbar).
- Hat die Buchung **keinen verknüpften Gast**, ist „Gästeblatt“ gesperrt mit dem Hinweis „Bitte zuerst einen Gast mit der Buchung verknüpfen.“ Hochladen geht trotzdem.
- **Hinweis „Buchung nach der Unterschrift geändert“** erscheint, wenn bei einem unterschriebenen (nicht hochgeladenen) Blatt Ankunft, voraussichtliche Abreise, der verknüpfte Hauptgast oder die Mitreisenden (Anzahl, Name, Geburtsdatum) nicht mehr dem Blatt entsprechen. Änderungen an Gastdaten lösen ihn nicht aus.
- Wird die Buchung storniert, bleibt das Blatt erhalten und wird mit „Buchung storniert“ gekennzeichnet. Wird „Wohnsitz angemeldet“ nachträglich gesetzt, bleibt ein vorhandenes Blatt ebenfalls erhalten.

### Vollbild-Ansicht
- „Gästeblatt“ öffnet eine **Vollbild-Ansicht ohne App-Menü und ohne Kundenwechsel**, ausgelegt für Tablets im Querformat (auch Hochformat, Handy, Desktop nutzbar).
- Oben: Name des Beherbergungsbetriebes (= Kundenname), Fortschritt **„1 Meldedaten · 2 Datenschutz“**.
- Unten: **„Abbrechen“** mit Rückfrage „Gästeblatt abbrechen? Ergänzte Daten bleiben gespeichert, Unterschriften nicht.“ → zurück zur Buchung.
- Keine PIN-Sperre.

### Seite 1: Meldedaten
Aufbau wie das amtliche Gästeverzeichnisblatt, Felder in dieser Gruppierung:

| Bereich | Feld | Quelle | Pflicht |
|---|---|---|---|
| Kopf | Lfd.-Nr. | Buchung: Gästeblattnummer | nein (vorerst; siehe Open Questions) |
| Kopf | Kennzahl | – (vorerst leer, siehe Open Questions) | nein |
| Kopf | Name des Beherbergungsbetriebes | Kundenname (Stammdaten), nur lesen | – |
| Hauptgast | Familienname, Vorname(n) | Gast | ja |
| Hauptgast | Geschlecht (männlich, weiblich, divers, inter, offen, keine Angabe) | Gast | ja; „keine Angabe“ zählt als Angabe |
| Hauptgast | Geburtsdatum | Gast | ja |
| Hauptgast | Staatsangehörigkeit | Gast | ja |
| Reisedokument | Art, Nummer (Dokument-ID), Ausstellungsdatum, ausstellende Behörde, Staat | Gast | ja, **wenn Staatsangehörigkeit nicht Österreich**; sonst ausgeblendet |
| Adresse und Herkunftsland | Straße/Gasse/Platz, Postleitzahl, Ortsgemeinde, Herkunftsland | Gast | ja |
| Mitreisende im familiären Verbund | je Person Familienname, Vorname(n), Geburtsdatum | Buchung | ja; Anzahl = Personen der Buchung − 1 |
| Aufenthalt | Ankunft am, voraussichtliche Abreise am | Buchung, nur lesen | – |
| Aufenthalt | Tatsächliche Abreise am | Buchung, bei Unterschrift leer | – |
| Unterschrift | Datum (automatisch) und Unterschrift des Meldepflichtigen | Unterschrift 1 | ja |

- **Ergänzen per Tastatur**: Jedes Feld außer den Nur-Lesen-Feldern ist bearbeitbar. Fehlende Pflichtfelder sind markiert („Bitte ergänzen“). Eingaben werden **beim Verlassen des Feldes** an Gast bzw. Buchung gespeichert (gleiche Prüfregeln wie im Gast- bzw. Buchungsformular, z. B. Geburtsdatum nicht in der Zukunft). Die PLZ-Automatik (PROJ-48) gilt auch hier. Dokumentbilder können hier nicht hochgeladen werden.
- **Mitreisende**: Fehlen Personen, gibt es „Mitreisende hinzufügen“ bis zur Grenze (Personen − 1). Die Personenzahl der Buchung lässt sich auf dem Blatt nicht ändern.
- Änderungen über das Blatt stehen im Änderungsprotokoll mit dem Vermerk „über Gästeblatt“.
- **Unterschriftsfeld 1** ist erst aktiv, wenn alle Pflichtangaben vollständig sind; vorher steht dort „Bitte zuerst alle markierten Felder ergänzen“. Es gibt „Unterschrift löschen“. Eine leere oder nur punktförmige Unterschrift gilt nicht.
- **„Weiter“** ist erst nach Unterschrift 1 aktiv.
- Wird nach Unterschrift 1 noch ein Feld auf Seite 1 geändert, wird Unterschrift 1 gelöscht und muss neu geleistet werden (Hinweis dazu).

### Seite 2: Datenschutz
- **Teil A „Information zur Verarbeitung Ihrer Daten“**: Text aus den Einstellungen, Platzhalter gefüllt, ohne Kästchen.
- **Teil B „Einwilligung in Marketing“**: Text aus den Einstellungen und ein Kästchen „Ich willige ein.“, **nicht vorausgewählt**, auch wenn der Gast früher schon eingewilligt hat.
- **Unterschriftsfeld 2** (gleiche Regeln wie Unterschrift 1). Unterschrift 2 ist **auch ohne Häkchen** möglich; dann gilt „keine Marketing-Einwilligung erteilt“.
- **„Zurück“** führt zu Seite 1; Unterschrift 1 bleibt erhalten, solange dort nichts geändert wird.
- **„Fertig“** ist erst nach Unterschrift 2 aktiv.

### Abschluss „Fertig“
In einem Schritt:
1. Das Blatt wird **eingefroren**: alle angezeigten Angaben, beide Datenschutz-Texte im angezeigten Wortlaut, das Kästchen, beide Unterschriften, Datum und Uhrzeit beider Unterschriften, wer das Blatt gestartet hat (Benutzer).
2. Ein **PDF** wird erzeugt (Seite 1 Meldedaten mit Unterschrift 1, Seite 2 Datenschutz mit Unterschrift 2) und **privat im Speicher des Kunden** abgelegt, wie die Bilder der Reisedokumente.
3. Das Blatt wird mit der Buchung verknüpft; ein vorheriges Blatt wird „ersetzt“.
4. Bei angekreuztem Kästchen wird am Gast gespeichert: **Marketing-Einwilligung erteilt am [Datum], über Gästeblatt zu Buchung [Nummer]**. Ohne Häkchen wird nichts am Gast geändert (eine frühere Einwilligung bleibt bestehen).
5. Danach Rückkehr zur Buchung mit der Meldung „Gästeblatt gespeichert“.

Schlägt ein Teil fehl, wird nichts gespeichert, die Ansicht bleibt mit beiden Unterschriften offen und zeigt „Das Gästeblatt konnte nicht gespeichert werden. Bitte erneut versuchen.“

### Nachtrag der tatsächlichen Abreise
- Wird an der Buchung die tatsächliche Abreise gespeichert oder geändert, wird das PDF des aktuellen, **unterschriebenen** Blatts neu erzeugt: Feld „Tatsächliche Abreise am“ befüllt, Unterschriften und alle übrigen Angaben unverändert, dazu ein Vermerk „Abreise nachgetragen am [Datum] von [Name]“.
- Ist die tatsächliche Abreise leer, wird **ab dem Tag der geplanten Abreise** automatisch die geplante Abreise eingetragen, mit Vermerk „Abreise nachgetragen am [Datum] (automatisch)“.
- Hochgeladene Blätter werden nie ergänzt.

### Altes Gästeblatt hochladen
- Dialog „Gästeblatt hochladen“: Datei (nur **PDF**, höchstens **10 MB**, eine Datei), **Lfd.-Nr.** (vorbelegt aus der Buchung, änderbar, wird an der Buchung gespeichert), **Unterschrieben am** (Datum, optional, nicht in der Zukunft), Häkchen **„Marketing-Einwilligung liegt unterschrieben vor“** (nicht vorausgewählt).
- Es werden **keine Pflichtfelder** an Gast oder Buchung geprüft.
- Mit Häkchen wird am verknüpften Gast gespeichert: Marketing-Einwilligung erteilt am [Unterschrieben am, sonst Hochladedatum], über hochgeladenes Gästeblatt zu Buchung [Nummer]. Ohne verknüpften Gast ist das Häkchen gesperrt.
- Gibt es schon ein Blatt: Rückfrage „Bestehendes Gästeblatt ersetzen?“; das alte bleibt als „ersetzt“.

### Menüpunkt „Gästeblätter“
- Neuer Menüpunkt für Inhaber und Mitarbeiter, für den gewählten Kunden.
- **Liste** mit Spalten: Lfd.-Nr., Hauptgast, Ankunft, Abreise, Wohnung, Art („unterschrieben“, „hochgeladen“), Marketing-Einwilligung (ja/nein), Hinweise (Warnzeichen „Buchung nach der Unterschrift geändert“, „Buchung storniert“), Link zur Buchung. Ein Klick auf die Zeile öffnet das PDF.
- Ersetzte Blätter erscheinen nicht in der Liste, nur in der Buchung.
- **Filter**: Jahr/Monat der Ankunft (Sprungauswahl wie in der Buchungsübersicht), Suche nach Name und Lfd.-Nr.
- **Filter „Gästeblatt fehlt“**: zeigt stattdessen die Buchungen ab Ankunftstag (Ankunft ≤ heute) ohne Gästeblatt, ohne „Wohnsitz angemeldet“, Optionen, Sperren und Stornos; je Zeile Link zur Buchung.
- Leerer Zustand: „Noch keine Gästeblätter. Gästeblätter entstehen in der Buchung über den Knopf „Gästeblatt“.“

### Einstellungen → Gästeblatt
- Neuer Reiter **„Gästeblatt“** (nur Inhaber), nach „Zahlungen“.
- Zwei Texte: **„Information zur Verarbeitung (Teil A)“** und **„Marketing-Einwilligung (Teil B)“**, je mit dem Editor aus PROJ-39 (beschränkte Formatierung, „Platzhalter einfügen“, Vorschau mit den Daten des Kunden), Knopf **„Auf Standard zurücksetzen“**.
- **Platzhalter**: {Kundenname}, {Anschrift} (Adresse aus den Stammdaten in einer Zeile), {E-Mail}, {Telefon}. Unbekannte Platzhalter verhindern das Speichern (wie PROJ-39). Ist ein verwendeter Platzhalter in den Stammdaten leer, zeigt die Vorschau einen Hinweis „{E-Mail} ist in den Stammdaten nicht ausgefüllt“.
- **Kundenstammdaten** bekommen dafür die optionalen Felder **„E-Mail“** und **„Telefon“** (Kontakt für Gäste), bearbeitbar durch Inhaber und Betreiber wie die übrigen Stammdaten.
- Ein Leertext ist nicht erlaubt (Meldung „Bitte einen Text eingeben oder auf Standard zurücksetzen.“).
- Änderungen wirken nur auf neu unterschriebene Blätter.

### Standardtexte
**Teil A – Information zur Verarbeitung Ihrer Daten**

> Verantwortlich für die Verarbeitung Ihrer personenbezogenen Daten ist {Kundenname}, {Anschrift}, E-Mail: {E-Mail}, Telefon: {Telefon}.
>
> Wir verarbeiten die Angaben dieses Gästeblatts (Namen, Geschlecht, Geburtsdaten, Staatsangehörigkeit, Anschrift, Reisedokument, Aufenthaltsdaten und Mitreisende) elektronisch. Das ist nötig, um unsere gesetzlichen Pflichten nach dem Meldegesetz und den Abgabenvorschriften (Ortstaxe) zu erfüllen (Art. 6 Abs. 1 lit. c DSGVO) und um Ihren Beherbergungsvertrag einschließlich der Rechnungslegung abzuwickeln (Art. 6 Abs. 1 lit. b DSGVO).
>
> Ihre Daten geben wir nur weiter, soweit ein Gesetz das verlangt, etwa an die Gemeinde oder an Sicherheitsbehörden. Gespeichert werden sie bei IT-Dienstleistern mit Sitz bzw. Rechenzentrum in der EU, die als Auftragsverarbeiter an unsere Weisungen gebunden sind.
>
> Das Gästeblatt bewahren wir sieben Jahre auf; Rechnungsdaten so lange, wie es das Steuer- und Unternehmensrecht vorschreibt. Danach werden die Daten gelöscht.
>
> Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Sie können sich außerdem bei der Österreichischen Datenschutzbehörde (www.dsb.gv.at) beschweren.
>
> Mit meiner Unterschrift bestätige ich, diese Information erhalten zu haben.

**Teil B – Einwilligung in Marketing**

> Ich willige ein, dass {Kundenname} meinen Namen, meine Anschrift, E-Mail-Adresse und Telefonnummer sowie die Daten meiner Aufenthalte speichert und verwendet, um mir Angebote und Neuigkeiten zu den eigenen Unterkünften per Post, E-Mail oder telefonisch zu senden.
>
> Diese Einwilligung ist freiwillig. Wenn ich sie nicht erteile, hat das keinen Einfluss auf meinen Aufenthalt. Ich kann sie jederzeit ohne Angabe von Gründen mit Wirkung für die Zukunft widerrufen, zum Beispiel per E-Mail an {E-Mail}.

### Aufbewahrung, Gast anonymisieren
- Gästeblätter (auch ersetzte) lassen sich **nicht von Hand löschen**. Aufbewahrung 7 Jahre; automatisches Löschen nach Fristende → späteres Feature.
- Wird ein Gast **anonymisiert** (PROJ-7), bleiben seine Gästeblätter unverändert erhalten; die Marketing-Einwilligung am Gast wird mit entfernt.
- Ein Gast mit Gästeblatt kann **nicht endgültig gelöscht** werden, sondern nur anonymisiert (wie bei Rechnungen). Ebenso kann eine Buchung mit Gästeblatt nicht gelöscht, nur storniert werden.
- Werden Gäste **zusammengeführt**, gehen die Marketing-Einwilligungen auf den verbleibenden Gast über (die jüngste Erteilung gilt); Gästeblätter bleiben an ihren Buchungen.

## Out of Scope
- Mehrere Gästeblätter je Buchung (eigene Blätter für Mitreisende, die nicht zum familiären Verbund gehören)
- Reisegruppen (Sammelliste, Aufgliederung nach Herkunftsland)
- Automatische Vergabe der Lfd.-Nr. (Nummernkreis) → nach Klärung mit der Gemeinde per `/refine PROJ-26`
- Kennzahl des Beherbergungsbetriebes → nach Klärung mit der Gemeinde, dann als Feld in den Kundenstammdaten
- Elektronische Übermittlung an Gemeinde oder Meldebehörde, Gästeverzeichnis-Export für Behörden
- Englisch oder weitere Sprachen auf dem Gästeblatt (→ PROJ-23 oder eigenes Feature)
- PIN-Sperre bzw. Kiosk-Modus für die Vollbild-Ansicht
- Widerruf der Marketing-Einwilligung, Segmente, Export → PROJ-19
- Automatisches Löschen nach Ablauf der Aufbewahrungsfrist
- Gästeblatt für Buchungen aus Channex (folgt automatisch, sobald PROJ-11 Buchungen anlegt; keine eigene Logik hier)
- Hinweis „Gästeblatt fehlt“ im Dashboard (PROJ-14) → siehe Open Questions
- Hochladen von Bildern (JPG/PNG) statt PDF; Hochladen der Dokumentbilder auf dem Blatt
- Ändern der Personenzahl auf dem Blatt
- Unterschrift durch Mitreisende

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Umbenennung
- [ ] Angenommen das Gastformular ist offen, wenn es angezeigt wird, dann heißt das Pflichtfeld „Staatsangehörigkeit“ und das Länderfeld der Adresse „Herkunftsland“
- [ ] Angenommen ein Gast hatte bisher Herkunftsland „Deutschland“, wenn die Umbenennung ausgeliefert ist, dann zeigt er Staatsangehörigkeit „Deutschland“
- [ ] Angenommen die Gästeliste, wenn sie angezeigt wird, dann heißen Spalte und Filter „Staatsangehörigkeit“
- [ ] Angenommen ein Gast mit Staatsangehörigkeit Deutschland und Herkunftsland (Adresse) Schweiz, wenn die Auswertung „Gästeherkunft“ berechnet wird, dann zählt er zur Schweiz
- [ ] Angenommen ein Gast mit Staatsangehörigkeit Deutschland ohne Herkunftsland in der Adresse, wenn „Gästeherkunft“ berechnet wird, dann zählt er zu Deutschland

### Knopf und Abschnitt in der Buchung
- [ ] Angenommen eine Buchung ohne Gästeblatt mit verknüpftem Gast, wenn das Buchungsdetail angezeigt wird, dann zeigt der Abschnitt „Gästeblatt“ „Noch kein Gästeblatt“ und die Knöpfe „Gästeblatt“ und „Gästeblatt hochladen“
- [ ] Angenommen eine Buchung mit „Wohnsitz angemeldet“, eine Option, eine Sperre oder eine stornierte Buchung ohne Blatt, wenn das Detail angezeigt wird, dann gibt es keinen Abschnitt „Gästeblatt“
- [ ] Angenommen eine Buchung ohne verknüpften Gast, wenn das Detail angezeigt wird, dann ist „Gästeblatt“ gesperrt mit dem Hinweis „Bitte zuerst einen Gast mit der Buchung verknüpfen.“ und „Gästeblatt hochladen“ ist möglich
- [ ] Angenommen ein Mitarbeiter, wenn er eine Buchung öffnet, dann kann er das Gästeblatt starten, ansehen und hochladen
- [ ] Angenommen eine Buchung mit unterschriebenem Blatt, wenn „Neu unterschreiben lassen“ bestätigt und das neue Blatt fertiggestellt wird, dann ist das neue Blatt aktuell und das alte steht unter „Frühere Gästeblätter“

### Vollbild-Ansicht und Seite 1
- [ ] Angenommen ein Klick auf „Gästeblatt“, wenn die Ansicht öffnet, dann ist sie ohne App-Menü, zeigt den Kundennamen und den Fortschritt „1 Meldedaten · 2 Datenschutz“
- [ ] Angenommen Gast und Buchung sind vollständig, wenn Seite 1 angezeigt wird, dann sind alle Felder befüllt, keines ist markiert und das Unterschriftsfeld ist aktiv
- [ ] Angenommen dem Gast fehlt das Geburtsdatum, wenn Seite 1 angezeigt wird, dann ist das Feld markiert und das Unterschriftsfeld gesperrt mit „Bitte zuerst alle markierten Felder ergänzen“
- [ ] Angenommen das fehlende Geburtsdatum wird eingetippt, wenn das Feld verlassen wird, dann ist es am Gast gespeichert und im Änderungsprotokoll mit „über Gästeblatt“ vermerkt
- [ ] Angenommen ein Geburtsdatum in der Zukunft wird eingetippt, wenn das Feld verlassen wird, dann erscheint die Fehlermeldung aus dem Gastformular und nichts wird gespeichert
- [ ] Angenommen ein Gast mit Staatsangehörigkeit Österreich, wenn Seite 1 angezeigt wird, dann ist der Bereich Reisedokument ausgeblendet und nicht Pflicht
- [ ] Angenommen ein Gast mit Staatsangehörigkeit Italien ohne Reisedokument, wenn Seite 1 angezeigt wird, dann sind Art, Nummer, Ausstellungsdatum, Behörde und Staat markiert
- [ ] Angenommen Geschlecht „keine Angabe“, wenn Seite 1 geprüft wird, dann gilt das Geschlecht als ausgefüllt
- [ ] Angenommen eine Buchung mit 4 Personen und 1 Mitreisenden, wenn Seite 1 angezeigt wird, dann fehlen 2 Mitreisende, „Mitreisende hinzufügen“ ist da und die Unterschrift ist gesperrt, bis 3 Mitreisende vollständig sind
- [ ] Angenommen eine Postleitzahl „6020“ wird in der Adresse eingetippt, wenn das Feld verlassen wird, dann wird Ortsgemeinde „Innsbruck“ und Herkunftsland „Österreich“ wie in PROJ-48 vorgeschlagen
- [ ] Angenommen ein Mitarbeiter korrigiert auf dem Blatt die Straße des Gastes, wenn das Feld verlassen wird, dann ist die neue Straße am Gast gespeichert
- [ ] Angenommen Ankunft und voraussichtliche Abreise, wenn Seite 1 angezeigt wird, dann sind sie nicht bearbeitbar und „Tatsächliche Abreise am“ ist leer
- [ ] Angenommen das Unterschriftsfeld ist leer, wenn „Weiter“ angesehen wird, dann ist es gesperrt
- [ ] Angenommen Unterschrift 1 ist geleistet, wenn „Unterschrift löschen“ geklickt wird, dann ist das Feld leer und „Weiter“ gesperrt
- [ ] Angenommen Unterschrift 1 ist geleistet, wenn danach ein Feld auf Seite 1 geändert wird, dann wird Unterschrift 1 gelöscht und ein Hinweis erklärt das
- [ ] Angenommen ein Tablet mit Stift, ein Handy mit Finger und ein Desktop mit Maus, wenn unterschrieben wird, dann wird die Unterschrift jeweils angenommen

### Seite 2 und Abschluss
- [ ] Angenommen Seite 2, wenn sie angezeigt wird, dann stehen Teil A ohne Kästchen und Teil B mit nicht ausgewähltem Kästchen „Ich willige ein.“, Platzhalter mit den Stammdaten des Kunden gefüllt
- [ ] Angenommen der Gast hat früher eingewilligt, wenn Seite 2 angezeigt wird, dann ist das Kästchen trotzdem nicht ausgewählt
- [ ] Angenommen Seite 2 ohne Unterschrift 2, wenn „Fertig“ angesehen wird, dann ist es gesperrt
- [ ] Angenommen Unterschrift 2 ohne Häkchen, wenn „Fertig“ geklickt wird, dann wird das Blatt gespeichert und am Gast wird keine Einwilligung gesetzt; eine frühere Einwilligung bleibt bestehen
- [ ] Angenommen Unterschrift 2 mit Häkchen, wenn „Fertig“ geklickt wird, dann steht am Gast „Marketing-Einwilligung erteilt am [heute], über Gästeblatt zu Buchung [Nummer]“
- [ ] Angenommen Seite 2, wenn „Zurück“ geklickt wird, dann erscheint Seite 1 mit erhaltener Unterschrift 1
- [ ] Angenommen „Fertig“ ist erfolgreich, wenn die Ansicht schließt, dann erscheint das Buchungsdetail mit „Gästeblatt gespeichert“ und „Unterschrieben am [Datum, Uhrzeit]“
- [ ] Angenommen ein gespeichertes Blatt, wenn „Gästeblatt ansehen“ geklickt wird, dann öffnet sich ein PDF mit Seite 1 (Meldedaten, Unterschrift 1) und Seite 2 (Datenschutz-Texte, Kästchen, Unterschrift 2), jeweils mit Datum und Uhrzeit
- [ ] Angenommen der Datenschutz-Text wird nach der Unterschrift in den Einstellungen geändert, wenn das alte Blatt angesehen wird, dann zeigt es den ursprünglichen Wortlaut
- [ ] Angenommen die Adresse des Gastes wird nach der Unterschrift geändert, wenn das Blatt angesehen wird, dann zeigt es die alte Adresse und die Buchung zeigt keinen Änderungshinweis
- [ ] Angenommen das Speichern bei „Fertig“ schlägt fehl, wenn die Meldung erscheint, dann bleibt die Ansicht mit beiden Unterschriften offen und nichts ist gespeichert
- [ ] Angenommen „Abbrechen“ wird bestätigt, wenn die Ansicht schließt, dann sind auf dem Blatt ergänzte Daten gespeichert, aber es gibt kein Gästeblatt

### Nachtrag Abreise und Änderungen
- [ ] Angenommen ein unterschriebenes Blatt, wenn an der Buchung die tatsächliche Abreise gespeichert wird, dann zeigt das PDF dieses Datum, unveränderte Unterschriften und „Abreise nachgetragen am [Datum] von [Name]“
- [ ] Angenommen ein unterschriebenes Blatt ohne tatsächliche Abreise, wenn der Tag der geplanten Abreise erreicht ist, dann zeigt das PDF die geplante Abreise als tatsächliche mit „(automatisch)“
- [ ] Angenommen ein unterschriebenes Blatt, wenn die Ankunft der Buchung verschoben oder ein Mitreisender hinzugefügt wird, dann zeigt die Buchung „Buchung nach der Unterschrift geändert“ und die Liste ein Warnzeichen
- [ ] Angenommen ein unterschriebenes Blatt, wenn die Buchung storniert wird, dann bleibt das Blatt erhalten und ist mit „Buchung storniert“ gekennzeichnet
- [ ] Angenommen ein hochgeladenes Blatt, wenn die tatsächliche Abreise gespeichert oder die Ankunft verschoben wird, dann bleibt das PDF unverändert und es erscheint kein Änderungshinweis

### Hochladen
- [ ] Angenommen der Dialog „Gästeblatt hochladen“, wenn eine PDF bis 10 MB mit Lfd.-Nr. gewählt wird, dann ist das Blatt als „hochgeladen“ an der Buchung gespeichert und die Lfd.-Nr. an der Buchung übernommen
- [ ] Angenommen eine JPG-Datei oder eine PDF über 10 MB, wenn hochgeladen wird, dann erscheint eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen ein Gast mit fehlendem Geburtsdatum, wenn ein Blatt hochgeladen wird, dann gelingt es ohne Prüfung der Pflichtfelder
- [ ] Angenommen das Häkchen „Marketing-Einwilligung liegt unterschrieben vor“ und Unterschrieben am 12.08.2025, wenn hochgeladen wird, dann steht am Gast „Einwilligung erteilt am 12.08.2025, über hochgeladenes Gästeblatt zu Buchung [Nummer]“
- [ ] Angenommen eine Buchung mit vorhandenem Blatt, wenn hochgeladen wird, dann erscheint „Bestehendes Gästeblatt ersetzen?“ und nach Bestätigung ist das alte „ersetzt“

### Menüpunkt „Gästeblätter“
- [ ] Angenommen Inhaber oder Mitarbeiter, wenn das Menü angezeigt wird, dann gibt es „Gästeblätter“
- [ ] Angenommen Gästeblätter im gewählten Monat, wenn die Liste angezeigt wird, dann zeigt sie Lfd.-Nr., Hauptgast, Ankunft, Abreise, Wohnung, Art, Marketing-Einwilligung, Hinweise und Link zur Buchung; Klick auf die Zeile öffnet das PDF
- [ ] Angenommen ein ersetztes Blatt, wenn die Liste angezeigt wird, dann erscheint es nicht
- [ ] Angenommen der Filter „Gästeblatt fehlt“, wenn er aktiv ist, dann erscheinen Buchungen mit Ankunft bis heute ohne Blatt, aber keine mit „Wohnsitz angemeldet“, Optionen, Sperren oder Stornos
- [ ] Angenommen eine Suche nach Nachname oder Lfd.-Nr., wenn sie eingegeben wird, dann zeigt die Liste nur passende Blätter
- [ ] Angenommen ein Kunde ohne Gästeblätter, wenn die Liste angezeigt wird, dann erscheint der Leertext
- [ ] Angenommen eine Person, die beim Kunden A Mitglied ist, wenn sie ein Gästeblatt von Kunde B über dessen Adresse aufruft, dann bekommt sie keinen Zugriff

### Einstellungen → Gästeblatt
- [ ] Angenommen ein Inhaber, wenn er Einstellungen öffnet, dann gibt es den Reiter „Gästeblatt“ nach „Zahlungen“; ein Mitarbeiter sieht ihn nicht
- [ ] Angenommen ein neuer Kunde, wenn der Reiter geöffnet wird, dann stehen die Standardtexte für Teil A und B darin
- [ ] Angenommen ein Text mit „{Gastname}“, wenn gespeichert wird, dann erscheint „Unbekannter Platzhalter: {Gastname}“ und nichts wird gespeichert
- [ ] Angenommen ein leerer Text, wenn gespeichert wird, dann erscheint „Bitte einen Text eingeben oder auf Standard zurücksetzen.“
- [ ] Angenommen in den Stammdaten fehlt die E-Mail, wenn die Vorschau angezeigt wird, dann erscheint der Hinweis „{E-Mail} ist in den Stammdaten nicht ausgefüllt“
- [ ] Angenommen ein geänderter Text, wenn „Auf Standard zurücksetzen“ bestätigt wird, dann steht wieder der Standardtext
- [ ] Angenommen Inhaber oder Betreiber, wenn die Stammdaten bearbeitet werden, dann gibt es die optionalen Felder „E-Mail“ und „Telefon“

### Aufbewahrung
- [ ] Angenommen ein Gast mit Gästeblatt, wenn er gelöscht werden soll, dann wird er nur anonymisiert und das Gästeblatt bleibt unverändert
- [ ] Angenommen eine Buchung mit Gästeblatt, wenn sie gelöscht werden soll, dann ist nur Stornieren möglich
- [ ] Angenommen ein Gästeblatt, wenn Inhaber oder Mitarbeiter es suchen, dann gibt es keinen Knopf zum Löschen

## Edge Cases
- **Zwei Geräte gleichzeitig**: Zwei Personen öffnen das Gästeblatt derselben Buchung. Wer zuerst „Fertig“ drückt, speichert; der zweite bekommt „Für diese Buchung wurde inzwischen ein Gästeblatt gespeichert.“ und kann wählen: verwerfen oder als neues Blatt speichern (ersetzt dann das erste).
- **Gleichzeitige Änderung am Gast**: Ändert jemand den Gast im Gastformular, während das Blatt offen ist, gilt beim Speichern eines Feldes die Regel aus PROJ-7 (Schutz vor Überschreiben, Meldung, Feld neu laden).
- **Verbindungsabbruch** beim Speichern eines Feldes: Feld markiert „Nicht gespeichert, erneut versuchen“; Unterschrift bleibt gesperrt, bis alles gespeichert ist.
- **Buchung während des Unterschreibens geändert** (z. B. Abreise verschoben): „Fertig“ friert den Stand beim Klick ein; ist er anders als angezeigt, Meldung „Die Buchung wurde inzwischen geändert. Bitte Seite 1 prüfen.“, Unterschrift 1 wird gelöscht.
- **Gast-Wechsel an der Buchung** nach Unterschrift → Hinweis „Buchung nach der Unterschrift geändert“; Marketing-Einwilligung bleibt beim ursprünglichen Gast.
- **Mehr Mitreisende als Personen − 1** (z. B. Personenzahl nachträglich verringert): Seite 1 zeigt „Mehr Mitreisende als Personen. Bitte die Buchung korrigieren.“; Unterschrift gesperrt.
- **Sehr lange Namen oder viele Mitreisende**: Seite 1 bricht sauber um; das PDF setzt Mitreisende bei Bedarf auf einer Folgeseite fort.
- **Staatsangehörigkeit nachträglich auf Österreich geändert**: Reisedokument-Bereich verschwindet; vorhandene Dokumentdaten bleiben am Gast, stehen aber nicht auf dem Blatt.
- **Anonymisierter Gast** an der Buchung: „Gästeblatt“ ist gesperrt („Der Gast wurde anonymisiert.“); Hochladen geht ohne Marketing-Häkchen.
- **Gast mit Kinderzahl 0 bei Buchung mit 1 Person**: kein Mitreisenden-Bereich nötig, Bereich zeigt „Keine Mitreisenden“.
- **Kundenwechsel** während die Vollbild-Ansicht offen ist (anderer Tab): Ansicht bleibt beim ursprünglichen Kunden; Speichern prüft die Zugehörigkeit.
- **Tatsächliche Abreise wieder geleert**: PDF zeigt wieder die geplante Abreise (automatisch, falls Tag erreicht) bzw. leeres Feld.

## Technical Requirements (optional)
- Sicherheit: Gästeblätter und hochgeladene PDFs nur für Mitglieder des Kunden lesbar (Mandantentrennung wie bei Reisedokument-Bildern); Unterschriften nur als Teil des Blatts gespeichert
- Unterschrift: Druck- und Stifteingabe ohne Scrollen oder Zoomen der Seite während des Schreibens (iPad Safari, Android Chrome)
- PDF: nach „Fertig“ innerhalb weniger Sekunden verfügbar; Gestaltung im Stil des Briefpapiers (PROJ-41)
- Browser: Safari (iPad), Chrome, Firefox, Edge; Tablet-Querformat als Hauptziel

## Open Questions
- [ ] Gibt es eine **Kennzahl** des Beherbergungsbetriebes? (Klärung mit einer Gemeinde; falls ja: Feld in den Kundenstammdaten, auf dem Blatt im Kopf)
- [ ] Wie wird die **Lfd.-Nr.** bei elektronischen Gästeverzeichnissen vergeben (fortlaufend, je Jahr, Format)? (Klärung mit der Gemeinde; danach automatische Vergabe per `/refine`)
- [ ] Ist das Gästeverzeichnis tatsächlich **7 Jahre** aufzubewahren, und gilt die Frist ab Abreise oder ab Jahresende? (vom Nutzer bestätigt, Detail offen)
- [ ] Wortlaut der **Standardtexte** Teil A/B: rechtliche Endprüfung durch den Nutzer
- [ ] Zweisprachiges Gästeblatt (Deutsch/Englisch) für ausländische Gäste – wann?
- [ ] Hinweis „Gästeblatt fehlt“ zusätzlich im Dashboard unter „Heute“ (wie „Rechnung fehlt“)?
- [ ] PIN-Sperre für die Vollbild-Ansicht nötig, wenn das Tablet unbeaufsichtigt beim Gast liegt?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Gästeblatt je Buchung, Hauptgast unterschreibt | Vom Nutzer so entschieden; Reisegruppen-Regel vorerst nicht anwendbar | 2026-11-08 |
| Kein Gästeblatt bei „Wohnsitz angemeldet“ | Diese Personen melden ihren Wohnsitz an, keine Gästemeldung | 2026-11-08 |
| Feld „Herkunftsland“ am Gast → „Staatsangehörigkeit“, Adress-Staat → „Herkunftsland“ | Begriffe wie auf dem amtlichen Formular; Daten passen bereits | 2026-11-08 |
| „Gästeherkunft“ nach Herkunftsland der Adresse, ersatzweise Staatsangehörigkeit | Tourismusstatistik zählt nach Wohnsitzland; Ersatz verhindert „unbekannt“ bei Altgästen | 2026-11-08 |
| Name des Beherbergungsbetriebes = Kundenname | Vom Nutzer so festgelegt | 2026-11-08 |
| Kennzahl und automatische Lfd.-Nr. vorerst nicht | Erst Klärung mit der Gemeinde; Nummer bleibt Handeingabe (PROJ-30) und ist auf dem Blatt editierbar | 2026-11-08 |
| Tatsächliche Abreise bei Unterschrift leer, später automatisch nachgetragen (ab geplantem Abreisetag die geplante) | Wie auf Papier; spart Arbeit (Variante B) | 2026-11-08 |
| Vollbild-Ansicht ohne Menü, ohne PIN | Gast sieht nur das Blatt; Vermieter steht im Pilot daneben | 2026-11-08 |
| „Neu unterschreiben lassen“ statt Bearbeiten; altes Blatt bleibt als „ersetzt“ | Unterschriebene Blätter sind Nachweise und bleiben unverändert | 2026-11-08 |
| Unterschrift 1 erst bei vollständigen Pflichtangaben laut Meldeformular; Reisedokument nur bei Nicht-Österreichern; Mitreisende vollständig | Meldegesetz; vollständige Blätter ohne Nacharbeit | 2026-11-08 |
| Ergänzte Daten beim Verlassen des Feldes speichern | Gehen beim Abbruch nicht verloren | 2026-11-08 |
| Teil A ist Information (Art. 13), keine Einwilligung; nur Teil B ist Einwilligung | Meldedaten beruhen auf gesetzlicher Pflicht/Vertrag; Einwilligung muss freiwillig sein | 2026-11-08 |
| Unterschrift 2 auch ohne Marketing-Häkchen; Kästchen nie vorausgewählt; leeres Kästchen widerruft nicht | Freiwilligkeit der Einwilligung; Widerruf gehört zu PROJ-19 | 2026-11-08 |
| Datenschutz-Texte je Kunde anpassbar mit Standardtext, Platzhaltern, eingefroren mit dem Blatt | Verantwortlicher ist je Kunde verschieden; Nachweis des zugestimmten Wortlauts | 2026-11-08 |
| Neue Stammdatenfelder E-Mail und Telefon | Kontakt des Verantwortlichen für die Datenschutz-Texte | 2026-11-08 |
| Nur Deutsch | Englisch ist Non-Goal; Umfang klein halten | 2026-11-08 |
| Ablage im privaten Speicher des Kunden; eigener Menüpunkt „Gästeblätter“ | „Dokumentenarchiv“ meint den Dateispeicher je Kunde; Liste für Kontrollen | 2026-11-08 |
| Keine Löschung von Hand, 7 Jahre Aufbewahrung, bleibt bei Anonymisierung | Aufbewahrungspflicht | 2026-11-08 |
| Hochladen nur PDF ≤ 10 MB, ohne Pflichtfeldprüfung, Marketing-Häkchen optional; wird nie ergänzt | Papierblatt ist schon vollständig; App kennt den Inhalt nicht | 2026-11-08 |
| Mitarbeiter dürfen auf dem Blatt Gastdaten ergänzen und korrigieren (nur Blatt-Felder) | Blatt wird oft ohne Inhaber bei der Schlüsselübergabe ausgefüllt; Protokoll „über Gästeblatt“ | 2026-11-08 |
| Nach Unterschrift: Hinweis bei geänderter Ankunft, Abreise, Hauptgast, Mitreisenden; nicht bei Gastdaten | Meldung gilt für den Zeitpunkt der Anreise | 2026-11-08 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Original-PDF bei „Fertig“ ablegen, Ansicht beim Öffnen aus eingefrorener Fassung erzeugen | Original bleibt mit Prüfsumme unverändert; Abreise-Nachtrag ohne nächtlichen Lauf und auch beim Leeren richtig | 2026-11-08 |
| Eingefrorene Fassung als zusammenhängende Kopie am Blatt | Wie bei ausgestellten Rechnungen (PROJ-42); spätere Änderungen an Gast, Buchung oder Texten wirken nicht | 2026-11-08 |
| Unterschriften als Bilder im privaten Speicher, nicht in der Datenbank | Hält die Tabelle klein; gleiches Muster wie Ausweisbilder und Belege samt Bereinigung | 2026-11-08 |
| Eigene Datenbankfunktion „ein Feld speichern“ für Inhaber und Mitarbeiter, nur Blatt-Felder | Mitarbeiter dürfen am Blatt ergänzen (Spec), ohne das allgemeine Gast-Bearbeitungsrecht zu öffnen | 2026-11-08 |
| Fertigstellen nur über eine Server-Schnittstelle, Schreibschritt nur für den Server | Niemand kann ein Blatt mit fremdem PDF oder fremden Unterschriften festschreiben (wie PROJ-42) | 2026-11-08 |
| Höchstens ein aktuelles Blatt je Buchung, in der Datenbank erzwungen; Bezug aufs bisherige Blatt beim Fertigstellen | Sichere Behandlung von zwei Geräten gleichzeitig | 2026-11-08 |
| Abreise-Nachtrag (Datum, Person) schreibt die Datenbank selbst beim Speichern der Buchung | Gilt unabhängig davon, wo die Abreise gesetzt wird (Formular, Kalender, später Import) | 2026-11-08 |
| Umbenennung nur in den Beschriftungen, keine Spaltenänderung | Daten passen bereits; kein Risiko für bestehende Funktionen | 2026-11-08 |
| Paket signature_pad | Bewährte Stift- und Fingereingabe mit Glättung, klein, MIT; Eigenbau in iPad-Safari fehleranfällig | 2026-11-08 |
| Datenschutz-Texte in eigener Einstellungs-Tabelle je Kunde, leer = Standardtext | Standardtext bleibt in der App änderbar; Muster wie Rechnungs-Einstellungen | 2026-11-08 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **PDF-Erzeugung** mit eigenem Arbeitsprozess, lokalen Schriften und Briefpapier-Gestaltung (PROJ-41/42, auch für Ortstaxe- und Auswertungs-PDFs genutzt).
- **Private Speicherbereiche je Kunde** mit zufälligen Dateinamen, Lesezugriff nur für Mitglieder, direktem Hochladen über eine einmalige Freigabe des Servers und **täglicher Bereinigung** unbenutzter Dateien (Ausweisbilder, Rechnungs-PDFs, Logos, Belege).
- **Einstellungen je Kunde** für Rechnungen mit Texteditor, Platzhaltern, Vorschau und „Auf Standard zurücksetzen“ (PROJ-39).
- **Änderungsprotokoll** mit Angabe der Quelle (bisher z. B. für Datenumstellungen genutzt).
- **Gast- und Buchungsprüfregeln** (Geburtsdatum, Längen, Reisedokument, Mitreisende) und die PLZ-Automatik.

### Ablauf
```
Buchungsdetail → „Gästeblatt“
  |
  v
Vollbild-Seite lädt Buchung, Gast, Mitreisende, Stammdaten, Datenschutz-Texte
  |
  v
Seite 1: Feld verlassen → Server speichert genau dieses Feld (Gast oder Buchung)
         Pflichtangaben vollständig → Unterschrift 1 → „Weiter“
  |
  v
Seite 2: Texte A/B, Kästchen, Unterschrift 2 → „Fertig“
  |
  v
Server: 1. prüft Anmeldung, Mitgliedschaft, Buchungsart, Pflichtangaben
        2. vergleicht den angezeigten Stand mit dem aktuellen (Buchung, Gast, Mitreisende, vorhandenes Blatt)
        3. erzeugt das PDF aus der eingefrorenen Fassung
        4. legt PDF und beide Unterschriftsbilder unter zufälligem Namen ab
        5. Datenbank in einem einzigen Schritt: Blatt schreiben, altes als „ersetzt“ markieren,
           ggf. Marketing-Einwilligung am Gast, Protokoll
  |
  +-- gelingt   → zurück zur Buchung, „Gästeblatt gespeichert“
  +-- scheitert → Dateien entfernt (sonst tägliche Bereinigung), Ansicht bleibt mit Unterschriften offen
```

### Seiten und Bausteine der Oberfläche
```
Buchungsdetail (besteht)
+-- Abschnitt „Gästeblatt“ (neu)
    +-- Status, Lfd.-Nr., Marketing ja/nein, Hinweise („nach der Unterschrift geändert“, „storniert“)
    +-- Knöpfe „Gästeblatt“ / „Gästeblatt ansehen“ / „Neu unterschreiben lassen“ / „Gästeblatt hochladen“
    +-- Frühere Gästeblätter (aufklappbar)
    +-- Dialog „Gästeblatt hochladen“ (PDF, Lfd.-Nr., Unterschrieben am, Marketing-Häkchen)

Vollbild-Seite „Gästeblatt“ (neu, eigener Seitenrahmen ohne App-Menü)
+-- Kopf: Kundenname, Fortschritt „1 Meldedaten · 2 Datenschutz“
+-- Seite 1 „Meldedaten“
|   +-- Kopf: Lfd.-Nr. (bearbeitbar)
|   +-- Hauptgast: Familienname, Vorname, Geschlecht, Geburtsdatum, Staatsangehörigkeit
|   +-- Reisedokument (nur bei Staatsangehörigkeit ≠ Österreich)
|   +-- Adresse und Herkunftsland (mit PLZ-Automatik)
|   +-- Mitreisende (Liste, „Mitreisende hinzufügen“)
|   +-- Aufenthalt: Ankunft, voraussichtliche/tatsächliche Abreise (nur lesen)
|   +-- Unterschriftsfeld 1 mit „Unterschrift löschen“
+-- Seite 2 „Datenschutz“
|   +-- Teil A (Text), Teil B (Text + Kästchen)
|   +-- Unterschriftsfeld 2 mit „Unterschrift löschen“
+-- Fußleiste: „Abbrechen“ (Rückfrage), „Zurück“, „Weiter“ / „Fertig“

Menüpunkt „Gästeblätter“ (neu)
+-- Monatsauswahl wie Buchungsübersicht, Suche, Umschalter „Gästeblatt fehlt“
+-- Tabelle (ohne Overlay-Link auf der Zeile, Safari-Regel)
+-- Leerzustand

Einstellungen → Reiter „Gästeblatt“ (neu, nur Inhaber)
+-- Teil A und Teil B: Editor aus PROJ-39, Platzhalter einfügen, Vorschau, „Auf Standard zurücksetzen“

Einstellungen → Stammdaten (besteht)
+-- neue Felder E-Mail, Telefon

Gastformular, Gast-Detail, Gästeliste, Zusammenführen, Auswertung (bestehen)
+-- nur Bezeichnungen „Staatsangehörigkeit“ / „Herkunftsland“; Gästeherkunft mit neuer Regel
```

Das Unterschriftsfeld ist ein eigener Baustein. Es nimmt Stift, Finger und Maus an, sperrt dabei das Scrollen und Zoomen der Seite und liefert ein Bild mit transparentem Hintergrund. Eine Unterschrift unter einer Mindestlänge des Strichs gilt als leer.

### Datenmodell (in Worten)

**Neu: Gästeblatt** (eine Zeile je Blatt, auch ersetzte)
- Kunde, Buchung, Hauptgast zum Zeitpunkt der Unterschrift
- Art: „unterschrieben“ oder „hochgeladen“
- Ersetzt am, ersetzt durch (leer = aktuelles Blatt; je Buchung höchstens ein aktuelles Blatt, in der Datenbank erzwungen)
- Lfd.-Nr. zum Zeitpunkt der Unterschrift bzw. des Hochladens
- Marketing-Einwilligung ja/nein
- Erstellt am, erstellt von
- *Nur „unterschrieben“:* **eingefrorene Fassung** (alle Angaben von Seite 1, Kundenname, beide Datenschutz-Texte im Wortlaut mit ersetzten Platzhaltern, Zustand des Kästchens), Zeitpunkt Unterschrift 1 und 2, Speicherort der beiden Unterschriftsbilder, Speicherort und Prüfsumme des **Original-PDFs**, Nachtrag der Abreise (Datum, eingetragen am, eingetragen von bzw. „automatisch“)
- *Nur „hochgeladen“:* Speicherort der PDF, Unterschrieben am (optional)

**Neu: Einstellungen Gästeblatt** je Kunde
- Text Teil A, Text Teil B (leer = Standardtext der App; „Auf Standard zurücksetzen“ leert das Feld)

**Erweitert: Gast**
- Marketing-Einwilligung erteilt am, über welches Gästeblatt (Verweis). PROJ-19 baut darauf auf (Widerruf, Verlauf).

**Erweitert: Kunde (Stammdaten)**
- E-Mail, Telefon (optional)

**Unverändert:** Die Spalten für Staatsangehörigkeit und Adress-Staat bleiben, nur die Beschriftung ändert sich. Es ist keine Datenmigration nötig.

**Speicher:** neuer privater Bereich „Gästeblätter“ je Kunde für PDFs und Unterschriftsbilder (nur PDF und PNG, PDF bis 10 MB). Lesen nur für Mitglieder des Kunden. Ändern und Löschen sind für Nutzer gesperrt. Die tägliche Bereinigung entfernt nur Dateien, auf die kein Gästeblatt zeigt.

### Nachtrag der tatsächlichen Abreise
Das **Original-PDF** wird bei „Fertig“ abgelegt und danach nie verändert. Es ist der Nachweis mit Prüfsumme.

„Gästeblatt ansehen“ erzeugt das PDF **beim Öffnen** aus der eingefrorenen Fassung und setzt dabei die tatsächliche Abreise ein:
- **Gesetzt:** Ist die tatsächliche Abreise an der Buchung gesetzt, steht der Vermerk „nachgetragen am … von …“ dabei. Datum und Person schreibt die Datenbank automatisch an das Blatt, sobald jemand die tatsächliche Abreise an der Buchung speichert, ändert oder leert.
- **Leer:** Ist die tatsächliche Abreise leer und der geplante Abreisetag erreicht, erscheint die geplante Abreise mit „(automatisch)“.

Das hat drei Vorteile:
- Es braucht keinen nächtlichen Lauf, der PDFs neu schreibt.
- Das Blatt ist immer aktuell, auch wenn die Abreise wieder geleert wird.
- Das Original bleibt unberührt.

Unterschriften und alle übrigen Angaben kommen ausschließlich aus der eingefrorenen Fassung.

### Regeln an einer Stelle
- **Pflichtangaben-Regel:** Eine einzige Regel ermittelt aus Gast, Buchung und Mitreisenden die fehlenden Felder. Sie nutzt die bestehenden Prüfregeln des Gast- und Buchungsformulars. Die Vollbild-Seite und „Fertig“ auf dem Server verwenden dieselbe Regel.
- **Änderungs-Regel:** Sie vergleicht die eingefrorene Fassung mit der aktuellen Buchung: Ankunft, voraussichtliche Abreise, Hauptgast, Mitreisende. Daraus ergibt sich der Hinweis „Buchung nach der Unterschrift geändert“, in der Buchung wie in der Liste.
- **Gästeblatt vorgesehen?** Die Regel lautet: Art „Buchung“, nicht storniert, ohne „Wohnsitz angemeldet“. Knopf, Abschnitt und Filter „Gästeblatt fehlt“ nutzen dieselbe Regel.
- **Platzhalter:** Die Ersetzungsregel aus PROJ-39 wird um die Gästeblatt-Platzhalter erweitert, ohne die Rechnungs-Platzhalter zu berühren.

### Speichern einzelner Felder auf Seite 1
- Eine eigene Datenbankfunktion speichert **ein Feld** an Gast oder Buchung bzw. die Mitreisenden. Sie ist für Inhaber **und Mitarbeiter** freigegeben, aber nur für die Felder des Blatts. Das übrige Bearbeitungsrecht am Gast bleibt beim Inhaber (PROJ-7).
- Gegen Überschreiben schützt der Zeitstempel des Datensatzes, wie bei PROJ-7. Bei einem Konflikt lädt das Feld neu und zeigt eine Meldung.
- Im Änderungsprotokoll stehen diese Änderungen mit der Quelle „Gästeblatt“.
- Der Server zählt bei jedem gespeicherten Feld den „Stand“ hoch. Bei „Fertig“ schickt die Seite den zuletzt gesehenen Stand mit. Weicht er ab, weil jemand anderes etwas geändert hat, wird Unterschrift 1 verworfen (Edge Case „Buchung während des Unterschreibens geändert“).

### Gleichzeitiges Fertigstellen
„Fertig“ schickt mit, welches Blatt beim Öffnen aktuell war, gegebenenfalls „keines“. Ist inzwischen ein anderes Blatt aktuell, lehnt die Datenbank ab. Die Seite bietet dann „Verwerfen“ oder „Als neues Blatt speichern“ an. Im zweiten Fall wiederholt sie das Speichern mit dem neuen Bezug.

### Löschschutz und Anonymisieren
- **Gästeblätter:** Nutzer können Zeilen und Dateien weder ändern noch löschen. Einzige Ausnahmen sind der Abreise-Nachtrag und das Markieren als „ersetzt“ durch die Datenbank selbst.
- **Gast löschen:** Die bestehende Funktion zählt Gästeblätter wie Rechnungen. Mit Gästeblatt wird nur anonymisiert. Das Anonymisieren entfernt die Marketing-Einwilligung am Gast und lässt die Gästeblätter unverändert.
- **Buchung löschen:** Die bestehende Löschfunktion lehnt ab, wenn ein Gästeblatt existiert. Es bleibt nur das Stornieren.
- **Gäste zusammenführen:** Die jüngste Marketing-Einwilligung bleibt. Gästeblätter bleiben an ihren Buchungen.
- **Kunde löschen (Betreiber):** Wie bei Rechnungen gesperrt, solange ein Gästeblatt in der 7-Jahres-Frist liegt.

### Rechte
- **Lesen:** alle Mitglieder des Kunden, für Blätter, Dateien und Einstellungen. Bearbeiten dürfen die Einstellungen nur Inhaber.
- **Fertigstellen und Hochladen:** nur über den Server. Den Schreibschritt in der Datenbank darf nur der Server ausführen, damit niemand ein Blatt mit fremdem PDF oder fremden Unterschriften festschreiben kann.
- Die Vollbild-Seite liegt im angemeldeten Bereich. Der Kunde wird beim Öffnen festgehalten, ein Kundenwechsel in einem anderen Tab ändert ihn nicht. Die Mitgliedschaft wird bei jedem Speichern geprüft.

### Schnittstellen
- **Fertigstellen:** eigene Schnittstelle unter `/api/gaesteblatt/…`. Sie nimmt beide Unterschriftsbilder, das Kästchen, die Lfd.-Nr., den Stand und das bisherige Blatt entgegen.
- **Ansehen:** eigene Schnittstelle, liefert das PDF mit eingesetzter Abreise. Ersetzte Blätter werden gleich behandelt.
- **Hochladen:** Der Server erteilt eine einmalige Freigabe, die Datei geht direkt in den Speicher, danach registriert eine Server-Aktion das Blatt. Das ist dasselbe Muster wie bei Rechnungs-PDFs.
- **Feld speichern, Einstellungen, Liste:** Server-Aktionen bzw. Lesefunktionen wie im übrigen Projekt.

### Auswertung „Gästeherkunft“ (PROJ-18)
Die Lesefunktion der Auswertung nimmt das Herkunftsland der Adresse des Hauptgasts und ersatzweise die Staatsangehörigkeit. Bildschirm, PDF und CSV ändern sich damit gemeinsam. Der Hinweistext wird angepasst.

### Abhängigkeiten
- **signature_pad** (MIT, ohne weitere Abhängigkeiten): glatte Striche für Stift, Finger und Maus auf einer Zeichenfläche, Ausgabe als Bild. Ein Eigenbau wäre möglich, die Glättung und die Stifteingabe in Safari auf dem iPad sind aber fehleranfällig.

### Für /frontend und /backend
- **/frontend:**
  - Vollbild-Seite mit Unterschriftsfeld, Pflichtangaben-Regel und Änderungs-Regel
  - Abschnitt in der Buchung, Hochladen-Dialog, Menüpunkt mit Liste
  - Einstellungen-Reiter, Stammdatenfelder, alle Umbenennungen
  - PDF-Vorlage „Gästeverzeichnisblatt“ nach `docs/design/gaesteblatt-leer.png`
  - Solange das Backend fehlt, melden die schreibenden Aktionen „wird eingerichtet“.
- **/backend:**
  - Tabellen und Felder, Speicherbereich, Bereinigung
  - Feld-Speicherfunktion mit Mitarbeiter-Recht, Schreibfunktion „Fertig“, Abreise-Nachtrag
  - Löschsperren, Anonymisieren und Zusammenführen
  - Auswertung, Schnittstellen

### Für /qa
- iPad Safari mit Stift: kein Scrollen beim Unterschreiben, Querformat und Hochformat
- Zwei Geräte gleichzeitig; Änderung der Buchung, während das Blatt offen ist
- Mitarbeiter: speichert Blatt-Felder, aber keine anderen Gastfelder (auch nicht direkt an der Oberfläche vorbei)
- Zugriff auf Blätter und Dateien eines fremden Kunden
- Abreise-Nachtrag: setzen, ändern, leeren, automatisch ab dem Abreisetag
- Löschsperren für Gast, Buchung und Kunde; Anonymisieren mit Blatt
- Original-PDF und Prüfsumme bleiben unverändert

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
