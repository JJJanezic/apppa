# PROJ-3: Authentifizierung

## Status: Deployed
**Created:** 2026-10-15
**Last Updated:** 2026-10-23

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
- **Eigener Mailversand (Brevo)**: deutsche Einladungs- und Reset-Mails von der eigenen Absender-Domain; Domain später austauschbar (behebt BUG-2 aus PROJ-1)
- **Design**: Anmelde-, Einladungs- und Passwortseiten schlicht im Broadsheet-Stil: Papierhintergrund, Wortmarke „apppa.“ mittig, schmales Formular, ohne App-Rahmen; am Handy volle Breite

## Out of Scope
- Kunde und Rolle in der Seitenleiste, Kunden-Auswahl, Rollenfilter der Navigation: PROJ-4 (bis dahin bleiben die Platzhalter aus PROJ-2)
- Personen einladen: PROJ-4 (Team) und PROJ-5 (Kunden durch den Betreiber). PROJ-3 behandelt nur das Annehmen
- Selbstregistrierung: ausgeschlossen (PROJ-1); später PROJ-21
- E-Mail-Adresse selbst ändern: Änderung durch den Betreiber in PROJ-5
- 2FA für Inhaber und Mitarbeiter (weder Pflicht noch freiwillig)
- „Angemeldet bleiben“-Häkchen
- Anmeldung mit Google/Microsoft, Magic Link, Passkeys
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

- [ ] Angenommen eine Einladung oder ein Passwort-Reset wird ausgelöst, wenn die Mail ankommt, dann ist sie deutsch, kommt von der eigenen Absender-Domain und ihr Link führt auf die Bestätigungsseite der App

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
- [x] Eigener Mailversand → Brevo, wird mit PROJ-3 eingerichtet (domainunabhängig, Wechsel per Konfiguration) (geklärt 2026-10-15)
- [x] Sperre nach Fehlversuchen → eigene Zählung je Konto, Supabase kann nur pro IP begrenzen (geklärt 2026-10-15)
- [x] Runbook-Anleitung „2FA-Notfall-Reset für den Admin“ → `docs/runbooks/supabase.md` Abschnitt 9 (erledigt 2026-10-15)
- [x] Gültigkeit der Mail-Links → 24 h für Einladung und Reset (Supabase kennt nur eine gemeinsame Dauer, max. 24 h) (geklärt 2026-10-15)
- [x] Absender-Adresse für Brevo → `no-reply@apppa.at` (eigene Produkt-Domain `apppa.at`, geklärt 2026-10-17; zuvor `janezic.at` erwogen, dort nicht eingerichtet). Ein späterer Wechsel ist vorgesehen: Code und `config.toml` sind domainunabhängig, die Adresse kommt beim `config push` als Umgebungsvariable (Runbook Abschnitt 8)

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
| Mail-Absender `no-reply@apppa.at` (Name „apppa“) | Eigene Produkt-Domain statt persönlicher Domain; trennt App-Mails von der privaten/beruflichen Mail | 2026-10-17 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Supabase Auth für Konten, Passwörter, Mail-Links und 2FA; App ergänzt nur Lücken | Bewährt, schon in PROJ-1 eingerichtet; kein Eigenbau sicherheitskritischer Teile | 2026-10-15 |
| Eigener Mailversand Brevo; Absender/Domain nur in Supabase-Einstellungen | Voraussetzung für eigene Vorlagen (Bestätigungsseite, deutsche Mails); Domain-Wechsel ohne Code-Änderung | 2026-10-15 |
| Mail-Links führen auf `/bestaetigen`; eingelöst wird erst per Knopf (Formular-Absendung) | Linkscanner rufen nur auf, drücken keine Knöpfe (BUG-3 PROJ-1) | 2026-10-15 |
| Anmelde-Aktionen als Server Actions | Fehlversuche zählen, neutrale Meldungen, Passwortmanager-tauglich | 2026-10-15 |
| Eigene Tabelle für Fehlversuche (E-Mail nur als Hash, nur Server), Sperre 5/15 min, Löschung nach 24 h | Supabase begrenzt nur pro IP, nicht pro Konto; Datensparsamkeit | 2026-10-15 |
| Sitzungsgrenzen (30 Tage, 8 h) über zwei geschützte Cookies in `src/proxy.ts`; in Produktion zusätzlich Supabase-Einstellungen | Supabase-Sitzungsbegrenzung nur im Pro-Tarif; Entwicklung läuft im Gratis-Tarif | 2026-10-15 |
| Zugangsschutz in Proxy + App-Rahmen (Server) + RLS | Mehrere Ebenen; ein Fehler an einer Stelle öffnet keine Daten | 2026-10-15 |
| Admin-2FA über Sitzungsstufe aal2; ohne Gerät Pflicht-Einrichtung, sonst Code-Abfrage | Setzt die PROJ-1-Regel durch; zweites Gerät als zweiter TOTP-Faktor | 2026-10-15 |
| Aktuelles Passwort serverseitig prüfen, danach andere Sitzungen beenden | Supabase verlangt es nicht selbst; Schutz bei übernommener Sitzung | 2026-10-15 |
| Gültigkeit Einladungs- und Reset-Links 24 h | Supabase hat nur eine gemeinsame Dauer, max. 24 h | 2026-10-15 |
| shadcn Input OTP für die Code-Eingabe | Barrierefrei, Einfügen aus Zwischenablage; Projektregel shadcn zuerst | 2026-10-15 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-3 braucht **Frontend und Backend**. Die Anmeldung selbst übernimmt Supabase Auth (Konten, Passwörter, Mail-Links, 2FA per Authenticator-App). Die App ergänzt, was Supabase nicht von sich aus kann: die Bestätigungsseite vor dem Einlösen von Mail-Links, die Sperre nach Fehlversuchen, die Sitzungsgrenzen auf jedem Tarif und die Pflicht-2FA für den Admin. Alle Anmelde-Schritte laufen auf dem Server, damit Fehlversuche gezählt und Regeln durchgesetzt werden können.

