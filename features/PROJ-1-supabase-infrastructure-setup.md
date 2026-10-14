# PROJ-1: Supabase Infrastructure Setup

## Status: Approved
**Created:** 2026-10-13
**Last Updated:** 2026-10-14

## Dependencies
- Keine. PROJ-1 ist die Grundlage für PROJ-3 bis PROJ-19.

## User Stories
- Als **Betreiber** möchte ich eine getrennte Entwicklungs- und Produktionsumgebung, damit Tests nie echte Gästedaten berühren.
- Als **Vermieter (Inhaber)** möchte ich sicher sein, dass kein anderer Kunde meine Daten sehen oder verändern kann, damit ich der App Gäste- und Zahlungsdaten anvertrauen kann.
- Als **Person mit mehreren Kunden-Mitgliedschaften** möchte ich mit einem Login für mehrere Vermieter arbeiten, jeweils mit eigener Rolle, damit ich keine zweite E-Mail-Adresse brauche.
- Als **Betreiber-Admin** möchte ich lesend auf alle Kundendaten zugreifen können, damit ich Support leisten und Fehler analysieren kann.
- Als **Inhaber** möchte ich nachvollziehen können, wer wann was geändert hat, damit ich Fehler und Streitfälle klären kann.
- Als **Betreiber** möchte ich tägliche Backups der Produktionsdaten, damit ein Datenverlust nicht das Geschäft meiner Kunden gefährdet.
- Als **eingeladene Person** möchte ich mich nur mit einer Einladung registrieren können, damit sich keine Fremden ein Konto anlegen.

## Umfang dieses Features
- Anbindung der App an Supabase, Umgebungsvariablen für Entwicklung und Produktion
- Datenfundament: Mandanten (Kunden), Benutzerprofile, Mitgliedschaften (Person ↔ Mandant mit Rolle Inhaber/Mitarbeiter), Kennzeichnung Betreiber-Admin
- Abschottungsregel: Jede fachliche Tabelle gehört genau einem Mandanten, Zugriff nur für dessen Mitglieder; der Admin hat Lesezugriff auf alles
- Einheitliche Felder für alle Tabellen: angelegt am/von, geändert am/von
- Automatisches Änderungsprotokoll (Mechanismus) für fachliche Tabellen
- Auth-Konfiguration: E-Mail + Passwort, öffentliche Registrierung gesperrt, Einladungs- und Passwort-Reset-Mails (deutsch), 2FA verpflichtend für den Admin
- Einrichtung des ersten Betreiber-Admins
- Backup-Konzept für Produktion

## Out of Scope
- Fachtabellen (Wohnungen, Gäste, Buchungen, Zahlungen …): entstehen mit PROJ-6, PROJ-7, PROJ-8, PROJ-13 usw.
- Login-, Einladungs- und Passwort-Oberflächen: PROJ-3
- Team-Verwaltung und Mandantenwechsel in der Oberfläche: PROJ-4
- Kunden anlegen, einladen, deaktivieren: PROJ-5
- Anzeige des Änderungsprotokolls („Verlauf“): mit den jeweiligen Features
- Eigener Mailversand-Dienst (Brevo o. ä.): später, spätestens vor dem Pilotstart (siehe Open Questions)
- 2FA für Kunden-Nutzer: später
- Social Login (Google/Microsoft), Magic Link
- Supabase Branching, Point-in-Time-Recovery
- Admins in der App ernennen oder entziehen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Umgebungen & Anbindung
- [ ] Angenommen die Umgebungsvariablen sind gesetzt, wenn die App startet, dann verbindet sie sich ohne Fehler mit dem Entwicklungsprojekt „apppa“
- [ ] Angenommen eine Umgebungsvariable fehlt, wenn die App startet oder gebaut wird, dann erscheint eine klare Fehlermeldung, welche Variable fehlt
- [ ] Angenommen eine Datenbankänderung wird vorgenommen, wenn sie in die Entwicklung eingespielt wird, dann ist sie als nachvollziehbare Migration im Repository abgelegt und lässt sich identisch in die Produktion übernehmen
- [ ] Angenommen der Code liegt im Repository, wenn jemand ihn durchsucht, dann enthält er keine geheimen Schlüssel (nur in `.env.local` bzw. Vercel)

### Mandanten & Abschottung
- [ ] Angenommen Nutzer A ist nur Mitglied bei Kunde 1, wenn A Daten von Kunde 2 lesen, anlegen, ändern oder löschen will, dann wird der Zugriff verweigert und es werden keine Daten von Kunde 2 zurückgegeben
- [ ] Angenommen ein Nutzer ist nicht angemeldet, wenn er auf Mandantendaten zugreifen will, dann wird der Zugriff verweigert
- [ ] Angenommen eine Person ist Mitglied bei zwei Kunden mit unterschiedlichen Rollen, wenn sie für Kunde 1 arbeitet, dann gelten ausschließlich ihre Rechte bei Kunde 1
- [ ] Angenommen ein Mitarbeiter ist angemeldet, wenn er Daten ändern will, die nur Inhabern vorbehalten sind, dann wird die Änderung verweigert
- [ ] Angenommen eine Person hat keine Mitgliedschaft, wenn sie sich anmeldet, dann sieht sie keinerlei Mandantendaten

