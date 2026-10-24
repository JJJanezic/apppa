# PROJ-5: Betreiber-Admin

## Status: In Progress
**Created:** 2026-10-24
**Last Updated:** 2026-10-24

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup): Kennzeichnung Betreiber-Admin, Lesezugriff des Admins auf alle Mandanten, Regel „mindestens ein Inhaber“, Änderungsprotokoll
- Requires: PROJ-3 (Authentifizierung): 2FA-Pflicht für den Admin, Einladung annehmen, Mail-Versand über Brevo
- Requires: PROJ-4 (Kundenkonten & Rollen): Einladungen (neue Person / bestehendes Konto), Rollen Inhaber/Mitarbeiter, Kundenwechsel, Zustand „keinem Kunden zugeordnet“
- Nutzt: PROJ-2 (App-Shell): Navigation, Design-System
- Grundlage für: PROJ-21 (Selbstregistrierung ersetzt später teilweise das Anlegen durch den Betreiber); spätere Support-Ansicht (nach PROJ-8)

## User Stories
- Als **Betreiber** möchte ich einen neuen Kunden mit Namen und E-Mail-Adresse des ersten Inhabers in einem Schritt anlegen, damit das Onboarding eines Pilotkunden nur eine Minute dauert.
- Als **Betreiber** möchte ich alle Kunden in einer Liste mit Suche sehen, damit ich bei einem Anruf sofort den richtigen Kunden finde.
- Als **Betreiber** möchte ich sehen, welche Kunden ihre Einladung noch nicht angenommen haben und wann sich zuletzt jemand angemeldet hat, damit ich nachfassen kann.
- Als **Betreiber** möchte ich einen Kunden deaktivieren und wieder reaktivieren, damit ich bei Zahlungsverzug oder Vertragsende den Zugang sperren kann, ohne Daten zu verlieren.
- Als **Betreiber** möchte ich einen deaktivierten Kunden endgültig löschen, damit ich nach Vertragsende die DSGVO-Löschpflicht erfülle.
- Als **Betreiber** möchte ich Inhaber eines Kunden einladen, befördern, herabstufen und entfernen, damit ich helfen kann, wenn ein Inhaber die Firma verlässt oder sich Inhaber uneinig sind.
- Als **Mitglied eines deaktivierten Kunden** möchte ich einen klaren Hinweis sehen, damit ich weiß, dass ich mich an den Betreiber wenden muss.
- Als **Betreiber** möchte ich nachvollziehen können, welche Admin-Aktionen ich wann an einem Kunden vorgenommen habe, damit Rückfragen und Streitfälle klärbar sind.

## Umfang dieses Features
- **Betreiber-Bereich**: eigener Menüpunkt „Betreiber“, nur für den Betreiber-Admin mit 2FA-bestätigter Sitzung; für alle anderen „Seite nicht gefunden“
- **Kundenliste**: Suche nach Kundenname oder E-Mail-Adresse; je Kunde Name, Status („aktiv“, „Einladung offen“, „deaktiviert“), Inhaber mit Name und E-Mail, Anzahl Mitglieder, angelegt am, letzte Anmeldung eines Mitglieds
- **Kunde anlegen**: Kundenname und E-Mail-Adresse des ersten Inhabers in einem Schritt; Einladung sofort mit dem Ablauf aus PROJ-4 (neue Person: Einladungsmail; bestehendes Konto: Hinweis-Mail + Annehmen/Ablehnen in der App)
- **Detailseite eines Kunden**: Status, Mitglieder (Name, E-Mail, Rolle), offene Einladungen, Protokoll der Admin-Aktionen, Aktionen
- **Einladungen**: Inhaber-Einladungen erneut senden oder zurückziehen
- **Inhaber verwalten**: weitere Inhaber einladen, Mitarbeiter zu Inhabern befördern, Inhaber herabstufen oder entfernen (letzter Inhaber geschützt)
- **Deaktivieren / Reaktivieren** eines Kunden per Klick mit Bestätigung
- **Endgültig löschen**: nur bei deaktivierten Kunden, Bestätigung durch Eintippen des Kundennamens; entfernt alle Daten des Kunden und Login-Konten, die zu keinem anderen Kunden gehören
- **Hinweis für Mitglieder deaktivierter Kunden**: „Dieses Kundenkonto ist deaktiviert. Bitte wende dich an den Betreiber.“
- **Startseite des Admins**: ohne eigene Kunden-Mitgliedschaft landet der Admin nach der Anmeldung im Betreiber-Bereich; mit Mitgliedschaften normal im Dashboard des gewählten Kunden

