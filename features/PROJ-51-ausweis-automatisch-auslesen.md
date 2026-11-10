# PROJ-51: Ausweis automatisch auslesen

## Status: In Progress
**Created:** 2026-11-10
**Last Updated:** 2026-11-10

## Dependencies
- Requires: PROJ-7 (Gäste-Datenbank): Name, Geburtsdatum, Staatsangehörigkeit, Länderliste
- Requires: PROJ-29 (Gast-Erweiterung): Reisedokument mit Art, Dokument-ID, Ausstellungsdatum, Behörde, Staat; Bilder Vorder- und Rückseite; Geschlecht
- Requires: PROJ-26 (Gästeblatt): Seite 1 mit Bereich „Reisedokument“ und Bildaufnahme, Speichern einzelner Blatt-Felder auch durch Mitarbeiter, Datenschutz-Standardtext
- Requires: PROJ-5 (Betreiber-Admin): Freischaltung je Kunde und Verbrauchsanzeige

## Überblick
Beim Check-in liegen meist nur die Namen des Gastes vor. Bei Gästen mit ausländischer Staatsangehörigkeit wird der Ausweis fotografiert und die Dokumentdaten werden von Hand eingetippt. Neu liest die App auf Knopfdruck die Bilder des Ausweises mit einem KI-Dienst aus. Danach zeigt sie eine Gegenüberstellung mit den vorhandenen Gastdaten. Übernommen wird erst nach Bestätigung.

Die Funktion ist **experimentell**. Der Betreiber schaltet sie je Kunde frei, ein Tageslimit begrenzt die Kosten. Den Zugang zum KI-Dienst stellt der Betreiber, und er liegt nur auf dem Server. Kunden sehen ihn nie und können ihn nur über diese eine Funktion nutzen.

### Ausgelesene Angaben
| Angabe | Ziel am Gast | Hinweise |
|---|---|---|
| Art des Dokuments | Reisedokument: Art | Nur „Reisepass“, „Personalausweis“, „Führerschein“. Ausländische Identitätskarten gelten als „Personalausweis“. Andere Dokumente (z. B. Aufenthaltstitel) ergeben keinen Vorschlag |
| Dokument-ID | Reisedokument: Dokument-ID | ohne Leerzeichen, höchstens 30 Zeichen |
| Ausstellungsdatum | Reisedokument: Ausstellungsdatum | nicht in der Zukunft |
| Ausstellende Behörde | Reisedokument: Behörde | wie aufgedruckt in lateinischer Schrift, höchstens 100 Zeichen |
| Ausstellender Staat | Reisedokument: Staat | aus der Länderliste (PROJ-7) |
| Nachname | Nachname | lateinische Schreibweise des Ausweises |
| Vorname(n) | Vorname | alle Vornamen wie auf dem Ausweis |
| Geburtsdatum | Geburtsdatum | nicht in der Zukunft, nicht vor 1900 |
| Geschlecht | Geschlecht | nur weiblich/männlich. „X“ oder nicht angegeben ergibt keinen Vorschlag |
| Staatsangehörigkeit | Staatsangehörigkeit | aus der Länderliste (PROJ-7) |

Ausgelesen wird nur für den **Hauptgast**. Die Bilder sind die bereits gespeicherten Ausweisbilder des Gastes (PROJ-29). Vorder- und Rückseite werden in einem Durchgang gelesen.

### Wo und für wen
| Stelle | Wer | Wann sichtbar |
|---|---|---|
| Gästeblatt, Seite 1, Bereich „Reisedokument“ (PROJ-26) | Inhaber und Mitarbeiter | Kunde freigeschaltet, Bereich „Reisedokument“ wird angezeigt (Staatsangehörigkeit nicht Österreich) und mindestens ein Ausweisbild des Gastes ist vorhanden, auch ein auf dem Blatt aufgenommenes |
| Gastformular, Abschnitt „Reisedokument“ (Gästeseite, neuer Gast im Buchungsformular, Rechnungsnacherfassung) | wer dort Reisedokument und Bilder bearbeiten darf (PROJ-29): Inhaber; Mitarbeiter nur beim neuen Gast im Buchungsformular | Kunde freigeschaltet und mindestens ein Ausweisbild vorhanden, unabhängig von der Staatsangehörigkeit |

### Ablauf
1. Knopf **„Ausweis auslesen“** drücken. Die App zeigt „Ausweis wird gelesen …“, der Knopf ist so lange gesperrt.
2. Es öffnet sich die Gegenüberstellung mit einer Zeile je Angabe: **Feld | Vorhanden | Vom Ausweis | Auswahl**.
   - **Gleich:** abgehakt, nichts zu tun.
   - **Feld leer, Ausweis hat einen Wert:** Ausweiswert vorausgewählt.
   - **Abweichung:** rot markiert, **Ausweiswert vorausgewählt**. Der vorhandene Wert ist per Klick wählbar.
   - **Unsicher** (schlecht lesbar oder Prüfung fehlgeschlagen, z. B. Prüfziffer der maschinenlesbaren Zone): gelb mit „Bitte prüfen“, **nicht vorausgewählt**, mit einem Klick trotzdem übernehmbar.
   - **Nicht gefunden:** „–“, der vorhandene Wert bleibt.
3. **„Übernehmen“** speichert die gewählten Werte am Gast. **„Abbrechen“** verwirft das Ergebnis, es wird nichts gespeichert.
4. Übernommene Werte erscheinen im Formular bzw. auf dem Blatt. Im Änderungsprotokoll stehen sie mit dem Vermerk „aus Ausweis gelesen“.

Im Gastformular füllt „Übernehmen“ nur die Formularfelder. Gespeichert wird wie bisher mit „Speichern“. Auf dem Gästeblatt wird sofort gespeichert, wie bei jedem Blatt-Feld (PROJ-26). Eine bereits geleistete Unterschrift 1 wird dabei gelöscht, wie bei jeder Änderung.

### Freischaltung und Verbrauch (Betreiber)
- Im Betreiber-Admin hat jeder Kunde den Schalter **„Ausweis automatisch auslesen (experimentell)“**, Standard aus.
- **Tageslimit** je Kunde, Standard 50 Auslesungen pro Tag (Wiener Zeit), vom Betreiber änderbar.
- Anzeige je Kunde: Anzahl Auslesungen im laufenden und im letzten Monat.
- Gezählt wird jede Auslesung, die den KI-Dienst erreicht hat, auch ohne Übernahme. Fehlgeschlagene Verbindungen zählen nicht.
- Inhaber und Mitarbeiter sehen weder Schalter noch Zähler. Bei abgeschalteter Funktion gibt es keinen Knopf.

