# PROJ-9: Belegungskalender

## Status: In Review
**Created:** 2026-10-25
**Last Updated:** 2026-10-26

## Dependencies
- Requires: PROJ-6 (Wohnungsverwaltung): Objekte, Wohnungen, archiviert
- Requires: PROJ-8 (Manuelle Buchungen): Buchungen, Optionen, Sperren, Buchungsdetail, Formulare „Neue Buchung“/„Neue Sperre“, Rollenregeln
- Wird genutzt von: PROJ-11 (importierte Buchungen erscheinen in den Kanalfarben Booking.com/Airbnb), PROJ-14 (Dashboard ergänzt KPIs und „Heute“ um den Kalender-Abschnitt)

## Überblick
Inhaber und Mitarbeiter sehen auf einen Blick, welche Wohnung wann belegt ist. Der Kalender steht als Abschnitt **„Belegung“ auf dem Dashboard** und zusätzlich als **Vollbild-Seite** (Navigationspunkt „Belegung“). Er hat zwei Ansichten wie im App-Entwurf (`docs/design/app-entwurf-quelltext.html`):

- **Zeitleiste** (Standard): eine Zeile je Wohnung, Einträge als Balken in der Kanalfarbe
- **Monat:** Kacheln je Tag mit Belegungsgrad, An- und Abreisen sowie Tagesliste

Ein Klick auf einen Eintrag öffnet das vollständige Buchungs- bzw. Sperrendetail in einem Seitenpanel. Ein Klick auf einen freien Tag legt eine neue Buchung an.

## User Stories
- Als **Inhaber** möchte ich auf dem Dashboard sehen, welche Wohnungen in den nächsten zwei Wochen belegt sind, damit ich Lücken und Wechseltage sofort erkenne.
- Als **Mitarbeiter** möchte ich in der Monatsansicht sehen, an welchen Tagen wie viele An- und Abreisen anstehen, damit ich Reinigung und Schlüsselübergaben planen kann.
- Als **Inhaber** möchte ich auf einen Balken klicken und die Buchung direkt dort bearbeiten oder stornieren, ohne den Kalender zu verlassen.
- Als **Mitarbeiter** möchte ich bei einem Anruf in eine freie Zelle klicken und eine Buchung mit vorbelegter Wohnung und Anreise anlegen, damit die Erfassung schnell geht.
- Als **Inhaber** möchte ich eine Überschneidung im Kalender deutlich sehen, damit ich eine Doppelbuchung bemerke und auflöse.
- Als **Inhaber mit mehreren Objekten** möchte ich den Kalender auf ein Objekt einschränken, damit ich nur die Wohnungen sehe, um die es gerade geht.
- Als **Inhaber** möchte ich den Kalender in einer Vollbild-Ansicht mit vier Wochen sehen, damit ich längere Zeiträume planen kann.

## Umfang

### Orte
| Ort | Inhalt |
|---|---|
| **Dashboard** (`/`), Abschnitt „Belegung“ | Kalender mit beiden Ansichten; Zeitleiste 14 Tage; Link „Vollbild“ zur Vollbild-Seite. Steht unter dem Seitenkopf und den Einladungen; weitere Dashboard-Inhalte folgen mit PROJ-14 |
| **Vollbild-Seite** (`/belegung`, Navigationspunkt „Belegung“) | Derselbe Kalender ohne andere Dashboard-Inhalte; Zeitleiste am Desktop **28 Tage**, Monatsansicht gleich |

Der vorbereitete Navigationspunkt „Belegung“ wird freigeschaltet (Inhaber und Mitarbeiter, am Handy in der unteren Leiste).

### Kopfzeile des Kalenders (wie Entwurf)
- Überschrift „Belegung“, Umschalter **Zeitleiste | Monat**
- Blättern: Zurück, Datumsangabe des Zeitraums, Weiter, „Heute“
- Klick auf die Datumsangabe öffnet einen Datumswähler; die gewählte Woche bzw. der Monat wird angezeigt
- Buttons „Neue Buchung“ und „Neue Sperre“ (bestehende Bausteine aus PROJ-8)
- Zweite Zeile: Filterchips „Alle“ + je **Objekt** (nur, wenn der Kunde mehr als ein Objekt hat) und rechts die Farblegende

### Einträge und Darstellung
| Eintrag | Darstellung |
|---|---|
| Buchung (aktiv) | gefüllter Balken in der Kanalfarbe: Direkt `neutral-800`, Booking.com `accent-700`, Airbnb `accent-2-700` (die beiden letzten erst mit PROJ-11), Text weiß |
| Option (aktiv) | Balken nur mit **Rahmen** in der Kanalfarbe, Hintergrund hell, Label beginnt mit „Option“ (wie das umrandete Badge in der Buchungsliste) |
| Sperre | schraffierter Balken wie im Entwurf (`neutral-300`/`neutral-200`), Label = Grund (z. B. „Eigennutzung“) |
| Stornierte Buchungen, verfallene Optionen | erscheinen **nicht** |

- **Label auf dem Balken:** „Nachname · Personen“ (wie Entwurf); bei Firmengästen der Gastname, wie er in der Buchungsliste steht. Kein Preis
- **Tooltip:** voller Gastname · Anreise – Abreise
- **Position:** Balken beginnen in der Mitte des Anreisetags und enden in der Mitte des Abreisetags (wie Entwurf), damit Wechseltage beide Einträge zeigen
- **Wochenenden** leicht hinterlegt (`neutral-200`), **heute** mit Markierungslinie und hervorgehobener Tageszahl (`accent-2`, wie Entwurf)
- **Legende:** Direkt, Option, Gesperrt; Booking.com und Airbnb erscheinen ab PROJ-11

### Zeitleiste
- Linke Spalte: Wohnungsname und darunter das Objekt; Zeilen nach Objekt gruppiert, innerhalb in der Reihenfolge der Wohnungsverwaltung
- Sichtbarer Zeitraum: Dashboard 14 Tage, Vollbild-Seite 28 Tage (Desktop)
- Start beim Öffnen: heute − 2 Tage (wie Entwurf)
- Zurück/Weiter um **7 Tage**
- **Überschneidungen:** Überlappen sich Einträge einer Wohnung, wird die Zeile höher und die Balken liegen untereinander. Neben dem Wohnungsnamen erscheint ein Warnsymbol „Überschneidung“ (Magenta, wie die Warnungen in PROJ-8)
- **Handy:** Die Zeitleiste behält ihre Breite und ist seitlich scrollbar; die Spalte mit dem Wohnungsnamen bleibt links stehen. Die Seite selbst scrollt nicht seitlich
- **Freie Zelle anklicken:** öffnet „Neue Buchung“ mit Wohnung und Anreise = geklickter Tag, Abreise = Tag + 1. Im Formular lässt sich wie gewohnt auf Option wechseln; „Neue Sperre“ bleibt über den Button erreichbar

