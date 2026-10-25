# PROJ-4: Kundenkonten & Rollen

## Status: Deployed
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
- [x] Hinweis-Mail an bestehende Konten → direkt über die Brevo-Schnittstelle, neuer API-Schlüssel (geklärt 2026-10-23)
- [x] Obergrenze → 20 Einladungen pro Kunde und Stunde (geklärt 2026-10-23)
- [x] Geänderte Datenbank-Regeln für Mitgliedschaften (Änderung an RLS aus PROJ-1) vom Nutzer freigegeben (2026-10-23)
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
| Einladungen als eigene Datensätze (je Kunde, Zustand offen/angenommen/abgelehnt/zurückgezogen, eine offene pro Adresse) | Anzeige, erneut senden, zurückziehen und Zustimmung bestehender Konten nur so möglich | 2026-10-23 |
| Mitgliedschaften entstehen nur durch Annehmen einer Einladung (oder durch den Betreiber); direktes Hinzufügen durch Inhaber in der Datenbank gesperrt | Zustimmung technisch erzwungen, nicht nur in der Oberfläche | 2026-10-23 |
| Datenbank-Regeln: Inhaber ändern/entfernen nur Mitarbeiter; Selbst-Austritt/-Herabstufung erlaubt; „mindestens ein Inhaber“ bleibt | Setzt die Produktentscheidung „Inhaber voreinander geschützt“ durch | 2026-10-23 |
| Neue Personen: Supabase-Einladung (Brevo-SMTP, Vorlage mit Kundenname); Zurückziehen löscht ungenutzte Login-Konten | Nutzt den geprüften Ablauf aus PROJ-3; alte Links laufen ins Leere | 2026-10-23 |
| Bestehende Konten: Hinweis-Mail direkt über die Brevo-Schnittstelle (neuer geheimer API-Schlüssel), Annehmen in der App | Supabase verschickt keine eigenen Hinweis-Mails; kein Einmal-Link nötig | 2026-10-23 |
| Gewählter Kunde per Cookie je Gerät, auf dem Server gegen die Mitgliedschaften geprüft | Gerätebezogen wie gewünscht, keine Tabelle; Rechte prüft weiter die Datenbank | 2026-10-23 |
| Höchstens 20 Einladungen pro Kunde und Stunde | Schutz vor Missbrauch des Mailversands über apppa | 2026-10-23 |
| Abgeschlossene Einladungen nach 90 Tagen löschen | Datensparsamkeit (E-Mail-Adressen von Nicht-Mitgliedern) | 2026-10-23 |

### Hinweis für /architecture
Die Datenbank-Regeln aus PROJ-1 erlauben Inhabern derzeit, **alle** Rollen zu ändern und **alle** Mitglieder zu entfernen. Für die Entscheidung „Inhaber sind voreinander geschützt“ müssen sie angepasst werden (Änderungen an RLS brauchen ausdrückliche Freigabe).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-4 braucht **Frontend und Backend**. Das Fundament aus PROJ-1 (Kunden, Mitgliedschaften, Rollen, Abschottung) bleibt. Neu kommen hinzu: offene Einladungen als eigene Datensätze, der „aktuell gewählte Kunde“ je Gerät und schärfere Datenbank-Regeln für Rollen (Inhaber voreinander geschützt, Mitgliedschaften nur nach Zustimmung). Alle Aktionen laufen als Server-Aktionen wie in PROJ-3.