## Out of Scope
- Support-Ansicht „App mit den Augen des Kunden“ (Nur-Lese-Modus) → eigenes Feature nach PROJ-8
- Mitarbeiter eines Kunden einladen oder entfernen → bleibt bei den Inhabern (PROJ-4)
- Kennzahlen je Kunde wie Anzahl Wohnungen oder Channex-Verbindungen → ergänzen PROJ-6 bzw. PROJ-10 in der Liste
- Automatisches Löschen nach Ablauf einer Frist → nicht geplant, Löschen nur bewusst per Knopf
- Weitere Betreiber-Admins in der App ernennen oder entziehen → bleibt manuell (Entscheidung PROJ-1)
- Abrechnung, Rechnungen, Tarife → außerhalb der App (PRD); Selbstregistrierung → PROJ-21
- Einzelne Login-Konten sperren (statt eines ganzen Kunden) → später bei Bedarf
- Schreiben in Fachdaten eines Kunden durch den Admin → nur als eingeladenes Mitglied (Entscheidung PROJ-1)
- E-Mail an alle Kunden (Rundschreiben) → nicht geplant

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugang zum Betreiber-Bereich
- [ ] Angenommen der Betreiber-Admin ist mit 2FA angemeldet, wenn er die App nutzt, dann sieht er in der Navigation den Menüpunkt „Betreiber“
- [ ] Angenommen eine Person ist kein Betreiber-Admin (Inhaber, Mitarbeiter oder ohne Kunde), wenn sie den Betreiber-Bereich direkt aufruft, dann erscheint „Seite nicht gefunden“, und der Menüpunkt fehlt
- [ ] Angenommen der Admin hat die 2FA in dieser Sitzung noch nicht bestätigt, wenn er den Betreiber-Bereich aufruft, dann wird er zur 2FA-Abfrage geleitet und erst danach eingelassen
- [ ] Angenommen der Admin ist bei keinem Kunden Mitglied, wenn er sich anmeldet, dann landet er direkt in der Kundenliste des Betreiber-Bereichs
- [ ] Angenommen der Admin ist Mitglied bei einem oder mehreren Kunden, wenn er sich anmeldet, dann landet er im Dashboard des gewählten Kunden und kann über den Menüpunkt in den Betreiber-Bereich wechseln
- [ ] Angenommen eine Person ist kein Admin, wenn sie eine Admin-Aktion technisch direkt auslöst (ohne Oberfläche), dann wird sie verweigert, und es ändert sich nichts

### Kundenliste
- [ ] Angenommen es gibt Kunden, wenn der Admin die Kundenliste öffnet, dann sieht er je Kunde Name, Status, Inhaber mit Name und E-Mail, Anzahl Mitglieder, Anlegedatum und letzte Anmeldung eines Mitglieds, alphabetisch nach Name sortiert
- [ ] Angenommen der Admin tippt einen Teil eines Kundennamens oder einer E-Mail-Adresse (eines Mitglieds oder einer offenen Einladung) in die Suche, wenn er sucht, dann zeigt die Liste nur passende Kunden, ohne Unterschied von Groß- und Kleinschreibung
- [ ] Angenommen die Suche findet nichts, wenn die Liste angezeigt wird, dann erscheint „Kein Kunde gefunden“ mit der Möglichkeit, die Suche zu leeren
- [ ] Angenommen es gibt noch keinen Kunden, wenn der Admin die Liste öffnet, dann erscheint ein Leerzustand mit dem Knopf „Kunde anlegen“
- [ ] Angenommen ein Kunde hat noch kein Mitglied, aber eine offene Inhaber-Einladung, wenn er in der Liste erscheint, dann hat er den Status „Einladung offen“, und als Inhaber steht die eingeladene E-Mail-Adresse
- [ ] Angenommen noch kein Mitglied eines Kunden hat sich je angemeldet, wenn der Kunde in der Liste erscheint, dann steht bei der letzten Anmeldung „noch nie“
- [ ] Angenommen der Admin klickt auf einen Kunden, wenn die Detailseite öffnet, dann sieht er Status, Mitglieder mit Rolle, offene Einladungen, das Protokoll der Admin-Aktionen und die verfügbaren Aktionen
- [ ] Angenommen die Liste wird auf dem Handy geöffnet, wenn sie angezeigt wird, dann sind die Kunden als Karten mit den wichtigsten Angaben (Name, Status, Inhaber) lesbar, ohne seitliches Scrollen

### Kunde anlegen
- [ ] Angenommen der Admin gibt einen Kundennamen und eine gültige E-Mail-Adresse ein, wenn er „Kunde anlegen“ wählt, dann entsteht der Kunde mit Status „Einladung offen“, die Inhaber-Einladung wird sofort verschickt, und eine Bestätigung wird angezeigt
- [ ] Angenommen die Adresse hat noch kein apppa-Konto, wenn die Einladung verschickt wird, dann erhält die Person die deutsche Einladungsmail mit dem Kundennamen; nach dem Annehmen (PROJ-3) ist sie Inhaber, und der Kunde hat den Status „aktiv“
- [ ] Angenommen die Adresse gehört zu einem bestehenden Konto, wenn die Einladung verschickt wird, dann erhält die Person die Hinweis-Mail und sieht nach dem Anmelden die Einladung mit „Annehmen“ und „Ablehnen“ (wie PROJ-4)
- [ ] Angenommen der Kundenname ist leer oder zu lang, oder die E-Mail-Adresse ist ungültig, wenn der Admin „Kunde anlegen“ wählt, dann erscheint eine Meldung am Feld, und es entsteht kein Kunde
- [ ] Angenommen es gibt bereits einen Kunden mit demselben Namen, wenn der Admin einen weiteren anlegt, dann erscheint ein Hinweis „Es gibt bereits einen Kunden mit diesem Namen“, und er kann trotzdem anlegen
- [ ] Angenommen der Mailversand schlägt fehl, wenn der Kunde angelegt wird, dann bleibt der Kunde mit Status „Einladung offen“ bestehen, und der Admin sieht den Hinweis, die Einladung erneut zu senden