### A) Seiten und Bausteine
```
Anmelde-Bereich (eigener schlichter Rahmen: Papierhintergrund, Wortmarke „apppa.“, schmales Formular)
+-- /anmelden                 E-Mail, Passwort (mit „anzeigen“), „Anmelden“, Link „Passwort vergessen?“
+-- /passwort-vergessen       E-Mail → neutrale Bestätigung
+-- /bestaetigen              Bestätigungsseite für Mail-Links: Knopf „Einladung annehmen“ bzw. „Neues Passwort festlegen“
|                             (erst der Klick löst den Link ein; abgelaufene Links → Meldung + „Neuen Link anfordern“)
+-- /einladung/abschliessen   Anzeigename + Passwort (zweimal), Passwortregeln sichtbar
+-- /passwort-neu             neues Passwort (zweimal)
+-- /2fa                      6-stelliger Code nach dem Passwort (nur Admin)
+-- /2fa/einrichten           Pflicht-Einrichtung für den Admin: QR-Code + Schlüssel zum Abtippen + erster Code

App-Bereich (Rahmen aus PROJ-2, nur angemeldet)
+-- /konto „Mein Konto“
|   +-- E-Mail (nur Anzeige), Anzeigename ändern
|   +-- Passwort ändern (aktuelles + neues zweimal)
|   +-- „Auf allen Geräten abmelden“ (mit Bestätigungsdialog)
|   +-- nur Admin: 2FA-Geräte (Liste, „Gerät hinzufügen“, „Entfernen“, letztes Gerät gesperrt)
+-- Benutzermenü: „Mein Konto“ und „Abmelden“ werden aktiv
+-- Seitenleiste / „Mehr“: echter Anzeigename; Dashboard: „Guten Morgen, <Vorname>.“

Gemeinsame Bausteine
+-- Passwortfeld mit „anzeigen/verbergen“ und sichtbaren Regeln
+-- 6-stellige Code-Eingabe (shadcn „Input OTP“)
+-- Formulare mit shadcn Form/Input/Button/Label, Prüfung mit Zod (schon installiert)
```

### B) Daten (in Worten)

**Konten, Passwörter, Sitzungen und 2FA-Geräte** verwaltet Supabase Auth. Der Anzeigename steht im Profil aus PROJ-1 (darf von der Person selbst geändert werden).

**Neu: Anmeldeversuche** (nur für den Server lesbar, für keine App-Rolle sichtbar)
- Kennung des Kontos: die E-Mail-Adresse nur als nicht umkehrbarer Hashwert (keine Klartext-Adressen von Nicht-Kunden in der Datenbank)
- Art des Versuchs: Passwort oder 2FA-Code
- Zeitpunkt
- Nur Fehlversuche werden gespeichert. Ein erfolgreicher Login löscht die Fehlversuche des Kontos
- Regel: 5 Fehlversuche in 15 Minuten → 15 Minuten gesperrt (auch für richtige Passwörter)
- Einträge älter als 24 Stunden löscht der tägliche Zeitplaner (wie beim Änderungsprotokoll)

**Sitzungsgrenzen:** Zwei geschützte, nur vom Server lesbare Cookies merken sich den Beginn der Sitzung und die letzte Aktivität. Die Vorschaltung (`src/proxy.ts`) prüft sie bei jedem Seitenaufruf: älter als 30 Tage oder 8 Stunden ohne Aktivität → abmelden und zur Anmeldeseite.

### C) Technische Entscheidungen (begründet)

**Eigener Mailversand über Brevo, domainunabhängig eingerichtet.** Nur mit eigenem Mailversand erlaubt Supabase eigene Mail-Vorlagen. Erst damit zeigen die Links auf unsere Bestätigungsseite statt auf eine Supabase-Adresse, die schon beim Aufruf einlöst (Linkscanner, BUG-3), und erst damit sind die Mails deutsch (BUG-2). Absender-Adresse, Absender-Name und Zugangsdaten stehen ausschließlich in den Supabase-Einstellungen (Zugangsdaten als geheime Variable, nie im Code). Die Vorlagen verwenden nur die Platzhalter für die App-Adresse. **Ein späterer Domain-Wechsel** ist damit reine Konfiguration: neue Domain bei Brevo bestätigen (DNS), Absender in Supabase ändern, App-Adresse und erlaubte Weiterleitungen anpassen. Das Runbook bekommt dafür eine Schritt-für-Schritt-Anleitung.

**Mail-Links: Aufruf zeigt nur, Klick löst ein.** Die Links aus Einladungs- und Reset-Mails führen auf die Bestätigungsseite und tragen den Einmal-Schlüssel nur mit. Eingelöst wird er erst, wenn die Person den Knopf drückt (Formular-Absendung). Linkscanner rufen Seiten nur auf, sie drücken keine Knöpfe. Die bisherige Route `/auth/confirm` leitet dafür nur noch weiter; die geprüfte Absicherung gegen fremde Weiterleitungsziele (BUG-1/9) wird wiederverwendet.

**Alle Anmelde-Aktionen auf dem Server (Server Actions).** Anmelden, Code prüfen, Passwort ändern usw. laufen als Server-Aktionen. Nur so kann die App Fehlversuche zählen, bevor Supabase gefragt wird, und Meldungen bewusst neutral halten. Die Formulare funktionieren dadurch auch mit Passwortmanagern.

**Sperre nach Fehlversuchen selbst zählen.** Supabase begrenzt Anmeldungen nur pro IP-Adresse, nicht pro Konto. Die App zählt deshalb selbst je Konto (Tabelle oben). Gilt für Passwort und 2FA-Code.