### Betreiber-Admin
- [ ] Angenommen der Betreiber-Admin ist angemeldet, wenn er Daten eines beliebigen Kunden abruft, dann kann er sie lesen
- [ ] Angenommen der Betreiber-Admin ist kein Mitglied eines Kunden, wenn er dessen Daten ändern will, dann wird die Änderung verweigert
- [ ] Angenommen ein beliebiger Nutzer (auch der Admin) ist angemeldet, wenn er versucht, sich oder anderen Admin-Rechte zu geben oder zu entziehen, dann wird das verweigert
- [ ] Angenommen der Admin hat keine 2FA eingerichtet, wenn er sich anmeldet, dann erhält er erst nach Einrichtung der 2FA Admin-Rechte

### Auth-Konfiguration
- [ ] Angenommen jemand hat keine Einladung, wenn er sich selbst registrieren will, dann ist das nicht möglich
- [ ] Angenommen eine Einladung oder ein Passwort-Reset wird ausgelöst, wenn die E-Mail ankommt, dann ist sie auf Deutsch und enthält einen funktionierenden Link
- [ ] Angenommen ein Passwort wird gesetzt, wenn es die Mindestanforderungen nicht erfüllt, dann wird es abgelehnt

### Nachvollziehbarkeit
- [ ] Angenommen ein Datensatz wird angelegt oder geändert, wenn man ihn danach ansieht, dann sind Zeitpunkt und Person von Anlage und letzter Änderung gespeichert
- [ ] Angenommen ein Datensatz einer fachlichen Tabelle wird angelegt, geändert oder gelöscht, wenn die Aktion abgeschlossen ist, dann enthält das Änderungsprotokoll Zeitpunkt, Person, Aktion sowie alte und neue Werte
- [ ] Angenommen ein Inhaber oder der Admin ist angemeldet, wenn er das Protokoll seines Kunden abfragt, dann sieht er die Einträge; ein Mitarbeiter sieht sie nicht
- [ ] Angenommen ein Protokolleintrag ist älter als 2 Jahre, wenn die regelmäßige Bereinigung läuft, dann wird er entfernt
- [ ] Angenommen ein Protokolleintrag existiert, wenn ein Nutzer ihn ändern oder löschen will, dann wird das verweigert (nur die automatische Bereinigung darf löschen)

### Admin-Einrichtung & Backups
- [ ] Angenommen die Einrichtung ist abgeschlossen, wenn der erste Betreiber-Admin sich anmeldet, dann hat er Admin-Rechte
- [ ] Angenommen das Produktionsprojekt ist eingerichtet, wenn ein Tag vergeht, dann existiert ein automatisches Backup (7 Tage Aufbewahrung)
- [ ] Angenommen ein Backup existiert, wenn vor dem Pilotstart eine Test-Wiederherstellung durchgeführt wird, dann sind die Daten vollständig wiederhergestellt

## Edge Cases
- Eine Person wird aus ihrem einzigen Mandanten entfernt, während sie angemeldet ist: Der nächste Zugriff liefert keine Daten mehr.
- Der letzte Inhaber eines Kunden soll entfernt oder herabgestuft werden: Das wird verhindert, denn jeder Kunde braucht mindestens einen Inhaber.
- Dieselbe E-Mail wird zweimal zum selben Kunden eingeladen: Es entsteht keine doppelte Mitgliedschaft.
- Massenänderung (z. B. Import von 500 Buchungen aus Channex): Das Protokoll schreibt alle Einträge mit, ohne den Import spürbar zu verlangsamen. Als Person wird der System-/Import-Prozess vermerkt.
- DSGVO-Löschung eines Gastes: Seine personenbezogenen Daten werden auch aus dem Änderungsprotokoll entfernt.
- Ein Mandant wird deaktiviert (PROJ-5): Seine Mitglieder haben keinen Zugriff mehr, die Daten bleiben erhalten.
- Das Entwicklungsprojekt im Gratis-Tarif wird nach Inaktivität pausiert: Es lässt sich ohne Datenverlust wieder aktivieren (nur die Entwicklung ist betroffen).
- Der Supabase-Test-Mailversand ist am Limit: Einladungen kommen verzögert oder gar nicht an. Bekanntes Risiko bis zur Umstellung auf einen eigenen Mailversand.
- Das Admin-Konto wird übernommen: Die 2FA-Pflicht und das Fehlen von Schreibrechten begrenzen den Schaden.

## Technical Requirements
- Sicherheit: Abschottung zwingend auf Datenbankebene (nicht nur in der Oberfläche); jede neue Fachtabelle muss diesem Muster folgen
- Datenstandort: EU (eu-west-1) für Entwicklung und Produktion
- Performance: Abschottungsprüfung und Protokoll dürfen normale Abfragen nicht spürbar verlangsamen (< 200 ms für typische Listen)
- Kosten: Entwicklung im Gratis-Tarif; Produktion ab Pilotstart im Pro-Tarif (ca. 25 USD/Monat)

