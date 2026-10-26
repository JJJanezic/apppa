# PROJ-28: Kundenstammdaten

## Status: In Progress
**Created:** 2026-10-26
**Last Updated:** 2026-10-26

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Kunde (Mandant), Rolle Inhaber, Seite *Einstellungen → Kunde* mit dem Kundennamen
- Requires: PROJ-5 (Betreiber-Admin): Kunden-Detailseite, Kundenübersicht, Protokoll
- Requires: PROJ-7 (Gäste-Datenbank): vorhandene Länderauswahl wird wiederverwendet
- Wird voraussichtlich genutzt von: PROJ-16 (Abgabebericht), PROJ-26 (Gästeblatt), spätere Exporte

## Überblick
Bisher hat ein Kunde nur einen Namen. Dieses Paket (das erste von mehreren) ergänzt die Firmen- bzw. Vermieterdaten des Kunden:

| Angabe | Pflicht | Regeln |
|---|---|---|
| Kundenname | ja | unverändert: 1–200 Zeichen |
| Namenszeile 2 | nein | höchstens 200 Zeichen, z. B. Rechtsform-Zusatz, „z. H.“, Inhabername |
| Adresszeile 1 | nein | höchstens 200 Zeichen |
| Adresszeile 2 | nein | höchstens 200 Zeichen |
| Postleitzahl | nein | höchstens 10 Zeichen, freie Eingabe (ausländische PLZ möglich) |
| Ort | nein | höchstens 100 Zeichen |
| Staat | nein | Auswahlliste mit Suche (Länderauswahl aus PROJ-7), neu angezeigt vorbelegt mit „Österreich“ |
| UID | nein | Formatprüfung, siehe unten |
| Steuernummer | nein | freie Eingabe, höchstens 30 Zeichen |
| Registernummer | nein | freie Eingabe, höchstens 30 Zeichen, z. B. Firmenbuchnummer „FN 123456a“ |

**UID-Prüfung (nur Format, keine Online-Prüfung):**
- Leerzeichen werden entfernt, Kleinbuchstaben in Großbuchstaben umgewandelt.
- Österreich: genau „ATU“ + 8 Ziffern (z. B. ATU12345678).
- Andere Länder: zweistelliges Länderkürzel + 2 bis 13 Buchstaben oder Ziffern.

Leere Felder werden als „nicht angegeben“ gespeichert, nicht als leerer Text. Führende und nachfolgende Leerzeichen werden entfernt.

**Wer darf was:**
| Rolle | Sehen | Bearbeiten | Wo |
|---|---|---|---|
| Inhaber | ja | ja, alle Felder | *Einstellungen → Kunde* (bisheriges Namensformular wird erweitert) |
| Betreiber | ja, für jeden Kunden | ja, alle Felder inkl. Kundenname; bei deaktivierten Kunden nur lesen | Kunden-Detailseite, neuer Abschnitt „Stammdaten“ ganz oben |
| Mitarbeiter | nein | nein | kein Zugang (Einstellungen bleiben „Seite nicht gefunden“) |

**Anzeige außerhalb des Formulars:**
- Seitenleiste und Kopfzeile: unverändert nur der Kundenname.
- Kundenübersicht des Betreibers: unter dem Namen klein der Ort, falls angegeben. Die Suche bleibt auf den Namen beschränkt.

## User Stories
- Als **Inhaber** möchte ich Adresse, UID, Steuernummer und Registernummer meines Unternehmens hinterlegen, damit sie später auf Berichten und Exporten richtig erscheinen.
- Als **Inhaber** möchte ich eine zweite Namenszeile erfassen, damit der vollständige Firmenwortlaut (z. B. Rechtsform oder „z. H.“) abgebildet wird.
- Als **Betreiber** möchte ich die Stammdaten jedes Kunden einsehen und bearbeiten, damit ich beim Onboarding die Daten selbst eintragen oder Fehler korrigieren kann.
- Als **Betreiber** möchte ich den Kundennamen auf der Detailseite ändern können, ohne mich als Inhaber anmelden zu müssen.
- Als **Betreiber** möchte ich in der Kundenübersicht den Ort sehen, damit ich ähnlich klingende Kunden unterscheiden kann.
- Als **Inhaber oder Betreiber** möchte ich gewarnt werden, wenn jemand anders die Daten inzwischen geändert hat, damit ich dessen Änderung nicht unbemerkt überschreibe.