### Einladungen und Inhaber verwalten
- [ ] Angenommen ein Kunde hat eine offene oder abgelaufene Inhaber-Einladung, wenn der Admin „Erneut senden“ wählt, dann wird eine neue Mail mit frischem Link verschickt, und der alte Link wird ungültig
- [ ] Angenommen ein Kunde hat eine offene Inhaber-Einladung, wenn der Admin „Zurückziehen“ wählt und bestätigt, dann ist die Einladung ungültig, und der Link führt zu „nicht mehr gültig“
- [ ] Angenommen der Admin lädt auf der Detailseite eine weitere Person als Inhaber ein, wenn die Einladung verschickt wird, dann gilt derselbe Ablauf wie beim Anlegen, und die Einladung erscheint als „offen“
- [ ] Angenommen ein Kunde hat einen Mitarbeiter, wenn der Admin „Zum Inhaber machen“ wählt und bestätigt, dann ist die Person Inhaber
- [ ] Angenommen ein Kunde hat mindestens zwei Inhaber, wenn der Admin einen davon herabstuft oder entfernt und bestätigt, dann ist die Person Mitarbeiter bzw. kein Mitglied mehr
- [ ] Angenommen ein Kunde hat nur einen Inhaber, wenn der Admin die Detailseite öffnet, dann fehlen bei diesem Inhaber „Herabstufen“ und „Entfernen“, und ein Hinweis erklärt, dass zuerst ein weiterer Inhaber nötig ist
- [ ] Angenommen ein Kunde hat Mitarbeiter, wenn der Admin die Detailseite öffnet, dann sieht er sie, aber ohne Aktionen „Entfernen“ (das bleibt bei den Inhabern)
- [ ] Angenommen der Admin hat eine Mitgliedschaft geändert, wenn die betroffene Person die App das nächste Mal aufruft, dann gilt sofort die neue Rolle bzw. sie hat keinen Zugriff mehr

### Deaktivieren und Reaktivieren
- [ ] Angenommen ein Kunde ist aktiv, wenn der Admin „Deaktivieren“ wählt und bestätigt, dann hat der Kunde den Status „deaktiviert“, und keines seiner Mitglieder kann mehr auf seine Daten zugreifen; alle Daten bleiben erhalten
- [ ] Angenommen eine Person ist nur Mitglied eines deaktivierten Kunden, wenn sie sich anmeldet oder die App aufruft, dann sieht sie „Dieses Kundenkonto ist deaktiviert. Bitte wende dich an den Betreiber.“ und keine Kundendaten
- [ ] Angenommen eine Person ist Mitglied eines deaktivierten und eines aktiven Kunden, wenn sie die App aufruft, dann landet sie beim aktiven Kunden, und der deaktivierte erscheint nicht im Kundenwechsel
- [ ] Angenommen ein Mitglied arbeitet gerade, während der Kunde deaktiviert wird, wenn es die nächste Seite aufruft oder speichert, dann wird der Zugriff verweigert, und es sieht den Hinweis
- [ ] Angenommen ein Kunde ist deaktiviert, wenn ein Inhaber dieses Kunden jemanden einladen will oder eine offene Einladung angenommen werden soll, dann ist das nicht möglich
- [ ] Angenommen ein Kunde ist deaktiviert, wenn der Admin „Reaktivieren“ wählt, dann hat der Kunde wieder seinen vorherigen Status, und alle Mitglieder haben wieder Zugriff mit ihren bisherigen Rollen

### Endgültig löschen
- [ ] Angenommen ein Kunde ist aktiv, wenn der Admin die Detailseite öffnet, dann gibt es keine Aktion „Endgültig löschen“, sondern den Hinweis, den Kunden zuerst zu deaktivieren
- [ ] Angenommen ein Kunde ist deaktiviert, wenn der Admin „Endgültig löschen“ wählt, dann erscheint eine Bestätigung, die erklärt, was gelöscht wird, und die erst nach Eintippen des exakten Kundennamens den Knopf freigibt
- [ ] Angenommen der Admin hat den Namen korrekt eingetippt und bestätigt, wenn gelöscht wird, dann sind der Kunde und alle seine Daten (Mitgliedschaften, Einladungen und künftig Wohnungen, Gäste, Buchungen, Zahlungen, Änderungsprotokoll) unwiderruflich entfernt, und der Admin landet in der Kundenliste mit einer Bestätigung
- [ ] Angenommen ein Mitglied des gelöschten Kunden gehört zu keinem anderen Kunden und ist nicht Betreiber-Admin, wenn gelöscht wird, dann wird auch sein Login-Konto gelöscht; Konten, die noch zu anderen Kunden gehören, bleiben bestehen
- [ ] Angenommen der Admin selbst war Mitglied des gelöschten Kunden, wenn gelöscht wird, dann bleibt sein Admin-Konto bestehen
- [ ] Angenommen der eingetippte Name stimmt nicht überein, wenn der Admin bestätigen will, dann bleibt der Knopf gesperrt

### Protokoll der Admin-Aktionen
- [ ] Angenommen der Admin hat an einem Kunden eine Aktion ausgeführt (anlegen, einladen, erneut senden, zurückziehen, befördern, herabstufen, entfernen, deaktivieren, reaktivieren), wenn er die Detailseite öffnet, dann sieht er die Aktion mit Zeitpunkt, Admin und betroffener Person, neueste zuerst
- [ ] Angenommen ein Kunde wird endgültig gelöscht, wenn die Löschung abgeschlossen ist, dann bleibt ein Eintrag mit Kundenname, Zeitpunkt und Admin erhalten (ohne personenbezogene Daten der Mitglieder), damit die Löschung nachweisbar ist