### Monatsansicht (wie Entwurf)
- Raster Mo–So, Kachel je Tag mit Tageszahl, „belegt x/y“, Fortschrittsbalken, Anzahl „n An“ / „n Ab“
- **Belegt x/y:** x = Wohnungen, die in dieser Nacht eine Buchung, Option **oder Sperre** haben; y = alle aktiven Wohnungen (im Filter)
- **An/Ab:** zählt Buchungen und Optionen (Sperren nicht)
- Klick auf eine Kachel wählt den Tag; rechts (am Handy darunter) die **Tagesliste**: alle Einträge, die in dieser Nacht belegen oder an diesem Tag abreisen, mit Farbpunkt, Gast/Grund, Wohnung und Hinweis „Anreise“, „Abreise“ oder „bis {Datum}“. Klick öffnet das Detailpanel
- Leere Tagesliste: „Keine Belegung an diesem Tag.“
- Zurück/Weiter um einen Monat; beim Öffnen ist der aktuelle Monat und heute gewählt

### Detailpanel
- Klick auf einen Balken oder einen Eintrag der Tagesliste öffnet ein **Seitenpanel** (rechts, am Handy bildschirmfüllend, wie das bestehende Detail-Panel) mit dem **vollständigen** Buchungs- bzw. Sperrendetail aus PROJ-8: Zeitraum, Wohnung, Gast mit Link, Personen, Mitreisende, Preis (nur Inhaber), Zustand
- Dazu die Aktionen nach den Rollenregeln aus PROJ-8: Bearbeiten, Option bestätigen, Mitreisende nachtragen, Stornieren, Sperre löschen
- Nach jeder Änderung im Panel aktualisiert sich der Kalender sofort; der gerade angezeigte Zeitraum, die Ansicht und der Filter bleiben erhalten
- Wird ein Eintrag storniert oder gelöscht, schließt das Panel und der Balken verschwindet

### Gemerkte Einstellungen
- Ansicht (Zeitleiste/Monat) und Objektfilter werden **je Gerät** gemerkt, gemeinsam für Dashboard und Vollbild-Seite
- Der Zeitraum wird nicht gemerkt; der Kalender öffnet immer bei heute

### Archivierte Wohnungen
Sie erscheinen nur, wenn sie im sichtbaren Zeitraum Einträge haben, und tragen den Hinweis „archiviert“. Sie zählen nicht zu y, und in ihrer Zeile kann man per Klick nichts anlegen.

### Rollen
| Aktion | Inhaber | Mitarbeiter | Betreiber-Admin |
|---|---|---|---|
| Kalender sehen (beide Orte) | ✓ | ✓ | ✓ (nur lesen) |
| Detailpanel öffnen | ✓ | ✓ | ✓ (ohne Aktionen) |
| Aktionen im Panel | nach PROJ-8 | nach PROJ-8 | – |
| Preis im Panel | ✓ | – | wie PROJ-8 |
| Anlegen per Klick auf freien Tag | ✓ | ✓ | – |

## Out of Scope
- **KPIs, „Heute“ (An-/Abreisen), offene Zahlungen, Sync-Status auf dem Dashboard:** PROJ-14
- **Plattformbuchungen** (Booking.com/Airbnb) im Kalender: Darstellung ist vorbereitet, die Daten kommen mit PROJ-11
- **Hinweise „auf Booking.com/Airbnb gesperrt“:** PROJ-12
- **Ziehen über mehrere Tage** zum Anlegen sowie **Verschieben/Verlängern per Drag & Drop:** nicht geplant; Änderungen nur über das Formular
- **Eigene Handy-Zeitleiste** (7 Tage, Wischen): bewusst nicht; die Zeitleiste scrollt seitlich
- **Filter nach Gemeinde** (wie im Entwurf): bewusst durch den Objektfilter ersetzt
- **Umschalter „Archivierte zeigen“:** nicht nötig, archivierte Wohnungen erscheinen bei Einträgen von selbst
- **Feiertage, Preise oder Mindestaufenthalt im Kalender:** nicht geplant
- **Live-Aktualisierung**, wenn eine andere Person gleichzeitig ändert: Der Kalender lädt beim Öffnen, Blättern und nach eigenen Änderungen neu
- **Kalender-Abo (iCal):** PROJ-17
- **Auslastung in Prozent/Statistik:** PROJ-18

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Orte und Navigation
- [ ] Angenommen ein Inhaber oder Mitarbeiter ist angemeldet, wenn er das Dashboard öffnet, dann sieht er den Abschnitt „Belegung“ mit der Zeitleiste über 14 Tage ab heute − 2 Tage
- [ ] Angenommen der Nutzer ist auf dem Dashboard, wenn er auf „Vollbild“ klickt, dann öffnet sich `/belegung` mit derselben Ansicht und demselben Objektfilter
- [ ] Angenommen ein Inhaber oder Mitarbeiter ist angemeldet, dann zeigt die Navigation den Punkt „Belegung“ (am Handy in der unteren Leiste)
- [ ] Angenommen die Vollbild-Seite ist am Desktop geöffnet, wenn die Zeitleiste gewählt ist, dann zeigt sie 28 Tage

### Zeitleiste
- [ ] Angenommen eine aktive Direktbuchung existiert im Zeitraum, dann erscheint sie als gefüllter Balken in `neutral-800` mit „Nachname · Personen“
- [ ] Angenommen eine aktive Option existiert, dann erscheint sie als umrandeter Balken, dessen Label mit „Option“ beginnt
- [ ] Angenommen eine Sperre existiert, dann erscheint sie schraffiert mit dem Grund als Label
- [ ] Angenommen eine Buchung ist storniert oder eine Option verfallen, dann erscheint sie im Kalender nicht
- [ ] Angenommen eine Buchung reist am selben Tag ab, an dem die nächste anreist, dann sind beide Balken an diesem Tag sichtbar, ohne sich zu überdecken
- [ ] Angenommen zwei Einträge einer Wohnung überschneiden sich, dann liegen ihre Balken untereinander in einer höheren Zeile und neben der Wohnung steht ein Warnsymbol „Überschneidung“
- [ ] Angenommen die Zeitleiste ist offen, wenn der Nutzer „Weiter“ klickt, dann verschiebt sich der Zeitraum um 7 Tage; „Heute“ stellt den Start auf heute − 2 Tage zurück
- [ ] Angenommen die Zeitleiste ist offen, wenn der Nutzer auf die Datumsangabe klickt und ein Datum wählt, dann zeigt die Zeitleiste den Zeitraum ab diesem Datum
- [ ] Angenommen ein Eintrag beginnt vor dem sichtbaren Zeitraum oder endet danach, dann wird der Balken am Rand abgeschnitten dargestellt und bleibt anklickbar
- [ ] Angenommen der Nutzer ist am Handy, wenn er die Zeitleiste öffnet, dann kann er sie seitlich scrollen, während die Spalte mit den Wohnungsnamen stehen bleibt und die Seite nicht seitlich scrollt

