# PROJ-2: App-Shell & Design-System

## Status: Approved
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
| Reines Frontend, keine Datenbank; Person/Kunde/Sync über eine „Shell-Information“ mit Platzhaltern | PROJ-3/4/10 liefern die echten Werte, ohne Umbau des Rahmens | 2026-10-14 |
| Gemeinsamer Rahmen über eine Next.js-Routengruppe für alle App-Seiten | Jedes Feature legt nur seine Seite an; Login-Seiten bleiben ohne Rahmen | 2026-10-14 |
| Wechsel Handy ↔ Desktop rein über CSS-Breite, Schwelle 1024 px | Kein Flackern, sofortiger Wechsel beim Drehen; Tablet hochkant = untere Leiste | 2026-10-14 |
| Zentrale Navigationsliste mit „fertig“, Rollen und Handy-Platz | Feature-Freischaltung an einer Stelle; Grundlage für Rollenfilter (PROJ-4) | 2026-10-14 |
| Ausgeblendete Bereiche liefern auch per Adresse „Nicht gefunden“ | Keine halbfertigen Seiten über alte Links | 2026-10-14 |
| shadcn Sidebar, Sheet, Dropdown Menu, Sonner, Skeleton, Tooltip statt Eigenbau | Projektregel; Tastatur- und Screenreader-Unterstützung eingebaut | 2026-10-14 |
| Sonner statt der älteren shadcn-Toast-Variante | Beide installiert; nur eine soll genutzt werden, Sonner ist der aktuelle Standard | 2026-10-14 |
| Broadsheet-Tokens auf shadcn-Farbvariablen, Primärfarbe `accent-700` | Alle Bausteine automatisch im Design; Kontrast weiß auf `accent-700` erfüllt AA, auf `accent` nicht | 2026-10-14 |
| Standardwerte der Vorlage (slate, dunkler Satz) entfernen | Nur ein, das eigene Erscheinungsbild; dunkler Modus später als zweiter Satz | 2026-10-14 |
| Schrift über `next/font` selbst ausliefern | Schneller, keine Layout-Sprünge, keine Verbindung zu Google (DSGVO) | 2026-10-14 |
| Icons `@phosphor-icons/react` (Duotone) | Wie im Entwurf; Lucide bleibt für shadcn-interne Symbole | 2026-10-14 |
| `next-intl` für Texte und Formate, de-AT, ohne Sprachkürzel in der Adresse | Standardlösung, mehrsprachig vorbereitet (PROJ-23) | 2026-10-14 |
| Zeitzone fest Europe/Vienna | Vercel läuft in UTC; sonst falsches Datum bzw. falsche Begrüßung | 2026-10-14 |
| `tailwindcss-animate` ergänzen, Animationen nur ohne „Bewegung reduzieren“ | Von shadcn-Bausteinen vorausgesetzt; Barrierefreiheit | 2026-10-14 |
| Vercel-Vorschauen mit Zugriffsschutz bis PROJ-3 | Kein öffentlicher Zugang ohne Login | 2026-10-14 |
| App-weite Zahlenformate mit Tausenderpunkt über `src/lib/format.ts` (Zahl/Prozent de-DE, Euro de-AT) | Nutzerwunsch: Tausenderpunkt immer; de-AT nutzt sonst Leerzeichen | 2026-10-14 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-2 ist **reines Frontend**: Es gibt keine neuen Tabellen und keine Schnittstellen. Der Rahmen bekommt die Informationen über Person, Kunde und Sync-Status über eine klar definierte „Shell-Information“. Bis PROJ-3/4/10 sind das Platzhalter, danach echte Daten, ohne dass der Rahmen umgebaut werden muss.