## Out of Scope
- Online-Prüfung der UID über das EU-System VIES (eigenes Paket bei Bedarf)
- Formatprüfung von Steuernummer, Registernummer und Postleitzahl
- Stammdaten schon beim Anlegen eines Kunden erfassen (Anlegen bleibt: nur Name + Einladung, PROJ-5)
- Zugang oder Leseansicht für Mitarbeiter
- Anzeige der zweiten Namenszeile in Seitenleiste/Kopfzeile
- Suche oder Filter nach Ort, UID oder anderen neuen Feldern in der Kundenübersicht
- Verwendung der Daten auf Berichten, Gästeblatt oder Exporten (kommt mit PROJ-16, PROJ-26 und weiteren Paketen)
- Weitere Kundendaten wie Bankverbindung, Kontaktperson, Telefon, E-Mail, Logo (spätere Arbeitspakete)
- Pflichtfeld-Hinweise in anderen Funktionen, wenn Stammdaten fehlen (gehört in die jeweilige Funktion)
- Benachrichtigung des Inhabers, wenn der Betreiber Daten ändert (sichtbar nur über das Protokoll)

## Acceptance Criteria

### Inhaber
- [ ] Angenommen ein Inhaber öffnet *Einstellungen → Kunde*, wenn die Seite lädt, dann sieht er Kundenname, Namenszeile 2, Adresszeile 1 und 2, Postleitzahl, Ort, Staat, UID, Steuernummer und Registernummer mit den gespeicherten Werten
- [ ] Angenommen für den Kunden ist noch kein Staat gespeichert, wenn das Formular geöffnet wird, dann ist „Österreich“ vorausgewählt
- [ ] Angenommen ein Inhaber füllt nur den Kundennamen aus, wenn er speichert, dann wird gespeichert und eine Erfolgsmeldung erscheint
- [ ] Angenommen ein Inhaber leert den Kundennamen, wenn er speichert, dann erscheint beim Kundennamen eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen ein Inhaber ändert Felder, wenn er speichert, dann sind die neuen Werte nach dem Neuladen der Seite sichtbar und ein geänderter Kundenname erscheint sofort in Seitenleiste bzw. „Mehr“
- [ ] Angenommen ein Inhaber leert ein optionales Feld, wenn er speichert, dann ist das Feld danach leer (nicht angegeben)
- [ ] Angenommen ein Mitarbeiter ruft *Einstellungen → Kunde* auf, wenn die Seite lädt, dann erhält er „Seite nicht gefunden“
- [ ] Angenommen ein Mitarbeiter versucht, die Stammdaten auf anderem Weg als über die Oberfläche zu ändern, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt und nichts geändert

### Betreiber
- [ ] Angenommen der Betreiber öffnet die Detailseite eines aktiven Kunden, wenn die Seite lädt, dann steht ganz oben der Abschnitt „Stammdaten“ mit demselben Formular wie beim Inhaber, inklusive Kundenname
- [ ] Angenommen der Betreiber ändert Stammdaten oder den Kundennamen eines aktiven Kunden, wenn er speichert, dann sind die Änderungen gespeichert und auch für den Inhaber sichtbar
- [ ] Angenommen ein Kunde ist deaktiviert, wenn der Betreiber dessen Detailseite öffnet, dann sind die Stammdaten nur lesbar und es gibt keine Speichern-Schaltfläche
- [ ] Angenommen ein Kunde ist deaktiviert, wenn eine Änderung der Stammdaten beim Server ankommt, dann wird sie abgelehnt
- [ ] Angenommen der Betreiber legt einen neuen Kunden an, wenn das Formular erscheint, dann fragt es wie bisher nur Name und E-Mail ab
- [ ] Angenommen bei einem Kunden ist ein Ort gespeichert, wenn der Betreiber die Kundenübersicht öffnet, dann steht der Ort klein unter dem Kundennamen
- [ ] Angenommen bei einem Kunden ist kein Ort gespeichert, wenn der Betreiber die Kundenübersicht öffnet, dann steht unter dem Namen nichts (kein Platzhalter)
- [ ] Angenommen der Betreiber sucht in der Kundenübersicht nach einem Ort, wenn er den Ort eingibt, dann findet die Suche nur Kunden, deren Name passt (Suche weiterhin nur nach Name)

