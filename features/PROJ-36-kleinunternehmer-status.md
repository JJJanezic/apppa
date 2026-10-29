# PROJ-36: Kleinunternehmer-Status

## Status: In Progress
**Created:** 2026-10-29
**Last Updated:** 2026-10-29

## Dependencies
- Requires: PROJ-28 (Kundenstammdaten) — Stammdaten-Formular für Inhaber und Betreiber, Konfliktschutz, Protokoll
- Requires: PROJ-8 (Manuelle Buchungen) — Abreise und Storno einer Buchung
- Requires: PROJ-30 (Buchungs-Erweiterung) — geplante und tatsächliche Abreise
- Wird genutzt von: PROJ-35 (Umsatzsteuersatz je Position) — blendet USt-Angaben bei Kleinunternehmern aus; später Rechnungsmodul (Pflichthinweis)

## Überblick
Viele Privatvermieter sind umsatzsteuerliche Kleinunternehmer und verrechnen keine Umsatzsteuer. Der Status kann sich ändern: Ein Kunde überschreitet die Umsatzgrenze, optiert freiwillig zur Regelbesteuerung oder wird später wieder Kleinunternehmer. Deshalb wird nicht ein einzelner Schalter gespeichert, sondern ein **Verlauf von Statuswechseln**.

**Verlauf in den Kundenstammdaten (PROJ-28):**
- Neuer Bereich „Umsatzsteuer“ im bestehenden Stammdaten-Formular, gespeichert mit derselben Speichern-Schaltfläche.
- Oben der aktuelle Status, z. B. „Aktuell: Kleinunternehmer – keine Umsatzsteuer, seit Fr, 14.08.2026“ bzw. „Aktuell: mit Umsatzsteuer“.
- Darunter die Liste der Wechsel, neueste oben. Jeder Eintrag: **ab Datum** + **Status** („Kleinunternehmer – keine Umsatzsteuer“ oder „mit Umsatzsteuer“). Einträge lassen sich hinzufügen, ändern und entfernen.
- Ohne Eintrag gilt „mit Umsatzsteuer“ (Ausgangszustand für bestehende und neue Kunden).

**Regel: Welcher Status gilt für eine Buchung?**
- Maßgeblicher Tag ist die **Abreise** (tatsächliche Abreise laut PROJ-30, sonst geplante), weil die Beherbergung mit dem Aufenthaltsende erbracht ist.
- Bei einer **stornierten** Buchung ist der maßgebliche Tag das **Stornodatum** (für die Stornogebühr).
- Es gilt der Status des jüngsten Eintrags, dessen „ab“-Datum am oder vor dem maßgeblichen Tag liegt. Gibt es keinen solchen Eintrag, gilt „mit Umsatzsteuer“.
- Die Buchung wird immer als Ganzes eingestuft, auch wenn der Aufenthalt über einen Stichtag reicht.
- Die Regel steht an einer Stelle zur Verfügung, damit PROJ-35 und später das Rechnungsmodul gleich entscheiden.

**Wer darf was:** wie die übrigen Stammdaten (PROJ-28): Inhaber und Betreiber bearbeiten, bei deaktivierten Kunden nur lesen, Mitarbeiter haben keinen Zugang.

## User Stories
- Als **Inhaber** möchte ich hinterlegen, dass ich Kleinunternehmer bin, damit die App mir keine Umsatzsteuer anzeigt, die ich nicht schulde.
- Als **Inhaber** möchte ich einen Statuswechsel mit Datum erfassen (z. B. Umsatzgrenze überschritten), damit Buchungen vor und nach dem Wechsel richtig behandelt werden.
- Als **Inhaber** möchte ich auch einen Wechsel in der Zukunft eintragen (z. B. Regelbesteuerung ab 1.1.), damit ich ihn nicht am Stichtag vergessen kann.
- Als **Betreiber** möchte ich den Status beim Onboarding für den Kunden eintragen und korrigieren, ohne mich als Inhaber anzumelden.
- Als **Inhaber oder Betreiber** möchte ich auf einen Blick sehen, welcher Status heute gilt.
- Als **Betreiber** möchte ich im Protokoll sehen, wer den Status-Verlauf wann geändert hat.