### A) Seitenstruktur und Bausteine
```
Gesamte App (Sprache Deutsch, Schrift Source Serif 4, Design-Tokens)
+-- Hinweis-Meldungen (Toast) – einmal für die ganze App
+-- App-Bereich (alle Seiten nach dem Login, gemeinsamer Rahmen)
|   +-- Seitenleiste (ab Laptop-/Tablet-Querformat-Breite)
|   |   +-- Wortmarke „apppa."
|   |   +-- Kundenname / Kunden-Auswahl (Platz für PROJ-4)
|   |   +-- Navigation (aus der zentralen Navigationsliste, gefiltert)
|   |   +-- Personenbereich: Name · Rolle + Benutzermenü (Mein Konto, Abmelden)
|   |   +-- Sync-Status
|   +-- Untere Leiste (Handy und Tablet hochkant)
|   |   +-- bis zu 4 Hauptbereiche + „Mehr“
|   |   +-- „Mehr“-Blatt (fährt von unten herein): übrige Bereiche, Kunde, Benutzermenü, Sync-Status
|   +-- Inhaltsbereich
|       +-- Seite „Dashboard“ (Startseite, vorerst Leerzustand)
|       |   +-- Seitenkopf (Datum, Begrüßung nach Tageszeit, Untertitel)
|       |   +-- Leerzustand „Hier erscheinen bald deine Buchungen."
|       +-- Ladezustand (automatisch beim Seitenwechsel)
|       +-- Fehlerzustand mit „Erneut versuchen"
+-- Seite „Nicht gefunden" (unbekannte Adresse oder ausgeblendeter Bereich)

Wiederverwendbare Grundbausteine (für alle späteren Features)
+-- Seitenkopf: Überzeile, Überschrift, Untertitel, Platz für Hauptaktion
+-- Kennzahl-Kachel: Beschriftung, große Zahl, Unterzeile
+-- Kachel-Raster: 4 nebeneinander (Desktop), 2 bzw. 1 (Handy)
+-- Detail-Panel: von rechts, Seite abgedunkelt; am Handy bildschirmfüllend
+-- Leerzustand: Symbol, Satz, optional Aktion
```

### B) Daten (in Worten, ohne Datenbank)

**Zentrale Navigationsliste**, ein Eintrag pro Bereich:
- Kennung, Beschriftung, Icon, Adresse
- „Fertig gebaut“ ja/nein: Nur fertige Bereiche erscheinen. Wird ein Feature fertig, wird dort nur dieser Schalter umgelegt
- Erlaubte Rollen (Inhaber, Mitarbeiter)
- Platz in der unteren Leiste am Handy (Hauptbereich oder unter „Mehr“)

Startbelegung: Nur „Dashboard“ ist fertig. Alle anderen Bereiche aus dem Entwurf sind angelegt, aber ausgeblendet. „Zahlungen“ und „Auswertungen“ sind nur für Inhaber freigegeben; die endgültige Zuordnung kommt mit PROJ-4.

**Shell-Information**, die der Rahmen braucht:
- Person: Anzeigename, Rolle
- Kunde: Name des aktiven Kunden, ob weitere Kunden zur Auswahl stehen
- Sync-Status: Zahl der Verbindungen, Zustand (synchron / Problem)

In PROJ-2 sind das feste Platzhalter, z. B. „Kunde wird mit dem Login geladen“. PROJ-3, PROJ-4 und PROJ-10 liefern später die echten Werte.

**Texte:** Alle Beschriftungen stehen in einer deutschen Textdatei, nicht verstreut im Code. Eine englische Datei kann später daneben gelegt werden (PROJ-23).

Gespeichert wird nichts, weder im Browser noch in der Datenbank.

### C) Technische Entscheidungen (begründet)

**Ein gemeinsamer Rahmen für alle App-Seiten.** Next.js erlaubt, Seiten zu einem Bereich zusammenzufassen, der denselben Rahmen teilt. Jedes spätere Feature legt nur seine Seite in diesen Bereich und bekommt Seitenleiste, untere Leiste, Lade- und Fehlerzustände automatisch. Login-Seiten (PROJ-3) liegen später außerhalb und zeigen den Rahmen nicht.

**Umschalten zwischen Handy und Desktop nur über Bildschirmbreite (CSS).** Seitenleiste und untere Leiste werden je nach Breite ein- oder ausgeblendet, ohne JavaScript-Abfrage. Dadurch flackert beim Laden nichts, und das Drehen des Tablets wechselt sofort ohne Neuladen. Die Schwelle liegt bei 1024 px: Tablet hochkant (768 px) zeigt die untere Leiste, Tablet quer und Laptop die Seitenleiste.