## Edge Cases
- **Adresse des ersten Inhabers ist bereits Inhaber oder Mitarbeiter bei einem anderen Kunden:** normaler Ablauf für bestehende Konten (Hinweis-Mail, Annehmen in der App); danach ist die Person bei beiden Kunden Mitglied
- **Adresse des ersten Inhabers ist die des Admins selbst:** wie jede andere Adresse; der Admin erhält eine normale Mitgliedschaft mit Schreibrechten (z. B. für einen eigenen Testkunden)
- **Erster Inhaber lehnt die Einladung ab:** der Kunde bleibt ohne Mitglied mit Status „Einladung offen“ (Einladung abgelehnt). Der Admin sieht das auf der Detailseite und kann eine andere Adresse einladen oder den Kunden deaktivieren und löschen
- **Einladung des ersten Inhabers läuft ab:** Status bleibt „Einladung offen“ mit Kennzeichnung „abgelaufen“; „Erneut senden“ möglich
- **Kunde ohne Mitglieder und ohne offene Einladung** (zurückgezogen oder abgelehnt): Status „Einladung offen“ mit Hinweis „Keine offene Einladung“, damit er in der Liste auffällt
- **Inhaber verlässt den Kunden selbst, und es bleibt nur ein Mitarbeiter:** nicht möglich, der letzte Inhaber ist geschützt (PROJ-4). Wenn ein Inhaber nicht mehr erreichbar ist, befördert der Admin einen Mitarbeiter und entfernt danach den alten Inhaber
- **Konto eines letzten Inhabers soll gelöscht werden** (PROJ-1 BUG-6): Lösung über diesen Ablauf, also erst einen anderen Inhaber einsetzen oder den Kunden deaktivieren und endgültig löschen
- **Zwei Browserfenster des Admins:** In einem wird der Kunde gelöscht, im anderen wird danach eine Aktion ausgelöst. Die Aktion schlägt mit „Kunde nicht mehr vorhanden“ fehl, und die Liste lädt neu
- **Inhaber ändert den Kundennamen, während der Admin löschen will:** die Bestätigung verlangt den aktuellen Namen; ein veralteter Name sperrt den Knopf
- **Deaktivierter Kunde hat offene Einladungen:** sie bleiben bestehen, lassen sich aber nicht annehmen und erscheinen bei der eingeladenen Person nicht; nach dem Reaktivieren sind sie wieder gültig, sofern nicht abgelaufen
- **Mitglied eines deaktivierten Kunden nutzt „Passwort vergessen“:** funktioniert, nach der Anmeldung erscheint der Hinweis „deaktiviert“
- **Spätere Channex-Anbindung (PROJ-10):** beim Deaktivieren bzw. Löschen müssen Verbindungen zu Channex pausiert bzw. getrennt werden. Das regelt PROJ-10, PROJ-5 sieht nur den Status vor
- **Sehr viele Kunden** (später, z. B. 200+): die Liste bleibt mit Suche und seitenweiser Anzeige bedienbar
- **Mail kommt nicht an (Quarantäne/Spam):** wie PROJ-4; der Admin sieht „Einladung offen“ und kann erneut senden

## Technical Requirements
- Sicherheit: Alle Admin-Aktionen werden zusätzlich auf dem Server bzw. in der Datenbank geprüft (Admin-Kennzeichnung + 2FA-bestätigte Sitzung), nicht nur in der Oberfläche
- Sicherheit: Der Admin erhält weiterhin keine Schreibrechte auf Fachdaten der Kunden; die erlaubten Admin-Aktionen sind eng auf Kunden, Inhaber-Mitgliedschaften und Einladungen begrenzt
- Sicherheit: Endgültiges Löschen ist nur bei deaktivierten Kunden möglich, auch bei direktem Aufruf ohne Oberfläche
- Datenschutz: Das Löschprotokoll enthält keine personenbezogenen Daten der Mitglieder des gelöschten Kunden
- Performance: Kundenliste mit Suche < 500 ms bei bis zu 200 Kunden
- Responsiv: Desktop, Tablet und Handy (Liste als Karten auf dem Handy)

