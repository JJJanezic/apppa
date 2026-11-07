# PROJ-14: Dashboard

## Status: In Progress
**Created:** 2026-11-07
**Last Updated:** 2026-11-07

## Dependencies
- Requires: PROJ-1 (Supabase-Infrastruktur): Mandantentrennung (RLS)
- Requires: PROJ-4 (Kundenkonten & Rollen): Inhaber/Mitarbeiter, Mitgliedschaft bei mehreren Kunden, Kundenwechsel
- Requires: PROJ-6 (Wohnungsverwaltung): Wohnungen, Objekt mit Gemeinde, Archivieren
- Requires: PROJ-8, PROJ-30 (Buchungen): Arten Buchung/Option/Sperre, Storno, tatsächliche Abreise, Buchungsquelle mit Kanalfarbe
- Requires: PROJ-9 (Belegungskalender): Abschnitt „Belegung“ auf dem Dashboard; wird hier um mehrere Kunden erweitert (Vollbild-Seite unverändert)
- Requires: PROJ-15 (Ortstaxe je Wohnung): Abgabe-Positionen mit Ortstaxe-Kennzeichen, Tarif-Bezeichnung je Wohnung
- Requires: PROJ-37, PROJ-40, PROJ-42, PROJ-44 (Rechnungen): Arten Rechnung/Teilrechnung/Schlussrechnung, nacherfasste Rechnungen, Storno
- Requires: PROJ-43 (Rechnungsübersicht): Filter „noch nicht bezahlt“
- Requires: PROJ-45 (Zahlungserfassung): Zahlungsstatus, Offen-Betrag, Fälligkeit, „überfällig“
- Wird genutzt von: PROJ-16 (Ortstaxen-Berichte: Knopf „Meldung vorbereiten“, gleiche Monatszuordnung), PROJ-10/11 (Abschnitt „Synchronisierung“)

## Überblick
Das Dashboard (`/`) zeigt auf einen Blick, was heute zu tun ist und wo Geld oder Rechnungen fehlen. Der Abschnitt „Belegung“ (PROJ-9) bleibt wie er ist. Neu sind Kennzahlen, „Heute“, „Noch nicht abgerechnet“, „Offene Rechnungen“ und „Ortstaxe“. Grundlage für Gestaltung und Anordnung ist der App-Entwurf (`docs/design/app-entwurf-quelltext.html`, Dashboard).

„Heute“ ist immer der Kalendertag in Österreich (Europe/Vienna).

### Alle Kunden auf einem Dashboard
Das Dashboard fasst die Daten **aller aktiven Kunden** zusammen, bei denen die angemeldete Person Inhaber oder Mitarbeiter ist. Der gewählte Kunde (Kundenwechsel, PROJ-4) begrenzt das Dashboard nicht. Alle anderen Seiten zeigen weiterhin nur den gewählten Kunden.
- **Rechte je Kunde:** Was eine Person sieht, richtet sich nach ihrer Rolle beim jeweiligen Kunden. Beispiel: Inhaberin bei Kunde A, Mitarbeiterin bei Kunde B → „Ortstaxe“ und „Noch nicht abgerechnet“ zeigen nur Kunde A, „Heute“, „Belegung“ und „Offene Rechnungen“ zeigen A und B. Ist sie nirgends Inhaberin, fehlen diese beiden Abschnitte ganz.
- **Kundenfilter:** Bei mehr als einem Kunden steht oben unter dem Seitenkopf die Auswahl „Alle Kunden“ / „Kunde A“ / „Kunde B“ … (alphabetisch). Sie gilt für das ganze Dashboard einschließlich Kacheln, Unterzeile und Belegung. Voreinstellung ist „Alle Kunden“. Die Wahl wird **je Gerät** gemerkt. Zeigt sie auf einen Kunden, zu dem die Person nicht mehr gehört, gilt „Alle Kunden“. Der Filter ändert den gewählten Kunden der übrigen Seiten **nicht**.
- **Kundenname je Zeile:** Bei mehr als einem Kunden (und Filter „Alle Kunden“) steht in jeder Zeile von „Heute“, „Noch nicht abgerechnet“ und „Offene Rechnungen“ klein der Kundenname neben der Wohnung. Listen bleiben gemischt und sortiert wie unten beschrieben. Kacheln und Summen gelten über alle Kunden im Filter.
- **Klick auf eine Zeile eines anderen Kunden:** Die App wechselt ohne Rückfrage zu diesem Kunden (wie der Kundenwechsel in der Seitenleiste) und öffnet das Buchungs- bzw. Rechnungsdetail. Danach ist dieser Kunde der gewählte.
- **Belegung:** Die Zeitleiste auf dem Dashboard zeigt die Wohnungen aller Kunden im Filter, gruppiert nach Kunde und darin nach Objekt (Kundenname als Gruppenkopf, nur bei mehr als einem Kunden). Der Objektfilter des Kalenders bietet die Objekte aller Kunden im Filter an. Ein Klick auf einen Eintrag öffnet wie bisher das Detailpanel. Aktionen daraus und das Anlegen per Klick in eine Zeile (PROJ-9) wechseln vorher zum Kunden dieser Wohnung. Die Vollbild-Seite „Belegung“ bleibt beim gewählten Kunden.
- **Nur ein Kunde:** Kein Filter und kein Kundenname. Alles sieht aus wie bei einem einzelnen Kunden.
- Deaktivierte Kunden zählen nicht mit (wie im Kundenwechsel).

### Anordnung
- **Desktop:** Seitenkopf, darunter die Kennzahlen-Kacheln. Darunter zwei Spalten: links breit „Belegung“, rechts schmal untereinander „Heute“, „Noch nicht abgerechnet“, „Offene Rechnungen“, „Ortstaxe“.
- **Handy und Tablet:** alles untereinander in der Reihenfolge Kacheln, „Heute“, „Belegung“, „Noch nicht abgerechnet“, „Offene Rechnungen“, „Ortstaxe“.
- Einladungen (PROJ-4) bleiben oben. Die Zustände „keinem Kunden zugeordnet“ und „deaktiviert“ ändern sich nicht. Dann gibt es keine der neuen Abschnitte.

### Seitenkopf
- Datum und Gruß bleiben unverändert.
- Die Unterzeile wird zum Satz über den Tag, z. B. „Heute reisen 2 Gäste an und 1 ab. 5 von 7 Wohnungen sind belegt.“
  - Gäste = Personen (Erwachsene + Kinder) der heutigen Anreisen; „ab“ = Anzahl der Abreisen (Buchungen).
  - Einzahl: „Heute reist 1 Gast an …“. Keine An- oder Abreisen: „Heute gibt es keine An- oder Abreisen. 5 von 7 Wohnungen sind belegt.“
  - Ohne Wohnungen: bisherige Unterzeile.

### Kennzahlen-Kacheln (Tageslage)
| Kachel | Wert | Zusatzzeile | Wer |
|---|---|---|---|
| Anreisen heute | Anzahl | „N Gäste“ | alle |
| Abreisen heute | Anzahl | „davon N ohne Rechnung“ (nur wenn > 0, nur Inhaber) | alle |
| Belegt heute | „5 / 7“ | „Wohnungen“ | alle |
| Offene Rechnungen | Summe Offen | „N Rechnungen, davon M überfällig“ | alle |

- „Belegt heute“: nicht archivierte Wohnungen, in denen heute eine Buchung oder Option übernachtet (Anreise ≤ heute < tatsächliche Abreise). Sperren zählen nicht als belegt.
- Auslastung und Umsatz kommen nicht aufs Dashboard, sondern in die Auswertungen (PROJ-18).

### Abschnitt „Heute“ (alle)
- Zwei Listen: **„Anreisen“** (Anreise heute) und **„Abreisen“** (tatsächliche Abreise heute, PROJ-30).
- Es zählen Buchungen und Optionen, keine Sperren und keine stornierten. Optionen sind als „Option“ gekennzeichnet.
- Je Zeile: Kanalfarbe (wie im Kalender), Gast, Wohnung und eine Info:
  - Anreise: „2 Pers. · 5 N.“
  - Abreise: „Endreinigung“
- **Abreise ohne Rechnung:** Ist eine abreisende Buchung noch nicht abgerechnet (Regel siehe „Noch nicht abgerechnet“), ist die Zeile hervorgehoben. Statt „Endreinigung“ steht in Warnfarbe **„Rechnung fehlt“** bzw. **„Schlussrechnung fehlt“**. So sieht man vor dem Auschecken, dass noch eine Rechnung zu stellen ist. Für Optionen gibt es den Hinweis nicht.
- Sortierung: nach Wohnung (wie im Kalender).
- Klick auf eine Zeile öffnet das Buchungsdetail.
- Leer: „Heute keine Anreisen.“ bzw. „Heute keine Abreisen.“