**Sitzungsgrenzen in der App statt nur bei Supabase.** Die Sitzungsbegrenzung von Supabase („timebox“, „inactivity timeout“) gibt es nur im Pro-Tarif. Die Entwicklung läuft im Gratis-Tarif. Deshalb prüft die App die Grenzen selbst über die zwei Cookies; in der Produktion (Pro) werden zusätzlich die Supabase-Einstellungen gesetzt (doppelte Absicherung).

**Zugangsschutz doppelt.** Die Vorschaltung leitet nicht angemeldete Aufrufe zur Anmeldeseite (mit Rücksprung-Adresse, nur innerhalb der App). Zusätzlich prüft der App-Rahmen auf dem Server noch einmal die Sitzung, bevor er Daten lädt. Die Datenbank-Regeln aus PROJ-1 sind die dritte Ebene.

**Pflicht-2FA für den Admin über die Sitzungsstufe.** Nach dem Passwort prüft der Server: Ist die Person Admin? Hat sie schon ein Gerät? Ohne Gerät → `/2fa/einrichten`, mit Gerät → `/2fa`. Andere Seiten sind bis dahin gesperrt. Erst die bestätigte Sitzung (aal2) gibt die Admin-Rechte aus PROJ-1 frei. Zweites Gerät = zweiter Authenticator-Faktor bei Supabase. Das letzte Gerät lässt sich in der App nicht entfernen.

**Passwort ändern mit Prüfung des aktuellen Passworts.** Supabase verlangt das alte Passwort nicht von sich aus. Die Server-Aktion prüft es zuerst (zählt bei Fehlern zur Sperre) und beendet nach dem Ändern alle anderen Sitzungen; ebenso nach einem Passwort-Reset.

**Gültigkeit der Mail-Links: 24 Stunden für beide.** Supabase kennt nur eine gemeinsame Gültigkeitsdauer für Einladungs- und Reset-Links (höchstens 24 Stunden). Der Vorschlag „Einladung 7 Tage“ ist damit nicht möglich. Läuft eine Einladung ab, schickt der Einladende einfach eine neue (PROJ-4/5).

**Einladung bei schon angemeldeter anderer Person:** Beim Einlösen wird die bisherige Sitzung beendet, mit Hinweis.

**Texte deutsch in `messages/de.json`, Formulare mit react-hook-form + Zod** (beides vorhanden). Weiterleitungen nach dem Login nutzen `safeRedirectPath` aus PROJ-1.

### D) Abhängigkeiten (Pakete)
- shadcn-Baustein **Input OTP** (`npx shadcn add input-otp`, bringt das Paket `input-otp` mit): 6-stellige Code-Eingabe, barrierefrei, mit Einfügen aus der Zwischenablage
- Sonst nichts Neues: Supabase-Pakete, Zod, react-hook-form, shadcn Form/Input/Button/Dialog sind vorhanden. Der QR-Code für die 2FA kommt fertig von Supabase

### E) Einrichtung außerhalb des Codes (Runbook, mit dem Nutzer)
1. Brevo-Konto anlegen, Absender-Domain bestätigen (DNS-Einträge SPF, DKIM, DMARC)
2. SMTP-Zugang von Brevo in Supabase hinterlegen; Absender z. B. `no-reply@<domain>`, Name „apppa“
3. Deutsche Vorlagen für Einladung, Passwort-Reset und Passwort-geändert-Hinweis aktivieren (Links auf `/bestaetigen`)
4. Gültigkeit der Links 24 h; Mail-Grenzen anpassen
5. Anleitung „Domain wechseln“ und „2FA-Notfall-Reset für den Admin“

### F) Prüfung (für /qa)
- Unit-Tests: Sperrlogik (Zählen, Ablauf nach 15 min), Sitzungsgrenzen (30 Tage, 8 h), Formularprüfung, Vorname aus Anzeigename
- Integrationstests gegen „apppa-dev“: Einladung (Link aufrufen löst nicht ein, Klick schon), Passwort-Reset, Sperre, Admin ohne 2FA bekommt keine Admin-Rechte, andere Sitzungen nach Passwortänderung beendet
- E2E (Playwright, Chrome): Anmelden/Abmelden, Rücksprung nach Login, Mein Konto, Barrierefreiheit (axe), Handy-Breite

## Implementation Notes (Frontend)
_Stand 2026-10-15 (/frontend)_

**Seiten** (`src/app/(auth)/`, eigener schlichter Rahmen ohne App-Navigation): `/anmelden` (mit Hinweis `?grund=abgemeldet|sitzung-abgelaufen` und Rücksprung `?next=`), `/passwort-vergessen`, `/bestaetigen` (Knopf löst den Link erst beim Klick ein; ungültig/fehlend → Meldung, bei Reset „Neuen Link anfordern“), `/einladung/abschliessen`, `/passwort-neu`, `/2fa` (mit „Mit einem anderen Konto anmelden“), `/2fa/einrichten`. Im App-Rahmen: `/konto` („Mein Konto“)

**Bausteine** (`src/components/auth/`): `auth-card`, `password-input` (anzeigen/verbergen, 44-px-Knopf), `password-rules` (Regeln vorab sichtbar, erfüllte markiert, für Screenreader „erfüllt/fehlt“), `new-password-fields`, `form-error` (Alert mit `role="alert"`, `callAction` fängt Netzwerkfehler ab), `otp-input` (shadcn Input OTP, `autocomplete="one-time-code"`), `otp-form`, `mfa-enrollment` (QR-Code von Supabase, Schlüssel mit Kopier-Knopf, erster Code), `confirm-link`, Formulare für Login, Passwort vergessen, Einladung, neues Passwort, 2FA. Konto (`src/components/account/`): `display-name-form`, `change-password-form`, `sign-out-everywhere` (Bestätigungsdialog), `mfa-devices` (nur Admin; Entfernen beim letzten Gerät gesperrt; „Gerät hinzufügen“ im Detail-Panel)

