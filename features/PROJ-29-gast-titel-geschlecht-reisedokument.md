# PROJ-29: Gast-Erweiterung: Titel, Geschlecht, Reisedokument

## Status: Planned
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
- Zulässig sind alle gängigen Bildformate, insbesondere Handyfotos: JPEG, PNG, HEIC/HEIF (iPhone), WebP, GIF (erstes Bild), TIFF, BMP. Am Handy kann direkt fotografiert oder ein Bild aus der Galerie gewählt werden.
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
