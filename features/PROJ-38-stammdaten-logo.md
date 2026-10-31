# PROJ-38: Stammdaten: Umbenennung und Logo

## Status: In Progress
**Created:** 2026-10-31
**Last Updated:** 2026-10-31

## Dependencies
- Requires: PROJ-28 (Kundenstammdaten): Stammdaten-Formular für Inhaber und Betreiber, Konfliktschutz, Protokoll
- Requires: PROJ-5 (Betreiber-Admin): Kunden-Detailseite mit Abschnitt „Stammdaten“, Protokoll
- Requires: PROJ-4 (Kundenkonten & Rollen): Einstellungen nur für Inhaber
- Vorbild: PROJ-29 (Reisedokument): Bild-Upload mit Umwandlung, privater Speicher je Kunde
- Wird genutzt von: PROJ-41 (Ausstellen mit PDF): Logo auf der Rechnung

## Überblick
Erstes Paket der neuen Gliederung des Rechnungsmoduls (PROJ-38 bis PROJ-42). Es umfasst zwei Teile:

1. **Umbenennung:** Der Einstellungen-Reiter „Kunde“ heißt künftig **„Stammdaten“**, ebenso der Seitentitel. Die Adresse wird `/einstellungen/stammdaten`. Die alte Adresse `/einstellungen/kunde` leitet dauerhaft auf die neue weiter. Die Reiter stehen künftig in der Reihenfolge **Stammdaten, Team, Wohnungen**; `/einstellungen` öffnet daher „Stammdaten“ statt „Team“. Der Abschnitt auf der Betreiber-Detailseite heißt schon „Stammdaten“ und bleibt so.
2. **Logo:** Im Stammdaten-Formular gibt es ein neues, optionales Feld **„Logo“** (ein Bild je Kunde).

**Logo-Regeln:**
| Punkt | Regel |
|---|---|
| Zulässige Dateien | PNG, JPEG, WebP, HEIC/HEIF (iPhone), GIF (nur das erste Bild); höchstens 10 MB |
| Nicht zulässig | SVG, PDF und andere Nicht-Bilder |
| Umwandlung | Jedes Logo wird in ein PNG umgewandelt. Ein durchsichtiger Hintergrund bleibt erhalten, die Kamera-Ausrichtung wird berücksichtigt. Die längste Seite wird auf etwa 1.000 Pixel verkleinert, kleinere Bilder werden nie vergrößert. Das Original wird nicht aufbewahrt |
| Kleines Logo | Hat die längere Seite weniger als 300 Pixel, wird das Logo trotzdem angenommen. Unter der Vorschau steht dann der Hinweis „Das Logo ist klein und kann im Druck unscharf wirken.“ |
| Speichern | Das Logo ist Teil des Formulars. Nach dem Hochladen zeigt die Vorschau sofort das umgewandelte Bild, übernommen wird es erst mit „Speichern“. Gleiches gilt für Ersetzen und Entfernen |
| Anzeige | Nur als Vorschau im Stammdaten-Formular (Inhaber und Betreiber); ein Klick öffnet es groß |
| Speicher | Privat je Kunde (wie Ausweisbilder und Rechnungs-PDFs), nie über eine öffentliche Adresse abrufbar |

**Wer darf was:**
| Rolle | Logo sehen | Hochladen, ersetzen, entfernen | Wo |
|---|---|---|---|
| Inhaber | ja | ja | *Einstellungen → Stammdaten* |
| Betreiber | ja, bei jedem Kunden | ja; bei deaktivierten Kunden nur ansehen | Kunden-Detailseite, Abschnitt „Stammdaten“ |
| Mitarbeiter | nein | nein | kein Zugang (Einstellungen bleiben „Seite nicht gefunden“) |

**Aufräumen:** Die Verweise auf „PROJ-38/39“ in Spec, Code-Kommentaren und Migration von PROJ-37 werden auf die neue Gliederung angepasst: Erstellen und Ausstellen kommen mit PROJ-40/41, Übersicht und Filter mit PROJ-42. Das ändert nur Texte, kein Verhalten.

## User Stories
- Als **Inhaber** möchte ich den Einstellungen-Bereich „Stammdaten“ nennen, damit klar ist, dass dort Adresse, UID und Logo meines Unternehmens liegen.
- Als **Inhaber** möchte ich mein Firmenlogo hochladen, damit es später auf meinen Rechnungen erscheint.
- Als **Inhaber** möchte ich vor dem Speichern sehen, wie das Logo nach der Umwandlung aussieht, damit ich ein falsches Bild nicht erst auf der Rechnung bemerke.
- Als **Inhaber** möchte ich das Logo ersetzen oder entfernen können, damit ich nach einem Wechsel des Erscheinungsbilds nichts Veraltetes verwende.
- Als **Betreiber** möchte ich das Logo eines Kunden beim Onboarding selbst hochladen, damit der Kunde die erste Rechnung gleich vollständig ausstellen kann.
- Als **Inhaber** möchte ich gewarnt werden, wenn mein Logo zu klein ist, damit ich rechtzeitig eine bessere Datei besorge.
- Als **Inhaber** möchte ich die Stammdaten als ersten Reiter der Einstellungen sehen, damit ich die wichtigsten Unternehmensdaten ohne Umweg erreiche.
- Als **Inhaber mit Lesezeichen** auf die alte Seite „Kunde“ möchte ich automatisch auf „Stammdaten“ kommen.

