# PROJ-29: Gast-Erweiterung: Titel, Geschlecht, Reisedokument

## Status: In Progress
**Created:** 2026-10-26
**Last Updated:** 2026-10-26

## Dependencies
- Requires: PROJ-7 (Gäste-Datenbank): Gast, Gast-Formular, Gast-Detail, Länderauswahl, Zusammenführen, Löschen/Anonymisieren
- Requires: PROJ-8 (Manuelle Buchungen): Gast-Formular im Buchungsformular (dort auch für Mitarbeiter)
- Requires: PROJ-4 (Kundenkonten & Rollen): Rollen Inhaber/Mitarbeiter
- Wird voraussichtlich genutzt von: PROJ-26 (Gästeblatt), PROJ-11 (Gast aus Channex), spätere Exporte

## Überblick
Der Hauptgast bekommt zusätzliche Angaben: akademische Grade vor und nach dem Namen, ein Geschlecht und **ein** Reisedokument mit Bildern der Vorder- und Rückseite. Außerdem wird ein Fehler in der Gästeliste behoben: In Safari öffnet ein Klick auf eine Zeile immer den letzten Gast.

### Neue Angaben am Gast
| Angabe | Pflicht | Regeln |
|---|---|---|
| Titel vorangestellt | nein | Freitext, höchstens 50 Zeichen, z. B. „Dr.“, „Mag.“, „DI Dr.“ |
| Titel nachgestellt | nein | Freitext, höchstens 50 Zeichen, z. B. „LL.M.“, „MSc“, „PhD“ |
| Geschlecht | ja, mit Standard | Auswahl: männlich, weiblich, divers, inter, offen, keine Angabe. Vorbelegt mit **„keine Angabe“**. Bestehende Gäste erhalten „keine Angabe“ |

**Anzeige des Namens:** Überall, wo der volle Name eines Gastes steht (Gast-Detail, Gästeliste, Buchungen, Kalender, Gastauswahl), lautet er „Titel vorangestellt Vorname Nachname, Titel nachgestellt“, z. B. „Dr. Anna Huber, LL.M.“. Fehlende Teile entfallen samt Leerzeichen bzw. Komma. Sortiert wird weiterhin nach Nachname, Vorname.

### Reisedokument (höchstens eines je Gast)
| Angabe | Pflicht | Regeln |
|---|---|---|
| Art des Dokuments | ja, sobald ein Dokument erfasst wird | Auswahl: Reisepass, Führerschein, Personalausweis |
| Nummer des Dokuments | ja, sobald ein Dokument erfasst wird | Freitext, höchstens 30 Zeichen |
| Ausstellungsdatum | nein | darf nicht in der Zukunft liegen |
| Behörde | nein | Freitext, höchstens 100 Zeichen, z. B. „BH Graz-Umgebung“ |
| Staat | nein | Länderauswahl aus PROJ-7 (deutsche Namen, häufige Länder oben), **keine Vorauswahl** |
| Bild Vorderseite | nein | ein Bild |
| Bild Rückseite | nein | ein Bild |

„Sobald ein Dokument erfasst wird“ heißt: Wird irgendeine Angabe des Dokuments ausgefüllt oder ein Bild hochgeladen, müssen Art und Nummer ausgefüllt sein. Sind alle Angaben leer und keine Bilder vorhanden, hat der Gast kein Reisedokument.

**Bilder:**
- Zulässig sind alle gängigen Bildformate, insbesondere Handyfotos: JPEG, PNG, HEIC/HEIF (iPhone), WebP, GIF (erstes Bild), BMP; TIFF nur in Browsern, die es selbst lesen können (Safari). Am Handy kann direkt fotografiert oder ein Bild aus der Galerie gewählt werden.
- Beim Hochladen wandelt die App jedes Bild in ein gut lesbares JPEG um (längste Seite etwa 2.000 Pixel) und dreht es nach der Kamera-Ausrichtung richtig. Das Original wird nicht aufbewahrt.
- Abrufen: Das Gast-Detail zeigt kleine Vorschauen. Ein Klick öffnet das Bild groß, von dort kann es heruntergeladen werden.
- Ein neues Bild ersetzt das bisherige auf demselben Platz (Vorderseite bzw. Rückseite). Einzelne Bilder können entfernt werden.
- Die Bilder sind nur für Mitglieder des eigenen Kunden abrufbar, nie über eine öffentliche Adresse.

### Rollen
| Aktion | Inhaber | Mitarbeiter |
|---|---|---|
| Titel, Geschlecht, Reisedokument und Bilder sehen | ✓ | ✓ |
| Titel, Geschlecht beim Gast bearbeiten | ✓ | – |
| Reisedokument erfassen, ändern, Bilder hochladen/ersetzen/entfernen im Gast-Detail | ✓ | – |
| Alle neuen Angaben samt Bildern erfassen, wenn im Buchungsformular ein **neuer** Gast angelegt wird (PROJ-8) | ✓ | ✓ |

Damit gilt für Mitarbeiter weiterhin die Regel aus PROJ-7: Sie können Gäste nur beim Anlegen einer Buchung erfassen und bestehende Gäste nicht ändern.

### Fehlerbehebung Gästeliste (Safari)
In Safari öffnet ein Klick auf eine beliebige Zeile der Gästeliste immer den letzten Gast. Wie bereits in der Betreiber-Kundenliste wird nur noch der unterstrichene Name als Link verwendet, ohne unsichtbare Klickfläche über der ganzen Zeile. Die Karten in der Handy-Ansicht sind schon heute je ein eigener Link und bleiben als Ganzes anklickbar.

## User Stories
- Als **Inhaber** möchte ich akademische Grade vor und nach dem Namen erfassen, damit ich Gäste korrekt anspreche und ihr Name in Buchungen und auf Dokumenten richtig steht.
- Als **Inhaber** möchte ich das Geschlecht eines Gastes aus einer festen Liste wählen, damit diese Angabe für Meldewesen und Auswertungen einheitlich vorliegt, ohne dass ich etwas erfinden muss („keine Angabe“ ist Standard).
- Als **Inhaber** möchte ich das Reisedokument eines Gastes mit Art, Nummer, Ausstellungsdatum, Behörde und Staat festhalten, damit ich es für das Gästeblatt und bei Rückfragen nicht erneut erfragen muss.
- Als **Inhaber** möchte ich beim Check-in den Ausweis mit dem Handy fotografieren und das Bild beim Gast ablegen, damit ich später nachsehen kann, was vorgelegt wurde.
- Als **Mitarbeiter** möchte ich das Reisedokument und die Ausweisbilder eines Gastes ansehen, damit ich beim Check-in prüfen kann, ob die Angaben schon vorliegen.
- Als **Mitarbeiter** möchte ich beim Anlegen einer Buchung für einen neuen Gast auch Titel, Geschlecht und Reisedokument samt Bild erfassen, damit am Telefon oder am Empfang nichts doppelt erfasst werden muss.
- Als **Nutzer von Safari** möchte ich in der Gästeliste genau den Gast öffnen, den ich anklicke.

