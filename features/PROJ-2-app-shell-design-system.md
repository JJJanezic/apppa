# PROJ-2: App-Shell & Design-System

## Status: Planned
**Created:** 2026-10-14
**Last Updated:** 2026-10-14

## Dependencies
- Keine harte Abhängigkeit. PROJ-2 ist die Grundlage für alle Features mit Oberfläche (PROJ-3 ff.)
- Design-Vorgaben: `docs/design-system.md` (Tokens „Broadsheet“) und der Claude-Design-Entwurf `docs/design/app-entwurf.html` (lauffähig) bzw. `docs/design/app-entwurf-quelltext.html` (lesbar), Quelle: https://claude.ai/artifact/7ajSUrRxcJKYgzUPsNdrTA, dazu 4 Screenshots in `docs/design/`
- Füllt sich später mit Daten aus: PROJ-3 (angemeldete Person, Abmelden), PROJ-4 (Kunde, Rolle, Kunden-Auswahl), PROJ-10/11 (Sync-Status)

## User Stories
- Als **Vermieter (Inhaber)** möchte ich am Desktop eine übersichtliche Seitenleiste mit allen Bereichen, damit ich mit einem Klick zu Belegung, Buchungen, Gästen oder Zahlungen komme.
- Als **Mitarbeiter** möchte ich nur die Bereiche sehen, die ich nutzen darf, damit mich keine gesperrten Menüpunkte verwirren.
- Als **Vermieter unterwegs** möchte ich die App am Handy mit dem Daumen bedienen können, damit ich z. B. beim Check-in schnell Buchungen und Gäste finde.
- Als **Vermieter** möchte ich jederzeit sehen, für welchen Kunden ich gerade arbeite und ob die Verbindungen zu den Plattformen synchron sind, damit ich keine falschen Daten bearbeite.
- Als **Pilotkunde** möchte ich nie auf leere oder halbfertige Seiten stoßen, damit die App vom ersten Tag an verlässlich wirkt.
- Als **Person, die per Tastatur oder Screenreader arbeitet**, möchte ich die App vollständig bedienen können.
- Als **Entwickler** (Betreiber) möchte ich einheitliche Grundbausteine (Seitenkopf, Kennzahl-Kachel, Detail-Panel, Hinweis-Meldung), damit alle späteren Seiten gleich aussehen und schneller entstehen.

## Umfang dieses Features
- **Design-Tokens** aus „Broadsheet“ (Farben, Rampen, Schrift „Source Serif 4“, Abstände, Radien, Schatten) als Grundlage aller Oberflächen; nur helles Erscheinungsbild, über Farbvariablen dunkel nachrüstbar
- **App-Rahmen Desktop** (ab Tablet-Querformat/Laptop) wie im Entwurf, Variante „Seitenleiste“:
  - Seitenleiste links, fest, ohne Einklappen
  - Oben: Wortmarke „apppa.“ (Punkt in Akzentfarbe Magenta), darunter der Kundenname; bei mehreren Mitgliedschaften dort die Kunden-Auswahl (Logik in PROJ-4)
  - Navigation mit Icons (Phosphor, Duotone): Dashboard, Belegung, Buchungen, Gäste, Zahlungen, Auswertungen, Tourismusabgabe, Kanäle & Kalender, Einstellungen
  - Unten: angemeldete Person mit Rolle (z. B. „Johanna Pichler · Inhaberin“) und Benutzermenü („Mein Konto“, „Abmelden“), darunter der Sync-Status (z. B. „4 Verbindungen synchron“)
  - **Keine Kopfzeile.** Jede Seite beginnt mit dem Seitenkopf