## Out of Scope
- Logo auf der Rechnung bzw. im PDF (PROJ-41)
- Logo in Seitenleiste, Kopfzeile, „Mehr“-Menü oder Kundenübersicht des Betreibers (bewusst nicht)
- SVG- und andere Vektorlogos (Sicherheitsrisiko durch eingebetteten Code, unsichere PDF-Darstellung)
- Zuschneiden, Drehen oder Hintergrund-Entfernen in der App
- Mehrere Logos oder Varianten (z. B. hell/dunkel, Briefkopf und Fußzeile)
- Aufbewahren der Originaldatei
- Weitere Stammdaten wie Bankverbindung, Telefon, E-Mail, Webseite (eigene Pakete bei Bedarf, z. B. mit PROJ-39/40)
- Logo schon beim Anlegen eines Kunden (Anlegen bleibt Name + E-Mail, PROJ-5)
- Zugang oder Leseansicht für Mitarbeiter
- Neue Untermenüs der Einstellungen wie „Rechnungen“ (PROJ-39)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Umbenennung
- [ ] Angenommen ein Inhaber öffnet die Einstellungen, wenn die Reiter erscheinen, dann lauten sie in dieser Reihenfolge „Stammdaten“, „Team“, „Wohnungen“ (kein Reiter „Kunde“ mehr)
- [ ] Angenommen ein Inhaber ruft `/einstellungen` auf (z. B. über den Menüpunkt „Einstellungen“), wenn die Seite lädt, dann landet er auf `/einstellungen/stammdaten`
- [ ] Angenommen ein Inhaber klickt auf „Stammdaten“, wenn die Seite lädt, dann ist die Adresse `/einstellungen/stammdaten`, der Reiter ist markiert und der Browser-Tab trägt den Titel „Stammdaten“
- [ ] Angenommen ein Inhaber ruft `/einstellungen/kunde` auf (Lesezeichen), wenn die Seite lädt, dann landet er auf `/einstellungen/stammdaten`
- [ ] Angenommen ein Mitarbeiter ruft `/einstellungen/stammdaten` oder `/einstellungen/kunde` auf, wenn die Seite lädt, dann erhält er „Seite nicht gefunden“
- [ ] Angenommen ein Inhaber öffnet *Einstellungen → Stammdaten*, wenn die Seite lädt, dann funktionieren alle Felder aus PROJ-28 und der Kleinunternehmer-Status aus PROJ-36 unverändert
- [ ] Angenommen irgendwo in der App verweist ein Link oder Hinweis auf die Kundenseite der Einstellungen (z. B. aus PROJ-36/37), wenn der Nutzer ihm folgt, dann landet er direkt auf `/einstellungen/stammdaten` und der Text lautet „Stammdaten“

### Logo hochladen
- [ ] Angenommen für den Kunden ist kein Logo gespeichert, wenn ein Inhaber die Stammdaten öffnet, dann sieht er beim Feld „Logo“ einen leeren Platz mit „Logo hochladen“
- [ ] Angenommen ein Inhaber wählt ein PNG mit durchsichtigem Hintergrund, wenn das Hochladen fertig ist, dann zeigt die Vorschau das Logo mit durchsichtigem Hintergrund (sichtbar z. B. vor einem Karomuster oder einer getönten Fläche)
- [ ] Angenommen ein Inhaber wählt ein JPEG, WebP, GIF oder ein HEIC-Foto vom iPhone, wenn das Hochladen fertig ist, dann erscheint eine richtig herum gedrehte Vorschau, in Chrome, Firefox und Safari
- [ ] Angenommen ein Logo wurde hochgeladen, aber noch nicht gespeichert, wenn der Inhaber die Seite verlässt oder neu lädt, dann ist das bisherige Logo (oder kein Logo) weiterhin gespeichert
- [ ] Angenommen ein Logo wurde hochgeladen, wenn der Inhaber „Speichern“ klickt, dann erscheint eine Erfolgsmeldung und das Logo ist nach dem Neuladen weiterhin in der Vorschau zu sehen
- [ ] Angenommen ein gespeichertes Logo hat die längste Seite über 1.000 Pixel, wenn es groß angezeigt oder heruntergeladen wird, dann ist die längste Seite etwa 1.000 Pixel und die Datei ein PNG
- [ ] Angenommen ein Inhaber lädt ein Bild hoch, dessen längere Seite unter 300 Pixel liegt, wenn die Vorschau erscheint, dann steht darunter der Hinweis „Das Logo ist klein und kann im Druck unscharf wirken.“ und Speichern ist trotzdem möglich
- [ ] Angenommen ein Inhaber lädt ein Bild hoch, dessen längere Seite 300 Pixel oder mehr hat, wenn die Vorschau erscheint, dann steht dort kein Größenhinweis
- [ ] Angenommen ein Logo ist gespeichert, wenn ein Nutzer auf die Vorschau klickt, dann öffnet sich das Logo groß

### Ersetzen und Entfernen
- [ ] Angenommen ein Logo ist gespeichert, wenn ein Inhaber ein neues hochlädt und speichert, dann ersetzt das neue das alte, und das alte ist nicht mehr abrufbar
- [ ] Angenommen ein Logo ist gespeichert, wenn ein Inhaber „Logo entfernen“ wählt und speichert, dann hat der Kunde kein Logo mehr und die alte Datei ist nicht mehr abrufbar
- [ ] Angenommen ein Inhaber hat ein Logo entfernt oder ersetzt, aber noch nicht gespeichert, wenn er die Seite neu lädt, dann ist das zuletzt gespeicherte Logo wieder zu sehen