## Out of Scope
- **Mehrere Reisedokumente je Gast** (z. B. Pass und Führerschein, alter und neuer Pass): nicht vorgesehen, ein neues Dokument überschreibt das alte
- **Ablaufdatum („gültig bis“) des Dokuments:** nicht gefordert
- **PDF-Scans oder andere Dateien als Bilder:** nur Bilder
- **Aufbewahren der Originaldatei** (z. B. HEIC in voller Auflösung): bewusst nicht, nur das umgewandelte JPEG
- **Automatisches Löschen der Ausweisbilder nach einer Frist:** nicht vorgesehen (vom Nutzer entschieden)
- **Texterkennung (Auslesen der Ausweisdaten aus dem Bild):** nicht vorgesehen
- **Reisedokument und Geschlecht für Mitreisende:** gehört zum Gästeblatt (PROJ-26)
- **Ändern des Reisedokuments bestehender Gäste durch Mitarbeiter:** nicht vorgesehen (Mitarbeiter sehen nur)
- **Suche und Filter nach Titel, Geschlecht oder Dokumentnummer:** nicht vorgesehen
- **Safari-Zeilenklick in Buchungs- und Wohnungsliste:** wird separat behoben (eigener Schritt)
- **Übernahme dieser Angaben aus booking.com/Airbnb:** PROJ-11

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Titel und Geschlecht
- [ ] Angenommen ein Inhaber öffnet „Gast anlegen“, wenn das Formular erscheint, dann gibt es die Felder „Titel vorangestellt“, „Titel nachgestellt“ und „Geschlecht“, und das Geschlecht ist mit „keine Angabe“ vorbelegt
- [ ] Angenommen ein Inhaber öffnet die Geschlechtsauswahl, wenn die Liste erscheint, dann enthält sie genau „männlich“, „weiblich“, „divers“, „inter“, „offen“ und „keine Angabe“
- [ ] Angenommen es gab Gäste vor dieser Erweiterung, wenn ein Nutzer einen davon öffnet, dann steht beim Geschlecht „keine Angabe“ und die Titel sind leer
- [ ] Angenommen ein Gast heißt Anna Huber mit „Dr.“ vorangestellt und „LL.M.“ nachgestellt, wenn der Gast im Detail, in der Gästeliste, in einer Buchung, im Kalender oder in der Gastauswahl erscheint, dann lautet der Name „Dr. Anna Huber, LL.M.“
- [ ] Angenommen ein Gast hat nur einen nachgestellten Titel und keinen Vornamen, wenn sein Name angezeigt wird, dann steht „Huber, MSc“ ohne überzählige Leerzeichen
- [ ] Angenommen ein Inhaber gibt einen Titel mit mehr als 50 Zeichen ein, wenn er speichert, dann erscheint beim Feld eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen Gäste haben Titel, wenn die Gästeliste nach Name sortiert ist, dann richtet sich die Reihenfolge weiter nach Nachname und Vorname, nicht nach dem Titel

### Reisedokument erfassen
- [ ] Angenommen ein Inhaber bearbeitet einen Gast ohne Reisedokument, wenn er nichts beim Reisedokument einträgt und speichert, dann wird gespeichert und der Gast hat kein Reisedokument
- [ ] Angenommen ein Inhaber trägt nur Behörde oder Staat ein oder lädt nur ein Bild hoch, wenn er speichert, dann erscheint bei „Art des Dokuments“ und „Nummer“ eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen ein Inhaber wählt die Art des Dokuments, wenn die Liste erscheint, dann enthält sie genau „Reisepass“, „Führerschein“ und „Personalausweis“
- [ ] Angenommen ein Inhaber gibt ein Ausstellungsdatum in der Zukunft ein, wenn er speichert, dann erscheint beim Feld eine Fehlermeldung
- [ ] Angenommen ein Inhaber wählt den Staat, wenn die Auswahl erscheint, dann ist es dieselbe Länderauswahl wie beim Herkunftsland, ohne Vorauswahl
- [ ] Angenommen ein Inhaber füllt Art, Nummer, Ausstellungsdatum, Behörde und Staat aus, wenn er speichert, dann zeigt das Gast-Detail einen Abschnitt „Reisedokument“ mit allen Angaben (Datum im österreichischen Format)
- [ ] Angenommen ein Inhaber leert alle Angaben des Reisedokuments und entfernt beide Bilder, wenn er speichert, dann hat der Gast kein Reisedokument mehr

### Bilder
- [ ] Angenommen ein Inhaber nutzt die App am Handy, wenn er bei „Vorderseite“ auf Hochladen tippt, dann kann er direkt fotografieren oder ein Bild aus der Galerie wählen
- [ ] Angenommen ein Inhaber lädt ein HEIC-Foto von einem iPhone hoch, wenn das Hochladen fertig ist, dann zeigt das Gast-Detail das Bild in Chrome, Firefox und Safari richtig herum an
- [ ] Angenommen ein Inhaber lädt ein JPEG, PNG oder WebP hoch, wenn das Hochladen fertig ist, dann erscheint eine Vorschau beim jeweiligen Platz (Vorderseite bzw. Rückseite)
- [ ] Angenommen ein Bild ist hochgeladen, wenn ein Nutzer auf die Vorschau klickt, dann öffnet sich das Bild groß und kann heruntergeladen werden
- [ ] Angenommen auf der Vorderseite liegt bereits ein Bild, wenn ein Inhaber ein neues Bild hochlädt und speichert, dann ersetzt es das alte, und das alte ist nicht mehr abrufbar
- [ ] Angenommen ein Inhaber entfernt das Bild der Rückseite, wenn er speichert, dann ist es nicht mehr abrufbar und die Vorderseite bleibt erhalten
- [ ] Angenommen ein Nutzer wählt eine Datei, die kein Bild ist (z. B. PDF), oder ein beschädigtes Bild, wenn er hochlädt, dann erscheint eine verständliche Fehlermeldung und das bisherige Bild bleibt erhalten
- [ ] Angenommen das Hochladen bricht ab (z. B. Verbindung weg), wenn der Nutzer es bemerkt, dann erscheint eine Fehlermeldung, die übrigen Eingaben bleiben im Formular erhalten und er kann es erneut versuchen
- [ ] Angenommen ein Nutzer gehört zu Kunde A, wenn er versucht, ein Ausweisbild eines Gastes von Kunde B abzurufen (auch über eine direkte Adresse), dann wird der Zugriff verweigert
- [ ] Angenommen jemand ist nicht angemeldet, wenn er eine Bildadresse aufruft, dann wird kein Bild ausgeliefert