### Abschnitt „Noch nicht abgerechnet“ (nur Inhaber)
- Buchungen (keine Optionen, keine Sperren), deren tatsächliche Abreise **heute oder früher** liegt und die noch nicht abgerechnet sind. Rechnungen werden am Abreisetag erstellt, deshalb zählt der heutige Tag mit.
- **Abgerechnet** ist eine Buchung, wenn sie mindestens eine nicht stornierte Rechnung der Art „Rechnung“ oder „Schlussrechnung“ oder eine nicht stornierte nacherfasste Rechnung hat.
  - Nur nicht stornierte Teilrechnungen: nicht abgerechnet, Zusatz **„Schlussrechnung fehlt“**.
  - Keine nicht stornierte Rechnung: Zusatz **„Rechnung fehlt“**.
- Stornierte Buchungen erscheinen nur, wenn sie eine Stornogebühr über € 0,00 haben und keine Rechnung (Stornodatum statt Abreise als Stichtag).
- Je Zeile: Gast, Wohnung, Abreise (Datum nach PROJ-31), Zusatz. Klick öffnet das Buchungsdetail.
- Oben die Anzahl, angezeigt werden die **5 ältesten** (nach Abreise aufsteigend). Darunter der Link „Alle anzeigen“ zur Buchungsübersicht mit Filter „ohne Rechnung“ über alle Monate.
- Leer: „Alle abgereisten Buchungen sind abgerechnet.“

### Abschnitt „Offene Rechnungen“ (alle)
- Rechnungen mit Zahlungsstatus **offen** oder **teilweise** (PROJ-45). Ohne stornierte Rechnungen und ohne Gutschriften. Nacherfasste Rechnungen zählen mit.
- Sortierung: überfällige zuerst (rot, „überfällig“), danach nach nächster Fälligkeit bzw. bei nacherfassten Rechnungen nach Rechnungsdatum, älteste zuerst.
- Je Zeile: Empfänger, Rechnungsnummer, Wohnung (wenn mit Buchung), Offen-Betrag. Klick öffnet das Rechnungsdetail.
- Oben rechts die Summe aller offenen Beträge (alle Rechnungen, nicht nur die angezeigten).
- Höchstens **5 Zeilen**, darunter „Alle offenen“ zur Rechnungsübersicht mit Filter „noch nicht bezahlt“ (PROJ-43).
- Leer: „Keine offenen Rechnungen.“

### Abschnitt „Ortstaxe“ (nur Inhaber)
- Grundlage: alle Positionen mit Ortstaxe-Kennzeichen (PROJ-15), automatisch berechnet oder von Hand geändert, in **Buchungen**. Optionen, Sperren und stornierte Buchungen zählen nicht.
- Die Bezeichnung der Abgabe (z. B. „Nächtigungsabgabe“) spielt keine Rolle. Sie steht schon je Tarif an der Wohnung (PROJ-15), ein neues Feld braucht es nicht.
- **Zuordnung zum Monat: anteilig je Nacht.** Der Betrag einer Position wird gleichmäßig auf ihre Nächte verteilt (Nacht = Datum, an dem sie beginnt; Anreise bis tatsächliche Abreise) und den Monaten zugeordnet, auf Cent gerundet. Rundungsreste gehen in die letzte Nacht, damit die Summe stimmt. Beispiel: Aufenthalt 30.09.–03.10. mit € 15,00 → September € 5,00, Oktober € 10,00. Quartale und Jahre sind die Summe ihrer Monate. Dieselbe Regel gilt für PROJ-16.
- **Gemeinde** = Gemeinde des Objekts der Wohnung (PROJ-6), auch bei archivierten Wohnungen.
- **Mehrere Kunden (Inhaber):** in jedem Teil je Kunde (alphabetisch) eine Zwischenüberschrift mit dem Kundennamen, darunter dessen Gemeinden und bei mehreren Gemeinden „Gesamt“ des Kunden. Es gibt **keine Summe über alle Kunden**, weil jeder Kunde selbst an die Gemeinde meldet. Bei nur einem Kunden (oder Filter auf einen Kunden) gibt es keine Zwischenüberschrift.
- Aufbau (ein Kunde):

```
Laufend          Nov 2026    Q4 2026      2026
Saalbach         € 120,00    € 410,00     € 3.980,00
Zell am See      €  40,00    € 150,00     € 1.210,00
Gesamt           € 160,00    € 560,00     € 5.190,00
──────────────────────────────────────────────────
Abgelaufen       Okt 2026    Q3 2026      2025
Saalbach         € 290,00    € 1.840,00   € 4.020,00
Zell am See      € 110,00    €   520,00   € 1.330,00
Gesamt           € 400,00    € 2.360,00   € 5.350,00
```

  - **Oben „Laufend“:** der ganze laufende Monat, das ganze laufende Quartal, das ganze laufende Jahr. Enthält auch künftige Nächte bereits erfasster Buchungen.
  - **Trennstrich.**
  - **Unten „Abgelaufen“:** der letzte ganz abgelaufene Monat, das letzte ganz abgelaufene Quartal und das letzte ganz abgelaufene Jahr (am 07.11.2026: Oktober 2026, Juli–September 2026, 2025).
  - Je Gemeinde eine Zeile, alphabetisch. Die Zeile „Gesamt“ erscheint nur bei mehr als einer Gemeinde.
  - Eine Gemeinde erscheint, wenn sie in mindestens einem der sechs Zeiträume einen Betrag hat. Leere Zellen zeigen „€ 0,00“.
  - Am Handy darf die Tabelle seitlich scrollen. Die Gemeindespalte bleibt dabei stehen.
- Der Knopf **„Meldung vorbereiten“** kommt unter die Tabelle, aber erst mit PROJ-16. Was er tut, legt PROJ-16 fest. Bis dahin gibt es keinen Knopf.
- Leer (keine Ortstaxe in keinem der Zeiträume): „Noch keine Ortstaxe erfasst. Tarife hinterlegen Sie je Wohnung unter Einstellungen → Wohnungen.“ mit Link.

### Umbenennung „Tourismusabgabe“ → „Ortstaxe“
Die App verwendet einheitlich den neutralen Begriff **„Ortstaxe“**. Wie die Abgabe in einer Gemeinde konkret heißt, steht in der Tarif-Bezeichnung der Wohnung.
- Menüpunkt (noch gesperrt) „Tourismusabgabe“ → „Ortstaxe“, Adresse `/tourismusabgabe` → `/ortstaxe`.
- Hinweistexte im Gemeinde-Feld (Objekt), bei der PLZ-Prüfung und beim Anonymisieren eines Gastes: „Tourismusabgabe“ → „Ortstaxe“.
- PRD und INDEX: „Tourismusabgabe“ → „Ortstaxe“. PROJ-16 heißt künftig **„Ortstaxen-Berichte“**.
- Abgeschlossene Specs bleiben als Historie unverändert.

### Rechte
| | Inhaber | Mitarbeiter |
|---|---|---|
| Kacheln Anreisen/Abreisen/Belegt/Offene Rechnungen | ✓ | ✓ (ohne „davon N ohne Rechnung“) |
| „Heute“ | ✓ | ✓ inkl. Hinweis „Rechnung fehlt“ |
| „Belegung“ | ✓ | ✓ (unverändert) |
| „Noch nicht abgerechnet“ | ✓ | – |
| „Offene Rechnungen“ | ✓ | ✓ (Mitarbeiter sehen laut PROJ-45 Rechnungen und Zahlungen) |
| „Ortstaxe“ | ✓ | – (Mitarbeiter sehen keine Preise, PROJ-15) |

Die Rechte gelten **je Kunde** nach der Rolle der Person bei diesem Kunden. Geladen wird nach denselben Zugriffsregeln wie bei Buchungen, Rechnungen und Zahlungen, also nur Daten von Kunden, bei denen die Person Mitglied ist.

## User Stories
- Als **Inhaber** möchte ich morgens sehen, wer heute an- und abreist, damit ich Schlüssel und Endreinigung planen kann.
- Als **Inhaber** möchte ich bei den heutigen Abreisen sofort sehen, für welche Buchung noch keine Rechnung erstellt ist, damit ich sie stelle, bevor der Gast abreist.
- Als **Inhaber** möchte ich alle abgereisten, noch nicht abgerechneten Buchungen sehen, damit keine Rechnung vergessen wird.
- Als **Inhaber** möchte ich die offenen und überfälligen Rechnungen mit Summe sehen, damit ich weiß, wem ich nachgehen muss.
- Als **Inhaber** möchte ich die Ortstaxe je Gemeinde für den laufenden und den abgelaufenen Monat, das Quartal und das Jahr sehen, damit ich die Meldung an die Gemeinde ohne Nachrechnen vorbereiten kann.
- Als **Mitarbeiter** möchte ich die heutigen An- und Abreisen und die Belegung sehen, damit ich Check-in und Endreinigung organisieren kann.
- Als **Person, die für mehrere Kunden arbeitet** (z. B. Inhaberin zweier Betriebe oder Mitarbeiterin bei mehreren Vermietern), möchte ich auf einem Dashboard alle meine Kunden zusammen sehen, damit ich nicht zwischen den Kunden wechseln muss, um meinen Tag zu planen.
- Als **Person mit mehreren Kunden** möchte ich das Dashboard auf einen Kunden einschränken können, damit ich mich gezielt um einen Betrieb kümmern kann.
- Als **Mitarbeiter** möchte ich sehen, ob für einen abreisenden Gast die Rechnung fehlt, damit ich den Inhaber vor dem Auschecken darauf hinweisen kann.