**Logik**: `src/lib/validation/auth.ts` (Zod-Schemas für Browser und Server, Passwortregel aus PROJ-1, E-Mail-Normalisierung, `firstNameOf()`), `src/lib/auth/result.ts` (einheitliches Ergebnis mit neutralen Fehlercodes), `src/lib/account.ts` (Platzhalter für Kontodaten)

**Server-Aktionen als Schnittstelle**: `src/app/(auth)/actions.ts` und `src/app/(app)/konto/actions.ts` mit festgelegten Signaturen; liefern bis /backend `notImplemented` („Diese Funktion wird gerade eingerichtet.“)

**App-Rahmen**: Benutzermenü mit aktivem „Mein Konto“ (Link) und „Abmelden“ (Server-Aktion, danach Vollständiger Seitenwechsel auf `/anmelden?grund=abgemeldet`)

**Design**: Eingabefeld-Rahmen auf `neutral-600` (3,9:1 auf Papier, vorher 1,3:1) für WCAG 1.4.11; alle Bedienelemente mind. 44 px; Texte in `messages/de.json` (`auth`, `account`)

**Neu**: shadcn `input-otp` (Paket `input-otp`)

**Tests**: `src/lib/validation/auth.test.ts` (26). `npm test` 132/132, E2E PROJ-2 57/57, `tsc` und Build fehlerfrei. Sichtprüfung in Chrome (1440 und 375 px): alle Seiten ohne waagrechtes Scrollen, Titel „<Seite> · apppa“

**Offen für /backend**: alle Server-Aktionen, `getAccountInfo()` und `getShellInfo()` mit echten Daten, Zugangsschutz (Proxy + Rahmen), Sitzungsgrenzen, Fehlversuchs-Tabelle, Pflicht-2FA-Weiterleitung, `/auth/confirm` → `/bestaetigen`, Brevo + deutsche Mail-Vorlagen, Runbook

## Implementation Notes (Backend)
_Stand 2026-10-15 (/backend)_

**Datenbank** (eingespielt in „apppa-dev“): `20261015120000_login_failures.sql`: Tabelle `public.login_failures` (Konto nur als HMAC-Hash der E-Mail, Art `password|mfa`, Zeitpunkt). RLS an, keine Rechte für `anon`/`authenticated`, nur `service_role`; tägliche Löschung > 24 h per pg_cron (`purge-login-failures`). `20261015120100_login_failures_deny_policy.sql`: ausdrückliche restriktive „Kein Zugriff“-Policy (Advisor 0008). Typen neu erzeugt.

**Server-Bausteine** (`src/lib/auth/`):
- `lockout-rules.ts` (reine Regel: 5 Fehlversuche in 15 min → 15 min ab dem letzten) + `lockout.ts` (Hash, lesen/schreiben/löschen über Secret Key). Passwort- und Code-Fehlversuche zählen gemeinsam je Konto. Fällt die Tabelle aus, bleibt die Anmeldung möglich (Supabase-IP-Grenze greift weiter)
- `session-limits.ts`: **ein** signiertes httpOnly-Cookie `apppa-sitzung` (Konto, Beginn, letzte Aktivität, HMAC). Abweichung vom Entwurf (zwei Cookies), gleiche Wirkung. Fehlendes, manipuliertes oder fremdes Cookie = abgelaufen. Aktivität wird höchstens einmal pro Minute fortgeschrieben
- `session.ts`: `getSessionUser()` (getClaims + Profil, einmal pro Anfrage), `pendingMfaStep()` (Admin ohne aal2 → `/2fa` bzw. `/2fa/einrichten`), `requireAppUser()`, Start/Ende der Sitzungsgrenzen
- `mfa.ts`: Code prüfen (alle bestätigten Geräte, mit Sperre) und Gerät anlegen (räumt unbestätigte Geräte auf). Bewusst keine Server-Aktionen, damit sie nicht ohne Berechtigungsprüfung aufrufbar sind
- *Ergänzt 2026-10-25:* `mfa-issuer.ts` vergibt den Namen des Eintrags in der Authenticator-App je Supabase-Projekt: Produktion „apppa“, Staging „apppa Staging“, sonst „apppa Dev“. Abgeleitet wird er aus der Projekt-Ref in `NEXT_PUBLIC_SUPABASE_URL`, eine neue Variable ist nicht nötig. Er gilt nur für Geräte, die danach eingerichtet werden; bestehende Einträge behalten „apppa“
- HMAC-Schlüssel werden aus `SUPABASE_SECRET_KEY` abgeleitet, also **keine neue Umgebungsvariable**. Ein Schlüsselwechsel meldet alle ab

**Zugangsschutz** (3 Ebenen): `src/lib/supabase/proxy.ts` prüft die Sitzungsgrenzen (abgelaufen → abmelden, `/anmelden?grund=sitzung-abgelaufen&next=…`), leitet ohne Sitzung zur Anmeldung (mit Rücksprung) und Angemeldete von `/anmelden` zum Dashboard. Öffentlich sind nur `/anmelden`, `/passwort-vergessen`, `/bestaetigen`, `/auth/confirm`. Server-Aktionen und `/api/*` leitet der Proxy nicht um. Dazu kommt der App-Rahmen `(app)/layout.tsx` mit `requireAppUser()` (inkl. Pflicht-2FA des Admins), als dritte Ebene RLS. `/2fa`, `/2fa/einrichten` und `/passwort-neu` prüfen serverseitig, ob der Schritt passt (Admin mit Gerät muss vor dem neuen Passwort den Code bestätigen, da Supabase sonst aal2 verlangt)