### Fehler beim Hochladen
- [ ] Angenommen ein Inhaber wählt eine SVG-, PDF- oder andere Nicht-Bild-Datei, wenn er hochlädt, dann erscheint die Meldung, dass nur PNG, JPEG, WebP, HEIC oder GIF erlaubt sind, und das bisherige Logo bleibt unverändert
- [ ] Angenommen ein Inhaber wählt ein Bild über 10 MB, wenn er hochlädt, dann erscheint eine Meldung mit der Höchstgröße und das bisherige Logo bleibt unverändert
- [ ] Angenommen ein Inhaber wählt ein beschädigtes Bild oder ein HEIC, das der Browser nicht lesen kann, wenn er hochlädt, dann erscheint eine verständliche Fehlermeldung und das bisherige Logo bleibt unverändert
- [ ] Angenommen beim Speichern bricht die Verbindung ab, wenn der Nutzer speichert, dann erscheint eine Fehlermeldung, alle Eingaben und die Logo-Vorschau bleiben im Formular stehen, und gespeichert ist weiterhin der bisherige Stand

### Betreiber
- [ ] Angenommen der Betreiber öffnet die Detailseite eines aktiven Kunden, wenn der Abschnitt „Stammdaten“ lädt, dann sieht er das Feld „Logo“ mit dem gespeicherten Logo bzw. „Logo hochladen“
- [ ] Angenommen der Betreiber lädt bei einem aktiven Kunden ein Logo hoch und speichert, wenn sich der Inhaber danach anmeldet, dann sieht er dieses Logo unter *Einstellungen → Stammdaten*
- [ ] Angenommen ein Kunde ist deaktiviert, wenn der Betreiber dessen Detailseite öffnet, dann sieht er das Logo (falls vorhanden), kann es aber weder hochladen, ersetzen noch entfernen
- [ ] Angenommen ein Kunde ist deaktiviert, wenn eine Logo-Änderung auf anderem Weg als über die Oberfläche beim Server ankommt, dann wird sie abgelehnt

### Schutz, Protokoll, Mandantentrennung
- [ ] Angenommen Betreiber und Inhaber haben die Stammdaten gleichzeitig geöffnet und der Inhaber hat bereits ein Logo gespeichert, wenn der Betreiber speichert, dann erhält er den Hinweis „Die Kundendaten wurden inzwischen geändert“ und weder sein Logo noch seine übrigen Änderungen werden gespeichert
- [ ] Angenommen ein Logo wird hochgeladen, ersetzt oder entfernt und gespeichert, wenn jemand das Änderungsprotokoll bzw. das Betreiber-Protokoll ansieht, dann ist „Logo“ als geändertes Feld mit Person und Zeitpunkt vermerkt, ohne das Bild selbst
- [ ] Angenommen ein Mitarbeiter versucht, das Logo auf anderem Weg als über die Oberfläche hochzuladen, abzurufen oder zu ändern, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt
- [ ] Angenommen ein Inhaber von Kunde A kennt die Speicheradresse des Logos von Kunde B, wenn er sie abruft, dann wird das abgelehnt
- [ ] Angenommen das Logo ist gespeichert, wenn jemand ohne Anmeldung die Speicheradresse abruft, dann wird das abgelehnt (keine öffentliche Adresse)

### Allgemein
- [ ] Angenommen das Formular wird am Handy (375 px Breite) geöffnet, wenn der Nutzer ein Logo hochlädt, dann kann er ein Bild aus der Galerie oder den Dateien wählen, und Vorschau sowie Knöpfe sind ohne seitliches Scrollen bedienbar
- [ ] Angenommen ein bestehender Kunde, wenn das Feature eingespielt wird, dann bleiben alle Stammdaten unverändert und der Kunde hat kein Logo

## Edge Cases
- **Hochladen ohne Speichern, dann neues Hochladen:** Die zweite Datei ersetzt die erste in der Vorschau. Beim Speichern zählt nur die zuletzt gewählte, die nicht gespeicherte Zwischendatei bleibt nicht dauerhaft liegen.
- **Seite verlassen nach Hochladen ohne Speichern:** Das hochgeladene, nicht gespeicherte Logo wird nicht übernommen und nicht dauerhaft aufbewahrt.
- **Speichern ohne Änderung am Logo:** Das bestehende Logo bleibt, es gibt keinen Protokolleintrag für „Logo“.
- **Logo ändern, sonst nichts:** Speichern ist erlaubt, im Protokoll steht nur „Logo“.
- **Logo mit weißem statt durchsichtigem Hintergrund:** bleibt weiß, es gibt keine automatische Freistellung.
- **Sehr breites oder sehr hohes Logo** (z. B. 4.000 × 300 Pixel): Die längste Seite wird auf etwa 1.000 Pixel verkleinert, das Seitenverhältnis bleibt. Liegt die kürzere Seite danach unter 300 Pixel, erscheint kein Hinweis, weil nur die längere Seite zählt.
- **Animiertes GIF:** Nur das erste Bild wird übernommen, ohne eigenen Hinweis.
- **Kunde wird während der Bearbeitung deaktiviert** oder der Inhaber verliert die Inhaberrolle: Speichern samt Logo wird abgelehnt (wie PROJ-28).
- **Zwei Inhaber desselben Kunden** laden gleichzeitig ein Logo hoch: Wer zuerst speichert, gewinnt, der zweite erhält den Hinweis auf eine zwischenzeitliche Änderung.
- **Alte Adresse mit Zusatz** (z. B. `/einstellungen/kunde?x=1`): leitet ebenfalls auf `/einstellungen/stammdaten` weiter.