### Datenschutz
- Der Standardtext der Datenschutz-Information (Einstellungen → Gästeblatt, Teil A) bekommt einen Satz, dass Ausweisbilder zum Auslesen der Angaben an einen Auftragsverarbeiter übermittelt werden. Den genauen Wortlaut legt der Nutzer fest.
- Eigene, geänderte Texte der Kunden bleiben unverändert. Beim Freischalten sieht der Inhaber in Einstellungen → Gästeblatt einmalig den Hinweis, seinen Text zu prüfen.
- Das Ergebnis der Auslesung wird in der App nicht gespeichert, nur die übernommenen Werte. Protokolliert werden Zeitpunkt, Person, Gast und Erfolg, ohne die gelesenen Werte.

## User Stories
- Als **Mitarbeiter** möchte ich beim Check-in den Ausweis eines ausländischen Gastes fotografieren und die Angaben auf Knopfdruck auslesen lassen, damit ich sie nicht am Tablet abtippen muss.
- Als **Inhaber** möchte ich sehen, wo der Ausweis von den gespeicherten Gastdaten abweicht, zum Beispiel bei einem zweiten Vornamen, damit das Gästeblatt die amtlich richtigen Angaben enthält.
- Als **Inhaber** möchte ich, dass ohne meine Bestätigung nichts überschrieben wird, damit ein Lesefehler keine richtigen Daten zerstört.
- Als **Inhaber** möchte ich auch bei einem Ausweisbild, das ich nachträglich im Gastformular hochlade, die Angaben auslesen lassen, damit ich Altfälle schnell nachtragen kann.
- Als **Betreiber** möchte ich die Funktion je Kunde freischalten und die Zahl der Auslesungen sehen, damit ich das Experiment und die Kosten im Griff habe.
- Als **Betreiber** möchte ich, dass der Zugang zum KI-Dienst nur auf dem Server liegt und nur für diese Funktion genutzt werden kann, damit er nicht missbraucht wird.

## Out of Scope
- **Mitreisende:** Für sie gibt es kein Reisedokument (PROJ-29, PROJ-26)
- **Adresse vom Ausweis** (z. B. Rückseite des deutschen Personalausweises): später möglich, nicht in diesem Schritt
- **Ablaufdatum („gültig bis“) und Echtheitsprüfung des Ausweises:** nicht vorgesehen (PROJ-29 kennt kein Ablaufdatum)
- **Automatisches Auslesen ohne Klick** nach jedem Bild: bewusst nicht, siehe Entscheidungen
- **Weitere Dokumentarten** (Aufenthaltstitel, Visum): kein Vorschlag, die Art bleibt Handeingabe
- **Kosten in Euro je Kunde und Weiterverrechnung:** nur die Anzahl, die Abrechnung läuft außerhalb der App (PRD)
- **Schalter oder Zähler für Inhaber:** nur Betreiber
- **Speichern des vollständigen Ausleseergebnisses** in der App
- **Auslesen ohne vorhandenes Ausweisbild**, etwa Live-Kamera mit laufender Erkennung
- **Eigener KI-Zugang je Kunde:** Es gibt nur den Zugang des Betreibers

## Acceptance Criteria

### Freischaltung und Sichtbarkeit
- [ ] Angenommen ein Kunde ist nicht freigeschaltet, wenn ein Nutzer Gastformular oder Gästeblatt öffnet, dann gibt es keinen Knopf „Ausweis auslesen“
- [ ] Angenommen der Betreiber öffnet einen Kunden im Betreiber-Admin, wenn er den Schalter „Ausweis automatisch auslesen (experimentell)“ einschaltet, dann sehen die Nutzer dieses Kunden den Knopf, sobald ein Ausweisbild vorhanden ist; der Schalter steht bei neuen Kunden auf aus
- [ ] Angenommen ein Inhaber oder Mitarbeiter, wenn er Einstellungen oder Betreiber-Admin aufruft, dann sieht er weder Schalter noch Tageslimit noch Zähler
- [ ] Angenommen ein freigeschalteter Kunde und ein Gast ohne Ausweisbild, wenn der Abschnitt „Reisedokument“ angezeigt wird, dann gibt es keinen Knopf „Ausweis auslesen“
- [ ] Angenommen ein Gästeblatt eines österreichischen Gastes, wenn Seite 1 angezeigt wird, dann gibt es keinen Bereich „Reisedokument“ und keinen Knopf
- [ ] Angenommen ein Gästeblatt eines deutschen Gastes ohne gespeicherte Bilder, wenn auf dem Blatt die Vorderseite aufgenommen wird, dann erscheint der Knopf „Ausweis auslesen“
- [ ] Angenommen ein Mitarbeiter öffnet einen bestehenden Gast im Gast-Detail, wenn er den Abschnitt „Reisedokument“ ansieht, dann gibt es keinen Knopf (er darf das Reisedokument dort nicht ändern, PROJ-29)
- [ ] Angenommen ein Mitarbeiter legt im Buchungsformular einen neuen Gast an und lädt ein Ausweisbild hoch, wenn der Kunde freigeschaltet ist, dann kann er „Ausweis auslesen“ verwenden

### Auslesen und Gegenüberstellung
- [ ] Angenommen ein Gast mit Bildern von Vorder- und Rückseite, wenn „Ausweis auslesen“ gedrückt wird, dann werden beide Seiten in einem Durchgang gelesen und es zählt eine Auslesung
- [ ] Angenommen das Auslesen läuft, wenn der Nutzer wartet, dann zeigt die App „Ausweis wird gelesen …“ und der Knopf ist gesperrt
- [ ] Angenommen ein Gast „Muster, Maria“ ohne Geburtsdatum und ohne Reisedokument, wenn ein Reisepass „Muster, Maria Theresia“, geboren 12.03.1985, gelesen wird, dann zeigt die Gegenüberstellung den Vornamen als rot markierte Abweichung mit vorausgewähltem Ausweiswert, das Geburtsdatum und alle Dokumentangaben als vorausgewählte Ausweiswerte und den Nachnamen als gleich (abgehakt)
- [ ] Angenommen eine Abweichung ist vorausgewählt, wenn der Nutzer den vorhandenen Wert anklickt, dann wird beim Übernehmen der vorhandene Wert behalten
- [ ] Angenommen ein Wert ist unsicher, wenn die Gegenüberstellung erscheint, dann steht er gelb mit „Bitte prüfen“ und ist nicht vorausgewählt; nach einem Klick wird er übernommen
- [ ] Angenommen eine Angabe ist auf dem Ausweis nicht zu finden, wenn die Gegenüberstellung erscheint, dann steht dort „–“ und der vorhandene Wert bleibt
- [ ] Angenommen eine Schweizer Identitätskarte, wenn sie gelesen wird, dann wird als Art „Personalausweis“ vorgeschlagen
- [ ] Angenommen ein Aufenthaltstitel, wenn er gelesen wird, dann gibt es für die Art keinen Vorschlag; die übrigen gelesenen Angaben werden angezeigt
- [ ] Angenommen ein Ausweis mit Geschlecht „X“, wenn er gelesen wird, dann gibt es für das Geschlecht keinen Vorschlag
- [ ] Angenommen ein gelesenes Ausstellungs- oder Geburtsdatum liegt in der Zukunft (bzw. vor 1900), wenn die Gegenüberstellung erscheint, dann ist der Wert unsicher markiert und nicht vorausgewählt
- [ ] Angenommen der Ausweis nennt Staat und Staatsangehörigkeit (z. B. „D“ / „DEUTSCH“), wenn die Gegenüberstellung erscheint, dann werden sie als Länder der Länderliste angezeigt („Deutschland“)
- [ ] Angenommen eine gelesene Dokument-ID enthält Leerzeichen, wenn sie angezeigt wird, dann ist sie ohne Leerzeichen; ist sie länger als 30 Zeichen, ist sie unsicher markiert