## Out of Scope
- Abschnitt „Synchronisierung“ (Sync-Status booking.com/Airbnb) → mit PROJ-10/11
- Tabelle „Nächste Anreisen“ aus dem Entwurf → bewusst weggelassen, die Zeitleiste der Belegung zeigt die nächsten Tage
- Auslastung und Umsatz (Kacheln im Entwurf) → PROJ-18 (Auswertungen)
- Knopf „Meldung vorbereiten“ und dessen Ablauf → PROJ-16
- Freie Zeitraumwahl (Jahr/Monate) mit Vorauswahl letzter Monat/letztes Quartal/letztes Jahr, Monats-, Quartals- und Jahresberichte, Export → PROJ-16
- Meldefrist je Gemeinde („Meldung bis 15.“ im Entwurf) → nicht geplant, Fristen sind je Gemeinde verschieden
- Ortstaxe von Optionen (auch nicht als „voraussichtlich“)
- Von Hand angelegte Positionen ohne Ortstaxe-Kennzeichen (z. B. „Nächtigungsabgabe“ aus der Zeit vor PROJ-15)
- Umschalten von „Heute“ auf „Morgen“
- Ändern von Buchungen, Rechnungen oder Zahlungen direkt auf dem Dashboard; alle Zeilen führen nur zur jeweiligen Detailseite
- Anpassbares Dashboard (Abschnitte ein-/ausblenden, verschieben)
- Mehrere Kunden auf anderen Seiten (Vollbild-Belegung, Buchungs-, Rechnungs-, Zahlungsübersicht) → bleiben beim gewählten Kunden
- Summe der Ortstaxe über mehrere Kunden → bewusst nicht, jeder Kunde meldet selbst
- Betreiber-Sicht (Admin ohne Mitgliedschaft) auf Kundendaten → nicht vorgesehen (PROJ-5)
- Neues Feld für die Bezeichnung der Ortstaxe je Wohnung → gibt es schon als Tarif-Bezeichnung (PROJ-15)

## Acceptance Criteria

### Allgemein und Anordnung
- [ ] Angenommen ein Inhaber am Desktop, wenn er das Dashboard öffnet, dann sieht er die Kacheln und darunter links „Belegung“ und rechts „Heute“, „Noch nicht abgerechnet“, „Offene Rechnungen“ und „Ortstaxe“
- [ ] Angenommen ein Inhaber am Handy (375 px), wenn er das Dashboard öffnet, dann stehen die Abschnitte untereinander in der Reihenfolge Kacheln, „Heute“, „Belegung“, „Noch nicht abgerechnet“, „Offene Rechnungen“, „Ortstaxe“, ohne seitliches Scrollen der Seite
- [ ] Angenommen ein Mitarbeiter, wenn er das Dashboard öffnet, dann sieht er Kacheln, „Heute“, „Belegung“ und „Offene Rechnungen“, aber weder „Noch nicht abgerechnet“ noch „Ortstaxe“
- [ ] Angenommen eine Person ohne Kunde oder nur mit deaktiviertem Kunden, wenn sie das Dashboard öffnet, dann sieht sie wie bisher den jeweiligen Hinweis und keinen der neuen Abschnitte
- [ ] Angenommen das Laden eines Abschnitts schlägt fehl, wenn das Dashboard erscheint, dann zeigt nur dieser Abschnitt eine Fehlermeldung mit „Erneut versuchen“, die übrigen bleiben nutzbar

### Mehrere Kunden
- [ ] Angenommen eine Person ist Mitglied bei Kunde A und Kunde B, wenn sie das Dashboard öffnet, dann enthalten Kacheln, Unterzeile, „Heute“, „Belegung“ und „Offene Rechnungen“ Daten beider Kunden, unabhängig davon, welcher Kunde gewählt ist
- [ ] Angenommen die Person ist Inhaberin bei A und Mitarbeiterin bei B, wenn sie das Dashboard öffnet, dann zeigen „Noch nicht abgerechnet“ und „Ortstaxe“ nur Kunde A und die Kachel „Abreisen heute“ zählt „davon N ohne Rechnung“ nur für Kunde A
- [ ] Angenommen die Person ist bei A und B nur Mitarbeiterin, wenn sie das Dashboard öffnet, dann gibt es weder „Noch nicht abgerechnet“ noch „Ortstaxe“
- [ ] Angenommen mehr als ein Kunde und Filter „Alle Kunden“, wenn „Heute“, „Noch nicht abgerechnet“ und „Offene Rechnungen“ erscheinen, dann steht in jeder Zeile klein der Kundenname
- [ ] Angenommen mehr als ein Kunde, wenn das Dashboard erscheint, dann gibt es den Kundenfilter mit „Alle Kunden“ (vorgewählt) und den Kunden alphabetisch
- [ ] Angenommen die Person wählt im Filter Kunde B, wenn das Dashboard neu erscheint, dann zeigen alle Abschnitte einschließlich Kacheln und Belegung nur Kunde B, ohne Kundennamen in den Zeilen; der gewählte Kunde der übrigen Seiten bleibt unverändert
- [ ] Angenommen der Filter steht auf Kunde B, wenn die Person das Dashboard später auf demselben Gerät wieder öffnet, dann steht der Filter weiter auf Kunde B
- [ ] Angenommen der gemerkte Filter zeigt auf einen Kunden, zu dem die Person nicht mehr gehört oder der deaktiviert wurde, wenn das Dashboard erscheint, dann gilt „Alle Kunden“
- [ ] Angenommen Kunde A ist gewählt, wenn die Person auf eine Zeile von Kunde B klickt, dann wechselt die App ohne Rückfrage zu Kunde B und öffnet das Buchungs- bzw. Rechnungsdetail; danach ist Kunde B gewählt
- [ ] Angenommen mehr als ein Kunde, wenn die Belegung auf dem Dashboard erscheint, dann sind die Wohnungen nach Kunde und darin nach Objekt gruppiert, und der Objektfilter bietet die Objekte aller Kunden im Filter an
- [ ] Angenommen Kunde A ist gewählt, wenn die Person in der Dashboard-Belegung in einer Zeile einer Wohnung von Kunde B eine neue Buchung anlegt, dann wird vorher zu Kunde B gewechselt und die Buchung bei Kunde B angelegt
- [ ] Angenommen mehr als ein Kunde, wenn die Person die Vollbild-Seite „Belegung“ öffnet, dann zeigt sie wie bisher nur den gewählten Kunden
- [ ] Angenommen die Person ist Inhaberin bei A und B, wenn „Ortstaxe“ mit Filter „Alle Kunden“ erscheint, dann steht in beiden Teilen je Kunde eine Zwischenüberschrift mit dessen Gemeinden, und es gibt keine Summe über beide Kunden
- [ ] Angenommen eine Person mit nur einem Kunden, wenn sie das Dashboard öffnet, dann gibt es keinen Kundenfilter, keine Kundennamen in den Zeilen und keine Kunden-Zwischenüberschriften
- [ ] Angenommen eine Person ist Mitglied bei A, aber nicht bei C, wenn sie das Dashboard öffnet oder Daten direkt abruft, dann erhält sie keine Daten von Kunde C

### Seitenkopf
- [ ] Angenommen heute reisen Buchungen mit zusammen 2 Personen an, 1 Buchung reist ab und 5 von 7 Wohnungen sind belegt, wenn das Dashboard erscheint, dann lautet die Unterzeile „Heute reisen 2 Gäste an und 1 ab. 5 von 7 Wohnungen sind belegt.“
- [ ] Angenommen heute gibt es keine An- und keine Abreisen, wenn das Dashboard erscheint, dann lautet die Unterzeile „Heute gibt es keine An- oder Abreisen. N von M Wohnungen sind belegt.“

### Kacheln
- [ ] Angenommen heute reisen 2 Buchungen mit 3 und 2 Personen an, wenn das Dashboard erscheint, dann zeigt „Anreisen heute“ 2 und „5 Gäste“
- [ ] Angenommen eine Sperre und eine archivierte Wohnung, wenn „Belegt heute“ berechnet wird, dann zählt die gesperrte Wohnung nicht als belegt und die archivierte Wohnung zählt nicht mit
- [ ] Angenommen eine Buchung mit tatsächlicher Abreise heute, wenn „Belegt heute“ berechnet wird, dann zählt ihre Wohnung durch diese Buchung nicht als belegt
- [ ] Angenommen 3 offene Rechnungen über zusammen € 1.240,00, davon 1 überfällig, wenn das Dashboard erscheint, dann zeigt „Offene Rechnungen“ „€ 1.240,00“ und „3 Rechnungen, davon 1 überfällig“
- [ ] Angenommen ein Inhaber und 2 heutige Abreisen, davon 1 ohne Rechnung, wenn das Dashboard erscheint, dann zeigt „Abreisen heute“ 2 und „davon 1 ohne Rechnung“; ein Mitarbeiter sieht die Zusatzzeile nicht