### Validierung
- [ ] Angenommen jemand gibt als UID „atu 1234 5678“ ein, wenn gespeichert wird, dann wird „ATU12345678“ gespeichert
- [ ] Angenommen jemand gibt als UID „ATU1234567“ (nur 7 Ziffern) ein, wenn gespeichert wird, dann erscheint bei der UID eine verständliche Fehlermeldung mit Beispiel und nichts wird gespeichert
- [ ] Angenommen jemand gibt als UID „DE123456789“ ein, wenn gespeichert wird, dann wird sie akzeptiert
- [ ] Angenommen jemand gibt als UID „123456789“ (ohne Länderkürzel) ein, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen jemand gibt bei Steuernummer oder Registernummer mehr als 30 Zeichen ein, wenn gespeichert wird, dann erscheint eine Fehlermeldung bzw. die Eingabe ist auf 30 Zeichen begrenzt
- [ ] Angenommen jemand gibt eine Registernummer „FN 123456a“ ein, wenn gespeichert wird, dann wird sie unverändert gespeichert
- [ ] Angenommen jemand gibt in einem Feld nur Leerzeichen ein, wenn gespeichert wird, dann gilt das Feld als nicht angegeben (beim Kundennamen: Fehlermeldung)
- [ ] Angenommen die Höchstlänge eines Feldes wird überschritten, wenn gespeichert wird, dann erscheint beim Feld eine Fehlermeldung und die übrigen Eingaben bleiben erhalten

### Gleichzeitiges Bearbeiten und Protokoll
- [ ] Angenommen Betreiber und Inhaber haben die Stammdaten gleichzeitig geöffnet und der Inhaber hat bereits gespeichert, wenn der Betreiber speichert, dann erhält er den Hinweis „Die Kundendaten wurden inzwischen geändert“ und seine Änderung wird nicht gespeichert
- [ ] Angenommen der Hinweis auf eine zwischenzeitliche Änderung erscheint, wenn der Nutzer „Aktuelle Fassung laden“ wählt, dann zeigt das Formular den aktuellen Stand; bis dahin bleiben seine eigenen Eingaben im Formular stehen
- [ ] Angenommen Stammdaten werden geändert, wenn gespeichert wird, dann steht im Änderungsprotokoll, wer wann welche Felder geändert hat
- [ ] Angenommen der Betreiber öffnet das Protokoll auf der Kunden-Detailseite, wenn dort Stammdaten-Änderungen stattgefunden haben (durch Inhaber oder Betreiber), dann sind diese dort zu sehen

### Allgemein
- [ ] Angenommen das Speichern schlägt fehl (z. B. keine Verbindung), wenn der Nutzer speichert, dann erscheint eine Fehlermeldung und alle Eingaben bleiben erhalten
- [ ] Angenommen das Formular wird auf einem Handy (375 px Breite) geöffnet, wenn der Nutzer es ausfüllt, dann sind alle Felder ohne seitliches Scrollen bedienbar
- [ ] Angenommen ein Inhaber eines Kunden A, wenn er versucht, die Stammdaten von Kunde B zu lesen oder zu ändern, dann wird das abgelehnt (Mandantentrennung)
- [ ] Angenommen ein bestehender Kunde ohne neue Daten, wenn das Feature eingespielt wird, dann bleiben Name und alle bisherigen Daten unverändert und die neuen Felder sind leer