**Fertige Bausteine von shadcn/ui statt Eigenbau** (Projektregel). Sie bringen Tastaturbedienung, Fokusführung und Screenreader-Beschriftungen nach WCAG mit:
- Seitenleiste: der vorhandene shadcn-Baustein „Sidebar“, fest ausgeklappt, im Aussehen an den Entwurf angepasst
- Detail-Panel und „Mehr“-Blatt: „Sheet“ (von rechts bzw. von unten); schließt mit Esc und Klick außerhalb und gibt den Fokus zurück
- Benutzermenü und Kunden-Auswahl: „Dropdown Menu“
- Hinweis-Meldungen: „Sonner“ (vorhanden; die ältere „Toast“-Variante wird nicht verwendet)
- Ladezustand: „Skeleton“; lange Namen: „Tooltip“
- Kennzahl-Kachel und Seitenkopf: schlichte eigene Bausteine aus den Design-Tokens, weil shadcn dafür nichts Passendes hat

**Design-Tokens an zentraler Stelle.** Die Broadsheet-Farben werden auf die Farbvariablen von shadcn/ui gelegt (Hintergrund, Text, Primärfarbe = `accent-700` wie im Entwurf, Rahmen, Fokus) und zusätzlich als vollständige Farbrampen bereitgestellt. Damit sehen auch alle shadcn-Bausteine automatisch nach Broadsheet aus. Ein dunkler Modus wäre später nur ein zweiter Satz Werte. Die vorhandenen Standardwerte (slate) und der dunkle Satz der Vorlage werden entfernt.

**Schrift über Next.js selbst ausliefern.** „Source Serif 4“ wird beim Bauen mitgeliefert statt live von Google geladen. Das ist schneller, verhindert Layout-Sprünge (automatisch passende Ersatzschrift) und ist DSGVO-freundlich: Beim Seitenaufruf geht keine Verbindung zu Google.

**Icons „Phosphor“ (Duotone) wie im Entwurf.** Sie werden einzeln eingebunden, es landet nur, was genutzt wird. Die vorhandenen Lucide-Icons bleiben für die internen Symbole der shadcn-Bausteine.

**Sprache und Formate mit next-intl.** Das ist die verbreitete Lösung für mehrsprachige Next.js-Apps. Sie verwaltet die Textdatei und formatiert Datum, Zahl und Euro einheitlich österreichisch (de-AT). Es gibt kein Sprachkürzel in der Adresse, solange es nur Deutsch gibt. Zeitzone ist immer Europe/Vienna. Die Server bei Vercel laufen in UTC, ohne diese Festlegung stimmten Datum und Begrüßung um Mitternacht oder am Morgen nicht.

**Ausgeblendete Bereiche sind auch per Adresse nicht erreichbar.** Jede Seite prüft gegen die zentrale Navigationsliste und zeigt sonst „Nicht gefunden“. So erreicht auch niemand über einen alten Link eine halbfertige Seite.

**Bewegung reduzieren.** Animationen (Panel, Blatt, Meldungen) laufen nur, wenn das Gerät nicht „Bewegung reduzieren“ eingestellt hat.

**Aufräumen der Vorlage.** Die Startseite der Vorlage (Next.js-Logo, Geist-Schrift), der englische Seitentitel und `lang="en"` werden ersetzt. Der Browser-Tab zeigt „<Seite> · apppa“.

**Kein öffentlicher Zugang vor PROJ-3.** Vorschauen bei Vercel werden über den Vercel-Zugriffsschutz nur für angemeldete Team-Mitglieder geöffnet. Eine Produktionsfreigabe gibt es erst mit dem Login.

### D) Abhängigkeiten (Pakete)
- `@phosphor-icons/react`: Icon-Sammlung aus dem Entwurf
- `next-intl`: deutsche Texte an einem Ort, Datums-, Zahl- und Euro-Formate, mehrsprachig vorbereitet
- `tailwindcss-animate`: Ein- und Ausblend-Animationen, die die shadcn-Bausteine Sheet, Dropdown und Tooltip voraussetzen (fehlt bisher)
- `@axe-core/playwright` (nur Entwicklung): automatische Barrierefreiheits-Prüfung in den E2E-Tests
- Bereits vorhanden: shadcn/ui-Bausteine (Sidebar, Sheet, Dropdown Menu, Sonner, Skeleton, Tooltip), Tailwind CSS, `next/font`