### Übernehmen
- [ ] Angenommen die Gegenüberstellung im Gastformular, wenn „Übernehmen“ gedrückt wird, dann stehen die gewählten Werte in den Formularfeldern und erst „Speichern“ speichert sie
- [ ] Angenommen die Gegenüberstellung auf dem Gästeblatt, wenn „Übernehmen“ gedrückt wird, dann werden die gewählten Werte sofort am Gast gespeichert und die Statusanzeige zeigt „Gespeichert“
- [ ] Angenommen auf dem Gästeblatt ist Unterschrift 1 schon geleistet, wenn Werte übernommen werden, die etwas ändern, dann wird Unterschrift 1 gelöscht (wie bei jeder Änderung, PROJ-26)
- [ ] Angenommen die Gegenüberstellung, wenn „Abbrechen“ gedrückt wird, dann wird nichts geändert und nichts gespeichert
- [ ] Angenommen Werte wurden übernommen und gespeichert, wenn das Änderungsprotokoll angesehen wird, dann stehen die Änderungen mit Person, Zeitpunkt und dem Vermerk „aus Ausweis gelesen“
- [ ] Angenommen ein Mitarbeiter auf dem Gästeblatt, wenn er Werte übernimmt, dann werden nur Felder gespeichert, die er auf dem Blatt ändern darf (PROJ-26)

### Limit und Zähler
- [ ] Angenommen ein Kunde hat das Tageslimit erreicht, wenn ein Nutzer „Ausweis auslesen“ drückt, dann erscheint „Das Tageslimit für das Auslesen ist erreicht. Bitte die Angaben von Hand eintragen.“ und es wird nichts gelesen
- [ ] Angenommen der Betreiber ändert das Tageslimit eines Kunden, wenn er speichert, dann gilt das neue Limit ab sofort
- [ ] Angenommen der Betreiber öffnet einen freigeschalteten Kunden, wenn er den Abschnitt ansieht, dann sieht er die Anzahl der Auslesungen im laufenden und im letzten Monat
- [ ] Angenommen der KI-Dienst ist nicht erreichbar, wenn ausgelesen wird, dann zählt das nicht als Auslesung

### Fehler
- [ ] Angenommen der KI-Dienst ist nicht erreichbar oder antwortet nicht rechtzeitig, wenn ausgelesen wird, dann erscheint „Der Ausweis konnte gerade nicht gelesen werden. Bitte später erneut versuchen oder von Hand eintragen.“ und alle Felder bleiben bearbeitbar
- [ ] Angenommen ein Bild zeigt keinen Ausweis oder ist unlesbar, wenn ausgelesen wird, dann erscheint „Auf dem Bild wurde kein Ausweis erkannt. Bitte neu fotografieren.“ und es wird nichts vorgeschlagen
- [ ] Angenommen ein Nutzer gehört zu Kunde A, wenn er versucht, das Auslesen für einen Gast von Kunde B auszulösen (auch direkt über den Server), dann wird es abgelehnt und nicht gezählt
- [ ] Angenommen ein Kunde ist nicht freigeschaltet, wenn das Auslesen direkt über den Server ausgelöst wird, dann wird es abgelehnt
- [ ] Angenommen ein beliebiger Nutzer, wenn er den Browser-Quelltext oder die Netzwerkanfragen ansieht, dann ist der Zugang zum KI-Dienst nirgends enthalten

### Datenschutz
- [ ] Angenommen ein Kunde mit unverändertem Standardtext, wenn Seite 2 des Gästeblatts angezeigt wird, dann enthält Teil A den Satz zur Übermittlung an einen Auftragsverarbeiter
- [ ] Angenommen ein Kunde mit eigenem Text in Teil A, wenn der Betreiber ihn freischaltet, dann bleibt der Text unverändert und der Inhaber sieht in Einstellungen → Gästeblatt einmalig einen Hinweis, ihn zu prüfen
- [ ] Angenommen eine Auslesung wurde durchgeführt, wenn das Protokoll angesehen wird, dann stehen Zeitpunkt, Person, Gast und Erfolg, aber keine gelesenen Werte

## Edge Cases
- **Bild nach dem Auslesen ersetzt oder entfernt:** Eine offene Gegenüberstellung wird verworfen, der Nutzer liest neu aus.
- **Gast wurde inzwischen anderswo geändert** (z. B. zweites Gerät): Auf dem Blatt gilt die Konfliktregel von PROJ-26. Im Gastformular die übliche Regel beim Speichern.
- **Anonymisierter Gast:** keine Bilder, also kein Knopf (PROJ-7, PROJ-29).
- **Zwei Klicks kurz hintereinander:** Der Knopf ist während des Lesens gesperrt, es entsteht nur eine Auslesung.
- **Ausweis in nicht lateinischer Schrift** (z. B. Kyrillisch): Namen nach der lateinischen Fassung auf dem Ausweis (maschinenlesbare Zone). Gibt es keine, ist der Wert unsicher.
- **Nur Rückseite vorhanden:** wird gelesen. Fehlende Angaben stehen als „–“.
- **Ausweis gehört offensichtlich zu einer anderen Person** (Name und Geburtsdatum weichen beide ab): Alle Abweichungen rot. Zusätzlich oben der Hinweis „Der Ausweis passt möglicherweise nicht zu diesem Gast.“ In diesem Fall ist bei Name und Geburtsdatum **nichts vorausgewählt**.
- **Freischaltung wird während einer offenen Seite abgeschaltet:** Der nächste Klick wird abgelehnt mit „Das Auslesen ist für diesen Kunden nicht freigeschaltet.“
- **Art „Führerschein“:** wird gelesen. Staatsangehörigkeit steht dort meist nicht und bleibt „–“.
- **Reisedokument-Regel:** Werden Dokumentangaben übernommen, müssen Art und Dokument-ID gesetzt sein (PROJ-29). Fehlt eine davon, zeigt das Formular die übliche Fehlermeldung. Auf dem Blatt wird das Dokument erst gespeichert, wenn beides da ist.