### Rollen
- [ ] Angenommen ein Mitarbeiter öffnet ein Gast-Detail mit Reisedokument, wenn er die Seite betrachtet, dann sieht er alle Angaben und kann die Bilder groß öffnen und herunterladen, aber es gibt keine Knöpfe zum Hochladen, Ersetzen oder Entfernen
- [ ] Angenommen ein Mitarbeiter versucht, Titel, Geschlecht, Reisedokument oder Bilder eines bestehenden Gastes direkt zu ändern, wenn er speichert, dann wird die Änderung abgelehnt
- [ ] Angenommen ein Mitarbeiter legt eine Buchung mit einem neuen Gast an, wenn das Gast-Formular erscheint, dann kann er Titel, Geschlecht und das Reisedokument samt Bildern erfassen, mit denselben Regeln wie der Inhaber
- [ ] Angenommen ein Mitarbeiter wählt im Buchungsformular einen bestehenden Gast, wenn er die Buchung speichert, dann bleiben dessen Angaben und Bilder unverändert

### Änderungsprotokoll, Zusammenführen, Löschen
- [ ] Angenommen ein Inhaber ändert Titel, Geschlecht oder Reisedokument, wenn er speichert, dann ist die Änderung im Änderungsprotokoll mit Person und Zeitpunkt festgehalten
- [ ] Angenommen ein Bild wird hochgeladen, ersetzt oder entfernt, wenn jemand das Änderungsprotokoll ansieht, dann ist dies mit Person, Zeitpunkt und Platz (Vorder-/Rückseite) vermerkt, ohne das Bild selbst
- [ ] Angenommen ein Inhaber führt zwei Gäste zusammen, wenn er die Werte wählt, dann wählt er Titel und Geschlecht je einzeln und das Reisedokument als Ganzes (Angaben und Bilder) von Gast A oder B; die Bilder des nicht gewählten Dokuments werden gelöscht
- [ ] Angenommen ein Gast ohne Buchungen wird gelöscht, wenn das Löschen abgeschlossen ist, dann sind auch seine Ausweisbilder endgültig entfernt
- [ ] Angenommen ein Gast mit Buchungen wird anonymisiert, wenn das Anonymisieren abgeschlossen ist, dann sind Titel und Reisedokument entfernt, das Geschlecht steht auf „keine Angabe“, die Ausweisbilder sind endgültig gelöscht und das Änderungsprotokoll enthält keine dieser Altwerte mehr

### Fehlerbehebung Gästeliste
- [ ] Angenommen die Gästeliste zeigt mehrere Gäste, wenn ein Nutzer in Safari (Mac, iPhone, iPad) auf den Namen eines Gastes klickt, dann öffnet sich genau dieser Gast
- [ ] Angenommen die Gästeliste zeigt mehrere Gäste, wenn ein Nutzer mit der Tastatur zum Namen eines Gastes springt und Enter drückt, dann öffnet sich dieser Gast

## Edge Cases
- **Sehr großes Handyfoto** (z. B. 15 MB, 48 Megapixel): Es wird verkleinert und umgewandelt. Ist eine Datei so groß, dass sie nicht verarbeitet werden kann, erscheint eine Meldung mit der Höchstgröße
- **Quer oder auf dem Kopf fotografierter Ausweis:** Die App richtet das Bild nach der Kamera-Angabe aus. Ein Drehen von Hand ist nicht vorgesehen; der Nutzer fotografiert neu
- **Bild hochgeladen, aber Formular nicht gespeichert** (Abbrechen, Seite geschlossen): Das Bild gilt nicht als abgelegt und bleibt nicht dauerhaft liegen
- **Zwei Inhaber bearbeiten gleichzeitig denselben Gast:** wie in PROJ-7: Der zweite wird beim Speichern auf die Änderung hingewiesen; das gilt auch für Bilder
- **Dokument wechselt die Art** (z. B. von Personalausweis zu Reisepass): Die Angaben werden überschrieben. Die bisherigen Bilder bleiben, bis sie ersetzt oder entfernt werden; die App weist darauf hin, dass sie zum alten Dokument gehören könnten
- **Titel mit Sonderzeichen oder mehrere Titel** („Univ.-Prof. DI Dr.“, „BSc MSc“): zulässig, solange 50 Zeichen nicht überschritten werden
- **Anonymisierter Gast:** keine Titel, kein Reisedokument, keine Bilder; bearbeiten nicht möglich (wie PROJ-7)
- **Kunde wird gelöscht** (PROJ-5): Auch alle Ausweisbilder seiner Gäste werden gelöscht
- **Gast mit Geschlecht „keine Angabe“ und PROJ-26:** zulässig; das Gästeblatt verlangt keine weiteren Angaben zum Gast

## Technical Requirements
- Ausweisbilder sind besonders schützenswerte Daten: Speicherung nur in der EU (Supabase eu-west-1), Zugriff nur für Mitglieder des eigenen Kunden (und den Betreiber-Admin wie bei allen Kundendaten, PROJ-1), keine öffentlichen Adressen, kurzlebige Abruf-Links
- Rollenrechte und Pflichtregeln werden serverseitig bzw. in der Datenbank durchgesetzt, nicht nur in der Oberfläche
- Bildanzeige in aktuellem Chrome, Firefox, Safari und Edge sowie Safari (iOS) und Chrome (Android)
- Hochladen eines Handyfotos inklusive Umwandlung in wenigen Sekunden über eine normale Mobilfunkverbindung
- Responsiv (Handy beim Check-in), deutsch, österreichische Datumsformate