## Open Questions
- [x] E-Mail-Adresse des ersten Betreiber-Admins → `joachim@janezic.at` (geklärt 2026-10-13)
- [ ] Eigener Mailversand-Dienst und Absender-Domain festlegen, spätestens vor dem Pilotstart (Empfehlung: Brevo)
- [ ] Auftragsverarbeitungsvertrag (AVV) mit den Kunden muss den Lesezugriff des Betreibers auf Kundendaten abdecken
- [ ] AVV/DPA mit Supabase (und später dem Mail-Dienst) abschließen
- [x] Mindestanforderungen an Passwörter → mind. 10 Zeichen, Klein-/Großbuchstaben und Ziffern; in Produktion zusätzlich Leak-Prüfung (geklärt 2026-10-14)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| PROJ-1 umfasst nur das Fundament; Fachtabellen entstehen mit ihren Features | Jedes Feature bleibt einzeln test- und auslieferbar; keine vorweggenommenen Entscheidungen | 2026-10-13 |
| „apppa“ = Entwicklung; eigenes Produktionsprojekt vor dem Pilot | Echte Gästedaten nie in der Testumgebung; im Gratis-Tarif möglich | 2026-10-13 |
| E-Mail + Passwort, nur per Einladung; 2FA Pflicht für Admin | Passt zum Admin-Onboarding; der Admin hat Zugriff auf alle Mandanten | 2026-10-13 |
| Vorerst Supabase-Test-Mailversand | Schneller Start; eigener Dienst vor dem Pilot | 2026-10-13 |
| Eine Person kann Mitglied mehrerer Mandanten sein | Realistisch (mehrere Firmen, geteilte Mitarbeiter); späteres Nachrüsten wäre ein großer Umbau | 2026-10-13 |
| Admin hat vollen Lesezugriff, aber keinen Schreibzugriff auf Kundendaten | Support und Fehleranalyse; Schreiben nur als eingeladenes Mitglied. Im AVV zu regeln | 2026-10-13 |
| Volles Änderungsprotokoll (alt/neu) für fachliche Tabellen | Nachvollziehbarkeit bei Fehlern und Streitfällen | 2026-10-13 |
| Protokoll lesbar für Inhaber + Admin, 2 Jahre Aufbewahrung, DSGVO-Löschung greift auch dort | Ausgewogen zwischen Nachvollziehbarkeit, Datenschutz und Speicher | 2026-10-13 |
| Produktion im Pro-Tarif mit Tagesbackups (7 Tage), Test-Wiederherstellung vor dem Pilot | Gratis-Tarif hat keine Backups und pausiert Projekte | 2026-10-13 |
| Admin-Rechte nur manuell außerhalb der App vergeben | Keine Rechteausweitung über die Oberfläche möglich | 2026-10-13 |
| Erster Betreiber-Admin: `joachim@janezic.at`; später änderbar | Rechte hängen am Konto, nicht an der Adresse: Wechsel per E-Mail-Änderung des Kontos oder durch ein neues Admin-Konto mit manuellem Entzug des alten | 2026-10-13 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Supabase (PostgreSQL) statt localStorage | Mehrmandanten, mehrere Geräte und Nutzer; Daten müssen zentral und geschützt liegen | 2026-10-14 |
| Zugriffsschutz per Row Level Security auf jeder Tabelle | Schutz greift auch bei App-Fehlern; nicht über den Browser umgehbar | 2026-10-14 |
| Rolle wird je Zeile gegen deren Mandanten geprüft; aktiver Mandant ist reine UI-Auswahl | Mehrfach-Mitgliedschaften ohne Rechtevermischung; kein Sitzungszustand in der Datenbank nötig | 2026-10-14 |
| Admin-Lesezugriff nur bei 2FA-bestätigter Sitzung | Setzt die 2FA-Pflicht für den Admin in der Datenbank durch, nicht nur in der Oberfläche | 2026-10-14 |
| Admin-Kennzeichen im Profil, für App-Nutzer nicht änderbar | Keine Rechteausweitung über die App; Vergabe nur direkt in der Datenbank | 2026-10-14 |
| Zentrale Prüf-Bausteine (Mitglied/Rolle/Admin) für alle Regeln | Einheitliche, schnelle Regeln; jede neue Tabelle folgt demselben Muster | 2026-10-14 |
| Standardfelder und Änderungsprotokoll per Datenbank-Automatik (Trigger) | Erfasst auch Importe und direkte Änderungen; kann von keinem Feature vergessen werden; nicht fälschbar | 2026-10-14 |
| Protokoll-Bereinigung nach 2 Jahren mit pg_cron | In Supabase enthalten, kein externer Dienst nötig | 2026-10-14 |
| Migrationen als Dateien im Repo über die Supabase-CLI | Entwicklung und Produktion bleiben identisch und nachvollziehbar | 2026-10-14 |
| `@supabase/ssr` mit Cookie-Sitzungen und Sitzungs-Auffrischung bei jedem Aufruf | Offizieller Weg für Next.js App Router; Server und Browser kennen denselben Login | 2026-10-14 |
| Geheimer Schlüssel (`SUPABASE_SECRET_KEY`) nur serverseitig | Systemrechte dürfen nie in den Browser gelangen | 2026-10-14 |
| Umgebungsvariablen beim Start mit Zod prüfen | Klare Fehlermeldung statt rätselhafter Laufzeitfehler (Akzeptanzkriterium) | 2026-10-14 |
| Passwort mind. 10 Zeichen mit a-z/A-Z/0-9; Leak-Prüfung in Produktion | Mit dem Nutzer abgestimmt; Leak-Prüfung erst im Pro-Tarif verfügbar | 2026-10-14 |
| Erster Admin per Einladung + einmaliger manueller Datenbankeintrag (Runbook) | Konto-ID ist je Umgebung verschieden; gehört nicht in eine Migration | 2026-10-14 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-1 hat **keine sichtbare Oberfläche**. Es baut das unsichtbare Fundament, auf dem alle späteren Features aufsetzen: die Verbindung zur Datenbank, die Mandantentrennung, die Rollen, das Änderungsprotokoll und die Login-Regeln. Ob es funktioniert, wird über automatische Tests geprüft, nicht über Bildschirme.

