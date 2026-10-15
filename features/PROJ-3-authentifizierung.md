# PROJ-3: Authentifizierung

## Status: Planned
**Created:** 2026-10-15
**Last Updated:** 2026-10-15

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup): Login-Konten, Einladung nur per Mail, Passwortregel (mind. 10 Zeichen, a-z/A-Z/0-9), 2FA-Pflicht für den Admin, Admin-Kennzeichen, Route `/auth/confirm` mit Schutz vor Open Redirect
- Requires: PROJ-2 (App-Shell & Design-System): Rahmen, Benutzermenü („Mein Konto“, „Abmelden“), Grundbausteine, Texte in `messages/de.json`, Design „Broadsheet“
- Behebt: BUG-3 aus PROJ-1 (Mail-Linkscanner verbrauchen den Einmal-Link)
- Liefert an: PROJ-4 (Kunde und Rolle zur angemeldeten Person), PROJ-5 (Admin-Bereich setzt eine 2FA-bestätigte Sitzung voraus)

## User Stories
- Als **eingeladene Person** möchte ich die Einladung mit einem Klick annehmen und meinen Namen und mein Passwort festlegen, damit ich sofort mit der App arbeiten kann.
- Als **Vermieter oder Mitarbeiter** möchte ich mich mit E-Mail-Adresse und Passwort anmelden und angemeldet bleiben, damit ich die App am Handy ohne ständiges Neuanmelden nutzen kann.
- Als **Person, die ihr Passwort vergessen hat**, möchte ich es per E-Mail-Link selbst zurücksetzen, damit ich nicht auf den Betreiber warten muss.
- Als **Betreiber-Admin** möchte ich mein Konto zwingend mit einem zweiten Faktor schützen und ein Ersatzgerät hinterlegen, damit ein gestohlenes Passwort allein keinen Zugriff auf die Daten aller Kunden erlaubt.
- Als **angemeldete Person** möchte ich unter „Mein Konto“ meinen Namen und mein Passwort ändern und mich auf allen Geräten abmelden können, z. B. nachdem ich mein Handy verloren habe.
- Als **Vermieter** möchte ich, dass niemand ohne Anmeldung Daten in der App sieht und dass Angreifer Passwörter nicht beliebig durchprobieren können.
- Als **Person, die einen alten oder schon benutzten Link öffnet**, möchte ich eine verständliche Meldung und einen Weg zu einem neuen Link, statt einer Fehlerseite.

## Umfang dieses Features
- **Anmeldeseite** (`/anmelden`): E-Mail, Passwort, „Anmelden“, Link „Passwort vergessen?“
- **Einladung annehmen**: Der Mail-Link öffnet eine Bestätigungsseite mit dem Knopf „Einladung annehmen“; erst der Klick löst die Einladung ein. Danach Anzeigename und Passwort (zweimal) festlegen, anschließend angemeldet weiter zum Dashboard
- **Passwort vergessen / zurücksetzen**: E-Mail eingeben → neutrale Bestätigung → Mail-Link → Bestätigungsseite mit Knopf → neues Passwort (zweimal) → angemeldet weiter zum Dashboard
- **Abmelden** über das Benutzermenü (PROJ-2)
- **Mein Konto** (`/konto`): Anzeigename ändern, Passwort ändern (mit aktuellem Passwort), „Auf allen Geräten abmelden“; nur für den Admin zusätzlich die Verwaltung der 2FA-Geräte
- **2FA für den Betreiber-Admin**: Pflicht-Einrichtung beim ersten Login (QR-Code + Bestätigungscode), Code-Abfrage bei jedem Login, optional ein zweites Gerät
- **Zugangsschutz**: Alle App-Seiten nur angemeldet; ohne Anmeldung Weiterleitung zur Anmeldeseite und nach dem Login zurück zur ursprünglich gewünschten Seite
- **Sitzung**: angemeldet bleiben bis zum Abmelden, höchstens 30 Tage; nach 8 Stunden ohne Nutzung neu anmelden
- **Schutz vor Durchprobieren**: neutrale Fehlermeldungen; nach 5 Fehlversuchen in 15 Minuten wird das Konto für 15 Minuten gesperrt
- **App-Rahmen mit echten Daten**: Name der angemeldeten Person statt Platzhalter; „Mein Konto“ und „Abmelden“ werden aktiv
- **Design**: Anmelde-, Einladungs- und Passwortseiten schlicht im Broadsheet-Stil: Papierhintergrund, Wortmarke „apppa.“ mittig, schmales Formular, ohne App-Rahmen; am Handy volle Breite