## Technical Requirements
- Rechte serverseitig durchgesetzt (Inhaber nur eigener Kunde, Betreiber alle aktiven Kunden schreibend, Mitarbeiter keine Rechte), auch für den Speicher
- Speicher privat je Kunde, Abruf nur für Berechtigte, keine öffentliche Adresse
- Prüfregeln (Dateiart, Größe) gleich in Oberfläche und Server
- Deutsche Texte über die bestehende i18n-Struktur
- Responsiv ab 375 px Breite; Chrome, Firefox, Safari

## Open Questions
- [ ] Wie groß und wo erscheint das Logo auf der Rechnung (Position, maximale Höhe)? Wird in PROJ-41 mit der Anordnung der Textblöcke geklärt
- [ ] Reichen etwa 1.000 Pixel an der längsten Seite für den Druck? Mit dem PDF-Erzeuger in PROJ-41 prüfen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Reiter, Titel und Adresse heißen „Stammdaten“, mit Umleitung von `/einstellungen/kunde` | Passt zur Betreiber-Detailseite und zu den künftigen Inhalten (Logo, später mehr); Lesezeichen funktionieren weiter | 2026-10-31 |
| Reiter-Reihenfolge Stammdaten, Team, Wohnungen; `/einstellungen` öffnet Stammdaten | Wunsch des Nutzers; Stammdaten sind die Grundlage für Rechnungen und Berichte | 2026-10-31 |
| Logo darf von Inhaber und Betreiber geändert werden; bei deaktivierten Kunden nur lesbar | Gleiche Rechte wie die übrigen Stammdaten (PROJ-28); Betreiber kann beim Onboarding helfen | 2026-10-31 |
| Bildformate PNG/JPEG/WebP/HEIC/GIF bis 10 MB, umgewandelt in PNG mit Transparenz, längste Seite etwa 1.000 Pixel, Original verworfen | Logos haben oft durchsichtige Hintergründe (JPEG wie bei den Ausweisbildern ginge nicht); einheitliches Format für das spätere PDF; kleine Dateien | 2026-10-31 |
| Kein SVG | Eingebetteter Code wäre ein Sicherheitsrisiko; Darstellung im PDF unsicher | 2026-10-31 |
| Logo wird mit dem Stammdaten-Formular gespeichert, Vorschau sofort | Ein Speichern-Knopf, gleicher Konfliktschutz und Protokoll wie die übrigen Felder; Vorbild PROJ-29 | 2026-10-31 |
| Anzeige nur in den Stammdaten | Logo ist für die Rechnung gedacht; Seitenleiste und Übersicht bleiben schlicht | 2026-10-31 |
| Kleine Logos (< 300 Pixel an der längeren Seite) nur mit Hinweis, nicht abgelehnt | Manche Kunden haben nur ein kleines Logo; besser schlechtes Logo als keines; Hinweis macht auf die Druckqualität aufmerksam | 2026-10-31 |
| Verweise in PROJ-37 auf die neue Gliederung anpassen | Neue Nummerierung PROJ-38 bis PROJ-42 vom Nutzer bestätigt; veraltete Verweise führen in die Irre | 2026-10-31 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigener privater Speicherbereich „Kunden-Logos“ statt Mitnutzung der Ausweisbilder | Andere Rechte (Inhaber/Betreiber statt aller Mitglieder), anderes Format (PNG statt JPEG); klare Trennung bei Bereinigung und Löschen | 2026-10-31 |
| Logo als Speicherort direkt an der Kunden-Tabelle | Genau ein Logo je Kunde; Konfliktschutz und Änderungsprotokoll greifen ohne Zusatzaufwand | 2026-10-31 |
| Speichern über die bestehende Stammdaten-Funktion mit optionalem Schlüssel „Logo“ | Ein Weg für Inhaber und Betreiber mit denselben Prüfungen; fehlender Schlüssel lässt das Logo unverändert (wie der Schalter aus PROJ-37) | 2026-10-31 |
| Umwandlung im Browser zu PNG mit Transparenz, 1.000 Pixel | Gleicher Weg wie die Ausweisbilder; umgeht die Vercel-Grenze von 4,5 MB; der Server kann HEIC nicht lesen | 2026-10-31 |
| Vorschau vor dem Speichern aus dem Browser, nicht vom Speicher | Nicht eingetragene Dateien müssen dann für niemanden lesbar sein; einfachere Leseregel als bei den Ausweisbildern | 2026-10-31 |
| Mitarbeiter ohne Lesezugriff auf das Logo | Entspricht der Spec (kein Zugang zu Stammdaten); die PDF-Erzeugung in PROJ-41 liest mit dem geheimen Schlüssel auf dem Server | 2026-10-31 |
| Umleitung `/einstellungen/kunde` in der Next.js-Konfiguration | Greift vor jeder Seite, behält Zusätze in der Adresse, kein eigener Seitenordner für die alte Adresse | 2026-10-31 |
| Bestehenden Bereinigungs-Zeitplan erweitern statt neuen anlegen | Ein Zeitplan und ein Schlüssel; Einstiegstarif von Vercel begrenzt die Zahl der Zeitpläne | 2026-10-31 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Stammdaten-Formular** (`tenant-master-data-form`) für Inhaber und Betreiber, gespeichert über **eine** geschützte Datenbank-Funktion. Sie prüft Rechte und ob der Kunde aktiv ist, schützt vor gleichzeitigen Änderungen und schreibt das Betreiber-Protokoll mit der Liste der geänderten Felder (PROJ-28, erweitert in PROJ-36/37).
- **Zwei private Speicherbereiche** nach demselben Muster: Ausweisbilder (PROJ-29) und Rechnungs-PDFs (PROJ-37). Es gibt je einen Ordner pro Kunde und zufällige Dateinamen. Der Browser lädt direkt hoch, das Speichern trägt die Datei erst ein, und die Datenbank meldet nicht mehr verwendete Dateien zum Löschen zurück.
- **Bildumwandlung im Browser** (`document-image`): drehen, verkleinern, HEIC über das bereits installierte Paket `heic-to`, das nur bei Bedarf geladen wird.
- **Tägliche Bereinigung** (Vercel Cron `/api/cron/ausweisbilder`) für beide Speicherbereiche. **Kunde löschen** (Betreiber) entfernt die Ordner beider Bereiche.

