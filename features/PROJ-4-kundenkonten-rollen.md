# PROJ-4: Kundenkonten & Rollen

## Status: Planned
**Created:** 2026-10-23
**Last Updated:** 2026-10-23

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup): Mandanten, Mitgliedschaften mit Rolle Inhaber/Mitarbeiter, Regel „mindestens ein Inhaber“, Abschottung
- Requires: PROJ-3 (Authentifizierung): Einladung annehmen (Name + Passwort), Mail-Versand über Brevo, Bestätigungsseite für Mail-Links
- Nutzt: PROJ-2 (App-Shell): Kundenname und Kundenwechsel in Seitenleiste bzw. „Mehr“-Blatt, Bereich „Einstellungen“ nur für Inhaber
- Grundlage für: PROJ-5 (Betreiber-Admin legt Kunden und ersten Inhaber an), PROJ-6 ff. (alle Fachdaten gehören zum gewählten Kunden), PROJ-10 (mehrere Plattform-Konten je Kunde)

## User Stories
- Als **Inhaber** möchte ich Mitarbeiter (z. B. Reinigungskraft, Rezeption) per E-Mail einladen, damit sie Buchungen und Kalender sehen, ohne meine Zugangsdaten zu kennen.
- Als **Inhaber** möchte ich eine zweite Person (z. B. Ehepartner) als weiteren Inhaber einladen, damit wir beide alles verwalten können.
- Als **Inhaber** möchte ich sehen, wer zum Team gehört und welche Einladungen noch offen sind, damit ich den Überblick behalte und vergessene Einladungen erneut senden oder zurückziehen kann.
- Als **Inhaber** möchte ich Mitarbeitern Rechte geben oder entziehen und sie entfernen, damit ehemalige Mitarbeiter keinen Zugriff auf Gästedaten mehr haben.
- Als **Mitarbeiter, der für mehrere Vermieter arbeitet**, möchte ich mit einem Login zwischen den Kunden wechseln, damit ich keine zweite E-Mail-Adresse brauche.
- Als **Person mit bestehendem apppa-Konto** möchte ich einer neuen Einladung erst zustimmen, damit ich nicht ungefragt bei einem fremden Kunden lande.
- Als **Mitglied** möchte ich ein Team selbst verlassen können, z. B. bei einem Jobwechsel.
- Als **Inhaber** möchte ich den Namen meines Kundenkontos festlegen, damit er in der App und in Einladungsmails richtig erscheint.

## Umfang dieses Features
- **Einstellungen → Team** (nur Inhaber): Liste der Mitglieder (Name, E-Mail, Rolle) und der offenen Einladungen (E-Mail, Rolle, eingeladen am, Status offen/abgelaufen)
- **Einladen**: E-Mail-Adresse + Rolle (Mitarbeiter oder Inhaber)
  - Neue Person: Einladungsmail (Ablauf aus PROJ-3: Bestätigungsseite → Name + Passwort)
  - Person mit bestehendem Konto: Hinweis-Mail + Einladung in der App zum Annehmen oder Ablehnen
- **Offene Einladungen**: „Erneut senden“ (frischer Link, alter wird ungültig) und „Zurückziehen“
- **Rollen und Mitglieder**: Mitarbeiter ↔ Inhaber hochstufen, Mitarbeiter entfernen, selbst austreten bzw. sich selbst herabstufen; Inhaber sind voreinander geschützt
- **Einstellungen → Kunde** (nur Inhaber): Kundenname ändern
- **Kundenwechsel** in Seitenleiste bzw. „Mehr“-Blatt bei mehreren Mitgliedschaften; zuletzt gewählter Kunde je Gerät gemerkt
- **Zustand ohne Kunde**: Hinweis „Du bist noch keinem Kunden zugeordnet“ (z. B. Betreiber-Admin, entfernte Person)
- **Rollen im App-Rahmen**: echte Rolle statt Platzhalter in Seitenleiste/„Mehr“, Navigation nach Rolle (Grundlage aus PROJ-2)

