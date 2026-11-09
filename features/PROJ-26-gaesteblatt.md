# PROJ-26: Gästeblatt (Meldewesen)

## Status: In Progress
**Created:** 2026-11-08
**Last Updated:** 2026-11-09 (refine: Liste „Gästeblätter“ überarbeitet; Kennzahl und Gästeblattnummer je Gemeinde live seit v1.45.0)

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
- Requires: PROJ-6 (Wohnungsverwaltung): Gemeinde des Objekts bestimmt Kennzahl und Nummernbereich
- Wirkt mit: PROJ-14 (Dashboard): Hinweis „Gästeblattnummern“ (Erweiterung 2026-11-09)
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
| Kopf | Lfd.-Nr. | automatisch beim „Fertig“ bzw. nacherfasste Nummer der Buchung, nur lesen (siehe Erweiterung 2026-11-09) | – |
| Kopf | Kennzahl | Kennzahl des Kunden für die Gemeinde der Buchung, nur lesen (siehe Erweiterung 2026-11-09) | nein |
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
- Dialog „Gästeblatt hochladen“: Datei (nur **PDF**, höchstens **10 MB**, eine Datei), **Lfd.-Nr.** (seit Erweiterung 2026-11-09: nur lesbar aus der Buchung, kein Eingabefeld mehr), **Unterschrieben am** (Datum, optional, nicht in der Zukunft), Häkchen **„Marketing-Einwilligung liegt unterschrieben vor“** (nicht vorausgewählt).
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
- ~~Automatische Vergabe der Lfd.-Nr.~~ und ~~Kennzahl~~ → aufgenommen in der Erweiterung 2026-11-09
- Nummernformate ohne Ziffern am Ende; Neubeginn je Jahr; Nummernvergabe beim Hochladen
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
- [x] Gibt es eine **Kennzahl** des Beherbergungsbetriebes? → Ja, je Kunde und Gemeinde, fix; in den Stammdaten je Gemeinde, auf dem Blatt im Kopf (2026-11-09)
- [x] Wie wird die **Lfd.-Nr.** vergeben? → Je Kunde und Gemeinde fortlaufend aus von der Gemeinde zugeteilten Nummernbereichen, Text mit Ziffern am Ende, ohne Jahreswechsel (2026-11-09)
- [ ] Ist das Gästeverzeichnis tatsächlich **7 Jahre** aufzubewahren, und gilt die Frist ab Abreise oder ab Jahresende? (vom Nutzer bestätigt, Detail offen)
- [ ] Wortlaut der **Standardtexte** Teil A/B: rechtliche Endprüfung durch den Nutzer
- [ ] Zweisprachiges Gästeblatt (Deutsch/Englisch) für ausländische Gäste – wann?
- [ ] Hinweis „Gästeblatt fehlt“ zusätzlich im Dashboard unter „Heute“ (wie „Rechnung fehlt“)?
- [ ] PIN-Sperre für die Vollbild-Ansicht nötig, wenn das Tablet unbeaufsichtigt beim Gast liegt?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Liste „Gästeblätter“ nach Gästeblattnummer absteigend, Voreinstellung „Alle Monate“, Filter Wohnung | Vollständiges, lückenlos prüfbares Verzeichnis für Kontrollen (refine 2026-11-09) | 2026-11-09 |
| Hauptliste = Buchungen mit Gästeblattnummer, auch ohne PDF; Nummer als Link zum PDF statt eigenem Knopf | Nacherfasste Nummern ohne Scan sollen sichtbar sein | 2026-11-09 |
| Hauptgast verlinkt die Gastseite; Spalten Marketing/Hinweise entfallen | Vom Nutzer so gewünscht | 2026-11-09 |
| Stornierte Buchungen in keiner Liste | Ein stornierter Gast reist nicht an und unterschreibt kein Blatt | 2026-11-09 |
| „nacherfasst“ statt „hochgeladen“ als Art | Einheitlich mit „Gästeblätter nacherfassen“ | 2026-11-09 |
| Filter „Buchungen ohne Gästeblatt“ = ohne Nummer, ab Ankunftstag | Künftige Buchungen sind noch nicht fällig | 2026-11-09 |
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
| Kennzahl je Kunde und Gemeinde in den Stammdaten, optional, Text bis 30 Zeichen; mit dem Blatt eingefroren | Von der Gemeinde so vergeben (Klärung 2026-11-09); fehlende Kennzahl darf die Meldung nicht blockieren | 2026-11-09 |
| Lfd.-Nr. als Text; weitergezählt werden die Ziffern am Ende mit gleicher Stellenzahl | Andere Gemeinden könnten Buchstaben verwenden; führende Nullen wie im Formularbuch | 2026-11-09 |
| Nummer erst beim „Fertig“ vergeben; „Neu unterschreiben“ behält die Nummer; nacherfasste Nummer der Buchung hat Vorrang | Keine Lücken durch abgebrochene Blätter; neue Unterschrift ist dieselbe Meldung | 2026-11-09 |
| Mehrere Nummernbereiche je Gemeinde, nacheinander verbraucht, automatischer Sprung | Gemeinde teilt Blöcke zu; neuer Block soll vor dem Aufbrauchen erfasst werden können | 2026-11-09 |
| Ohne freie Nummer ist der Knopf „Gästeblatt“ gesperrt; Frühwarnung ab 10 freien Nummern (über alle Bereiche) in Einstellungen, Buchungsdetail und Dashboard | Gast soll nicht am Tablet scheitern; rechtzeitig neuen Bereich anfordern | 2026-11-09 |
| Handeingabe der Nummer nur mit „Gästeblätter nacherfassen“, doppelte Nummer nur Hinweis | Vom Nutzer so entschieden; Altbestand kann Doppelte enthalten | 2026-11-09 |
| „Gästeblatt hochladen“ nur mit „Gästeblätter nacherfassen“, ohne eigenes Nummernfeld | Nummer wird an der Buchung nacherfasst, Hochladen ist Nacherfassen | 2026-11-09 |
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
| Kennzahlen und Nummernbereiche als eigene Tabellen je Kunde und Gemeinde | Mehrere Bereiche je Gemeinde mit Verlauf; Kennzahl bleibt ohne Objekt erhalten | 2026-11-09 |
| Stand des Bereichs berechnet (erster offener = in Verwendung) statt gespeichert | Es kann nie zwei laufende Bereiche geben; Reihenfolge = Eingabe | 2026-11-09 |
| Nummernvergabe in einer Datenbankfunktion mit Sperre, nur vom Server, vor dem PDF | Keine doppelten Nummern bei zwei Tablets; Nummer muss im PDF stehen | 2026-11-09 |
| Vergebene Nummer bleibt an der Buchung, auch wenn das Fertigstellen danach scheitert | Erneutes „Fertig“ nutzt sie; keine Lücken | 2026-11-09 |
| Nummernregel doppelt: App-Baustein für Prüfung/Vorschau, Datenbank maßgeblich, gemeinsame Testfälle | Sofortige Rückmeldung im Formular, Sicherheit beim Speichern | 2026-11-09 |
| Freie Nummern per Zählung statt Aufzählung | Auch große Bereiche (z. B. 1–999999) bleiben schnell | 2026-11-09 |
| „Gästeblattnummer“ nicht mitgeschickt = unverändert | Schalter aus darf vorhandene Nummern nicht löschen | 2026-11-09 |
| Schalter „Gästeblätter nacherfassen“ als Spalte am Kunden | Gleiches Muster wie „Rechnungen nacherfassen“ | 2026-11-09 |

---
<!-- Sections below are added by subsequent skills -->

## Nachbesserung nach dem Deploy (refine 2026-11-09)

Rückmeldung vom ersten Einsatz am iPad (Bilder `docs/design/iPad-Gaesteblatt_01.png`, `_02.png`).

### Regeln
- **Layout am iPad:** Datumsfelder sind genau so breit und hoch wie ihre Spalte, Text links (Safari zeichnete sie breiter und höher, sie überdeckten das Nachbarfeld). Kopf- und Fußleiste des Blatts sind deckend, nichts scheint durch. Gilt für alle Datumsfelder der App.
- **Fehlende Angaben rot umrandet:** Jedes fehlende Pflichtfeld hat einen deutlichen roten Rahmen (auch PLZ, Ortsgemeinde und die Länderauswahl), der Hinweis „Bitte ergänzen“ steht fett in Rot.
- **Ausweisbilder auf dem Blatt:** Ist die Staatsangehörigkeit nicht Österreich und fehlt am Gast ein Bild (Vorder- oder Rückseite), bietet der Bereich „Reisedokument“ die fehlende Seite zum Aufnehmen (Kamera) oder Auswählen an. Freiwillig, nicht Pflicht. Gespeichert am Gast mit dem Reisedokument, sobald Art und Nummer eingetragen sind. Schon hinterlegte Bilder werden auf dem Blatt nicht angezeigt.
- **E-Mail auf Seite 2:** Hat der Hauptgast beim Öffnen keine E-Mail, steht unter der Marketing-Einwilligung das Feld „E-Mail-Adresse“. Freiwillig, auch ohne Häkchen; Prüfung wie im Gastformular; beim Verlassen des Felds am Gast gespeichert. Eine vorhandene E-Mail lässt sich über das Blatt nicht ändern (auch die Datenbank lehnt das ab). Die E-Mail steht nicht auf dem PDF.

### Acceptance Criteria
- [x] Angenommen ein iPad, wenn Seite 1 angezeigt wird, dann überdecken Datumsfelder keine Nachbarfelder und Kopf-/Fußleiste sind deckend
- [x] Angenommen fehlendes Geburtsdatum, PLZ, Ort und Herkunftsland, wenn Seite 1 angezeigt wird, dann sind diese Felder rot umrandet, vollständige nicht
- [x] Angenommen ein deutscher Gast ohne Ausweisbilder, wenn Seite 1 angezeigt wird, dann gibt es „Bilder des Reisedokuments“ mit Vorder- und Rückseite; bei einem österreichischen Gast nicht
- [x] Angenommen ein Gast ohne E-Mail, wenn auf Seite 2 eine gültige E-Mail eingetragen und das Feld verlassen wird, dann ist sie in Kleinbuchstaben am Gast gespeichert; eine ungültige zeigt eine Meldung
- [x] Angenommen ein Gast mit E-Mail, wenn Seite 2 angezeigt wird, dann gibt es kein E-Mail-Feld

### Umsetzung
- `globals.css`: Datumsfelder ohne Safari-Eigenaussehen, `min-width: 0`, Text links
- `sheet-page-one.tsx`: roter Rahmen `border-2 border-red-600`, Länderauswahl mit roter Umrandung, PLZ/Ort über neue Option `inputClassNames` von `PostalPlaceFields`; Ausweisbilder mit dem Baustein aus PROJ-29 (`DocumentImageField`); Rasterspalten `min-w-0`
- `sheet-page-two.tsx`: Feld „E-Mail-Adresse“; gespeichert über `saveSheetGuest` in derselben Warteschlange wie Seite 1
- `guest-sheet.ts`: `documentFrontPath`/`documentBackPath` als freiwillige Dokumentfelder; `validation/guest-sheet.ts`: `sheetEmailSchema`, Bildpfade
- Migration `20261109081035_guest_sheets_email_images.sql` (in Dev): `save_guest_sheet_field` nimmt `document_front_path`, `document_back_path` und `email` (nur bei leerer E-Mail)
- Tests: Integration 16 (neu: E-Mail nur bei leerer Adresse, Bild über das Blatt), E2E „Nachbesserung nach dem Deploy“ (3 Tests); alle 23 Gästeblatt-E2E-Tests, 966 Unit-Tests, Lint und Build grün. Auf Staging am iPad vom Nutzer geprüft

## Erweiterung: Kennzahl und Gästeblattnummer je Gemeinde (refine 2026-11-09)

Klärung mit der Gemeinde: Kennzahl und laufende Gästeblattnummer werden **je Kunde und je Gemeinde** vergeben. **Gemeinde** ist immer die Gemeinde des Objekts der Wohnung der Buchung (PROJ-6).

### Regeln