## Open Questions
- [x] Sollen Ausweisbilder nach einer Frist automatisch gelöscht werden? → Nein, sie bleiben bis zum manuellen Löschen bzw. bis zum Löschen/Anonymisieren des Gastes (2026-10-26)
- [x] Braucht das Gästeblatt (PROJ-26) zusätzliche Angaben zum Gast? → Nein, die Angaben zum Gast sind mit PROJ-29 vollständig. Zusätzliche Angaben zur Buchung folgen im nächsten Arbeitspaket (2026-10-26)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Spec PROJ-29 statt PROJ-7 erweitern | Vom Nutzer entschieden; wie bei PROJ-27/28 bleibt das ausgelieferte Feature unverändert, die Erweiterung ist eigenständig testbar und auslieferbar | 2026-10-26 |
| Akademische Grade als zwei Freitextfelder (je max. 50 Zeichen) | Vom Nutzer entschieden; Grade sind sehr vielfältig, eine Auswahlliste wäre nie vollständig | 2026-10-26 |
| Voller Name mit Graden überall angezeigt | Vom Nutzer entschieden; korrekte Anrede in Buchungen und Kalender. Sortierung bleibt nach Nachname | 2026-10-26 |
| Geschlecht als feste Liste, Standard „keine Angabe“ | Vom Nutzer vorgegeben; Werte entsprechen dem österreichischen Personenstandsrecht. Kein Raten, keine Pflichtauswahl | 2026-10-26 |
| Höchstens ein Reisedokument je Gast | Vom Nutzer entschieden; Datensparsamkeit (DSGVO), einfache Erfassung | 2026-10-26 |
| Art und Nummer Pflicht, sobald ein Dokument erfasst wird; Rest freiwillig | Vom Nutzer entschieden; ein Dokument ohne Art und Nummer ist wertlos, die übrigen Angaben fehlen auf manchen Dokumenten oder sind schlecht lesbar | 2026-10-26 |
| Zwei Bildplätze: Vorder- und Rückseite | Vom Nutzer entschieden; Personalausweis und Führerschein haben zwei Seiten | 2026-10-26 |
| Mitarbeiter sehen Reisedokument und Bilder, ändern sie aber nicht | Vom Nutzer entschieden; passt zur PROJ-7-Regel „Mitarbeiter sehen Gäste nur“ | 2026-10-26 |
| Im Buchungsformular alle neuen Felder samt Bildern, auch für Mitarbeiter (nur bei neuem Gast) | Vom Nutzer entschieden; am Empfang wird alles in einem Schritt erfasst. Bestehende Gäste ändern Mitarbeiter weiterhin nicht | 2026-10-26 |
| Bilder werden umgewandelt und verkleinert, Original nicht aufbewahrt | Vom Nutzer entschieden; HEIC wird sonst in Chrome/Firefox nicht angezeigt; weniger Speicher und schnelleres Laden; Datensparsamkeit | 2026-10-26 |
| Ausweisbilder bleiben bis zum manuellen Löschen, bei Gast-Löschung/Anonymisierung immer mit entfernt | Vom Nutzer entschieden | 2026-10-26 |
| Keine automatische Löschfrist für Ausweisbilder | Vom Nutzer entschieden | 2026-10-26 |
| Gästeblatt braucht keine weiteren Angaben zum Gast | Vom Nutzer bestätigt; PROJ-29 deckt die Gastdaten ab, Buchungsangaben kommen im nächsten Arbeitspaket | 2026-10-26 |
| Beim Zusammenführen wird das Reisedokument als Ganzes gewählt | Angaben und Bilder eines Dokuments gehören zusammen; Mischen zweier Dokumente ergäbe falsche Daten | 2026-10-26 |
| Safari-Fehler: nur der unterstrichene Name ist Link | Gleiche Lösung wie in der Kundenliste (vom Nutzer dort gewählt) | 2026-10-26 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ausweisbilder in privatem Supabase-Storage-Bereich, ein Ordner je Kunde, zufällige Dateinamen | Bereits im Projekt enthalten, EU-Region, Zugriffsregeln wie bei den Tabellen; keine sprechenden Dateinamen mit Personendaten | 2026-10-26 |
| Dokumentangaben als Felder am Gast statt eigener Tabelle | Höchstens ein Dokument je Gast; Zusammenführen, Anonymisieren und Protokoll funktionieren ohne Zusatzaufwand | 2026-10-26 |
| Umwandlung (Drehen, Verkleinern, JPEG) im Browser | Die Bildbibliothek auf Vercel kann HEIC nicht; spart Upload-Zeit am Handy; entfernt versteckte Fotodaten (GPS) | 2026-10-26 |
| HEIC-Dekoder `heic-to` nur bei Bedarf nachladen | Safari kann HEIC selbst; die übrigen Browser brauchen ihn nur in diesem Moment, die App bleibt sonst schlank | 2026-10-26 |
| Upload direkt vom Browser in den Speicher, nicht über den App-Server | Vercel begrenzt Server-Anfragen auf 4,5 MB; Zugriffsregeln des Speichers prüfen Kunde und Format | 2026-10-26 |
| Bild wird erst beim Speichern am Gast eingetragen; Datenbank prüft Ordner, Existenz und Eindeutigkeit | Mitarbeiter können Bilder nur über „Buchung mit neuem Gast“ wirksam machen; kein Einhängen fremder Dateien | 2026-10-26 |
| Lesen nur für Bilder, die an einem Gast hängen (plus eigener frischer Upload) | Ersetzte und entfernte Bilder sind sofort nicht mehr abrufbar (Akzeptanzkriterium), auch bevor die Datei gelöscht ist | 2026-10-26 |
| Kurzlebige Abruf-Links (10 Minuten), vom Server erzeugt | Kein dauerhaft gültiger Link auf Ausweisbilder | 2026-10-26 |
| Löschen von Dateien nur durch den Server nach Meldung der Datenbank; tägliche Bereinigung per Vercel Cron | Datenbank-Funktionen können Speicherdateien nicht selbst löschen; der Zeitplan fängt abgebrochene Uploads und Fehler ab | 2026-10-26 |
| Formate: JPEG, PNG, HEIC/HEIF, WebP, GIF, BMP; TIFF nur, wo der Browser es selbst lesen kann (Safari) | Handys liefern kein TIFF; ein eigener TIFF-Dekoder wäre Aufwand ohne Praxisnutzen | 2026-10-26 |
| Eingangsdateien bis 30 MB, gespeicherte Bilder höchstens 2 MB | Deckt alle Handyfotos ab; größere Dateien bringen Handys beim Umwandeln an die Speichergrenze | 2026-10-26 |
| `heic-to` (LGPL-3.0) über den Next.js-Einstieg `heic-to/next`, dynamisch nachgeladen | Jeder HEIC-Dekoder im Browser beruht auf libheif (LGPL); als eigene, nachgeladene Datei unproblematisch | 2026-10-26 |
| Upload über einmaligen Upload-Schlüssel vom Server (`prepareDocumentUpload`), Speicherort `<Kunde>/<zufällig>.jpg` | Der Browser braucht die Kundenkennung nicht; Speicherort und Ordner legt der Server fest | 2026-10-26 |
| Dateien löschen die Server-Aktionen selbst (Speicherorte vor/nach der Änderung vergleichen) | Die Datenbank-Funktionen für Löschen und Zusammenführen müssen dafür keine Speicherorte zurückgeben | 2026-10-26 |
| Name mit Titeln auch in Listen „Dr. Anna Huber, LL.M.“ statt „Huber, Anna“ | Spec: voller Name überall; Mitreisende bleiben „Nachname, Vorname“ | 2026-10-26 |
| Zusammenführen löscht den anderen Gast vor dem Aktualisieren | Ein Bild darf nur an einem Gast hängen; so kann das gewählte Dokument samt Bildern übernommen werden | 2026-10-26 |
| Lese-Regel über Verwendung am Gast statt nur über den Ordner | Ersetzte/entfernte Bilder sind sofort unlesbar, auch bevor die Datei gelöscht ist; eigener Upload bleibt für die Vorschau lesbar | 2026-10-26 |
| Bereinigungs-Route mit `CRON_SECRET`, ohne Schlüssel immer 401 | Vercel-Cron-Standard; kein öffentlicher Aufruf möglich | 2026-10-26 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Gast-Tabelle (PROJ-7)** mit Zugriffsregeln: Lesen Mitglieder und Betreiber-Admin, Ändern nur Inhaber, nicht bei anonymisierten Gästen. Eine Datenbank-Prüfung beim Speichern pflegt den Suchtext und prüft das Geburtsdatum.
- **Geschützte Datenbank-Funktionen:** Zusammenführen, Anonymisieren, Löschen (PROJ-7, erweitert in PROJ-8) und Buchung speichern (legt bei Bedarf den neuen Gast im selben Vorgang an, auch für Mitarbeiter).
- **Bausteine:** Gast-Formular (`guest-fields`, im Gast-Panel und im Buchungsformular), Länderauswahl, Zusammenführen-Dialog, zentrale Namensanzeige `guestDisplayName` (genutzt in Gast-Detail, Gästeliste, Buchungs-Detail, Kalender, Gastauswahl).
- **Supabase Storage** ist im Projekt eingeschaltet, wird aber noch nicht genutzt. PROJ-29 ist der erste Datei-Upload der App.
- **Betreiber-Löschfunktion** für Kunden (PROJ-5) läuft als Datenbank-Funktion. Dateien kennt sie bisher nicht.