## Out of Scope
- Kunden anlegen, deaktivieren, löschen; ersten Inhaber einladen; andere Inhaber herabstufen oder entfernen; Übersicht aller Kunden → PROJ-5 (Betreiber-Admin)
- Verbinden von booking.com-/Airbnb-Konten (auch mehrere je Kunde) → PROJ-10 (Channex-Verbindung)
- Gruppierung von Wohnungen nach Betrieb oder Plattform-Konto → bei Bedarf in PROJ-6
- Firmendaten des Kunden (Adresse, UID-Nummer, Logo, Daten für die Ortstaxe-Meldung) → mit PROJ-15/16
- Gemeinsame Ansicht über mehrere Kunden (z. B. ein Kalender für geteilte Reinigungskräfte) → später, eigenes Feature
- Feinere Rechte als Inhaber/Mitarbeiter (z. B. „nur Kalender“, „nur bestimmte Wohnungen“) → später
- Begrenzung der Teamgröße bzw. Abrechnung nach Nutzern → nicht geplant (Abrechnung außerhalb der App)
- Änderung der eigenen E-Mail-Adresse → beim Betreiber (Entscheidung PROJ-3)
- Inhalte, die Mitarbeiter sehen dürfen (Buchungen, Kalender), entstehen mit den jeweiligen Features; PROJ-4 liefert nur die Rolle

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Team-Seite
- [ ] Angenommen ein Inhaber ist angemeldet, wenn er „Einstellungen → Team“ öffnet, dann sieht er alle Mitglieder mit Name, E-Mail-Adresse und Rolle sowie getrennt davon die offenen Einladungen mit E-Mail, Rolle, Datum und Status „offen“ bzw. „abgelaufen“
- [ ] Angenommen ein Mitarbeiter ist angemeldet, wenn er die Team-Seite direkt aufruft, dann erscheint „Seite nicht gefunden“, und „Einstellungen“ fehlt in seiner Navigation
- [ ] Angenommen ein Kunde hat nur den Inhaber selbst und keine Einladungen, wenn die Team-Seite geöffnet wird, dann erscheint ein Leerzustand mit Hinweis und dem Knopf „Person einladen“

### Einladen
- [ ] Angenommen ein Inhaber gibt eine gültige E-Mail-Adresse ein und wählt „Mitarbeiter“ oder „Inhaber“, wenn er „Einladen“ wählt, dann erscheint die Einladung sofort als „offen“ in der Liste, und eine Bestätigung wird angezeigt
- [ ] Angenommen die eingeladene Adresse hat noch kein apppa-Konto, wenn die Einladung verschickt wird, dann erhält die Person die deutsche Einladungsmail mit dem Kundennamen und dem Namen der einladenden Person; nach dem Annehmen (PROJ-3) ist sie Mitglied mit der gewählten Rolle
- [ ] Angenommen die eingeladene Adresse gehört zu einem bestehenden Konto, wenn die Einladung verschickt wird, dann erhält die Person eine Hinweis-Mail und sieht nach dem Anmelden die Einladung mit „Annehmen“ und „Ablehnen“; erst nach „Annehmen“ ist sie Mitglied
- [ ] Angenommen eine Person hat eine Einladung abgelehnt, wenn der Inhaber die Team-Seite öffnet, dann ist die Einladung nicht mehr offen, und er kann die Person erneut einladen
- [ ] Angenommen die E-Mail-Adresse ist leer oder ungültig, wenn der Inhaber „Einladen“ wählt, dann erscheint eine Meldung am Feld, und es wird nichts verschickt
- [ ] Angenommen die Adresse gehört bereits zu einem Mitglied dieses Kunden oder hat schon eine offene Einladung, wenn der Inhaber sie erneut einlädt, dann erscheint ein entsprechender Hinweis, und es entsteht keine doppelte Einladung
- [ ] Angenommen eine Einladung ist offen oder abgelaufen, wenn der Inhaber „Erneut senden“ wählt, dann wird ein frischer Link verschickt, der alte wird ungültig, und das Datum in der Liste wird aktualisiert
- [ ] Angenommen eine Einladung ist offen, wenn der Inhaber „Zurückziehen“ bestätigt, dann verschwindet sie aus der Liste, und ein bereits verschickter Link führt zur Meldung „nicht mehr gültig“
- [ ] Angenommen eine Einladung an eine neue Person ist älter als 24 Stunden bzw. eine Einladung an ein bestehendes Konto älter als 14 Tage, wenn der Inhaber die Liste ansieht, dann ist sie als „abgelaufen“ markiert und kann erneut gesendet oder zurückgezogen werden