## Open Questions
- [ ] E-Mail-Adresse eines Kontos durch den Betreiber ändern (in PROJ-3 dem Betreiber zugewiesen): vorerst per Runbook (Abschnitt 12); bei Bedarf später in der Support-Ansicht
- [x] Aufbewahrungsdauer des Löschnachweises: 2 Jahre wie das Änderungsprotokoll (siehe Technical Decisions)
- [ ] AVV-Vorlage für Kunden: Regelung zur Löschung nach Vertragsende (Frist, Bestätigung an den Kunden) – rechtlich, nicht technisch

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kunde und ersten Inhaber in einem Schritt anlegen, Einladung wie PROJ-4 | Schnelles Onboarding; ein einziger, bereits getesteter Einladungsablauf | 2026-10-24 |
| Kundenliste mit Suche, Status, Inhaber, Mitgliederzahl, Anlegedatum, letzter Anmeldung; Detailseite per Klick | Support bei Anrufen und Nachfassen offener Einladungen; Kennzahlen zu Wohnungen/Channex folgen mit PROJ-6/10 | 2026-10-24 |
| Deaktivieren/Reaktivieren per Klick, Daten bleiben erhalten | Zahlungsverzug oder Pause ohne Datenverlust | 2026-10-24 |
| Endgültiges Löschen per Knopf, nur bei deaktivierten Kunden und mit Eintippen des Kundennamens; verwaiste Login-Konten werden mitgelöscht | DSGVO-Löschung nach Vertragsende ohne Datenbankeingriff; zweistufig gegen Fehlklicks | 2026-10-24 |
| Kein automatisches Löschen nach Frist | Keine unbeabsichtigten Datenverluste | 2026-10-24 |
| Betreiber verwaltet nur Inhaber (einladen, befördern, herabstufen, entfernen); Mitarbeiter bleiben Sache der Inhaber | Schließt die Lücke aus PROJ-4 (Inhaber voreinander geschützt), ohne dem Kunden die Team-Verantwortung abzunehmen | 2026-10-24 |
| Admin-Aktionen werden je Kunde protokolliert; Löschnachweis bleibt ohne Personendaten erhalten | Nachvollziehbarkeit bei Rückfragen; Nachweis der DSGVO-Löschung | 2026-10-24 |
| Vorerst keine Support-Ansicht in Kundendaten | Bis PROJ-8 gibt es kaum Kundendaten; eigenes Feature danach | 2026-10-24 |
| Betreiber-Bereich als zusätzlicher Menüpunkt; Admin darf zusätzlich Kunden-Mitglied sein; ohne Mitgliedschaft Start im Betreiber-Bereich | Ein Login für Betrieb und eigenen Testkunden | 2026-10-24 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Admin-Aktionen als einzelne Datenbankfunktionen mit eigener Admin- und 2FA-Prüfung statt allgemeiner Admin-Schreibregeln | Schutz auch ohne Oberfläche; Admin bleibt ohne Schreibrechte auf Fachdaten (PROJ-1); Änderung und Protokoll in einem Zug | 2026-10-24 |
| Server-Aktionen (kein eigenes API) für die Betreiber-Seiten | Gleiches Muster wie PROJ-3/4; Mailversand und Löschen von Login-Konten brauchen den Server | 2026-10-24 |
| Anzeigestatus „Einladung offen“ wird abgeleitet, keine neue Spalte | Kein doppelter Zustand, der auseinanderlaufen kann | 2026-10-24 |
| Eigenes Betreiber-Protokoll statt Mitbenutzung des Änderungsprotokolls | Muss die Löschung des Kunden überdauern, ist nur für den Admin bestimmt und enthält Aktionen ohne Datenänderung (z. B. „erneut gesendet“) | 2026-10-24 |
| Betreiber-Protokoll 2 Jahre aufbewahrt; beim Löschen eines Kunden Personenangaben entfernt, Löschnachweis bleibt | Gleiche Frist wie das Änderungsprotokoll; DSGVO-Nachweis ohne Personendaten (beantwortet offene Frage) | 2026-10-24 |
| Endgültiges Löschen zweistufig: Datenbank löscht Kundendaten und nennt verwaiste Konten, Server löscht diese Login-Konten | Login-Konten lassen sich nur über die Supabase-Verwaltung löschen; Fehler beim Konto-Löschen sind harmlos und nachholbar | 2026-10-24 |
| Kundenliste mit Suche über die Adresse (Suchbegriff und Seite in der URL), 50 je Seite | Bleibt bei 200+ Kunden schnell; Suche lässt sich als Link teilen und per Zurück-Taste wiederherstellen | 2026-10-24 |
| Letzte Anmeldung über eine nur für den Admin freigegebene Abfrage der Login-Verwaltung | Anmeldezeiten liegen nicht im öffentlichen Datenbankteil | 2026-10-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Status je Kunde** gibt es seit PROJ-1 („aktiv“ / „deaktiviert“). Alle Zugriffsregeln prüfen ihn schon: Mitglieder eines deaktivierten Kunden sehen dessen Daten nicht, können nicht einladen, und offene Einladungen lassen sich nicht annehmen. Für „Deaktivieren“ muss nur der Status umgeschaltet werden.
- **Admin-Prüfung** gibt es ebenfalls schon in der Datenbank: Admin-Kennzeichen am Profil **und** eine mit 2FA bestätigte Sitzung. Der Admin darf bereits alles lesen, aber nichts schreiben.
- **Schutz des letzten Inhabers** greift in der Datenbank und gilt damit auch für den Admin. Löscht man einen ganzen Kunden, lässt die Regel das zu.
- **Einladungsablauf** aus PROJ-4 (Art der Einladung bestimmen, Einladungsmail bzw. Hinweis-Mail, unbenutzte Konten aufräumen) wird unverändert wiederverwendet.

### A) Seiten und Bausteine

```
Navigation (Seitenleiste / „Mehr“ am Handy)
+-- neuer Punkt „Betreiber“ (nur Admin mit 2FA)

/betreiber – Kundenliste
+-- Kopf: Titel „Kunden“ + Knopf „Kunde anlegen“
+-- Suchfeld (Name oder E-Mail, aktualisiert die Adresse → Suche lässt sich als Link teilen und merken)
+-- Liste
|   +-- Desktop/Tablet: Tabelle (Name, Status, Inhaber, Mitglieder, angelegt, letzte Anmeldung)
|   +-- Handy: Karten (Name, Status, Inhaber)
|   +-- Seitenweise Anzeige (50 je Seite)
+-- Leerzustand „Noch kein Kunde“ bzw. „Kein Kunde gefunden“
+-- Seitenblatt „Kunde anlegen“ (Kundenname, E-Mail des ersten Inhabers, Namens-Hinweis bei Dublette)

/betreiber/kunden/[id] – Detailseite
+-- Kopf: Kundenname, Status-Abzeichen, Zurück zur Liste
+-- Abschnitt „Mitglieder“ (Name, E-Mail, Rolle, Aktionen nur bei Inhabern/Mitarbeiter→Inhaber)
|   +-- Hinweis beim letzten Inhaber
+-- Abschnitt „Einladungen“ (offen/abgelaufen; erneut senden, zurückziehen) + „Inhaber einladen“
+-- Abschnitt „Protokoll“ (Admin-Aktionen, neueste zuerst)
+-- Abschnitt „Gefahrenzone“
    +-- Deaktivieren bzw. Reaktivieren (Bestätigungsdialog)
    +-- Endgültig löschen (nur wenn deaktiviert; Dialog mit Eintippen des Namens)

Bestehende Seiten, angepasst
+-- Dashboard ohne Kunde: Admin ohne Mitgliedschaft wird zu /betreiber weitergeleitet
+-- Hinweis „Kundenkonto deaktiviert“ statt „keinem Kunden zugeordnet“, wenn alle Kunden der Person deaktiviert sind
```