## Technical Requirements
- Sicherheit: Der Zugang zum KI-Dienst liegt nur auf dem Server, je Umgebung getrennt. Die Serverfunktion macht genau diese Auslesung mit fester Anweisung und festem Antwortformat und hat kein freies Eingabefeld. Geprüft werden Anmeldung, Mitgliedschaft, Rolle, Freischaltung und Tageslimit.
- Leistung: Das Ergebnis sollte in der Regel innerhalb von 15 Sekunden vorliegen. Nach etwa 60 Sekunden bricht die App mit der Fehlermeldung ab.
- Kosten: Ausgabenlimit beim Anbieter des KI-Dienstes zusätzlich zum Tageslimit der App.
- Datenschutz: Auftragsverarbeitungsvertrag mit dem Anbieter. Die Bilder werden nur zum Auslesen übermittelt. Speicherort und Aufbewahrung beim Anbieter klärt `/architecture`.
- Geräte: iPad-Safari (Gästeblatt), Desktop und Handy (Gastformular).

## Open Questions
- [x] Wortlaut des Datenschutz-Satzes → „Dazu kann auch das automatische Auslesen der Angaben aus Bildern Ihres Reisedokuments gehören.“, für alle Kunden mit Standardtext (2026-11-10)
- [x] Anbieter und Standort → Claude über AWS Bedrock in Stockholm (eu-north-1), Verarbeitung nur in der Region (2026-11-10; Irland geplant, AWS wies Stockholm zu)
- [x] Prüfung der maschinenlesbaren Zone → in der App (Prüfziffern), Claude liefert die MRZ-Zeilen mit (2026-11-10)
- [ ] Ist Claude Opus 5.5 in eu-north-1 freigeschaltet, und lässt es die Datenaufbewahrung „keine“ zu? → bei der AWS-Einrichtung (Runbook `docs/runbooks/aws-bedrock.md`, Schritte 4 und 5) klären; sonst Sonnet 5.5 bzw. Satz im Datenschutz-Text anpassen
- [ ] Richtlinie `bedrock-mantle:CreateInference` mit Bedingung Region: beim Einrichten bestätigen, dass der Aufruf damit klappt
- [ ] Nach der Pilotphase: Bleibt die Funktion experimentell, wird sie für alle Kunden eingeschaltet oder gestrichen? Entscheidung nach Erfahrung mit den ersten Kunden

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| P0, experimentell, vor Channex | Vom Nutzer entschieden; Erleichterung beim Check-in, je Kunde freischaltbar | 2026-11-10 |
| Angebot auf dem Gästeblatt und im Gastformular | Vom Nutzer entschieden; Check-in am Tablet ist der Hauptfall, das Gastformular dient für Altfälle und neue Gäste | 2026-11-10 |
| Knopf statt automatischem Auslesen, beide Seiten in einem Durchgang | Vom Nutzer entschieden; Kosten nur bei Bedarf, zuerst beide Seiten fotografieren, keine Auslesung verwackelter Fotos | 2026-11-10 |
| Auch Geschlecht und Staatsangehörigkeit auslesen | Vom Nutzer entschieden; beide braucht das Gästeblatt, sie stehen auf Pass und Ausweis | 2026-11-10 |
| Bei Abweichung Ausweiswert vorausgewählt, vorhandener Wert per Klick | Vom Nutzer entschieden; der Ausweis ist für das Meldewesen maßgeblich | 2026-11-10 |
| Unsichere Werte gelb, nicht vorausgewählt | Vom Nutzer entschieden; ein Lesefehler soll nicht unbemerkt richtige Daten ersetzen | 2026-11-10 |
| Nichts wird ohne „Übernehmen“ geändert | Nutzerwunsch aus der Vorbesprechung; Abgleich statt Überschreiben | 2026-11-10 |
| Bei vermutlich fremdem Ausweis keine Vorauswahl bei Name und Geburtsdatum | Schutz vor dem Überschreiben eines Gastes mit den Daten einer anderen Person | 2026-11-10 |
| Freischaltung nur durch den Betreiber, Standard aus | Vom Nutzer entschieden; der Betreiber trägt Zugang und Kosten und steuert das Experiment | 2026-11-10 |
| Tageslimit je Kunde (Standard 50) und Monatszähler im Betreiber-Admin | Vom Nutzer entschieden; Kostenkontrolle ohne Euro-Abrechnung in der App | 2026-11-10 |
| Datenschutz: Standardtext ergänzt, eigene Texte unverändert, einmaliger Hinweis an den Inhaber | Vom Nutzer entschieden; Kundentexte werden nicht ungefragt geändert | 2026-11-10 |
| Rechte wie beim Reisedokument (PROJ-29) und auf dem Gästeblatt (PROJ-26) | Keine neuen Rechte; Mitarbeiter lesen dort aus, wo sie ohnehin erfassen dürfen | 2026-11-10 |
| Nur Hauptgast | Mitreisende haben kein Reisedokument | 2026-11-10 |
| Ausleseergebnis nicht gespeichert, Protokoll ohne Werte | Datensparsamkeit (DSGVO) | 2026-11-10 |
| Ausländische Identitätskarten → „Personalausweis“, andere Dokumente ohne Vorschlag | Die Auswahl aus PROJ-29 bleibt unverändert | 2026-11-10 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Claude über Amazon Bedrock, Region Stockholm (eu-north-1), Endpunkt nur in dieser Region | Vom Nutzer gewählt (EU-Verarbeitung). Laut Anthropic-Doku sind Irland und Stockholm die EU-Regionen mit „in-region only“; Frankfurt leitet innerhalb der EU weiter. Irland war geplant (wie Supabase), AWS hat das neue Konto aber Stockholm zugewiesen; Irland nur über „Erweiterte Features“. Keine Daten an Anthropic | 2026-11-10 |
| Modell Claude Opus 5.5, per `BEDROCK_MODEL` umstellbar | Höchste Lesegenauigkeit bei Bildern; Wechsel auf Sonnet 5.5 ohne Codeänderung, falls die Kosten drücken | 2026-11-10 |
| Eigene Variablennamen `BEDROCK_ACCESS_KEY_ID`/`BEDROCK_SECRET_ACCESS_KEY`/`BEDROCK_REGION` | Vercel reserviert die `AWS_…`-Namen; der Zugang ist nur serverseitig | 2026-11-10 |
| Ein technischer AWS-Benutzer je Umgebung, Richtlinie nur Claude in eu-north-1 | Einzeln sperrbar, Kosten je Umgebung sichtbar, kein Zugriff auf andere AWS-Dienste | 2026-11-10 |
| Eigene Serverschnittstelle (POST, max. 60 s) statt Server-Aktion | Wie die übrigen langen Vorgänge (Ausstellen, Gästeblatt fertig); eigene Laufzeitgrenze | 2026-11-10 |
| Server lädt die Bilder selbst aus dem Speicher; Browser nennt nur Speicherorte im eigenen Kundenordner | Auch frisch hochgeladene, noch ungespeicherte Bilder lesbar; kein Bildversand vom Browser an den Server, keine fremden Dateien | 2026-11-10 |
| Strukturierte Ausgabe mit festem Schema, feste Anweisung, kein freies Eingabefeld | Der Zugang lässt sich nur für diese eine Funktion nutzen; Antworten sind maschinell prüfbar | 2026-11-10 |
| MRZ-Prüfziffern in der App, eigener kleiner Baustein ohne Paket | Kostenlos, deterministisch, testbar; Grundlage für „unsicher“; Standard ist öffentlich | 2026-11-10 |
| Gegenüberstellung auf dem Server berechnet, mit dem aktuellen Formularstand als „vorhanden“ | Regeln an einer Stelle und testbar; ungespeicherte Eingaben werden berücksichtigt | 2026-11-10 |
| Neue Tabelle der Auslesungen als Zähler und Protokoll, ohne gelesene Werte; Zugriff nur Server/Betreiber | Datensparsamkeit; eine Quelle für Limit, Monatszähler und Kosten (Token) | 2026-11-10 |
| Vormerken der Auslesung in einer Datenbankfunktion mit Limitprüfung in einem Schritt | Gleichzeitige Klicks oder Geräte überschreiten das Tageslimit nicht | 2026-11-10 |
| Zeitüberschreitung zählt, fehlende Verbindung nicht | Bei einer Zeitüberschreitung können bei AWS Kosten entstanden sein; ohne Verbindung sicher nicht | 2026-11-10 |
| Herkunftsvermerk über den bestehenden Mechanismus des Änderungsprotokolls („Ausweis“, „Gästeblatt, aus Ausweis gelesen“), je Speichervorgang | Kein neues Protokollsystem; Feldgenauigkeit wäre unverhältnismäßig aufwendig | 2026-11-10 |
| Übernahme auf dem Gästeblatt über die bestehende Warteschlange „ein Feld speichern“ | Rechte der Mitarbeiter, Konfliktregel und Unterschriftsregel aus PROJ-26 gelten unverändert | 2026-11-10 |
| Test-Leser statt Bedrock für E2E, nur außerhalb der Produktion einschaltbar | Tests ohne Kosten, ohne echte Ausweise, mit festen Fällen | 2026-11-10 |
| Datenschutz-Standardsatz zur Laufzeit eingesetzt | Kunden ohne eigenen Text erhalten ihn ohne Migration; eigene Texte bleiben unberührt | 2026-11-10 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Überblick
```
Browser (Gastformular / Gästeblatt)
  Knopf „Ausweis auslesen“ ──► Server: Auslese-Schnittstelle (nur POST, max. 60 s)
                                 1. Anmeldung, Kunde, Rolle, Freischaltung prüfen
                                 2. Tageslimit prüfen und Auslesung vormerken (Datenbank)
                                 3. Ausweisbilder aus dem privaten Speicher laden
                                 4. Bilder + feste Anweisung an Claude (AWS Bedrock, Stockholm)
                                 5. Antwort prüfen: Formate, Länderliste, Prüfziffern der MRZ
                                 6. Gegenüberstellung berechnen, Auslesung abschließen
  Dialog „Gegenüberstellung“ ◄── nur Vorschläge, nichts gespeichert
  „Übernehmen“ ──► Formular füllen (Gastformular) bzw. Blatt-Felder speichern (Gästeblatt)
```