## Out of Scope
- Anzeige oder Ausblenden der USt-Angaben in Buchungen (PROJ-35)
- Pflichthinweis „umsatzsteuerbefreit – Kleinunternehmer“ auf Rechnungen und Festhalten des Status je Rechnung (Rechnungsmodul)
- Automatische Überwachung der Umsatzgrenze oder Warnung bei Überschreitung
- Prüfung von Sperrfristen (z. B. Bindung an die Regelbesteuerung nach Option)
- Status je Wohnung oder je Objekt (gilt für den ganzen Kunden)
- Erfassung des Status beim Anlegen eines Kunden (Anlegen bleibt Name + E-Mail, PROJ-5)
- Anzeige des Status in der Kundenübersicht des Betreibers
- Zugang für Mitarbeiter

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Anzeige und Erfassung
- [ ] Angenommen ein Inhaber öffnet *Einstellungen → Kunde*, wenn die Seite lädt, dann gibt es im Stammdaten-Formular den Bereich „Umsatzsteuer“ mit dem aktuellen Status und der Liste der Wechsel
- [ ] Angenommen ein Kunde ohne Einträge, wenn der Bereich angezeigt wird, dann steht „Aktuell: mit Umsatzsteuer“ und ein Hinweis, dass noch kein Wechsel erfasst ist
- [ ] Angenommen ein Inhaber fügt „ab Mi, 01.07.2026: Kleinunternehmer – keine Umsatzsteuer“ hinzu, wenn er speichert, dann ist der Eintrag nach dem Neuladen sichtbar und der aktuelle Status lautet „Kleinunternehmer – keine Umsatzsteuer, seit Mi, 01.07.2026“
- [ ] Angenommen mehrere Einträge, wenn die Liste angezeigt wird, dann ist sie nach Datum absteigend sortiert (neuester oben)
- [ ] Angenommen ein Eintrag mit Datum in der Zukunft, wenn der aktuelle Status angezeigt wird, dann gilt bis dahin der vorige Status und der künftige Wechsel ist in der Liste als „geplant“ erkennbar
- [ ] Angenommen ein Inhaber ändert Datum oder Status eines Eintrags, wenn er speichert, dann gilt der geänderte Eintrag
- [ ] Angenommen ein Inhaber entfernt einen Eintrag, wenn er speichert, dann ist der Eintrag weg und der Status richtet sich nach den übrigen Einträgen
- [ ] Angenommen der Inhaber ändert den Verlauf, verlässt die Seite aber ohne Speichern, wenn er zurückkehrt, dann ist der Verlauf unverändert
- [ ] Angenommen Datumsangaben im Bereich, wenn sie angezeigt werden, dann im Format „Mi, 01.07.2026“ (PROJ-31)

### Validierung
- [ ] Angenommen ein Eintrag ohne Datum oder ohne Status, wenn gespeichert wird, dann erscheint beim Eintrag eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen zwei Einträge mit demselben Datum, wenn gespeichert wird, dann erscheint die Meldung „Für dieses Datum gibt es bereits einen Eintrag“ und nichts wird gespeichert
- [ ] Angenommen jemand umgeht die Prüfung im Browser, wenn ein doppeltes Datum oder ein ungültiger Status gesendet wird, dann lehnt die Datenbank ihn ab

### Regel je Buchung
- [ ] Angenommen Verlauf „ab 01.07.2026: Kleinunternehmer“, wenn eine Buchung am 30.06.2026 abreist, dann gilt für sie „mit Umsatzsteuer“
- [ ] Angenommen Verlauf „ab 01.07.2026: Kleinunternehmer“, wenn eine Buchung am 01.07.2026 abreist, dann gilt „Kleinunternehmer“ (das „ab“-Datum zählt mit)
- [ ] Angenommen Verlauf „ab 01.07.2026: Kleinunternehmer“, wenn eine Buchung vom 28.06. bis 03.07.2026 dauert, dann gilt für die ganze Buchung „Kleinunternehmer“
- [ ] Angenommen eine Buchung mit vorgezogener tatsächlicher Abreise (PROJ-30), wenn der Status bestimmt wird, dann zählt die tatsächliche Abreise
- [ ] Angenommen Verlauf „ab 01.01.2026: Kleinunternehmer“, „ab 15.08.2026: mit Umsatzsteuer“, wenn eine Buchung am 20.08.2026 abreist, dann gilt „mit Umsatzsteuer“; reist sie am 10.08.2026 ab, gilt „Kleinunternehmer“
- [ ] Angenommen eine stornierte Buchung mit Abreise 20.08.2026, storniert am 05.08.2026, Verlauf wie oben, wenn der Status bestimmt wird, dann zählt das Stornodatum und es gilt „Kleinunternehmer“
- [ ] Angenommen ein Kunde ohne Einträge, wenn der Status einer beliebigen Buchung bestimmt wird, dann gilt „mit Umsatzsteuer“