Wiederverwendet werden die vorhandenen shadcn-Bausteine (Table, Badge, Sheet, Dialog, AlertDialog, Input, Pagination, DropdownMenu) sowie die eigenen Bausteine Bestätigungsdialog, Seitenkopf und Leerzustand. Die Mitglieder- und Einladungslisten orientieren sich am Aufbau der Team-Seite aus PROJ-4.

### B) Datenmodell (in Worten)

**Keine neue Spalte am Kunden.** Der angezeigte Status ergibt sich aus Vorhandenem:
- „deaktiviert“ = Status deaktiviert
- „Einladung offen“ = aktiv, aber noch kein Mitglied (mit Zusatz „abgelaufen“ bzw. „keine offene Einladung“)
- „aktiv“ = aktiv mit mindestens einem Mitglied

**Neu: Betreiber-Protokoll** (eine Zeile je Admin-Aktion)
- Zeitpunkt, ausführender Admin
- Kunde (Kennung **und** Name zum Zeitpunkt der Aktion, damit Einträge die Löschung überdauern)
- Aktion (angelegt, eingeladen, erneut gesendet, zurückgezogen, befördert, herabgestuft, entfernt, deaktiviert, reaktiviert, gelöscht)
- Betroffene Person (E-Mail-Adresse), falls zutreffend
- Nur für den Admin lesbar; niemand kann Einträge ändern oder löschen, außer der automatischen Bereinigung nach **2 Jahren** (wie das Änderungsprotokoll)
- Beim endgültigen Löschen eines Kunden werden die Personenangaben in seinen Einträgen entfernt, der Eintrag „gelöscht“ (Kundenname, Zeitpunkt, Admin) bleibt als Nachweis

**Für die Kundenliste** liefert eine Abfrage je Kunde: Name, Status, Inhaber (Name, E-Mail) bzw. eingeladene Adresse, Anzahl Mitglieder, Anlegedatum und die jüngste Anmeldung eines Mitglieds. Die Anmeldezeit liegt in der geschützten Login-Verwaltung von Supabase; die Abfrage darf sie nur für den Admin auslesen.

**Für den Hinweis „deaktiviert“** gibt es eine kleine Abfrage „Gehöre ich zu einem deaktivierten Kunden?“, die nur über die eigene Person Auskunft gibt.

### C) Wie Admin-Aktionen geschützt sind

Jede Admin-Aktion ist eine **eigene, eng umrissene Datenbankfunktion** (z. B. „Kunde anlegen“, „Inhaber herabstufen“, „Kunde deaktivieren“). Jede prüft zuerst selbst: Admin-Kennzeichen **und** 2FA-Sitzung. Danach führt sie genau diese eine Änderung aus und schreibt den Protokolleintrag in einem Zug. Dadurch gilt:
- Der Schutz greift auch bei direktem Aufruf ohne Oberfläche.
- Der Admin bekommt **keine** allgemeinen Schreibrechte auf Kundendaten, die Entscheidung aus PROJ-1 bleibt bestehen.
- Protokoll und Änderung können nicht auseinanderlaufen.

Die Server-Aktionen der Seiten prüfen den Admin ebenfalls (erste Ebene) und kümmern sich um das, was die Datenbank nicht kann: Mails verschicken (Einladungsablauf aus PROJ-4) und Login-Konten löschen.

**Endgültig löschen** läuft in zwei Schritten:
1. Datenbankfunktion: prüft „deaktiviert“ und den exakt eingetippten aktuellen Namen. Dann ermittelt sie die Mitglieder, die danach zu keinem Kunden mehr gehören, keine offene Einladung haben und nicht Admin sind. Sie löscht den Kunden samt Mitgliedschaften, Einladungen und künftig allen Fachdaten (automatisch über die Verknüpfung zum Kunden) sowie seine Einträge im Änderungsprotokoll, schreibt den Löschnachweis und gibt die Liste der verwaisten Konten zurück.
2. Server-Aktion: löscht diese Login-Konten. Schlägt das bei einem Konto fehl, bleibt es ohne Kunde bestehen (harmlos: es sieht nichts). Der Admin erhält einen Hinweis, und das Runbook beschreibt das Nachlöschen.

**Kunde anlegen** legt den Kunden und die Inhaber-Einladung in einem Zug an. Danach wird die Mail verschickt. Schlägt der Versand fehl, bleiben Kunde und Einladung bestehen, und der Admin sieht „Einladung erneut senden“ (wie AC). Als einladende Person nennt die Mail den Namen des Admins.

### D) Zugang und Navigation
- Neuer Navigationspunkt „Betreiber“, der unabhängig von der Rolle beim gewählten Kunden nur für den Admin erscheint. Der App-Rahmen erfährt dafür zusätzlich „ist Admin“.
- Der Bereich `/betreiber` prüft auf dem Server: Ohne Admin-Kennzeichen erscheint „Seite nicht gefunden“ (wie bei den Einstellungen in PROJ-4). Mit Kennzeichen, aber ohne 2FA in dieser Sitzung, geht es zur 2FA-Abfrage (aus PROJ-3).
- Startseite: Ein Admin ohne Kunden-Mitgliedschaft wird vom Dashboard direkt zu `/betreiber` geleitet.