### A) Seiten und Bausteine

```
Einstellungen (nur Inhaber)
+-- Reiter: Stammdaten · Team · Wohnungen      (neue Reihenfolge)
+-- /einstellungen               → leitet auf /einstellungen/stammdaten
+-- /einstellungen/kunde         → leitet dauerhaft auf /einstellungen/stammdaten (auch mit Zusätzen)
+-- /einstellungen/stammdaten    (bisherige Seite „Kunde“, neuer Name und Titel)
    +-- Stammdaten-Formular
        +-- NEU ganz oben: Feld „Logo“
        |   +-- leer: Knopf „Logo hochladen“
        |   +-- während Umwandeln/Hochladen: Fortschrittsanzeige (Speichern gesperrt)
        |   +-- gefüllt: Vorschau auf getönter Fläche (Transparenz sichtbar) + „Ersetzen“ + „Entfernen“
        |   +-- Hinweis „Das Logo ist klein …“ bei < 300 Pixel an der längeren Seite
        |   +-- Klick auf Vorschau → große Ansicht (vorhandener shadcn-Dialog)
        +-- übrige Felder aus PROJ-28/36/37 unverändert
        +-- Speichern

Betreiber → Kunden-Detailseite → Abschnitt „Stammdaten“
+-- dasselbe Formular inkl. Logo; bei deaktiviertem Kunden nur Vorschau, ohne Knöpfe

Betreiber-Protokoll
+-- „Stammdaten geändert: Logo“ (neue Feldbezeichnung)
```

- **Logo-Feld als eigener Baustein** neben dem Bildplatz der Ausweisbilder. Es übernimmt deren Ablauf (Hochladen, Ersetzen, Entfernen, Fortschritt, Fehlermeldungen), zeigt aber nur ein Bild und wandelt in PNG um.
- **Vorschau vor dem Speichern** zeigt das umgewandelte Bild direkt aus dem Browser. Ein Abruf vom Speicher ist dafür nicht nötig. Ein gespeichertes Logo wird über einen kurzlebigen Abruf-Link (10 Minuten) angezeigt, den der Server beim Laden der Seite erzeugt.
- **Umbenennung:** Der Seitenordner wird von `kunde` zu `stammdaten` umbenannt, Reiter-Text und Seitentitel kommen aus den deutschen Texten. Die Umleitung der alten Adresse steht zentral in der Next.js-Konfiguration. So greift sie vor jeder Seite, und Zusätze in der Adresse bleiben erhalten.

### B) Datenmodell (in Worten)

**Kunde** (bestehende Tabelle) bekommt **ein** neues, optionales Feld:
- **Logo:** der Speicherort der Datei, keine Bilddaten in der Tabelle. Bestehende Kunden: leer.

**Regeln in der Datenbank:**
- Ein Logo darf nur eingetragen werden, wenn die Datei im Ordner **desselben** Kunden liegt, wirklich existiert und das Format `<Kunde>/<zufällig>.png` hat.

**Neuer privater Speicherbereich „Kunden-Logos“** in Supabase Storage (EU, eu-west-1):
- ein Ordner je Kunde, zufälliger Dateiname
- nur PNG, höchstens 5 MB je Datei (ein umgewandeltes Logo mit 1.000 Pixeln hat typischerweise unter 1 MB, bei fotoähnlichen Logos bis etwa 3 MB)
- kein öffentlicher Zugriff

### C) Rechte

| Aktion | Inhaber | Mitarbeiter | Betreiber-Admin (2FA) |
|---|---|---|---|
| Logo ansehen | ✓ eigener Kunde | – | ✓ alle Kunden |
| Logo hochladen (Datei in den Kunden-Ordner) | ✓ eigener, aktiver Kunde | – | ✓ aktive Kunden |
| Logo am Kunden eintragen, ersetzen, entfernen (über „Speichern“) | ✓ | – | ✓ aktive Kunden |
| Datei löschen | – | – | – (nur der Server mit geheimem Schlüssel) |

- **Ansehen:** Eine Datei ist nur abrufbar, wenn sie das eingetragene Logo des Kunden ist. Ersetzte oder entfernte Logos sind damit sofort nicht mehr abrufbar. Mitarbeiter haben keinen Lesezugriff.
- **Hochladen:** Wer hochlädt, braucht die Rechte des Inhabers bzw. Betreibers für einen **aktiven** Kunden. Wirksam wird eine Datei aber erst über „Speichern“, also über die bestehende Stammdaten-Funktion.
- Die spätere Rechnungs-PDF-Erzeugung (PROJ-41) liest das Logo auf dem Server mit dem geheimen Schlüssel. Dafür braucht es keine zusätzlichen Leserechte.