### A) Bausteine (statt Komponentenbaum)
```
App (Next.js)
+-- Supabase-Verbindung für den Browser       (Anmeldestatus, Lesen/Schreiben im Namen des Nutzers)
+-- Supabase-Verbindung für den Server         (Seiten und Server-Aktionen, ebenfalls im Namen des Nutzers)
+-- Supabase-Verbindung mit Systemrechten      (nur Server: z. B. Einladungen, später Channex-Import)
+-- Sitzungs-Auffrischung bei jedem Seitenaufruf (hält den Login gültig)
+-- Prüfung der Umgebungsvariablen beim Start  (bricht mit klarer Meldung ab, wenn etwas fehlt)

Datenbank (Supabase, eu-west-1)
+-- Mandanten
+-- Benutzerprofile (inkl. Admin-Kennzeichen)
+-- Mitgliedschaften (Person ↔ Mandant mit Rolle)
+-- Änderungsprotokoll
+-- Zugriffsregeln (Row Level Security) auf allen Tabellen
+-- Wiederverwendbare Prüf-Bausteine: „ist Mitglied?“, „hat Rolle?“, „ist Admin mit 2FA?“
+-- Automatik: Standardfelder füllen, Protokoll schreiben, alte Einträge nach 2 Jahren löschen

Repository
+-- Ordner für Datenbank-Migrationen (jede Änderung als nummerierte Datei)
+-- Vorlage der Umgebungsvariablen (.env.local.example, ohne echte Werte)
+-- Automatisch erzeugte Typbeschreibung der Datenbank für den Code
+-- Kurzanleitung („Runbook“): Admin einrichten, Produktionsprojekt anlegen, Backup testen
```

### B) Datenmodell (in Worten)

**Mandant (Kunde):**
- Eindeutige ID, Name
- Status: aktiv oder deaktiviert (deaktivierte Mandanten sperren den Zugriff ihrer Mitglieder, die Daten bleiben erhalten)
- Standardfelder (siehe unten)

**Benutzerprofil:** genau eines pro Login-Konto
- Verweis auf das Login-Konto, Anzeigename, E-Mail (Kopie für Anzeigen)
- Kennzeichen „Betreiber-Admin“ (ja/nein). Es kann über die App von niemandem gesetzt oder entfernt werden, nur direkt in der Datenbank
- Wird beim ersten Anlegen eines Login-Kontos automatisch erzeugt

**Mitgliedschaft:** verbindet eine Person mit einem Mandanten
- Person, Mandant, Rolle: Inhaber oder Mitarbeiter
- Pro Person und Mandant höchstens eine Mitgliedschaft (keine Duplikate)
- Regel: Jeder Mandant hat immer mindestens einen Inhaber; der letzte Inhaber kann nicht entfernt oder herabgestuft werden

**Änderungsprotokoll:** ein Eintrag pro Anlage, Änderung oder Löschung in einer fachlichen Tabelle
- Mandant, betroffene Tabelle, betroffener Datensatz
- Aktion (angelegt/geändert/gelöscht), alte Werte, neue Werte
- Wer (Person oder „System“, z. B. Channex-Import) und wann
- Nur lesbar für Inhaber des Mandanten und den Admin; niemand kann Einträge ändern oder löschen, nur die automatische Bereinigung nach 2 Jahren
- Für DSGVO-Löschungen gibt es eine Funktion, die personenbezogene Daten einer Person aus dem Protokoll entfernt (wird von PROJ-7 genutzt)

**Standardfelder für jede Tabelle:** angelegt am, angelegt von, geändert am, geändert von. Sie werden automatisch von der Datenbank gefüllt, nicht vom Code, und lassen sich deshalb nicht fälschen.

**Muster für alle künftigen Fachtabellen (Wohnungen, Gäste, Buchungen …):**
- Jede Zeile gehört genau einem Mandanten
- Lesen: Mitglieder dieses Mandanten und der Admin (nur mit aktiver 2FA)
- Schreiben: nur Mitglieder dieses Mandanten. Welche Rolle was darf, legt jedes Feature fest
- Standardfelder und Änderungsprotokoll werden mit einem einzigen Befehl pro Tabelle aktiviert

### C) Technische Entscheidungen (begründet)

**Zugriffsschutz in der Datenbank selbst (Row Level Security).** Die Datenbank prüft bei jeder einzelnen Abfrage, ob die Person die Zeile sehen oder ändern darf. Selbst wenn die App einen Fehler hätte, könnte niemand die Daten eines anderen Kunden abrufen. Diese Prüfung lässt sich nicht umgehen, auch nicht über den Browser.

**Mandantenwechsel als reine Ansichtssache.** Die Datenbank erlaubt einer Person Zugriff auf alle Mandanten, bei denen sie Mitglied ist, und prüft die Rolle immer für den Mandanten der jeweiligen Zeile. Welcher Kunde gerade „aktiv“ ist, merkt sich nur die Oberfläche (PROJ-4). So ist es egal, welcher Kunde gewählt ist: Rechte gelten immer nur für den richtigen Mandanten.

**Admin-Lesezugriff nur mit 2FA.** Supabase vermerkt in jeder Sitzung, ob die Anmeldung mit zweitem Faktor bestätigt wurde. Die Leseregel für den Admin verlangt genau das. Ohne 2FA ist der Admin wie ein normaler Nutzer ohne Mitgliedschaft und sieht nichts.

**Prüf-Bausteine statt Wiederholung.** „Ist Mitglied?“, „hat Rolle?“ und „ist Admin?“ werden einmal zentral definiert und von allen Regeln genutzt. Das hält die Regeln einheitlich und schnell (die Mitgliedschaftstabelle bekommt passende Suchindizes).