#### Kennzahl (Einstellungen → Stammdaten)
- Neuer Abschnitt **„Kennzahlen je Gemeinde“**: je Gemeinde, in der der Kunde mindestens ein Objekt hat, eine Zeile „[Gemeinde] ([Gemeindekennziffer])“ mit Textfeld **„Kennzahl“**.
- Format: Buchstaben, Ziffern, `-`, `/`, `.`, höchstens 30 Zeichen; führende Nullen bleiben erhalten. **Optional.** Fehlt sie, Hinweis „Kennzahl fehlt – wird auf dem Gästeblatt leer gedruckt“.
- Bearbeiten: Inhaber und Betreiber (wie übrige Stammdaten).
- Hat der Kunde in einer Gemeinde kein Objekt mehr, wird die Zeile ausgeblendet; die Kennzahl bleibt gespeichert und erscheint wieder, sobald dort ein Objekt angelegt wird.
- Auf dem Blatt (Seite 1, Kopf) und im PDF: Kennzahl der Gemeinde der Buchung, nur lesen. Unterschriebene Blätter behalten die Kennzahl vom Zeitpunkt der Unterschrift.

#### Nummernformat
- Die Gästeblattnummer ist **Text** (Buchstaben, Ziffern, `-`, `/`, `.`, höchstens 30 Zeichen) und muss für die automatische Vergabe **mit einer Ziffer enden**.
- **Weiterzählen:** Die Ziffern am Ende werden um 1 erhöht, die Stellenzahl mit führenden Nullen bleibt, der Vorsatz davor bleibt unverändert: `0042` → `0043`, `A-0099` → `A-0100`, `9999` → `10000`.
- Kein Neubeginn je Jahr.
- Gleichheit: Groß-/Kleinschreibung zählt gleich (`a-0042` = `A-0042`), führende Nullen zählen mit (`042` ≠ `0042`).

#### Nummernbereiche (Einstellungen → Gästeblatt)
- Neuer Abschnitt **„Laufende Nummer je Gemeinde“** (Inhaber, Betreiber): je Gemeinde mit Objekten eine Tabelle der **Nummernbereiche** mit „von“, „bis“, „Nächste Nummer“ und „Stand“, dazu Knopf **„Nummernbereich hinzufügen“**.
- **Stand:**
  - **In Verwendung**: genau ein Bereich, aus dem vergeben wird; „Nächste Nummer“ änderbar, muss im Bereich liegen.
  - **Folgt**: weitere, vorab erfasste Bereiche (beliebig viele), in der Reihenfolge der Eingabe; beginnen mit ihrer „von“-Nummer.
  - **Aufgebraucht**: „bis“ wurde vergeben; bleibt zur Nachvollziehbarkeit sichtbar, nur lesen.
- Ist die „bis“-Nummer des laufenden Bereichs vergeben, nimmt das **nächste Blatt automatisch die „von“-Nummer des nächsten Bereichs**.
- Prüfungen beim Speichern: „von“ und „bis“ mit gleichem Vorsatz und Ziffern am Ende, „von“ ≤ „bis“; Bereiche derselben Gemeinde dürfen sich nicht überschneiden (verschiedene Vorsätze je Bereich erlaubt).
- Ändern/Löschen: folgender Bereich frei änderbar und löschbar; beim Bereich in Verwendung nur „bis“ (nicht unter die zuletzt vergebene Nummer) und „Nächste Nummer“; aufgebrauchte nur lesen.
- Neu erfasster erster Bereich: „Nächste Nummer“ = „von“, sofern nicht anders eingetragen.
- Ohne Bereich: Gemeinde mit „Nummernbereich noch nicht festgelegt“ markiert.

#### Vergabe
- Die Nummer wird **beim „Fertig“** vergeben (nicht beim Öffnen). Bis dahin steht auf Seite 1 bei „Lfd.-Nr.“ nur lesbar „wird beim Abschluss vergeben“.
- Ist die nächste Nummer bereits an einer anderen Buchung derselben Gemeinde vergeben (z. B. nacherfasst), wird sie **übersprungen** und die nächste wirklich freie genommen.
- Danach steht die Nummer an der Buchung, im PDF, im Buchungsdetail und in der Liste „Gästeblätter“ und ist **nicht mehr änderbar** (außer per Nacherfassen an der Buchung, siehe unten).
- **„Neu unterschreiben lassen“**: Das neue Blatt behält die Nummer des ersetzten, kein neuer Verbrauch.
- **Buchung hat schon eine Nummer** (nacherfasst): Das Blatt übernimmt sie, der Zähler bleibt unverändert.
- Wechselt eine Buchung mit Nummer später Wohnung bzw. Gemeinde, behält sie ihre Nummer.

#### Keine Nummer verfügbar und Frühwarnung
- **Frühwarnung:** Sind in einer Gemeinde über alle Bereiche (laufender + folgende) nur noch **10 oder weniger** Nummern frei: „Nur noch [n] Nummern frei“.
- **Keine Nummer verfügbar** (kein Bereich oder alle aufgebraucht): Hinweis „Kein Nummernbereich für [Gemeinde] – bitte in Einstellungen → Gästeblatt festlegen“ bzw. „Nummernbereich für [Gemeinde] aufgebraucht“; der Knopf **„Gästeblatt“ in der Buchung ist gesperrt**. Hat die Buchung bereits eine Nummer, ist er nicht gesperrt.
- Hinweise erscheinen in Einstellungen → Gästeblatt, im Buchungsdetail (Abschnitt „Gästeblatt“) und auf dem **Dashboard**.
- **Dashboard (PROJ-14):** Hinweisblock **„Gästeblattnummern“** unter den Kacheln, in Warnfarbe, nur wenn es etwas zu melden gibt; je Zeile **immer mit Kundenname** und Gemeinde, z. B. „Kunde A · Bad Ischl (40702): nur noch 7 Nummern frei“, „… Nummernbereich aufgebraucht“, „… Nummernbereich noch nicht festgelegt“.
  - Nur Gemeinden mit mindestens einer nicht archivierten Wohnung des Kunden.
  - Sichtbar für Inhaber und Mitarbeiter des jeweiligen Kunden; folgt dem Kundenfilter.
  - Für Inhaber führt die Zeile zu Einstellungen → Gästeblatt (mit Wechsel zum Kunden wie andere Dashboard-Zeilen); für Mitarbeiter nur Text.
  - Erscheint auch bei eingeschaltetem „Gästeblätter nacherfassen“.

#### „Gästeblätter nacherfassen“ (Einstellungen → Gästeblatt)
- Schalter wie „Rechnungen nacherfassen“ (Inhaber, Betreiber).
- **Ein:** Im Buchungsformular gibt es das Feld **„Gästeblattnummer“** (Handeingabe, Hinweis bei doppelter Nummer in derselben Gemeinde, **kein** Blockieren); im Buchungsdetail gibt es **„Gästeblatt hochladen“**. Der Dialog hat **kein Nummernfeld** mehr, sondern zeigt die Nummer der Buchung nur lesbar, bei fehlender Nummer „ohne Nummer“ mit Hinweis, sie in der Buchung einzutragen; Hochladen geht trotzdem. Hochladen zählt nichts hoch.
- **Aus:** Feld „Gästeblattnummer“ im Buchungsformular und Knopf „Gästeblatt hochladen“ sind **nicht vorhanden**. Vorhandene Nummern und hochgeladene Blätter bleiben erhalten und werden angezeigt.
- **Startwert:** Neue Kunden aus. Bestehende Kunden mit mindestens einer Gästeblattnummer an einer Buchung oder einem hochgeladenen Blatt: ein; alle anderen aus.

### Acceptance Criteria
- [ ] Angenommen ein Kunde mit Objekten in zwei Gemeinden, wenn Einstellungen → Stammdaten geöffnet wird, dann gibt es je Gemeinde ein Feld „Kennzahl“; ein Inhaber kann „00123“ speichern und es bleibt mit führenden Nullen erhalten
- [ ] Angenommen eine Kennzahl für die Gemeinde der Buchung, wenn das Gästeblatt geöffnet und fertiggestellt wird, dann steht sie auf Seite 1 und im PDF; eine spätere Änderung der Kennzahl ändert das PDF nicht
- [ ] Angenommen keine Kennzahl, wenn das Blatt fertiggestellt wird, dann gelingt es und das Feld bleibt leer
- [ ] Angenommen „Nächste Nummer“ `0042` im Bereich `0001`–`0500`, wenn ein Blatt fertiggestellt wird, dann hat es `0042` (auch an der Buchung) und die nächste Nummer ist `0043`
- [ ] Angenommen ein Blatt wird geöffnet und abgebrochen, dann wird keine Nummer verbraucht
- [ ] Angenommen `0043` ist an einer anderen Buchung derselben Gemeinde nacherfasst, wenn das nächste Blatt fertiggestellt wird, dann bekommt es `0044`
- [ ] Angenommen der laufende Bereich endet bei `0500` und ein folgender Bereich `B-0001`–`B-0100` ist erfasst, wenn nach `0500` ein Blatt fertiggestellt wird, dann bekommt es `B-0001`, der alte Bereich ist „aufgebraucht“
- [ ] Angenommen „Neu unterschreiben lassen“ bei einem Blatt mit `0042`, dann hat das neue Blatt wieder `0042` und der Zähler bleibt unverändert
- [ ] Angenommen eine Buchung mit nacherfasster Nummer `0007`, wenn das Blatt fertiggestellt wird, dann hat es `0007` und der Zähler bleibt unverändert
- [ ] Angenommen ein Bereich `0001`–`0500` und ein neuer Bereich `0400`–`0600`, wenn gespeichert wird, dann erscheint eine Meldung zur Überschneidung; ebenso bei „von“ > „bis“, unterschiedlichem Vorsatz oder einer Nummer ohne Ziffer am Ende
- [ ] Angenommen insgesamt 10 freie Nummern, dann erscheint „Nur noch 10 Nummern frei“ in den Einstellungen, im Buchungsdetail und auf dem Dashboard mit Kunden- und Gemeindenamen; mit einem zusätzlich erfassten folgenden Bereich verschwindet der Hinweis
- [ ] Angenommen eine Gemeinde ohne Nummernbereich, wenn das Buchungsdetail einer Buchung ohne Nummer dort geöffnet wird, dann ist „Gästeblatt“ gesperrt mit Hinweis auf Einstellungen → Gästeblatt
- [ ] Angenommen ein Mitarbeiter, wenn das Dashboard einen Nummern-Hinweis zeigt, dann ist die Zeile nicht verlinkt; für Inhaber führt sie zu Einstellungen → Gästeblatt des Kunden
- [ ] Angenommen „Gästeblätter nacherfassen“ aus, wenn das Buchungsformular bzw. -detail geöffnet wird, dann gibt es weder das Feld „Gästeblattnummer“ noch „Gästeblatt hochladen“
- [ ] Angenommen „Gästeblätter nacherfassen“ ein und eine doppelte Nummer in derselben Gemeinde, wenn die Buchung gespeichert wird, dann erscheint ein Hinweis und das Speichern gelingt
- [ ] Angenommen „Gästeblätter nacherfassen“ ein, wenn „Gästeblatt hochladen“ geöffnet wird, dann zeigt der Dialog die Nummer der Buchung nur lesbar und der Zähler bleibt nach dem Hochladen unverändert
- [ ] Angenommen ein bestehender Kunde mit nacherfassten Gästeblattnummern, wenn die Erweiterung eingespielt wird, dann ist „Gästeblätter nacherfassen“ eingeschaltet; bei Kunden ohne solche Daten aus

### Edge Cases
- Zwei Tablets stellen gleichzeitig Blätter derselben Gemeinde fertig → verschiedene Nummern, keine doppelt (Vergabe in der Datenbank in einem Schritt)
- „Nächste Nummer“ wird auf eine bereits vergebene gesetzt → Hinweis, Speichern möglich; die Vergabe überspringt belegte Nummern
- Alle restlichen Nummern des laufenden Bereichs sind belegt (nacherfasst) → Vergabe springt in den nächsten Bereich; gibt es keinen, ist kein Blatt möglich (Knopf gesperrt)
- Bereich in Verwendung: „bis“ unter die zuletzt vergebene Nummer → Meldung, nicht gespeichert
- Ein Blatt wird bis zur Unterschrift offen gehalten, inzwischen wird der letzte Bereich aufgebraucht → „Fertig“ meldet „Keine Gästeblattnummer verfügbar“, die Unterschriften gehen nicht verloren, sobald ein Bereich erfasst ist, kann erneut „Fertig“ gedrückt werden
- Wohnung der Buchung wechselt vor dem Fertigstellen die Gemeinde → Nummer und Kennzahl der neuen Gemeinde
- Gemeinde ohne Objekte mehr → Kennzahl und Bereiche bleiben gespeichert, ausgeblendet; kein Dashboard-Hinweis
- Altbestand mit doppelten Nummern → bleibt unverändert, nur Hinweis bei Änderung