### Rollen, Konflikte und Protokoll
- [ ] Angenommen der Betreiber öffnet die Detailseite eines aktiven Kunden, wenn die Stammdaten angezeigt werden, dann sieht und bearbeitet er den Bereich „Umsatzsteuer“ wie der Inhaber
- [ ] Angenommen ein deaktivierter Kunde, wenn der Betreiber die Detailseite öffnet, dann ist der Verlauf nur lesbar
- [ ] Angenommen ein Mitarbeiter, wenn er versucht, den Verlauf zu lesen oder zu ändern (auch am Formular vorbei), dann wird das abgelehnt
- [ ] Angenommen ein Inhaber eines Kunden A, wenn er versucht, den Verlauf von Kunde B zu lesen oder zu ändern, dann wird das abgelehnt (Mandantentrennung)
- [ ] Angenommen Betreiber und Inhaber haben die Stammdaten gleichzeitig geöffnet und einer hat den Verlauf gespeichert, wenn der andere speichert, dann erhält er den Hinweis „Die Kundendaten wurden inzwischen geändert“ (wie PROJ-28)
- [ ] Angenommen der Verlauf wird geändert, wenn gespeichert wird, dann steht im Protokoll, wer wann den Umsatzsteuer-Status geändert hat

### Allgemein
- [ ] Angenommen bestehende Kunden, wenn das Feature eingespielt wird, dann haben sie keine Einträge und gelten als „mit Umsatzsteuer“; alle übrigen Stammdaten bleiben unverändert
- [ ] Angenommen das Formular auf einem Handy (375 px), wenn der Bereich bedient wird, dann sind Einträge ohne seitliches Scrollen hinzufügbar, änderbar und entfernbar

## Edge Cases
- **Zwei aufeinanderfolgende Einträge mit gleichem Status** (z. B. nach dem Entfernen eines mittleren Eintrags): erlaubt, ohne Wirkung; keine Fehlermeldung.
- **Erster Eintrag „mit Umsatzsteuer“:** erlaubt, ändert nichts am Ausgangszustand.
- **Eintrag weit in der Vergangenheit** (z. B. 2019): erlaubt; alle Buchungen ab dann sind betroffen.
- **Viele Einträge (z. B. 10):** Liste bleibt vollständig sichtbar, keine Blätterfunktion nötig.
- **Option (unbestätigte Buchung):** wie eine Buchung nach der Abreise eingestuft.
- **Sperren:** haben keine Preise; der Status spielt keine Rolle.
- **Abreise wird nachträglich geändert** und fällt dadurch auf die andere Seite eines Stichtags: der Status der Buchung ändert sich entsprechend.
- **Stornodatum:** zählt der Kalendertag der Stornierung in österreichischer Zeit (Storno um 23:30 am 31.07. zählt als 31.07.).
- **Statuswechsel nachträglich zurückdatiert:** wirkt auf alle betroffenen Buchungen; bis zum Rechnungsmodul gibt es keine festgeschriebenen Belege.

## Technical Requirements (optional)
- Regel „Status für Buchung“ an einer Stelle, nutzbar von Formular, Detail und späterem Rechnungsmodul
- Rechte serverseitig durchgesetzt wie bei PROJ-28; Prüfregeln in Browser und Datenbank
- Konfliktschutz und Protokoll über die bestehenden Mechanismen der Stammdaten (PROJ-28)
- Deutsche Texte über die bestehende i18n-Struktur; Barrierefreiheit WCAG 2.1 AA