### B) Komponenten (Oberfläche)
```
Gastformular, Abschnitt „Reisedokument“ (PROJ-29)
+-- Bildplätze Vorder-/Rückseite (bestehend)
+-- Knopf „Ausweis auslesen“ (neu; nur bei Freischaltung, mind. ein Bild, passende Rolle)
    +-- Dialog „Gegenüberstellung“ (neu, gemeinsamer Baustein)
        +-- Hinweis „Der Ausweis passt möglicherweise nicht zu diesem Gast.“ (bei Bedarf)
        +-- Tabelle: Feld | Vorhanden | Vom Ausweis | Auswahl
        |   (gleich = abgehakt; Abweichung = rot; unsicher = gelb „Bitte prüfen“; „–“)
        +-- „Abbrechen“ / „Übernehmen“

Gästeblatt Seite 1, Bereich „Reisedokument“ (PROJ-26)
+-- Bildaufnahme (bestehend)
+-- Knopf „Ausweis auslesen“ + derselbe Dialog (Tablet-tauglich, große Schaltflächen)

Betreiber-Admin → Kunde (PROJ-5)
+-- Abschnitt „Ausweis automatisch auslesen (experimentell)“ (neu)
    +-- Schalter ein/aus, Tageslimit (Zahl), Auslesungen laufender/letzter Monat

Einstellungen → Gästeblatt (PROJ-26)
+-- Einmaliger Hinweis „Datenschutz-Text prüfen“ mit „Verstanden“ (nur Inhaber, nur bei eigenem Text)
```
Bausteine: vorhandene shadcn-Komponenten (Dialog, Table, RadioGroup, Switch, Input, Alert, Button). Keine neuen UI-Bibliotheken.

### C) Daten (in Worten)
**Am Kunden (neu):**
- Freischaltung „Ausweis auslesen“ (ja/nein, Standard nein), nur durch den Betreiber änderbar
- Tageslimit (ganze Zahl 1–1.000, Standard 50)
- Zeitpunkt, wann der Inhaber den Datenschutz-Hinweis bestätigt hat (leer = Hinweis zeigen)

**Neue Tabelle „Ausweis-Auslesungen“ (zugleich Zähler und Protokoll):**
- Kunde, Person, Gast (leer bei neuem, noch nicht gespeichertem Gast; wird beim Löschen/Anonymisieren des Gastes geleert)
- Stelle (Gastformular / Gästeblatt), Zeitpunkt
- Ergebnis: läuft / gelesen / kein Ausweis erkannt / Fehler / nicht erreichbar
- Zählt fürs Limit (ja/nein): nein nur bei „nicht erreichbar“ (keine Verbindung zustande gekommen)
- Verbrauch (Ein-/Ausgabe-Token) und Modell, für die Kostenkontrolle
- **Keine gelesenen Werte, keine Bilder**
- Lesen und Schreiben nur der Server und der Betreiber; Mitglieder haben keinen Zugriff. Wird mit dem Kunden gelöscht.