**Server-Aktionen** (alle umgesetzt, Eingaben serverseitig mit denselben Zod-Schemas geprüft):
- `signIn`: Sperre → Supabase → bei Fehler Fehlversuch zählen, neutrale Meldung; Erfolg: Zähler löschen, Sitzungsgrenzen starten, Admin → `/2fa?next=…` bzw. `/2fa/einrichten`
- `requestPasswordReset`: immer neutral; eigener Client ohne PKCE, damit der Link auch in einem anderen Browser funktioniert
- `confirmEmailLink`: erst per Knopf, meldet eine andere angemeldete Person vorher ab
- `completeInvite`, `setNewPassword` (danach andere Sitzungen beenden), `verifyMfa`, `startMfaEnrollment` (nur Admin ohne Gerät), `confirmMfaEnrollment`, `signOut`
- Konto: `updateDisplayName`, `changePassword` (aktuelles Passwort mit separatem Client ohne Cookies prüfen; Fehler zählt zur Sperre; danach andere Sitzungen beenden), `signOutEverywhere` (global), `startAddMfaDevice`/`confirmAddMfaDevice`/`removeMfaDevice` (nur Admin mit aal2; letztes Gerät gesperrt)
- Neue Fehlercodes `sessionExpired` (→ `callAction` leitet zur Anmeldung mit Rücksprung) und `weakPassword` (Datenleck-Prüfung in Produktion)

**Daten für Oberfläche**: `getShellInfo()` liefert Anzeigename und Vorname, `getAccountInfo()` E-Mail, Name, Admin-Kennzeichen und bestätigte 2FA-Geräte (über getUser, nicht aus dem Cookie)

**`/auth/confirm`** löst nicht mehr ein, sondern leitet nur auf `/bestaetigen` weiter (nur `invite`/`recovery`, ohne `next`)

**Mails**: Vorlagen `invite.html`, `recovery.html` (Links auf `/bestaetigen`, Du-Form wie die App) und neu `password_changed.html`. `config.toml`: Brevo-SMTP (`smtp-relay.brevo.com:587`), Absender/Login/Schlüssel nur als `env(SUPABASE_AUTH_SMTP_SENDER|USER|PASS)`, Vorlagen aktiv, Linkdauer 24 h (`otp_expiry = 86400`), `email_sent = 30`/h. **Noch nicht übertragen**: `config push` führt der Betreiber mit den Brevo-Daten aus (Runbook Abschnitt 8)

**Runbook** (`docs/runbooks/supabase.md`): 8 Brevo einrichten + Domain wechseln, 9 2FA-Notfall-Reset, 10 Anmelde-Sperre; Produktion: Supabase-Sitzungsgrenzen (Pro) zusätzlich setzen

**Tests**: Unit `lockout-rules.test.ts` (5), `session-limits.test.ts` (9), `auth/confirm/route.test.ts` (neu, 8). Integration gegen „apppa-dev“ `supabase/tests/auth-flows.integration.test.ts`: Sperre mit echter Tabelle, Tabelle für App-Rollen gesperrt, Link-Aufruf löst nicht ein und Klick nur einmal, Einladungslink, „andere abmelden“ nach Passwortänderung. `npm test` 152/152, `tsc` und Build fehlerfrei, Security-Advisor nur „Leaked Password Protection“ (Pro-Tarif, Runbook Produktion). Rauchtest: `/`, `/konto`, `/2fa`, `/einladung/abschliessen` ohne Sitzung → `/anmelden?next=…`; `/auth/confirm?…&next=//evil.com` → `/bestaetigen` ohne `next`

**Hinweise für /qa**: Die E2E-Tests aus PROJ-2 brauchen jetzt eine Anmeldung (Test-Fixture mit Testnutzer anlegen). `npm run lint` ist im Projekt nicht lauffähig (`next lint` gibt es in Next 16 nicht mehr, keine `eslint.config`), das ist ein bestehender Mangel und nicht Teil von PROJ-3

