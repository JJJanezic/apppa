# PROJ-38: Stammdaten: Umbenennung und Logo

## Status: Planned
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
| _Wird mit /architecture ergänzt_ | | |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