## Out of Scope
- Kunde und Rolle in der Seitenleiste, Kunden-Auswahl, Rollenfilter der Navigation: PROJ-4 (bis dahin bleiben die Platzhalter aus PROJ-2)
- Personen einladen: PROJ-4 (Team) und PROJ-5 (Kunden durch den Betreiber). PROJ-3 behandelt nur das Annehmen
- Selbstregistrierung: ausgeschlossen (PROJ-1); später PROJ-21
- E-Mail-Adresse selbst ändern: Änderung durch den Betreiber in PROJ-5
- 2FA für Inhaber und Mitarbeiter (weder Pflicht noch freiwillig)
- „Angemeldet bleiben“-Häkchen
- Anmeldung mit Google/Microsoft, Magic Link, Passkeys
- Deutsche Einladungs- und Reset-Mails: hängen am eigenen Mailversand (BUG-2 aus PROJ-1). Bis dahin englische Supabase-Mails
- Wiederherstellungscodes für die 2FA (Ersatz: zweites Gerät oder Notfall-Reset per Runbook)
- Konto löschen durch die Person selbst
- Admin-Bereich selbst: PROJ-5

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Anmelden
- [ ] Angenommen eine Person hat ein aktives Konto, wenn sie korrekte E-Mail und Passwort eingibt und „Anmelden“ wählt, dann ist sie angemeldet und landet auf dem Dashboard
- [ ] Angenommen E-Mail oder Passwort sind falsch oder das Konto existiert nicht, wenn die Person sich anmelden will, dann erscheint immer dieselbe Meldung „E-Mail-Adresse oder Passwort ist falsch.“ und das Formular behält die E-Mail-Adresse
- [ ] Angenommen ein Feld ist leer oder die E-Mail-Adresse hat kein gültiges Format, wenn die Person „Anmelden“ wählt, dann erscheint am Feld eine Hinweismeldung, ohne dass eine Anmeldung versucht wird
- [ ] Angenommen es gab 5 Fehlversuche für ein Konto innerhalb von 15 Minuten, wenn erneut versucht wird, sich anzumelden, dann wird der Versuch abgelehnt mit dem Hinweis, es in 15 Minuten erneut zu versuchen, auch bei richtigem Passwort
- [ ] Angenommen eine Person ist nicht angemeldet, wenn sie eine App-Seite aufruft (z. B. `/` oder `/konto`), dann wird sie zur Anmeldeseite geleitet und nach erfolgreicher Anmeldung zur gewünschten Seite zurückgebracht
- [ ] Angenommen eine Person ist bereits angemeldet, wenn sie die Anmeldeseite aufruft, dann wird sie zum Dashboard weitergeleitet
- [ ] Angenommen die Anmeldung läuft, wenn die Person den Knopf mehrfach drückt, dann wird nur ein Versuch gesendet und der Knopf zeigt einen Ladezustand

### Sitzung und Abmelden
- [ ] Angenommen eine Person ist angemeldet, wenn sie im Benutzermenü „Abmelden“ wählt, dann ist sie abgemeldet, landet auf der Anmeldeseite, und ein Zurück im Browser zeigt keine App-Daten mehr
- [ ] Angenommen eine Person war 8 Stunden nicht aktiv, wenn sie die App wieder benutzt, dann muss sie sich neu anmelden und kommt danach zur zuletzt gewünschten Seite zurück
- [ ] Angenommen eine Person ist seit 30 Tagen durchgehend angemeldet, wenn sie die App benutzt, dann muss sie sich neu anmelden, auch wenn sie zwischendurch aktiv war
- [ ] Angenommen eine Person ist auf mehreren Geräten angemeldet, wenn sie unter „Mein Konto“ „Auf allen Geräten abmelden“ bestätigt, dann sind alle Sitzungen beendet, auch die aktuelle