- **App-Rahmen Handy und Tablet hochkant:** untere Leiste mit Dashboard, Belegung, Buchungen, Gäste und „Mehr“. „Mehr“ öffnet die übrigen Bereiche sowie Kundenname/Kunden-Auswahl, Benutzermenü und Sync-Status
- **Sichtbarkeit der Navigation:** Bereiche, deren Feature noch nicht fertig ist, sind ausgeblendet. Bereiche werden zusätzlich nach Rolle gefiltert (z. B. Zahlungen und Auswertungen nur für Inhaber). Die Zuordnung wird zentral gepflegt, die Rollen liefert PROJ-4
- **Grundbausteine** (aussehend wie im Entwurf):
  - Seitenkopf: Überzeile (z. B. Datum in Versalien), große Überschrift, Untertitel, Platz für eine Hauptaktion rechts (z. B. „Neue Buchung“)
  - Kennzahl-Kachel: Beschriftung, große Zahl, Unterzeile
  - Detail-Panel: fährt von rechts herein und dunkelt die Seite ab (Entwurf: Buchungsdetail). Am Handy bildschirmfüllend
  - Hinweis-Meldung (Toast) für Bestätigungen und Fehler
  - Seiten bzw. Zustände für „Lädt“, „Fehler“ und „Seite nicht gefunden“
- **Startseite (bis zum Dashboard aus PROJ-14):** Dashboard mit Seitenkopf (Datum, tageszeitabhängige Begrüßung) und Leerzustand „Hier erscheinen bald deine Buchungen.“ Bis PROJ-3/PROJ-4 stehen bei Name, Kunde und Sync-Status Platzhalter
- **Sprache und Formate:** Alle Texte deutsch und zentral verwaltet (mehrsprachig vorbereitet); Datum, Zahlen und Euro im österreichischen Format (wie im Entwurf: „Montag, 5. Oktober 2026“, „€ 17.480“)
- **Browser-Tab:** Titel „apppa“ bzw. „<Seite> · apppa“; Name und Wortmarke an einer zentralen Stelle austauschbar

## Out of Scope
- Login, Abmelden, Passwort und 2FA: PROJ-3 (PROJ-2 stellt nur den Platz im Benutzermenü bereit)
- Kunden-Auswahl-Logik, Rollen aus dem Konto: PROJ-4
- Inhalte des Dashboards (Kennzahlen, Heute-Liste, offene Zahlungen, Ortstaxe-Kasten, Sync-Protokoll): PROJ-14
- Belegungskalender (Zeitleiste und Monat), Filter nach Gemeinde: PROJ-9
- Buchungsdetail-Inhalt und „Neue Buchung“-Dialog: PROJ-8 (PROJ-2 liefert nur das leere Detail-Panel und den Platz für die Hauptaktion)
- Echter Sync-Status: PROJ-10/11 (bis dahin Platzhalter)
- Dunkler Modus (nachrüstbar)
- Englische Oberfläche: PROJ-23
- Globale Suche, Benachrichtigungen (Glocke)
- Einklappbare Seitenleiste am Desktop
- Navigations-Variante „Tabs“ und Dashboard-Variante „Cockpit“ aus dem Entwurf (gewählt: „Seitenleiste“; Dashboard-Variante entscheidet PROJ-14)
- Rollen-Umschalter „Vermieter/Mitarbeiter“ aus dem Entwurf (nur Vorschau-Funktion des Prototyps)
- Druck-Effekte des Design-Systems (CMYK, Halftone) in der App
- Tabellen-/Listenmuster, Filter-Chips, Segment-Umschalter (entstehen mit dem ersten Feature, das sie braucht)
- Öffentliche Veröffentlichung: Der Rahmen läuft nur lokal bzw. in Vercel-Vorschauen, bis PROJ-3 den Login liefert

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Desktop-Rahmen
- [ ] Angenommen das Fenster ist mindestens Laptop-breit, wenn die App geöffnet wird, dann erscheint links die Seitenleiste mit Wortmarke „apppa.“, Kundenname, Navigation, Personenbereich und Sync-Status wie im Entwurf, und es gibt keine Kopfzeile
- [ ] Angenommen die Seitenleiste ist sichtbar, wenn der Nutzer auf einen Navigationspunkt klickt, dann öffnet sich der Bereich und der Punkt ist als aktiv hervorgehoben (Hintergrund und Schriftfarbe wie im Entwurf)
- [ ] Angenommen eine lange Seite wird gescrollt, wenn der Nutzer nach unten scrollt, dann bleibt die Seitenleiste stehen und nur der Inhalt bewegt sich
- [ ] Angenommen der Nutzer öffnet das Benutzermenü, wenn er es aufklappt, dann sieht er „Mein Konto“ und „Abmelden“