### Rollen und Mitglieder
- [ ] Angenommen ein Mitglied ist Mitarbeiter, wenn ein Inhaber es nach Bestätigung zum Inhaber macht, dann hat es ab dem nächsten Seitenaufruf Inhaber-Rechte
- [ ] Angenommen ein Mitglied ist Mitarbeiter, wenn ein Inhaber es nach Bestätigung entfernt, dann hat es ab dem nächsten Seitenaufruf keinen Zugriff mehr auf diesen Kunden
- [ ] Angenommen ein anderes Mitglied ist Inhaber, wenn ein Inhaber versucht, es herabzustufen oder zu entfernen, dann ist das nicht möglich, mit dem Hinweis, dass das nur der Betreiber kann
- [ ] Angenommen ein Mitglied (Mitarbeiter oder Inhaber) ist nicht der letzte Inhaber, wenn es nach Bestätigung „Team verlassen“ wählt, dann ist es kein Mitglied mehr und landet beim nächsten Kunden bzw. beim Hinweis „keinem Kunden zugeordnet“
- [ ] Angenommen ein Inhaber ist nicht der letzte Inhaber, wenn er sich selbst nach Bestätigung zum Mitarbeiter herabstuft, dann hat er ab sofort nur noch Mitarbeiter-Rechte
- [ ] Angenommen ein Inhaber ist der letzte Inhaber, wenn er austreten oder sich herabstufen will, dann ist das nicht möglich, mit dem Hinweis, zuerst einen anderen Inhaber zu bestimmen
- [ ] Angenommen ein Mitglied wurde entfernt, wenn man alte Einträge (z. B. Änderungsprotokoll) ansieht, dann ist sein Name dort weiterhin sichtbar

### Kunde
- [ ] Angenommen ein Inhaber ist angemeldet, wenn er unter „Einstellungen → Kunde“ den Kundennamen ändert und speichert, dann erscheint der neue Name sofort in der Seitenleiste bzw. im „Mehr“-Blatt, mit Bestätigung
- [ ] Angenommen der Kundenname ist leer oder länger als 200 Zeichen, wenn der Inhaber speichert, dann erscheint eine Meldung am Feld

### Kundenwechsel
- [ ] Angenommen eine Person ist Mitglied bei mehreren Kunden, wenn sie auf den Kundennamen in der Seitenleiste bzw. im „Mehr“-Blatt tippt, dann sieht sie alle ihre Kunden mit ihrer jeweiligen Rolle und kann wechseln; danach erscheint das Dashboard des gewählten Kunden
- [ ] Angenommen eine Person hat zuletzt Kunde B gewählt, wenn sie sich auf demselben Gerät neu anmeldet, dann ist Kunde B geöffnet
- [ ] Angenommen eine Person hat noch keinen Kunden gewählt, wenn sie sich anmeldet, dann ist der alphabetisch erste ihrer Kunden geöffnet
- [ ] Angenommen eine Person ist bei Kunde A Inhaber und bei Kunde B Mitarbeiter, wenn sie zu Kunde B wechselt, dann gelten ausschließlich ihre Mitarbeiter-Rechte (Navigation, Daten)
- [ ] Angenommen eine Person ist nur bei einem Kunden Mitglied, wenn der App-Rahmen angezeigt wird, dann gibt es keinen Kundenwechsel
- [ ] Angenommen eine Person hat keine Mitgliedschaft, wenn sie sich anmeldet, dann sieht sie den Hinweis „Du bist noch keinem Kunden zugeordnet“ (und ggf. offene Einladungen zum Annehmen) statt leerer Bereiche