### Tech Design der Erweiterung (Solution Architect, 2026-11-09)

#### Ausgangslage
- Die Buchung hat bereits das Textfeld „Gästeblattnummer“ (PROJ-30). Beim Speichern prüft die Datenbank auf doppelte Nummern und verlangt eine Bestätigung, also nur einen Hinweis. Diese Prüfung gilt heute für den ganzen Kunden.
- „Fertig“ läuft über die Server-Schnittstelle `/api/gaesteblatt/fertig`, in dieser Reihenfolge:
  1. Fassung zusammenstellen, mit der Nummer der Buchung.
  2. PDF erzeugen.
  3. Dateien ablegen.
  4. In der Datenbank festschreiben.
- Das Blatt speichert seine Nummer selbst (`sheet_number`). Die Fassung (Snapshot) friert alle Kopfangaben ein.
- Muster für den Schalter: „Rechnungen nacherfassen“ ist ein Schalter am Kunden mit eigenem Abschnitt in den Einstellungen.
- Objekte haben eine Gemeinde (Gemeindekennziffer und Name aus dem Gemeindeverzeichnis, PROJ-6).

#### Oberfläche
```
Einstellungen → Stammdaten
+-- (bestehende Abschnitte)
+-- NEU Abschnitt „Kennzahlen je Gemeinde“ (eigenes Speichern, unabhängig vom Stammdaten-Formular)
    +-- je Gemeinde mit Objekten: „Bad Ischl (40702)“ + Feld „Kennzahl“, Hinweis bei leerem Feld
    +-- Leerzustand: „Noch keine Objekte – Kennzahlen gibt es je Gemeinde der Objekte.“

Einstellungen → Gästeblatt
+-- NEU Abschnitt „Laufende Nummer je Gemeinde“
|   +-- je Gemeinde eine Karte
|       +-- Kopf: Gemeinde, Hinweis (frei / „Nur noch n Nummern frei“ / aufgebraucht / nicht festgelegt)
|       +-- Tabelle der Bereiche: von, bis, Nächste Nummer, Stand, Aktionen (Bearbeiten, Löschen)
|       +-- Knopf „Nummernbereich hinzufügen“ → Dialog (von, bis; beim ersten Bereich „Nächste Nummer“)
+-- NEU Abschnitt „Gästeblätter nacherfassen“ (Schalter mit Erklärung, wie bei Rechnungen)
+-- (bestehende Datenschutz-Texte)

Buchungsdetail → Abschnitt „Gästeblatt“
+-- NEU Hinweis Nummern (Frühwarnung bzw. „kein Nummernbereich“/„aufgebraucht“)
+-- Knopf „Gästeblatt“: gesperrt, wenn keine Nummer verfügbar und die Buchung keine hat
+-- „Gästeblatt hochladen“ nur bei „nacherfassen“ ein; Dialog ohne Nummernfeld, Nummer nur lesen

Buchungsformular
+-- Feld „Gästeblattnummer“ nur bei „nacherfassen“ ein; Doppelt-Hinweis nur innerhalb derselben Gemeinde

Vollbild-Gästeblatt, Seite 1, Kopf
+-- „Lfd.-Nr.“: vorhandene Nummer oder „wird beim Abschluss vergeben“ (nur lesen, kein Eingabefeld mehr)
+-- „Kennzahl“: Kennzahl der Gemeinde (nur lesen)
+-- Fehler bei „Fertig“: „Keine Gästeblattnummer verfügbar“ – Unterschriften bleiben, erneut „Fertig“ möglich

Dashboard
+-- Kacheln
+-- NEU Hinweisblock „Gästeblattnummern“ (nur wenn etwas zu melden ist; Kundenname · Gemeinde: Hinweis)
+-- (übrige Abschnitte)

PDF Seite 1
+-- Kennzahl im Kopf aus der Fassung
```

#### Datenmodell (in Worten)
- **Kennzahlen:** eine neue Tabelle mit je einer Zeile pro Kunde und Gemeinde: Kunde, Gemeindekennziffer, Kennzahl (Text bis 30 Zeichen) und Änderungsstempel. Es kann für jede Kombination aus Kunde und Gemeinde nur eine Zeile geben. Die Zeilen bleiben erhalten, wenn das letzte Objekt in der Gemeinde verschwindet.
- **Nummernbereiche:** eine neue Tabelle mit je einer Zeile pro Bereich. Sie enthält:
  - Kunde und Gemeindekennziffer.
  - Reihenfolge, nach dem Zeitpunkt der Eingabe.
  - „von“ und „bis“ als Text.
  - „Nächste Nummer“ als Text. Sie gilt nur für den Bereich in Verwendung; folgende Bereiche starten bei „von“.
  - „Aufgebraucht am“, leer solange offen.
  - Änderungsstempel.
- **Stand eines Bereichs:**
  - „aufgebraucht“, wenn „Aufgebraucht am“ gesetzt ist.
  - „in Verwendung“ für den ersten offenen Bereich der Gemeinde.
  - „folgt“ für alle weiteren offenen Bereiche.
  - Der Stand wird berechnet, nicht gespeichert. So kann es nie zwei Bereiche „in Verwendung“ geben.
- **Schalter:** eine neue Spalte „Gästeblätter nacherfassen“ am Kunden, neben „Rechnungen nacherfassen“, Standard aus. Die Migration schaltet ihn bei Kunden ein, die schon eine Gästeblattnummer an einer Buchung oder ein hochgeladenes Blatt haben.
- **Fassung des Blatts:** Sie bekommt zusätzlich die Kennzahl. Die Nummer steht schon drin. Alte Fassungen ohne Kennzahl drucken das Feld leer.
- **Buchung:** keine neue Spalte. Die vergebene Nummer steht weiter in „Gästeblattnummer“. Die Gemeinde ergibt sich aus Wohnung → Objekt.
- Beide neuen Tabellen erhalten Mandanten-RLS nach dem bestehenden Muster. Mitglieder dürfen lesen, Mitarbeiter brauchen das für Hinweise und den gesperrten Knopf. Schreiben geht nur über Datenbankfunktionen für Inhaber und Betreiber. Alles läuft mit Änderungsprotokoll.

#### Nummernregel an einer Stelle
- Ein gemeinsamer Baustein in der App, `guest-sheet-numbering`, macht Folgendes:
  - Er zerlegt eine Nummer in Vorsatz und Ziffern am Ende.
  - Er zählt weiter und behält dabei die Stellenzahl.
  - Er vergleicht Nummern ohne Rücksicht auf Groß- und Kleinschreibung.
  - Er prüft Bereiche: gleicher Vorsatz, „von“ ≤ „bis“, keine Überschneidung, nächste Nummer im Bereich.
- Er wird für die Prüfung in den Formularen, die Vorschau und die Unit-Tests genutzt.
- Die Datenbank hat dieselbe Regel als eigene Funktion. Sie ist maßgeblich für Speichern und Vergabe. Gemeinsame Testfälle stellen sicher, dass beide gleich rechnen.
- **Zugehörigkeit zu einem Bereich:** Eine Nummer liegt im Bereich, wenn ihr Vorsatz gleich ist (ohne Groß-/Kleinschreibung) und ihr Zahlenwert zwischen „von“ und „bis“ liegt.
- **Belegt** ist eine Nummer, wenn eine andere Buchung derselben Gemeinde genau diese Nummer hat (ohne Groß-/Kleinschreibung).
- **Freie Nummern einer Gemeinde** sind alle Nummern von der nächsten Nummer bis „bis“ im laufenden Bereich plus die Größe aller folgenden Bereiche. Davon werden die belegten Nummern in diesen Abschnitten abgezogen. Das wird per Zählung berechnet, ohne jede Nummer einzeln aufzuzählen, damit auch große Bereiche schnell bleiben.

#### Vergabe beim „Fertig“
- **Neue Reihenfolge der Schnittstelle:**
  1. Berechtigung und Stand prüfen wie bisher.
  2. Hat die Buchung keine Nummer, vergibt die Datenbank die nächste freie.
  3. Danach Fassung inklusive Kennzahl zusammenstellen, PDF erzeugen, Dateien ablegen und festschreiben.
- **Die Vergabe ist eine Datenbankfunktion**, die nur der Server aufruft (wie das Festschreiben). Sie arbeitet so:
  1. Sie sperrt die Bereiche der Gemeinde für die Dauer des Schritts. Zwei Tablets bekommen so nie dieselbe Nummer.
  2. Sie überspringt belegte Nummern.
  3. Nach „bis“ markiert sie den Bereich als aufgebraucht und springt auf „von“ des nächsten Bereichs.
  4. Sie schreibt die Nummer an die Buchung und setzt die nächste Nummer weiter.
  5. Gibt es keine freie Nummer, meldet sie einen eigenen Fehlercode. Die Oberfläche zeigt dann „Keine Gästeblattnummer verfügbar“.
- **Nummer bleibt an der Buchung, auch wenn danach etwas scheitert**, etwa das PDF oder die Ablage. Ein erneutes „Fertig“ nimmt dann diese Nummer, und es entsteht keine Lücke. Bei „Neu unterschreiben lassen“ hat die Buchung bereits eine Nummer, deshalb wird keine neue vergeben.
- Das Protokoll schreibt die Vergabe als Änderung der Buchung „über Gästeblatt“.

#### Nacherfassen und Hochladen
- **Buchung speichern:**
  - Fehlt das Feld im Formular, weil der Schalter aus ist, bleibt eine vorhandene Nummer unverändert. Die Datenbank behandelt „nicht mitgeschickt“ als „nicht ändern“, nicht als „löschen“.
  - Die Doppelt-Prüfung mit Bestätigung bleibt, gilt aber nur noch innerhalb derselben Gemeinde.
- **Hochladen:**
  - Die Datenbankfunktion übernimmt die Nummer der Buchung und nimmt keine eigene Nummer mehr entgegen.
  - Ist der Schalter aus, lehnt sie das Hochladen ab, eine Server-Prüfung zusätzlich zum ausgeblendeten Knopf.
  - Hochladen zählt nie hoch.

#### Hinweise und Dashboard
- **Lesesicht „Nummernstand je Gemeinde“**: je Kunde und Gemeinde mit mindestens einer nicht archivierten Wohnung. Sie liefert:
  - Gemeindename.
  - Nächste Nummer.
  - Anzahl freier Nummern.
  - Zustand: frei, knapp (≤ 10), aufgebraucht, nicht festgelegt.
  - Sie wird mit den Rechten der lesenden Person ausgewertet und zeigt deshalb nur Kunden, bei denen sie Mitglied ist.
- **Dieselbe Sicht speist:**
  - die Hinweise in Einstellungen → Gästeblatt,
  - das Buchungsdetail (gesperrter Knopf, Hinweis),
  - die Vollbild-Seite (Kopf),
  - den Dashboard-Block. Dieser ist ein eigener, kleiner Abschnitt unter den Kacheln. Er folgt dem Kundenfilter und verlinkt für Inhaber mit Kundenwechsel wie die anderen Dashboard-Zeilen.

#### Rechte
- Kennzahlen, Bereiche und Schalter dürfen Inhaber und Betreiber ändern, wie die Stammdaten bzw. Einstellungen → Rechnungen.
- Mitarbeiter sehen die Hinweise, und bei ihnen ist der Knopf ebenso gesperrt. Ändern können sie nichts.

#### Abhängigkeiten
- Keine neuen Pakete.

#### Für /frontend und /backend
- **Datenbank (eine Migration):**
  - Tabellen für Kennzahlen und Nummernbereiche.
  - Spalte am Kunden mit Startwerten.
  - Funktionen: Kennzahlen speichern, Bereich anlegen/ändern/löschen, Schalter speichern, Nummer vergeben (nur Server), Lesesicht für den Nummernstand.
  - Angepasst werden das Buchung-Speichern (fehlendes Feld = unverändert, Doppelt-Prüfung je Gemeinde), das Hochladen (Nummer aus der Buchung, Schalter) und die Kunden-Löschung durch den Betreiber (neue Tabellen mit löschen).
- **Fertig-Schnittstelle:** Vergabe vor dem Erzeugen der Fassung; Kennzahl in die Fassung; neuer Fehler „keine Nummer“.
- **Oberfläche:**
  - Stammdaten-Abschnitt.
  - Einstellungen-Abschnitte mit Dialog.
  - Buchungsdetail: Hinweis und gesperrter Knopf.
  - Upload-Dialog ohne Nummernfeld.
  - Buchungsformular: Feld abhängig vom Schalter.
  - Vollbild-Kopf nur lesen.
  - Dashboard-Block.
  - PDF-Kopf mit Kennzahl.