## Edge Cases
- **Bestehende Kunden:** haben alle neuen Felder leer; das Formular zeigt beim Staat „Österreich“ vorausgewählt, gespeichert wird der Staat erst beim nächsten Speichern.
- **Staat leeren:** Der Staat kann bewusst auf „nicht angegeben“ zurückgesetzt werden (z. B. wenn keine Adresse erfasst ist).
- **UID passt nicht zum Staat:** z. B. Staat Deutschland, UID ATU…: wird akzeptiert (Holding im Ausland o. ä.), keine Querprüfung.
- **Kundenname wie ein anderer Kunde:** Beim Umbenennen gibt es keine Dublettenprüfung, weder für Inhaber noch für Betreiber (wie bisher beim Inhaber). Die Dublettenwarnung beim Anlegen (PROJ-5) bleibt unverändert.
- **Kunde wird während der Bearbeitung deaktiviert:** Speichern durch Betreiber oder Inhaber wird abgelehnt, mit verständlicher Meldung.
- **Inhaber verliert während der Bearbeitung die Inhaberrolle:** Speichern wird abgelehnt.
- **Zwei Inhaber desselben Kunden** bearbeiten gleichzeitig: wie Betreiber/Inhaber, Hinweis auf zwischenzeitliche Änderung.
- **Sonderzeichen und Umlaute** (z. B. „Gasthof Müller-Öztürk & Söhne“) werden unverändert gespeichert und angezeigt.
- **Speichern ohne Änderung:** erlaubt, kein Fehler; es entsteht kein überflüssiger Protokolleintrag ohne geänderte Felder.

## Technical Requirements
- Rechte serverseitig durchgesetzt (Inhaber nur eigener Kunde, Betreiber alle Kunden, Mitarbeiter keine Schreibrechte), nicht nur in der Oberfläche
- Validierungsregeln gleich in Oberfläche und Server
- Deutsche Texte über die bestehende i18n-Struktur
- Responsiv ab 375 px Breite