### Monatsansicht
- [ ] Angenommen der Nutzer schaltet auf „Monat“, dann sieht er den aktuellen Monat mit Kacheln Mo–So, und heute ist gewählt
- [ ] Angenommen in einer Nacht haben 3 von 5 aktiven Wohnungen eine Buchung, Option oder Sperre, dann zeigt die Kachel „3/5“ und einen Balken zu 60 %
- [ ] Angenommen an einem Tag reisen 2 Gäste an und 1 ab, dann zeigt die Kachel „2 An“ und „1 Ab“; Sperren zählen dabei nicht
- [ ] Angenommen der Nutzer klickt auf eine Kachel, dann zeigt die Tagesliste alle Einträge dieser Nacht und alle Abreisen dieses Tages mit „Anreise“, „Abreise“ oder „bis {Datum}“
- [ ] Angenommen an einem Tag gibt es keine Einträge, wenn er gewählt ist, dann steht in der Tagesliste „Keine Belegung an diesem Tag.“

### Detailpanel
- [ ] Angenommen der Nutzer klickt auf einen Balken oder einen Eintrag der Tagesliste, dann öffnet sich rechts ein Seitenpanel mit dem vollständigen Detail aus PROJ-8, am Handy bildschirmfüllend
- [ ] Angenommen ein Mitarbeiter öffnet eine Buchung, dann sieht er keinen Preis und keine Aktion „Stornieren“ (Rollen wie PROJ-8)
- [ ] Angenommen ein Inhaber ändert im Panel den Zeitraum einer Buchung und speichert, dann verschiebt sich der Balken sofort, und Ansicht, Zeitraum und Filter bleiben gleich
- [ ] Angenommen ein Inhaber storniert im Panel eine Buchung, dann schließt das Panel und der Balken verschwindet
- [ ] Angenommen der Betreiber-Admin öffnet ein Detail, dann sieht er keine Aktionen

### Anlegen
- [ ] Angenommen eine Zelle der Zeitleiste ist frei, wenn ein Inhaber oder Mitarbeiter darauf klickt, dann öffnet sich „Neue Buchung“ mit dieser Wohnung, Anreise = Tag und Abreise = Tag + 1
- [ ] Angenommen die neue Buchung wurde gespeichert, dann erscheint sie sofort als Balken im Kalender
- [ ] Angenommen die Wohnung der Zeile ist archiviert, wenn der Nutzer in eine freie Zelle klickt, dann passiert nichts
- [ ] Angenommen der Nutzer klickt „Neue Sperre“ über dem Kalender, dann öffnet sich das Sperren-Formular aus PROJ-8

### Filter und gemerkte Einstellungen
- [ ] Angenommen der Kunde hat mehr als ein Objekt, dann zeigt der Kalender Chips „Alle“ und je Objekt; bei nur einem Objekt gibt es keine Chips
- [ ] Angenommen der Nutzer wählt ein Objekt, dann zeigen Zeitleiste und Monatsansicht (inkl. x/y) nur dessen Wohnungen
- [ ] Angenommen der Nutzer hat „Monat“ und ein Objekt gewählt, wenn er die Seite neu lädt, dann sind Ansicht und Filter auf diesem Gerät noch gewählt, der Zeitraum beginnt wieder bei heute

### Archivierte Wohnungen und Leerzustände
- [ ] Angenommen eine archivierte Wohnung hat im sichtbaren Zeitraum einen Eintrag, dann erscheint ihre Zeile mit dem Hinweis „archiviert“; ohne Eintrag fehlt sie
- [ ] Angenommen der Kunde hat noch keine Wohnung, dann zeigt der Kalender einen Leerzustand; der Inhaber erhält einen Link „Wohnung anlegen“ zur Wohnungsverwaltung, der Mitarbeiter den Hinweis, dass der Inhaber Wohnungen anlegt
- [ ] Angenommen es gibt Wohnungen, aber keine Einträge im Zeitraum, dann zeigt die Zeitleiste die leeren Zeilen (kein Leerzustand), damit man per Klick anlegen kann
- [ ] Angenommen das Laden schlägt fehl, dann erscheint eine Fehlermeldung mit „Erneut versuchen“, und die übrigen Dashboard-Inhalte bleiben nutzbar

## Edge Cases
- **Lange Aufenthalte** (z. B. 61 Nächte Dienstwohnung): Der Balken füllt die ganze Zeitleiste, das Label bleibt am linken Rand sichtbar
- **Kurze Balken** (1 Nacht): Das Label wird gekürzt; Tooltip und Panel zeigen alles
- **Mehr als zwei Überschneidungen** in einer Wohnung: Die Zeile wächst um jede weitere Ebene
- **Option verfällt, während der Kalender offen ist:** Sie verschwindet beim nächsten Laden (Blättern, Neuladen, eigene Änderung)
- **Eine andere Person ändert oder storniert gleichzeitig:** Die Ansicht aktualisiert sich erst beim nächsten Laden. Öffnet man das Panel eines inzwischen stornierten Eintrags, zeigt es den aktuellen Zustand (Regeln aus PROJ-8 für gleichzeitiges Bearbeiten)
- **Klick auf eine freie Zelle in einer Zeile mit Überschneidung:** Es wird wie gewohnt angelegt; die Konfliktwarnung aus PROJ-8 greift
- **Klick auf einen Tag in der Vergangenheit:** „Neue Buchung“ öffnet trotzdem vorbelegt (Nacherfassung ist erlaubt wie in PROJ-8)
- **Monat mit 6 Wochenzeilen:** Raster wächst, keine Kachel fällt weg
- **Sehr viele Wohnungen** (einige Dutzend): Die Zeitleiste scrollt vertikal mit der Seite; die Kopfzeile mit den Tagen muss nicht fixiert sein
- **Kunde ohne Objektzuordnung** einzelner Wohnungen: Laut PROJ-6 gehört jede Wohnung zu einem Objekt; kein Sonderfall
- **Gemerkter Objektfilter zeigt auf ein gelöschtes oder archiviertes Objekt:** Der Filter fällt auf „Alle“ zurück

## Technical Requirements
- **Performance:** Ein Zeitraum von 28 Tagen bzw. einem Monat mit 50 Wohnungen lädt in unter 1 s; Blättern fühlt sich ohne Verzögerung an
- **Sicherheit:** Nur Einträge des eigenen Kunden (Mandanten-RLS aus PROJ-1); Preise gelangen nicht an Mitarbeiter, auch nicht über die Kalenderdaten
- **Barrierefreiheit:** Balken und Kacheln sind per Tastatur erreichbar und haben eine Beschriftung (Gast, Zeitraum, Art); Farbe ist nie das einzige Unterscheidungsmerkmal (Option = Rahmen + Label, Sperre = Schraffur + Grund)
- **Format:** Österreichische Datumsformate, Wochenbeginn Montag
- **Geräte:** Desktop und mobile Browser