- **Tests:**
  - Unit: Nummernregel mit führenden Nullen, Vorsatz, Überlauf, Überschneidung.
  - Integration:
    - Vergabe mit Überspringen und Bereichswechsel.
    - Gleichzeitige Vergabe.
    - Keine Nummer.
    - Hochladen bei Schalter aus.
    - Buchung speichern ohne Feld.
    - Rechte.
  - E2E: die Akzeptanzkriterien oben.


### Implementation Notes Erweiterung (Frontend, 2026-11-09)
- **Nummernregel** `src/lib/guest-sheet-numbering.ts` (+ Tests): `parseSheetNumber`, `incrementSheetNumber`, `sameSheetNumber`, `inRange`, `checkRange`, `countBetween`, `numberingState` (ok/low ≤ 10/exhausted/unset), `canIssueSheet`.
- **Lesen** `src/lib/guest-sheet-numbering-data.ts`: `loadEstablishmentNumbers`, `loadSheetNumbering`, `getGuestSheetBackfill` (je Anfrage), `getBookingNumbering`, `getNumberAlerts`; ohne Migration leere Ergebnisse, Schalter aus. `getSigningData` liefert zusätzlich `establishmentNumber` (`loadEstablishmentNumber`).
- **Aktionen** `src/app/(app)/einstellungen/gaesteblatt/numbering-actions.ts` (Inhaber des gewählten Kunden und Betreiber): `saveEstablishmentNumbers`, `saveSheetNumberRange`, `deleteSheetNumberRange`, `saveGuestSheetBackfill`.
- **Oberfläche:**
  - Stammdaten: `EstablishmentNumbersForm` unter dem Stammdaten-Formular (auch Betreiber-Kundenseite).
  - Einstellungen → Gästeblatt: `GuestSheetNumberingSections` mit `SheetNumberingSettings` (Karte je Gemeinde, Tabelle, `RangeDialog`, Löschen nur „Folgt“) und `SheetBackfillSwitch` über den Texten (auch Betreiber-Kundenseite, Abschnitt „Gästeblatt“).
  - Buchungsdetail: `NumberNotice` und gesperrter Knopf „Gästeblatt“ ohne freie Nummer; „Gästeblatt hochladen“ nur mit Schalter. Upload-Dialog ohne Nummernfeld (Nummer nur lesen, „ohne Nummer“ mit Hinweis).
  - Buchungsformular: Feld „Gästeblattnummer“ nur mit Schalter (`GuestSheetBackfillProvider` im App-Layout). `saveBooking` schickt `guest_sheet_number`/`confirm_guest_sheet_number` nur bei eingeschaltetem Schalter.
  - Vollbild Seite 1: Lfd.-Nr. („wird beim Abschluss vergeben“) und Kennzahl nur lesen. Die Aktion `saveSheetNumber` und das Nummernfeld auf dem Blatt sind entfernt. Ohne freie Nummer erklärt die Seite das (`blocked.noNumber`).
  - Dashboard: `GuestSheetNumberAlerts` unter den Kacheln.
  - PDF: Kennzahl im Kopf aus der Fassung (`establishmentNumber`).
- **Fertig-Schnittstelle:**
  - Vor der Fassung `assign_guest_sheet_number`, nur wenn die Buchung keine Nummer hat. Fehler: P0986 → `noSheetNumber`, P0975 → `staleBooking`. Fehlt die Funktion, entsteht das Blatt ohne Nummer.
  - Antworten nach der Vergabe tragen `bookingUpdatedAt`; der Browser übernimmt den Stand für das erneute „Fertig“.
- **Texte:** `guestSheets.numbering`, `.backfill`, `.establishment`, neue Fehler- und Prüfmeldungen; Hinweistexte im Buchungsformular angepasst.

#### Erwartete Datenbank-Schnittstellen (für /backend)
- **Tabellen:**
  - `establishment_numbers`: tenant_id, municipality_code, establishment_number, Stempel; eindeutig je Kunde und Gemeinde.
  - `guest_sheet_number_ranges`: id, tenant_id, municipality_code, position, range_from, range_to, next_number, exhausted_at, updated_at.
  - Spalte `tenants.guest_sheet_backfill_enabled`, Startwerte laut Spec.
- **Sichten** (security_invoker; Mitglieder und Betreiber lesen):
  - `establishment_number_list`: tenant_id, municipality_code, municipality_name, establishment_number, has_properties.
  - `guest_sheet_numbering`: tenant_id, tenant_name, municipality_code, municipality_name, next_number (nächste wirklich freie), free_count, has_ranges, has_apartments (nicht archivierte Wohnung); je Gemeinde mit Objekten.
  - `guest_sheet_number_range_list`: id, tenant_id, municipality_code, position, range_from, range_to, next_number, state active/queued/exhausted, exhausted_at, last_issued, updated_at.
- **Funktionen:**
  - `save_establishment_numbers(p_tenant_id, p_items [{municipality_code, establishment_number}])`
  - `save_guest_sheet_number_range(p_input {tenant_id, municipality_code, id, updated_at, range_from, range_to, next_number})`
  - `delete_guest_sheet_number_range(p_id, p_expected_updated_at)`
  - `save_guest_sheet_backfill(p_tenant_id, p_enabled)`
  - `assign_guest_sheet_number(p_booking_id, p_actor_id, p_expected_updated_at)`, nur service role, liefert {sheet_number, updated_at}.
- **Fehlercodes:**
  - P0982: Stand der Bereiche.
  - P0983: Überschneidung.
  - P0984: ungültiger Bereich.
  - P0985: Bereich gesperrt.
  - P0986: keine Nummer.
  - P0987: Hochladen ohne Schalter.
- **Anzupassen:**
  - `save_booking`: fehlender Schlüssel `guest_sheet_number` = unverändert; Doppelt-Prüfung je Gemeinde. Das gilt auch für `booking_warnings`/`guest_sheet_duplicates`.
  - `register_guest_sheet_upload`: Nummer aus der Buchung, Schalter prüfen.
  - `save_guest_sheet_field`: Ziel „booking“ ohne `guest_sheet_number`.
  - `admin_delete_tenant`: neue Tabellen.


### Implementation Notes Erweiterung (Backend, 2026-11-09)
- **Migration** `20261109110308_guest_sheet_numbering.sql` (in Dev).
- **Tabellen:**
  - `establishment_numbers` (eindeutig je Kunde und Gemeinde).
  - `guest_sheet_number_ranges` (Reihenfolge `position`, `next_number`, `exhausted_at`; Prüfungen für Format, Vorsatz und von ≤ bis).
  - Beide haben RLS: Mitglieder und Admin lesen, geschrieben wird nur über Funktionen; Änderungsprotokoll über `enable_tenant_table`.
- **Spalte** `tenants.guest_sheet_backfill_enabled`: Startwert ein bei Kunden mit Nummer an einer Buchung oder hochgeladenem Blatt.
- **Nummernregel in der Datenbank:**
  - Bausteine: `sheet_number_ok`, `sheet_number_prefix`, `sheet_number_digits`, `sheet_number_format` (wächst über die Stellenzahl hinaus, ohne zu kürzen).
  - `sheet_range_scan` liefert den nächsten freien Wert per Lückensuche, ohne Aufzählung. Belegt ist nur genau dieselbe Schreibweise einer Buchung derselben Gemeinde.
  - `sheet_numbering_state` liefert den Stand je Gemeinde.
- **Lesesichten** `establishment_number_list`, `guest_sheet_numbering` und `guest_sheet_number_range_list` (Stand berechnet, `last_issued` = höchste belegte Nummer im Bereich in Verwendung). Sie laufen mit den Rechten der lesenden Person; die Zählung läuft als security definer mit Mitgliedschafts- bzw. Admin-Prüfung, damit auch der Betreiber belegte Nummern sieht.
- **Schreibfunktionen** (Inhaber und Admin, Kunde aktiv):
  - `save_establishment_numbers` (nur Gemeinden mit Objekt oder gespeicherter Kennzahl).
  - `save_guest_sheet_number_range`:
    - Sperrt die Bereiche der Gemeinde.
    - Prüft auf Überschneidung (P0983) und Format (P0984).
    - Beim Bereich in Verwendung ist „von“ fest (P0985) und „bis“ darf nicht unter die belegte Nummer (P0984).
    - Ein neuer Bereich bekommt „Nächste Nummer“ nur, wenn er sofort verwendet wird.
    - Veralteter Stand: P0982.
  - `delete_guest_sheet_number_range` (nur folgende, sonst P0985).
  - `save_guest_sheet_backfill`.
- **Vergabe** `assign_guest_sheet_number` (nur service_role, im Namen der Person):
  - Prüft den Stand der Buchung (P0975). Eine vorhandene Nummer bleibt.
  - Sperrt die Bereiche, überspringt belegte Nummern, markiert aufgebrauchte Bereiche und springt in den nächsten.
  - Schreibt die Nummer mit Protokoll-Quelle „Gästeblatt“; ohne freie Nummer P0986.
- **Angepasst:**
  - `save_booking`: fehlender Schlüssel = Nummer unverändert, Doppelt-Prüfung nur bei mitgeschickter Nummer und je Gemeinde.
  - `booking_warnings`: neue Fassung `guest_sheet_duplicates(…, p_apartment_id)`, die alte ist entfernt.
  - `register_guest_sheet_upload`: Nummer aus der Buchung, nur mit Schalter (P0987), ändert die Buchung nicht mehr.
  - `save_guest_sheet_field`: ohne Ziel „booking“.
  - `admin_delete_tenant` unverändert: Kaskade über `tenant_id`.
- **Tests:**
  - Neu: `supabase/tests/guest-sheet-numbering.integration.test.ts` mit 10 Tests (Weiterzählen A-0098 → A-0100 → 9999 → 10000, Überspringen nur gleicher Schreibweise und Gemeinde, gleichzeitige Vergabe ohne Doppelte, keine Nummer, Prüfungen, Rechte, Sichten, Kennzahlen, Schalter, Buchung ohne Nummernfeld, Doppelt-Hinweis je Gemeinde).
  - Angepasst: `guest-sheets.integration.test.ts` mit 16 Tests.
  - `bookings.integration.test.ts` mit 32 Tests, unverändert grün.
  - Unit: 987 Tests. Lint und Typprüfung grün.
- **Datenbank-Prüfung:** Die Warnung „doppelter Index“ habe ich behoben; der eigene Index entfällt, es bleibt der bestehende `bookings_guest_sheet_idx`. Übrig bleibt nur die bekannte Auth-Warnung zur OTP-Ablaufzeit.


### QA Test Results Erweiterung (2026-11-09)

**Tested:** 2026-11-09 gegen Dev (localhost, gebauter Server; Supabase „apppa-dev“)
**Result:** 16 von 17 Akzeptanzkriterien bestanden, 1 Fehler (High) → **nicht bereit**

#### Acceptance Criteria
- [x] Kennzahl je Gemeinde in den Stammdaten, führende Nullen, Hinweis bei fehlender Kennzahl, ungültige Zeichen abgelehnt (E2E)
- [x] Kennzahl auf Seite 1 und in der Fassung des PDFs; spätere Änderung ändert das Blatt nicht (E2E)
- [x] Ohne Kennzahl gelingt das Blatt, Feld leer (Integration + E2E)
- [x] Nummer erst beim „Fertig“ (0042), Zähler danach 0043 (E2E, Integration)
- [x] Abbrechen verbraucht keine Nummer (E2E)
- [x] Nacherfasste Nummer derselben Gemeinde wird übersprungen, andere Schreibweise/Gemeinde nicht (Integration)
- [x] Sprung in den folgenden Bereich (A-0100 → 9999), alter Bereich „aufgebraucht“ (Integration)
- [x] „Neu unterschreiben lassen“ behält die Nummer, kein weiterer Verbrauch (E2E)
- [x] Nacherfasste Nummer an der Buchung wird übernommen (Integration)
- [x] Überschneidung, von > bis, anderer Vorsatz und Nummer ohne Ziffer am Ende abgelehnt (Integration; im Formular E2E für Überschneidung)
- [x] Neuer Bereich in den Einstellungen nach einem bereits angelegten, ohne Neuladen (nach Korrektur BUG-5, E2E)
- [x] Frühwarnung „nur noch 5 Nummern frei“ in den Einstellungen; verschwindet mit folgendem Bereich (Datenbank/Integration; E2E bis BUG-5)
- [x] Ohne Nummernbereich ist „Gästeblatt“ gesperrt mit Hinweis, Vollbild-Seite erklärt es (E2E)
- [x] Dashboard nennt Kunde und Gemeinde; Mitarbeiter ohne Link, Inhaber mit Link in die Einstellungen (E2E)
- [x] Schalter aus: weder Feld „Gästeblattnummer“ noch „Gästeblatt hochladen“; Speichern behält die Nummer (E2E)
- [x] Schalter ein: doppelte Nummer nur Hinweis, nur in derselben Gemeinde (Integration, PROJ-30-E2E)
- [x] Hochladen zeigt die Nummer der Buchung nur lesbar, zählt nicht hoch; ohne Schalter abgelehnt (E2E, Integration)
- [x] Startwert des Schalters für bestehende Kunden mit Nummern (Migration; in Dev geprüft)