### D) Logo hochladen: Ablauf
1. Der Nutzer wählt ein Bild (am Handy: Galerie oder Dateien).
2. **Der Browser prüft und wandelt um:**
   - Prüfung: Dateiart PNG, JPEG, WebP, HEIC/HEIF oder GIF, höchstens 10 MB. Andere Dateien wie SVG oder PDF lehnt er mit Meldung ab.
   - Umwandlung: richtig drehen, längste Seite höchstens 1.000 Pixel (nie vergrößern), Ausgabe als **PNG mit Transparenz**. Der weiße Hintergrund, den die Ausweisbilder bekommen, entfällt hier. Versteckte Bilddaten wie Kamera oder GPS fallen dabei weg.
   - HEIC: Safari kann es selbst, die anderen Browser laden `heic-to` erst in diesem Moment nach.
   - Danach meldet er Breite und Höhe. Ist die längere Seite unter 300 Pixel, zeigt das Formular den Hinweis an.
3. Das PNG geht **direkt vom Browser an den privaten Speicher**, nicht über den App-Server (Vercel-Grenze von 4,5 MB je Anfrage).
4. Das Formular merkt sich den Speicherort. Erst **„Speichern“** trägt das Logo am Kunden ein, im selben Vorgang wie die übrigen Stammdaten und mit demselben Konfliktschutz.

### E) Speichern und Aufräumen
- **Stammdaten-Funktion** (bestehend) bekommt den optionalen Schlüssel „Logo“:
  - Fehlt der Schlüssel, bleibt das Logo unverändert (wie beim Schalter aus PROJ-37).
  - „Leer“ entfernt das Logo, ein Speicherort ersetzt es.
  - „Logo“ zählt wie jedes andere Feld für das Betreiber-Protokoll und für „Speichern ohne Änderung“.
  - Nach dem Speichern gibt die Funktion das **alte Logo** zurück, falls es ersetzt oder entfernt wurde. Der Server löscht diese Datei sofort.
- **Konflikt oder Fehler beim Speichern:** Die hochgeladene Datei bleibt zunächst liegen, ist aber an keinem Kunden eingetragen und daher für niemanden abrufbar. Die tägliche Bereinigung entfernt sie.
- **Tägliche Bereinigung** (bestehender Zeitplan) bekommt den dritten Speicherbereich: Dateien, die älter als 24 Stunden und nicht eingetragen sind, werden gelöscht.
- **Kunde löschen (Betreiber):** entfernt zusätzlich den Logo-Ordner des Kunden.

### F) Änderungsprotokoll
- **Betreiber-Protokoll:** Die neue Feldbezeichnung „Logo“ erscheint in „Stammdaten geändert: …“.
- **Allgemeines Änderungsprotokoll der Kunden-Tabelle:** übernimmt das neue Feld automatisch. Dort steht nur der Speicherort, nicht das Bild.

### G) Aufräumen der Verweise aus PROJ-37
Die Verweise in der PROJ-37-Spec, in `src/lib/invoices.ts` und im Kommentar der Rechnungs-Tabelle werden angepasst:
- „PROJ-38 Erstellen/Ausstellen“ → PROJ-40/41
- „PROJ-39 PDF/Übersicht“ → PROJ-41/42

Der Tabellenkommentar wird in der neuen Migration mitgeändert. Die alte Migration bleibt unverändert, weil sie schon in allen Umgebungen eingespielt ist.

### H) Tests
- **Unit-Tests:** Umwandlung in PNG (Transparenz bleibt, längste Seite 1.000 Pixel, kein Vergrößern, Größenhinweis unter 300 Pixel, Ablehnung von SVG, PDF und Dateien über 10 MB), Prüfung des Speicherorts, Reiter-Reihenfolge.
- **Integrationstests gegen „apppa-dev“:**
  - Inhaber und Betreiber können ein Logo eintragen, ersetzen und entfernen, und die Funktion meldet das alte Logo zurück.
  - Mitarbeiter können weder hochladen noch lesen noch eintragen.
  - Kunde B kann das Logo von Kunde A weder lesen noch bei sich eintragen, ohne Anmeldung gibt es keinen Abruf.
  - Ein ersetztes Logo ist sofort nicht mehr abrufbar.
  - Bei deaktivierten Kunden sind Hochladen und Eintragen gesperrt, Lesen durch den Betreiber geht.
  - Konfliktschutz und Protokolleintrag „Logo“ greifen, die Bereinigung löscht nur nicht eingetragene Dateien.
- **E2E:**
  - Reiter-Reihenfolge, `/einstellungen` und `/einstellungen/kunde` landen auf Stammdaten.
  - Logo hochladen (PNG mit Transparenz, JPEG, HEIC-Beispielbild), groß öffnen, ersetzen und entfernen.
  - Hinweis bei kleinem Logo, Fehlermeldung bei SVG bzw. PDF, Neuladen ohne Speichern behält das alte Logo.
  - Betreiber lädt ein Logo hoch, deaktivierter Kunde nur lesbar, Mitarbeiter bekommt „Seite nicht gefunden“, Handy-Ansicht, axe.
  - Bestehende E2E-Tests mit `/einstellungen/kunde` werden auf die neue Adresse umgestellt.
- **Manuell:** Safari auf Mac und iPhone (HEIC, Galerie-Auswahl). Playwright testet nur Chrome.