### E) Was sich an bestehendem Verhalten ändert (Freigabe nötig, sicherheitsrelevant)
- **Neue Admin-Datenbankfunktionen** mit Schreibwirkung auf Kunden, Mitgliedschaften und Einladungen. Sie sind ausschließlich für Admin + 2FA nutzbar. Bestehende Zugriffsregeln für Inhaber und Mitarbeiter bleiben unverändert.
- **Neue Tabelle Betreiber-Protokoll** mit Zugriffsregeln: nur der Admin liest, niemand schreibt direkt.
- **Neue Auskunftsfunktion** „bin ich Mitglied eines deaktivierten Kunden“ (nur über die eigene Person).
- Login-Konten werden beim endgültigen Löschen eines Kunden serverseitig gelöscht (bisher nur beim Zurückziehen unbenutzter Einladungen).

### F) Tests
- **Integrationstests gegen „apppa“:** Jede Admin-Funktion verweigert Nicht-Admins und Admins ohne 2FA. Letzter Inhaber geschützt. Löschen nur bei deaktivierten Kunden und nur mit richtigem Namen. Verwaiste Konten werden korrekt ermittelt; Konten mit anderem Kunden und das Admin-Konto bleiben. Protokolleinträge und Löschnachweis ohne Personendaten. Deaktivierte Kunden sind für Mitglieder unsichtbar.
- **E2E (Playwright):** Liste, Suche, Anlegen (mit vorhandenem Testkonto, damit keine Mail an Fremdadressen geht), Detailseite, Inhaber-Aktionen, Deaktivieren/Reaktivieren mit Hinweis für Mitglieder, Löschen mit Namensbestätigung, 404 für Nicht-Admins, Handy-Ansicht. Ein Test-Admin mit 2FA wird wie in PROJ-3 per TOTP angemeldet.

### G) Abhängigkeiten
- Keine neuen Pakete.

## Implementation Notes (Frontend)
**Stand 2026-10-24.** Die Oberfläche ist fertig. Die Aktionen melden bis zum Backend „Diese Funktion wird gerade eingerichtet“.

**Seiten**
- `/betreiber`: Kundenliste.
  - Suche mit Verzögerung; Begriff in der Adresse (`?q=`), Seite in `?seite=`, 50 Kunden je Seite.
  - Tabelle ab 768 px, darunter Karten.
  - Leerzustände „Noch kein Kunde“ und „Kein Kunde gefunden“ (mit „Suche leeren“).
- `/betreiber/kunden/[id]`: Detailseite mit diesen Abschnitten:
  - Status-Abzeichen (bei „Einladung offen“ mit Zusatz abgelaufen/keine Einladung);
  - Mitglieder mit Aktionen-Menü;
  - Einladungen mit „Inhaber einladen“;
  - Protokoll;
  - „Kundenkonto“ mit Deaktivieren/Reaktivieren und, nur bei deaktivierten Kunden, „Endgültig löschen“ mit Namenseingabe.

**Bausteine** (`src/components/operator/`)
- `tenant-list`, `tenant-search`, `tenant-status-badge`
- `create-tenant-panel`: Hinweis bei gleichem Namen, danach „Trotzdem anlegen“
- `operator-members`, `owner-invite-panel`, `operator-invitations`, `operator-log`, `tenant-danger-zone`

**Wiederverwendet**
- `InvitationsList`: hat jetzt optionale eigene Aktionen und einen Nur-Lese-Modus.
- `useTeamAction`: hat jetzt einen wählbaren Bereich für die Fehlermeldungen (`operator.errors`).
- `ConfirmDialog`, `DetailPanel`, `EmptyState`, `PageHeader`.

**Navigation und Zugang**
- Neuer Bereich `operator` (`/betreiber`, Symbol „Buildings“, am Handy unter „Mehr“). Er ist nur sichtbar, wenn die Person Admin ist; die Rolle beim Kunden spielt keine Rolle.
- `visibleNavItems`, `mobileNav` und `isAreaAvailable` nehmen jetzt Rolle **oder** `{ role, isAdmin }`.
- `ShellInfo.person.isAdmin` setzt Admin-Kennzeichen **und** eine 2FA-Sitzung voraus.
- Der App-Rahmen antwortet für Nicht-Admins auf `/betreiber` mit 404 (wie bei den Einstellungen).
- Ein Admin ohne eigenen Kunden wird vom Dashboard zu `/betreiber` geleitet. Im Benutzermenü steht dann „Betreiber“ statt „Mitarbeiter“, in der Seitenleiste „Kein Kunde zugeordnet“ statt des alten Platzhalters.
- Dashboard: „Dieses Kundenkonto ist deaktiviert“, wenn die Person nur zu deaktivierten Kunden gehört.

**Daten** (`src/lib/operator-data.ts`, vorläufig)
- Liest über die bestehenden Leserechte des Admins.
- Suche und Seiten werden im Server gefiltert.
- „Letzte Anmeldung“ zeigt vorerst immer „noch nie“, das Protokoll ist leer.
- `belongsToDeactivatedTenant()` liefert vorerst `false`.
- Alle drei Punkte ersetzt das Backend durch eigene, nur für den Admin freigegebene Abfragen.

**Aktionen** (`src/app/(app)/betreiber/actions.ts`)
- Eingaben werden geprüft (Zod, gemeinsame Schemas in `src/lib/validation/operator.ts`), ebenso Admin und 2FA.
- Die Ausführung folgt mit dem Backend.