#### Edge Cases
- [x] Gleichzeitige Vergabe an vier Buchungen ergibt vier verschiedene Nummern (Integration)
- [x] „bis“ unter die belegte Nummer abgelehnt, „von“ im laufenden Bereich fest, nur folgende Bereiche löschbar (Integration)
- [x] Veralteter Stand der Buchung bei der Vergabe → P0975 (Integration)
- [x] Keine freie Nummer → P0986, Unterschriften bleiben (Integration; Meldung im Browser vorhanden)
- [x] Fremder Kunde sieht weder Nummernstand noch Kennzahlen (Integration)

#### Security Audit
- [x] Vergabe nur mit der Service-Rolle; Mitarbeiter-Aufruf abgelehnt (Integration)
- [x] Bereiche, Kennzahlen und Schalter: nur Inhaber und Betreiber; Mitarbeiter und fremde Inhaber 42501 (Integration)
- [x] Lesesichten zeigen nur Kunden der lesenden Person; die Zählung belegter Nummern prüft die Mitgliedschaft (security definer)
- [x] Hochladen ohne Schalter auch serverseitig abgelehnt (P0987)
- [x] Kennzahl und Nummern nur aus erlaubten Zeichen; keine Eingabe gelangt ungeprüft in HTML
- Hinweis (Low, BUG-7): Ein Mitglied kann über einen direkten Datenbankaufruf `save_booking` mit Gästeblattnummer auch bei ausgeschaltetem Schalter speichern; die App selbst schickt sie dann nicht. Mitglieder dürfen Buchungen ohnehin bearbeiten.

#### Regression
- Gästeblatt (alle 23 bestehenden Tests, angepasst an die nur lesbare Lfd.-Nr.), PROJ-30 (15), PROJ-47 (11), PROJ-46 (17), PROJ-5 (16), PROJ-14 (17): grün. Ein PROJ-30-Test schlug einmal unter Last fehl und lief einzeln grün (Ausreißer).
- Layout und Barrierefreiheit (axe, kein waagrechtes Scrollen) für Einstellungen → Gästeblatt und → Stammdaten in Desktop, Tablet und Handy: grün. Firefox/Safari nicht gesondert geprüft.
- Unit 987, Integration 10 + 16 + 32: grün.

#### Bugs Found

##### BUG-5: Zweiter neuer Nummernbereich lässt sich ohne Neuladen nicht speichern (High) — behoben
- **Schritte:**
  1. Einstellungen → Gästeblatt öffnen, für eine Gemeinde ohne Bereich „Nummernbereich hinzufügen“ wählen.
  2. 0001–0010 mit „Nächste Nummer“ 0006 speichern.
  3. Ohne Neuladen erneut „Nummernbereich hinzufügen“ wählen, B-0001–B-0100 eingeben und „Bereich speichern“ klicken.
- **Erwartet:** Der Bereich wird als „Folgt“ gespeichert.
- **Tatsächlich:** Nichts passiert, keine Meldung.
- **Ursache:**
  - Der Dialog für neue Bereiche behält denselben `key` und damit die Formularwerte. Die „Nächste Nummer“ 0006 aus dem ersten Dialog bleibt erhalten, obwohl das Feld beim zweiten Bereich ausgeblendet ist.
  - Die Prüfung meldet sie als „nicht im Bereich“ am unsichtbaren Feld.
- **Folge:** Genau der Fall „neuen Bereich vorab erfassen“ scheitert still. Umgehung: Seite neu laden.
- **E2E-Test:** „AC: Bereiche in den Einstellungen anlegen …“ schlägt deshalb fehl.

##### BUG-6: Schalter „Gästeblätter nacherfassen“ auf der Kundenseite des Betreibers setzt das Stammdaten-Formular zurück (Low) — behoben
- Der Schalter liegt am Kunden und ändert dessen Stand. Ungespeicherte Eingaben im Stammdaten-Formular derselben Seite gehen nach dem Umschalten verloren, weil sich das Formular mit dem neuen Stand neu aufbaut.

##### BUG-7: `save_booking` prüft den Schalter nicht selbst (Low) — behoben
- Siehe Security Audit; nur über direkte Aufrufe erreichbar.

#### Testdaten-Hinweis
- Die Lesesicht zählt belegte Nummern nur für Mitglieder und Betreiber. Mit der Service-Rolle (Testskripte) erscheinen sie als frei; in der App spielt das keine Rolle.

#### Korrekturen (2026-11-09)
- **BUG-5:** Der Dialog „Nummernbereich“ bekommt bei jedem Öffnen einen neuen Schlüssel und beginnt so mit frischen Werten. `sheetRangeSchema(…, withNext)` prüft die „Nächste Nummer“ nur, wenn das Feld angezeigt wird. Unit-Test ergänzt; der E2E-Test „Bereiche in den Einstellungen …“ ist grün.
- **BUG-6:**
  - Der Schalter liegt jetzt in der eigenen Tabelle `guest_sheet_options` (eine Zeile je Kunde, RLS: Mitglieder und Admin lesen). Die Spalte `tenants.guest_sheet_backfill_enabled` entfällt, die Werte wurden übernommen.
  - Umschalten ändert den Stand der Stammdaten nicht mehr (Integrationstest).
  - Migrationen: `20261109121212_guest_sheet_numbering_qa_fixes.sql` und `20261109121457_guest_sheet_options_id.sql` (Spalte `id` fürs Änderungsprotokoll).
- **BUG-7:** `save_booking` übernimmt eine mitgeschickte Gästeblattnummer nur bei eingeschaltetem Schalter; `register_guest_sheet_upload` liest den Schalter aus der neuen Tabelle. Integrationstest ergänzt.
- **Nachtest:**

  | Bereich | Bestanden |
  |---|---|
  | Integration Nummernvergabe | 11 von 11 |
  | Integration Gästeblatt | 16 von 16 |
  | Integration Buchungen | 32 von 32 |
  | Unit | 988 von 988 |
  | E2E Erweiterung | 5 von 5 |
  | E2E Gästeblatt-Regression | 7 von 7 |
  | E2E PROJ-30 | 5 von 5 |
  | E2E PROJ-47 | 11 von 11 |

  Lint und Typprüfung grün; die Datenbank-Prüfung meldet nur die bekannte Auth-Warnung.

**Production-ready:** JA (alle Fehler behoben).

## Überarbeitung Liste „Gästeblätter“ (refine 2026-11-09)

Rückmeldung nach dem Deploy von v1.45.0: Die Liste soll sich an der Gästeblattnummer ausrichten, auch Buchungen mit
nacherfasster Nummer ohne PDF zeigen und einen klaren Filter für fehlende Gästeblätter haben. Ersetzt die Regeln zur Liste im
Abschnitt „Menüpunkt „Gästeblätter““.

### Regeln
- **Hauptliste:** alle Buchungen des gewählten Kunden **mit Gästeblattnummer**.
  - Sie gilt für Buchungen mit unterschriebenem bzw. nacherfasstem Blatt ebenso wie für Buchungen mit nacherfasster Nummer ohne PDF.
  - Nicht enthalten: Optionen, Sperren, **stornierte Buchungen** und „Wohnsitz angemeldet“.
- **Spalten**, von links:
  1. **Lfd.-Nr.**: Link zum PDF, wenn ein aktuelles Blatt vorhanden ist, sonst nur die Nummer als Text.
  2. **Buchung**: Buchungsnummer, Link zur Buchung.
  3. **Hauptgast**: Name, Link zur **Gastseite** (Gäste-Datenbank); bei anonymisiertem Gast nur Text.
  4. **Ankunft**.
  5. **Abreise**.
  6. **Wohnung**.
  7. **Art**: „unterschrieben“, „nacherfasst“ (bisher „hochgeladen“) oder „kein PDF“.
  - Die Spalten Marketing, Hinweise („Buchung geändert“) und der eigene PDF-Link entfallen.
- **Sortierung:** absteigend nach der Zahl am Ende der Gästeblattnummer (0449054 vor 0449053 vor 0449001), bei gleicher Zahl nach dem Vorsatz; Groß-/Kleinschreibung zählt nicht.
- **Filter:**
  - **Monatsauswahl nach Ankunft**, Voreinstellung **„Alle Monate“** (vollständige Liste).
  - **Wohnung**: „Alle Wohnungen“ oder eine Wohnung, gruppiert nach Objekt; archivierte wählbar und gekennzeichnet.
  - **Suche** nach Name, Gästeblatt- und Buchungsnummer.
  - Alle Filter sind kombinierbar.
- **Schalter „Buchungen ohne Gästeblatt“** (bisher „Gästeblatt fehlt“): zeigt stattdessen die Buchungen **ohne Gästeblattnummer**.
  - Nur Buchungen ab dem Ankunftstag (Ankunft ≤ heute), sortiert nach Ankunft, die neueste zuerst.
  - Optionen, Sperren, stornierte Buchungen und „Wohnsitz angemeldet“ sind ausgenommen.
  - Wohnung, Monat und Suche gelten auch hier.
  - Spalten: Buchung, Hauptgast (Link zur Gastseite), Ankunft, Abreise, Wohnung.
- **„nacherfasst“ statt „hochgeladen“** als Art des Blatts überall, wo sie angezeigt wird (Liste, Buchungsdetail: „Nacherfasst am …“). Der Knopf „Gästeblatt hochladen“ bleibt so.
- **Handy:** Karten mit Nummer (bzw. Link zum PDF), Hauptgast (Link zur Gastseite), Zeitraum, Wohnung, Art und Buchungsnummer (Link). Keine Karte als Ganzes verlinkt (Safari-Regel).
- **Stornierte Buchung mit Blatt oder Nummer:** erscheint in keiner der beiden Listen; das Blatt bleibt im Buchungsdetail sichtbar.

### Acceptance Criteria
- [ ] Angenommen Buchungen mit den Nummern 0449001, 0449054 und 0449053, wenn die Liste geöffnet wird, dann stehen sie in der Reihenfolge 0449054, 0449053, 0449001, und die Monatsauswahl steht auf „Alle Monate“
- [ ] Angenommen eine Buchung mit unterschriebenem Blatt, dann ist ihre Nummer ein Link zum PDF und die Art „unterschrieben“; bei einem hochgeladenen Blatt „nacherfasst“
- [ ] Angenommen eine Buchung mit nacherfasster Nummer ohne Blatt, dann erscheint sie mit der Nummer als Text und der Art „kein PDF“
- [ ] Angenommen eine Zeile, dann führt die Buchungsnummer zur Buchung und der Hauptgast zur Gastseite
- [ ] Angenommen eine stornierte Buchung, eine Option und eine Buchung mit „Wohnsitz angemeldet“ mit Nummer, dann erscheinen sie nicht
- [ ] Angenommen zwei Wohnungen, wenn eine Wohnung gewählt wird, dann zeigt die Liste nur deren Buchungen; zusammen mit einem Monat nur die Buchungen dieser Wohnung mit Ankunft im Monat
- [ ] Angenommen der Schalter „Buchungen ohne Gästeblatt“, dann erscheinen nur Buchungen ohne Nummer mit Ankunft bis heute, ohne Optionen, Sperren, Stornos und „Wohnsitz angemeldet“
- [ ] Angenommen das Buchungsdetail mit hochgeladenem Blatt, dann steht dort „Nacherfasst am …“
- [ ] Angenommen ein Handy, dann zeigt die Liste Karten ohne waagrechtes Scrollen

### Edge Cases
- Gleiche Zahl mit verschiedenem Vorsatz (A-0005 und B-0005): Reihenfolge nach Vorsatz absteigend
- Nummer ohne Ziffer am Ende (Altbestand): nach allen Nummern mit Zahl, alphabetisch absteigend
- Anonymisierter Hauptgast: Name „Anonymisiert“ ohne Link
- Buchung ohne Gast (Altbestand): „–“
- Ersetzte Blätter: nur das aktuelle Blatt zählt für Link und Art