### A) Seiten und Bausteine
```
App-Rahmen (PROJ-2)
+-- Seitenleiste / „Mehr“-Blatt
|   +-- Kundenname → bei mehreren Kunden: Auswahl (Liste mit Rolle je Kunde, aktueller markiert)
|   +-- Name · echte Rolle („Inhaber“ / „Mitarbeiter“) beim gewählten Kunden
+-- Navigation nach Rolle des gewählten Kunden; „Einstellungen“ nur für Inhaber

/einstellungen (nur Inhaber)            → leitet auf /einstellungen/team
+-- Reiter „Team“ | „Kunde“
+-- /einstellungen/team
|   +-- Seitenkopf mit Hauptaktion „Person einladen“
|   +-- Mitglieder (Tabelle; am Handy Karten): Name, E-Mail, Rolle, Aktionen-Menü
|   |     Aktionen je nach Fall: „Zum Inhaber machen“, „Entfernen“ (nur Mitarbeiter),
|   |     bei sich selbst: „Zum Mitarbeiter herabstufen“, „Team verlassen“; bei anderen Inhabern keine
|   +-- Offene Einladungen: E-Mail, Rolle, Datum, Status offen/abgelaufen; „Erneut senden“, „Zurückziehen“
|   +-- Leerzustand „Noch niemand eingeladen“ mit „Person einladen“
|   +-- Detail-Panel „Person einladen“: E-Mail-Adresse, Rolle (Mitarbeiter/Inhaber), „Einladen“
|   +-- Bestätigungsdialoge für alle folgenreichen Aktionen
+-- /einstellungen/kunde
    +-- Kundenname (max. 200 Zeichen), „Speichern“

Ohne gewählten Kunden (keine Mitgliedschaft)
+-- Dashboard zeigt „Du bist noch keinem Kunden zugeordnet“
+-- darunter: offene Einladungen an mich mit „Annehmen“ / „Ablehnen“

Mit Kunden, aber offene Einladung an mich (bestehendes Konto)
+-- Hinweis-Leiste oben im Dashboard: „X hat dich zu ‚Kunde‘ eingeladen“ → „Annehmen“ / „Ablehnen“
```
Für Mitarbeiter gibt es `/einstellungen` nicht („Seite nicht gefunden“). Vorhandene Bausteine: Seitenkopf, Detail-Panel, Leerzustand (PROJ-2); shadcn Table, Badge, Radio-Group, Popover/Command (Kundenauswahl), Alert-Dialog, Dropdown-Menu.

### B) Daten (in Worten)

**Bestehend (PROJ-1), unverändert:** Kunden (Name, Status aktiv/deaktiviert), Profile, Mitgliedschaften (Person ↔ Kunde mit Rolle).

**Neu: Einladungen** (gehören zu einem Kunden, Standardfelder und Änderungsprotokoll wie alle Fachdaten)
- Kunde, E-Mail-Adresse (normalisiert: klein, ohne Leerzeichen), Rolle (Inhaber/Mitarbeiter)
- Art: „neues Konto“ (Mail-Link, 24 h) oder „bestehendes Konto“ (in der App, 14 Tage)
- eingeladen von, zuletzt verschickt am, gültig bis
- Zustand: offen, angenommen, abgelehnt, zurückgezogen
- Regel: pro Kunde und Adresse höchstens **eine** offene Einladung
- Lesen: Inhaber des Kunden; die eingeladene Person nur ihre eigenen Einladungen (Abgleich mit ihrer Konto-Adresse)
- Abgeschlossene Einladungen (angenommen/abgelehnt/zurückgezogen) werden nach 90 Tagen gelöscht (Zeitplaner wie in PROJ-1/3)

**Neu: gewählter Kunde je Gerät:** Ein Cookie merkt sich, welcher Kunde zuletzt geöffnet war. Der Server prüft bei jedem Aufruf, ob die Person dort (noch) Mitglied ist; sonst nimmt er den alphabetisch ersten Kunden. Keine Datenbank-Tabelle nötig.

**Geänderte Regeln für Mitgliedschaften** (Datenbank, betrifft PROJ-1, **Freigabe nötig**):
- Neue Mitgliedschaften entstehen **nur** durch Annehmen einer Einladung (bzw. durch den Betreiber in PROJ-5), nicht mehr durch direktes Hinzufügen durch Inhaber. So ist die Zustimmung technisch erzwungen.
- Inhaber dürfen **Mitarbeiter** hochstufen und entfernen, aber **keine anderen Inhaber** herabstufen oder entfernen.
- Jede Person darf **sich selbst** entfernen oder herabstufen.
- Die bestehende Regel „mindestens ein Inhaber“ bleibt und gilt für alle Fälle.

### C) Technische Entscheidungen (begründet)

**Einladungen als eigene Datensätze statt direkt als Mitgliedschaft.** Nur so lassen sich offene, abgelaufene und abgelehnte Einladungen anzeigen, erneut senden und zurückziehen, und nur so ist die Zustimmung bestehender Konten möglich.

**Neue Personen: Supabase-Einladung über Brevo (wie PROJ-3).** Der Server legt das Login-Konto an und lässt Supabase die deutsche Einladungsmail schicken; die Vorlage zeigt zusätzlich Kundenname und Einladende(n). Nach „Einladung annehmen“ + Name/Passwort (PROJ-3) wird die Einladung automatisch eingelöst und die Mitgliedschaft angelegt. „Erneut senden“ schickt einen frischen Link (der alte wird ungültig). „Zurückziehen“ entfernt die Einladung; ein noch nicht genutztes Login-Konto ohne andere Einladungen wird mit gelöscht, sodass ein alter Link ins Leere führt („nicht mehr gültig“).