## Open Questions
- [ ] Soll die Zeitleiste ab einer bestimmten Anzahl Wohnungen die Kopfzeile mit den Tagen beim Scrollen fixieren? (nach Rückmeldung der Pilotkunden)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kalender als Abschnitt auf dem Dashboard | Vom Nutzer gewählt; wie im Entwurf, der Kalender ist der zentrale Einstieg | 2026-10-25 |
| Zusätzlich Vollbild-Seite `/belegung` mit Navigationspunkt „Belegung“ | Vom Nutzer gewählt; mehr Platz für die Planung, der vorbereitete Navigationspunkt bleibt | 2026-10-25 |
| Vollbild-Seite: Zeitleiste 28 statt 14 Tage, sonst gleich | Vom Nutzer gewählt; eine Bedienung, aber echter Mehrwert im Vollbild | 2026-10-25 |
| Zwei Ansichten wie Entwurf: Zeitleiste (Standard) und Monat | Vom Nutzer gewählt; Entwurf ist abgestimmt | 2026-10-25 |
| Optionen als umrandete Balken, stornierte/verfallene ausgeblendet | Vom Nutzer gewählt; gleiche Bildsprache wie das Options-Badge in der Buchungsliste | 2026-10-25 |
| Klick auf Eintrag öffnet das vollständige Detail mit Aktionen im Seitenpanel | Vom Nutzer gewählt; Bearbeiten ohne den Kalender zu verlassen | 2026-10-25 |
| Klick auf freien Tag legt eine Buchung mit Wohnung und Anreise an | Vom Nutzer gewählt; schnelle Erfassung bei Anrufen; Ziehen über Tage bewusst nicht | 2026-10-25 |
| Filterchips je Objekt statt je Gemeinde | Vom Nutzer gewählt; Objekt entspricht der Arbeitsweise besser; Abweichung vom Entwurf | 2026-10-25 |
| Handy: Zeitleiste scrollt seitlich (wie Entwurf) | Vom Nutzer gewählt; keine zweite Handy-Variante zu pflegen | 2026-10-25 |
| Blättern um 7 Tage, Start heute − 2, Datumswähler zum Springen | Vom Nutzer gewählt; Überlappung beim Blättern erhält die Orientierung | 2026-10-25 |
| Überschneidungen untereinander mit Warnsymbol | Vom Nutzer gewählt; nichts wird verdeckt, Doppelbuchungen fallen auf | 2026-10-25 |
| „Belegt x/y“ zählt Buchungen, Optionen und Sperren | Vom Nutzer gewählt; für die Planung zählt, ob die Wohnung frei ist; abweichend vom Entwurf, der nur Buchungen zählt | 2026-10-25 |
| Archivierte Wohnungen nur, wenn sie im Zeitraum Einträge haben | Vom Nutzer gewählt; alte Buchungen bleiben sichtbar, ohne die Liste zu füllen | 2026-10-25 |
| Ansicht und Filter je Gerät gemerkt, Zeitraum nicht | Kalender soll immer bei heute öffnen; die bevorzugte Ansicht bleibt | 2026-10-25 |
| Mitarbeiter dürfen den Standardpreis der Wohnungen im Seiten-Payload erhalten | Vom Nutzer bei der QA entschieden: keine Buchungsbeträge, in der Oberfläche nicht sichtbar; Verhalten wie seit PROJ-8 | 2026-10-26 |
| Kein Preis auf Balken und Kacheln | Mitarbeiter dürfen keine Preise sehen (PROJ-8); der Preis steht im Panel für Inhaber | 2026-10-25 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Keine Datenbankänderung; Kalender liest die bestehenden Buchungen mit eigener, schlanker Abfrage ohne Beträge | Alle Angaben sind seit PROJ-8 vorhanden, der Index auf Wohnung und Zeitraum besteht; ohne Beträge erreicht kein Preis die Mitarbeiter | 2026-10-25 |
| Zeitraum, Ansicht, Filter, gewählter Tag und offener Eintrag stehen in der Adresse; Laden auf dem Server | Gleiches Muster wie die Buchungsliste; „Zurück“ funktioniert; nach Aktionen erneuert `router.refresh()` Kalender und Panel in einem Zug | 2026-10-25 |
| Detailpanel = Inhalt der Buchungs-Detailseite als gemeinsamer Baustein, im Kalender in einem Seitenpanel | Ein Detail für Seite und Panel, keine doppelte Pflege; Aktionen und Rollenregeln aus PROJ-8 gelten unverändert | 2026-10-25 |
| Panel über Adress-Parameter statt „abfangender Routen“ von Next.js | Funktioniert gleich auf `/` und `/belegung`, ist einfacher zu testen; abfangende Routen bräuchten zwei Varianten und verhalten sich beim Neuladen anders | 2026-10-25 |
| Ansicht und Objektfilter je Gerät in einem Cookie statt im Browser-Speicher | Der Server kennt die Wahl schon beim ersten Laden, dadurch kein Umspringen der Ansicht nach dem Laden | 2026-10-25 |
| Vollbild-Seite zeigt immer 28 Tage, auch am Handy (seitlich scrollbar) | Der Server kennt die Bildschirmbreite nicht; am Handy wird ohnehin gescrollt | 2026-10-25 |
| Balkenlage, Ebenen bei Überschneidungen und Monatszahlen als reine Rechenfunktionen | Gut mit Unit-Tests abzusichern (Wechseltag, Ränder, mehrere Ebenen), unabhängig von der Darstellung | 2026-10-25 |
| Datumswähler: native Datumseingabe in einem Popover, keine Kalender-Bibliothek | Wie die Datumsfelder in PROJ-8; kein neues Paket | 2026-10-25 |
| Freie Zellen nur per Maus/Touch, nicht in der Tab-Reihenfolge | Bei 50 Wohnungen × 28 Tagen wären es über 1.000 Tab-Stopps; Tastatur nutzt „Neue Buchung“ | 2026-10-25 |
| „Belegt x/y“ zählt nur nicht archivierte Wohnungen (x und y) | Sonst könnte x größer als y werden; archivierte Wohnungen sind nicht mehr buchbar | 2026-10-25 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Buchungen (PROJ-8):** eine Tabelle für Buchungen, Optionen und Sperren mit Kanal, Zeitraum, Personen, Sperrgrund, Ablaufdatum und Storno. Der Zustand (aktiv, verfallen, storniert) wird berechnet. Ein Index auf Wohnung und Zeitraum besteht. Beträge stehen in eigenen Tabellen, die nur Inhaber lesen.
- **Bausteine aus PROJ-8:**
  - Formulare „Neue Buchung“ und „Neue Sperre“ (Seitenpanels);
  - Aktionen im Detail (Bearbeiten, Bestätigen, Stornieren, Mitreisende, Notiz);
  - Kennzeichen (Option, storniert, überschneidet sich);
  - Rechenhilfen für Nächte, Überschneidung, Zustand und Personen.
  Nach jeder Aktion erneuern sie die Seite.