### Heute
- [ ] Angenommen eine Buchung mit Anreise heute, 2 Personen und 5 Nächten, wenn „Heute“ erscheint, dann steht sie unter „Anreisen“ mit Kanalfarbe, Gast, Wohnung und „2 Pers. · 5 N.“
- [ ] Angenommen eine Buchung mit geplanter Abreise heute, aber tatsächlicher Abreise morgen, wenn „Heute“ erscheint, dann steht sie nicht unter „Abreisen“
- [ ] Angenommen eine Option reist heute an, wenn „Heute“ erscheint, dann steht sie unter „Anreisen“ mit Kennzeichen „Option“; Sperren und stornierte Buchungen erscheinen nicht
- [ ] Angenommen eine Buchung reist heute ab und hat eine nicht stornierte Rechnung, wenn „Heute“ erscheint, dann zeigt ihre Zeile „Endreinigung“ ohne Hervorhebung
- [ ] Angenommen eine Buchung reist heute ab und hat keine nicht stornierte Rechnung, wenn „Heute“ erscheint, dann ist ihre Zeile hervorgehoben und zeigt in Warnfarbe „Rechnung fehlt“
- [ ] Angenommen eine Buchung reist heute ab und hat nur eine Teilrechnung, wenn „Heute“ erscheint, dann ist ihre Zeile hervorgehoben und zeigt „Schlussrechnung fehlt“
- [ ] Angenommen die einzige Rechnung einer heute abreisenden Buchung wurde storniert, wenn „Heute“ erscheint, dann zeigt die Zeile „Rechnung fehlt“
- [ ] Angenommen ein Klick auf eine Zeile in „Heute“, dann öffnet sich das Buchungsdetail
- [ ] Angenommen heute gibt es keine Anreisen, wenn „Heute“ erscheint, dann steht unter „Anreisen“ „Heute keine Anreisen.“ (entsprechend „Heute keine Abreisen.“)

### Noch nicht abgerechnet
- [ ] Angenommen eine Buchung mit tatsächlicher Abreise gestern ohne Rechnung, wenn ein Inhaber das Dashboard öffnet, dann steht sie unter „Noch nicht abgerechnet“ mit Gast, Wohnung, Abreise und „Rechnung fehlt“
- [ ] Angenommen eine Buchung mit Abreise heute ohne Rechnung, wenn der Abschnitt erscheint, dann ist sie enthalten
- [ ] Angenommen eine Buchung mit Abreise morgen ohne Rechnung, wenn der Abschnitt erscheint, dann ist sie nicht enthalten
- [ ] Angenommen eine abgereiste Buchung mit nicht stornierter Rechnung der Art „Rechnung“ oder „Schlussrechnung“ oder einer nacherfassten Rechnung, wenn der Abschnitt erscheint, dann ist sie nicht enthalten
- [ ] Angenommen eine abgereiste Buchung nur mit Teilrechnungen, wenn der Abschnitt erscheint, dann ist sie mit „Schlussrechnung fehlt“ enthalten
- [ ] Angenommen eine abgereiste Option oder Sperre, wenn der Abschnitt erscheint, dann ist sie nicht enthalten
- [ ] Angenommen eine stornierte Buchung mit Stornogebühr € 80,00 und ohne Rechnung, deren Stornodatum heute oder früher liegt, wenn der Abschnitt erscheint, dann ist sie mit „Rechnung fehlt“ enthalten; ohne Stornogebühr ist sie nicht enthalten
- [ ] Angenommen 8 nicht abgerechnete Buchungen, wenn der Abschnitt erscheint, dann zeigt er „8“, die 5 mit der ältesten Abreise und den Link „Alle anzeigen“ zur Buchungsübersicht mit Filter „ohne Rechnung“ über alle Monate
- [ ] Angenommen alle abgereisten Buchungen sind abgerechnet, wenn der Abschnitt erscheint, dann steht dort „Alle abgereisten Buchungen sind abgerechnet.“

### Offene Rechnungen
- [ ] Angenommen Rechnungen mit Status offen, teilweise, bezahlt und überzahlt sowie eine stornierte Rechnung und eine Gutschrift, wenn der Abschnitt erscheint, dann enthält er nur die offene und die teilweise bezahlte Rechnung
- [ ] Angenommen eine überfällige und zwei nicht überfällige offene Rechnungen, wenn der Abschnitt erscheint, dann steht die überfällige oben, rot mit „überfällig“
- [ ] Angenommen 7 offene Rechnungen, wenn der Abschnitt erscheint, dann zeigt er 5 Zeilen, oben die Summe der Offen-Beträge aller 7 und darunter „Alle offenen“
- [ ] Angenommen ein Klick auf „Alle offenen“, dann öffnet sich die Rechnungsübersicht mit Filter „noch nicht bezahlt“
- [ ] Angenommen ein Klick auf eine Zeile, dann öffnet sich das Rechnungsdetail
- [ ] Angenommen eine teilweise bezahlte Rechnung über € 500,00 mit € 200,00 bezahlt, wenn der Abschnitt erscheint, dann zeigt ihre Zeile € 300,00
- [ ] Angenommen keine offenen Rechnungen, wenn der Abschnitt erscheint, dann steht dort „Keine offenen Rechnungen.“

### Ortstaxe
- [ ] Angenommen heute ist der 07.11.2026, wenn der Abschnitt erscheint, dann lauten die Spalten oben „Nov 2026“, „Q4 2026“, „2026“ und unten „Okt 2026“, „Q3 2026“, „2025“, getrennt durch einen Trennstrich
- [ ] Angenommen eine Buchung vom 30.09. bis 03.10.2026 mit Ortstaxe € 15,00, wenn der Abschnitt am 07.11.2026 erscheint, dann zählen € 10,00 zu „Okt 2026“, „Q4 2026“ und „2026“ und € 5,00 zu „Q3 2026“ und „2026“
- [ ] Angenommen eine Buchung vom 28.11. bis 02.12.2026, wenn der Abschnitt im November 2026 erscheint, dann zählt der Anteil der Nächte 28.–30.11. zu „Nov 2026“ und der ganze Betrag zu „Q4 2026“ und „2026“
- [ ] Angenommen ein Betrag, der sich nicht glatt auf die Nächte verteilt (z. B. € 10,00 auf 3 Nächte), wenn er auf Monate verteilt wird, dann ergeben die Monatsanteile zusammen genau € 10,00
- [ ] Angenommen eine Buchung mit tatsächlicher Abreise vor der geplanten, wenn verteilt wird, dann zählen die Nächte bis zur tatsächlichen Abreise
- [ ] Angenommen Wohnungen in zwei Gemeinden mit Ortstaxe, wenn der Abschnitt erscheint, dann gibt es je Teil eine Zeile je Gemeinde (alphabetisch) und eine Zeile „Gesamt“
- [ ] Angenommen nur eine Gemeinde, wenn der Abschnitt erscheint, dann gibt es keine Zeile „Gesamt“
- [ ] Angenommen Abgabe-Positionen mit unterschiedlicher Bezeichnung („Nächtigungsabgabe“, „Ortstaxe“), wenn der Abschnitt erscheint, dann zählen beide zu ihrer Gemeinde
- [ ] Angenommen eine von Hand geänderte Abgabe-Position (Kennzeichen „von Hand geändert“), wenn der Abschnitt erscheint, dann zählt ihr geänderter Betrag
- [ ] Angenommen eine von Hand angelegte Position „Nächtigungsabgabe“ ohne Ortstaxe-Kennzeichen, wenn der Abschnitt erscheint, dann zählt sie nicht
- [ ] Angenommen eine Option, eine Sperre und eine stornierte Buchung mit Abgabe-Positionen, wenn der Abschnitt erscheint, dann zählen sie nicht
- [ ] Angenommen eine archivierte Wohnung hatte im Vorjahr Ortstaxe, wenn der Abschnitt erscheint, dann zählt sie in „2025“ zu ihrer Gemeinde
- [ ] Angenommen eine Gemeinde hat nur in einem der sechs Zeiträume einen Betrag, wenn der Abschnitt erscheint, dann erscheint sie in beiden Teilen, mit „€ 0,00“ in den übrigen Zellen
- [ ] Angenommen in keinem der sechs Zeiträume gibt es Ortstaxe, wenn der Abschnitt erscheint, dann steht dort der Hinweis mit Link zu Einstellungen → Wohnungen
- [ ] Angenommen PROJ-16 ist noch nicht live, wenn der Abschnitt erscheint, dann gibt es keinen Knopf „Meldung vorbereiten“
- [ ] Angenommen ein Mitarbeiter, wenn er versucht, die Ortstaxe-Summen zu laden, dann erhält er sie nicht (auch nicht über einen direkten Aufruf)