**Bestehende Konten: Hinweis-Mail direkt über Brevo.** Supabase verschickt nur Anmelde-Mails (Einladung, Reset). Für „X hat dich zu Kunde Y eingeladen“ ruft der Server Brevo direkt auf (gleicher Absender `no-reply@apppa.at`, deutscher Text). Dafür braucht es einen **Brevo-API-Schlüssel als neue geheime Umgebungsvariable** (nur Server, in `.env.local` und Vercel). Die Mail enthält keinen Einmal-Link, nur den Hinweis, sich anzumelden; angenommen wird in der App. Kommt die Mail nicht an, sieht die Person die Einladung trotzdem beim nächsten Anmelden.

**Annehmen/Ablehnen als geprüfte Server-Aktion.** Beim Annehmen prüft der Server: Einladung offen, nicht abgelaufen, Adresse passt zum angemeldeten Konto, Kunde aktiv. Erst dann entsteht die Mitgliedschaft (in einem Schritt mit dem Abschluss der Einladung, damit nichts doppelt passiert).

**Gewählter Kunde per Cookie, geprüft auf dem Server.** Einfach, gerätebezogen wie gewünscht, ohne Datenbank. Die Rechte prüft weiterhin die Datenbank pro Kunde (RLS aus PROJ-1); das Cookie entscheidet nur, *welcher* Kunde angezeigt wird, nie, *ob* jemand darf.

**Rolle im App-Rahmen aus der Mitgliedschaft beim gewählten Kunden.** Ersetzt den Platzhalter aus PROJ-2; Navigation und Seiten-Zugang (`/einstellungen` nur Inhaber) richten sich danach, zusätzlich zur Prüfung in der Datenbank.

**Missbrauchsschutz:** höchstens 20 Einladungen pro Kunde und Stunde (gezählt an den Einladungs-Datensätzen); darüber neutrale Meldung. Dazu greifen die Mail-Grenzen von Supabase/Brevo.

**Zurückziehen während des Annehmens / gleichzeitige Einladungen:** Die Regel „eine offene Einladung pro Kunde und Adresse“ und das Annehmen in einem Schritt verhindern Doppelungen; wer zu spät kommt, bekommt „nicht mehr gültig“.

**Tests:** Integrationstests gegen „apppa-dev“ für die neuen Datenbank-Regeln (Inhaber kann anderen Inhaber nicht entfernen, Mitarbeiter kann nichts am Team ändern, direktes Hinzufügen ohne Einladung verweigert, Einladung nur von der eingeladenen Adresse annehmbar, letzter Inhaber), E2E für Einladen, Annehmen, Rollen, Kundenwechsel in allen drei Breiten.

### D) Abhängigkeiten (Pakete)
- Keine neuen Pakete. Brevo wird über seine Web-Schnittstelle direkt angesprochen; alle UI-Bausteine sind installiert.

### E) Einrichtung außerhalb des Codes (mit dem Nutzer)
1. Brevo → *SMTP & API → API Keys*: API-Schlüssel erzeugen, als `BREVO_API_KEY` in `.env.local` eintragen (später auch in Vercel); `.env.local.example` bekommt einen Platzhalter
2. Einladungsvorlage in Supabase um Kundenname/Einladende(n) ergänzen → `config push` wie in PROJ-3 (Runbook Abschnitt 8)

## Implementation Notes (Frontend)
_Stand 2026-10-23 (/frontend)_

**Seiten** (`src/app/(app)/einstellungen/`, nur Inhaber über `requireArea('settings')`; Mitarbeiter → „Seite nicht gefunden“): `/einstellungen` → `/einstellungen/team`; Layout mit Seitenkopf und Reitern „Team“ | „Kunde“ (Links, eigene Adressen). „Einstellungen“ ist in der Navigation jetzt sichtbar (`ready: true`, nur Inhaber)

**Team** (`src/components/settings/`): `team-members` (ab 768 px Tabelle, darunter Karten; Rolle als Badge; Hinweis unter der Rolle, warum es keine Aktionen gibt), `member-actions` (Menü „Zum Inhaber machen“, „Entfernen“, „Zum Mitarbeiter herabstufen“, „Team verlassen“, jeweils mit Bestätigungsdialog), `invitations-list` (offen/abgelaufen, „Erneut senden“, „Zurückziehen“ mit Bestätigung), `invite-panel` (Detail-Panel: E-Mail + Rolle als Auswahl mit Erklärung), Leerzustand „Noch niemand eingeladen“. `tenant-name-form` für „Kunde“