- **Buchungs-Detailseite** `/buchungen/[id]`: wird auf dem Server aufgebaut und zeigt den Preis nur dem Inhaber.
- **Wohnungen (PROJ-6):** Objekt, Name, archiviert; Anzeige „Objekt · Wohnung“.
- **Navigation (PROJ-2):** Punkt „Belegung“ (`/belegung`) ist angelegt und noch nicht freigeschaltet.
- **Shell:** Seitenkopf, Leerzustand, Detail-Panel, Popover, Tooltip.

### A) Seiten und Bausteine

```
Dashboard  /  (alle Mitglieder)
+-- Seitenkopf, Einladungen (wie bisher)
+-- Abschnitt „Belegung“  → Kalender, Variante „Dashboard“ (14 Tage) + Link „Vollbild“

Vollbild-Seite  /belegung  (alle Mitglieder, neuer Navigationspunkt)
+-- Kalender, Variante „Vollbild“ (28 Tage)

Kalender (gemeinsamer Baustein)
+-- Kopfzeile
|   +-- Überschrift „Belegung“ · Umschalter Zeitleiste | Monat
|   +-- ‹ Zeitraum › (Klick → Popover mit Datumsfeld) · „Heute“
|   +-- „Neue Buchung“ · „Neue Sperre“ (bestehende Knöpfe aus PROJ-8)
+-- Filterzeile: Chips „Alle“ + je Objekt (ab 2 Objekten) · Legende
+-- Zeitleiste
|   +-- Kopf: Wochentag + Tageszahl je Spalte, heute hervorgehoben, Wochenenden hinterlegt
|   +-- je Objekt eine Gruppe, je Wohnung eine Zeile
|   |   +-- linke Spalte (bleibt beim seitlichen Scrollen stehen): Name, Objekt,
|   |   |   ggf. „archiviert“, ggf. Warnsymbol „Überschneidung“
|   |   +-- Balken (Knopf mit Beschriftung und Tooltip), je Ebene eine Spur
|   |   +-- freie Fläche: Klick auf einen Tag → „Neue Buchung“ vorbelegt
|   +-- Markierungslinie „heute“
+-- Monatsansicht
|   +-- Raster Mo–So: Kachel je Tag (Zahl, x/y, Balken, „n An“, „n Ab“)
|   +-- Tagesliste des gewählten Tages (Desktop rechts, Handy darunter)
+-- Leerzustand (keine Wohnung) · Fehlerzustand mit „Erneut versuchen“
+-- Detailpanel (Seitenpanel, Handy bildschirmfüllend)
    +-- Kopf: Nummer, Wohnung, Gast bzw. Sperrgrund, Kennzeichen
    +-- Buchungsdetail-Inhalt (gemeinsam mit /buchungen/[id])
    +-- Aktionen aus PROJ-8 (Bearbeiten öffnet das Formular über dem Panel)
```

**Gemeinsames Buchungsdetail:** Der Inhalt der Detailseite (Kennzeichen, Hinweise, Aktionen, Aufenthalt, Gast, Mitreisende, Preis) wird zu einem eigenen Baustein. Die Seite `/buchungen/[id]` zeigt ihn mit Seitenkopf und „Zurück“, der Kalender im Panel. Links auf überschneidende Einträge öffnen im Kalender den anderen Eintrag im Panel, auf der Detailseite wie bisher dessen Seite.

**Ergänzungen an PROJ-8-Bausteinen:**
- „Neue Buchung“ nimmt Wohnung und Anreise als Vorbelegung an; die Abreise ist Anreise + 1.
- Die Aktionen melden „storniert“ bzw. „Sperre gelöscht“ zurück, damit der Kalender das Panel schließt.

### B) Daten (in Worten)

**Keine Änderung an der Datenbank.** Der Kalender liest mit einer eigenen, schlanken Abfrage je Zeitraum:

- **Wohnungen** des Kunden: Kennung, Name, Objekt (Kennung und Name), archiviert. Sortiert nach „Objekt · Wohnung“ wie in der Wohnungsverwaltung.
- **Einträge**, deren Zeitraum den sichtbaren Bereich berührt, nur nicht stornierte. Verfallene Optionen werden mit der Zustandsregel aus PROJ-8 herausgefiltert. Je Eintrag:
  - Kennung, Wohnung, Art, Kanal, Anreise, Abreise;
  - Personen (Erwachsene + Kinder), Sperrgrund, Ablaufdatum der Option;
  - Gastname: Nachname für den Balken, voller Name für Tooltip und Tagesliste.
  - **Keine Beträge**, auch nicht für Inhaber.
- **Bereich:**
  - Zeitleiste: Start bis Start + 14 bzw. 28 Tage.
  - Monat: erster bis letzter Tag des Monats, dazu der Folgetag, damit Abreisen am Monatsletzten zählen.
- **Archivierte Wohnungen:** Sie werden mitgeladen und nur angezeigt, wenn sie im Bereich Einträge haben.

**Abgeleitete Werte (reine Rechenfunktionen, mit Unit-Tests):**
- **Balkenlage:** Beginn Mitte Anreisetag, Ende Mitte Abreisetag, am Rand des Bereichs abgeschnitten.
- **Ebenen:** Einträge einer Wohnung, die sich schneiden, kommen in die nächste freie Spur. Der Wechseltag zählt nicht als Überschneidung (Regel aus PROJ-8). Mehr als eine Spur heißt Warnsymbol.
- **Monatskachel:**
  - x = nicht archivierte Wohnungen im Filter mit Eintrag in dieser Nacht (Buchung, Option oder Sperre);
  - y = nicht archivierte Wohnungen im Filter;
  - An/Ab = Buchungen und Optionen mit Anreise bzw. Abreise an diesem Tag.
- **Tagesliste:** Einträge, die in der Nacht belegen oder an diesem Tag abreisen, mit „Anreise“, „Abreise“ oder „bis {Datum}“.

**Was in der Adresse steht** (wie bei der Buchungsliste; teilbar, „Zurück“ funktioniert):
- Ansicht;
- Start der Zeitleiste bzw. Monat;
- gewählter Tag (Monatsansicht);
- Objektfilter;
- offener Eintrag (Panel).

Ohne Angaben gilt: Start heute − 2 Tage bzw. aktueller Monat und heute.

**Was je Gerät gemerkt wird:** Ansicht und Objektfilter in einem Cookie, gemeinsam für Dashboard und Vollbild. Der Server liest es beim ersten Laden, deshalb springt die Ansicht nicht um. Der Zeitraum wird nicht gemerkt. Zeigt der gemerkte Filter auf ein Objekt, das es nicht mehr gibt, gilt „Alle“.