**Bugfixes nach QA (2026-10-23, /backend)**
- **BUG-1 behoben:** `src/lib/supabase/proxy.ts` prüft die Sitzung mit `getUser()` statt `getClaims()`. Nur die Nachfrage bei Supabase erkennt widerrufene Sitzungen (nach „Überall abmelden“, Passwortänderung, Reset). Supabase löscht dann die Sitzungs-Cookies für Anfrage und Antwort; die Person landet auf `/anmelden?…&grund=sitzung-abgelaufen`. Kosten: eine Anfrage an Supabase pro Seitenaufruf mit Sitzung (ohne Sitzung keine). Server-Seiten und -Aktionen nutzen weiter `getClaims()`, weil der Proxy dieselbe Anfrage schon geprüft hat
- **BUG-3 behoben:** Sicherheitsheader in `next.config.ts` für alle Pfade: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security` (2 Jahre, includeSubDomains), `Permissions-Policy` (Kamera, Mikrofon, Standort aus)
- **BUG-4 behoben:** Der Proxy nimmt nur `POST` mit `next-action` von der Weiterleitung aus
- **BUG-2 behoben (/frontend):** `confirm-link-form.tsx` wertet `signedOutOther` aus und hängt `?hinweis=abgemeldet` an; `/einladung/abschliessen` und `/passwort-neu` zeigen dann „Die bisherige Anmeldung in diesem Browser wurde beendet.“ Neuer Baustein `src/components/auth/auth-notice.tsx` (Hinweis mit `role="status"`, auch auf `/anmelden` verwendet). E2E-Test „andere Person im selben Browser angemeldet“ grün
- Tests: `src/lib/supabase/proxy.test.ts` (6, u. a. widerrufene Sitzung, gefälschter Header), `src/lib/security-headers.test.ts` (6), Integrationstest weist nach, dass ein widerrufenes Token per Signatur gültig bleibt, Supabase es aber ablehnt. `npm test` 164/164. E2E Desktop: alle Anmelde-, Sitzungs-, Einladungs-, Reset-, Konto-, 2FA- und Design-Tests grün außer BUG-2; zwei Tests mussten wegen der Supabase-Grenze pro IP (30 Link-Bestätigungen in 5 Minuten, durch viele Testläufe hintereinander) wiederholt werden. Tablet und Handy: alle Tests grün. PROJ-2-Test „Seitenleiste bleibt beim Scrollen stehen“ wartet jetzt, bis React die Seite übernommen hat (veränderte die Seite vorher zu früh → Neuaufbau, unzuverlässig); `tests/zz-debug.spec.ts` (versehentlich in 58f736e) entfernt

## QA Test Results

**Tested:** 2026-10-23
**App URL:** http://localhost:3000 (Dev-Server) gegen Supabase „apppa-dev“
**Tester:** QA Engineer (AI)
**Browser:** Google Chrome (Playwright, `channel: 'chrome'`) in 1440, 768 und 375 px. Firefox und Safari nicht getestet (kein Browser-Download in dieser Umgebung, wie PROJ-2)

**Automatische Tests**
- `npm test`: 152/152 grün (Unit + Integration gegen „apppa-dev“)
- `npm run test:e2e`: 102 grün, **4 rot** (= BUG-1 dreifach, BUG-2), 73 übersprungen (Abläufe laufen nur im Projekt „desktop“, um die Supabase-Grenzen pro IP zu schonen)
- Neu: `tests/PROJ-3-authentifizierung.spec.ts`. Testnutzer `test-e2e-*@example.com` werden pro Test angelegt und gelöscht; Mail-Links kommen aus `admin.generateLink`, es werden keine Mails verschickt. Sitzungen für Tests, die nicht das Login prüfen, werden per Cookie gesetzt (`tests/support/supabase.ts`)
- PROJ-2-E2E angepasst: Seit PROJ-3 ist Anmeldung Pflicht. Ein Setup-Projekt meldet einen gemeinsamen Testnutzer an (`tests/auth.setup.ts`, Löschung in `tests/auth.teardown.ts`), erwartet werden jetzt Name und Begrüßung „…, Erika.“. Alle PROJ-2-Tests grün in allen drei Breiten

### Acceptance Criteria Status

#### Anmelden
- [x] Richtige Daten → Dashboard (E2E)
- [x] Falsches Passwort und unbekanntes Konto → dieselbe Meldung, E-Mail bleibt stehen, Passwort wird geleert (E2E)
- [x] Leere Felder/ungültige Adresse → Hinweis am Feld, keine Server-Anfrage (E2E)
- [x] 5 Fehlversuche → Sperre „in 15 Minuten“, auch mit richtigem Passwort (E2E + Integration)
- [x] Ohne Anmeldung → `/anmelden?next=…`, danach zurück zur Seite (E2E)
- [x] Angemeldet auf `/anmelden` → Dashboard (E2E)
- [x] Doppelklick → genau eine Anfrage (E2E)

#### Sitzung und Abmelden
- [x] Abmelden → Anmeldeseite mit Hinweis; Zurück zeigt keine App-Daten (E2E)
- [x] 8 h ohne Aktivität → neu anmelden mit Hinweis, danach zurück zur Seite (E2E)
- [x] 30 Tage → neu anmelden (Unit-Test `session-limits.test.ts`; im Browser nicht ohne Uhr-Manipulation prüfbar)
- [x] „Auf allen Geräten abmelden“ beendet alle Sitzungen sofort (E2E; war BUG-1, behoben)

#### Einladung annehmen
- [x] Link zeigt Seite mit Knopf, noch nicht eingelöst (E2E)
- [x] Linkscanner (GET auf `/auth/confirm` und `/bestaetigen`) verbraucht den Link nicht (E2E + Integration)
- [x] Name + Passwort → aktiv, angemeldet, Dashboard mit „…, Johanna.“ (E2E)
- [x] Passwortregel/Wiederholung → konkrete Meldung, Regeln vorab sichtbar (E2E)
- [x] Name leer → Meldung; > 200 Zeichen lassen sich nicht eingeben (maxLength), Server prüft zusätzlich (E2E)
- [x] Benutzter Link → „nicht mehr gültig“ mit Hinweis auf neue Einladung (E2E)
- [x] Mail deutsch und vom eigenen Absender: an einer echten Mail bestätigt (Hinweis „Passwort geändert“ von `apppa <no-reply@apppa.at>`, deutsch; 2026-10-23). Link auf die Bestätigungsseite: per Vorlage (`<site_url>/bestaetigen?token_hash=…&type=…`) und E2E-Aufruf derselben Adresse geprüft, an einer echten Einladungs-/Reset-Mail noch nicht gesehen → bei der ersten echten Einladung kurz kontrollieren. Zustellung: landet bei M365-Empfängern derzeit in der Quarantäne

#### Passwort vergessen und zurücksetzen
- [x] Immer dieselbe neutrale Bestätigung (E2E, unbekannte Adresse, dreimal hintereinander)
- [x] Link zeigt zuerst „Neues Passwort festlegen“, erst der Klick löst ein (E2E)
- [x] Neues Passwort → Dashboard, andere Sitzungen sofort beendet (E2E; war BUG-1, behoben)
- [x] Abgelaufener/benutzter Link → Meldung mit „Neuen Link anfordern“ (E2E)
- [x] Sehr viele Anforderungen → Meldung bleibt neutral (E2E); Mail-Grenze greift bei Supabase (1 Mail/min je Adresse, 30/h), per Konfiguration geprüft

#### Mein Konto
- [x] E-Mail (nicht änderbar), Anzeigename, Passwort, „Auf allen Geräten abmelden“; keine 2FA-Verwaltung für Nicht-Admins (E2E)
- [x] Neuer Name sofort in der Seitenleiste + Bestätigung (E2E)
- [x] Falsches aktuelles Passwort → abgelehnt (E2E)
- [x] Neues Passwort aktiv, andere Sitzungen sofort beendet (E2E; war BUG-1, behoben)

#### 2FA für den Betreiber-Admin
- [x] Admin ohne Gerät → Pflicht-Einrichtung (QR-Code + Schlüssel + erster Code), andere Seiten gesperrt (E2E)
- [x] Danach Code-Abfrage nach dem Passwort, erst dann Dashboard (E2E)
- [x] Falscher Code → Meldung; 5 Fehlversuche → Sperre (E2E)
- [x] Zweites Gerät mit Code bestätigt, beide funktionieren (E2E: Anmeldung mit Code des zweiten Geräts)
- [x] Letztes Gerät nicht entfernbar, mit Hinweis (E2E)
- [x] Nicht-Admin: keine 2FA, keine 2FA-Verwaltung (E2E)

#### App-Rahmen
- [x] Anzeigename in Seitenleiste bzw. „Mehr“, „Mein Konto“ und „Abmelden“ aktiv (E2E, alle Breiten)
- [x] Begrüßung mit Vorname (E2E, alle Breiten)

#### Design und Barrierefreiheit
- [x] Anmeldeseiten mit Wortmarke, schmalem Formular, ohne Navigation, ohne waagrechtes Scrollen (E2E, 1440/768/375)
- [x] Felder beschriftet, Fehlermeldungen per `aria-describedby` zugeordnet und vorgelesen (`role="alert"`), Passwortmanager-Attribute (`username`, `current-password`, `new-password`, `one-time-code`); axe WCAG 2.1 AA ohne Befund auf allen Anmeldeseiten (E2E)
- [x] Passwort anzeigen/verbergen (E2E)

### Edge Cases Status
- [x] Linkscanner: siehe oben
- [x] Einladung bei angemeldeter anderer Person: wird abgemeldet, mit Hinweis (E2E; war BUG-2, behoben)
- [x] Einladung angenommen, Browser vor Passwort geschlossen: benutzter Link → „nicht mehr gültig“ (E2E); „Passwort vergessen?“ funktioniert für das Konto (Code-Review)
- [x] Reset-Link in anderem Browser: funktioniert (Links ohne PKCE; E2E nutzt frischen Browser)
- [x] 2FA-Notfall-Reset: Runbook Abschnitt 9 (Code-Review)
- [x] Falsche Handy-Uhr: Hinweis unter dem Code-Feld (E2E-Snapshot)
- [x] Netzwerkfehler: einheitliche Meldung über `callAction` (Code-Review)
- [x] Sitzung läuft während Formular ab: `sessionExpired` → Anmeldung mit Hinweis und Rücksprung (Code-Review; Weiterleitung selbst per E2E für Seitenaufrufe geprüft)
- [ ] Konto gelöscht/deaktiviert: gelöscht → neutrale Meldung (wie unbekanntes Konto, E2E); deaktiviert erst mit PROJ-5 prüfbar
- [x] Person ohne Mitgliedschaft: Anmeldung funktioniert, leere Bereiche (alle E2E-Testnutzer haben keine Mitgliedschaft)
- [x] Rücksprung nur innerhalb der App: `//evil…`, `https://evil…`, `/\evil…` → Dashboard (E2E)
- [x] E-Mail mit Großbuchstaben/Leerzeichen wird normalisiert (E2E)