### Umbenennung
- [ ] Angenommen die App, wenn ein Nutzer Menü, Gemeinde-Feld, PLZ-Hinweis oder Anonymisieren-Dialog ansieht, dann steht dort „Ortstaxe“ und nirgends „Tourismusabgabe“
- [ ] Angenommen PRD und INDEX, wenn sie gelesen werden, dann heißt PROJ-16 „Ortstaxen-Berichte“ und der Begriff „Tourismusabgabe“ ist durch „Ortstaxe“ ersetzt

## Edge Cases
- **Neuer Kunde ohne Wohnungen:** Kacheln zeigen 0 bzw. „0 / 0“, Abschnitte ihre Leertexte, die Unterzeile bleibt die bisherige. Die Belegung zeigt wie bisher ihren Leerzustand.
- **Mitternacht und Zeitzone:** „Heute“ richtet sich nach Europe/Vienna, nicht nach der Serverzeit (UTC). Kurz nach Mitternacht zählt bereits der neue Tag.
- **Jahreswechsel:** Am 01.01.2027 zeigt „Laufend“ „Jän 2027“, „Q1 2027“, „2027“, „Abgelaufen“ zeigt „Dez 2026“, „Q4 2026“, „2026“.
- **Abreise verlängert (PROJ-30):** Eine Buchung, deren tatsächliche Abreise über die geplante hinaus verschoben wurde, erscheint am tatsächlichen Tag unter „Abreisen“ und erst dann unter „Noch nicht abgerechnet“.
- **Rechnung ohne Buchung (nacherfasst):** erscheint unter „Offene Rechnungen“ ohne Wohnung. Für „Noch nicht abgerechnet“ spielt sie keine Rolle.
- **Rechnung für eine Buchung storniert, neue noch nicht erstellt:** Die Buchung erscheint wieder als „Rechnung fehlt“ (in „Heute“, falls sie heute abreist, und in „Noch nicht abgerechnet“).
- **Überzahlte oder bezahlte Rechnung mit Guthaben:** nicht in „Offene Rechnungen“.
- **Wohnung wechselt das Objekt bzw. Objekt die Gemeinde:** Die Ortstaxe zählt zur aktuellen Gemeinde des Objekts (kein historischer Stand).
- **Langzeitaufenthalt über mehrere Quartale oder Jahre:** wird je Nacht verteilt und erscheint anteilig in jedem betroffenen Zeitraum.
- **Ortstaxe-Position ohne Nächte** (z. B. Abreise = Anreise nach Korrektur): zählt im Monat der Anreise.
- **Sehr viele Buchungen:** Das Dashboard bleibt bei mehreren Tausend Buchungen schnell, auch über mehrere Kunden (Ladezeit siehe unten).
- **Rolle bei einem Kunden ändert sich** (z. B. von Mitarbeiter zu Inhaber): beim nächsten Laden des Dashboards gelten die neuen Rechte.
- **Person wird bei einem Kunden entfernt, während das Dashboard offen ist:** Ein Klick auf eine Zeile dieses Kunden wechselt nicht, sondern zeigt „Kein Zugriff mehr auf diesen Kunden“ und lädt das Dashboard neu.
- **Gleichnamige Objekte oder Wohnungen bei verschiedenen Kunden:** Der Kundenname (Zeilen) bzw. die Kundengruppe (Belegung) unterscheidet sie.
- **Unterzeile bei mehreren Kunden:** „5 von 12 Wohnungen“ zählt die Wohnungen aller Kunden im Filter.

## Technical Requirements
- Ladezeit des Dashboards (ohne Kalender) unter 1 Sekunde bei zusammen 5.000 Buchungen und 2.000 Rechnungen über alle Kunden der Person
- Jeder Abschnitt lädt und scheitert für sich (eigene Fehlergrenze wie beim Kalender)
- Mandantentrennung und Rollen auf Datenbankebene, **je Kunde**: Daten nur von Kunden, bei denen die Person Mitglied ist; Ortstaxe-Summen und „Noch nicht abgerechnet“ nur für Kunden, bei denen sie Inhaber ist, auch serverseitig geprüft
- Datums- und Betragsformate nach PROJ-31
- Responsiv ab 375 px, ohne seitliches Scrollen der Seite
- Barrierefreiheit: Hervorhebungen nicht nur über Farbe (Text „Rechnung fehlt“, „überfällig“)

## Open Questions
- [ ] Hinweis „Rechnung fehlt“ für Mitarbeiter: Reicht der Hinweis, oder soll es später eine Erinnerung an den Inhaber geben? (Kein E-Mail-Versand im MVP)
- [ ] Mehrere Kunden: Sollen später auch Buchungs-, Rechnungs- und Zahlungsübersicht „Alle Kunden“ anbieten? (Nicht Teil von PROJ-14)
- [ ] PROJ-16 übernimmt die Monatszuordnung „anteilig je Nacht“. Klären, ob einzelne Gemeinden nach Abreise- oder Anreisemonat melden lassen (dann Ausnahme in PROJ-16)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Umfang: Kacheln, Heute, Noch nicht abgerechnet, Offene Rechnungen, Ortstaxe; Belegung bleibt | Nutzerentscheidung; die Ortstaxe ist seit PROJ-15 in allen Buchungen vorhanden und lässt sich schon auswerten | 2026-11-07 |
| „Synchronisierung“ erst mit PROJ-10/11, kein Platzhalter | Channex fehlt noch; kein leerer Kasten | 2026-11-07 |
| „Nächste Anreisen“ weggelassen | Nutzerentscheidung; die Zeitleiste zeigt die nächsten Tage | 2026-11-07 |
| Kacheln nur zur Tageslage, keine Auslastung/Umsatz | Auswertungen gehören zu PROJ-18 | 2026-11-07 |
| Abschnitt heißt „Offene Rechnungen“ statt „Offene Zahlungen“ | Nutzerentscheidung; Zahlungen hängen seit PROJ-45 an Rechnungen | 2026-11-07 |
| „Offene Rechnungen“ auch für Mitarbeiter | Mitarbeiter sehen laut PROJ-45 Rechnungen und Zahlungen; Barzahlung bei Schlüsselübergabe | 2026-11-07 |
| Eigener Abschnitt „Noch nicht abgerechnet“, Abreise bis einschließlich heute | Nutzer: Rechnungen werden am Abreisetag erstellt | 2026-11-07 |
| Nur Teilrechnungen → „Schlussrechnung fehlt“ | Erst „Rechnung“, „Schlussrechnung“ oder nacherfasste Rechnung schließt die Abrechnung ab | 2026-11-07 |
| In „Heute“ Abreisen ohne Rechnung hervorheben | Nutzerentscheidung: Rechnung stellen, bevor der Gast abreist | 2026-11-07 |
| Ortstaxe: Monat anteilig je Nacht; gilt auch für PROJ-16 | Entspricht der Meldung nach Nächtigungen; Quartale/Jahre als Summe der Monate; Dashboard und Bericht zeigen gleiche Zahlen | 2026-11-07 |
| Ortstaxe: je Gemeinde laufender Monat/Quartal/Jahr, Trennstrich, letzter abgelaufener Monat/Quartal/Jahr | Nutzerentscheidung; beide Teile je Gemeinde, „Gesamt“ nur bei mehreren Gemeinden | 2026-11-07 |
| Ortstaxe: nur Buchungen, keine Optionen/Stornos; nur Positionen mit Ortstaxe-Kennzeichen | Nutzerentscheidung; Kennzeichen macht die Auswertung unabhängig von der Bezeichnung | 2026-11-07 |
| Keine neue Bezeichnung je Wohnung | Bezeichnung je Tarif gibt es seit PROJ-15 (vom Nutzer bestätigt) | 2026-11-07 |
| Knopf „Meldung vorbereiten“ erst mit PROJ-16 | Kein Knopf, der ins Leere führt; Funktion legt PROJ-16 fest | 2026-11-07 |
| Begriff „Tourismusabgabe“ durch „Ortstaxe“ ersetzen; in PROJ-14 mit umgesetzt | Nutzerentscheidung; neutraler Begriff, konkreter Name über die Tarif-Bezeichnung | 2026-11-07 |
| PROJ-16 heißt „Ortstaxen-Berichte“ | Nutzer: Monats-, Quartals- und Jahresberichte | 2026-11-07 |
| Dashboard fasst alle aktiven Kunden zusammen, bei denen die Person Inhaber oder Mitarbeiter ist | Nutzerentscheidung bei der Freigabe; wer für mehrere Vermieter arbeitet, plant den Tag auf einer Seite | 2026-11-07 |
| Rechte je Kunde nach der Rolle bei diesem Kunden | Mitarbeiter eines Kunden dürfen dessen Preise/Ortstaxe nicht sehen, auch wenn sie anderswo Inhaber sind | 2026-11-07 |
| Belegung auf dem Dashboard ebenfalls über alle Kunden, Vollbild-Seite bleibt beim gewählten Kunden | Nutzerentscheidung | 2026-11-07 |
| Klick auf Zeile eines anderen Kunden wechselt ohne Rückfrage | Nutzerentscheidung; wie Kundenwechsel in der Seitenleiste | 2026-11-07 |
| Ortstaxe bei mehreren Kunden: je Kunde, darin je Gemeinde; keine Summe über Kunden | Nutzerentscheidung; jeder Kunde meldet selbst an die Gemeinde | 2026-11-07 |
| Kundenfilter für das ganze Dashboard, je Gerät gemerkt, ändert den gewählten Kunden nicht; Kundenname je Zeile bei „Alle Kunden“ | Nutzerentscheidung (Filter); Trennung vom gewählten Kunden, damit Filtern nicht die anderen Seiten umstellt | 2026-11-07 |
| Anordnung wie im Entwurf; am Handy „Heute“ vor „Belegung“ | Nutzerentscheidung; am Handy ist der Tag wichtiger als der Kalender | 2026-11-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue Daten werden nicht gespeichert; nur Leseabfragen, Cookie und Erweiterung des Kundenwechsels | Alles lässt sich aus Buchungen, Positionen, Rechnungen und Zahlungsstand bilden | 2026-11-07 |
| Abrechnungsregel je Buchung als Lesesicht mit den Rechten der Person | Eine Regel für „Heute“, „Noch nicht abgerechnet“ und Kachel; Mitarbeiter sehen nur, was RLS erlaubt | 2026-11-07 |
| Ortstaxe als Datenbankfunktion mit Monatssummen je Kunde und Gemeinde; Verteilung je Nacht über aufgelaufene Beträge | Centgenaue Summen, nur Summen übertragen; PROJ-16 nutzt dieselbe Funktion | 2026-11-07 |
| Ein Abruf über 24 Monate (Jänner Vorjahr bis Dezember laufendes Jahr), Zeiträume in der App zusammengezählt | Sechs überlappende Zeiträume ohne Widerspruch und mit einer Abfrage | 2026-11-07 |
| Detailseiten bleiben beim gewählten Kunden; Zeilen anderer Kunden wechseln per Formular an den Kundenwechsel mit Ziel | Kein Umbau aller Bearbeitungsabläufe; Schutz vor fremdem Auslösen wie bisher; keine Probleme mit router.push nach Server-Aktion | 2026-11-07 |
| Kundenwechsel erhält optionales Ziel (nur interne Adressen, gleiche Prüfung wie Rücksprung nach Anmeldung) | Wiederverwendung des geprüften Wechsels; offene Weiterleitung ausgeschlossen | 2026-11-07 |
| Kundenfilter in Adresse (`kunde`) und Cookie je Gerät | Muster des Kalenders (PROJ-9): kein Springen beim Laden, Zurück/Neuladen funktionieren | 2026-11-07 |
| Kalenderabfrage nimmt eine Kundenmenge; Vollbild-Seite übergibt nur den gewählten Kunden | Ein Kalender für beide Seiten, Vollbild bleibt unverändert | 2026-11-07 |
| Neuer Kalender-Parameter öffnet „Neue Buchung“ vorbelegt (Wohnung, Tag) | Anlegen nach Kundenwechsel ohne zweiten Klick | 2026-11-07 |
| Rechnungsliste um nächste Fälligkeit ergänzt; offene Rechnungen vollständig geladen, Summen in der App | Sortierung nach Fälligkeit; offene Rechnungen sind wenige | 2026-11-07 |
| Jeder Abschnitt gestreamt mit eigener Fehlergrenze; ohne Inhaber-Kunden keine Abfrage für Ortstaxe/Nicht abgerechnet | Schnelle Seite, Fehler bleiben lokal, keine unnötigen Abfragen | 2026-11-07 |
| Keine Umleitung von `/tourismusabgabe` | Menüpunkt war nie freigeschaltet | 2026-11-07 |
| Ein Deploy für den ganzen Umfang | Nutzerentscheidung; die Mehrkunden-Regeln betreffen jeden Abschnitt, ein QA-Durchgang | 2026-11-07 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Stand 2026-11-07.** Das Dashboard (`/`) gibt es schon mit Gruß, Einladungen und dem Kalender (PROJ-9). PROJ-14 ergänzt die Abschnitte und hebt das Dashboard über den gewählten Kunden hinaus auf **alle Kunden der Person**. Neue Daten werden **nicht gespeichert**. Es kommen nur Leseabfragen in der Datenbank, ein Cookie für den Kundenfilter und eine Erweiterung des Kundenwechsels dazu.