### C) Ablauf
- **Laden:** Die Seite wird auf dem Server mit den Daten des Bereichs aufgebaut. Blättern, Ansicht und Filter ändern die Adresse. Der Kalender zeigt währenddessen einen dezenten Ladezustand. Die Nachbarzeiträume für Zurück/Weiter werden vorab geladen, damit Blättern sofort reagiert.
- **Panel öffnen:** Ein Klick auf einen Balken oder einen Eintrag der Tagesliste setzt den offenen Eintrag in die Adresse. Der Server lädt das Detail mit denselben Regeln wie die Detailseite, den Preis also nur für Inhaber. Schließen entfernt den Parameter.
- **Nach Aktionen** (Bearbeiten, Bestätigen, Mitreisende, Notiz) erneuert die Seite Kalender und Panel in einem Zug. Ansicht, Zeitraum und Filter bleiben, weil sie in der Adresse stehen.
- **Stornieren / Sperre löschen:** Das Panel schließt, der Balken verschwindet.
- **Eintrag nicht mehr vorhanden** (z. B. gelöschte Sperre über einen alten Link): Der Kalender öffnet ohne Panel und meldet „Eintrag nicht gefunden“.
- **Anlegen per Klick:** Ein Klick auf eine freie Stelle einer aktiven Wohnung öffnet „Neue Buchung“ mit Wohnung und Tag. In Zeilen archivierter Wohnungen passiert nichts. Nach dem Speichern erneuert sich der Kalender.
- **Fehler beim Laden:** Nur der Kalender-Abschnitt zeigt den Fehler mit „Erneut versuchen“, der Rest des Dashboards bleibt nutzbar (eigene Fehlergrenze).
- **Keine Live-Aktualisierung:** Neu geladen wird beim Öffnen, Blättern und nach eigenen Aktionen (Spec).

### D) Rechte
- Keine neuen Regeln. Lesen läuft über die bestehenden Zugriffsregeln (Mandanten-RLS). Die Kalenderabfrage enthält keine Beträge.
- Das Panel nutzt die Rollenregeln aus PROJ-8: Mitarbeiter ohne Preis und Stornieren, Betreiber-Admin nur lesend und ohne Aktionen.
- Der Punkt „Belegung“ und das Dashboard sind für Inhaber und Mitarbeiter erreichbar.

### E) Darstellung (nach Entwurf und Design-System)
- **Kanalfarben** aus dem Entwurf: Direkt `neutral-800`, Booking.com `accent-700`, Airbnb `accent-2-700`.
  - Option: Rahmen in der Kanalfarbe auf hellem Grund.
  - Sperre: Schraffur `neutral-300`/`neutral-200`.
  - Die Zuordnung Kanal → Farbe liegt an einer Stelle, damit PROJ-11 nur Daten liefern muss.
- **Heute:** Linie und Tageszahl in `accent-2`. Wochenenden `neutral-200`. Überschneidungs-Warnsymbol in Magenta wie die Warnungen aus PROJ-8.
- **Handy:** Die Zeitleiste behält ihre Mindestbreite und scrollt in ihrem eigenen Bereich seitlich. Die Namensspalte bleibt stehen. Die Seite scrollt nicht seitlich.
- **Barrierefreiheit:**
  - Balken sind Knöpfe mit Beschriftung „Gast, Zeitraum, Art“;
  - Kacheln sind Knöpfe;
  - Farbe ist nie allein unterscheidend (Rahmen + „Option“, Schraffur + Grund);
  - freie Zellen sind nicht in der Tab-Reihenfolge, für die Tastatur gibt es „Neue Buchung“.
- **Texte** in `messages/de.json` (Bereich „Belegung“), Formate de-AT, Woche ab Montag, Zeitzone Wien.

### F) Navigation
Der Punkt „Belegung“ wird freigeschaltet. Am Handy steht er in der unteren Leiste; dort sind dann Dashboard, Belegung, Buchungen und Gäste, der Rest liegt unter „Mehr“ wie vorgesehen.

### G) Tests
- **Unit:**
  - Balkenlage inkl. Ränder und Wechseltag;
  - Ebenen bei 2 und 3 Überschneidungen;
  - Monatskachel (x/y mit Sperren, An/Ab ohne Sperren, archivierte nicht gezählt);
  - Tagesliste;
  - Bereich je Ansicht (14/28 Tage, Monat + Folgetag);
  - Lesen der Adress-Parameter mit Rückfall auf Standardwerte;
  - ungültiges Objekt im Cookie.
- **Integration:**
  - Die Kalenderabfrage liefert nur Einträge des eigenen Kunden.
  - Für Mitarbeiter enthält das Ergebnis keine Beträge.
- **E2E** (in kleinen Paketen):
  - Dashboard und Vollbild sichtbar, Navigationspunkt;
  - Balken für Buchung, Option, Sperre; storniert und verfallen fehlen;
  - Blättern, Heute, Datumswähler;
  - Monatsansicht mit Zählung und Tagesliste;
  - Panel öffnen, bearbeiten (Balken verschiebt sich), stornieren (Panel schließt);
  - Mitarbeiter ohne Preis und ohne Stornieren;
  - Anlegen per Klick mit Vorbelegung;
  - Objektfilter und gemerkte Ansicht nach Neuladen;
  - archivierte Wohnung;
  - Leerzustand;
  - Handy (seitliches Scrollen, keine Seitenverschiebung);
  - axe.

### H) Abhängigkeiten (Pakete)
- Keine neuen Pakete. Genutzt werden die vorhandenen shadcn-Bausteine (Sheet über das Detail-Panel, Popover, Tooltip, Tabs bzw. Umschalter, Button, Badge, Skeleton) und Phosphor-Icons.

### I) Schnittstellen zu späteren Features
- **PROJ-11:** Importierte Buchungen erscheinen ohne Änderung am Kalender, sobald Kanal booking.com/Airbnb geliefert wird. Die Legende zeigt diese Kanäle erst, wenn es sie beim Kunden gibt.
- **PROJ-14:** ergänzt KPIs, „Heute“ und offene Zahlungen um den Abschnitt „Belegung“ herum. Der Kalender bleibt ein eigenständiger Baustein.
- **PROJ-12:** Hinweise „auf Plattformen gesperrt“ kommen ins Detailpanel, nicht auf die Balken.

### Umsetzung (Frontend, 2026-10-26)
**Neu:**
- `src/lib/calendar.ts` (+ `calendar.test.ts`, 20 Unit-Tests): Zustand aus Adresse und Cookie, Adressen, Bereich, sichtbare Wohnungen und Objekte, Balkenlage mit Spuren, Monatskacheln, Tagesliste.
- `src/lib/calendar-data.ts`: eine Abfrage für Wohnungen und eine für aktive Einträge des Bereichs, ohne Beträge.
- `src/components/calendar/`:
  - `occupancy-calendar` (Server): lädt Daten und das Detail des offenen Eintrags;
  - `calendar-view`: Kopfzeile, Filter, Legende, Anlegen per Klick;
  - `calendar-timeline`, `calendar-month`;
  - `entry-panel`: Seitenpanel;
  - `calendar-error`;
  - `entry-style`: Kanal → Farbe an einer Stelle.
- `src/components/bookings/booking-detail.tsx`: Inhalt der Detailseite als gemeinsamer Baustein für `/buchungen/[id]` und das Kalender-Panel.
- Seite `/belegung` (Vollbild). Das Dashboard zeigt den Kalender statt des bisherigen Leerzustands. Der Navigationspunkt „Belegung“ ist freigeschaltet.