### Security Audit Results
- [x] Zugangsschutz: alle App-Seiten ohne Sitzung → Anmeldung (Proxy), zusätzlich App-Rahmen auf dem Server
- [x] Widerrufene Sitzungen werden sofort abgewiesen (Proxy prüft mit `getUser`; war BUG-1, behoben)
- [x] Admin ohne Code (aal1): keine Admin-Rechte (RLS, PROJ-1-Tests), alle App-Seiten → 2FA; Konto-Aktionen für 2FA-Geräte verlangen aal2
- [x] Sperre zählt pro Konto (Hash), auch für unbekannte Adressen; Meldungen neutral; Supabase-Grenze pro IP zusätzlich
- [x] Mail-Links nur per Knopf; ungültiger Typ/Token → neutrale Meldung
- [x] Open Redirect: geprüft (siehe Edge Cases)
- [x] Sitzungs-Cookie `apppa-sitzung`: httpOnly, HMAC-signiert; fehlend/manipuliert → abgemeldet (E2E + Unit)
- [x] Tabelle `login_failures` für App-Rollen gesperrt (Integration)
- [x] Server-Aktionen: Hilfsfunktionen ohne Berechtigungsprüfung sind nicht exportiert (`src/lib/auth/mfa.ts`); jede Aktion prüft Sitzung bzw. Admin/aal2
- [x] Kein geheimer Schlüssel im Browser-Code (`.next/static` durchsucht)
- [x] Sicherheitsheader gesetzt (X-Frame-Options, frame-ancestors, nosniff, Referrer-Policy, HSTS, Permissions-Policy; war BUG-3, behoben)
- [x] Gefälschter `next-action`-Header bei GET → Weiterleitung zur Anmeldung (war BUG-4, behoben)
- Hinweis (bewusst akzeptiert): Wer eine Kundenadresse kennt, kann das Konto durch 5 Fehlversuche 15 min sperren. Folge der Sperre je Konto (Spec-Entscheidung)

### Bugs Found

#### BUG-1: Abgemeldete Geräte bleiben bis zu 1 Stunde angemeldet — ✅ behoben (Nachprüfung 2026-10-23)
- **Severity:** High
- **Steps to Reproduce:**
  1. Mit demselben Konto in zwei Browsern anmelden (A und B)
  2. In A: „Mein Konto“ → „Überall abmelden“ (oder Passwort ändern, oder Passwort über Reset-Link neu setzen)
  3. In B eine App-Seite neu laden
  4. Expected: B landet auf der Anmeldeseite
  5. Actual: B bleibt angemeldet und sieht weiter Daten, bis sein Zugangstoken abläuft (Supabase-Standard 1 h)