**Rechte-Regeln** `src/lib/team-rules.ts` (rein, getestet): Inhaber → Mitarbeiter hochstufen/entfernen; andere Inhaber geschützt; Selbst-Herabstufung/Austritt außer letzter Inhaber. Die Datenbank setzt dieselben Regeln mit /backend durch

**Kundenwechsel**: `src/components/shell/tenant-label.tsx` mit Popover-Liste (Name + Rolle, aktueller markiert); Wechsel per Server-Aktion, danach vollständiger Seitenwechsel. `ShellInfo.tenant` hat jetzt `id` und `list` (`null` = noch nicht geladen)

**Dashboard**: `src/components/tenant/my-invitations.tsx` (Einladungen an mich mit „Annehmen“/„Ablehnen“) und Hinweis „Du bist noch keinem Kunden zugeordnet“, sobald die Kundenliste leer ist

**Gemeinsam**: `src/components/confirm-dialog.tsx` (Bestätigung), `src/components/settings/use-team-action.ts` (Aktion → Meldung → neu laden). `ActionResult` hat einen zweiten Typparameter für bereichseigene Fehlercodes; `FormError` kann Texte aus `team.errors` zeigen

**Prüfregeln** `src/lib/validation/team.ts` (Einladen: Adresse normalisiert + Rolle; Kundenname 1–200 Zeichen). Texte in `messages/de.json` (`settings`, `team`, `tenant`)

**Schnittstellen für /backend** (liefern bis dahin `notImplemented`): `src/app/(app)/einstellungen/actions.ts` (`inviteMember`, `resendInvitation`, `revokeInvitation`, `promoteMember`, `removeMember`, `demoteSelf`, `leaveTenant`, `updateTenantName`), `src/app/(app)/tenant-actions.ts` (`switchTenant`, `acceptInvitation`, `declineInvitation`). Daten: `src/lib/team.ts` (`getTeam()` liefert **Beispieldaten** mit sichtbarem Hinweis, `getMyInvitations()` leer), `getShellInfo()` Kunde/Liste noch Platzhalter

**Tests**: `team-rules.test.ts` (5), `validation/team.test.ts` (4); `navigation.test.ts` und PROJ-2-E2E an die sichtbaren Einstellungen angepasst. `npm test` (Unit) 142/142, `tsc` fehlerfrei, PROJ-2-E2E Desktop + Handy grün. Sichtprüfung in Chrome (1440 und 375 px): Team-Tabelle/Karten, Einladen-Panel mit Feldmeldung, Bestätigungsdialog, Kunden-Seite

**Offen für /backend**: Einladungs-Tabelle und geänderte Datenbank-Regeln (freigegeben), alle Server-Aktionen, echte Daten statt Beispieldaten, gewählter Kunde per Cookie, Rolle im Rahmen aus der Mitgliedschaft, Einladungsvorlage mit Kundenname, Hinweis-Mail über Brevo (`BREVO_API_KEY`)

## Implementation Notes (Backend)
_Stand 2026-10-23 (/backend)_

**Datenbank** (eingespielt in „apppa-dev“):
- `20261023120000_invitations_and_membership_rules.sql`: Tabelle `public.invitations` (Kunde, E-Mail normalisiert, Rolle, Art `new_account`/`existing_account`, Zustand offen/angenommen/abgelehnt/zurückgezogen, eingeladen von, verschickt am, gültig bis; eine offene je Kunde + Adresse; Standardfelder + Änderungsprotokoll; Löschung abgeschlossener nach 90 Tagen). RLS: Inhaber lesen/anlegen/ändern, Admin liest, kein Löschen. **Mitgliedschaften (freigegeben):** kein direktes Hinzufügen mehr; Inhaber stufen nur Mitarbeiter hoch und entfernen nur Mitarbeiter; jede Person kann sich selbst herabstufen bzw. austreten; „mindestens ein Inhaber“ bleibt
- `20261023120100_invitation_functions_private.sql`: Annehmen, Ablehnen, eigene Einladungen lesen und Einlösen nach dem Einrichten als geprüfte Funktionen im internen Schema; öffentlich nur dünne Hüllen ohne Systemrechte (Advisor 0029). Abgleich über die Adresse des angemeldeten Kontos aus der Datenbank
- Ein PROJ-1-Integrationstest (Inhaber fügt direkt hinzu) an die neue Regel angepasst