### A) Aufbau der Seite

```
Dashboard (/)
+-- Seitenkopf (wie bisher: Datum, Gruß)
|   +-- NEU Unterzeile als Satz über den Tag (aus den Kachel-Zahlen)
+-- Einladungen (wie bisher)
+-- NEU Kundenfilter (nur bei mehr als einem Kunden): „Alle Kunden“ / Kunde A / Kunde B …
+-- NEU Kacheln: Anreisen heute · Abreisen heute · Belegt heute · Offene Rechnungen
+-- Zwei Spalten (Desktop) bzw. untereinander (Handy/Tablet)
|   +-- links: Belegung (PROJ-9-Kalender, ERWEITERT um mehrere Kunden)
|   |   +-- Zeitleiste/Monat: Gruppenkopf je Kunde (nur bei mehreren), darin Objekte und Wohnungen
|   |   +-- Objektfilter: Objekte aller Kunden im Filter, bei mehreren Kunden mit Kundenname gruppiert
|   +-- rechts:
|       +-- NEU „Heute“: Anreisen, Abreisen (Hinweis „Rechnung fehlt“ / „Schlussrechnung fehlt“)
|       +-- NEU „Noch nicht abgerechnet“ (nur wenn bei mind. einem Kunden im Filter Inhaber)
|       +-- NEU „Offene Rechnungen“
|       +-- NEU „Ortstaxe“ (nur wenn bei mind. einem Kunden im Filter Inhaber)
+-- Jeder NEU-Abschnitt: eigener Ladezustand (Platzhalter) und eigene Fehleranzeige mit „Erneut versuchen“
```

Zeilen-Bausteine: Jede Zeile in „Heute“, „Noch nicht abgerechnet“ und „Offene Rechnungen“ ist entweder ein **normaler Link** (Zeile gehört zum gewählten Kunden) oder ein **Knopf „wechseln und öffnen“** (anderer Kunde, siehe C). Optisch sind beide gleich.

Wiederverwendet werden: Seitenkopf, Leerzustand, Betragsanzeige und Datumsformate (PROJ-31), Kanalfarben (`entry-style`), Kennzeichen „überfällig“/Option, Kalender-Bausteine aus PROJ-9, shadcn/ui (Card, Table, Select, Button, Skeleton, Badge, Separator). Die Kacheln folgen dem „Cockpit“-Stil des Entwurfs (Symbol, Bezeichnung, große Zahl, Zusatzzeile).

Am Handy darf nur die Ortstaxe-Tabelle seitlich scrollen. Die Spalte „Gemeinde“ bleibt dabei stehen, wie die Namensspalte der Zeitleiste.

### B) Daten

**Nichts Neues gespeichert.** Alle Zahlen kommen aus Buchungen, Positionen, Rechnungen und dem Zahlungsstand (PROJ-45).

**Welche Kunden?** Die Liste der Mitgliedschaften gibt es schon (Kundenwechsel, PROJ-4): je Kunde Name und Rolle der Person, nur aktive Kunden. Daraus entstehen zwei Mengen:
- **Kunden im Filter:** alle, oder der eine gewählte Kunde
- **Inhaber-Kunden im Filter:** davon die, bei denen die Person Inhaber ist

Jede Abfrage bekommt die passende Menge mit. Die Datenbank prüft zusätzlich selbst, dass die Person Mitglied bzw. Inhaber ist. Eine manipulierte Liste liefert also nichts Fremdes.

| Abschnitt | Quelle | Kunden |
|---|---|---|
| Kacheln, Unterzeile, „Heute“ | Buchungen mit Anreise heute, tatsächlicher Abreise heute oder Übernachtung heute; Wohnungen (nicht archiviert) | im Filter |
| Hinweis „Rechnung fehlt“ in „Heute“ | neue **Abrechnungsregel je Buchung** (unten) | im Filter |
| „davon N ohne Rechnung“ | Abrechnungsregel | Inhaber-Kunden |
| „Noch nicht abgerechnet“ | Abrechnungsregel, Anzahl + 5 älteste | Inhaber-Kunden |
| „Offene Rechnungen“, Kachel | Zahlungsstand je Rechnung (PROJ-45), Status offen/teilweise | im Filter |
| „Ortstaxe“ | neue **Monatssummen der Ortstaxe** (unten) | Inhaber-Kunden |
| Belegung | Kalenderabfrage (PROJ-9), künftig für mehrere Kunden | im Filter |