- **Ursache:** Proxy und `getSessionUser()` prüfen das Token nur per Signatur (`getClaims`). Supabase widerruft bei `signOut` nur die Sitzung bzw. das Refresh-Token; das bereits ausgestellte Zugangstoken bleibt gültig. Nachgewiesen: Nach `signOut({ scope: 'others' })` liefert `getClaims` für B weiter gültige Claims, `getUser` dagegen „Auth session missing“
- **Betroffen:** AC „Auf allen Geräten abmelden“, „andere Sitzungen beendet“ nach Reset und nach Passwortänderung; Grundidee „Handy verloren“
- **Priority:** Fix before deployment

#### BUG-2: Kein Hinweis, wenn beim Annehmen einer Einladung eine andere Person abgemeldet wurde — ✅ behoben (Nachprüfung 2026-10-23)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Als Person A anmelden
  2. Im selben Browser einen Einladungslink für Person B öffnen und „Einladung annehmen“ wählen
  3. Expected: Seite „Willkommen bei apppa“ mit Hinweis „Die bisherige Anmeldung in diesem Browser wurde beendet.“
  4. Actual: A ist korrekt abgemeldet, aber ohne Hinweis. `confirmEmailLink` liefert `signedOutOther`, `confirm-link-form.tsx` wertet es nicht aus
- **Priority:** Fix before deployment

#### BUG-3: Sicherheitsheader fehlen — ✅ behoben (Nachprüfung 2026-10-23)
- **Severity:** Medium
- **Steps to Reproduce:** `curl -I http://localhost:3000/anmelden` → keine `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` (Projektregel `.claude/rules/security.md`)
- **Folge:** Anmeldeseite lässt sich in fremde Seiten einbetten (Clickjacking)
- **Priority:** Fix before deployment (passt auch zu `/deploy`)

#### BUG-4: Proxy-Weiterleitung per gefälschtem Header umgehbar — ✅ behoben (Nachprüfung 2026-10-23)
- **Severity:** Low
- **Steps to Reproduce:** `curl -H 'next-action: x' http://localhost:3000/einladung/abschliessen` ohne Sitzung → 200 mit Formular statt Weiterleitung. `/` und `/konto` leiten trotzdem um (App-Rahmen), Aktionen prüfen die Sitzung selbst; es werden keine Daten sichtbar
- **Vorschlag:** Ausnahme nur für `POST` mit `next-action`
- **Priority:** Fix in next sprint

### Nachprüfung (Re-Test 2026-10-23)
Nach `eed7997` (BUG-1, 3, 4), `203c281` (Testfix) und `d31bf50` (BUG-2):
- `npm test`: 164/164 grün
- E2E (in Paketen, Chrome): Desktop PROJ-3 40/40, PROJ-2 21/21; Tablet 25/25; Handy 24/24 (jeweils ohne die bewusst übersprungenen breitenspezifischen Tests)
- Sicherheit am laufenden Server: alle Sicherheitsheader vorhanden; gefälschter `next-action`-Header bei GET → Weiterleitung auf allen geschützten Seiten; `?hinweis=<script>…` wird nicht ausgegeben (fester Text nur bei `abgemeldet`); erfundene Sitzungs-Cookies → `/anmelden?…&grund=sitzung-abgelaufen`
- Supabase-Security-Advisor: nur bekannte, bewusst akzeptierte Punkte: „OTP long expiry“ (Mail-Links 24 h, Spec-Entscheidung) und „Leaked Password Protection“ (nur Pro-Tarif, im Runbook für die Produktion)
- Hinweis Leistung: Der Proxy fragt Supabase jetzt bei jedem Seitenaufruf mit Sitzung (BUG-1-Fix); ohne Sitzung ~20 ms lokal. In Produktion Vercel-Region nahe eu-west-1 wählen (`/deploy`)
- Hinweis Tests: Supabase begrenzt Link-Bestätigungen auf 30 pro 5 min und IP. Viele E2E-Läufe direkt hintereinander können daran scheitern; Testlauf in Paketen bzw. später wiederholen
- Kleinigkeit (kein Bug): Muss der Admin vor dem neuen Passwort erst den 2FA-Code eingeben, geht der Hinweis „bisherige Anmeldung beendet“ auf dem Umweg über `/2fa` verloren

### Summary
- **Acceptance Criteria:** 38/38 bestanden (Mail-Link an echter Einladungs-/Reset-Mail noch zu sehen, siehe oben)
- **Bugs Found:** 4 im ersten Durchlauf (1 high, 2 medium, 1 low), alle behoben und nachgeprüft; keine neuen
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Freigeben. Vor dem Pilotstart die Mail-Zustellung klären (Quarantäne bei M365, Ruf der neuen Domain `apppa.at`) und den offenen Mail-Prüfpunkt abhaken
## Deployment
_Stand 2026-10-25 (/deploy, erstes Release über Staging, Tag `v1.0.0`)_

- **Staging:** https://staging.apppa.at (Vercel `apppa-staging`, Supabase `iikzjqjjxoznrkkixfqa`). Freigegeben nach Prüfung von Anmeldung mit 2FA, Betreiber-Bereich, Einladung, Team und Wohnungen
- **Production:** https://app.apppa.at (Vercel `apppa`, Supabase `ahclrqbhfpidxjzbpfgb`), Commit `cedd560`, 2026-10-25
- **Migrationen:** alle 13 bis `20261024140200_apartments_fk_indexes.sql` in Staging und Production eingespielt (2026-10-24), Advisors ohne Befund. Im Release selbst gab es keine neuen