### E) Prüfung (für /qa)
- Unit-Tests: Filterung der Navigationsliste (fertig/Rolle/Handy-Platz), Begrüßung nach Tageszeit in Europe/Vienna, Datums- und Euro-Format
- E2E-Tests (Playwright) in 375, 768 und 1440 px: Seitenleiste bzw. untere Leiste, „Mehr“, kein waagrechtes Scrollen, Detail-Panel mit Esc und Fokus-Rückgabe, 404 für unbekannte und ausgeblendete Adressen, Tastaturbedienung
- Automatische Barrierefreiheits-Prüfung (Kontraste, Beschriftungen) mit axe in den E2E-Tests
- Optischer Abgleich mit `docs/design/app-entwurf.html` und den Screenshots

## Implementation Notes (Frontend)
_Stand 2026-10-14 (/frontend)_

**Rahmen und Seiten**
- `src/app/(app)/layout.tsx`: gemeinsamer Rahmen. Seitenleiste ab 1024 px (`AppSidebar` auf shadcn `Sidebar`, `collapsible="none"`), darunter `BottomNav`. Das Umschalten läuft rein über CSS (`lg:`)
- `src/app/(app)/page.tsx`: Dashboard-Leerzustand mit Datum, Begrüßung nach Tageszeit und `EmptyState`; wird bei jedem Aufruf neu berechnet (`connection()`)
- `src/app/(app)/loading.tsx` (Skeleton), `src/app/(app)/error.tsx` („Erneut versuchen“, Rahmen bleibt), `src/app/not-found.tsx`
- Die Startseite der Vorlage (`src/app/page.tsx`) wurde entfernt; `lang="de-AT"`, Seitentitel „<Seite> · apppa“

**Shell-Bausteine** (`src/components/shell/`): `app-sidebar`, `bottom-nav` („Mehr“ als shadcn `Sheet` von unten), `user-menu` (shadcn `DropdownMenu`; „Mein Konto“ und „Abmelden“ deaktiviert bis PROJ-3), `tenant-label` (Kunden-Auswahl vorbereitet für PROJ-4), `sync-status`, `wordmark`, `nav-icon` (Phosphor Duotone), `truncated-text` (Tooltip bei langen Namen), `shell-context`

**Grundbausteine** (`src/components/`): `page-header`, `kpi-tile` (+ `KpiGrid`), `detail-panel` (shadcn `Sheet` rechts, max. 440 px, am Handy voll), `empty-state`, `app-toaster` (Sonner, dunkle Leiste unten mittig, festes helles Theme)

**Logik** (`src/lib/`): `navigation.ts` (zentrale Liste mit `ready`, Rollen und Handy-Platz; nur das Dashboard ist `ready`), `areas.ts` (`requireArea()` → „Nicht gefunden“ für ausgeblendete Bereiche), `shell.ts` (Platzhalter für Person, Kunde, Sync), `greeting.ts`, `format.ts` (`formatNumber`, `formatPercent`, `formatCurrency`), `locale.ts` (de-AT, Europe/Vienna)

**Design und Sprache**: Broadsheet-Tokens in `src/app/globals.css` (shadcn-Variablen + `--color-*`-Rampen), in Tailwind als `ds-*` nutzbar (z. B. `text-ds-neutral-700`); Schrift `Source Serif 4` über `next/font`; Texte in `messages/de.json` über `next-intl` (`src/i18n/request.ts`, Plugin in `next.config.ts`); `tailwindcss-animate` ergänzt; Animationen bei „Bewegung reduzieren“ abgeschaltet

**Anpassungen an shadcn-Dateien**: `sheet.tsx` und `dialog.tsx` mit deutschem Screenreader-Text „Schließen“; Abdunklung in `sheet.tsx`, `dialog.tsx` und `alert-dialog.tsx` von Schwarz 80 % auf Text 30 % wie im Entwurf

**Tests**: `navigation.test.ts`, `greeting.test.ts`, `format.test.ts` (neu, 37 Fälle). `npm test` 99/99 grün, `npm run build` erfolgreich, `tsc` ohne Fehler