### Einladung annehmen
- [ ] Angenommen eine Person hat eine gültige Einladungsmail, wenn sie den Link öffnet, dann sieht sie die Seite „Einladung annehmen“ mit einem Knopf; die Einladung ist dabei noch nicht eingelöst
- [ ] Angenommen ein Linkscanner (z. B. Outlook Safe Links) hat den Link vorab aufgerufen, wenn die Person danach den Link öffnet und „Einladung annehmen“ wählt, dann funktioniert die Einladung trotzdem
- [ ] Angenommen die Person hat „Einladung annehmen“ gewählt, wenn sie Anzeigenamen und zweimal ein regelkonformes Passwort eingibt, dann ist das Konto aktiv, sie ist angemeldet und landet auf dem Dashboard
- [ ] Angenommen das Passwort erfüllt die Regeln nicht oder die beiden Eingaben stimmen nicht überein, wenn die Person speichert, dann erscheint eine konkrete Meldung; die Passwortregeln sind schon vor der Eingabe sichtbar
- [ ] Angenommen der Anzeigename ist leer oder länger als 200 Zeichen, wenn die Person speichert, dann erscheint eine Meldung am Feld
- [ ] Angenommen der Einladungslink ist abgelaufen oder schon benutzt, wenn die Person ihn öffnet oder den Knopf wählt, dann erscheint die Meldung, dass der Link nicht mehr gültig ist, mit dem Hinweis, sich vom Einladenden einen neuen Link schicken zu lassen

### Passwort vergessen und zurücksetzen
- [ ] Angenommen eine Person wählt „Passwort vergessen?“, wenn sie ihre E-Mail-Adresse eingibt und absendet, dann erscheint immer „Falls ein Konto mit dieser Adresse existiert, haben wir dir eine E-Mail geschickt.“, egal ob das Konto existiert
- [ ] Angenommen die Person öffnet den Link aus der Reset-Mail, wenn die Seite lädt, dann erscheint zuerst ein Knopf „Neues Passwort festlegen“; erst der Klick löst den Link ein
- [ ] Angenommen der Link ist eingelöst, wenn die Person zweimal ein regelkonformes neues Passwort eingibt, dann ist das Passwort geändert, alle anderen Sitzungen sind beendet und sie ist angemeldet auf dem Dashboard
- [ ] Angenommen der Reset-Link ist abgelaufen oder schon benutzt, wenn die Person ihn öffnet, dann erscheint eine verständliche Meldung mit „Neuen Link anfordern“
- [ ] Angenommen jemand fordert sehr oft hintereinander Reset-Mails für dieselbe Adresse an, wenn das Limit erreicht ist, dann wird keine weitere Mail verschickt und die Meldung bleibt neutral

### Mein Konto
- [ ] Angenommen eine Person ist angemeldet, wenn sie im Benutzermenü „Mein Konto“ wählt, dann sieht sie ihre E-Mail-Adresse (nicht änderbar), ihren Anzeigenamen und die Bereiche „Passwort ändern“ und „Auf allen Geräten abmelden“
- [ ] Angenommen die Person ändert ihren Anzeigenamen, wenn sie speichert, dann erscheint der neue Name sofort in der Seitenleiste bzw. im „Mehr“-Blatt, und eine Hinweis-Meldung bestätigt die Änderung
- [ ] Angenommen die Person ändert ihr Passwort, wenn das aktuelle Passwort falsch ist, dann wird die Änderung abgelehnt
- [ ] Angenommen die Person ändert ihr Passwort mit korrektem aktuellen und regelkonformem neuen Passwort, wenn sie speichert, dann ist das neue Passwort aktiv und alle anderen Sitzungen sind beendet