**Neue Abrechnungsregel je Buchung (Lesesicht in der Datenbank):** liefert je Buchung „abgerechnet“, „Rechnung fehlt“ oder „Schlussrechnung fehlt“:
- abgerechnet: mindestens eine nicht stornierte Rechnung der Art „Rechnung“ oder „Schlussrechnung“ oder eine nacherfasste Rechnung
- „Schlussrechnung fehlt“: nur nicht stornierte Teilrechnungen
- sonst „Rechnung fehlt“

Die Sicht liest mit den Rechten der Person. Mitarbeiter sehen also nur, was sie ohnehin sehen dürfen (Rechnungen ja, Beträge nein). „Noch nicht abgerechnet“ legt Stichtag (Abreise bzw. Stornodatum), Art (keine Optionen/Sperren) und Stornogebühr > 0 darüber.

**Neue Monatssummen der Ortstaxe (Datenbankfunktion):** liefert je Kunde, Gemeinde und Monat die Summe für einen Zeitraum von Monaten. Das Dashboard fragt einmal ab **Jänner des Vorjahres bis Dezember des laufenden Jahres** ab (24 Monate). Daraus bildet es die sechs Spalten: laufender Monat, Quartal und Jahr sowie der letzte abgelaufene Monat, das letzte abgelaufene Quartal und das letzte abgelaufene Jahr.
- Grundlage: Positionen mit Ortstaxe-Kennzeichen in nicht stornierten Buchungen (keine Optionen, keine Sperren)
- **Anteilig je Nacht:** Der Betrag wird über die Nächte von Anreise bis tatsächlicher Abreise verteilt. Damit die Summe auf den Cent stimmt, rechnet die Funktion je Monat „bis Monatsende aufgelaufen minus bis Vormonatsende aufgelaufen“, jeweils gerundet. Rundungsreste landen so automatisch im letzten Monat. Eine Position ohne Nächte zählt im Anreisemonat.
- Gemeinde = aktuelle Gemeinde des Objekts der Wohnung
- Nur Kunden, bei denen die Person Inhaber ist. Positionen sind ohnehin schon heute nur für Inhaber lesbar (RLS aus PROJ-8).
- **PROJ-16 verwendet dieselbe Funktion**, damit Dashboard und Berichte gleiche Zahlen zeigen.

**Offene Rechnungen:** Die vorhandene Rechnungsliste mit Zahlungsstand (PROJ-43/45) wird um die **nächste Fälligkeit** ergänzt (für die Sortierung „überfällig zuerst, dann nach Fälligkeit bzw. Rechnungsdatum“). Geladen werden alle offenen und teilweise bezahlten Rechnungen der Kunden im Filter. Das sind erfahrungsgemäß wenige, deshalb rechnet der Server Summe, Anzahl und „davon überfällig“ daraus und zeigt die ersten 5.

**Belegung:** Die Kalenderabfrage bekommt statt des gewählten Kunden die Kunden im Filter. Wohnungen tragen Kunde und Kundennamen mit, sortiert nach Kunde, dann „Objekt · Wohnung“. Die Vollbild-Seite übergibt weiter nur den gewählten Kunden und ändert sich nicht.

**Kundenfilter:** in der Adresse (`?kunde=<id>`, fehlt = „Alle Kunden“) und je Gerät in einem Cookie, wie Ansicht und Objektfilter des Kalenders. Die Adresse gewinnt. Ein unbekannter Kunde gilt als „Alle Kunden“. Gemerkte Objektfilter des Kalenders, die nicht zu den Kunden im Filter passen, gelten als „Alle“ (bestehende Regel).

**„Heute“** ist überall das Datum in Europe/Vienna (vorhandene Hilfsfunktion). Die Seite wird bei jedem Aufruf neu berechnet.

### C) Klick auf einen anderen Kunden

Buchungsdetail, Rechnungsdetail und Kalender-Panel arbeiten weiter nur mit dem **gewählten Kunden**. Daran ändert PROJ-14 bewusst nichts. Gehört eine Zeile zu einem anderen Kunden, wird vorher gewechselt:

1. Die Zeile schickt ein kleines Formular an den vorhandenen **Kundenwechsel** (PROJ-4), mit Kunde und Ziel, z. B. das Buchungsdetail.
2. Der Kundenwechsel prüft wie bisher die Mitgliedschaft, merkt den Kunden und leitet **zum Ziel** weiter statt wie bisher zum Dashboard. Ziele sind nur interne Adressen (gleiche Prüfung wie der Rücksprung nach der Anmeldung).
3. Ist die Person nicht mehr Mitglied, wird nicht gewechselt. Die Weiterleitung führt zum Dashboard mit dem Hinweis „Kein Zugriff mehr auf diesen Kunden“.

Im Kalender gilt dasselbe:
- **Eintrag eines anderen Kunden:** wechseln, Ziel ist das Dashboard mit geöffnetem Eintrag (vorhandener Adress-Parameter).
- **Anlegen per Klick in eine Zeile eines anderen Kunden:** wechseln, Ziel ist das Dashboard mit geöffnetem Formular „Neue Buchung“ für Wohnung und Tag. Dafür bekommt der Kalender einen neuen Adress-Parameter, der das Formular vorbelegt öffnet.

Der Kundenfilter bleibt dabei erhalten, weil er eigenständig gespeichert ist.

### D) Laden, Fehler, Leistung

- Jeder Abschnitt lädt für sich und wird gestreamt. Die Seite erscheint sofort, langsame Abschnitte zeigen kurz einen Platzhalter.
- Jeder Abschnitt hat seine eigene Fehlergrenze mit „Erneut versuchen“, wie der Kalender heute.
- Abschnitte, für die die Person keine Inhaber-Kunden hat, werden gar nicht abgefragt.
- Ziel: unter 1 Sekunde ohne Kalender bei 5.000 Buchungen und 2.000 Rechnungen über alle Kunden. /backend misst das mit Testdaten. Für Anreise und Abreise je Kunde gibt es schon Indizes. Reicht es für die Ortstaxe nicht, kommt ein Teilindex auf Ortstaxe-Positionen dazu.

### E) Umbenennung „Tourismusabgabe“ → „Ortstaxe“

Reine Textänderung in der Übersetzungsdatei und im noch gesperrten Menüpunkt (Adresse `/ortstaxe`). Da der Menüpunkt nie freigeschaltet war, braucht es keine Umleitung der alten Adresse. Ein Test stellt sicher, dass „Tourismusabgabe“ in den Oberflächentexten nicht mehr vorkommt.

### F) Technische Entscheidungen (für PM erklärt)

- **Abrechnungsregel und Ortstaxe-Summen in der Datenbank:** Eine Regel an einer Stelle. Dashboard, später PROJ-16 und die Auswertungen (PROJ-18) können nicht auseinanderlaufen, und es werden nur Summen übertragen statt Tausender Positionen.
- **Ein Abruf über 24 Monate statt sechs Abfragen:** Die sechs Zeiträume überlappen sich. Einmal Monatssummen holen und daraus zusammenzählen ist schneller und sicher widerspruchsfrei.
- **Detailseiten bleiben beim gewählten Kunden, Wechsel per Klick:** Alle Bearbeitungsabläufe (Buchung ändern, Rechnung ausstellen, Zahlung erfassen) sind auf den gewählten Kunden gebaut und geprüft. Ein Wechsel vorab ist ein kleiner, sicherer Eingriff statt eines Umbaus aller Seiten.
- **Wechsel als Formular statt als Link:** Ein Kundenwechsel verändert den Zustand. Als Formular kann ihn keine fremde Seite auslösen (gleicher Schutz wie heute). Er lädt die Zielseite sauber neu, ohne die Probleme mit Server-Aktionen und Weiterleitungen in Next 16.
- **Kundenfilter in Adresse und Cookie wie beim Kalender:** bewährtes Muster. Der Zustand ist ohne Springen beim ersten Laden da, und Zurück/Neuladen funktionieren.
- **Rechte doppelt abgesichert:** Die App fragt nur passende Kunden ab, und die Datenbank prüft Mitgliedschaft und Rolle je Kunde. Beträge von Positionen sind schon heute nur für Inhaber lesbar.

### G) Abhängigkeiten

Keine neuen Pakete.

### H) Tests (Vorschau für /qa)

- **Unit:** Zeiträume aus „heute“ (Monat, Quartal, Jahr, abgelaufen; Jahreswechsel, 1. eines Quartals), Zusammenzählen der Monatssummen, Unterzeile (Einzahl/Mehrzahl/keine), Sortierungen, Filter aus Adresse/Cookie
- **Integration (Datenbank):** Abrechnungsregel (alle Rechnungsarten, Storno, nacherfasst, nur Teilrechnungen), Ortstaxe-Verteilung (Monatsgrenze, Rundung auf den Cent, tatsächliche Abreise, Option/Storno/Sperre ausgenommen, archivierte Wohnung), Rechte: Person ist Inhaberin bei A und Mitarbeiterin bei B, fremder Kunde C, Mitarbeiter ohne Ortstaxe
- **E2E:** Testperson mit zwei Kunden (unterschiedliche Rollen): Filter, Kundenname je Zeile, Klick wechselt den Kunden, Anlegen im Kalender bei anderem Kunden, Person mit einem Kunden ohne Filter, Handy-Reihenfolge