### App-Rahmen
- [ ] Angenommen eine Person ist angemeldet und einem Kunden zugeordnet, wenn der Rahmen angezeigt wird, dann steht dort der echte Kundenname und ihre echte Rolle („Inhaber“ bzw. „Mitarbeiter“) statt der Platzhalter

### Design und Barrierefreiheit
- [ ] Angenommen die Team- oder Kunden-Seite wird am Handy (375 px) geöffnet, wenn sie angezeigt wird, dann ist alles ohne waagrechtes Scrollen bedienbar, Bedienelemente sind mindestens 44 × 44 px groß
- [ ] Angenommen eine Aktion ist folgenreich (Entfernen, Zurückziehen, Austreten, Herabstufen), wenn sie gewählt wird, dann erscheint ein Bestätigungsdialog, der per Tastatur bedienbar ist und vorgelesen wird

## Edge Cases
- **Mehrere Plattform-Konten:** Ein Kunde kann mehrere booking.com- und Airbnb-Konten haben. Das Kundenkonto in apppa ist davon unabhängig; die Verbindung erfolgt in PROJ-10. Kein Feld und keine Annahme „ein Konto je Plattform“ in PROJ-4
- **Einladung an die eigene Adresse:** wird abgewiesen („Du bist bereits Mitglied“)
- **Einladung an die Adresse des Betreiber-Admins:** wie jede andere Adresse (Admin bekommt dann eine normale Mitgliedschaft mit Schreibrechten bei diesem Kunden)
- **Groß-/Kleinschreibung und Leerzeichen** in der Adresse: werden normalisiert; `Maria@Example.at` und `maria@example.at` gelten als dieselbe Person
- **Zwei Inhaber laden gleichzeitig dieselbe Adresse ein:** es entsteht nur eine Einladung
- **Einladung wird zurückgezogen, während die Person sie gerade annimmt:** das Annehmen schlägt mit „nicht mehr gültig“ fehl
- **Person wird entfernt, während sie gerade arbeitet:** beim nächsten Seitenaufruf bzw. nächsten Speichern kein Zugriff mehr; sie landet beim nächsten Kunden oder beim Hinweis „keinem Kunden zugeordnet“
- **Gemerkter Kunde existiert nicht mehr bzw. Person wurde dort entfernt:** es wird automatisch der alphabetisch erste verbleibende Kunde geöffnet
- **Kunde wurde vom Betreiber deaktiviert (PROJ-5):** er erscheint nicht mehr in der Kundenliste der Mitglieder; ist es der einzige, erscheint der Hinweis „keinem Kunden zugeordnet“ bzw. „Konto deaktiviert, bitte an den Betreiber wenden“
- **Letzter Inhaber:** kann weder austreten noch sich herabstufen; zwei Inhaber, die gleichzeitig austreten, können nicht beide gehen (mindestens einer bleibt)
- **Einladung angenommen, aber der Kunde hat die Rolle zwischenzeitlich geändert:** es gilt die zuletzt in der Einladung gespeicherte Rolle
- **Mail kommt nicht an (Quarantäne/Spam):** Inhaber sieht die Einladung als „offen“ und kann erneut senden; Hinweis in der Bestätigung, auch im Spam-Ordner nachzusehen
- **Sehr viele Einladungen in kurzer Zeit** (Missbrauch, z. B. Werbeversand über apppa): Begrenzung pro Kunde und Stunde, danach neutrale Meldung „Bitte später erneut versuchen“