**Gastdaten:** keine neuen Felder. Übernommene Werte landen in den bestehenden Feldern (PROJ-7, PROJ-29).
**Änderungsprotokoll:** bestehender Mechanismus mit Herkunftsvermerk (heute „Gästeblatt“). Neu: „Ausweis“ bzw. „Gästeblatt, aus Ausweis gelesen“. Der Vermerk gilt für den ganzen Speichervorgang, in dem Ausweiswerte übernommen wurden.
**Datenschutz-Standardtext:** Kunden ohne eigenen Text erhalten den neuen Satz automatisch (der Standard wird nicht kopiert, sondern zur Laufzeit eingesetzt).

### D) Ablauf auf dem Server
1. **Prüfen:** angemeldet, Mitglied des gewählten Kunden, Rolle passt zur Stelle (Gastformular: Inhaber oder Mitarbeiter beim neuen Gast; Gästeblatt: Inhaber und Mitarbeiter), Kunde aktiv und freigeschaltet.
2. **Bilder:** Der Browser nennt die Speicherorte der Bilder, die im Formular stehen. Das können auch frisch hochgeladene, noch nicht gespeicherte Bilder sein. Der Server nimmt nur Speicherorte im Ordner des eigenen Kunden an. Bei bestehendem Gast prüft er, dass das Bild am Gast hängt oder noch an keinem Gast. Er lädt die Bilder selbst aus dem privaten Speicher (PROJ-29).
3. **Vormerken:** Eine Datenbankfunktion prüft in einem Schritt das Tageslimit (Kalendertag Wien) und legt die Auslesung als „läuft“ an. Bei gleichzeitigen Klicks wird so nicht überzählt.
4. **Claude aufrufen:** beide Bilder in einer Anfrage mit fester Anweisung und festem Antwortschema (strukturierte Ausgabe). Erfragt werden alle Felder je mit Lesesicherheit sowie die Zeilen der maschinenlesbaren Zone (MRZ). Höchstens 50 Sekunden, danach Abbruch.
5. **Prüfen und Aufbereiten (in der App, ohne KI):**
   - Prüfziffern der MRZ (Dokumentnummer, Geburtsdatum, gesamt). Weicht ein Feld von der MRZ ab oder stimmt eine Prüfziffer nicht, ist es „unsicher“.
   - Länder: Ländercodes (z. B. „D“, „AUT“) bzw. Bezeichnungen werden der Länderliste aus PROJ-7 zugeordnet; ohne Treffer kein Vorschlag.
   - Dokumentart auf Reisepass/Personalausweis/Führerschein abbilden, Leerzeichen der Dokument-ID entfernen, Längen- und Datumsregeln aus PROJ-29/PROJ-7; Verstöße → „unsicher“.
   - Geschlecht: nur weiblich/männlich.
6. **Gegenüberstellung** mit den Werten, die der Browser als „vorhanden“ mitschickt (aktueller Formularstand, auch ungespeichert). Regeln laut Spec, inklusive „Ausweis passt möglicherweise nicht“ (Name und Geburtsdatum weichen beide ab).
7. **Abschließen:** Ergebnis und Verbrauch an der Auslesung vermerken. Antwort an den Browser: nur die Gegenüberstellung.

**Übernehmen:**
- *Gastformular:* Die gewählten Werte werden in die Formularfelder geschrieben. Gespeichert wird mit dem bestehenden „Speichern“, das zusätzlich den Herkunftsvermerk „Ausweis“ mitgibt. Die Rechte bleiben unverändert (PROJ-29).
- *Gästeblatt:* Die Werte laufen durch die bestehende Speicher-Warteschlange des Blatts (Feld für Feld, Funktion „ein Feld speichern“, nur Blatt-Felder). Neu ist ein Herkunftsvermerk. Das Reisedokument wird wie bisher erst mit Art und Dokument-ID gespeichert, Unterschrift 1 erlischt wie bei jeder Änderung.

### E) KI-Anbieter und Zugang
- **Claude über Amazon Bedrock, Region Stockholm (eu-north-1),** Endpunkt mit Verarbeitung nur in dieser Region. Daten gehen nicht an Anthropic. (Ursprünglich Irland geplant; AWS hat das Konto Stockholm zugewiesen, 2026-11-10.) Auftragsverarbeiter ist AWS.
- **Modell:** Claude Opus 5.5 (Standard), umstellbar per Umgebungsvariable (z. B. auf Sonnet 5.5) ohne Codeänderung.
- **Zugang:** eigener technischer AWS-Benutzer je Umgebung, darf nur Claude in Stockholm aufrufen. Schlüssel nur als geheime Vercel-Variablen mit eigenen Namen (`BEDROCK_…`), da Vercel die `AWS_…`-Namen reserviert. Einrichtung: `docs/runbooks/aws-bedrock.md`.
- **Kapselung:** Ein Baustein „Ausweis-Leser“ enthält Anbieter, Anweisung und Schema. Ein späterer Wechsel des Anbieters betrifft nur ihn.
- **Datenaufbewahrung bei AWS:** möglichst auf „keine“ gestellt (Runbook Schritt 5).
- **Kosten:** geschätzt 3–6 Cent je Auslesung (zwei Bilder, Regionalaufschlag 10 %). AWS kennt kein hartes Limit, daher ist das Tageslimit der App die Bremse, dazu eine AWS-Budgetwarnung.

### F) Fehlerfälle (Zuordnung zu den Meldungen der Spec)
| Lage | Meldung | zählt |
|---|---|---|
| Keine Verbindung / Zugang ungültig / Dienst gestört | „Der Ausweis konnte gerade nicht gelesen werden …“ | nein |
| Zeitüberschreitung (50 s) | dieselbe Meldung | ja (Kosten können entstanden sein) |
| Antwort ohne erkennbaren Ausweis oder Ablehnung durch das Modell | „Auf dem Bild wurde kein Ausweis erkannt …“ | ja |
| Antwort passt nicht zum Schema | „Der Ausweis konnte gerade nicht gelesen werden …“ | ja |
| Limit erreicht / nicht freigeschaltet / fremder Kunde | Meldungen laut Spec | nein (nichts gesendet) |

### G) Tests
- **Unit:** MRZ-Prüfziffern (Reisepass, Personalausweis mit 3 Zeilen, Führerschein ohne MRZ), Länderzuordnung, Aufbereitung, Gegenüberstellung samt „fremder Ausweis“.
- **Integration:** Vormerken mit Tageslimit (auch gleichzeitig), Rechte/RLS der Auslesungen, Herkunftsvermerk im Protokoll, Betreiber-Schalter.
- **E2E:** mit einem **Test-Leser** statt Bedrock, nur in Dev/Test per Umgebungsvariable einschaltbar, in Produktion technisch ausgeschlossen. Feste Ergebnisse für gleich/abweichend/unsicher/fremd/Fehler. E2E-Läufe kosten so nichts und brauchen keine echten Ausweise.
- **Einmalig von Hand in Dev:** echter Aufruf mit Musterausweisen (z. B. „Erika Mustermann“), keine echten Gästedaten.

