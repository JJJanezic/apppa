# PROJ-4: Kundenkonten & Rollen

## Status: Architected
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

**Tests:** Integrationstests gegen „apppa“ für die neuen Datenbank-Regeln (Inhaber kann anderen Inhaber nicht entfernen, Mitarbeiter kann nichts am Team ändern, direktes Hinzufügen ohne Einladung verweigert, Einladung nur von der eingeladenen Adresse annehmbar, letzter Inhaber), E2E für Einladen, Annehmen, Rollen, Kundenwechsel in allen drei Breiten.

### D) Abhängigkeiten (Pakete)
- Keine neuen Pakete. Brevo wird über seine Web-Schnittstelle direkt angesprochen; alle UI-Bausteine sind installiert.

### E) Einrichtung außerhalb des Codes (mit dem Nutzer)
1. Brevo → *SMTP & API → API Keys*: API-Schlüssel erzeugen, als `BREVO_API_KEY` in `.env.local` eintragen (später auch in Vercel); `.env.local.example` bekommt einen Platzhalter
2. Einladungsvorlage in Supabase um Kundenname/Einladende(n) ergänzen → `config push` wie in PROJ-3 (Runbook Abschnitt 8)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