**Server**: `src/lib/tenant.ts` (gewählter Kunde per Cookie `apppa-kunde`, gegen Mitgliedschaften geprüft, sonst alphabetisch erster), `src/lib/shell.ts` (echter Kunde, Kundenliste, Rolle; ohne Kunde Rolle „staff“), `src/lib/team-data.ts` (Team, Einladungen an mich), `src/lib/team-invite.ts` (Art der Einladung, Versand, Aufräumen ungenutzter Konten; keine Server-Aktion), `src/lib/mail/brevo.ts` (Hinweis-Mail, HTML-maskiert; ohne `BREVO_API_KEY` kein Versand)

**Server-Aktionen** (alle umgesetzt, Rechte zusätzlich in der Datenbank): Einladen (Rate-Limit 20/h, „schon Mitglied“, „schon eingeladen“, „du selbst“), erneut senden (frischer Link bzw. erneute Hinweis-Mail, Art wird neu bestimmt), zurückziehen (ungenutztes Login-Konto wird gelöscht → alter Link ungültig), hochstufen, entfernen, selbst herabstufen, austreten, Kundenname, Kundenwechsel, annehmen, ablehnen. Nach Anmelden bzw. Einladung-Abschließen (PROJ-3) werden offene Einladungen „neues Konto“ automatisch eingelöst

**Art der Einladung**: Konto mit bestätigter Adresse → Hinweis-Mail + Annehmen in der App (14 Tage); kein Konto oder frühere Einladung nie angenommen → Supabase-Einladungsmail (24 h)

**Mails**: `invite.html` nennt Kunde und einladende Person (aus den Konto-Metadaten) → **`config push` nötig** (Runbook 8). Hinweis-Mail braucht `BREVO_API_KEY` (Runbook 11) – bis dahin erscheint die Einladung nur in der App

**Tests**: `supabase/tests/team.integration.test.ts` (12: kein direktes Hinzufügen, Hochstufen, Inhaber geschützt, Mitarbeiter ohne Rechte, letzter Inhaber, doppelte Einladung, Mitarbeiter sieht keine Einladungen, Annehmen nur durch Eingeladene und nur einmal, abgelaufen, Ablehnen, Einlösen nach dem Einrichten), `src/lib/mail/brevo.test.ts` (3, u. a. HTML-Maskierung), Einladungsstatus. `npm test` 146 Unit + 43 Integration grün; Advisor nur die bekannten Punkte (24-h-Links, Pro-Tarif). E2E: Testnutzer ist jetzt Inhaber von „Testkunde E2E“; PROJ-2 (Desktop + Handy) und PROJ-3 (Anmelden, Einladung) grün. Browser-Probe: einladen (bestehendes Konto), annehmen, hochstufen, Kundenwechsel, Mitarbeiter ohne Einstellungen

**Hinweise für /qa**: Mitarbeiter sehen auf `/einstellungen/*` „Seite nicht gefunden“, der Statuscode ist aber 200 (die App-Seiten werden gestreamt); es werden keine Team-Daten ausgeliefert. Einladungen an **neue** Adressen verschicken echte Mails über Brevo – in Tests nur bestehende Testkonten einladen oder Links per `admin.generateLink` erzeugen. `BREVO_API_KEY`/`BREVO_SENDER_EMAIL` noch in `.env.local.example` ergänzen (Datei für mich gesperrt)

## QA Test Results

**Tested:** 2026-10-24
**App URL:** http://localhost:3000 (Dev-Server) gegen Supabase „apppa-dev“
**Tester:** QA Engineer (AI)
**Browser:** Google Chrome (Playwright) in 1440 und 375 px (Tablet über PROJ-2-Regression). Firefox und Safari nicht getestet (wie bisher)

**Automatische Tests**
- `npm test`: 189/189 grün (Unit + Integration, davon 12 PROJ-4-Datenbank-Regeln)
- Neu: `tests/PROJ-4-kundenkonten-rollen.spec.ts` (31 Tests; Abläufe Desktop, Layout/Barrierefreiheit Desktop + Handy, Kundenwechsel im „Mehr“-Blatt). Ergebnis: **30 grün, 1 rot (= BUG-1)**
- Mails im Test abgeschaltet: `playwright.config.ts` startet den Dev-Server mit leerem `BREVO_API_KEY`; Einladungen nur an bestehende Testkonten bzw. direkt angelegt, Links für neue Personen über `admin.generateLink` – es gehen keine Mails an Testadressen
- Regression: PROJ-2 (Desktop + Handy) 36/36, PROJ-3 Abläufe 26/26 grün (ein Test erst im zweiten Anlauf: Supabase-Grenze 30 Bestätigungen/5 min)