## Technical Requirements
- Sicherheit: Alle Rechte zusätzlich in der Datenbank durchgesetzt (nicht nur in der Oberfläche); Inhaber dürfen andere Inhaber nicht herabstufen/entfernen, Mitarbeiter keine Team-Daten ändern
- Sicherheit: Einladungs-Links nur einmal einlösbar, nur für die eingeladene Adresse, nach Zurückziehen oder Erneut-Senden ungültig
- Datenschutz: Mitarbeiter sehen keine E-Mail-Adressen anderer Teammitglieder außerhalb der Team-Seite (die sie nicht sehen)
- Kundenwechsel ohne Neuladen der Anmeldung; gewählter Kunde gilt für alle Daten der Seite
- Barrierefreiheit WCAG 2.1 AA, Handy 375 px

## Open Questions
- [ ] Welcher Anbieter verschickt die Hinweis-Mail an bestehende Konten (Brevo direkt, da Supabase nur Auth-Mails kennt)? → /architecture
- [ ] Obergrenze für Einladungen pro Kunde und Stunde (Vorschlag: 20) → /architecture
- [ ] Mail-Zustellung an M365-Empfänger (Quarantäne bei neuer Domain `apppa.at`) vor dem Pilotstart klären (offen aus PROJ-3)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Kundenkonto je Vermieter, darin beliebig viele booking.com-/Airbnb-Konten (Verbindung in PROJ-10) | Dashboard, Kalender, Gäste und Ortstaxe an einem Ort; Plattform-Konten sind Technik, nicht Organisation | 2026-10-23 |
| Nur Inhaber laden ein, wahlweise als Mitarbeiter oder Inhaber | Familienbetriebe brauchen oft zwei Inhaber; Mitarbeiter sollen den Zugang nicht ausweiten | 2026-10-23 |
| Bestehende Konten müssen Einladungen annehmen; Hinweis per Mail + Einladung in der App | Niemand landet ungefragt (z. B. durch Tippfehler) bei einem fremden Kunden mit Gästedaten | 2026-10-23 |
| Team-Seite zeigt offene/abgelaufene Einladungen; „Erneut senden“ und „Zurückziehen“ | Mail-Link gilt nur 24 h (PROJ-3); Inhaber soll sehen, wer nie beigetreten ist | 2026-10-23 |
| In-App-Einladung für bestehende Konten 14 Tage gültig | Kein Einmal-Link nötig, daher nicht an die 24-h-Grenze gebunden | 2026-10-23 |
| Inhaber sind voreinander geschützt: Herabstufen/Entfernen anderer Inhaber nur durch den Betreiber; Selbst-Austritt und Selbst-Herabstufung erlaubt (außer letzter Inhaber) | Schutz bei Streit unter Mitinhabern (z. B. Trennung); jeder kann selbst gehen | 2026-10-23 |
| Kundenwechsel in Seitenleiste/„Mehr“, letzter Kunde je Gerät gemerkt, sonst alphabetisch erster | Kein Extra-Klick nach jedem Login; Grundlage in PROJ-2 schon vorbereitet | 2026-10-23 |
| Einstellungen: „Team“ und „Kunde“ (nur Kundenname) | Weitere Firmendaten erst, wenn ein Feature sie braucht (PROJ-15/16) | 2026-10-23 |
| Keine Begrenzung der Teamgröße | Abrechnung außerhalb der App; Kunden haben wenige bis einige Dutzend Wohnungen | 2026-10-23 |
| Mitarbeiter sehen die Team-Seite nicht | Datensparsamkeit; Team-Verwaltung ist Inhaber-Aufgabe | 2026-10-23 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|

### Hinweis für /architecture
Die Datenbank-Regeln aus PROJ-1 erlauben Inhabern derzeit, **alle** Rollen zu ändern und **alle** Mitglieder zu entfernen. Für die Entscheidung „Inhaber sind voreinander geschützt“ müssen sie angepasst werden (Änderungen an RLS brauchen ausdrückliche Freigabe).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