### Handy und Tablet hochkant
- [ ] Angenommen das Gerät ist ein Handy (375 px) oder ein Tablet hochkant (768 px), wenn die App geöffnet wird, dann erscheint statt der Seitenleiste eine untere Leiste mit Dashboard, Belegung, Buchungen, Gäste und „Mehr“
- [ ] Angenommen die untere Leiste ist sichtbar, wenn der Nutzer auf „Mehr“ tippt, dann sieht er die übrigen erlaubten Bereiche sowie Kundenname, Benutzermenü und Sync-Status
- [ ] Angenommen das Tablet wird ins Querformat gedreht, wenn die Breite die Laptop-Schwelle erreicht, dann wechselt die App ohne Neuladen zur Seitenleiste
- [ ] Angenommen ein Handy mit 375 px Breite, wenn eine beliebige Seite angezeigt wird, dann gibt es kein waagrechtes Scrollen und alle Bedienelemente sind mindestens 44 × 44 px groß

### Sichtbarkeit der Navigation
- [ ] Angenommen ein Bereich ist noch nicht fertig gebaut, wenn die Navigation angezeigt wird, dann fehlt dieser Bereich in Seitenleiste, unterer Leiste und „Mehr“
- [ ] Angenommen ein Bereich ist nur für Inhaber freigegeben, wenn ein Mitarbeiter die App nutzt, dann fehlt dieser Bereich in der Navigation
- [ ] Angenommen ein Nutzer ruft die Adresse eines ausgeblendeten Bereichs direkt auf, wenn die Seite lädt, dann erscheint die Seite „Nicht gefunden“ bzw. ein Hinweis, dass der Bereich nicht verfügbar ist, und keine leere Seite

### Grundbausteine
- [ ] Angenommen eine Seite nutzt den Seitenkopf, wenn sie angezeigt wird, dann stehen Überzeile, Überschrift und Untertitel wie im Entwurf, und eine Hauptaktion steht am Desktop rechts und am Handy unter der Überschrift
- [ ] Angenommen eine Seite zeigt Kennzahl-Kacheln, wenn sie angezeigt wird, dann stehen am Desktop bis zu vier Kacheln nebeneinander und am Handy untereinander bzw. zu zweit
- [ ] Angenommen ein Detail-Panel wird geöffnet, wenn es erscheint, dann fährt es von rechts herein und dunkelt die Seite ab; am Handy füllt es den Bildschirm
- [ ] Angenommen ein Detail-Panel ist offen, wenn der Nutzer Esc drückt, außerhalb klickt oder auf „Schließen“ tippt, dann schließt es und der Fokus kehrt zum auslösenden Element zurück
- [ ] Angenommen eine Aktion war erfolgreich oder ist fehlgeschlagen, wenn eine Hinweis-Meldung erscheint, dann verschwindet sie nach einigen Sekunden von selbst, lässt sich vorher schließen und wird von Screenreadern vorgelesen
- [ ] Angenommen eine Seite lädt Daten, wenn das länger als einen Moment dauert, dann erscheint ein Ladezustand statt einer leeren Fläche
- [ ] Angenommen beim Laden tritt ein Fehler auf, wenn die Seite angezeigt wird, dann erscheint eine verständliche deutsche Fehlermeldung mit „Erneut versuchen“, und der Rahmen bleibt bedienbar
- [ ] Angenommen ein Nutzer ruft eine unbekannte Adresse auf, wenn die Seite lädt, dann erscheint „Seite nicht gefunden“ mit einem Link zum Dashboard