### A) Seiten und Bausteine

```
Gast-Formular (Gast-Panel „Gast anlegen/bearbeiten“ und Buchungsformular bei neuem Gast)
+-- Titel vorangestellt · Vorname · Nachname · Titel nachgestellt
+-- Geschlecht (Auswahl, vorbelegt „keine Angabe“)
+-- … bisherige Felder unverändert …
+-- Abschnitt „Reisedokument“ (aufklappbar, wie „Firma“)
    +-- Art (Auswahl) · Nummer · Ausstellungsdatum · Behörde · Staat (Länderauswahl)
    +-- Bildplatz „Vorderseite“ und Bildplatz „Rückseite“
    |   +-- leer: Knopf „Bild hinzufügen“ (am Handy: Kamera oder Galerie)
    |   +-- während Umwandeln/Hochladen: Fortschrittsanzeige
    |   +-- gefüllt: Vorschau + „Ersetzen“ + „Entfernen“
    +-- Hinweis, wenn sich die Art ändert und schon Bilder vorhanden sind

Gast-Detail (/gaeste/[id])
+-- Kopf: voller Name mit Titeln
+-- Stammdaten zusätzlich: Geschlecht
+-- Abschnitt „Reisedokument“ (nur wenn vorhanden): Angaben + zwei Vorschaubilder
    +-- Klick auf Vorschau → Bildansicht (Dialog) groß, mit „Herunterladen“
    +-- Bearbeiten weiterhin nur über das Gast-Panel (nur Inhaber)

Zusammenführen-Dialog
+-- neue Zeilen „Titel“, „Geschlecht“, „Reisedokument“ (als Ganzes, mit kleinen Vorschauen)

Gästeliste
+-- Name mit Titeln; nur der unterstrichene Name ist Link (Safari-Fix, wie Kundenliste)

Buchungs-Detail, Kalender, Gastauswahl
+-- Name mit Titeln (über die zentrale Namensanzeige, keine eigenen Änderungen)
```

### B) Datenmodell (in Worten)

**Gast** (bestehende Tabelle, neue Felder):
- Titel vorangestellt, Titel nachgestellt (je höchstens 50 Zeichen, leer statt leerem Text)
- Geschlecht: einer von sechs festen Werten (männlich, weiblich, divers, inter, offen, keine Angabe), immer gesetzt, Standard „keine Angabe“. Bestehende Gäste bekommen beim Einspielen „keine Angabe“
- Reisedokument: Art (einer von drei festen Werten), Nummer (höchstens 30 Zeichen), Ausstellungsdatum, Behörde (höchstens 100 Zeichen), Staat (Ländercode)
- Bild Vorderseite, Bild Rückseite: jeweils der Speicherort der Datei, keine Bilddaten in der Tabelle

Da es höchstens ein Reisedokument je Gast gibt, liegen die Angaben direkt am Gast und nicht in einer eigenen Tabelle.

**Regeln in der Datenbank** (nicht nur in der Oberfläche):
- Sind irgendeine Dokumentangabe oder ein Bild vorhanden, müssen Art und Nummer gesetzt sein
- Das Ausstellungsdatum liegt nicht in der Zukunft
- Ein Bild darf nur am Gast hängen, wenn die Datei im Ordner desselben Kunden liegt, wirklich existiert und an keinem anderen Gast hängt
- Ein anonymisierter Gast hat keine Titel, kein Dokument, keine Bilder und das Geschlecht „keine Angabe“