### 2FA für den Betreiber-Admin
- [ ] Angenommen ein Admin-Konto hat noch keine 2FA, wenn sich der Admin mit Passwort anmeldet, dann muss er vor jeder anderen Seite die Einrichtung durchlaufen: QR-Code (und Schlüssel zum Abtippen) mit einer Authenticator-App einlesen, ersten Code eingeben
- [ ] Angenommen die Einrichtung ist abgeschlossen, wenn sich der Admin künftig anmeldet, dann wird nach dem Passwort ein 6-stelliger Code abgefragt; erst danach ist er angemeldet und hat Admin-Rechte
- [ ] Angenommen der eingegebene Code ist falsch oder abgelaufen, wenn der Admin ihn absendet, dann erscheint eine Meldung, und nach 5 Fehlversuchen gilt dieselbe Sperre wie beim Passwort
- [ ] Angenommen der Admin ist angemeldet, wenn er unter „Mein Konto“ ein zweites Gerät hinzufügt, dann muss er es mit einem Code bestätigen; danach funktionieren beide Geräte
- [ ] Angenommen der Admin hat nur noch ein Gerät, wenn er versucht, es zu entfernen, dann ist das nicht möglich, mit dem Hinweis, zuerst ein anderes Gerät hinzuzufügen
- [ ] Angenommen eine Person ist kein Admin, wenn sie sich anmeldet, dann wird keine 2FA verlangt und „Mein Konto“ zeigt keine 2FA-Verwaltung

### App-Rahmen
- [ ] Angenommen eine Person ist angemeldet, wenn der Rahmen angezeigt wird, dann steht in Seitenleiste bzw. „Mehr“-Blatt ihr Anzeigename statt „Name folgt mit dem Login“, und „Mein Konto“ und „Abmelden“ sind aktiv
- [ ] Angenommen eine Person ist angemeldet, wenn das Dashboard lädt, dann begrüßt es sie mit ihrem Vornamen (erstes Wort des Anzeigenamens), z. B. „Guten Morgen, Johanna.“

### Design und Barrierefreiheit
- [ ] Angenommen die Anmelde-, Einladungs- oder Passwortseite wird geöffnet, wenn sie angezeigt wird, dann steht mittig die Wortmarke „apppa.“ über einem schmalen Formular auf Papierhintergrund, ohne Seitenleiste und Navigation, am Handy in voller Breite ohne waagrechtes Scrollen
- [ ] Angenommen eine Formularseite, wenn sie per Tastatur und Screenreader bedient wird, dann sind alle Felder beschriftet, Fehlermeldungen werden vorgelesen und dem Feld zugeordnet, und der Passwortmanager des Browsers füllt E-Mail und Passwort aus
- [ ] Angenommen ein Passwortfeld, wenn die Person „Passwort anzeigen“ wählt, dann wird das Passwort im Klartext angezeigt und lässt sich wieder verbergen

## Edge Cases
- Linkscanner von Microsoft 365 öffnen den Mail-Link vorab per GET: Der Link wird erst durch den Klick auf der Bestätigungsseite eingelöst (behebt BUG-3 aus PROJ-1)
- Einladungslink wird geöffnet, während bereits jemand anderes im selben Browser angemeldet ist: Die bisherige Person wird abgemeldet, bevor die Einladung angenommen wird, mit einem Hinweis
- Einladung angenommen, aber die Person schließt den Browser vor dem Festlegen des Passworts: Beim nächsten Öffnen des (benutzten) Links → „nicht mehr gültig“; über „Passwort vergessen?“ kann sie trotzdem ein Passwort setzen
- Reset-Link in einem anderen Browser bzw. Gerät geöffnet als angefordert: funktioniert trotzdem
- Admin verliert sein einziges 2FA-Gerät: Zurücksetzen per Runbook direkt in Supabase (Anleitung wird ergänzt)
- Uhrzeit am Handy des Admins geht falsch: Codes werden abgelehnt; die Meldung weist darauf hin, die automatische Uhrzeit des Handys zu prüfen
- Netzwerkfehler beim Absenden eines Formulars: verständliche Meldung, Eingaben bleiben erhalten (außer Passwörter)
- Sitzung läuft ab, während ein Formular geöffnet ist: Beim Absenden Weiterleitung zur Anmeldung mit Hinweis, danach zurück zur Seite
- Konto wurde inzwischen gelöscht oder (mit PROJ-5) deaktiviert: Anmeldung schlägt mit der neutralen Meldung fehl bzw. mit dem Hinweis, sich an den Betreiber zu wenden
- Person ohne Mitgliedschaft bei einem Kunden meldet sich an (z. B. der Betreiber-Admin): Anmeldung funktioniert, die App zeigt die leeren Bereiche (Details mit PROJ-4/PROJ-5)
- Die Weiterleitung nach dem Login zeigt nur auf Seiten der App, nie auf fremde Adressen (Schutz aus PROJ-1 wiederverwenden)
- E-Mail-Adresse mit Großbuchstaben oder Leerzeichen am Rand: wird beim Anmelden normalisiert