**Protokoll und Standardfelder per Datenbank-Automatik.** Sie werden von der Datenbank selbst geschrieben, nicht vom App-Code. Dadurch werden auch Änderungen aus dem Channex-Import oder direkt in der Datenbank erfasst, und kein Feature kann es vergessen.

**Automatische Bereinigung mit dem eingebauten Zeitplaner (pg_cron).** Supabase bringt einen Zeitplaner mit, der täglich Protokolleinträge löscht, die älter als 2 Jahre sind. Es wird kein externer Dienst gebraucht.

**Migrationen mit der Supabase-Kommandozeile.** Jede Datenbankänderung ist eine Datei im Repository. Dieselben Dateien werden erst in die Entwicklung, später unverändert in die Produktion eingespielt. Damit sind beide Umgebungen garantiert gleich und alles ist im Git-Verlauf nachvollziehbar.

**Anmeldung über Cookies mit dem offiziellen Next.js-Paket von Supabase.** Die Sitzung wird in sicheren Cookies gehalten, damit Server-Seiten und Browser denselben Login kennen. Eine kleine Vorschaltung frischt die Sitzung bei jedem Seitenaufruf auf.

**Zwei Arten von Schlüsseln.** Der öffentliche Schlüssel (Publishable Key) darf in den Browser; alle Rechte prüft die Datenbank. Der geheime Schlüssel mit Systemrechten liegt nur auf dem Server (lokal in `.env.local`, später in Vercel) und wird nur dort verwendet, wo es nötig ist (Einladungen, Import).

**Umgebungsvariablen beim Start prüfen.** Mit Zod (bereits installiert) wird beim Start geprüft, ob alle Variablen vorhanden und gültig sind. Fehlt eine, nennt die Fehlermeldung genau diese.

**Auth-Konfiguration:**
- Öffentliche Registrierung aus; Konten entstehen nur per Einladung
- Passwort: mindestens 10 Zeichen, mit Klein- und Großbuchstaben und Ziffern; in der Produktion zusätzlich Prüfung gegen geleakte Passwörter (Pro-Tarif)
- 2FA per Authenticator-App (TOTP) aktiviert; Pflicht wird über die Admin-Regel durchgesetzt
- Deutsche Vorlagen für Einladungs- und Passwort-Reset-Mails
- Erlaubte Weiterleitungsadressen: localhost (Entwicklung), später die Vercel-Adresse

**Umgebungen:** Lokale Entwicklung und Vercel-Vorschauen nutzen „apppa“; die Vercel-Produktion nutzt das spätere Produktionsprojekt. Getrennte Werte pro Umgebung in Vercel.

**Erster Admin:** Er wird über die Supabase-Oberfläche zu `joachim@janezic.at` eingeladen. Danach wird das Admin-Kennzeichen einmalig per Anleitung im Runbook direkt in der Datenbank gesetzt (nicht über eine Migration, weil die Konto-ID je Umgebung verschieden ist).

### D) Abhängigkeiten (Pakete)
- `@supabase/ssr`: offizielles Supabase-Paket für Login-Sitzungen in Next.js (Cookies, Server und Browser)
- `supabase` (nur Entwicklung): Supabase-Kommandozeile für Migrationen und die Erzeugung der Typbeschreibung
- Bereits vorhanden: `@supabase/supabase-js`, `zod`
- Datenbank-Erweiterung `pg_cron` (in Supabase enthalten, wird nur aktiviert)

### E) Neue Umgebungsvariablen (in `.env.local.example` dokumentiert)
- `NEXT_PUBLIC_SUPABASE_URL`: Projektadresse (öffentlich)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: öffentlicher Schlüssel
- `SUPABASE_SECRET_KEY`: geheimer Schlüssel mit Systemrechten (nur Server, nie mit `NEXT_PUBLIC_`)

### F) Prüfung (für /qa)
- Automatische Tests mit zwei Test-Mandanten, Testpersonen in verschiedenen Rollen und einem Test-Admin: Sie prüfen jede Zugriffsregel aus den Akzeptanzkriterien direkt gegen die Datenbank
- Supabase-Sicherheitsberater (Advisors) ohne Warnungen
- Produktions-Backup und Test-Wiederherstellung werden vor dem Pilotstart per Runbook geprüft

## Implementation Notes (Backend)
_Stand 2026-10-14 (/backend)_

**Datenbank** (`supabase/migrations/`)
- `20261014120000_foundation.sql`: Enums `member_role` (owner/staff) und `tenant_status`; Tabellen `tenants`, `profiles`, `memberships` mit Standardfeldern; Prüf-Bausteine `private.is_member`, `private.has_role`, `private.is_admin` (verlangt `aal2`) und `private.shares_tenant_with`; Profil-Anlage per Trigger auf `auth.users`; Schutz des Admin-Kennzeichens; Schutz des letzten Inhabers; RLS und Spaltenrechte auf allen Tabellen
- `20261014120100_audit_log.sql`: `audit_log` mit Trigger `private.audit_row()`; `private.enable_tenant_table(tabelle)` als Ein-Befehl-Muster für Fachtabellen; `private.purge_audit_personal_data()` für DSGVO-Löschungen; Schreibrechte für alle Rollen entzogen, auch für `service_role`
- `20261014120200_audit_retention.sql`: pg_cron-Job `purge-audit-log`, täglich, löscht Einträge älter als 2 Jahre
- `20261014130000_restrict_rls_auto_enable.sql`: behebt die zwei Advisor-Warnungen zur Supabase-eigenen Event-Trigger-Funktion `public.rls_auto_enable()`
- In „apppa“ eingespielt; `migration list` lokal = remote; Security- und Performance-Advisors ohne Befund