**Ausweisbilder** liegen in einem **privaten Speicherbereich** („Gast-Dokumente“) in Supabase Storage (EU, eu-west-1):
- ein Ordner je Kunde, Dateiname zufällig (keine Namen oder Nummern im Dateinamen)
- nur JPEG, höchstens 2 MB je Datei (nach dem Umwandeln sind es typischerweise 0,3–0,8 MB)
- kein öffentlicher Zugriff

**Suchtext:** Titel und Dokumentnummer kommen nicht in die Suche (Spec: keine Suche nach Titel/Dokument).

### C) Rechte

| Aktion | Inhaber | Mitarbeiter | Betreiber-Admin (2FA) |
|---|---|---|---|
| Titel, Geschlecht, Dokument lesen | ✓ | ✓ | ✓ (wie alle Kundendaten) |
| Bilder ansehen/herunterladen | ✓ | ✓ | ✓ |
| Bild hochladen | ✓ | ✓, aber nur wirksam beim Anlegen eines neuen Gastes in einer Buchung | – |
| Felder/Bilder am bestehenden Gast ändern | ✓ | – | – |

- **Ansehen:** Ein Bild ist nur abrufbar, wenn es an einem Gast des eigenen Kunden hängt (bzw. für die Person, die es gerade hochgeladen hat, zur Vorschau vor dem Speichern). Ersetzte oder entfernte Bilder sind dadurch sofort nicht mehr abrufbar.
- **Abruf-Links** erzeugt der Server beim Öffnen des Gast-Details. Sie gelten nur kurz (10 Minuten) und funktionieren nur mit Anmeldung im richtigen Kunden.
- **Hochladen** dürfen alle Mitglieder in den Ordner ihres eigenen Kunden. Am Gast „wirksam“ wird ein Bild aber nur über die bestehenden Wege: Gast speichern (nur Inhaber) oder Buchung mit neuem Gast speichern (auch Mitarbeiter). Ein Bild, das nie gespeichert wird, räumt die tägliche Bereinigung weg.
- **Löschen von Dateien** macht nur der Server mit dem geheimen Schlüssel, und nur für Dateien, die die Datenbank vorher als „nicht mehr verwendet“ gemeldet hat.

### D) Bild hochladen: Ablauf

1. Nutzer wählt ein Bild (am Handy: Kamera oder Galerie).
2. **Der Browser wandelt das Bild um:** richtig drehen, längste Seite höchstens 2.000 Pixel, JPEG in guter Qualität. Dabei gehen auch versteckte Fotodaten (z. B. GPS-Standort, Kameramodell) verloren, was beim Datenschutz hilft.
   - HEIC/HEIF: Safari kann das selbst. Für Chrome, Firefox und Edge lädt die App erst in diesem Moment einen HEIC-Dekoder nach (nicht bei jedem Seitenaufruf).
   - JPEG, PNG, WebP, GIF, BMP: können alle Browser selbst.
   - Eingangsdateien bis 30 MB. Größere Dateien lehnt die App mit Hinweis auf die Höchstgröße ab.
3. Das fertige JPEG geht **direkt vom Browser an den privaten Speicher**, nicht über den App-Server. Vercel begrenzt Server-Anfragen auf 4,5 MB, und so bleibt der Server schlank.
4. Das Formular merkt sich den Speicherort. Erst beim **Speichern** wird das Bild am Gast eingetragen, im selben Vorgang wie die übrigen Angaben.

### E) Wann Dateien gelöscht werden
Die Datenbank-Funktionen geben nach dem Speichern die Speicherorte zurück, die nicht mehr verwendet werden. Der Server löscht diese Dateien sofort:
- Gast speichern mit ersetztem oder entferntem Bild
- Zusammenführen: die Bilder des nicht gewählten Dokuments
- Gast löschen oder anonymisieren: alle Bilder des Gastes
- Kunde löschen (Betreiber): der ganze Ordner des Kunden

**Tägliche Bereinigung als Sicherheitsnetz:** Ein Zeitplan (Vercel Cron, einmal pro Tag, im Einstiegstarif möglich) löscht alle Dateien, die älter als 24 Stunden sind und an keinem Gast hängen. Das betrifft Uploads ohne Speichern, abgebrochene Löschungen und Reste gelöschter Kunden. Der Zeitplan ist mit einem geheimen Schlüssel gegen fremde Aufrufe geschützt.

### F) Anpassungen an bestehenden Datenbank-Funktionen
- **Buchung speichern:** Ein neuer Gast übernimmt auch Titel, Geschlecht, Dokument und Bilder, mit denselben Regeln. Bei bestehenden Gästen ändert sich nichts.
- **Zusammenführen:** neue Wahlmöglichkeiten „Titel“ (beide Titel zusammen), „Geschlecht“ und „Reisedokument“ (alle Angaben und beide Bilder als Ganzes). Die Funktion gibt die Bilder des nicht gewählten Dokuments zum Löschen zurück.
- **Anonymisieren/Löschen:** leert die neuen Felder bzw. setzt das Geschlecht auf „keine Angabe“, bereinigt wie bisher das Änderungsprotokoll und gibt die Bilder zum Löschen zurück.
- **Gästeliste:** liefert zusätzlich die Titel für die Namensanzeige.
- **Kunde löschen (Betreiber):** Nach erfolgreichem Löschen entfernt der Server den Ordner des Kunden.

### G) Änderungsprotokoll
Die neuen Felder laufen automatisch ins bestehende Protokoll der Gast-Tabelle. Beim Bild steht dort nur der Speicherort, das Bild selbst nicht. So ist „Bild Vorderseite hochgeladen/ersetzt/entfernt“ mit Person und Zeitpunkt nachvollziehbar. Beim Anonymisieren werden diese Altwerte wie bisher entfernt.

### H) Namensanzeige
Die zentrale Namensanzeige bekommt die beiden Titel dazu („Dr. Anna Huber, LL.M.“, „Huber, MSc“). Alle Stellen, die sie schon verwenden, zeigen dann automatisch den vollen Namen. Sortiert wird weiter nach Nachname, Vorname.

### I) Safari-Fehler Gästeliste
Gleiche Lösung wie in der Betreiber-Kundenliste: Die unsichtbare Klickfläche über der Zeile entfällt, der unterstrichene Name ist der Link. Die Handy-Karten bleiben unverändert.