**Geändert (PROJ-8-Bausteine, abwärtskompatibel):**
- `BookingPanel` nimmt `defaults` (Wohnung, Anreise) an.
- `BookingPanel`, `BlockPanel` und `NewBookingButtons` haben `afterCreate` (`open` | `refresh`).
- `BookingActions` → `CancelDialog`/`BlockPanel`: `closeHref` schließt nach Stornieren bzw. Löschen das Panel.
- `findBooking` liefert `null` statt „Seite nicht gefunden“.

**Abweichungen vom Tech Design:**
- **Bereich:** Geladen werden Einträge mit Abreise ab dem ersten Tag (statt „Monat + Folgetag“). So sind auch Abreisen am Monatsersten und halbe Balken am linken Rand der Zeitleiste sichtbar.
- **Gewählter Tag der Monatsansicht:** wird ohne Neuladen in der Adresse nachgeführt, ohne Abfrage an den Server.
- **Namensspalte der Zeitleiste:** am Handy 7,5 rem (Desktop 12,5 rem), damit mehr Tage sichtbar sind.

**Geprüft:**
- Lint, Build und alle Unit-Tests.
- Temporärer Sichttest gegen den Produktions-Build (Desktop, Handy):
  - Balken für Buchung, Option, Sperre; Überschneidung in zweiter Spur mit Warnsymbol; stornierte Buchung fehlt; archivierte Wohnung nur mit Eintrag;
  - Monatszählung ohne archivierte Wohnungen;
  - Panel mit vollem Detail;
  - Anlegen per Klick mit Wohnung, Anreise und Abreise vorbelegt;
  - nach dem Stornieren schließt das Panel und der Balken verschwindet;
  - keine seitliche Seitenverschiebung am Handy.
- E2E PROJ-2 angepasst (Dashboard zeigt „Belegung“, `/belegung` ist kein 404 mehr). Die eigentlichen PROJ-9-E2E-Tests folgen in `/qa`.

**Hinweise:**
- Im Dev-Server erschien sporadisch eine Hydration-Warnung (abweichende Radix-IDs) beim ersten Aufruf einer neu kompilierten Seite; im Produktions-Build nicht.
- Integrationstests gegen „apppa-dev“ scheiterten in diesem Lauf an der Rate-Grenze von Supabase, nicht an der Änderung.

## QA Test Results

**Tested:** 2026-10-26
**App URL:** http://localhost:3000 (Dev, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)

**Umgebung:**
- **`.env.local`:** Die Prüfung per `grep` wurde abgelehnt (Dateizugriff gesperrt). Die Test-Helfer brechen bei Staging- oder Produktions-Refs ab (`assertTestableProject`).
- **Browser:** nur Chromium (installiertes Chrome). Firefox und WebKit sind auf diesem Rechner nicht installiert (wie bei PROJ-27). Breiten 375, 768 und 1440 px.

**Automatische Tests**
- **Vitest Unit:** 262/262 grün, davon 20 für `src/lib/calendar.ts`.
- **Integration** (`bookings.integration.test.ts`): 24/24 grün. Neu für PROJ-9:
  - die Kalenderabfrage liefert Mitarbeitern die Einträge des eigenen Kunden, einem fremden Inhaber nichts;
  - Beträge erreichen Mitarbeiter auch über eingebettete Abfragen nicht.
- **E2E** `tests/PROJ-9-belegungskalender.spec.ts`: 22 Tests; Abläufe im Projekt „desktop“, Layout/axe in allen drei Breiten. Alle Abläufe grün. Der axe-Test scheitert absichtlich an BUG-1; ohne diese Regel ist er in allen Breiten grün.
- **Regression (desktop):**
  - PROJ-2: 19 grün, 4 übersprungen (nur Handy/Tablet). Angepasst, weil das Dashboard jetzt „Belegung“ zeigt und `/belegung` erreichbar ist.
  - PROJ-8: alle Tests in 5 Paketen grün; die Bausteine wurden für den Kalender erweitert.
  - Ein Paket wurde abgebrochen (Exit 137), weil drei Läufe gleichzeitig gestartet waren. Ein liegen gebliebener Testnutzer wurde gelöscht, und die Pakete liefen danach einzeln grün.

### Acceptance Criteria Status

#### Orte und Navigation (4/4)
- [x] Dashboard zeigt „Belegung“ mit 14 Tagen ab heute − 2
- [x] „Vollbild“ öffnet `/belegung` mit derselben Ansicht und demselben Objektfilter
- [x] Navigationspunkt „Belegung“ (Desktop; am Handy in der unteren Leiste, Sichtprüfung)
- [x] Vollbild am Desktop: 28 Tage

#### Zeitleiste (10/10)
- [x] Buchung gefüllt in `neutral-800` mit „Nachname · Personen“
- [x] Option umrandet, Label beginnt mit „Option“
- [x] Sperre schraffiert mit Grund
- [x] Stornierte Buchungen und verfallene Optionen fehlen
- [x] Wechseltag: beide Balken sichtbar, ohne Überdeckung, kein Warnsymbol
- [x] Überschneidung: Balken untereinander, Warnsymbol „Überschneidung“ an der Wohnung
- [x] „Weiter“ +7 Tage, „Heute“ zurück auf heute − 2 (siehe BUG-2 bei schnellem Doppelklick)
- [x] Datumswähler springt zum gewählten Datum
- [x] Einträge über den Rand hinaus abgeschnitten und anklickbar
- [x] Handy: Zeitleiste seitlich scrollbar, Namensspalte bleibt, die Seite scrollt nicht seitlich (Darstellungsfehler siehe BUG-3, BUG-4)

#### Monatsansicht (5/5)
- [x] Aktueller Monat, Mo–So, heute gewählt
- [x] „x/y“ zählt Buchungen, Optionen und Sperren, ohne archivierte Wohnungen
- [x] „n An“/„n Ab“ ohne Sperren
- [x] Tagesliste mit „Anreise“, „Abreise“, „bis {Datum}“; Klick öffnet das Panel
- [x] Leerer Tag: „Keine Belegung an diesem Tag.“

#### Detailpanel (5/5)
- [x] Klick auf Balken oder Tagesliste öffnet das volle Detail rechts (Handy bildschirmfüllend)
- [x] Mitarbeiter: kein Preis, kein „Stornieren“
- [x] Bearbeiten: Balken verschiebt sich sofort, Ansicht und Zeitraum bleiben
- [x] Stornieren: Panel schließt, Balken verschwindet; „Sperre löschen“ ebenso
- [x] Betreiber-Admin ohne Aktionen: nur per Code-Review. Der Admin hat ohne Mitgliedschaft keinen Kundenkontext; der Kalender erscheint dann nicht, wie bei PROJ-8.