**Regeln** (`src/lib/operator.ts`, mit Unit-Tests)
- abgeleiteter Status;
- Aktionen je Mitglied (Mitarbeiter → befördern; Inhaber → herabstufen/entfernen, außer dem letzten);
- Namensbestätigung beim Löschen.

**Abweichung bzw. Präzisierung**
- Bei deaktivierten Kunden sind Mitglieder und Einladungen nur ansehbar, ohne Aktionen und ohne „Inhaber einladen“, weil Einladungen dort ohnehin nicht angenommen werden können.
- Rollen- und Einladungsfragen also vor dem Deaktivieren bzw. nach dem Reaktivieren klären.

**Geprüft**
- Typprüfung, Produktions-Build und Unit-Tests (152) sind grün.
- PROJ-2-Shell-E2E (Desktop) ist grün.
- Sichtprüfung als Test-Admin mit 2FA auf Desktop (1440 px) und Handy (375 px).

## Implementation Notes (Backend)
**Stand 2026-10-24.** Alle Aktionen sind angeschlossen.

**Migration** `supabase/migrations/20261024120000_operator_admin.sql` (in „apppa“ eingespielt, Sicherheits-Advisor ohne neue Hinweise)
- Tabelle `operator_log`: Kunde (Kennung + Name), Aktion, Admin (Kennung + Name), betroffene Adresse.
  - RLS: nur `private.is_admin()` liest; keine Schreibrechte für irgendwen, auch nicht für den Secret Key.
  - Bereinigung nach 2 Jahren (`purge-operator-log`).
- Admin-Funktionen in `private` (SECURITY DEFINER) mit öffentlichen Hüllen ohne Systemrechte. Jede prüft zuerst `private.require_admin()` (Kennzeichen + aal2):
  - `admin_create_tenant`
  - `admin_invite_owner`
  - `admin_resend_invitation`, `admin_revoke_invitation`
  - `admin_change_member` (promote/demote/remove)
  - `admin_set_tenant_status`
  - `admin_delete_tenant`
  - `admin_tenant_overview` (Suche, Seiten, Mitgliederzahl, Inhaber, offene Einladungen, letzte Anmeldung aus `auth.users`)
- Dazu `belongs_to_deactivated_tenant()`, die nur über die eigene Person Auskunft gibt.
- Die Art der Einladung bestimmt jetzt die Datenbank (bestätigtes Konto → Hinweis-Mail, sonst Einladungsmail), ebenso die Gültigkeit (1 bzw. 14 Tage).
- Bei deaktivierten Kunden sind alle Aktionen außer Reaktivieren und Löschen gesperrt (Code P0016).
- Fehlercodes: siehe Kopf der Migration. Die Server-Aktionen übersetzen sie in `operator.errors.*`.

**Löschen**
- Die Datenbank prüft „deaktiviert“ und den exakten Namen.
- Sie ermittelt die verwaisten Konten: kein anderer Kunde, keine offene Einladung, nicht Admin.
- Sie löscht den Kunden (Kaskade auf Mitgliedschaften, Einladungen und künftige Fachdaten), danach sein Änderungsprotokoll (auch die Einträge, die die Kaskade schreibt).
- Sie leert `target_email` in seinen Betreiber-Protokolleinträgen und schreibt „deleted“.
- Die Server-Aktion löscht anschließend die verwaisten Login-Konten. Fehlschläge zählt sie und meldet sie (Runbook Abschnitt 12).

**Server-Aktionen** (`src/app/(app)/betreiber/actions.ts`)
- Prüfen Admin + 2FA und rufen die Admin-Funktionen im Namen des Admins auf.
- Mails verschicken sie mit dem bestehenden Ablauf aus PROJ-4 (`deliverInvitation`); als einladende Person steht der Name des Admins.
- Schlägt die Einladungsmail fehl, bleibt die Einladung offen. Die Meldung verweist auf „Erneut senden“.
- Beim Zurückziehen einer Einladung an eine neue Person wird das ungenutzte Login-Konto entfernt (wie PROJ-4).

**Lesen** (`src/lib/operator-data.ts`)
- Kundenliste über `admin_tenant_overview`; eine Seite hinter dem Ende springt zur ersten Seite.
- Detailseite über die normalen Leserechte des Admins, Protokoll aus `operator_log` (neueste zuerst, max. 200).
- Hinweis „deaktiviert“ im Dashboard über `belongs_to_deactivated_tenant()`.

**Runbook:** neuer Abschnitt 12 (Zugang, Löschen, Nachlöschen verwaister Konten, E-Mail-Adresse eines Kontos ändern, Konto eines letzten Inhabers).

**Tests**
- `supabase/tests/operator.integration.test.ts` (10 Tests gegen „apppa“):
  - Abweisung von Nicht-Admins und Admin ohne 2FA;
  - Protokoll nur für Admin lesbar und nicht direkt beschreibbar;
  - Anlegen inkl. Art der Einladung und Namens-Dublette;
  - Suche, Inhaber, letzte Anmeldung;
  - Einladen, erneut senden, zurückziehen;
  - Befördern, Herabstufen, Entfernen (letzter Inhaber geschützt, Mitarbeiter nicht entfernbar);
  - Deaktivieren und Reaktivieren inkl. Auskunft für Mitglieder;
  - Löschen (nur deaktiviert, exakter Name, nur verwaiste Konten, Admin-Konto und Konto mit zweitem Kunden bleiben, Löschnachweis ohne Personendaten).
- Gesamte Vitest-Suite: 205 Tests grün.
- Ablauf im Browser geprüft: Anlegen mit bestehendem Testkonto, Deaktivieren, Löschen mit Namensbestätigung.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