### Acceptance Criteria Status

#### Team-Seite
- [x] Mitglieder mit Name, E-Mail, Rolle; offene und abgelaufene Einladungen getrennt mit Status (E2E)
- [x] Mitarbeiter: „Einstellungen“ fehlt, Team-Seite zeigt „Seite nicht gefunden“, keine Team-Daten (E2E; Statuscode siehe BUG-2)
- [x] Nur Inhaber, keine Einladungen → Leerzustand mit „Person einladen“ (E2E)

#### Einladen
- [x] Einladen (Adresse normalisiert, Rolle wählbar) → sofort „offen“ in der Liste + Bestätigung (E2E)
- [x] Neue Person: Einladungslink → Name + Passwort → Mitglied mit gewählter Rolle (E2E über `generateLink`). Die echte Supabase-Einladungsmail mit Kundenname wurde nicht verschickt (Testadressen); Vorlage ist übertragen (`config diff` ohne Abweichung)
- [x] Bestehendes Konto: echte Hinweis-Mail über Brevo kam beim Nutzer an (2026-10-24); Einladung auf dem Dashboard, „Annehmen“ → Mitglied (E2E)
- [x] Ablehnen → Einladung geschlossen, erneut einladbar (E2E + Integration)
- [x] Leere/ungültige Adresse → Meldung am Feld, nichts angelegt (E2E)
- [x] Schon Mitglied / schon eingeladen / eigene Adresse → Hinweis, keine doppelte Einladung (E2E)
- [x] Erneut senden → Datum neu, Status wieder „offen“ (E2E, bestehendes Konto); frischer Link für neue Personen per Code-Review (ersetzt den Supabase-Link)
- [x] Zurückziehen → aus der Liste; Link einer neuen Person führt zu „nicht mehr gültig“ (E2E)
- [x] Abgelaufen-Markierung (E2E bestehendes Konto; 24-h-Grenze neuer Personen per Code + Unit-Test)

#### Rollen und Mitglieder
- [x] Mitarbeiter zum Inhaber machen (E2E + Integration)
- [x] Mitarbeiter entfernen; entferntes Mitglied verliert beim nächsten Seitenaufruf den Zugriff (E2E)
- [x] Andere Inhaber geschützt: keine Aktionen, Hinweis; Datenbank verweigert (E2E + Integration)
- [x] „Team verlassen“ für Inhaber (Team-Seite) und für alle Mitglieder unter „Mein Konto“ (E2E; war BUG-1, behoben)
- [x] Inhaber stuft sich selbst herab (weitere Inhaber vorhanden) → Mitarbeiter, Einstellungen weg (E2E)
- [x] Letzter Inhaber: keine Aktionen, Hinweis; Datenbank verweigert (E2E + Integration)
- [ ] Nicht prüfbar: Name entfernter Mitglieder in alten Einträgen – es gibt noch keine Verlaufsansicht. Die Daten bleiben erhalten (Profil wird nicht gelöscht, Änderungsprotokoll speichert die Person)

#### Kunde
- [x] Kundenname ändern → sofort in der Seitenleiste, Bestätigung (E2E)
- [x] Leer → Meldung; > 200 Zeichen nicht eingebbar, Server prüft zusätzlich (E2E)

#### Kundenwechsel
- [x] Auswahl mit Rolle je Kunde, Wechsel → Dashboard des Kunden (E2E Desktop + „Mehr“-Blatt am Handy)
- [x] Zuletzt gewählter Kunde bleibt nach neuer Anmeldung auf demselben Gerät (E2E)
- [x] Ohne gemerkten Kunden alphabetisch erster (E2E)
- [x] Rechte je Kunde: bei Mitarbeiter-Kunde keine Einstellungen (E2E)
- [x] Eine Mitgliedschaft → kein Wechsel (E2E)
- [x] Keine Mitgliedschaft → „Du bist noch keinem Kunden zugeordnet“ (E2E)

#### App-Rahmen
- [x] Echter Kundenname und Rolle („Mitarbeiter“/„Inhaber“) (E2E, alle Breiten über PROJ-2)