### Umsetzung Frontend (2026-11-09)
- Ohne eigenen `/architecture`-Schritt (kleiner Umfang); Entwurf hier.
- **`src/lib/guest-sheet.ts`:**
  - `GuestSheetFilters` mit `apartment`; Voreinstellung „Alle Monate“; `?monat=YYYY-MM`, `?wohnung=…`, `?fehlt=1`. Alte Links mit `monat=alle` gelten weiter.
  - Neue Zeilentypen `GuestSheetRow` (Nummer, aktuelles Blatt, Art `signed|uploaded|none`, Gast mit Kennung) und `MissingSheetRow` (mit Gast-Kennung).
- **`src/lib/guest-sheets-data.ts`:**
  - `getGuestSheetPage` liest die neue Sicht `guest_sheet_register`, sortiert nach `sort_value` (absteigend, ohne Zahl zuletzt), `sort_prefix` und Nummer.
  - „Buchungen ohne Gästeblatt“ liest `guest_sheet_missing` mit Wohnungsfilter.
  - `hasAnyGuestSheet` zählt Buchungen mit Nummer.
- **Oberfläche:** `guest-sheet-list.tsx` neu (Spalten laut Spec, Gast → Gastseite, anonymisiert ohne Link, Handy-Karten). `guest-sheet-filters.tsx` mit Wohnungsauswahl wie in der Buchungsübersicht; der Schalter heißt „Buchungen ohne Gästeblatt“.
- **Texte:** „nacherfasst“, „kein PDF“; Buchungsdetail „Nacherfasst am …“.

#### Erwartete Datenbank-Schnittstellen (für /backend)
- **Neue Sicht `guest_sheet_register`** (security_invoker): Buchungen `kind = 'booking'`, nicht storniert, ohne „Wohnsitz angemeldet“, mit `guest_sheet_number`. Spalten:
  - `booking_id`, `tenant_id`, `booking_number`, `sheet_number` (= `guest_sheet_number`)
  - `sort_value` (numerische Ziffern am Ende, sonst null), `sort_prefix` (Vorsatz in Kleinbuchstaben)
  - `sheet_id` und `sheet_kind` des aktuellen Blatts (`replaced_at` null)
  - `guest_id`, `guest_anonymized`, Namensspalten
  - `arrival`, `departure`, `apartment_id`, `property_name`, `apartment_name`
  - `search_text` (Gästeblatt- und Buchungsnummer, Name)
- **`guest_sheet_missing` neu definiert:** Buchungen **ohne Gästeblattnummer** (statt ohne Blatt), zusätzlich `apartment_id`, `guest_id`, `guest_anonymized`.

### Umsetzung Backend (2026-11-09)
- Migration `20261109144029_guest_sheet_register.sql` (in Dev):
  - **Neue Sicht `guest_sheet_register`:**
    - Buchungen mit Nummer, nicht storniert, ohne Option, Sperre und „Wohnsitz angemeldet“.
    - Aktuelles Blatt per `left join`.
    - `sort_value` = Ziffern am Ende als Zahl, `sort_prefix` = Vorsatz klein.
    - Gast mit `guest_anonymized`.
    - `search_text` aus Nummer, Buchungsnummer und Name.
  - **`guest_sheet_missing` neu angelegt:** ohne Nummer statt ohne Blatt, dazu `apartment_id`, `guest_id`, `guest_anonymized`.
  - Beide mit `security_invoker`, Lesen für angemeldete Personen per RLS der Grundtabellen.
- **Tests:**
  - Integrationstest „Liste „Gästeblätter““ neu: Reihenfolge 0054, 0053, 0001; nacherfasstes Blatt mit Art; Storno und Wohnsitz ausgeblendet; „ohne Gästeblatt“ mit Wohnung und Gast; fremder Kunde sieht nichts.
  - Bestehender Test an die neue Regel angepasst. Gästeblatt-Integration 17 von 17 grün.
- Die Datenbank-Prüfung meldet nur die bekannte Auth-Warnung.

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

## Implementation Notes (Frontend)

**Gebaut (2026-11-09):**
- **Umbenennung:** „Herkunftsland“ → „Staatsangehörigkeit“ (Gastformular, Detail, Liste, Filter, Zusammenführen, Anonymisieren, Pflichtmeldung, Buchungsdetail); Adress-Staat „Land“ → „Herkunftsland“. Hinweistext der Auswertung „Gästeherkunft“ angepasst; die Rechenregel ändert erst /backend. E2E-Tests (PROJ-7, -8, -29, -37, -48, -50) auf die neuen Feldnamen umgestellt.
- **Stammdaten:** Abschnitt „Kontakt“ mit E-Mail und Telefon (Prüfung wie beim Gast, E-Mail in Kleinbuchstaben).
- **Menüpunkt „Gästeblätter“** (`/gaesteblaetter`, alle Rollen, am Handy unter „Mehr“): Monatsleiste nach Ankunft, „Alle Monate“, Suche, Schalter „Gästeblatt fehlt“, Tabelle bzw. Karten ohne Zeilen-Link (Lfd.-Nr. öffnet das PDF, Nummer die Buchung), Hinweise „Buchung geändert“/„Buchung storniert“, Leerzustände.
- **Buchungsdetail:** Abschnitt „Gästeblatt“ unter „Aufenthalt“ (auch im Kalender-Panel) mit Stand, Lfd.-Nr., Marketing, Hinweisen, Knöpfen „Gästeblatt“ / „Gästeblatt ansehen“ / „Neu unterschreiben lassen“ / „Gästeblatt hochladen“ (Rückfrage bei vorhandenem Blatt), frühere Blätter aufklappbar; Dialog „Gästeblatt hochladen“ (PDF ≤ 10 MB, Lfd.-Nr., Unterschrieben am, Marketing-Häkchen nur mit Gast). Meldung „Gästeblatt gespeichert“ nach der Rückkehr (`?gaesteblatt=gespeichert`).
- **Vollbild-Seite** `/gaesteblatt/[buchung]` (eigener Rahmen `(vollbild)` ohne App-Menü, gleiche Sitzungsprüfung): Seite 1 wie das amtliche Formular mit markierten Pflichtfeldern, PLZ-Automatik, Reisedokument nur bei Nicht-Österreichern, Mitreisende hinzufügen/entfernen, Aufenthalt nur lesen; Speichern beim Verlassen eines Felds bzw. 1,2 s nach der letzten Eingabe, nacheinander in einer Warteschlange mit Stand von Gast und Buchung; Reisedokument erst mit Art und Nummer (Regel der Datenbank); Statusanzeige „Wird gespeichert / Gespeichert / Nicht gespeichert“. Unterschrift 1 erst bei vollständigen und gespeicherten Angaben, jede Änderung danach löscht sie. Seite 2 mit Teil A, Teil B, Kästchen (nie vorausgewählt), Unterschrift 2; „Zurück“, „Fertig“, „Abbrechen“ mit Rückfrage; Konflikt-Dialog „Verwerfen / Als neues Blatt speichern“.
- **Unterschriftsfeld** mit signature_pad 5.1.4: Stift, Finger, Maus; `touch-action: none`; Mindestlänge 60 px; bleibt beim Drehen erhalten; PNG mit transparentem Hintergrund und Zeitpunkt.
- **Einstellungen → Gästeblatt** (nur Inhaber): beide Texte mit dem Editor aus PROJ-39 (Platzhalter-Kontext `guestSheet`: {Kundenname}, {Anschrift}, {E-Mail}, {Telefon}), Vorschau mit den Stammdaten (leer → „–“), Hinweis auf leere Platzhalter, „Auf Standard zurücksetzen“ mit Rückfrage. Ein Text gleich dem Standard wird als „Standard“ (leer) gespeichert.
- **PDF** (`src/lib/guest-sheet-pdf/`): Seite 1 A4 quer als Nachbau des Formulars (Kreuze als Linien), Seite 2 A4 hoch mit Texten, Kästchen und Unterschrift 2; Fußzeile mit Lfd.-Nr. und Seitenzahl; Abreise-Nachtrag mit Vermerk. Im bestehenden Arbeitsprozess (`kind: guestSheet`).
- **Schnittstellen:** `POST /api/gaesteblatt/fertig` (alle Prüfungen neu, PDF, drei Dateien ablegen, Schreibschritt nur mit Service-Rolle, bei Fehler Dateien entfernen), `GET /api/gaesteblatt/[blatt]/pdf` (Original bzw. beim Öffnen mit Abreise erzeugt).

**Abweichung vom Wortlaut der Spec:** Die tatsächliche Abreise ist an der Buchung nie leer (sie läuft mit der geplanten mit, PROJ-30). Darum gilt: Vermerk „nachgetragen am … von …“, sobald jemand nach der Unterschrift die Abreise an der Buchung speichert; sonst ab dem Abreisetag automatisch. Der Edge Case „Abreise wieder geleert“ entfällt.

**Bis zur Migration** (nur bis zum Backend relevant): Lesefunktionen erkennen fehlende Tabellen/Sichten und zeigen Standardtexte, leere Listen und den Hinweis „wird gerade eingerichtet“; Speichern meldet „Diese Funktion wird gerade eingerichtet.“. **Stammdaten (Einstellungen und Betreiber) schlagen bis zur Migration beim Laden fehl** (Spalten `email`, `phone` fehlen; in `src/types/database.ts` von Hand ergänzt, /backend erzeugt die Typen neu).

**Regeln und Dateien**
- `src/lib/guest-sheet.ts`: `guestSheetExpected`, `sheetGaps`/`sheetComplete`, `needsTravelDocument`, Typ `GuestSheetSnapshot`, `sheetDeparture`, Listenfilter, Standardtexte, `sheetPlaceholderValues`, `emptyPlaceholders`, `filledTexts` (Tests: `guest-sheet.test.ts`)
- `src/lib/validation/guest-sheet.ts`: `sheetGuestSchema`, `sheetCompanionSchema`, `sheetNumberSchema`, `sheetUploadSchema`, `guestSheetTextsSchema` (Tests); `checkDoc`/`docField` aus `validation/invoice-settings.ts` jetzt exportiert
- `src/lib/invoice-texts.ts`: Platzhalter mit `scope: 'guestSheet'`, Kontext `'guestSheet'`; Gästeblatt-Platzhalter in Rechnungstexten und umgekehrt „unbekannt“
- `src/lib/guest-sheets-data.ts`: `getGuestSheetSettings`, `getBookingGuestSheets`, `getGuestSheetPage`, `hasAnyGuestSheet`, `getSigningData`
- Aktionen: `src/app/(app)/gaesteblaetter/actions.ts` (`saveSheetGuest`, `saveSheetNumber`, `saveSheetCompanions`, `prepareGuestSheetUpload`, `registerGuestSheetUpload`), `src/app/(app)/einstellungen/gaesteblatt/actions.ts` (`saveGuestSheetTexts`)
- Bausteine `src/components/guest-sheets/`: `booking-guest-sheet`, `guest-sheet-buttons`, `guest-sheet-upload-dialog`, `guest-sheet-saved-toast`, `guest-sheet-filters`, `guest-sheet-list`, `guest-sheet-texts-form`, `signing/` (`guest-sheet-signing`, `sheet-page-one`, `sheet-page-two`, `sheet-form`, `signature-field`)
- PDF: `src/lib/guest-sheet-pdf/` (`types`, `view` mit Tests, `document`, `respond`, `render.integration.test.ts`)
- Texte: `messages/de.json` → `guestSheets.*`, `nav.guestSheets`, `settings.guestSheet`, `tenantData.sections.contact`, `tenantData.fields.email/phone/contactHint`