### Startseite
- [ ] Angenommen es gibt noch keine Inhalte, wenn die Startseite geöffnet wird, dann zeigt das Dashboard Datum, Begrüßung und den Leerzustand „Hier erscheinen bald deine Buchungen.“
- [ ] Angenommen die Startseite wird morgens, mittags oder abends geöffnet, wenn die Begrüßung erscheint, dann passt sie zur Tageszeit („Guten Morgen“, „Guten Tag“, „Guten Abend“)
- [ ] Angenommen es gibt noch keinen Login (vor PROJ-3/PROJ-4), wenn der Rahmen angezeigt wird, dann stehen bei Name, Kunde und Sync-Status erkennbare Platzhalter

### Design-System, Sprache und Formate
- [ ] Angenommen eine beliebige Seite, wenn sie angezeigt wird, dann nutzt sie ausschließlich Farben, Schrift, Abstände und Radien aus dem Design-System, und die Darstellung entspricht dem Entwurf
- [ ] Angenommen Datum, Zahl oder Geldbetrag werden angezeigt, wenn die Seite lädt, dann stehen sie im österreichischen Format (z. B. „Montag, 5. Oktober 2026“, „€ 17.480“, „1.179,80“)
- [ ] Angenommen eine Seite ist geöffnet, wenn der Nutzer auf den Browser-Tab schaut, dann steht dort „<Seitenname> · apppa“

### Barrierefreiheit
- [ ] Angenommen ein Nutzer arbeitet nur mit der Tastatur, wenn er die App bedient, dann erreicht er alle Navigationspunkte, Menüs und Panels in sinnvoller Reihenfolge, und der Fokus ist immer sichtbar
- [ ] Angenommen ein Screenreader ist aktiv, wenn die Navigation vorgelesen wird, dann sind Bereiche, aktiver Punkt und Icons verständlich beschriftet
- [ ] Angenommen eine beliebige Seite, wenn die Kontraste geprüft werden, dann erfüllen Text und Bedienelemente WCAG 2.1 AA

## Edge Cases
- Sehr langer Kundenname (z. B. „Appartementvermietung Familie Pichler-Oberhuber GmbH“): wird in der Seitenleiste umgebrochen bzw. gekürzt und vollständig als Tooltip angezeigt, ohne das Layout zu sprengen
- Sehr langer Personenname oder Rollenbezeichnung: wie oben, kein Überlaufen
- Mitarbeiter ohne einen einzigen freigegebenen Bereich außer dem Dashboard: Untere Leiste und Seitenleiste zeigen nur, was erlaubt ist; „Mehr“ erscheint nur, wenn es mehr gibt
- Weniger als 4 freigegebene Hauptbereiche am Handy: Die untere Leiste zeigt nur diese, ohne leere Plätze
- Schrift „Source Serif 4“ lädt nicht (z. B. langsames Netz): Die Seite ist sofort mit einer Ersatzschrift lesbar und wechselt danach ohne Springen des Layouts
- Sehr schmales Handy (320 px) oder Querformat mit wenig Höhe: Die untere Leiste bleibt bedienbar, die Inhalte sind scrollbar
- Detail-Panel mit viel Inhalt: Das Panel scrollt in sich, die Seite dahinter bleibt stehen
- Browser-Zoom 200 %: Der Inhalt bleibt ohne waagrechtes Scrollen nutzbar (wechselt ggf. auf die Handy-Ansicht)
- Mehrere Hinweis-Meldungen kurz hintereinander: Sie überlagern sich nicht unleserlich
- Nutzer mit „Bewegung reduzieren“-Einstellung: Panel und Meldungen erscheinen ohne Animation