## Open Questions
- [ ] Genauer Wortlaut der Statusbezeichnungen und ggf. ein kurzer Erklärtext zur Kleinunternehmerregelung (fachliche Prüfung durch den Nutzer)
- [ ] Soll das Rechnungsmodul den Status je Rechnung festhalten? Klärung im Spec des Rechnungsmoduls
- [ ] Braucht das Rechnungsmodul die Regel zusätzlich in der Datenbank? Klärung bei dessen Architektur

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigenes Feature statt Teil von PROJ-35 | Mit Stichtag und Verlauf deutlich größer; Kundeneinstellung eigenständig test- und deploybar; PROJ-35 nutzt nur die Regel | 2026-10-29 |
| Verlauf von Statuswechseln statt einfachem Schalter | Status kann mehrfach wechseln (Grenze überschritten, Option, wieder Kleinunternehmer); ein einziges Datum würde frühere Buchungen falsch einstufen | 2026-10-29 |
| Ohne Eintrag „mit Umsatzsteuer“ | Sicherer Ausgangszustand; Betreiber trägt Kleinunternehmer beim Onboarding ein | 2026-10-29 |
| Maßgeblich ist die (tatsächliche) Abreise, bei Storno das Stornodatum | Beherbergung gilt mit Aufenthaltsende als erbracht; Stornogebühr entsteht mit der Stornierung | 2026-10-29 |
| Buchung als Ganzes einstufen, keine Aufteilung über den Stichtag | Eine Leistung, ein Leistungszeitpunkt; einfach nachvollziehbar | 2026-10-29 |
| Bearbeitung im bestehenden Stammdaten-Formular, eine Speichern-Schaltfläche | Vorgabe des Nutzers; Konfliktschutz und Protokoll wie bei den übrigen Stammdaten | 2026-10-29 |
| Inhaber und Betreiber bearbeiten, Mitarbeiter ohne Zugang | Gleiche Rechte wie die übrigen Stammdaten (PROJ-28) | 2026-10-29 |
| Künftige Wechsel erlaubt und als „geplant“ erkennbar | Wechsel zum Jahresbeginn lässt sich vorab eintragen | 2026-10-29 |
| Keine Überwachung der Umsatzgrenze | Umsatz außerhalb der App (andere Einkünfte) nicht bekannt; Verantwortung beim Vermieter bzw. der Steuerberatung | 2026-10-29 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Tabelle je Statuswechsel statt Liste in einem Feld der Kundentabelle | Datenbank kann „ein Datum je Kunde“ selbst erzwingen; spätere Abfragen (Rechnungsmodul) einfach; eigene Leserechte möglich | 2026-10-29 |
| Speichern über die bestehende Funktion `update_tenant_master_data`, Verlauf wird vollständig ersetzt | Ein Formular, eine Speicherung; Rechte, Aktiv-Prüfung, Konfliktschutz und Protokoll bleiben an einer Stelle; vollständiges Ersetzen ist bei wenigen Einträgen am einfachsten und eindeutig | 2026-10-29 |
| „Zuletzt geändert am“ des Kunden auch bei reiner Verlaufsänderung setzen | Vorhandener Konfliktschutz greift ohne eigenen Stand für den Verlauf | 2026-10-29 |
| Lesen nur für Inhaber und Admin, nicht für Mitarbeiter | Spec: Mitarbeiter ohne Zugang; Status lässt Rückschlüsse auf den Umsatz zu | 2026-10-29 |
| Regel als reine Rechenfunktion in der App, nicht in der Datenbank | Wird jetzt nur zur Anzeige gebraucht (PROJ-35); einfach testbar; eine Datenbank-Fassung kommt erst, wenn das Rechnungsmodul den Status serverseitig festschreiben muss | 2026-10-29 |
| Maßgebliche Abreise = Spalte „Abreise“ der Buchung | Seit PROJ-30 enthält sie die tatsächliche Abreise und sonst die geplante; kein Sonderfall nötig | 2026-10-29 |
| Stornotag aus dem Stornozeitpunkt in österreichischer Zeit | Spec-Edge-Case (Storno 23:30 zählt am selben Tag); gleiches Vorgehen wie „heute“ in der Datenbank | 2026-10-29 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Überblick
Keine neue Seite, kein neues Paket. Erweitert werden:
- das gemeinsame Stammdaten-Formular aus PROJ-28 (Inhaber unter *Einstellungen → Kunde*, Betreiber auf der Kunden-Detailseite) um den Bereich „Umsatzsteuer“,
- die bestehende geschützte Speicherfunktion der Stammdaten, die den Verlauf mitspeichert,
- eine neue Tabelle für die Statuswechsel,
- eine neue Regel „Welcher Status gilt für diese Buchung?“, die PROJ-35 verwendet.