**Vertrag für /backend** (Namen dürfen sich ändern, dann hier und im Code nachziehen)
- `tenants`: Spalten `email` (Kleinbuchstaben, ≤ 254), `phone` (≤ 40); `update_tenant_master_data` nimmt `email`, `phone`
- Tabelle `guest_sheet_settings` (tenant_id PK, privacy_text jsonb null, marketing_text jsonb null, updated_at, updated_by); Lesen Mitglieder; `save_guest_sheet_texts(p_tenant_id, p_expected_updated_at, p_privacy jsonb, p_marketing jsonb)` nur Inhaber, Stand P0970, deaktivierter Kunde P0016
- Tabelle `guest_sheets` (id, tenant_id, booking_id, guest_id, kind signed|uploaded, sheet_number, marketing_consent, snapshot jsonb, signed_at_1, signed_at_2, signature_1_path, signature_2_path, pdf_path, pdf_sha256, signed_on date, departure_noted_at, departure_noted_by, replaced_at, replaced_by, created_at, created_by); höchstens ein Blatt mit `replaced_at is null` je Buchung; kein direktes Schreiben, kein Löschen durch Nutzer
- Lesesicht `guest_sheet_list` (security_invoker): Spalten des Blatts + booking_number, booking_cancelled, last_name, first_name, title_prefix, title_suffix (Hauptgast des Blatts), arrival, departure (der Buchung), property_name, apartment_name, created_by_name, departure_noted_by_name, `signed_at` (= signed_at_2), `changed` (Ankunft, geplante Abreise, Hauptgast oder Mitreisende weichen von der Fassung ab; nur bei „signed“), `search_text` (Lfd.-Nr., Name, Buchungsnummer)
- Lesesicht `guest_sheet_missing` (security_invoker): Buchungen kind booking, nicht storniert, ohne „Wohnsitz angemeldet“, ohne aktuelles Blatt; booking_id, tenant_id, booking_number, Gastnamen, arrival, departure, property_name, apartment_name, guest_sheet_number, search_text
- `save_guest_sheet_field(p_booking_id, p_target 'guest'|'booking'|'companions', p_values jsonb, p_expected_updated_at)` → neuer `updated_at` des Ziels; Inhaber **und Mitarbeiter**; nur Blatt-Felder (Gast: last_name, first_name, gender, birth_date, country, document_*, street, postal_code, city, address_country; Buchung: guest_sheet_number; companions wie `save_companions`); `app.actor = 'Gästeblatt'` im Protokoll; Stand P0975, nicht vorgesehen P0976, kein Gast P0977, anonymisiert P0978, zu viele Mitreisende P0979
- `register_guest_sheet_upload(p_input jsonb)` (booking_id, pdf_path, sheet_number, signed_on, marketing_consent, previous_sheet_id) für Mitglieder; setzt Lfd.-Nr. an der Buchung, ersetzt das vorherige Blatt, Marketing-Einwilligung am Gast (Datum = signed_on, sonst heute); anderes aktuelles Blatt P0973, nicht vorgesehen P0976, Datei fehlt/fremd P0980
- `finish_guest_sheet(p_input jsonb)` **nur Service-Rolle** (Felder siehe Schnittstelle „fertig“): prüft Stände (P0975), aktuelles Blatt (P0973), Vorgesehen/Gast (P0976–P0978), Pflichtangaben (P0974); schreibt Blatt, ersetzt das vorherige, Marketing-Einwilligung am Gast, Protokoll mit `actor_id`
- `guests`: `marketing_consent_at`, `marketing_consent_sheet_id`; Anonymisieren leert beides; Zusammenführen behält die jüngste Einwilligung; Gast mit Gästeblatt nur anonymisieren; Buchung mit Gästeblatt nicht löschen; Kunde löschen gesperrt wie bei Rechnungen (7 Jahre)
- Trigger an `bookings`: Änderung von `departure` nach der Unterschrift setzt am aktuellen „signed“-Blatt `departure_noted_at`/`_by`
- Speicherbereich `guest-sheets` (privat, PDF und PNG, 10 MB, Ordner je Kunde; Mitglieder laden PDFs hoch und lesen nur verwendete Dateien, Löschen nur der Server); tägliche Bereinigung (`/api/cron/ausweisbilder`) um unbenutzte Dateien erweitern
- Auswertung „Gästeherkunft“ (PROJ-18): `coalesce(address_country, country)` des Hauptgasts

## Implementation Notes (Backend)

**Gebaut (2026-11-09), in Dev eingespielt:** Migration `20261109055811_guest_sheets.sql`. Der Vertrag aus den Frontend-Notizen ist umgesetzt; Abweichungen unten.

- **Tabellen:** `guest_sheet_settings` (je Kunde eine Zeile, Texte jsonb, null = Standard) und `guest_sheets` (unterschrieben/hochgeladen, eingefrorene Fassung, Dateien im Ordner des Kunden, höchstens ein aktuelles Blatt je Buchung per Teilindex, Prüfregeln je Art). Standardfelder und Änderungsprotokoll über `private.enable_tenant_table`. `tenants.email`/`phone`, `guests.marketing_consent_at`/`marketing_consent_sheet_id`.
- **Zugriff:** Lesen nur Mitglieder (ohne Betreiber-Ausnahme), kein direktes Schreiben. `protect_guest_sheet` lehnt jede Änderung außer „ersetzt“, Abreise-Vermerk und Gast (Zusammenführen) und jedes Löschen ab (P0981), außer mit dem ganzen Kunden.
- **Funktionen:** `save_guest_sheet_texts` (nur Inhaber, Stand P0970, Platzhalter- und Längenprüfung), `save_guest_sheet_field` (Inhaber und Mitarbeiter; Ziele `guest`, `booking`, `companions`; Mitreisende über die bestehende `private.save_companions`, deren Codes auf P0975/P0979 umgesetzt werden), `register_guest_sheet_upload`, `finish_guest_sheet` (nur Service-Rolle, im Namen der Person über `request.jwt.claims`, alle Prüfungen inkl. Pflichtangaben `private.guest_sheet_complete` = gleiche Regel wie `sheetGaps`).
- **Protokoll:** `private.audit_row` schreibt bei Änderungen durch eine Person `actor_label` = `app.source` (hier „Gästeblatt“), sonst wie bisher „user“.
- **Lesesichten:** `guest_sheet_list` (mit `changed` aus der Fassung gegen Buchung und Mitreisende, `search_text`) und `guest_sheet_missing`, beide `security_invoker`.
- **Abreise-Nachtrag:** Trigger `guest_sheet_departure` an `bookings` (nur bei geänderter `departure`) setzt am aktuellen unterschriebenen Blatt Zeitpunkt und Person.
- **Bestehende Funktionen ergänzt:** `delete_guest` (mit Gästeblatt nur anonymisieren), `anonymize_guest` (Einwilligung leeren, Blätter bleiben), `merge_guests` (Blätter umhängen, jüngere Einwilligung), `admin_delete_tenant` (Gästeblätter der letzten 7 Kalenderjahre sperren, **P0021** → `retainedGuestSheets`; die Anzahl im Betreiber-Dialog zählt weiterhin nur Rechnungen), `statistics_booking_parts` (`coalesce(address_country, country)`), `update_tenant_master_data` (E-Mail, Telefon).
- **Speicher:** `guest-sheets` (privat, PDF und PNG, 10 MB). Mitglieder laden nur PDFs in den eigenen Ordner; Lesen und Löschen nur der Server. Tägliche Bereinigung (`unused_guest_sheet_files`, `removeUnusedGuestSheetFiles` in `/api/cron/ausweisbilder`); beim Löschen eines Kunden `removeTenantGuestSheets`.
- **Abweichungen vom Vertrag:** Fertigstellen gibt die Kennung direkt zurück (kein Objekt). Die Datenbank prüft beim Staat nur das Format (zwei Großbuchstaben), die Länderliste prüft die App. Die von Hand ergänzten Typen sind durch `npm run db:types` ersetzt.
- **Tests:** `supabase/tests/guest-sheets.integration.test.ts` (14 Tests: Texte, Stammdaten, Feld-Speichern samt Protokoll und Rechten, Option/Wohnsitz, Hochladen mit Ersetzen und Einwilligung, Fertigstellen nur Server mit allen Prüfungen, Unveränderlichkeit, „geändert“, Abreise-Nachtrag, „fehlt“, Löschen/Anonymisieren/Zusammenführen, Speicherregeln, Bereinigung). Grün außerdem: guests, companies, statistics, operator, team, bookings, rls (Integration) und alle Unit-Tests; Cron-Test ergänzt. Advisors nur mit der bekannten Auth-Warnung „OTP-Ablauf“.
- **Durchgeklickt** (gebauter Server, Chrome 1180 × 820, als Mitarbeiter): Felder ergänzen und speichern, Ort aus der PLZ, Unterschrift 1, „Weiter“, Einwilligung, Unterschrift 2, „Fertig“ → Buchung mit „Gästeblatt gespeichert“, PDF abrufbar (Bild geprüft), Liste, Hochladen ersetzt das Blatt.
- **Für /deploy:** Migration vor dem Code einspielen. Ohne sie lädt die Seite „Stammdaten“ nicht (Spalten E-Mail/Telefon).

## QA Test Results

**Tested:** 2026-11-09
**App URL:** http://localhost:3000 (gebauter Server, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)
**Browser:** Chrome (Desktop 1440, Vollbild 1180 × 820, Tablet 768 mit Touch, Handy 375). Firefox und Safari nicht gelaufen (optional, siehe Open Points); **kein Test auf einem echten iPad mit Stift**.

### Acceptance Criteria Status

#### Umbenennung
- [x] Gastformular „Staatsangehörigkeit“ und „Herkunftsland“ (Adresse), Hinweistext; Daten unverändert (E2E)
- [x] Gästeliste: Spalte „Staatsangehörigkeit“ (E2E)
- [x] „Gästeherkunft“: Herkunftsland laut Adresse, sonst Staatsangehörigkeit (Code-Review, Statistik-Integrationstests grün)

#### Abschnitt in der Buchung
- [x] „Noch kein Gästeblatt“ mit „Gästeblatt“ und „Gästeblatt hochladen“; Mitarbeiter sieht beides (E2E)
- [x] Kein Abschnitt bei Option und „Wohnsitz angemeldet“ (E2E); Sperren und Stornos ohne Blatt (Code-Review)
- [x] Anonymisierter Gast: „Gästeblatt“ gesperrt mit Hinweis, Hochladen ohne Marketing-Häkchen (E2E). „Buchung ohne Gast“ gibt es nicht: Die Datenbank verlangt bei Buchungen immer einen Gast
- [x] „Neu unterschreiben lassen“ mit Rückfrage, altes Blatt unter „Frühere Gästeblätter“ (E2E)

#### Vollbild-Ansicht und Seite 1
- [x] Ohne App-Menü, Kundenname, Fortschritt (E2E)
- [x] Fehlende Pflichtfelder markiert, Unterschrift gesperrt mit Hinweis (E2E)
- [x] Eingetipptes Feld wird am Gast gespeichert, Protokoll „Gästeblatt“ (E2E + Integration)
- [x] Geburtsdatum in der Zukunft: Meldung, nicht gespeichert (E2E)
- [x] Österreich ohne Reisedokument, Italien mit allen fünf Dokumentfeldern (E2E)
- [x] „keine Angabe“ zählt als Geschlecht (Unit)
- [x] Fehlende Mitreisende hinzufügen; Unterschrift erst bei vollständigen Mitreisenden (E2E)
- [x] PLZ 6020 füllt „Innsbruck“ (E2E)
- [x] Mitarbeiter korrigiert die Straße, gespeichert (E2E)
- [x] Ankunft/Abreise nur lesen, tatsächliche Abreise leer (E2E)
- [x] „Weiter“ gesperrt ohne Unterschrift; nach Änderung wird Unterschrift 1 gelöscht mit Hinweis (E2E)
- [x] BUG-1 behoben: Unterschrift direkt nach einer Eingabe bleibt (E2E)
- [ ] Stift (iPad) und Finger (Handy) nicht auf echten Geräten geprüft; Maus am Desktop funktioniert (E2E)

#### Seite 2 und Abschluss
- [x] Teil A ohne Kästchen, Teil B mit Kästchen, nicht vorausgewählt; Platzhalter gefüllt (E2E, PDF-Test)
- [x] „Fertig“ erst nach Unterschrift 2; „Zurück“ behält Unterschrift 1 (E2E)
- [x] Mit Häkchen: Einwilligung am Gast mit Verweis aufs Blatt (E2E + Integration); ohne Häkchen keine Änderung (Integration)
- [x] Rückkehr zur Buchung mit „Gästeblatt gespeichert“ und „Unterschrieben am …“ (E2E)
- [x] PDF Seite 1 Meldedaten, Seite 2 Datenschutz mit Kästchen und Unterschriften (Render-Test, Bild geprüft)
- [x] Eingefrorene Fassung: spätere Text- und Gaständerungen wirken nicht (Code-Review: Fassung wird beim Fertigstellen geschrieben, Ansicht nur daraus)
- [x] „Abbrechen“ mit Rückfrage: ergänzte Daten bleiben, kein Blatt (E2E)

