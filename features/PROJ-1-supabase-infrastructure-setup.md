# PROJ-1: Supabase Infrastructure Setup

## Status: Planned
**Created:** 2026-10-13
**Last Updated:** 2026-10-13

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
- [ ] Mindestanforderungen an Passwörter (Länge, Komplexität)

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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