**Auth** (`supabase/config.toml`, per `config push` in „apppa“ übernommen): Registrierung aus (geprüft: `signUp` wird abgelehnt), Passwort mind. 10 Zeichen mit a-z/A-Z/0-9, TOTP aktiv
- **Offen – deutsche Mail-Vorlagen:** Die Vorlagen liegen in `supabase/templates/`, Supabase lehnt sie im Gratis-Tarif mit dem eingebauten Mailversand aber ab. Sie sind in `config.toml` auskommentiert und werden aktiviert, sobald ein eigener SMTP-Dienst eingerichtet ist (Open Question Brevo). Bis dahin sind Einladungs- und Reset-Mails englisch. Das Akzeptanzkriterium „Mail auf Deutsch“ ist damit noch nicht erfüllt.
- Stolperfalle: `[auth.email] enable_signup = false` schaltet den E-Mail-Login komplett ab. Die Registrierung sperrt allein `[auth] enable_signup = false`.

**App**: `src/lib/env.ts` (Zod-Prüfung mit klarer Fehlermeldung), `src/lib/supabase/{client,server,admin,proxy}.ts`, `src/proxy.ts` (Next 16, Sitzungs-Auffrischung), `src/types/database.ts`, `.env.local.example`. Der Platzhalter `src/lib/supabase.ts` wurde entfernt.

**Tests**: `src/lib/env.test.ts` (4) und `supabase/tests/rls.integration.test.ts` (19) gegen „apppa“: alle 23 grün (2026-10-14). Die RLS-Tests werden übersprungen, wenn `SUPABASE_SECRET_KEY` fehlt.

**Runbook**: `docs/runbooks/supabase.md` (CLI, erster Admin, Produktion, Backup-Test, Muster für Fachtabellen)

**Abweichungen / Ergänzungen zum Tech Design**
- Zusätzlich `src/app/auth/confirm/route.ts`: bestätigt die Links aus Einladungs- und Reset-Mails (`token_hash`). Ohne diese Route wären die Mail-Links nicht funktionsfähig. Die Oberflächen folgen in PROJ-3.
- Das Admin-Kennzeichen ist für angemeldete Nutzer gesperrt, mit dem Secret Key (`service_role`) aber setzbar. Die Tests brauchen das; App-Code darf es nicht nutzen.
- Protokolleinträge der Test-Mandanten bleiben nach Testläufen in „apppa“ stehen, weil das Protokoll nicht löschbar ist.
- Mandanten werden auch über `tenants` selbst protokolliert (Mandanten-ID = eigene ID), Mitgliedschaften ebenfalls.

## QA Test Results

**Tested:** 2026-10-14
**Umgebung:** Entwicklungsprojekt „apppa“ (`nizgfmvjplhegoosanmu`) + Code-Review der Migrationen und von `src/`
**Tester:** QA Engineer (AI)

**Hinweis zum Umfang:** PROJ-1 hat keine Oberfläche. Browser-, Responsive- und Playwright-E2E-Tests entfallen. Geprüft wurde über die automatischen Integrationstests gegen die Datenbank, die Supabase-Advisors, direkte Datenbankabfragen und ein Code-Review aus Angreifersicht.

**Automatische Tests:** `npm test` → 29/29 grün
- `src/lib/env.test.ts` (4) und `supabase/tests/rls.integration.test.ts` (19), beide aus /backend
- Neu aus /qa: `supabase/tests/auth.integration.test.ts` (6): Registrierung gesperrt, Passwortregel (zu kurz, ohne Groß-/Kleinbuchstaben, ohne Ziffer → abgelehnt; gültiges Passwort → akzeptiert)

### Acceptance Criteria Status

#### Umgebungen & Anbindung
- [x] Verbindung zu „apppa“ mit gesetzten Variablen (alle Integrationstests laufen gegen „apppa“)
- [ ] BUG-5 (Low): Eine fehlende Variable wird nicht beim Start oder Build gemeldet, sondern erst beim ersten Seitenaufruf bzw. beim ersten Zugriff. Die Meldung selbst ist klar und nennt die Variable (Unit-Tests grün)
- [x] Datenbankänderungen liegen als 4 Migrationen in `supabase/migrations/` und sind in „apppa“ eingespielt
- [x] Keine Geheimnisse im Repository (Suche in allen versionierten Dateien und im Git-Verlauf von `.env.local.example`; nur Platzhalter)

#### Mandanten & Abschottung
- [x] Fremder Mandant: Lesen, Ändern, Mitglieder anlegen und löschen werden verweigert
- [x] Ohne Anmeldung keine Mandantendaten
- [x] Rechte gelten je Mandant (B ist Inhaber in T2, Mitarbeiter in T1)
- [x] Mitarbeiter kann Inhaber-Daten (Mandantenname, Rollen) nicht ändern
- [x] Ohne Mitgliedschaft keine Mandanten, Mitgliedschaften oder Protokolle sichtbar

#### Betreiber-Admin
- [x] Admin mit 2FA liest alle Mandanten, Mitglieder und Protokolle
- [x] Admin ohne Mitgliedschaft kann nichts ändern
- [x] Niemand kann über die App Admin-Rechte geben oder entziehen (auch der Admin selbst nicht)
- [x] Ohne 2FA-bestätigte Sitzung (aal1) hat das Admin-Konto keine Rechte