**Abweichungen / Hinweise**
- „Mehr“ erscheint am Handy immer, auch ohne weitere Bereiche: Dort liegen Kunde, Benutzermenü (Abmelden) und Sync-Status. Die Spec sah „nur wenn es mehr gibt“ vor
- **Tausenderpunkt immer** (Entscheidung des Nutzers, 2026-10-14): Alle Zahlen laufen über `src/lib/format.ts`. `formatNumber()` und `formatPercent()` nutzen intern de-DE, `formatCurrency()` nutzt de-AT. So gilt „1.179,80“, „1.235 %“ und „€ 17.480“. Grund: `de-AT` trennt einfache Zahlen, Prozent und Einheiten sonst mit schmalem Leerzeichen („1 179,80“). Datum bleibt `de-AT` („Jänner“). In ICU-Texten wird statt `#` die vorformatierte Zahl `{value}` eingesetzt (z. B. Sync-Status)
- Die Rollenbezeichnung ist vorerst „Inhaber“ bzw. „Mitarbeiter“; der Entwurf zeigt „Inhaberin“. Gendergerechte Bezeichnung mit PROJ-4 klären
- Rahmenlinien (`neutral-300`) sind dekorativ und haben nur 1,3:1 Kontrast. Für Eingabefelder (ab PROJ-3) braucht es mindestens 3:1
- Playwright nutzt das installierte Google Chrome (`channel: 'chrome'`, Projekte desktop 1440, tablet 768, mobile 375 px); der Download von Playwright-Chromium blieb beim Entpacken hängen und wird nicht mehr gebraucht. Mobile Safari (WebKit) ist als Testgerät entfallen
- Sichtprüfung 2026-10-14 in Chrome: Seitenleiste ab 1024 px, untere Leiste bei 768/375 px, kein waagrechtes Scrollen, „Mehr“-Blatt funktioniert, `/buchungen` liefert 404, Tab-Titel „Dashboard · apppa“. Behoben: Beim Öffnen von „Mehr“ sprang der Tooltip des Kundennamens auf (Name war fokussierbar)
- Build-Hinweis: Next.js findet eine zweite `package-lock.json` im übergeordneten Ordner `/Users/jjj/Documents/apppa/` und warnt wegen des Projektstamms

## QA Test Results

**Tested:** 2026-10-14
**App URL:** http://localhost:3000 (Dev-Server und Produktions-Build)
**Tester:** QA Engineer (AI)
**Browser:** Google Chrome (über Playwright, `channel: 'chrome'`) in 1440, 768 und 375 px. Firefox und Safari konnten in dieser Umgebung nicht getestet werden (kein Browser-Download möglich, siehe Implementation Notes)

**Automatische Tests**
- `npm test`: 105/105 grün. Neu aus /qa: `src/components/detail-panel.test.tsx` (3), `src/components/page-header.test.tsx` (2), `src/app/(app)/error.test.tsx` (1)
- `npm run test:e2e` (`tests/PROJ-2-app-shell.spec.ts`): 50/50 grün über desktop/tablet/mobile (13 übersprungen, weil breitenspezifisch), inkl. axe-Prüfung WCAG 2.1 AA ohne Befund
- Test-Infrastruktur: `vitest.config.ts` schließt `tests/` (Playwright) aus; `@testing-library/dom` als Entwicklungsabhängigkeit ergänzt (fehlte für Komponententests)

### Acceptance Criteria Status

#### Desktop-Rahmen
- [x] Seitenleiste mit Wortmarke, Kundenname, Navigation, Personenbereich und Sync-Status, keine Kopfzeile (E2E)
- [x] Aktiver Punkt hervorgehoben (`aria-current="page"`, `data-active`) (E2E)
- [x] Seitenleiste bleibt beim Scrollen stehen (E2E)
- [x] Benutzermenü zeigt „Mein Konto“ und „Abmelden“ (E2E; beide deaktiviert bis PROJ-3)

#### Handy und Tablet hochkant
- [x] Untere Leiste statt Seitenleiste bei 375 und 768 px (E2E)
- [x] „Mehr“ zeigt Kunde, Benutzermenü und Sync-Status, schließt mit Esc, der Fokus kehrt zurück (E2E)
- [x] Drehen auf 1024 px wechselt ohne Neuladen zur Seitenleiste (E2E)
- [x] Kein waagrechtes Scrollen, Bedienelemente mindestens 44 × 44 px (E2E)