#### Anlegen (4/4)
- [x] Freie Zelle → „Neue Buchung“ mit Wohnung, Anreise = Tag, Abreise = Tag + 1 (auch für Mitarbeiter)
- [x] Nach dem Speichern sofort als Balken sichtbar, der Kalender bleibt offen
- [x] Zeile einer archivierten Wohnung: Klick bewirkt nichts
- [x] „Neue Sperre“ öffnet das Sperren-Formular

#### Filter und gemerkte Einstellungen (3/3)
- [x] Chips nur ab zwei Objekten
- [x] Objektfilter wirkt auf Zeitleiste und Monat (inkl. x/y)
- [x] Ansicht und Filter bleiben nach Neuladen und im Vollbild; der Zeitraum beginnt wieder bei heute

#### Archivierte Wohnungen und Leerzustände (4/4)
- [x] Archivierte Wohnung nur mit Eintrag im Bereich, mit Hinweis „archiviert“
- [x] Keine Wohnung: Inhaber mit Link zur Wohnungsverwaltung, Mitarbeiter mit Hinweis
- [x] Wohnungen ohne Einträge: leere Zeilen statt Leerzustand
- [x] Ladefehler: Fehlermeldung mit „Erneut versuchen“, nur der Abschnitt; per Code-Review, nicht automatisch provoziert

### Edge Cases Status
- [ ] **Langer Aufenthalt:** Das Label bleibt beim seitlichen Scrollen am Handy *nicht* sichtbar (BUG-3). Am Desktop beginnt der Balken am Rand, dort ist das Label sichtbar.
- [x] **Kurzer Balken:** Label gekürzt, Tooltip und Panel vollständig
- [x] **Mehr als zwei Überschneidungen:** weitere Spuren (Unit-Test, 3 Ebenen)
- [x] **Option verfällt:** fehlt beim nächsten Laden (verfallene Option nicht sichtbar)
- [x] **Gleichzeitige Änderung:** Panel zeigt den aktuellen Stand, Schutz aus PROJ-8 (Regression grün)
- [x] **Klick auf freie Zelle in einer Zeile mit Überschneidung:** Anlegen wie gewohnt, Warnung aus PROJ-8
- [x] **Klick auf einen Tag in der Vergangenheit:** Formular öffnet vorbelegt, Prüfregeln erlauben Nacherfassung
- [x] **Monat mit 6 Wochenzeilen:** Raster wächst (Unit-Test: Vorlauftage + Tage)
- [x] **Gemerkter Filter zeigt auf ein fremdes oder nicht mehr vorhandenes Objekt:** „Alle“ (E2E)
- [x] **Zusätzlich:** Alter oder fremder Eintrag in der Adresse → Hinweis „nicht gefunden“, kein Panel, keine fremden Daten

### Security Audit Results
- [x] **Ohne Anmeldung:** `/belegung` führt zur Anmeldung
- [x] **Abschottung:** Fremde Einträge über `?eintrag=` sind nicht erreichbar (E2E). Fremde Inhaber lesen weder Einträge noch Wohnungen (Integration).
- [x] **Beträge:** Die Kalenderabfrage enthält keine. Mitarbeiter erhalten sie auch nicht eingebettet (Integration). Im Seiten-Payload eines Mitarbeiters stehen keine Buchungsbeträge (geprüft).
- [x] **Eingaben:**
  - Ungültige Adress-Parameter und manipulierte Cookies fallen auf Standardwerte zurück.
  - HTML in Gast-, Objekt- und Wohnungsnamen wird als Text angezeigt; kein Skript läuft, kein Dialog.
- [x] **Rechte:** keine neuen Tabellen, Funktionen oder RLS-Regeln.
- [x] **Hinweis (Low, bestehend seit PROJ-8, vom Nutzer am 2026-10-26 akzeptiert):** Der Standardpreis der Wohnungen (`priceCents`) steht für Mitarbeiter im Seiten-Payload. Er stammt aus den Wohnungsdaten für „Neue Buchung“. `/buchungen` liefert ihn seit PROJ-8 ebenso. Es sind keine Buchungsbeträge. Entscheidung: bleibt so, es sind keine Buchungsbeträge.

### Bugs Found

#### BUG-1: Ansichts-Umschalter verweist auf nicht vorhandene Inhalte (axe-Verstoß)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Dashboard oder `/belegung` öffnen
  2. axe (WCAG 2.1 AA) ausführen
  3. Expected: keine Verstöße
  4. Actual: `aria-valid-attr-value` am aktiven Tab „Zeitleiste“/„Monat“. Die shadcn-Tabs setzen `aria-controls` auf einen Inhaltsbereich (`TabsContent`), den es nicht gibt. Gilt in allen drei Breiten.
- **Priority:** Fix before deployment (alle bisherigen Features sind axe-frei; der E2E-Test schlägt bis dahin fehl)

#### BUG-2: Schneller Doppelklick auf „Zurück“/„Weiter“ blättert nur einmal
- **Severity:** Low
- **Steps to Reproduce:**
  1. Zeitleiste öffnen (Start heute − 2)
  2. „Zurück“ doppelt klicken, bevor die Seite neu geladen ist
  3. Expected: zwei Wochen zurück (heute − 16)
  4. Actual: nur eine Woche (heute − 9). Der zweite Klick rechnet vom noch alten Zustand aus.
- **Priority:** Nice to have

#### BUG-3: Label eines langen Aufenthalts verschwindet beim seitlichen Scrollen (Handy)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Handy (375 px), Wohnung mit Aufenthalt über die ganze Zeitleiste
  2. Zeitleiste nach rechts scrollen
  3. Expected (Spec, Edge Cases): Das Label bleibt am linken Rand sichtbar
  4. Actual: Das Label scrollt mit hinaus (gemessen bei −191 px); der Balken ist ohne Beschriftung
- **Priority:** Fix in next sprint

#### BUG-4: Links neben der stehenden Namensspalte scrollen Inhalte durch (Handy)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Handy (375 px), Zeitleiste nach rechts scrollen
  2. Expected: Die Namensspalte deckt alles links von ihr ab
  3. Actual: In einem etwa 16 px breiten Streifen am linken Rand sind Tageszahlen und Balkenreste sichtbar („I 2“, „R(“). Die Spalte steht erst nach dem Seitenabstand.
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 35/35 bestanden, davon 2 nur per Code-Review (Admin ohne Aktionen, Ladefehler)
- **Bugs Found:** 4 (0 critical, 0 high, 1 medium, 3 low), dazu 1 bestehender Sicherheits-Hinweis (Low)
- **Security:** Pass (Hinweis zu Standardpreisen offen)
- **Production Ready:** YES nach Definition (keine Critical/High)
- **Priorisierung (Nutzer, 2026-10-26):** alle vier Bugs vor dem Deployment beheben; danach `/qa` erneut
- **Recommendation:** BUG-1 vor dem Deployment beheben (kleiner Eingriff, sonst bleibt der axe-Test rot). BUG-3 und BUG-4 betreffen dieselbe Stelle und lassen sich gemeinsam beheben.

## Deployment
_To be added by /deploy_