## Technical Requirements
- Sicherheit: Alle App-Seiten und Daten nur mit gültiger Sitzung; Prüfung auf dem Server, nicht nur im Browser
- Sicherheit: Neutrale Meldungen (keine Rückschlüsse auf bestehende Konten); Sperre nach 5 Fehlversuchen in 15 Minuten für 15 Minuten (Passwort und 2FA-Code)
- Sicherheit: Mail-Links werden nur per Klick (nicht beim Aufruf) eingelöst; Weiterleitungsziele nur innerhalb der App
- Sitzung: maximal 30 Tage, 8 Stunden Inaktivität
- Passwortregel wie PROJ-1 (mind. 10 Zeichen, Klein- und Großbuchstaben, Ziffer); in Produktion zusätzlich Prüfung gegen geleakte Passwörter
- Barrierefreiheit WCAG 2.1 AA; Passwortmanager-tauglich
- Performance: Anmeldeseite in unter 2 Sekunden nutzbar (4G)

## Open Questions
- [ ] Deutsche Mail-Vorlagen hängen am eigenen Mailversand (BUG-2 aus PROJ-1, Empfehlung Brevo): vor dem Pilotstart klären
- [ ] Lässt sich die Sperre nach 5 Fehlversuchen mit den Bordmitteln von Supabase umsetzen, oder braucht es eine eigene Zählung? (/architecture)
- [ ] Runbook-Anleitung „2FA-Notfall-Reset für den Admin“ ergänzen (/backend)
- [ ] Gültigkeitsdauer von Einladungs- und Reset-Links festlegen (Vorschlag: Einladung 7 Tage, Reset 1 Stunde); abhängig von den Supabase-Einstellungen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Mail-Links öffnen eine Bestätigungsseite; erst der Klick löst den Link ein | Outlook/M365-Linkscanner würden Einmal-Links sonst vorab verbrauchen (BUG-3 PROJ-1); Zielgruppe nutzt häufig Outlook | 2026-10-15 |
| Beim Annehmen der Einladung: Anzeigename + Passwort (zweimal) | Person legt Namen selbst fest; doppelte Eingabe verhindert Tippfehler | 2026-10-15 |
| Sitzung bis zum Abmelden, max. 30 Tage, 8 h Inaktivität; kein „Angemeldet bleiben“ | Bequem am Handy, aber Schutz sensibler Gäste- und Zahlungsdaten; einfacher ohne Häkchen | 2026-10-15 |
| 2FA Pflicht für den Admin beim ersten Login, optional zweites Gerät, Notfall-Reset per Runbook | Admin hat Lesezugriff auf alle Kunden; zweites Gerät senkt das Risiko eines Lock-outs | 2026-10-15 |
| Keine 2FA für Inhaber und Mitarbeiter im MVP | Entscheidung aus PROJ-1; weniger Hürden für Pilotkunden | 2026-10-15 |
| Neutrale Fehlermeldungen; Sperre 15 min nach 5 Fehlversuchen in 15 min | Keine Rückschlüsse auf Kundenadressen; Schutz einzelner Konten vor Durchprobieren | 2026-10-15 |
| „Mein Konto“: Name, Passwort (mit aktuellem Passwort), Abmelden überall, 2FA-Geräte (Admin) | Deckt Alltag und Notfall (verlorenes Handy) ab; E-Mail-Änderung bewusst beim Betreiber | 2026-10-15 |
| Nach Passwortänderung/-reset werden andere Sitzungen beendet | Wer sein Passwort ändert, will meist fremden Zugriff beenden | 2026-10-15 |
| Anmeldeseiten schlicht im Broadsheet-Stil, ohne Druck-Effekt | Kein Entwurf vorhanden; schlicht ist schnell umsetzbar und passt zum Design | 2026-10-15 |
| Begrüßung mit Vorname = erstes Wort des Anzeigenamens | Kein eigenes Vornamensfeld nötig; passt zum Entwurf („Guten Morgen, Johanna.“) | 2026-10-15 |

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