### B) Oberfläche (Komponenten)
```
Stammdaten-Formular (PROJ-28, gemeinsam für Inhaber und Betreiber)
+-- Kundenname, Adresse, Staat, UID, Steuernummer, Registernummer (unverändert)
+-- NEU Bereich „Umsatzsteuer“
|   +-- Zeile „Aktuell: …“ (z. B. „Kleinunternehmer – keine Umsatzsteuer, seit Mi, 01.07.2026“)
|   +-- Leerzustand „Noch kein Wechsel erfasst – es gilt: mit Umsatzsteuer“
|   +-- Liste der Wechsel (neueste oben)
|   |   +-- je Eintrag: „ab“-Datum | Status (Auswahl, zwei Werte) | Kennzeichen „geplant“ bei künftigem Datum | Entfernen
|   +-- Schaltfläche „Wechsel hinzufügen“ (neue Zeile oben, Datum leer, Status vorbelegt mit dem Gegenteil des aktuellen)
+-- Hinweis „inzwischen geändert“ + „Aktuelle Fassung laden“ (unverändert, gilt nun auch für den Verlauf)
+-- Speichern (eine Schaltfläche für alles)
```
- **Bausteine:** vorhandene shadcn-Komponenten: Datumsfeld (`Input` wie im Buchungsformular), `Select` für den Status, `Badge` für „geplant“, `Button` für Hinzufügen/Entfernen. Keine neuen Komponenten installieren.
- **Handy (375 px):** jeder Eintrag zweizeilig (Datum + Entfernen oben, Status darunter), ohne seitliches Scrollen.
- **Deaktivierter Kunde:** Liste nur lesbar, ohne Hinzufügen/Entfernen (wie die übrigen Felder).
- **Sortierung:** Nach dem Speichern bzw. Laden absteigend nach Datum. Während der Bearbeitung bleiben die Zeilen, wo der Nutzer sie hat, damit nichts unter dem Finger springt.
- **Fehleranzeige:** fehlendes Datum/Status und doppeltes Datum direkt an der betroffenen Zeile.

### C) Datenmodell (in Worten)
**Neue Tabelle „Umsatzsteuer-Statuswechsel“** — je Eintrag:
- Kunde (Mandant)
- „ab“-Datum (Kalendertag, ohne Uhrzeit)
- Status: Kleinunternehmer ja/nein
- die üblichen Felder „angelegt/geändert von/am“

Regeln in der Datenbank: je Kunde jedes Datum höchstens einmal; Datum und Status Pflicht. Bestehende Kunden haben keine Einträge (= „mit Umsatzsteuer“), es gibt keine Datenübernahme.

**Lesen:** Inhaber des Kunden und Betreiber-Admin. Mitarbeiter können die Tabelle nicht lesen (strenger als die übrigen Stammdaten, weil der Status Rückschlüsse auf den Umsatz zulässt und Mitarbeiter keine Preise sehen).
**Schreiben:** nur über die Speicherfunktion; direktes Ändern ist für alle gesperrt.

**Kunde (bestehend):** „zuletzt geändert am“ wird auch dann weitergesetzt, wenn sich nur der Verlauf ändert. So greift der vorhandene Konfliktschutz ohne Zusatzaufwand.

**Betreiber-Protokoll:** In der Feldliste des Eintrags „Stammdaten geändert“ erscheint „Umsatzsteuer-Status“, wenn sich der Verlauf geändert hat. Das allgemeine Änderungsprotokoll (PROJ-1) erfasst die neue Tabelle wie alle Mandantentabellen mit alten und neuen Werten.