## Open Questions
- [ ] Welche Felder sind für den Abgabebericht (PROJ-16) bzw. das Gästeblatt (PROJ-26) Pflicht? Klärung in den jeweiligen Specs.
- [ ] Welche weiteren Kundendaten kommen in den nächsten Arbeitspaketen (z. B. Bankverbindung, Kontakt, Logo)?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigenes Feature PROJ-28 statt Erweiterung von PROJ-4/PROJ-5 | PROJ-4 und PROJ-5 sind deployed; das Paket ist eigenständig testbar und deploybar | 2026-10-26 |
| Alle neuen Felder optional, nur der Kundenname bleibt Pflicht | Bestehende Kunden haben die Daten nicht; Betreiber kennt beim Anlegen oft nur den Namen; Privatvermieter haben oft keine UID/Registernummer | 2026-10-26 |
| Staat als Auswahlliste (Länderauswahl aus PROJ-7), vorbelegt mit Österreich | Einheitliche Werte für Berichte/Exporte; bekannte Bedienung; fast alle Kunden in Österreich | 2026-10-26 |
| UID nur Formatprüfung (AT: ATU + 8 Ziffern; sonst Länderkürzel + 2–13 Zeichen), keine VIES-Prüfung | Fängt Tippfehler ab, blockiert keine ungewöhnlichen, korrekten Einträge; VIES wäre eigenes Paket | 2026-10-26 |
| Steuernummer und Registernummer frei, max. 30 Zeichen | Formate je Land und Rechtsform zu unterschiedlich | 2026-10-26 |
| Betreiber bearbeitet auf der Detailseite im neuen Abschnitt „Stammdaten“, inklusive Kundenname | Betreiber kann beim Onboarding und bei Korrekturen helfen, ohne Inhaber-Login | 2026-10-26 |
| Anlegen eines Kunden bleibt nur Name + E-Mail | Schnelles Anlegen; Rest trägt Betreiber oder Inhaber danach ein | 2026-10-26 |
| Deaktivierte Kunden: Stammdaten nur lesbar | Konsistent mit Mitgliedern und Einladungen auf der Detailseite (PROJ-5) | 2026-10-26 |
| Mitarbeiter sehen die Stammdaten nicht | Für Buchungen/Kalender nicht nötig; Verwaltung ist Inhabersache (PROJ-4) | 2026-10-26 |
| Schutz vor Überschreiben bei gleichzeitiger Bearbeitung (wie PROJ-7), plus Protokoll | Betreiber und Inhaber bearbeiten nun dieselben Daten von zwei Seiten aus; „letzte gewinnt“ könnte z. B. eine korrigierte UID still verlieren | 2026-10-26 |
| Seitenleiste/Kopfzeile nur Kundenname; Kundenübersicht zeigt zusätzlich den Ort; Suche nur nach Name | Platz am Handy knapp; Ort hilft beim Unterscheiden ähnlicher Kunden; Suche bleibt einfach | 2026-10-26 |
| Keine Dublettenprüfung beim Umbenennen | Entspricht dem bisherigen Verhalten beim Inhaber; Dublettenwarnung nur beim Anlegen | 2026-10-26 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine gemeinsame geschützte Speicherfunktion für Inhaber und Betreiber | Rechte, Aktiv-Prüfung, Konfliktschutz und Protokoll an einer Stelle; keine zwei Wege mit unterschiedlichen Regeln | 2026-10-26 |
| Bisheriges direktes Namens-Update für Inhaber schließen | Sonst ließe sich der Konfliktschutz und das Protokoll umgehen | 2026-10-26 |
| Neue Felder direkt an der Kundentabelle statt eigener Tabelle | Genau ein Datensatz je Kunde; einfaches Lesen; vorhandenes Änderungsprotokoll greift automatisch | 2026-10-26 |
| Konfliktschutz über „zuletzt geändert am“ | Gleiches Verfahren wie bei den Gästen (PROJ-7); Feld existiert schon | 2026-10-26 |
| Stammdaten-Änderungen im Betreiber-Protokoll mit Feldliste (ohne Werte) | Betreiber sieht auf der Detailseite, wer was geändert hat; Werte stehen ohnehin im allgemeinen Änderungsprotokoll | 2026-10-26 |
| Länder als internationaler Code mit vorhandener Länderauswahl | Einheitlich mit den Gästen; deutsche Namen ohne eigene Liste | 2026-10-26 |
| Prüfregeln doppelt: im Formular und in der Datenbank | Sofortige Rückmeldung für Nutzer; Datenbank weist trotzdem fehlerhafte Anfragen ab | 2026-10-26 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Überblick
Kein neues Paket, keine neue Seite. Erweitert werden:
- die bestehende Kundentabelle (neue Felder),
- das Namensformular unter *Einstellungen → Kunde* (wird zum Stammdaten-Formular),
- die Kunden-Detailseite des Betreibers (neuer Abschnitt),
- die Kundenübersicht des Betreibers (Ort unter dem Namen),
- das Betreiber-Protokoll (neuer Eintrag „Stammdaten geändert“).

Inhaber und Betreiber speichern über **dieselbe geschützte Speicherfunktion in der Datenbank**. Sie prüft Rechte, Zustand des Kunden, gleichzeitige Änderungen und schreibt das Protokoll. Dadurch gelten die Regeln an genau einer Stelle, egal wer speichert.