### H) Abhängigkeiten (Pakete)
- `@anthropic-ai/bedrock-sdk`: offizieller Anthropic-Client für Claude auf Bedrock (signiert Anfragen mit dem AWS-Schlüssel). Beim Einbau auf saubere Peer-Abhängigkeiten prüfen (lokales `legacy-peer-deps`).
- MRZ-Prüfung ohne Zusatzpaket: kleiner eigener Baustein (öffentlicher ICAO-Standard, gut testbar).

## Implementation Notes (Frontend)

**Gebaut (2026-11-10):**
- **Knopf „Ausweis auslesen“** (`src/components/id-reading/id-reading-button.tsx`): erscheint nur bei eingeschalteter Funktion und mindestens einem Bild (auch frisch hochgeladen, noch ungespeichert); gesperrt, solange ein Bild hochlädt oder gelesen wird („Ausweis wird gelesen …“). Hinweis „Experimentell … Bitte jedes Ergebnis prüfen.“ Fehler als Meldung unter dem Knopf, alle Felder bleiben bearbeitbar. Wartet höchstens 60 s.
- **Gegenüberstellung** (`id-reading-dialog.tsx`): eine Zeile je Angabe statt Tabelle (passt an Handy und Tablet ohne Querscrollen). Kennzeichen „Gleich“ (abgehakt), „Neu“, „Abweichung“ (rot), „Bitte prüfen“ (gelb), „Nicht gefunden“ („–“). Bei Neu/Abweichung/Unsicher Auswahl „Vorhanden“ ↔ „Vom Ausweis“ als Radio-Karten. Hinweis „Der Ausweis passt möglicherweise nicht zu diesem Gast.“ Knopf „N Angaben übernehmen“ bzw. „Nichts zu übernehmen“, „Abbrechen“. Datum als TT.MM.JJJJ, Länder mit Namen.
- **Regeln** (`src/lib/id-reading.ts`, Tests `id-reading.test.ts`): `compareIdReading` (gleich ohne Groß-/Kleinschreibung, Dokument-ID ohne Leerzeichen; leer → vorausgewählt; Abweichung → vorausgewählt; unsicher → nicht vorausgewählt; fremder Ausweis = Nachname und Geburtsdatum weichen ab → bei Name und Geburtsdatum keine Vorauswahl), `nameCase` (Ausweis-Großbuchstaben → „Maria Theresia“, gemischte Schreibweise bleibt), `chosenValues`, Test-Leser `fakeIdReading`.
- **Gastformular** (`guest-fields.tsx`, damit Gästeseite, neuer Gast im Buchungsformular, Rechnungsnacherfassung): Knopf unter den Bildern im Abschnitt „Reisedokument“. „Übernehmen“ schreibt in die Formularfelder (geprüft, „ungespeichert“) und setzt das neue Formularfeld `fromIdDocument`; gespeichert wird mit „Speichern“.
- **Gästeblatt Seite 1** (`sheet-page-one.tsx`, `guest-sheet-signing.tsx`): Knopf im Bereich „Reisedokument“ (nur Nicht-Österreicher), auch für schon hinterlegte Bilder. „Übernehmen“ setzt die Werte und speichert sofort über die bestehende Warteschlange (Unterschrift 1 erlischt wie bei jeder Änderung; Reisedokument erst mit Art und Nummer). `saveSheetGuest` bekommt `fromIdDocument`, solange die übernommenen Werte nicht vollständig gespeichert sind.
- **Schalter** im App-Rahmen und auf der Vollbild-Seite (`IdReadingProvider`, `getIdReadingEnabled`).
- **Betreiber-Admin → Kunde**: Abschnitt „Ausweis automatisch auslesen (experimentell)“ vor „Mitglieder“ mit Schalter, Tageslimit (1–1.000, Standard 50) und Auslesungen laufender/letzter Monat (`src/components/operator/id-reading-settings.tsx`, Aktion `adminSaveIdReading`).
- **Einstellungen → Gästeblatt**: einmaliger Hinweis „Datenschutz-Information prüfen“ mit „Verstanden“, nur bei eingeschalteter Funktion und eigenem Text in Teil A (`privacy-hint.tsx`, Aktion `dismissIdReadingPrivacyHint`).
- **Schnittstelle** `POST /api/ausweis/auslesen` (Stand Frontend): prüft Sitzung, gewählten Kunden, Bildpfade im Ordner des Kunden und die Freischaltung; liefert mit dem **Test-Leser** (`ID_READING_FAKE=1`, nie in Produktion) die Gegenüberstellung, sonst „Diese Funktion wird gerade eingerichtet.“ Test-Leser: Nachname enthält „Fehler“ → nicht erreichbar, „Kein“ → kein Ausweis, „Unsicher“ → Dokument-ID unsicher; sonst Muster „Erika Mustermann“.
- Texte: `messages/de.json` → `idReading.*`, `operator.idReadingTitle`.

**Abweichung vom Tech Design:** Einstellungen je Kunde nicht als Spalten an `tenants`, sondern in einer **eigenen Tabelle** `id_reading_settings` (wie `guest_sheet_options`, QA BUG-6 aus PROJ-26: Umschalten soll nicht den Stand der Stammdaten ändern). Keine Zeile = aus.

**Offen für /backend:** Satz im Datenschutz-Standardtext (Wortlaut legt der Nutzer fest, Open Question); neue Umgebungsvariablen in `.env.local.example` (`BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION`, `BEDROCK_MODEL`, `ID_READING_FAKE`) – die Datei ist für Claude gesperrt, gemeinsam mit dem Nutzer.

**Bis zur Migration:** Fehlt die Tabelle, ist die Funktion aus; mit `ID_READING_FAKE=1` (nur außerhalb der Produktion) gilt sie als eingeschaltet, damit die Oberfläche in Dev ansehbar ist. Speichern im Betreiber-Abschnitt und „Verstanden“ melden „Diese Funktion wird gerade eingerichtet.“