#### Sichtbarkeit der Navigation
- [x] Nicht fertige Bereiche fehlen in Seitenleiste, unterer Leiste und „Mehr“ (E2E)
- [x] Bereiche nur für Inhaber fehlen bei Mitarbeitern (Unit-Test; im Browser erst mit Rollen aus PROJ-4 prüfbar)
- [x] Direkter Aufruf ausgeblendeter Bereiche (`/belegung`, `/buchungen`, `/gaeste`, `/zahlungen`, `/einstellungen`) liefert 404 „Seite nicht gefunden“ (E2E)

#### Grundbausteine
- [x] Seitenkopf mit Überzeile, Überschrift, Untertitel und Hauptaktion (Unit-Test; Anordnung am Handy unter, am Desktop rechts per Code-Review)
- [x] Kennzahl-Kacheln (Unit-Test; Raster 1/2/4 Spalten per Code-Review)
- [x] Detail-Panel von rechts mit Abdunklung, am Handy bildschirmfüllend (Unit-Test + Code-Review)
- [x] Detail-Panel schließt mit Esc und „Schließen“ (Unit-Test); Klick außerhalb und Fokus-Rückgabe über dasselbe shadcn-Sheet im „Mehr“-Blatt bestätigt (E2E)
- [x] Hinweis-Meldung: verschwindet nach 4 s, schließbar, wird vorgelesen (Sonner, `aria-live`). Noch nicht im Einsatz, daher nur per Code-Review geprüft; siehe BUG-3
- [x] Ladezustand (Skeleton mit `role="status"`, Code-Review; keine Seite lädt bisher lange genug für einen E2E-Test)
- [x] Fehlerzustand mit deutscher Meldung und „Erneut versuchen“ (Unit-Test)
- [x] Unbekannte Adresse zeigt „Seite nicht gefunden“ mit Link zum Dashboard (E2E)

#### Startseite
- [x] Datum, Begrüßung und Leerzustand (E2E)
- [x] Begrüßung passt zur Tageszeit in Wiener Zeit (Unit-Tests mit Grenzfällen)
- [x] Platzhalter für Name, Kunde und Sync-Status (E2E)

#### Design-System, Sprache und Formate
- [ ] Teilweise: Farben, Schrift, Abstände und Radien aus dem Design-System; Abweichung vom Entwurf bei der Breite der Seitenleiste, siehe BUG-1
- [x] Österreichische Formate mit Tausenderpunkt (Unit-Tests; E2E für das Datum)
- [x] Browser-Tab „Dashboard · apppa“ (E2E)

#### Barrierefreiheit
- [x] Vollständig per Tastatur bedienbar, Fokus immer sichtbar (E2E)
- [x] Navigation, aktiver Punkt und Icons für Screenreader verständlich (axe, Seitenstruktur)
- [x] Kontraste WCAG 2.1 AA (axe ohne Befund)

### Edge Cases Status
- [x] Langer Kunden- oder Personenname: wird einzeilig gekürzt, voller Text als Tooltip und für Screenreader (Code-Review; Placeholder „Name folgt mit dem Login · Inhaber“ wird sichtbar gekürzt)
- [x] Mitarbeiter mit wenigen Bereichen und weniger als 4 Hauptbereiche: keine leeren Plätze (Unit-Tests). „Mehr“ erscheint bewusst immer (dokumentierte Abweichung)
- [x] Schrift lädt nicht: Ersatzschrift mit angepassten Maßen über `next/font`; die Seite kontaktiert nur `localhost`, keine Anfrage an Google (Netzwerkprüfung)
- [x] Sehr schmale Breite und 200 % Zoom: Wechsel auf die Handy-Ansicht, kein waagrechtes Scrollen (E2E 375 px)
- [x] Detail-Panel mit viel Inhalt scrollt in sich (`overflow-y-auto`, Code-Review)
- [x] Mehrere Hinweis-Meldungen werden von Sonner gestapelt (Code-Review)
- [x] „Bewegung reduzieren“ schaltet Animationen ab (E2E)
- [ ] BUG-4 (zusätzlich gefunden): Fehler im obersten Layout zeigen die englische Standardseite von Next.js