#### Design und Barrierefreiheit
- [x] Team- und Kunden-Seite bei 375 und 1440 px ohne waagrechtes Scrollen, alle Bedienelemente ≥ 44 px, axe WCAG 2.1 AA ohne Befund (E2E)
- [x] Bestätigungsdialoge für alle folgenreichen Aktionen, per Tastatur bedienbar (E2E)

### Edge Cases Status
- [x] Mehrere Plattform-Konten: keine Annahme „ein Konto je Plattform“ (Datenmodell, Code-Review)
- [x] Einladung an die eigene Adresse → „Du bist bereits Mitglied“ (E2E)
- [x] Groß-/Kleinschreibung und Leerzeichen → normalisiert (E2E)
- [x] Zwei gleichzeitige Einladungen → nur eine (Datenbank-Regel, Integration)
- [x] Zurückziehen während des Annehmens → „nicht mehr gültig“ (Annehmen prüft den Zustand in einem Schritt; Integration)
- [x] Entfernt während der Arbeit → nächster Seitenaufruf ohne Zugriff (E2E)
- [x] Gemerkter Kunde nicht mehr verfügbar → nächster Kunde bzw. Hinweis (E2E „Team verlassen“)
- [x] Deaktivierter Kunde verschwindet für Mitglieder, seine Einladungen erscheinen nicht (E2E); ein eigener Hinweis „Konto deaktiviert“ fehlt noch (folgt sinnvoll mit PROJ-5)
- [x] Letzter Inhaber / gleichzeitiges Austreten → Datenbank-Sperre mit Mandanten-Lock (PROJ-1)
- [x] Missbrauch: mehr als 20 Einladungen pro Stunde → neutrale Meldung (E2E)

### Security Audit Results
- [x] Rechte in der Datenbank: kein direktes Hinzufügen, Inhaber geschützt, Mitarbeiter ohne Team-Rechte, letzter Inhaber, Einladungen nur für Inhaber sichtbar (12 Integrationstests)
- [x] Annehmen nur durch die eingeladene Adresse und nur einmal; abgelaufene/deaktivierte ausgeschlossen (Integration + E2E)
- [x] Gefälschtes Kunden-Cookie eines fremden Kunden wird ignoriert (E2E)
- [x] HTML im Kundennamen wird nicht ausgeführt (E2E); Hinweis-Mail maskiert Namen (Unit)
- [x] Funktionen mit Systemrechten liegen im internen Schema; Supabase-Advisor nur die bekannten Punkte
- [x] Server-Aktionen prüfen Sitzung, 2FA-Stufe und Inhaber-Rolle des gewählten Kunden (Code-Review); Versandfunktionen mit Systemrechten sind keine Server-Aktionen
- [x] Kein Geheimnis im Repository: Ein versehentlich in `.env.local.example` eingetragener Brevo-Schlüssel wurde vor dem Push abgefangen und erneuert
- [x] Mitarbeiter bekommen auf `/einstellungen/*` „Seite nicht gefunden“ mit Statuscode 404 (war BUG-2, behoben)

### Bugs Found

#### BUG-1: Mitarbeiter können ein Team nicht selbst verlassen — ✅ behoben (Nachprüfung 2026-10-24)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Als Mitarbeiter eines Kunden anmelden
  2. Nach „Team verlassen“ suchen (Benutzermenü, Mein Konto, Seitenleiste)
  3. Expected: Möglichkeit „Team verlassen“ mit Bestätigung (Akzeptanzkriterium „Mitglied (Mitarbeiter oder Inhaber) … Team verlassen“)
  4. Actual: Die Aktion gibt es nur auf der Team-Seite, die Mitarbeiter nicht sehen dürfen. Umweg: Ein Inhaber entfernt die Person
- **Vorschlag:** „Team verlassen“ unter „Mein Konto“ (für den gewählten Kunden) oder im Benutzermenü; Server-Aktion und Datenbank-Regel existieren bereits
- **Priority:** Fix before deployment

#### BUG-2: Statuscode 200 statt 404 für Mitarbeiter auf den Einstellungen — ✅ behoben (Nachprüfung 2026-10-24)
- **Severity:** Low
- **Steps to Reproduce:** Als Mitarbeiter `/einstellungen/team` aufrufen → Ansicht „Seite nicht gefunden“, Antwort aber 200 (die App-Seiten werden mit Ladeanzeige gestreamt, bevor die Rollenprüfung greift)
- **Folge:** Keine Daten sichtbar; nur Suchmaschinen/Monitoring sähen eine „gefundene“ Seite
- **Priority:** Nice to have