### J) Tests
- **Integrationstests gegen „apppa-dev“:**
  - Pflichtregel Art + Nummer, Ausstellungsdatum, Längen, feste Werte für Geschlecht und Art;
  - Mitarbeiter können bestehende Gäste nicht ändern, aber per Buchung einen neuen Gast mit Dokument und Bild anlegen;
  - Bilder: Kunde B kann Bilder von Kunde A weder lesen noch an eigene Gäste hängen; ohne Anmeldung kein Abruf; ersetzte Bilder sofort nicht mehr abrufbar;
  - Zusammenführen mit Dokumentwahl; Anonymisieren und Löschen leeren Felder und melden die Bilder zum Löschen;
  - Bereinigung löscht nur unverwendete Dateien, die älter als 24 Stunden sind.
- **E2E:** Titel und Geschlecht anlegen und anzeigen, Name mit Titeln in Liste, Buchung und Kalender, Reisedokument mit Bild (JPEG, PNG und ein HEIC-Beispielbild), Bild groß öffnen und herunterladen, ersetzen, entfernen, Fehlermeldung bei PDF, Mitarbeiter ohne Bearbeiten-Knöpfe, Mitarbeiter legt Buchung mit neuem Gast und Bild an, Zusammenführen, Anonymisieren, Handy-Ansicht, axe.
- **Unit-Tests:** Namensanzeige mit Titeln, Prüfregeln (Pflicht Art + Nummer, Datum, Längen), Umwandlung (Größe, Ausrichtung, Formatprüfung).
- **Manuell:** Safari (Mac und iPhone): Zeilenklick in der Gästeliste, Kamera-Upload, HEIC. Playwright testet nur Chrome.

### K) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- **Gast-Tabelle:** neue Felder und Prüfregeln; bestehende Gäste erhalten „keine Angabe“ beim Geschlecht.
- **Neuer privater Speicherbereich „Gast-Dokumente“** mit Zugriffsregeln:
  - Hochladen durch Mitglieder nur in den eigenen Kunden-Ordner, nur JPEG, höchstens 2 MB;
  - Lesen nur für Bilder, die an einem Gast des eigenen Kunden hängen (plus eigener frischer Upload), Betreiber-Admin lesend;
  - kein Löschen oder Überschreiben durch Nutzer, nur durch den Server.
- **Geänderte geschützte Funktionen:** Buchung speichern, Zusammenführen, Anonymisieren, Löschen, Gästeliste. Neu ist eine Funktion für die Bereinigung, die nur der Server aufrufen darf.
- **Erster Zeitplan (Vercel Cron)** mit neuer Umgebungsvariable für den geheimen Aufruf-Schlüssel (`CRON_SECRET`), in Dev, Staging und Production einzutragen.
- **Bestehende Regeln für Gäste bleiben unverändert.**

### L) Abhängigkeiten
- **`heic-to`:** wandelt HEIC/HEIF-Fotos im Browser um (für Chrome, Firefox, Edge). Wird nur geladen, wenn tatsächlich ein HEIC-Bild gewählt wird. Ein Umwandeln auf dem Server scheidet aus, weil die Bildbibliothek auf Vercel HEIC aus Lizenzgründen nicht kann.
- Sonst keine neuen Pakete. Drehen, Verkleinern und JPEG-Erzeugung macht der Browser selbst. Die Bildansicht nutzt den vorhandenen shadcn-Dialog.

## Implementation Notes (Frontend)
**Stand 2026-10-26.** Die Oberfläche ist fertig. **Ohne die Migration aus `/backend` schlagen Gästeliste, Gast-Detail, Buchungen und Kalender beim Laden fehl**, weil sie die neuen Spalten abfragen (wie bei PROJ-28).

**Daten und Regeln**
- `src/lib/guests.ts`: Geschlecht (`male`, `female`, `diverse`, `inter`, `open`, `unspecified`), Dokumentarten (`passport`, `id_card`, `driving_licence`), Bildplätze `front`/`back`, Speicherbereich `guest-documents`, Prüfung des Speicherorts `<Kunde>/<uuid>.jpg`. `guestDisplayName` mit Titeln; neue Zusammenführ-Angaben `titles`, `gender`, `document` (Dokument als Ganzes).
- `src/lib/validation/guests.ts`: Titel je 50 Zeichen, Geschlecht Pflicht mit Standard, Dokument (Art und Nummer Pflicht, sobald etwas erfasst ist; Ausstellungsdatum nicht in der Zukunft; Staat; Speicherorte). Platzhalter `uploading` blockiert das Speichern während eines Uploads.
- `src/lib/document-image.ts`: Umwandlung im Browser (drehen, längste Seite 2.000 px, JPEG ≤ 2 MB, weißer Hintergrund für Transparenz), HEIC über `heic-to/next` nur bei Bedarf, Eingang bis 30 MB, Fehlercodes `imageTooLarge`, `imageUnsupported`, `imageFailed`.
- Spalten: `title_prefix`, `title_suffix`, `gender`, `document_type`, `document_number`, `document_issued_on`, `document_authority`, `document_country`, `document_front_path`, `document_back_path`. `src/types/database.ts` von Hand ergänzt (inkl. `title_prefix`/`title_suffix` in `guest_list`); `/backend` erzeugt die Typen neu.

**Oberfläche**
- Gast-Formular (`guest-fields.tsx`, auch im Buchungsformular): Titel vor/nach, Geschlecht, aufklappbarer Abschnitt „Reisedokument“ mit zwei Bildplätzen (`document-image-field.tsx`: hinzufügen, ersetzen, entfernen, Vorschau, Fortschritt, Fehlermeldungen). Hinweis, wenn sich die Art ändert und alte Bilder bleiben. Der Abschnitt klappt bei Fehlern auf.
- Gast-Detail: Geschlecht unter „Weitere Angaben“, Abschnitt „Reisedokument“ mit Vorschauen; Bildansicht mit „Herunterladen“ (`document-images.tsx`, `document-image-viewer.tsx`).
- Zusammenführen: Zeilen Titel, Geschlecht und Reisedokument (mit kleinen Vorschauen und Hinweis, dass die Bilder des anderen Dokuments gelöscht werden).
- Name mit Titeln in Gästeliste, Gastauswahl, Dubletten, Buchungsliste, Buchungs-Detail, Konfliktliste und Kalender.
- Safari-Fix Gästeliste: nur der unterstrichene Name ist Link (wie Kundenliste).