### D) Speichern
Die bestehende Funktion `update_tenant_master_data` (PROJ-28) erhält den Verlauf als zusätzlichen Teil der Formulardaten. Ablauf unverändert plus ein Schritt:
1. Rechte prüfen (Inhaber dieses Kunden oder Admin mit 2FA)
2. Kunde aktiv
3. Stand vergleichen („inzwischen geändert“)
4. Stammdaten bereinigen und speichern
5. **NEU:** Verlauf mit dem gespeicherten vergleichen; bei Unterschied den Verlauf des Kunden vollständig durch den neuen ersetzen und „zuletzt geändert am“ setzen
6. Protokoll nur bei echter Änderung, Feldliste ggf. mit „Umsatzsteuer-Status“

Alles geschieht in einem Schritt: Entweder werden Stammdaten und Verlauf gemeinsam gespeichert oder gar nichts.

### E) Regel „Status für eine Buchung“
Eine reine Rechenregel in der App (ohne Datenbankzugriff), mit Unit-Tests:
- Eingabe: Verlauf des Kunden + die Buchung (Abreise, ggf. Stornozeitpunkt)
- Maßgeblicher Tag: bei stornierten Buchungen der Kalendertag der Stornierung in österreichischer Zeit, sonst die Abreise. Die Abreise in der Datenbank ist seit PROJ-30 bereits die tatsächliche (bei vorgezogener Abreise) bzw. sonst gleich der geplanten.
- Ergebnis: Status des jüngsten Eintrags am oder vor diesem Tag, sonst „mit Umsatzsteuer“
- Dieselbe Regel liefert ohne Buchung den heutigen Status (Zeile „Aktuell“, Kennzeichen „geplant“) und dient PROJ-35 im Formular, solange noch keine Abreise eingegeben ist.

Die Buchungsseiten laden den Verlauf künftig für Inhaber mit (wenige Zeilen je Kunde). Das baut PROJ-35; PROJ-36 liefert nur die Regel und das Laden.

### F) Tests
- **Unit:** Regel (vor/am/nach Stichtag, mehrere Wechsel, Storno nach Stornotag, Storno kurz vor Mitternacht österreichischer Zeit, ohne Einträge, künftige Einträge, gleiche Status hintereinander); Prüfregeln des Formulars (Pflichtfelder, doppeltes Datum).
- **Datenbank/E2E:** Speichern mit Verlauf (hinzufügen, ändern, entfernen), nur Verlauf geändert → Konflikthinweis beim anderen Nutzer, Protokoll mit „Umsatzsteuer-Status“, doppeltes Datum von der Datenbank abgelehnt, Mitarbeiter kann den Verlauf weder lesen noch ändern, fremder Inhaber abgewiesen, deaktivierter Kunde nur lesbar, Handy-Breite, axe.
- **Regression:** PROJ-28 (Stammdaten, Konflikt, Protokoll), PROJ-4/PROJ-5 Kundenname.

### G) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- Neue Tabelle mit Mandantentrennung; Lesen nur Inhaber + Admin, kein direktes Schreiben
- Speicherfunktion der Stammdaten erweitert (Verlauf, Feldliste)
- Änderungsprotokoll erfasst die neue Tabelle

### Abhängigkeiten (Pakete)
Keine neuen Pakete.