### I) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- **Kunden-Tabelle:** neues Feld „Logo“ mit der Prüfregel aus B.
- **Neuer privater Speicherbereich „Kunden-Logos“** mit Zugriffsregeln:
  - Hochladen durch Inhaber bzw. Betreiber-Admin nur in den Ordner eines aktiven Kunden, nur PNG, höchstens 5 MB.
  - Lesen nur für das eingetragene Logo, durch Inhaber des Kunden bzw. Betreiber-Admin.
  - Kein Löschen oder Überschreiben durch Nutzer.
- **Geänderte geschützte Funktion:** Stammdaten speichern (neuer Schlüssel „Logo“; gibt jetzt das alte Logo zurück statt nichts).
- **Geänderte Server-Abläufe:** tägliche Bereinigung und Kunde löschen, je um den neuen Speicherbereich ergänzt.
- **Keine neuen Umgebungsvariablen, kein neuer Zeitplan.** Bestehende Regeln für Kunden bleiben unverändert.

### J) Abhängigkeiten
- Keine neuen Pakete. `heic-to` ist schon installiert. Drehen, Verkleinern und die PNG-Erzeugung macht der Browser selbst, die große Ansicht nutzt den vorhandenen shadcn-Dialog.

## Implementation Notes (Frontend)
**Stand 2026-10-31.** Die Oberfläche ist fertig. **Ohne die Migration aus `/backend` schlagen *Einstellungen → Stammdaten* und die Betreiber-Detailseite beim Laden fehl**, weil sie die neue Spalte `logo_path` abfragen (wie bei PROJ-28/29).

**Umbenennung**
- Seitenordner `src/app/(app)/einstellungen/kunde` → `stammdaten`. Reiter (`settings-tabs.tsx`) in der Reihenfolge Stammdaten, Team, Wohnungen; `/einstellungen` leitet auf `/einstellungen/stammdaten`.
- Umleitung `/einstellungen/kunde` → `/einstellungen/stammdaten` als dauerhafte Umleitung (308) in `next.config.ts`. Zusätze wie `?x=1` bleiben erhalten (am gebauten Server geprüft).
- Texte: Reiter und Seitentitel „Stammdaten“ (`settings.tenant`), Einleitung der Einstellungen, Hinweis „Nacherfassen ausgeschaltet“ in den Rechnungen verweist auf *Einstellungen → Stammdaten*.
- Bestehende E2E-Tests (PROJ-4, 28, 36, 37) auf die neue Adresse umgestellt. PROJ-4 prüft für Mitarbeiter zusätzlich `/einstellungen/stammdaten` und die alte Adresse.

**Logo**
- `src/lib/tenant-logo.ts`: Speicherbereich `tenant-logos`, Speicherort `<Kunde>/<uuid>.png`, Grenzen (Eingang 10 MB, Ergebnis 5 MB, längste Seite 1.000 px, Hinweis unter 300 px), erlaubte Dateien PNG/JPEG/WebP/GIF/HEIC (SVG, BMP, TIFF und PDF nicht), Platzhalter `uploading`.
- `src/lib/logo-image.ts`: Umwandlung im Browser zu PNG ohne Hintergrundfüllung, sodass Transparenz erhalten bleibt. Dekodieren inkl. HEIC über `decodeImage` aus `document-image.ts` (dafür exportiert, Verhalten unverändert).
- `src/components/tenant/tenant-logo-field.tsx`: Feld ganz oben im Stammdaten-Formular. Es umfasst Hochladen, Ersetzen, Entfernen, Fortschritt, Fehlermeldungen und eine Vorschau auf Karomuster. Ein Klick öffnet die große Ansicht (shadcn-Dialog). Dazu kommen die Hinweise „klein“ (gemessen am angezeigten Bild, auch beim gespeicherten Logo), „noch nicht gespeichert“ und „wird beim Speichern entfernt“. Bei deaktiviertem Kunden gibt es nur die Vorschau bzw. „Kein Logo hinterlegt“.
- Upload-Vorbereitung: `prepareLogoUpload` (Inhaber, `einstellungen/actions.ts`, gleicher Kunden-Abgleich wie beim Speichern) und `adminPrepareLogoUpload` (Betreiber, `betreiber/actions.ts`, lehnt deaktivierte bzw. gelöschte Kunden mit Meldung ab). Beide laufen über `prepareLogoUploadFor` in `src/lib/tenant-logo-data.ts`.
- Laden: `logoLink` erzeugt einen Abruf-Link (10 Minuten) für die Inhaber-Seite und die Betreiber-Detailseite. `TenantMasterData` hat neu `logoPath` und `logoUrl`.
- Prüfregel `logoPath` im Stammdaten-Schema: leer oder `<uuid>/<uuid>.png`, „uploading“ sperrt das Speichern mit Meldung. Die Speicheraktion schickt `logo_path` an `update_tenant_master_data`, `null` entfernt das Logo.
- Betreiber-Protokoll: Feldbezeichnung „Logo“ (`tenantData.fields.logoPath`).
- `src/types/database.ts` von Hand um `tenants.logo_path` ergänzt; `/backend` erzeugt die Typen neu.

**Aufräumen PROJ-37:** Verweise in `features/PROJ-37-rechnungen-nacherfassen.md` und `src/lib/invoices.ts` auf die neue Gliederung (PROJ-39 bis PROJ-42) umgestellt. Der Kommentar der Rechnungs-Tabelle folgt mit der Migration.