**Vertrag für /backend** (Namen dürfen sich ändern, dann hier und im Code nachziehen)
- Tabelle `id_reading_settings` (tenant_id PK → tenants on delete cascade, enabled bool default false, daily_limit int 1–1000 default 50, privacy_hint_seen_at timestamptz null, updated_at, updated_by); RLS: Mitglieder des Kunden und Betreiber lesen; Schreiben nur über Funktionen
- `admin_set_id_reading(p_tenant_id, p_enabled, p_daily_limit)`: nur Betreiber-Admin mit 2FA, Protokoll; beim Einschalten `privacy_hint_seen_at` leeren (Hinweis erscheint neu)
- `dismiss_id_reading_privacy_hint(p_tenant_id)`: nur Inhaber, setzt `privacy_hint_seen_at = now()`; deaktivierter Kunde P0016
- `id_reading_usage(p_tenant_id)` → `this_month`, `last_month` (gezählte Auslesungen, Monat nach Wiener Zeit); nur Betreiber
- Tabelle `id_readings` (Zähler und Protokoll, Tech Design C) und Funktion zum Vormerken mit Tageslimit (Service-Rolle)
- Schnittstelle: Rolle je Stelle (Gastformular: Inhaber, Mitarbeiter nur ohne `guestId`; Gästeblatt: Inhaber und Mitarbeiter, Buchung des Kunden mit diesem Gast), Bild am Gast oder an keinem Gast, Vormerken/Abschließen, Bilder aus dem Speicher, Claude über Bedrock, MRZ-Prüfung, Aufbereitung zu `IdReadValues`, `compareIdReading`; Fehlercodes `ID_READING_ERRORS`
- Herkunftsvermerk: `fromIdDocument` aus `GuestInput` (createGuest/updateGuest, neuer Gast in Buchung/Rechnung) → `app.source = 'Ausweis'`; aus `saveSheetGuest` → `'Gästeblatt, aus Ausweis gelesen'`

## Implementation Notes (Backend)

**Gebaut (2026-11-10):**
- **Migration** `20261110115816_id_reading.sql` (in Dev eingespielt):
  - `id_reading_settings` (eine Zeile je Kunde, `enabled`, `daily_limit` 1–1.000, `privacy_hint_seen_at`); Lesen Mitglieder und Betreiber; Änderungsprotokoll wie Fachtabellen.
  - `id_readings` (Kunde, Person, Gast, Stelle, Ergebnis `started/read/no_document/failed/unreachable`, `counted`, Modell, Token, Zeitpunkte); Lesen nur Betreiber; Gast gelöscht → leer (Fremdschlüssel), anonymisiert → leer (Trigger).
  - `admin_set_id_reading` (Admin mit 2FA, deaktivierter Kunde P0016, Limit 22023; Einschalten leert `privacy_hint_seen_at`; Betreiber-Protokoll `id_reading_on/off/limit` mit Limit in `target_label`), `id_reading_usage` (Admin; laufender/letzter Monat Wien, nur gezählte), `dismiss_id_reading_privacy_hint` (Inhaber).
  - `reserve_id_reading` / `finish_id_reading` nur Service-Rolle: Sperre auf der Einstellungszeile, P0990 nicht freigeschaltet, P0991 Tageslimit (Kalendertag Wien, gezählte inkl. laufender); `unreachable` zählt nicht.
  - Herkunftsvermerk: `save_guest_from_id_document` (Vermerk „Ausweis“) und `save_guest_sheet_field_from_id_document` („Gästeblatt, aus Ausweis gelesen“); `private.save_guest_sheet_field` lässt diesen Vermerk stehen, sonst unverändert.
- **Leser** `src/lib/id-reading-reader.ts`: Claude über `@anthropic-ai/bedrock-sdk` (`AnthropicBedrockMantle`, Region/Schlüssel/Modell aus `BEDROCK_*`, kein Rückgriff auf `AWS_*`), feste Systemanweisung (Zweck, nichts raten, CAN ≠ Dokumentnummer, Geburtsort ≠ Behörde, Rückseite deutscher Ausweise), strukturierte Ausgabe mit festem JSON-Schema, 50 s, keine Wiederholung. Fehler: Zeitüberschreitung/400 → `failed` (zählt), Verbindung/Zugang/Modell gesperrt/5xx → `unreachable` (zählt nicht), Ablehnung/kein Dokument → `noDocument`.
- **Aufbereitung** `src/lib/id-reading-normalize.ts` (Tests): Datum, Länder (ISO-Alpha-2 der Länderliste), Geschlecht nur F/M, Dokumentart, Längen; **MRZ** `src/lib/mrz.ts` (TD1/TD2/TD3, Prüfziffern nach ICAO 9303, Tests mit ICAO-Mustern): gültige MRZ-Nummer gilt, Abweichung der KI → „Bitte prüfen“; Geburtsdatum gegen MRZ.
- **Schnittstelle** `POST /api/ausweis/auslesen`: Rolle je Stelle (Gastformular: Mitarbeiter nur ohne Gast; Gästeblatt: Hauptgast einer Buchung des Kunden), Gast nicht anonymisiert, Bilder im Kundenordner und am Gast oder an keinem Gast, Bilder vor dem Vormerken laden (fehlende Datei zählt nicht), Vormerken, Leser bzw. Test-Leser, Abschließen mit Verbrauch, Gegenüberstellung. HTTP 401/400/403/429/422/503.
- **Aktionen:** `createGuest`/`updateGuest` mit `fromIdDocument` → `save_guest_from_id_document`; `saveSheetGuest` mit `fromIdDocument` → `save_guest_sheet_field_from_id_document`.
- **Datenschutz-Standardtext** (Teil A, Nutzerentscheidung): „Gespeichert und verarbeitet werden sie bei IT-Dienstleistern … Dazu kann auch das automatische Auslesen der Angaben aus Bildern Ihres Reisedokuments gehören.“ Gilt für alle Kunden mit Standardtext.

**Tests:** Unit `mrz.test.ts`, `id-reading-normalize.test.ts`, `id-reading.test.ts`, Schnittstelle `src/app/api/ausweis/auslesen/auslesen.test.ts` (10); Integration `supabase/tests/id-reading.integration.test.ts` (13, gegen Dev). Bestehende Integrationstests Gästeblatt, Betreiber, Gäste, Firmen, RLS grün; alle Unit-Tests (1.026) grün; Build grün.

**Abweichungen:**
- Herkunftsvermerk nur beim Speichern über Gästeseite und Gästeblatt; ein **neuer Gast im Buchungsformular bzw. in der Rechnungsnacherfassung** wird ohne Vermerk „Ausweis“ protokolliert (die Werte stehen trotzdem im Protokoll). Grund: diese Wege speichern den Gast innerhalb von `save_booking`/Rechnungsfunktionen; ein Eingriff dort wäre unverhältnismäßig.
- Ohne `BEDROCK_*` antwortet die Schnittstelle „Diese Funktion wird gerade eingerichtet.“ (auch nach dem Vormerken – zählt dann als `unreachable`, also nicht).

**Umgebungsvariablen** (je Umgebung in Vercel, lokal in `.env.local`; `.env.local.example` ergänzt der Nutzer, die Datei ist für Claude gesperrt): `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_REGION` (`eu-north-1`), `BEDROCK_MODEL` (vorerst `anthropic.claude-haiku-4-5`, nach Freischaltung `anthropic.claude-opus-5-5`), `ID_READING_FAKE` (nur Dev/Test, `1` = Test-Leser).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