#### Auth-Konfiguration
- [x] Selbstregistrierung ohne Einladung wird abgelehnt (neuer QA-Test)
- [ ] BUG-2 (Medium): Einladungs- und Reset-Mails sind englisch. Die deutschen Vorlagen existieren, sind aber deaktiviert, weil der Gratis-Mailversand eigene Vorlagen ablehnt
- [x] Passwörter, die die Mindestanforderungen nicht erfüllen, werden abgelehnt (neuer QA-Test)

#### Nachvollziehbarkeit
- [x] Angelegt/geändert am/von werden von der Datenbank gesetzt und sind nicht überschreibbar
- [x] Protokoll enthält Zeitpunkt, Person, Aktion sowie alte und neue Werte
- [x] Inhaber und Admin sehen das Protokoll, Mitarbeiter nicht
- [x] Bereinigung nach 2 Jahren: pg_cron-Job `purge-audit-log` ist aktiv (täglich 03:15 UTC). Die Löschung selbst konnte mangels alter Einträge nicht live beobachtet werden
- [x] Protokolleinträge kann niemand ändern oder löschen, auch nicht mit dem Secret Key

#### Admin-Einrichtung & Backups
- [ ] Teilweise (Stand 2026-10-14): `joachim@janezic.at` ist in „apppa“ eingeladen und als Admin gekennzeichnet (Runbook 4.1 und 4.3). Ausstehend: Einladung annehmen, Passwort setzen und 2FA einrichten. Das geht erst mit PROJ-3; die Einladungsmail kam nicht an (laut Supabase-Protokoll versendet)
- [ ] Ausstehend: Tägliche Backups, erst mit dem Produktionsprojekt prüfbar (vor dem Pilotstart)
- [ ] Ausstehend: Test-Wiederherstellung, erst mit dem Produktionsprojekt prüfbar (vor dem Pilotstart)

### Edge Cases Status
- [x] Person wird aus dem Mandanten entfernt, während sie angemeldet ist: Die Rechte werden bei jeder Abfrage neu geprüft, der nächste Zugriff liefert nichts mehr (Design + RLS-Tests)
- [x] Letzter Inhaber kann nicht entfernt oder herabgestuft werden (Test)
- [x] Keine doppelte Mitgliedschaft (Test)
- [ ] Nicht testbar: Massenänderung, z. B. 500 Buchungen (es gibt noch keine Fachtabelle). Das Protokoll schreibt eine Zeile pro Änderung; mit PROJ-11 erneut prüfen
- [ ] Teilweise: DSGVO-Löschung im Protokoll. Die Funktion existiert, ist aber nur per SQL aufrufbar, nicht über die API (siehe Hinweis 2)
- [x] Deaktivierter Mandant sperrt seine Mitglieder, Daten bleiben erhalten (Test)
- [x] Pausiertes Gratis-Projekt: nur Entwicklung betroffen (keine Prüfung nötig)
- [x] Mail-Limit des Test-Versands: bekanntes, dokumentiertes Risiko
- [x] Übernommenes Admin-Konto: ohne 2FA keine Rechte, auch mit 2FA kein Schreibzugriff (Tests)
- [ ] BUG-6 (Low, zusätzlich gefunden): Ein Login-Konto, das letzter Inhaber eines Mandanten ist, lässt sich nicht löschen (die Inhaber-Regel blockiert die Kaskade)

### Security Audit Results
- [x] Authentifizierung: anonymer Zugriff liefert keine Daten; Selbstregistrierung gesperrt
- [x] Autorisierung: Mandantentrennung, Rollen und Admin-Regeln halten in allen Tests
- [x] Rechteausweitung: Admin-Kennzeichen, Mandanten-Status, E-Mail im Profil und Mandantenwechsel einer Mitgliedschaft sind über Spaltenrechte gesperrt
- [x] Interne Funktionen liegen im nicht veröffentlichten Schema `private`
- [x] Supabase Security Advisor: keine Befunde. Performance Advisor: nur INFO „ungenutzter Index `audit_log_created_idx`“ (wird von der nächtlichen Bereinigung gebraucht, ok)
- [x] Keine Geheimnisse im Code; der Secret Key wird nur in `server-only`-Code verwendet
- [ ] BUG-1 (Medium): Open Redirect in `/auth/confirm`
- [ ] BUG-3 (Medium): Mail-Linkscanner verbrauchen den Einmal-Link
- [ ] BUG-4 (Medium): Inhaber können beliebige Konten ohne Zustimmung aufnehmen und deren E-Mail sehen
- [ ] BUG-7 (Low): Sicherheits-Header fehlen

### Bugs Found

#### BUG-1: Open Redirect in `/auth/confirm` über Backslash
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Link aufrufen: `/auth/confirm?token_hash=<gültiger Token>&type=recovery&next=/\evil.com`
  2. Expected: Weiterleitung innerhalb der App oder auf `/`
  3. Actual: Die Prüfung `startsWith('/') && !startsWith('//')` lässt `/\evil.com` durch, und `new URL()` macht daraus `https://evil.com/` (nachgestellt mit Node)
- **Risiko:** Ein Angreifer kann einen eigenen gültigen Token in einen Link packen. Das Opfer wird dann in das Konto des Angreifers eingeloggt und auf eine fremde Seite weitergeleitet (Phishing, Login-CSRF)
- **Priority:** Fix before deployment