#### Nachtrag Abreise und Änderungen
- [x] Abreise-Nachtrag mit Person (Integration + PDF-Test); automatisch ab Abreisetag (Unit)
- [x] Verschobene Ankunft → Hinweis in Buchung und Liste (E2E)
- [x] Storno: Blatt bleibt, Hinweis (E2E)
- [x] Hochgeladene Blätter ohne Nachtrag und Änderungshinweis (Code-Review)

#### Hochladen
- [x] PDF mit Lfd.-Nr. und Datum, Lfd.-Nr. an der Buchung (E2E)
- [x] Andere Dateiart: Meldung (E2E); über 10 MB (Code-Review, Speicherbereich 10 MB)
- [x] Ohne Pflichtfeld-Prüfung (E2E: Gast ohne Geburtsdatum)
- [x] Einwilligung mit Unterschriftsdatum (E2E)
- [x] Ersetzen mit Rückfrage (E2E)

#### Menüpunkt „Gästeblätter“
- [x] Menüpunkt für beide Rollen; Leerzustand (E2E)
- [x] Zeile mit PDF-Link, Buchungslink, Art (E2E); ersetzte Blätter nicht in der Liste (Code-Review, Abfrage `replaced_at is null`)
- [x] „Gästeblatt fehlt“ ohne „Wohnsitz angemeldet“ und ohne Buchungen mit Blatt (E2E)
- [x] Suche ohne Treffer (E2E)
- [x] Fremder Kunde: PDF 404, Vollbild 404 (E2E)

#### Einstellungen → Gästeblatt
- [x] Reiter nur für Inhaber, Mitarbeiter 404 (E2E)
- [x] Standardtexte; unbekannter Platzhalter abgelehnt; Hinweis auf leere Stammdaten (E2E)
- [x] Leerer Text abgelehnt (Unit + Integration)
- [x] BUG-2 behoben: „Auf Standard zurücksetzen“ zeigt den Standardtext sofort (E2E)
- [x] Stammdaten mit E-Mail und Telefon, erscheinen im Text (E2E)

#### Aufbewahrung
- [x] Gast mit Gästeblatt wird nur anonymisiert, Blatt bleibt (Integration)
- [x] Buchungen lassen sich ohnehin nur stornieren (bestehende Regel); Gästeblätter nicht löschbar, auch nicht direkt (Integration)

### Edge Cases Status
- [x] Zwei Geräte gleichzeitig: Dialog „Verwerfen / Als neues Blatt speichern“, ersetzt das andere Blatt (E2E)
- [x] Buchung/Gast inzwischen geändert: „Fertig“ lehnt ab (Integration P0975); Feld-Speichern mit Stand (Integration)
- [x] Mehr Mitreisende als Personen: Unterschrift gesperrt (Unit), Datenbank lehnt ab (Integration)
- [x] Viele Mitreisende im PDF (8, eine Seite; Render-Test)
- [x] Staatsangehörigkeit Österreich: Dokumentbereich verschwindet (E2E)
- [x] Anonymisierter Gast: Blatt gesperrt (E2E)
- [x] Kundenwechsel in anderem Tab: Aktionen prüfen den Kunden des Blatts (Code-Review; „Fertig“ mit fremdem Kunden → 403, E2E)
- [x] BUG-3 behoben: Nach dem Anonymisieren kein falscher Änderungshinweis (Integration)
- [x] BUG-4 behoben: Lösch-Dialog kündigt das Anonymisieren an (E2E)

### Security Audit Results
- [x] Ohne Anmeldung: PDF-Schnittstelle leitet zur Anmeldung um (E2E)
- [x] Fremder Kunde: PDF 404, Vollbild 404, gefälschtes „Fertig“ 403 (E2E); Lesesichten und Tabellen leer für fremde Kunden (Integration)
- [x] Fertigstellen nur Service-Rolle; Mitglieder können `finish_guest_sheet` nicht aufrufen (Integration)
- [x] Unterschriebene Blätter unveränderlich, auch für die Service-Rolle (Integration)
- [x] Speicher: Mitglieder nur PDF im eigenen Ordner, keine Bilder, kein fremder Ordner, kein Lesen/Löschen (Integration)
- [x] Ungültige Eingaben an „fertig“ → 400 (E2E); Fassung baut der Server aus der Datenbank, nicht aus Browserdaten (Code-Review)
- [x] Mitarbeiter: nur Blatt-Felder am Gast (Integration: E-Mail abgelehnt)
- [x] XSS: Datenschutz-Texte werden als Textknoten dargestellt (React), PDF ohne HTML (Code-Review)
- [x] PDF-Antworten `no-store` (E2E)
- [ ] Hinweis: keine eigene Ratenbegrenzung für „fertig“ und PDF; die Last begrenzt der PDF-Arbeitsprozess (3 gleichzeitig, 12 wartend). Nur angemeldete Mitglieder können aufrufen; für den Pilot vertretbar

### Regression
- [x] E2E: PROJ-7 (15), PROJ-48 (10), PROJ-28 (19; ein Test im Gesamtlauf ausgefallen, einzeln grün), Auszüge PROJ-8, -29, -37, -50 mit den umbenannten Feldern
- [x] Integration: guests, companies, statistics, operator, team, bookings, rls, guest-sheets; alle Unit-Tests

### Bugs Found

#### BUG-1: Unterschrift 1 geht verloren, wenn man direkt nach einer Eingabe unterschreibt — behoben
- **Severity:** High
- **Steps to Reproduce:**
  1. Gästeblatt öffnen, ein Feld ergänzen (z. B. Lfd.-Nr.), dann sofort auf die Unterschriftsfläche schreiben
  2. Expected: „Unterschrieben.“, „Weiter“ aktiv
  3. Actual: Die Unterschrift erscheint kurz und wird gelöscht („Die Angaben wurden geändert …“), „Weiter“ bleibt gesperrt
- **Ursache (nach Messung im Browser):** Die Unterschriftsfläche war gesperrt, solange die zuletzt ergänzten Angaben gespeichert wurden (bis gut 1 s). Ein Strich in dieser Zeit wurde verworfen. Zusätzlich meldet `form.subscribe` auch Zustände ohne geänderte Werte (Prüfung beim Verlassen eines Felds)
- **Priority:** Fix before deployment (die Unterschrift ist der Kern des Ablaufs; am Tablet wechselt man typischerweise direkt vom Feld zum Stift)

#### BUG-2: „Auf Standard zurücksetzen“ ändert den Editor nicht — behoben
- **Severity:** Medium
- **Steps to Reproduce:** Einstellungen → Gästeblatt, Text ändern, „Auf Standard zurücksetzen“ bestätigen
- **Expected:** Editor zeigt den Standardtext. **Actual:** Editor zeigt weiter den geänderten Text; gespeichert wird aber der Standard (nach Neuladen sichtbar). Tippt man danach im Editor, gilt wieder der alte Text
- **Ursache:** Der Editor aus PROJ-39 übernimmt Werte von außen nicht
- **Priority:** Fix before deployment

#### BUG-3: Falscher Änderungshinweis nach dem Anonymisieren — behoben
- **Severity:** Low
- **Steps to Reproduce:** Buchung mit Mitreisenden unterschreiben lassen, Gast anonymisieren
- **Actual:** Anonymisieren entfernt die Mitreisenden der Buchung; Blatt und Liste zeigen „Buchung nach der Unterschrift geändert“
- **Priority:** Nice to have

#### BUG-4: Lösch-Dialog kündigt „endgültig löschen“ an, obwohl anonymisiert wird — behoben
- **Severity:** Low
- **Steps to Reproduce:** Gast unterschreibt, Buchung wird einem anderen Gast zugeordnet, ersten Gast löschen
- **Actual:** Dialog-Text „löschen“, Ergebnis „anonymisiert“ (Gästeblatt muss erhalten bleiben). Seltener Fall
- **Priority:** Nice to have

### Korrekturen (2026-11-09)
- **BUG-1:** Die Unterschriftsfläche ist offen, sobald alle Pflichtangaben eingetragen sind; laufendes Speichern sperrt sie nicht mehr. „Weiter“ wartet, bis alles gespeichert ist, und bleibt mit der Meldung „Einige Angaben konnten nicht gespeichert werden …“ auf Seite 1, wenn etwas nicht gespeichert werden konnte (z. B. Geburtsdatum in der Zukunft). Unterschrift 1 wird nur noch bei tatsächlich geänderten Werten gelöscht. „Fertig“ prüft wie bisher auf dem Server Stand und Pflichtangaben
- **BUG-2:** Nach „Auf Standard zurücksetzen“ wird der Editor auf der Gästeblatt-Seite neu aufgebaut und zeigt den Standardtext (Editor aus PROJ-39 unverändert)
- **BUG-3:** Migration `20261109065600_guest_sheets_qa_fixes.sql`: `guest_sheet_list` vergleicht die Mitreisenden nur bei nicht anonymisiertem Gast (in Dev eingespielt)
- **BUG-4:** `GuestStays.guestSheets` zählt die Gästeblätter; der Lösch-Dialog kündigt dann das Anonymisieren an (eigener Text „mit Gästeblättern verknüpft“)
- **Tests:** E2E „QA-Korrekturen“ (BUG-1 direkt nach der Eingabe unterschreiben, BUG-1 „Weiter“ bei nicht speicherbarer Angabe, BUG-4), Einstellungen-Test prüft den Editor sofort (BUG-2), Integrationstest BUG-3; die vorläufigen Umgehungen sind entfernt. Alle 20 Gästeblatt-E2E-Tests, 15 Integrationstests, alle Unit-Tests (966), Lint, Build und die Löschtests von PROJ-7 grün
- **Zusätzlich gefunden:** Die Testhilfe „Gespeichert“ traf auch „Wird gespeichert …“; jetzt exakt

### Open Points (keine Fehler)
- Test auf einem echten iPad mit Stift und einem Handy mit Finger (Scrollen beim Schreiben, Druck, Drehen)
- Firefox und Safari nicht geprüft
- Betreiber-Dialog „Kunde löschen“ zählt vorab nur Rechnungen; mit Gästeblättern kommt die Sperre erst beim Löschen (eigene Meldung)

### Summary
- **Acceptance Criteria:** 47 von 48 Prüfgruppen bestätigt (nach den Korrekturen); offen nur der Test auf echten Geräten (Stift/Finger)
- **Bugs Found:** 4 total (0 critical, 1 high, 1 medium, 2 low), alle behoben und mit Tests abgesichert
- **Security:** Pass
- **Production Ready:** YES, vorbehaltlich eines Tests auf einem echten iPad mit Stift (auf Staging)
- **Recommendation:** Deploy; auf Staging einmal am iPad unterschreiben


## Deployment

**Ausgeliefert:** 2026-11-09, Stand `97753a5`, Tag `v1.43.0-PROJ-26`
- **Staging:** https://staging.apppa.at (2026-11-09), Migrationen eingespielt, Advisors nur „OTP-Ablauf“
- **Production:** https://app.apppa.at (2026-11-09), Migrationen eingespielt, Advisors nur „OTP-Ablauf“; Funktion vom Nutzer bestätigt
- **Migrationen:** `20261109055811_guest_sheets.sql`, `20261109065600_guest_sheets_qa_fixes.sql`
- **Kein** `config push`, keine neuen Umgebungsvariablen; neues npm-Paket `signature_pad` 5.1.4
- **Nachbesserung ausgeliefert:** 2026-11-09, Stand `2f8929d`, Tag `v1.44.0-PROJ-26`, Staging und Production; Migration `20261109081035_guest_sheets_email_images.sql`; Advisors nur „OTP-Ablauf“
- **Rückmeldung nach dem Deploy (iPad):** Felder auf Seite 1 teils überlappend bzw. eng; Wunsch: E-Mail-Adresse auf Seite 2 erfassen, wenn der Hauptgast keine hat → umgesetzt (Abschnitt „Nachbesserung nach dem Deploy“)
- **Erweiterung Kennzahl und Gästeblattnummer je Gemeinde ausgeliefert:** 2026-11-09, Stand `f56bbde`, Tag `v1.45.0-PROJ-26`, Staging und Production; Migrationen `20261109110308_guest_sheet_numbering.sql`, `20261109121212_guest_sheet_numbering_qa_fixes.sql`, `20261109121457_guest_sheet_options_id.sql`; Advisors nur „OTP-Ablauf“; kein `config push`, keine neuen Umgebungsvariablen. Nach dem Deploy: Nummernbereiche je Gemeinde in Einstellungen → Gästeblatt erfassen