### Fixes und Nachprüfung (2026-10-24)
- **BUG-1:** Neuer Bereich „Kunde verlassen“ unter „Mein Konto“ (`src/components/account/leave-tenant.tsx`) für den gewählten Kunden, mit Bestätigung; für den letzten Inhaber stattdessen der Hinweis. Nutzt die bestehende Server-Aktion `leaveTenant` und die Datenbank-Regel
- **BUG-2:** Die Vorschaltung gibt den aufgerufenen Pfad als `x-pathname` weiter (überschreibt mitgeschickte Werte); der App-Rahmen prüft `/einstellungen` vor dem Streaming → echte 404. Die Prüfung im Einstellungs-Layout bleibt zusätzlich bestehen
- Nachprüfung: `npm test` 189/189; PROJ-4-E2E 33/33 (Desktop + Handy, inkl. neuer Tests „Mitarbeiter verlässt über Mein Konto“, „letzter Inhaber: Hinweis“, 404 auf drei Einstellungs-Adressen); Regression PROJ-2 36/36, PROJ-3 Abläufe grün
- Hinweis Tests: Playwright mit `--global-timeout` in kleinen Paketen ausführen (lange Läufe wurden in dieser Umgebung abgebrochen)

#### BUG-3: Kundenwechsel zeigt in Firefox kurz „Da ist etwas schiefgelaufen“ (gemeldet in Production) — behoben auf `main`, Nachprüfung in Firefox offen
- **Severity:** Low (der Wechsel gelingt, die Fehlerseite ist nur kurz zu sehen)
- **Steps to Reproduce:** In Firefox (macOS) als Person mit zwei Kunden auf dem Dashboard oben links den Kunden wechseln; Chrome ist nicht betroffen
- **Ursache:**
  - Die Server-Aktion `switchTenant` setzte das Kunden-Cookie. Next.js rendert daraufhin die aktuelle Seite neu und schickt sie hinterher.
  - Gleichzeitig startete `window.location.assign('/')` den Seitenwechsel.
  - Firefox bricht die noch laufende Antwort mit einem Fehler ab, und React zeigt bis zum Laden der neuen Seite die Fehlerseite.
- **Behebung (2026-10-25):**
  - Der Wechsel ist jetzt ein normales Formular (POST an den Route-Handler `src/app/kunde-wechseln/route.ts`): Mitgliedschaft prüfen, Cookie setzen, Weiterleitung 303 auf `/`. Das ist ein echter Seitenwechsel ohne parallele Anfrage.
  - Die Server-Aktion `switchTenant` ist entfernt.
  - Schutz: Fremde Herkunft → 403; die Sitzungs-Cookies sind SameSite=Lax; nur eigene Kunden sind wählbar.
  - Verworfen: `redirect('/')` in der Server-Aktion. Der App-Rahmen prüft Detailseiten anhand von `x-pathname`, der bei Aktionen noch die alte Seite nennt. Außerdem blieben „Mehr“-Blatt und Auswahl offen.
- **Tests:**
  - Neu: „Sicherheit: /kunde-wechseln wählt keinen fremden Kunden und lehnt fremde Herkunft ab“.
  - PROJ-4-Kundenwechsel (Desktop und Handy) grün, Vitest 326/326, Build grün.
  - Firefox ist in Playwright hier nicht installiert; die Nachprüfung in Firefox steht aus.

### Summary
- **Acceptance Criteria:** 30/31 bestanden, 1 nicht prüfbar (Verlaufsansicht fehlt noch; Daten bleiben erhalten)
- **Bugs Found:** 2 (1 medium, 1 low), beide behoben und nachgeprüft
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Freigeben
## Deployment
_Stand 2026-10-25 (/deploy, erstes Release über Staging, Tag `v1.0.0`)_

- **Staging:** https://staging.apppa.at (Vercel `apppa-staging`, Supabase `iikzjqjjxoznrkkixfqa`). Freigegeben nach Prüfung von Anmeldung mit 2FA, Betreiber-Bereich, Einladung, Team und Wohnungen
- **Production:** https://app.apppa.at (Vercel `apppa`, Supabase `ahclrqbhfpidxjzbpfgb`), Commit `cedd560`, 2026-10-25
- **Migrationen:** alle 13 bis `20261024140200_apartments_fk_indexes.sql` in Staging und Production eingespielt (2026-10-24), Advisors ohne Befund. Im Release selbst gab es keine neuen