#### BUG-2: Einladungs- und Reset-Mails sind englisch
- **Severity:** Medium
- **Steps to Reproduce:** Einladung im Dashboard auslösen → Mail ist englisch (Supabase-Standard)
- **Ursache:** Die Vorlagen in `supabase/templates/` sind in `config.toml` auskommentiert, weil der Gratis-Mailversand eigene Vorlagen ablehnt. Hängt an der offenen Frage zum Mailversand (Brevo)
- **Priority:** Fix before deployment (spätestens vor dem Pilotstart, zusammen mit eigenem SMTP)

#### BUG-3: Mail-Linkscanner (z. B. Outlook Safe Links) können den Einmal-Link verbrauchen
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Einladung an ein Microsoft-365-Postfach mit Safe Links senden
  2. Der Scanner ruft den Link vor dem Nutzer per GET auf, `/auth/confirm` löst den Token sofort ein
  3. Expected: Der Nutzer kann die Einladung annehmen. Actual: Der Link ist beim Klick bereits ungültig („link_invalid“)
- **Hinweis:** Die Zielgruppe nutzt häufig Outlook/M365. Empfehlung für PROJ-3: Der Link öffnet eine Bestätigungsseite, erst ein Klick auf „Einladung annehmen“ löst den Token ein
- **Priority:** Fix before deployment (in PROJ-3)

#### BUG-4: Inhaber können beliebige Konten ohne Zustimmung in ihren Mandanten aufnehmen
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Inhaber von T1 kennt die Konto-ID einer Person X, z. B. aus einem gemeinsamen anderen Mandanten
  2. Inhaber legt direkt eine Mitgliedschaft `{tenant_id: T1, user_id: X}` an. Die Regel prüft nur, dass der Anlegende Inhaber ist
  3. Expected: X muss zustimmen (Einladung annehmen). Actual: X ist sofort Mitglied, und der Inhaber sieht über die Profil-Regel die E-Mail von X
- **Hinweis:** Konto-IDs sind nicht erratbar, das Risiko ist also begrenzt. Für PROJ-4 sollte das Anlegen von Mitgliedschaften über einen Einladungs-Ablauf mit Annahme laufen statt über direktes Einfügen
- **Priority:** Fix in PROJ-4 (vor dem Pilotstart)

#### BUG-5: Fehlende Umgebungsvariablen werden erst beim ersten Zugriff gemeldet
- **Severity:** Low
- **Steps to Reproduce:** Variable aus `.env.local` entfernen → `npm run build` / `npm run dev` startet ohne Fehler, die Meldung erscheint erst beim ersten Seitenaufruf
- **Expected (AC):** Meldung beim Start oder Build
- **Priority:** Nice to have (z. B. Prüfung beim Serverstart)

#### BUG-6: Konto eines letzten Inhabers lässt sich nicht löschen
- **Severity:** Low
- **Steps to Reproduce:** Person ist einziger Inhaber eines Mandanten → Konto im Dashboard bzw. per Admin-API löschen → Fehler „Jeder Kunde braucht mindestens einen Inhaber“
- **Hinweis:** Das ist fachlich vertretbar, PROJ-5 braucht aber einen Ablauf dafür (erst Inhaber übertragen oder Mandant löschen)
- **Priority:** Fix in PROJ-5

#### BUG-7: Sicherheits-Header fehlen
- **Severity:** Low
- **Details:** `next.config.ts` setzt keine der in `.claude/rules/security.md` geforderten Header (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS)
- **Priority:** Fix before deployment (in /deploy)

#### BUG-8: Testläufe hinterlassen Protokolleinträge in „apppa“
- **Severity:** Low
- **Details:** Jeder Testlauf lässt etwa 29 Einträge im Änderungsprotokoll zurück (aktuell 58), weil das Protokoll nicht löschbar ist. Das betrifft nur die Entwicklung; die Bereinigung greift erst nach 2 Jahren
- **Priority:** Nice to have

#### Hinweise (keine Bugs)
1. Der erste Admin ist in „apppa“ eingeladen und gekennzeichnet; Passwort und 2FA folgen mit PROJ-3. Die Einladungsmail an `joachim@janezic.at` kam nicht an, obwohl Supabase sie laut Protokoll versendet hat (Spam/Quarantäne prüfen; dauerhafte Lösung: eigener Mailversand, siehe BUG-2).
2. `private.purge_audit_personal_data()` ist nicht über die API erreichbar. PROJ-7 braucht dafür einen serverseitigen Aufruf (z. B. eine öffentliche Funktion, die nur der Secret Key ausführen darf).

### Summary
- **Acceptance Criteria:** 19/24 bestanden, 2 nicht erfüllt (BUG-2, BUG-5), 3 ausstehend (Admin-Einrichtung manuell, Backups erst mit Produktion)
- **Bugs Found:** 8 total (0 critical, 0 high, 4 medium, 4 low)
- **Security:** Mandantentrennung und Rollen sind solide; 2 Medium-Befunde rund um die Mail-Links (BUG-1, BUG-3) und 1 Medium-Befund zur Aufnahme von Mitgliedern (BUG-4)
- **Production Ready:** YES (keine Critical/High-Bugs). Vor dem Pilotstart müssen aber BUG-1 bis BUG-4 und BUG-7 behoben und die ausstehenden Kriterien geprüft sein
- **Recommendation:** Als Fundament freigeben. BUG-1 jetzt beheben (klein, betrifft bestehenden Code), die übrigen in den genannten Features

## Deployment
_To be added by /deploy_