### Security Audit Results
- [x] Keine Geheimnisse im Browser-Code: Der Produktions-Build enthält weder `sb_secret_` noch `SUPABASE_SECRET_KEY`, das Admin-Modul (`createAdminClient`) ist nicht im Client-Bundle
- [x] Keine Verbindungen zu Dritten beim Seitenaufruf (nur `localhost`): Schrift selbst ausgeliefert, DSGVO-freundlich
- [x] Ausgeblendete Bereiche auch per Adresse nicht erreichbar (404)
- [x] Keine Eingabefelder, daher keine Injektionsfläche; Texte kommen ausschließlich aus `messages/de.json`
- [x] Einziger Cookie `sidebar_state` (rein funktional, nur nach Cmd/Ctrl+B gesetzt; siehe BUG-2)
- [ ] Sicherheits-Header fehlen weiterhin (bekannt als BUG-7 aus PROJ-1, wird bei /deploy erledigt)

### Bugs Found

#### BUG-1: Seitenleiste 256 statt 236 px breit
- **Severity:** Low
- **Steps to Reproduce:** Desktop 1440 px → Breite der Seitenleiste messen → 256 px; Entwurf und `--sidebar-width` in `globals.css`: 236 px
- **Ursache:** `SidebarProvider` setzt `--sidebar-width` per Inline-Style auf 16rem und überschreibt damit den Wert aus `globals.css`
- **Priority:** Nice to have (Abgleich mit dem Entwurf)

#### BUG-2: Cmd/Ctrl+B wird app-weit abgefangen
- **Severity:** Low
- **Steps to Reproduce:** Seite öffnen, z. B. in einem Textfeld Cmd+B (Mac) bzw. Ctrl+B drücken → Die Tastenkombination wird von der shadcn-Sidebar verschluckt (Standard-Kürzel zum Ein-/Ausklappen) und setzt den Cookie `sidebar_state`. Sichtbar passiert nichts, weil die Seitenleiste fest ausgeklappt ist
- **Folge:** Später fehlt „fett“ in Texteingaben (z. B. Notizen zu Buchungen)
- **Priority:** Fix in next sprint (spätestens vor dem ersten Feature mit Texteingabe)

#### BUG-3: Bereich der Hinweis-Meldungen englisch beschriftet
- **Severity:** Low
- **Steps to Reproduce:** Screenreader bzw. Barrierefreiheitsbaum: Bereich heißt „Notifications alt+T“
- **Expected:** deutsche Bezeichnung, z. B. „Benachrichtigungen (Alt+T)“ (Sonner-Option `containerAriaLabel`)
- **Priority:** Nice to have

#### BUG-4: Keine eigene Fehlerseite für Fehler im obersten Layout
- **Severity:** Low
- **Steps to Reproduce:** Fehler im Root-Layout (z. B. fehlende Umgebungsvariable beim Laden der Texte) → Next.js zeigt seine englische Standard-Fehlerseite
- **Expected:** deutsche Fehlerseite (`src/app/global-error.tsx`)
- **Priority:** Nice to have

### Hinweise (keine Bugs)
- Firefox und Safari wurden nicht getestet. Empfehlung: vor dem Pilotstart einmal manuell in Safari (Mac, iPhone) und Firefox durchklicken
- Mitarbeiter-Ansicht und Kunden-Auswahl lassen sich erst mit PROJ-4 im Browser testen (bis dahin Unit-Tests)
- Detail-Panel, Kennzahl-Kachel, Hinweis-Meldung und Ladezustand werden noch auf keiner Seite genutzt; ihr Verhalten im Browser wird mit dem ersten nutzenden Feature erneut geprüft

### Summary
- **Acceptance Criteria:** 27/28 bestanden, 1 teilweise (Design-Abgleich: BUG-1)
- **Bugs Found:** 4 total (0 critical, 0 high, 0 medium, 4 low)
- **Security:** Bestanden (keine Geheimnisse im Client, keine Drittanbieter-Anfragen; Sicherheits-Header offen aus PROJ-1)
- **Production Ready:** YES (keine Critical/High-Bugs; der Rahmen bleibt bis PROJ-3 ohnehin nur lokal bzw. in Vorschauen)
- **Recommendation:** Freigeben. BUG-1 bis BUG-3 sind klein und sollten vor PROJ-3 erledigt werden, BUG-4 bei Gelegenheit

## Deployment
_To be added by /deploy_