**Tests:** Unit-Tests `src/lib/tenant-logo.test.ts` (Dateiarten, Größe, Hinweis, Speicherort) und Logo-Regel in `src/lib/validation/tenant.test.ts`. Neue E2E-Datei `tests/PROJ-38-stammdaten-logo.spec.ts` mit Reiter-Reihenfolge und Umleitungen; die Logo-Abläufe ergänzt `/qa` nach dem Backend. Lint, Typprüfung, alle 566 Unit-Tests und der Produktions-Build laufen durch.

**Offen für `/backend`:** erledigt, siehe unten.

## Implementation Notes (Backend)
**Stand 2026-10-31.** Migration `20261031063941_tenant_logo.sql` ist in Dev („apppa-dev“) eingespielt, die Typen sind neu erzeugt. Die Advisors melden nur die bekannten Auth-Hinweise (`auth_otp_long_expiry`, `auth_leaked_password_protection`, Runbook).

**Datenbank**
- `tenants.logo_path` mit Prüfregel `tenants_logo_path_check`: nur `<Kunde>/<uuid>.png` im Ordner **dieses** Kunden. Das gilt auch für den Server mit geheimem Schlüssel. Nutzer können die Tabelle weiterhin nur lesen.
- `private.logo_tenant`: Kunde aus dem Speicherort, null bei jedem anderen Format.
- `update_tenant_master_data` neu angelegt, weil sich der Rückgabetyp ändert (`void` → `jsonb`):
  - Schlüssel `logo_path`: fehlt = unverändert, null = entfernen.
  - Ein neuer Speicherort muss im Ordner des Kunden liegen und im Speicher vorhanden sein, sonst Fehler **P0018**.
  - `logo_path` zählt für Protokoll und „Speichern ohne Änderung“.
  - Rückgabe `{unused_logo}`: das ersetzte bzw. entfernte Logo.
  - Sonst unverändert gegenüber PROJ-37.
- `public.unused_tenant_logos` (nur `service_role`): Logos älter als 24 Stunden, die an keinem Kunden hängen.
- Kommentar der Rechnungs-Tabelle auf „PROJ-41: ausgestellt“ umgestellt.

**Speicherbereich `tenant-logos`** (privat, nur `image/png`, 5 MB)
- Hochladen (`private.can_upload_logo`): Inhaber des aktiven Kunden oder Admin mit 2FA bei einem aktiven Kunden.
- Lesen (`private.can_read_logo`): Inhaber oder Admin mit 2FA, und nur das **eingetragene** Logo. Nicht gespeicherte und ersetzte Dateien sind für niemanden lesbar, Mitarbeiter haben keinen Zugriff.
- Kein Ändern oder Löschen durch Nutzer.

**Server**
- `src/lib/tenant-logo-files.ts`: `removeLogoFile`, `removeTenantLogos` (Kunde löschen), `removeUnusedLogos` (Bereinigung).
- `saveTenantMasterData` löscht das gemeldete alte Logo gleich nach dem Speichern. P0018 wird zur Meldung „Das Logo wurde nicht gefunden. Bitte lade es erneut hoch.“
- Betreiber „Kunde löschen“ entfernt zusätzlich den Logo-Ordner.
- Täglicher Bereinigungsplan `/api/cron/ausweisbilder` bereinigt jetzt auch die Logos (Antwortfeld `logosRemoved`). Ein Fehler in einem Bereich hält die anderen nicht auf. Kein neuer Zeitplan, keine neue Umgebungsvariable.

**Tests**
- Integration `supabase/tests/tenant-logo.integration.test.ts` (6 Tests, grün):
  - Eintragen, Ersetzen und Entfernen mit Rückmeldung des alten Logos, Lesbarkeit danach, Protokoll, fehlender Schlüssel.
  - P0018 bei fehlender Datei, falschem Format oder fremdem Ordner; Prüfregel der Tabelle (23514).
  - Speicherbereich: nur PNG bis 5 MB mit richtigem Speicherort.
  - Mitarbeiter, fremder Inhaber und ohne Anmeldung: nichts; Bereinigung nur für den Server.
  - Admin bei aktivem bzw. deaktiviertem Kunden, ohne 2FA nichts; Bereinigung lässt frische und eingetragene Dateien aus.
- Cron-Unit-Test um die Logos ergänzt.
- `npm test`: 50 Dateien, 573 Tests grün; die Integrationstests aus RLS und Rechnungen laufen mit dem neuen Rückgabetyp.
- E2E gegen den gebauten Server (desktop):
  - PROJ-38 (Reiter, Umleitungen) grün.
  - PROJ-28 grün, nachdem eine übersehene URL-Erwartung `/einstellungen/kunde` umgestellt war.
  - PROJ-36 (3 Tests), PROJ-37 (Schalter) und PROJ-4 (Kundenname, Mitarbeiter) grün.

**Befund für `/qa` (bestand schon vor PROJ-38):** Die PROJ-4-Prüfung „Team- und Kundenseite … Bedienelemente ≥ 44 px“ schlägt auf der Stammdaten-Seite fehl. Sie misst ein Element mit 44 × 24 px. Das ist der Schalter „Rechnungen nacherfassen“ (shadcn-Switch `h-6 w-11`), der seit PROJ-37 (`b5b95e2`) im Formular steht. Mit PROJ-38 hat das nichts zu tun, es fiel nur erst jetzt auf. Die axe-Prüfung kam in diesem Test nicht mehr zum Zug.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
