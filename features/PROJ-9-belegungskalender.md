# PROJ-9: Belegungskalender

## Status: Planned
**Created:** 2026-10-25
**Last Updated:** 2026-10-25

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
| Kein Preis auf Balken und Kacheln | Mitarbeiter dürfen keine Preise sehen (PROJ-8); der Preis steht im Panel für Inhaber | 2026-10-25 |

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