### I) Aufteilung

- **/frontend:** Kundenfilter (Adresse/Cookie), Kacheln, Unterzeile, Abschnitte mit Lade- und Fehlerzuständen, Zeilen als Link bzw. „wechseln und öffnen“, Kalender mit Kundengruppen, Objektfilter über Kunden, neuer Parameter „Neue Buchung vorbelegt“, Anordnung Desktop/Handy, Texte inkl. Umbenennung. Bis zur Migration zeigen die neuen Abschnitte ihren Fehlerzustand bzw. sind ausgeblendet.
- **/backend:** Abrechnungsregel, Ortstaxe-Monatssummen, nächste Fälligkeit in der Rechnungsliste, Kalenderabfrage für mehrere Kunden, Kundenwechsel mit Ziel, Integrationstests, Messung mit 5.000 Buchungen/2.000 Rechnungen.

### Umsetzung Frontend (2026-11-07)

**Gebaut:**
- `src/lib/dashboard.ts` (reine Regeln, mit Tests): Kundenfilter aus Adresse/Cookie, Zeiträume der Ortstaxe (laufend/abgelaufen, Abfragebereich 24 Monate), Ortstaxe-Tabelle je Kunde und Gemeinde, Sortierung offener Rechnungen und der Zeilen in „Heute“, Art der Unterzeile
- `src/lib/dashboard-data.ts`: Kunden im Filter und Inhaber-Kunden; „Heute“ und Kacheln direkt aus Buchungen und Wohnungen (funktioniert schon); die übrigen Abschnitte rufen Datenbank-Funktionen auf, die mit /backend kommen. Fehlen sie, zeigt der Abschnitt „Dieser Abschnitt ist noch nicht verfügbar.“ bzw. die Kachel „–“
- `src/components/dashboard/`: Kundenfilter, Kacheln und Unterzeile, „Heute“ (Abreise ohne Rechnung hervorgehoben in accent-2), „Noch nicht abgerechnet“, „Offene Rechnungen“, „Ortstaxe“ (Tabelle mit stehender Gemeindespalte, Trennstrich, Kunden-Zwischenüberschriften), Platzhalter beim Laden, Fehler je Abschnitt mit „Erneut versuchen“, Hinweis „Kein Zugriff mehr auf diesen Kunden“; `RowTarget`: Link beim gewählten Kunden, sonst Formular an den Kundenwechsel
- Seite `/`: Abschnitte gestreamt (Suspense); Anordnung ab 1280 px zweispaltig (Kalender links), darunter untereinander mit „Heute“ vor „Belegung“
- Kundenwechsel `/kunde-wechseln`: optionales Ziel `weiter` (nur interne Adressen, `safeRedirectPath`); ohne Mitgliedschaft Dashboard mit `?hinweis=kein-zugriff`
- Kalender: lädt auf dem Dashboard die Kunden im Filter, Gruppenkopf je Kunde (Zeitleiste), Kundenname in der Tagesliste (Monat) und im Objektfilter; Klick auf Eintrag bzw. Anlegen in der Zeile eines anderen Kunden wechselt vorher (Ziel mit `eintrag` bzw. neuem Parameter `neu=<Wohnung>_<Anreise>`, der „Neue Buchung“ vorbelegt öffnet). Vollbild unverändert
- Umbenennung: Menüpunkt „Ortstaxe“ (`/ortstaxe`), Hinweistexte (Gemeinde, PLZ, Anonymisieren); E2E PROJ-2 angepasst
- Kacheln (`KpiGrid`) auch unter 400 px zweispaltig, Zahl am Handy 28 px

**Abweichungen:** Texte in Du-Form wie die übrige App („Tarife hinterlegst du …“). Zweispaltig erst ab 1280 px statt „Desktop“ allgemein, damit die Zeitleiste genug Breite hat.

**Vertrag für /backend (Datenbank-Funktionen, alle prüfen Mitgliedschaft bzw. Inhaber-Rolle je Kunde selbst):**
- `dashboard_billing_states(p_booking_ids uuid[])` → `booking_id`, `billing` (`billed` | `missing` | `final_missing`); für alle Mitglieder
- `dashboard_unbilled(p_tenant_ids uuid[], p_today date, p_limit int)` → `booking_id`, `tenant_id`, `last_name`, `first_name`, `title_prefix`, `title_suffix`, `apartment_name`, `property_name`, `due_date` (Abreise bzw. Stornodatum), `cancelled`, `billing`, `total_count` (Gesamtzahl); älteste zuerst; nur Inhaber-Kunden
- `dashboard_open_invoices(p_tenant_ids uuid[])` → `invoice_id`, `tenant_id`, `number`, `recipient`, `invoice_date`, `apartment_name`, `property_name`, `open_cents`, `overdue`, `next_due`; Status offen/teilweise, ohne stornierte und Gutschriften
- `tourist_tax_monthly(p_tenant_ids uuid[], p_from date, p_to date)` → `tenant_id`, `municipality_id`, `municipality_name`, `month` (Monatserster), `amount_cents`; nur Inhaber-Kunden

### Umsetzung Backend (2026-11-07)

**Migration `20261107151812_dashboard.sql`** (Dev eingespielt, Typen neu erzeugt; Advisors: nur der bekannte Hinweis `auth_otp_long_expiry`). Nichts Neues gespeichert, nur Lesefunktionen und zwei Indizes. Muster wie PROJ-43: Kern in `private` (security definer, prüft Mitgliedschaft bzw. Inhaber-Rolle je Kunde einmal), `public` nur Hülle mit den Rechten der Person. Nicht erlaubte Kunden in der Liste werden still übergangen; ohne Anmeldung nicht aufrufbar.
- `private.billing_state(Buchung, Kunde)`: einzige Abrechnungsregel. `billed` = nicht stornierte, ausgestellte Rechnung der Art „Rechnung“/„Schlussrechnung“ oder nacherfasste Rechnung; `final_missing` = nur nicht stornierte Teilrechnungen; sonst `missing` (Entwürfe zählen nicht)
- `dashboard_billing_states(Buchungen)`: für alle Mitglieder, höchstens 500 Buchungen je Aufruf
- `dashboard_unbilled(Kunden, heute, Anzahl)`: nur Inhaber-Kunden; Buchungen mit Abreise bis heute bzw. stornierte mit Stornogebühr > 0 und Stornodatum (Wien) bis heute; älteste zuerst, `total_count` = alle Treffer; höchstens 100 Zeilen
- `dashboard_open_invoices(Kunden)`: alle Mitglieder; nutzt `private.invoice_list_rows` (gleiche Zahlungsregel wie Rechnungsliste); `next_due` = Anzahlungsfrist, solange die Anzahlung nicht beglichen ist, sonst Restfälligkeit; nacherfasste ohne Fälligkeit; höchstens 1.000 Zeilen
- `tourist_tax_monthly(Kunden, von, bis)`: nur Inhaber-Kunden; Positionen mit Ortstaxe-Kennzeichen in nicht stornierten Buchungen; Verteilung je Nacht über aufgelaufene, gerundete Beträge (Summe centgenau, Rest im letzten Monat), ohne Nächte im Anreisemonat; Gemeinde = aktuelle Gemeinde des Objekts. **Für PROJ-16 wiederverwenden.**
- Indizes: `bookings (tenant_id, departure)` für „Heute“, Teilindex `booking_charges (tenant_id, booking_id) where tourist_tax`

**Frontend:** keine Änderung nötig; `dashboard-data.ts` ruft die Funktionen bereits auf (Rückfall „noch nicht verfügbar“ bleibt für Umgebungen ohne Migration).

**Tests:** `supabase/tests/dashboard.integration.test.ts` (12 Tests, grün): Abrechnungsstand inkl. Storno und nacherfasst, „noch nicht abgerechnet“ mit Reihenfolge, Grenze und Gesamtzahl, Storno mit/ohne Gebühr, Optionen, künftige Abreise; offene Rechnungen mit Fälligkeit und „überfällig“; Ortstaxe über Monats- und Jahresgrenze inkl. Rundung (999 → 666/333), ohne Optionen und Stornos, Zeitraum; Rechte: Inhaberin bei A und Mitarbeiterin bei B, Mitarbeiter, fremder Kunde, ohne Anmeldung. Unit-Tests: 791 grün.

**Messung** (Dev, 5.000 Buchungen, 2.000 Rechnungen, 5.000 Ortstaxe-Positionen, Inhaber): noch nicht abgerechnet 171 ms, offene Rechnungen 138 ms, Ortstaxe 84 ms, Buchungen von heute 70 ms, Wohnungen zählen 82 ms. Die Abschnitte laden parallel; Ziel < 1 s erfüllt. Messdaten wieder gelöscht.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