## Technical Requirements
- Performance: Rahmen und Startseite in unter 2 Sekunden nutzbar bei mobiler 4G-Verbindung; keine Layout-Sprünge beim Laden der Schrift
- Barrierefreiheit: WCAG 2.1 AA
- Browser: jeweils die aktuellen zwei Versionen von Chrome, Edge, Firefox und Safari; Safari auf iPhone/iPad; Chrome auf Android
- Breiten: Handy 375 px, Tablet 768 px, Desktop 1440 px (Prüfbreiten); Wechsel zur Seitenleiste ab Laptop-/Tablet-Querformat-Breite
- Sicherheit: Bis PROJ-3 nur lokal bzw. in Vercel-Vorschauen erreichbar, keine Veröffentlichung

## Open Questions
- [ ] Wo leben „Wohnungen“ (PROJ-6) und „Marketing“ (PROJ-19)? Der Entwurf hat dafür keinen eigenen Menüpunkt. Vorschlag: Wohnungen unter „Einstellungen“, Marketing unter „Gäste“; endgültig mit /write-spec PROJ-6 bzw. PROJ-19 klären
- [ ] Welche Bereiche sieht ein Mitarbeiter genau? Laut PRD keine Zahlungen und Auswertungen; der Entwurf zeigt Mitarbeitern zudem andere Kennzahlen. Endgültige Zuordnung in PROJ-4
- [ ] Handy-Ansicht: Optional in Claude Design nachzeichnen, bevor /frontend PROJ-2 baut; sonst gilt die hier beschriebene untere Leiste
- [ ] Logo/Favicon: Bis auf Weiteres nur die Wortmarke; ein Favicon (z. B. „a.“) bei /frontend festlegen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Desktop-Layout wie im Claude-Design-Entwurf, Variante „Seitenleiste“, ohne Kopfzeile | Vom Nutzer entworfen und bestätigt; Kunde, Person und Sync-Status in der Seitenleiste | 2026-10-14 |
| Handy/Tablet hochkant: untere Leiste (Dashboard, Belegung, Buchungen, Gäste, „Mehr“) | Daumenbedienung; Entwurf hat keine Handy-Ansicht | 2026-10-14 |
| Kein Einklappen der Seitenleiste am Desktop | Entwurf sieht keines vor; weniger Komplexität | 2026-10-14 |
| Arbeitstitel „apppa“ als Wortmarke, zentral austauschbar | Kein finaler Produktname/Logo vorhanden | 2026-10-14 |
| Nur helles Design, über Farbvariablen dunkel nachrüstbar | Design-System ist hell; dunkler Modus verdoppelt Testaufwand | 2026-10-14 |
| Unfertige Bereiche ausblenden, Navigation nach Rolle filtern | Pilotkunden sehen keine leeren Seiten; Mitarbeiter sehen nur Erlaubtes | 2026-10-14 |
| Benutzermenü statt Rollen-Umschalter aus dem Entwurf | Die Rolle kommt aus dem Konto; der Umschalter war nur eine Vorschau | 2026-10-14 |
| Kunden-Auswahl am Kundennamen unter der Wortmarke | Passt zum Entwurf, ohne Kopfzeile | 2026-10-14 |
| Keine globale Suche und keine Benachrichtigungen im MVP | Schlank halten; spätere Ergänzung möglich | 2026-10-14 |
| PROJ-2 enthält Rahmen + Grundbausteine (Seitenkopf, Kennzahl-Kachel, Detail-Panel, Toast, Lade-/Fehler-/404-Zustände) | Alle späteren Seiten nutzen sie; einheitliches Aussehen | 2026-10-14 |
| Startseite bis PROJ-14: Dashboard-Leerzustand mit Platzhaltern, nur lokal/Vorschau | Rahmen prüfbar, nichts Öffentliches ohne Login | 2026-10-14 |
| WCAG 2.1 AA und aktuelle Browser (2 Versionen, iOS Safari, Android Chrome) | Solider Standard; Nachrüstung wäre teurer | 2026-10-14 |

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