### B) Oberfläche (Komponenten)
```
Einstellungen → Kunde (nur Inhaber)
+-- Stammdaten-Formular (ersetzt das bisherige Namensformular)
    +-- Kundenname (Pflicht)
    +-- Namenszeile 2
    +-- Adresszeile 1, Adresszeile 2
    +-- PLZ | Ort (nebeneinander ab Tablet, untereinander am Handy)
    +-- Staat (Länderauswahl aus PROJ-7, mit „Keine Angabe“)
    +-- UID | Steuernummer | Registernummer
    +-- Hinweis „inzwischen geändert“ + „Aktuelle Fassung laden“ (nur bei Konflikt)
    +-- Speichern

Betreiber → Kunden-Detailseite
+-- NEU ganz oben: Abschnitt „Stammdaten“
|   +-- dasselbe Stammdaten-Formular (bei deaktiviertem Kunden: nur lesbar, ohne Speichern)
+-- Mitglieder, Einladungen, Protokoll, Gefahrenzone (unverändert)
    +-- Protokoll zeigt neu „Stammdaten geändert: UID, Ort“ mit Person und Zeitpunkt

Betreiber → Kundenübersicht
+-- Tabelle: unter dem Namen klein der Ort (falls vorhanden)
+-- Karten (Handy): ebenso
```
- **Ein Formular-Baustein für beide Seiten.** Er bekommt mit, ob er für den Inhaber oder den Betreiber speichert und ob er nur lesbar ist. So sehen beide Seiten gleich aus und haben dieselben Prüfregeln.
- **Länderauswahl:** der vorhandene Baustein aus der Gäste-Datenbank (mit „Keine Angabe“) wird wiederverwendet. Ohne gespeicherten Staat ist „Österreich“ vorausgewählt.
- **Prüfregeln** (Längen, UID-Format, Leerzeichen entfernen, Großschreibung der UID) liegen an einer Stelle und werden in Formular und Server gleich verwendet.

### C) Datenmodell (in Worten)
**Kunde (bestehende Tabelle) bekommt neun optionale Felder:**
- Namenszeile 2 (bis 200 Zeichen)
- Adresszeile 1 und 2 (je bis 200 Zeichen)
- Postleitzahl (bis 10 Zeichen)
- Ort (bis 100 Zeichen)
- Staat (internationaler Ländercode wie bei den Gästen, z. B. AT)
- UID (Format AT: ATU + 8 Ziffern; sonst Länderkürzel + 2–13 Buchstaben/Ziffern; nur Großbuchstaben, keine Leerzeichen)
- Steuernummer, Registernummer (je bis 30 Zeichen)

Leer bedeutet „nicht angegeben“. Die Datenbank prüft Längen und UID-Format zusätzlich selbst, damit auch fehlerhafte Anfragen abgewiesen werden. Bestehende Kunden behalten alle Daten; die neuen Felder sind bei ihnen leer.

**„Zuletzt geändert am“** gibt es am Kunden schon. Es dient als Stand für den Schutz vor gleichzeitigem Überschreiben (wie bei den Gästen).

**Betreiber-Protokoll** bekommt die neue Art „Stammdaten geändert“ und dazu die Liste der geänderten Felder (z. B. „UID, Ort“). Der Eintrag entsteht für Änderungen durch Inhaber und Betreiber. Das allgemeine Änderungsprotokoll aus PROJ-1 hält zusätzlich wie bisher alte und neue Werte fest.

### D) Speichern: eine geschützte Funktion
Ablauf beim Speichern (für Inhaber und Betreiber gleich):
1. **Rechte prüfen:** Inhaber dieses Kunden oder Betreiber-Admin (mit bestätigter Zwei-Faktor-Anmeldung, wie im übrigen Betreiber-Bereich). Mitarbeiter und Inhaber anderer Kunden werden abgewiesen.
2. **Kunde muss aktiv sein**, sonst Meldung „Kunde ist deaktiviert“.
3. **Stand vergleichen:** Hat sich „zuletzt geändert am“ seit dem Öffnen geändert, wird nichts gespeichert und das Formular zeigt „Die Kundendaten wurden inzwischen geändert“.
4. **Werte bereinigen und speichern** (Leerzeichen, UID-Schreibweise, leer = nicht angegeben).
5. **Protokoll:** Nur wenn sich wirklich etwas geändert hat, entsteht ein Eintrag „Stammdaten geändert“ mit den Feldnamen.

Der bisherige direkte Weg, mit dem Inhaber nur den Namen ändern, wird durch diese Funktion ersetzt und danach geschlossen. So gibt es keinen zweiten Weg, der Konfliktschutz und Protokoll umgeht.

### E) Kundenübersicht
Die Übersichtsabfrage des Betreibers liefert zusätzlich den Ort. Suche und Blättern bleiben unverändert (Suche nur nach Name und E-Mail).