**Server-Aktionen**
- `createGuest`/`updateGuest` und „Buchung mit neuem Gast“ speichern die neuen Spalten (gemeinsame Zuordnung `guestDbColumns` in `guests-data.ts`).
- `prepareDocumentUpload` (alle Mitglieder): Speicherort im Kunden-Ordner + einmaliger Upload-Schlüssel (`createSignedUploadUrl`); der Browser lädt mit `uploadToSignedUrl`.
- Bilder löschen (`src/lib/guest-documents.ts`, mit geheimem Schlüssel): nach `updateGuest` (ersetzt/entfernt), `deleteGuest` (gelöscht oder anonymisiert) und `mergeGuests` (nicht gewähltes Dokument). Grundlage ist der Vergleich der Speicherorte vor und nach der Änderung.
- Abruf-Links: `documentImageLinks` erzeugt je Bild einen Anzeige- und einen Download-Link (10 Minuten, Dateiname z. B. `Reisepass-Huber-Vorderseite.jpg`); auch für den zweiten Gast beim Zusammenführen.

**Offen für /backend**
- Migration: neue Spalten mit Prüfregeln (Längen, feste Werte, Art + Nummer Pflicht, Datum, Ländercode, Speicherort im eigenen Kunden-Ordner, existiert, an keinem anderen Gast), Geschlecht `not null default 'unspecified'`.
- Speicherbereich `guest-documents` (privat, nur `image/jpeg`, 2 MB) mit Regeln: Hochladen für Mitglieder nur in den eigenen Ordner; Lesen nur, wenn das Bild an einem Gast des Kunden hängt oder selbst hochgeladen wurde; Betreiber-Admin lesend; kein Ändern/Löschen durch Nutzer.
- `save_booking` (neuer Gast mit neuen Spalten), `merge_guests` (Wahl `titles`, `gender`, `document`), `anonymize_guest` (neue Felder leeren, Geschlecht zurücksetzen), `guest_list` (Titel zurückgeben).
- Kunde löschen: Ordner des Kunden im Speicher entfernen; tägliche Bereinigung (Vercel Cron, `CRON_SECRET`).
- Integrationstests laut Tech Design J.

## Implementation Notes (Backend)
**Stand 2026-10-26.** Migration `supabase/migrations/20261026181450_guest_titles_gender_documents.sql`, eingespielt in Dev („apppa-dev“).

**Datenbank**
- `guests`: zehn neue Spalten mit Prüfregeln (Titel 1–50 Zeichen, Geschlecht `not null default 'unspecified'` mit festen Werten, Dokumentart fest, Nummer 1–30, Behörde 1–100, Staat als Ländercode, Ausstellungsdatum ab 1900). Speicherort nur `<eigener Kunde>/<uuid>.jpg`. „Art + Nummer Pflicht, sobald etwas erfasst ist“, Vorder- ≠ Rückseite, anonymisierte Gäste ohne Titel/Dokument. Eindeutigkeit je Bildplatz per Index; Spalten-Rechte für Anlegen/Ändern ergänzt (RLS unverändert: nur Inhaber).
- Trigger `guests_before_write` ergänzt: Ausstellungsdatum nicht in der Zukunft (23514); neu eingetragene Bilder müssen im Speicher liegen und dürfen an keinem anderen Gast hängen (auch Kreuzprüfung Vorder-/Rückseite) → Fehlercode **P0705** (Meldung „Ausweisbild nicht mehr verfügbar“ in Gäste- und Buchungsaktionen).
- `save_booking`: neuer Gast mit allen neuen Spalten (auch Mitarbeiter). `merge_guests`: Wahl `titles`, `gender`, `document` (als Ganzes); hängt jetzt erst die Buchungen um und löscht den anderen Gast **vor** dem Aktualisieren, damit dessen Bilder zum verbleibenden Gast wandern können. `anonymize_guest`: leert Titel und Dokument, Geschlecht auf „keine Angabe“. `guest_list`: liefert `title_prefix`/`title_suffix` (Rückgabetyp geändert → neu angelegt, Rechte neu gesetzt).

**Speicher (Supabase Storage)**
- Privater Bereich `guest-documents`, nur `image/jpeg`, höchstens 2 MB.
- Regeln auf `storage.objects`: Hochladen nur Mitglieder in den eigenen Kunden-Ordner mit gültigem Dateinamen (`private.document_tenant`); Lesen über `private.can_read_document`: Mitglied oder Admin mit 2FA **und** das Bild hängt an einem Gast des Kunden, oder es ist der eigene frische Upload (`owner_id`). Keine Regeln für Ändern/Löschen → nur der Server mit geheimem Schlüssel.
- `public.unused_guest_documents(limit)`: Dateien älter als 24 Stunden ohne Gast, nur `service_role`.

**Server**
- `src/lib/guest-documents.ts`: `removeTenantDocuments` (beim Löschen eines Kunden in `deleteTenant`), `removeUnusedDocuments` (tägliche Bereinigung).
- Route `src/app/api/cron/ausweisbilder/route.ts` (GET, `Authorization: Bearer CRON_SECRET`, zeitkonstanter Vergleich, ohne gesetzten Schlüssel immer 401), Zeitplan in `vercel.json` täglich 03:00 UTC.
- Runbook `docs/runbooks/supabase.md`, Abschnitt 14.
- **Neue Umgebungsvariable `CRON_SECRET`:** vor dem nächsten `/deploy` in allen Vercel-Umgebungen eintragen und in `.env.local.example` mit Platzhalter dokumentieren (Datei war für den Agenten gesperrt).

**Tests**
- Neu `supabase/tests/guest-documents.integration.test.ts` (14 Tests): Standard/Prüfregeln Titel und Geschlecht, Titel in `guest_list`, Pflicht Art + Nummer, Ausstellungsdatum, Mitarbeiter ändern nicht; Upload nur eigener Ordner/nur JPEG/gültiger Name, Upload-Schlüssel nur eigener Ordner; Bild nur existierend, nie an zwei Gästen, nicht aus fremdem Ordner; Lesen (eigener frischer Upload, Mitglieder, fremder Kunde, ersetzte Bilder sofort nicht mehr); kein Löschen/Überschreiben durch Nutzer; Mitarbeiter-Buchung mit neuem Gast samt Dokument und Bild; Zusammenführen mit Dokumentwahl; Anonymisieren; Bereinigung nur für den Server.
- Neu `src/app/api/cron/ausweisbilder/route.test.ts` (4 Tests). Alle 400 Unit- und Integrationstests grün; E2E-Stichprobe PROJ-7 (Leerzustand, Anlegen, Bearbeiten) grün. Advisors: nur die zwei bekannten Auth-Hinweise.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