### Umsetzung Frontend (2026-10-29)
- **Regel** `src/lib/vat-status.ts`: `vatStatusOn` (Status an einem Tag), `vatStatusForBooking` / `vatStatusDay` (Abreise bzw. Stornotag in Wiener Zeit), `isPlannedChange`, `vatStatusFromRows` (neueste zuerst). Unit-Tests `vat-status.test.ts`.
- **Formularbereich** `src/components/tenant/vat-status-fields.tsx` im gemeinsamen Stammdaten-Formular (Inhaber und Betreiber): Zeile „Aktuell: …“ aus dem gespeicherten Verlauf, Leerzustand, Liste mit Datum, Status-Auswahl, Kennzeichen „geplant“ und Entfernen; „Wechsel hinzufügen“ fügt oben eine Zeile mit dem Gegenteil des heutigen Status ein. Am Handy zweizeilig. Bei deaktiviertem Kunden nur lesbar.
- **Prüfregeln** `src/lib/validation/tenant.ts`: `vatStatus` mit Pflicht-Datum, Pflicht-Status, doppeltes Datum (Fehler an der zweiten Zeile), höchstens 50 Einträge (`VAT_STATUS_MAX`). Tests in `tenant.test.ts`.
- **Laden:** `MASTER_DATA_COLUMNS` bettet `vat_status_changes(valid_from, small_business)` ein; `TenantMasterData.vatStatus`. Betrifft *Einstellungen → Kunde* und die Betreiber-Detailseite.
- **Speichern:** `saveTenantMasterData` übergibt `vat_status` (Liste aus `valid_from`, `small_business`) in `p_data` an `update_tenant_master_data`. Fehlercode 23505 → „vatDateDuplicate“.
- **Protokoll:** Feldname `vat_status` erscheint als „Umsatzsteuer-Status“ (`tenantData.fields.vatStatus`).
- **Texte** in `messages/de.json` (`tenantData.vat`, Prüf- und Fehlermeldungen).
- **Typen** `src/types/database.ts` von Hand um die Tabelle `vat_status_changes` ergänzt; `/backend` erzeugt sie neu.
- **Offen für /backend:** Tabelle `vat_status_changes` (tenant_id, valid_from, small_business, Audit-Felder; eindeutig je Kunde + Datum; RLS Lesen nur Inhaber + Admin, kein direktes Schreiben; Änderungsprotokoll), `update_tenant_master_data` um `vat_status` erweitern (vollständig ersetzen, höchstens 50, `updated_at` des Kunden setzen, `vat_status` in `changed_fields`). **Ohne Migration schlagen *Einstellungen → Kunde* und die Betreiber-Detailseite beim Laden fehl** (eingebettete Tabelle fehlt).

### Umsetzung Backend (2026-10-29)
- **Migration** `supabase/migrations/20261029172914_vat_status_changes.sql`, eingespielt in Dev:
  - Tabelle `vat_status_changes` (tenant_id, valid_from, small_business, Standardfelder); eindeutig je Kunde + Datum; Datum 2000-01-01 bis 2100-12-31; Löschen des Kunden löscht den Verlauf mit.
  - RLS: Lesen nur Inhaber (`has_role owner`) und Admin; kein insert/update/delete für `authenticated` (nur `select` gewährt). Änderungsprotokoll über `private.enable_tenant_table`.
  - `private.update_tenant_master_data` erweitert: optionaler Schlüssel `vat_status` (fehlt er, bleibt der Verlauf unverändert). Prüft Liste, höchstens 50, Datum `JJJJ-MM-TT`, Status boolean (sonst 22023). Vergleicht mit dem gespeicherten Verlauf unabhängig von der Reihenfolge; nur bei Unterschied: Feld `vat_status` in `changed_fields`, Kundenzeile wird aktualisiert (setzt „zuletzt geändert am“ → Konfliktschutz), Verlauf vollständig ersetzt. Doppeltes Datum → 23505.
- **Frontend-Abgleich:** Datumsbereich 2000–2100 auch im Formular (Meldung `vatDateRange`); Kennzeichen „geplant“ neben statt im Label, damit das Feld für Screenreader „ab“ heißt.
- **Typen** mit `npm run db:types` neu erzeugt (identisch mit der Handfassung). Advisors: nur die zwei bekannten Auth-Hinweise.
- **Tests:**
  - neu `tests/PROJ-36-kleinunternehmer-status.spec.ts`: Speicherfunktion (speichern, ersetzen, entfernen, Reihenfolge egal, ohne Schlüssel unverändert, Protokoll), Konfliktschutz bei reiner Verlaufsänderung (P0017), Prüfregeln (23505, 22023, 23514), Sicherheit (Mitarbeiter und fremder Inhaber lesen/ändern nicht, direktes Schreiben 42501), Formular Inhaber (Leerzustand, Vorbelegung, Pflichtdatum, doppeltes Datum, „geplant“, Sortierung, Entfernen), Betreiber (Protokoll „Staat, Umsatzsteuer-Status“, deaktiviert nur lesbar), Layout + axe (Desktop, Tablet, Handy).
  - Regression: PROJ-28 desktop 19/19 grün; alle 489 Unit-/Integrationstests grün.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