### F) Tests
- **Unit-Tests:** Prüfregeln (UID AT/andere Länder/ohne Kürzel, Leerzeichen und Kleinbuchstaben, Längen, nur Leerzeichen = leer).
- **E2E:** Inhaber speichert alle Felder; nur Name; Feld leeren; UID-Fehler; Mitarbeiter „Seite nicht gefunden“ und direkte Änderung abgewiesen; Betreiber bearbeitet inkl. Name; deaktivierter Kunde nur lesbar und Speichern abgewiesen; Ort in der Übersicht; Protokolleintrag; Konflikt Betreiber ↔ Inhaber mit „Aktuelle Fassung laden“; Handy-Breite; axe.
- **Sicherheit:** Inhaber von Kunde A kann Kunde B weder lesen noch ändern; Mitarbeiter kann die Speicherfunktion nicht nutzen.

### G) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- **Neue Felder** an der Kundentabelle mit Prüfregeln.
- **Neue geschützte Speicherfunktion** für Stammdaten (prüft Rolle selbst).
- **Direktes Ändern des Kundennamens durch Inhaber wird geschlossen** (läuft künftig über die Funktion).
- **Betreiber-Protokoll:** neue Eintragsart und Feldliste; Einträge entstehen künftig auch, wenn ein Inhaber speichert (nur über die Funktion, weiterhin nur für den Admin lesbar).
- **Übersichtsabfrage des Betreibers** liefert zusätzlich den Ort.
- Lesen bleibt wie bisher: Mitglieder des Kunden und der Admin. Mitarbeiter könnten die Felder technisch lesen (wie heute den Namen), die Oberfläche zeigt sie ihnen aber nicht.

### Abhängigkeiten (Pakete)
Keine neuen Pakete.

### Umsetzung Frontend (2026-10-26)
- **Gemeinsames Formular** `src/components/tenant/tenant-master-data-form.tsx` für Inhaber (*Einstellungen → Kunde*) und Betreiber (Detailseite, Abschnitt „Stammdaten“ ganz oben). Bei deaktiviertem Kunden sind alle Felder gesperrt, ohne Speichern-Schaltfläche, mit Hinweis.
- **Ersetzt** das bisherige Namensformular (`tenant-name-form.tsx`, `updateTenantName`, `tenantNameSchema` entfernt). Erfolgsmeldung jetzt „Kundendaten gespeichert.“ (E2E PROJ-4 angepasst).
- **Prüfregeln** `src/lib/validation/tenant.ts` und Regeln/Typen `src/lib/tenant-master-data.ts` (UID-Format, Längen, leer = null), Unit-Tests `tenant.test.ts`.
- **Aktionen:** `updateTenantMasterData` (Inhaber) und `adminUpdateTenantMasterData` (Betreiber) rufen beide die Datenbank-Funktion `update_tenant_master_data` über `src/lib/tenant-master-data-save.ts` auf. Fehlercodes: P0016 = inzwischen geändert, P0017 = deaktiviert, P0011 = Kunde weg, 42501 = keine Rechte/Sitzung.
- **Konflikt:** Hinweis mit „Aktuelle Fassung laden“; die Seite setzt den Formular-Schlüssel auf „zuletzt geändert am“, damit nach dem Neuladen der neue Stand erscheint.
- **Kundenübersicht:** Ort klein unter dem Namen (Tabelle und Handy-Karten).
- **Betreiber-Protokoll:** neue Eintragsart `master_data` mit Feldliste („Stammdaten geändert: UID, Ort“).
- **Datentypen** (`src/types/database.ts`) von Hand um die neuen Spalten, `changed_fields`, `city` in der Übersicht und die neue Funktion ergänzt; `/backend` erzeugt sie nach der Migration neu.
- **Offen für /backend:** Migration (Spalten + Prüfregeln, Funktion `update_tenant_master_data`, direktes Namens-Update schließen, `operator_log` um `master_data` und `changed_fields` erweitern, `admin_tenant_overview` liefert `city`). Ohne Migration schlagen die Seiten *Einstellungen → Kunde* und die Betreiber-Detailseite beim Laden fehl.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
