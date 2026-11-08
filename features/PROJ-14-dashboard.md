# PROJ-14: Dashboard

## Status: Deployed
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
- Wird genutzt von: PROJ-16 (Ortstaxen-Berichte: gleiche Monatszuordnung), PROJ-10/11 (Abschnitt „Synchronisierung“)

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
- Auslastung und Umsatz kommen nicht aufs Dashboard, sondern in die Auswertungen (PROJ-18). **Abgelöst durch PROJ-18 (2026-11-08):** Inhaber erhalten die Kacheln Auslastung und Umsatz (laufender Monat), Offene Rechnungen und Heute (An-/Abreisen); Mitarbeiter behalten die vier Kacheln oben.

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
- Ein Knopf **„Meldung vorbereiten“** ist nicht vorgesehen (Entscheidung in PROJ-16, 2026-11-08). Berichte gibt es über den Menüpunkt „Ortstaxe“.
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
- [ ] Angenommen der Abschnitt erscheint, dann gibt es keinen Knopf „Meldung vorbereiten“ (entfällt laut PROJ-16)
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
| Dashboard-Belegung: „Neue Buchung“/„Neue Sperre“ nur, wenn ausschließlich der gewählte Kunde angezeigt wird | Nutzerentscheidung (QA BUG-4): sonst wäre unklar, bei welchem Kunden angelegt wird; Klick in eine Zeile wechselt richtig | 2026-11-07 |
| Zweispaltig ab 1440 px, Dashboard-Zeitleiste mind. 720 px | QA BUG-3: Zeitleiste passt neben die Abschnitte | 2026-11-07 |
| Anordnung „Zeitung“ (Belegung voll breit, Abschnitte darunter im Raster) | Nutzer nach Auslieferung: Standard-Variante des Entwurfs; „Cockpit“ war ein Umsetzungsfehler (BUG-6) | 2026-11-07 |
| Alt-Positionen „Nächtigungsabgabe“ einmalig per Migration als Ortstaxe kennzeichnen, nur in Buchungen „noch nicht berechnet“ | Nutzer (BUG-7): eine Regel für Dashboard und PROJ-16; Beträge unverändert; keine Doppelzählung | 2026-11-07 |
| Ortstaxe in ganzen Personennächten über die vereinnahmten Nächte verteilen | Nutzer (BUG-9): vereinnahmte Abgabe ist abzuführen; Monatsbeträge müssen Vielfache des Tarifs sein | 2026-11-07 |
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

### Korrekturen nach QA (2026-11-07)
- **BUG-3** (High): Zweispaltige Anordnung erst ab 1440 px (statt 1280 px); Mindestbreite der Dashboard-Zeitleiste 720 px (statt 860 px). Bei 1440 px passen alle 14 Tage neben die Abschnitte. PROJ-9 „Anlegen per Klick“ wieder grün
- **BUG-1** (Medium): „Belegt heute“ und Unterzeile zählen nur nicht archivierte Wohnungen
- **BUG-2** (Low): Ortstaxe-Tabelle in eigenem Scrollbereich mit Tastaturfokus (`role="region"`, `tabIndex=0`); der innere Bereich der Tabelle läuft nicht mehr über. axe am Handy ohne Verstöße
- **BUG-4** (Low): Nutzerentscheidung „Knöpfe ausblenden“: „Neue Buchung“/„Neue Sperre“ erscheinen in der Dashboard-Belegung nur, wenn sie ausschließlich den gewählten Kunden zeigt. Bei mehreren Kunden oder Filter auf einen anderen Kunden legt man per Klick in eine Zeile an (wechselt vorher)
- Tests: neuer E2E-Test für BUG-4; zwei PROJ-9-Handy-Tests holen die Zeitleiste vorher ins Bild (am Handy steht „Heute“ jetzt darüber)
- Läufe: PROJ-14 Desktop 13 grün, Handy und Tablet je 2 grün; PROJ-9 Desktop alle grün (ein Lauf „Blättern um 7 Tage“ einmal rot, einzeln grün), PROJ-9 Handy grün; Unit 791 grün
- **Beobachtung:** Sporadisch (2 von rund 40 Kalender-Klicks direkt nach dem Laden) blieb die Adresse auf „/“ statt zu blättern bzw. das Panel zu öffnen; einzeln nicht reproduzierbar. In /qa erneut beobachten

## QA Test Results

**Tested:** 2026-11-07
**App URL:** http://localhost:3000 (gebauter Server, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)

**Umgebung:** Der Zugriff auf `.env.local` war für die Prüfung gesperrt. Abgesichert über `assertTestableProject` in den Test-Helfern (bricht bei Staging-/Produktions-Adresse ab) und `supabase/.temp/project-ref` = Dev.

### Acceptance Criteria Status (70 Kriterien in 11 Gruppen)

#### Allgemein und Anordnung
- [x] Desktop: Kacheln, links Belegung, rechts Heute/Noch nicht abgerechnet/Offene Rechnungen/Ortstaxe (E2E + Bildschirmfoto)
- [x] Handy 375 px: Heute vor Belegung, kein seitliches Scrollen der Seite (E2E mobile, tablet)
- [x] Mitarbeiter: ohne „Noch nicht abgerechnet“ und „Ortstaxe“, mit „Offene Rechnungen“ (E2E)
- [x] Ohne Kunde / deaktiviert: unverändert (Code unverändert, Regression PROJ-2/PROJ-4 grün)
- [x] Fehler je Abschnitt mit „Erneut versuchen“ (Code-Prüfung; „noch nicht verfügbar“ vor der Migration im Browser gesehen)
- [ ] BUG-3: Am Desktop (1440 px) passt die Zeitleiste nicht mehr in die Spalte, die letzten Tage sind nur nach seitlichem Scrollen erreichbar

#### Mehrere Kunden
- [x] Daten beider Kunden unabhängig vom gewählten Kunden (E2E)
- [x] Rechte je Kunde: Inhaber-Abschnitte und „davon N ohne Rechnung“ nur für Inhaber-Kunden (E2E + Integration)
- [x] Kundenname je Zeile bei „Alle Kunden“ (E2E)
- [x] Kundenfilter: „Alle Kunden“ vorgewählt, Einschränkung auf B, gemerkt nach Neuladen, gewählter Kunde der übrigen Seiten bleibt (E2E, auch Firefox)
- [x] Gemerkter fremder Kunde → „Alle Kunden“ (Unit)
- [x] Klick auf Zeile eines anderen Kunden wechselt ohne Rückfrage und öffnet die Buchung (E2E, auch Firefox)
- [x] Belegung gruppiert nach Kunde; Klick auf Eintrag eines anderen Kunden wechselt und öffnet das Panel (E2E)
- [x] Anlegen in Zeile eines anderen Kunden: Parameter `neu` öffnet „Neue Buchung“ vorbelegt (Unit; Ablauf per Code-Prüfung)
- [x] Vollbild-Seite nur gewählter Kunde (Regression PROJ-9)
- [x] Ortstaxe je Kunde mit Zwischenüberschrift, ohne Summe über Kunden (Unit + Code)
- [x] Nur ein Kunde: kein Filter, keine Kundennamen (E2E)
- [x] Fremder Kunde C liefert keine Daten (Integration)

#### Seitenkopf
- [x] „Heute reisen 6 Gäste an und 3 ab. …“ und „… und niemand ab.“ (E2E)
- [ ] BUG-1: Belegte Wohnungen zählen archivierte mit („3 von 4“ statt „2 von 4“)

#### Kacheln
- [x] Anreisen mit Gästen, Abreisen mit „davon N ohne Rechnung“ (nur Inhaber), Offene Rechnungen mit Summe und „davon 1 überfällig“ (E2E)
- [x] Abreise heute zählt nicht als belegt (E2E: Abreisen nicht in „belegt“)
- [ ] BUG-1: archivierte Wohnung mit laufender Buchung zählt bei „Belegt heute“ mit

#### Heute
- [x] Anreise mit Kanalfarbe, Gast, Wohnung, „3 Pers. · 5 N.“ (E2E)
- [x] „Rechnung fehlt“ / „Schlussrechnung fehlt“ hervorgehoben, mit Rechnung „Endreinigung“ (E2E, auch Firefox)
- [x] Stornierte Rechnung → wieder „Rechnung fehlt“ (Integration)
- [x] Tatsächliche Abreise maßgeblich (Abfrage über `departure`; Integration)
- [x] Leertexte (Code)

#### Noch nicht abgerechnet
- [x] Inhalt, Reihenfolge, Abreise heute dabei, morgen nicht, nur Teilrechnungen → „Schlussrechnung fehlt“, Optionen/Sperren nicht, Storno mit Gebühr dabei, ohne Gebühr nicht, Grenze 5 + Gesamtzahl (Integration + E2E)

#### Offene Rechnungen
- [x] Nur offen/teilweise, überfällige zuerst und rot, Summe über alle, Offen-Betrag (E2E + Integration)
- [x] „Alle offenen“ → Rechnungsübersicht „noch nicht bezahlt“ (Code: `invoiceListHref({ payment: 'unpaid' })`)

#### Ortstaxe
- [x] Spalten „Laufend“/„Abgelaufen“, Monat/Quartal/Jahr inkl. Jahreswechsel (Unit + E2E)
- [x] Anteilig je Nacht über Monats- und Jahresgrenzen, centgenau (Integration: 1500 → 500/1000, 999 → 666/333)
- [x] Ohne Optionen, Sperren, Stornos; Bezeichnung egal; nur Positionen mit Kennzeichen (Integration)
- [x] Mehrere Gemeinden mit „Gesamt“, eine ohne; Gemeinden mit Betrag nur in einem Zeitraum (Unit)
- [x] Kein Knopf „Meldung vorbereiten“ (E2E)
- [x] Mitarbeiter erhält keine Summen, auch nicht direkt (Integration)

#### Umbenennung
- [x] Menü „Ortstaxe“, `/ortstaxe` gesperrt (Regression PROJ-2 angepasst, grün); keine „Tourismusabgabe“ in `messages/de.json`
- [x] PRD und INDEX umbenannt

### Edge Cases Status
- [x] Neuer Kunde ohne Wohnungen: bisherige Unterzeile, Leertexte (Code + Paula-Test mit einer Wohnung)
- [x] Zeitzone Europe/Vienna (`todayIso`, Abfragen mit Wiener Datum)
- [x] Jahreswechsel (Unit)
- [x] Rechnung ohne Buchung erscheint ohne Wohnung (Integration)
- [x] Überzahlte/bezahlte Rechnung nicht offen (Integration)
- [x] Langzeitaufenthalt über Monats-/Jahresgrenze (Integration)
- [x] Position ohne Nächte im Anreisemonat (Code)
- [x] Person bei einem Kunden entfernt → „Kein Zugriff mehr auf diesen Kunden“ (E2E über fremden Kunden)
- [x] Leistung: 70–171 ms je Abschnitt bei 5.000 Buchungen/2.000 Rechnungen (Messung /backend)

### Security Audit Results
- [x] Ohne Anmeldung: Datenbank-Funktionen nicht aufrufbar (Integration)
- [x] Fremde Kunden in der Kundenliste der Abfrage werden übergangen (Integration, Kunde C)
- [x] Rollen je Kunde serverseitig: Mitarbeiter erhält weder Ortstaxe noch „noch nicht abgerechnet“ (Integration)
- [x] Kundenwechsel: fremder Kunde wechselt nicht; Ziel nur intern (`https://…`, `//…`, `/\…` → eigene Herkunft); fremde Herkunft → 403 (E2E)
- [x] Keine Beträge an Mitarbeiter über „Heute“ (nur Abrechnungsstand, keine Beträge)
- [x] XSS: alle Namen über React ausgegeben, kein HTML eingefügt
- [ ] Hinweis (kein Bug): Die Funktionen nehmen beliebig lange Kundenlisten an; je Eintrag eine Rollenprüfung. Nur für angemeldete Personen, Last gering.

### Regression
- [x] PROJ-2 App-Shell: 19 grün (4 übersprungen, nur Handy/Tablet)
- [x] PROJ-4 Kundenkonten: 16 grün; „bestehendes Konto einladen“ einmal rot, einzeln wiederholt grün (Flakiness auf der Team-Seite, ohne Bezug zu PROJ-14)
- [ ] PROJ-9 Belegungskalender: „Anlegen per Klick“ (2 Tests) rot → BUG-3. „Klick auf einen Balken öffnet das volle Detail“ einmal rot, in zwei weiteren Läufen grün (nicht reproduzierbar)
- [x] Unit: 791 grün; Integration Dashboard: 12 grün
- [x] Firefox: Kernabläufe (Filter, Wechsel per Klick, Hinweis „Rechnung fehlt“) grün. Safari nicht geprüft (nur gegen `npm run dev`, optional)

### Bugs Found

#### BUG-1: Archivierte Wohnung mit laufender Buchung zählt bei „belegt“ mit
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Wohnung archivieren, die heute noch eine laufende Buchung hat (laut PROJ-6 erlaubt)
  2. Dashboard öffnen
  3. Expected: „Belegt heute 2 / 4“ und „2 von 4 Wohnungen sind belegt“ (archivierte zählen nicht, Spec)
  4. Actual: „3 / 4“ bzw. „3 von 4 Wohnungen“; Zähler kann sogar über der Gesamtzahl liegen
- **Ursache:** `getTodayOverview` zählt belegte Wohnungen aus allen Buchungen, ohne archivierte Wohnungen auszunehmen
- **Test:** E2E „Archivierte Wohnung zählt bei „Belegt heute“ nicht mit …“ (rot)
- **Priority:** Fix before deployment

#### BUG-2: Ortstaxe-Tabelle am Handy: Scrollbereich nicht per Tastatur erreichbar
- **Severity:** Low
- **Steps to Reproduce:**
  1. Dashboard am Handy (375 px) als Inhaber mit Ortstaxe öffnen
  2. axe-Prüfung (WCAG 2 A/AA)
  3. Expected: keine Verstöße
  4. Actual: `scrollable-region-focusable` am Tabellen-Wrapper (`.overflow-auto.relative.w-full`); Tastaturnutzer können die rechten Spalten nicht erreichen
- **Test:** E2E „Barrierefreiheit (axe) ohne Verstöße“ (mobile rot; desktop und tablet grün)
- **Priority:** Fix before deployment (kleiner Eingriff)

#### BUG-3: Zeitleiste passt am Desktop nicht mehr in die Belegungsspalte (Regression PROJ-9)
- **Severity:** High
- **Steps to Reproduce:**
  1. Dashboard bei 1440 px Breite öffnen
  2. Zeitleiste ansehen
  3. Expected: alle 14 Tage sichtbar wie vor PROJ-14 (PROJ-9)
  4. Actual: Spalte ca. 740 px, Zeitleiste mindestens 860 px; die letzten ca. 2 Tage nur nach seitlichem Scrollen sichtbar. Klick auf diese Tage zum Anlegen trifft daneben
- **Folge:** PROJ-9 E2E „freier Tag öffnet ‚Neue Buchung‘ vorbelegt“ und „Mitarbeiter können per Klick anlegen“ rot
- **Priority:** Fix before deployment

#### BUG-4: „Neue Buchung“/„Neue Sperre“ legt nur beim gewählten Kunden an, auch wenn der Filter einen anderen Kunden zeigt
- **Severity:** Low
- **Steps to Reproduce:**
  1. Person mit Kunde A (gewählt) und B; Dashboard-Filter auf B
  2. In der Belegung „Neue Buchung“ wählen
  3. Expected: Wohnungen des angezeigten Kunden B (oder Wechsel zu B)
  4. Actual: Auswahl zeigt die Wohnungen von A (Code: `bookable` kommt immer vom gewählten Kunden). Anlegen per Klick in eine Zeile wechselt dagegen richtig
- **Priority:** Fix in next sprint (Spec regelt die Knöpfe nicht; ggf. per /refine klären)

### Tests
- `tests/PROJ-14-dashboard.spec.ts`: 13 Tests (Abläufe Desktop, Anordnung Handy/Tablet, axe)
- `supabase/tests/dashboard.integration.test.ts`: 12 Tests (aus /backend)
- `src/lib/dashboard.test.ts`, `src/lib/calendar.test.ts`: reine Regeln

### Summary
- **Acceptance Criteria:** 68/70 bestanden; 2 rot wegen BUG-1 (Seitenkopf und Kachel „Belegt heute“). BUG-3 betrifft PROJ-9-Kriterien, nicht PROJ-14
- **Bugs Found:** 4 total (0 critical, 1 high, 1 medium, 2 low)
- **Security:** Pass
- **Production Ready:** NO
- **Recommendation:** BUG-3 und BUG-1 beheben (BUG-2 mitnehmen, ist klein), dann `/qa` erneut
- **Entscheidung Nutzer (2026-11-07):** alle vier Bugs vor dem Deploy beheben (BUG-4 eingeschlossen; Verhalten von „Neue Buchung“ bei gefiltertem Kunden in /frontend klären)

### QA-Runde 2 (2026-11-07, nach den Korrekturen 2aaf0c7)

**Bugs aus Runde 1**
- [x] BUG-3 (High) behoben: bei 1440 px passen alle 14 Tage neben die Abschnitte; PROJ-9 „Anlegen per Klick“ (2 Tests) grün
- [x] BUG-1 (Medium) behoben: „2 von 4 Wohnungen“, Kachel „2 / 4“ (E2E grün)
- [x] BUG-2 (Low) behoben: axe am Handy ohne Verstöße
- [x] BUG-4 (Low) behoben nach Nutzerentscheidung „Knöpfe ausblenden“ (neuer E2E-Test grün)

**Läufe**
- PROJ-14 E2E: Desktop 13/13, Handy und Tablet je 2/2
- PROJ-9 E2E: Desktop 22/22, Handy 2/2
- PROJ-2 E2E: 19 grün (4 nur Handy/Tablet übersprungen)
- Integration Dashboard 12/12, Unit 791/791

**Untersuchung der sporadischen Ausfälle (Beobachtung aus Runde 1)**
- Wiederholungsläufe (`--repeat-each`) gegen den neuen Stand: „Blättern um 7 Tage“ 8/8 grün, „Klick auf einen Balken … Bearbeiten“ 3/4 (einmal zeigte das Panel nach dem Speichern den neuen Stand nicht innerhalb von 5 s)
- Gegenprobe gegen den Stand vor PROJ-14 (`5390d7a`, eigenes Arbeitsverzeichnis): beide Tests 16/16 grün
- Ladezeit: Dashboard warm ca. 420 ms, Vollbild-Belegung ca. 330 ms (kalt 1,5 s bzw. 0,6 s); Ziel < 1 s erfüllt
- Zusammen mit Runde 1: 3 Ausfälle in rund 30 Kalender-Abläufen auf dem Dashboard, 0 in 16 vorher. Nicht gezielt reproduzierbar; vermutlich konkurrieren die gestreamten Abschnitte mit Navigation bzw. Aktualisierung nach dem Speichern (verwandt mit dem bekannten Next-16-Verhalten „router.push nach Server-Aktion“)

#### BUG-5: Sporadisch verlorene Aktualisierung bzw. Navigation im Dashboard-Kalender
- **Severity:** Low
- **Steps to Reproduce:**
  1. Dashboard öffnen, sofort in der Belegung blättern bzw. einen Eintrag bearbeiten und speichern
  2. Expected: Zeitraum wechselt bzw. das Panel zeigt den neuen Stand
  3. Actual: selten (ca. 1 von 10) bleibt die Adresse auf „/“ bzw. das Panel zeigt kurz den alten Stand; Neuladen zeigt den richtigen Stand. Keine Daten gehen verloren
- **Priority:** Nice to have (beobachten; falls Nutzer es bemerken: Abschnitte ohne Streaming laden oder Aktualisierung nach dem Speichern über `redirect()` wie bei PROJ-8)

### Summary (Runde 2)
- **Acceptance Criteria:** 70/70 bestanden
- **Bugs:** 0 critical, 0 high, 0 medium, 1 low offen (BUG-5)
- **Security:** Pass (unverändert)
- **Production Ready:** YES
- **Recommendation:** Deploy; BUG-5 nach dem Deploy beobachten

### Nachbesserung nach der Auslieferung (2026-11-07)
Code und Migration `20261107151812` sind seit 2026-11-07 auf Staging und Produktion (`09f8b99`). Bei der Prüfung in Produktion fielen Abweichungen auf; PROJ-14 ist deshalb noch nicht als „Deployed“ verbucht. Die Herleitung erfolgte gemeinsam mit dem Nutzer anhand echter Daten (nur lesend); Einzelheiten stehen bewusst nicht hier.

#### BUG-6: Anordnung „Cockpit“ statt „Zeitung“
- **Severity:** Medium
- Der Entwurf hat zwei Varianten; voreingestellt ist „Zeitung“ (`layout ?? 'Zeitung'`): Belegung in voller Breite, darunter die Abschnitte im Raster (`repeat(auto-fit, minmax(260px, 1fr))`). Umgesetzt wurde „Cockpit“ (Spalte rechts neben dem Kalender)
- **Korrektur:** Kacheln, Belegung in voller Breite, darunter „Heute“, „Noch nicht abgerechnet“, „Offene Rechnungen“, „Ortstaxe“ im Raster; am Handy untereinander in dieser Reihenfolge. Die Ausnahmen aus BUG-3 (zweispaltig ab 1440 px, schmalere Dashboard-Zeitleiste) entfallen

#### BUG-7: Von Hand angelegte Alt-Positionen der Ortstaxe zählen nicht
- **Severity:** High (Summen zu niedrig)
- Buchungen von vor PROJ-15 stehen auf „noch nicht berechnet“; ihre Abgabe wurde als normale Zusatzposition „Nächtigungsabgabe“ eingetippt, ohne Ortstaxe-Kennzeichen. Das Dashboard zählt nur gekennzeichnete Positionen
- **Entscheidung Nutzer:** einmalig per Migration kennzeichnen: Positionen in Buchungen „noch nicht berechnet“, deren Bezeichnung einer Ortstaxe entspricht („Nächtigungsabgabe“, „Ortstaxe“, „Aufenthaltsabgabe“, „Tourismusabgabe“, „Kurtaxe“ oder Tarif-Bezeichnung der Wohnung; ohne Groß-/Kleinschreibung). Ohne Tarif-Verweis und Personennächte; Bezeichnung, Betrag, USt, Buchungsstatus und Rechnungen bleiben unverändert. Auf „noch nicht berechnet“ begrenzt, damit von Hand doppelt erfasste Abgaben in neueren Buchungen nicht mitgezählt werden
- Vorher in Dev prüfen: Öffnen, Ändern, Speichern solcher Buchungen (Inhaber, Mitarbeiter) und „Abgabe berechnen“

#### BUG-8: Verteilung bei Tarifwechsel
- **Severity:** Medium
- Reicht ein Aufenthalt über einen Tarifwechsel, hat er je Tarif eine Position (PROJ-15). Bisher wird jede Position über den ganzen Aufenthalt verteilt; richtig ist nur über die Nächte ihres Tarifzeitraums (ab „gültig ab“ bis vor den nächsten Tarif der Wohnung). Positionen ohne Tarif-Verweis weiter über den ganzen Aufenthalt
- Bekannte Grenze: Alt-Positionen, die nach der geplanten statt der tatsächlichen Abreise berechnet wurden, ergeben krumme Monatsanteile; die Summe stimmt

**Vorgehen (Nutzer):** alles zusammen über QA und Staging; die Kennzeichnung wird nicht vorgezogen.

#### Umsetzung der Nachbesserung (2026-11-07)
- **BUG-6:** `src/app/(app)/page.tsx`: Kacheln, Belegung in voller Breite, darunter die vier Abschnitte im Raster `sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]`; am Handy untereinander. Dashboard-Zeitleiste wieder mind. 860 px (wie PROJ-9)
- **BUG-7/BUG-8:** Migration `20261107194628_dashboard_tourist_tax_fix.sql` (Dev eingespielt; Advisors nur `auth_otp_long_expiry`): einmalige Kennzeichnung der Alt-Positionen; `private.tourist_tax_monthly` verteilt nach Tarifzeitraum
- **Vorab geprüft:** Gekennzeichnete Positionen ohne Tarif gibt es schon (gelöschter Tarif, `on delete set null`). `private.tourist_tax_mark` übernimmt sie, das Buchungsformular schickt das Kennzeichen unverändert zurück und ersetzt solche Positionen bei „Abgabe berechnen“ (keine Doppelung); Buchungsdetail und Rechnungsentwurf werten das Kennzeichen nicht aus. Sichtbar: Plakette „von Hand geändert“ an diesen Positionen im Formular
- **Tests:** Integration 14/14 (neu: Tarifwechsel innerhalb eines Aufenthalts, Position ohne Tarif über den ganzen Aufenthalt). E2E PROJ-14 Desktop 14/14, Anordnung auf Desktop/Tablet/Handy grün (neu: Abschnitte unter der Belegung; Altbuchung mit gekennzeichneter Position bearbeiten und speichern, Kennzeichen und Betrag bleiben). PROJ-9 Desktop 22/22 (ein Panel-Test einmal rot, 3× wiederholt grün), Handy grün (Messzeile vorher ins Bild geholt). PROJ-15 13/13. Unit 791/791

### QA-Runde 3 (2026-11-07, Nachbesserung `9060cd7`)

**BUG-6/7/8**
- [x] BUG-6 behoben: Anordnung „Zeitung“ (Kacheln, Belegung voll breit, Abschnitte darunter im Raster; am Handy untereinander). Bildschirmfotos Desktop und Handy geprüft; E2E „Abschnitte stehen unter der Belegung“ auf Desktop, Tablet, Handy grün
- [x] BUG-7 behoben: gekennzeichnete Alt-Positionen ohne Tarif zählen in der Ortstaxe (Integration); Altbuchung lässt sich bearbeiten und speichern, Kennzeichen und Betrag bleiben (E2E); „Abgabe berechnen“ ersetzt die gekennzeichnete Alt-Position statt sie zu verdoppeln, kein Doppelungs-Hinweis (neuer E2E-Test in PROJ-15)
- [x] BUG-8 behoben: Verteilung nach Tarifzeitraum bei Tarifwechsel innerhalb eines Aufenthalts (Integration; mit dem alten Modell rot)
- [x] Abgleich mit Echtdaten: Die neue Regel wurde mit dem Nutzer in Produktion nur lesend nachgerechnet; das Ergebnis entspricht der Erwartung (Einzelheiten nur im Chat)

**Läufe:** PROJ-14 E2E Desktop 15/15, Anordnung Tablet/Handy grün, Firefox Kernabläufe 4/4; Integration Dashboard 14/14; PROJ-15 E2E 14/14 (inkl. neuem Test); PROJ-9 Desktop 22/22 und Handy grün (aus /frontend der Nachbesserung); Unit 791/791

**Beobachtungen (kein Bug)**
- Quartale und Jahre sind Summen gerundeter Monatsbeträge; gegenüber einer Rechnung je Position kann das um einen Cent abweichen
- Alt-Positionen, die nach der geplanten statt der tatsächlichen Abreise berechnet wurden, ergeben krumme Monatsanteile; die Summe stimmt
- Am Handy scrollt die Ortstaxe-Tabelle in ihrem fokussierbaren Bereich seitlich (Jahresspalte angeschnitten)

**Offen:** BUG-5 (Low, sporadisch verlorene Navigation/Aktualisierung im Dashboard-Kalender) unverändert, beobachten

### Summary (Runde 3)
- **Acceptance Criteria:** 70/70 bestanden; Nachbesserung BUG-6/7/8 bestanden
- **Bugs:** 0 critical, 0 high, 0 medium, 1 low offen (BUG-5)
- **Security:** unverändert Pass (Migration ändert nur Kennzeichen, Funktion behält Rechte und Prüfung je Kunde)
- **Production Ready:** YES
- **Recommendation:** Deploy (zweite Migration `20261107194628` und Code über Staging nach Produktion)

#### BUG-9: Ortstaxe-Monatsbeträge keine Vielfachen des Tarifs (2026-11-07, nach Auslieferung der Nachbesserung)
- **Severity:** High (Summen fachlich falsch verteilt)
- Ursache: Positionen wurden anteilig in Cent auf die Nächte verteilt. Passt der Betrag nicht genau zu den Nächten (Alt-Position für die vereinbarten Nächte, Gast reiste früher ab), entstehen Beträge wie x,13 €
- **Entscheidung Nutzer:** Die vereinnahmte Ortstaxe ist abzuführen, auch wenn der Gast früher abreist. Verteilt wird in **ganzen Personennächten zum Tarif** über die **vereinnahmten Nächte**: mit Tarif-Verweis (automatisch berechnet) bis zur tatsächlichen Abreise innerhalb des Tarifzeitraums, ohne Tarif-Verweis (Alt-Positionen) bis zur späteren Abreise (geplant oder tatsächlich). Gleich viele Personennächte je Nacht, Rest in die letzten Nächte. Nur Beträge, die kein Vielfaches des Tarifs sind (Prozent-Tarif, frei geänderter Betrag, ohne Tarif), weiter anteilig in Cent
- **Umsetzung:** Migration `20261107222638_dashboard_tourist_tax_units.sql` (`private.tourist_tax_monthly` ersetzt; Dev eingespielt, Advisors nur `auth_otp_long_expiry`). Gilt auch für PROJ-16
- **Tests:** Integration 16/16 (neu: Alt-Position mit früherer Abreise in ganzen Personennächten; Betrag kein Vielfaches → anteilig in Cent). E2E Ortstaxe/Altbuchung/Anordnung 3/3. Abgleich mit Echtdaten nur lesend: alle Quartalswerte Vielfache des jeweiligen Tarifs (Einzelheiten nur im Chat)
- Anordnung: vom Nutzer bestätigt (Abschnitte unter der Zeitleiste)

#### Kacheln und Abschnitte als Flächen (2026-11-07, Wunsch Nutzer)
- Kacheln oben und die vier Abschnitte unter der Belegung je als Fläche `surface` (Design-System: Karten, Panels; entspricht praktisch dem Zeilen-Hover `neutral-200`), runde Ecken, Innenabstand; Belegung ohne Fläche
- Zeilen-Hover in den Karten eine Stufe dunkler (`neutral-300`); Fehler-/Hinweisfeld in der Karte auf `bg`; stehende Gemeindespalte der Ortstaxe in Kartenfarbe
- Ortstaxe ab Tablet zwei Spalten breit, damit alle drei Zeiträume ohne seitliches Scrollen Platz haben
- Tests: Anordnung und axe auf Desktop/Tablet/Handy 6/6, Dashboard Desktop 15/15

### QA-Runde 4 (2026-11-07, BUG-9 `65fe9e3` und Kartenflächen `2862b9c`)
- [x] BUG-9: Verteilung in ganzen Personennächten über die vereinnahmten Nächte (Integration 18/18; neu: Position mit Tarif bei früherer Abreise über die tatsächlichen Nächte, negative Position anteilig mit stimmender Summe, Alt-Position bis zur späteren Abreise, Betrag kein Vielfaches → anteilig in Cent). Abgleich mit Echtdaten nur lesend: alle Quartalswerte Vielfache des jeweiligen Tarifs
- [x] Kartenflächen: Kacheln und Abschnitte als Flächen, Ortstaxe ab Tablet zwei Spalten; Bildschirmfotos geprüft; axe auf Desktop/Tablet/Handy ohne Verstöße
- **Läufe:** PROJ-14 E2E Desktop 15/15, Tablet/Handy 4/4, Firefox Kernabläufe 4/4; PROJ-15 E2E 14/14 (ein Test einmal rot, 3× einzeln grün – sporadisch, ohne Bezug zu den Änderungen); Integration Dashboard 18/18; Unit 791/791
- **Offen:** BUG-5 (Low) unverändert

**Summary (Runde 4):** keine Critical/High/Medium-Bugs; **Production Ready: YES** – Deploy mit Migration `20261107222638`

## Deployment

**Version:** `v1.35.0-PROJ-14` · **Produktion:** https://app.apppa.at · **Staging:** https://staging.apppa.at · **Datum:** 2026-11-07

Ausgeliefert in drei Schritten (jeweils erst Staging, nach Freigabe Produktion):

| Schritt | Commit | Migration | Inhalt |
|---|---|---|---|
| 1 | `09f8b99` | `20261107151812_dashboard` | Dashboard über alle Kunden, Abschnitte, Lesefunktionen, Umbenennung „Ortstaxe“ |
| 2 | `ec03494` | `20261107194628_dashboard_tourist_tax_fix` | Anordnung „Zeitung“ (BUG-6); Alt-Positionen der Ortstaxe einmalig gekennzeichnet (BUG-7, nur Kennzeichen, Beträge unverändert); Verteilung nach Tarifzeitraum (BUG-8) |
| 3 | `df9f5b5` | `20261107222638_dashboard_tourist_tax_units` | Verteilung in ganzen Personennächten über die vereinnahmten Nächte (BUG-9); Kacheln und Abschnitte als Flächen |

- Advisors in Staging und Produktion jeweils nur der bekannte Hinweis `auth_otp_long_expiry`; keine neuen Umgebungsvariablen, kein `config push`
- Nach Schritt 2 in Produktion (nur lesend) geprüft: alle betroffenen Alt-Positionen gekennzeichnet, keine mehr ohne Kennzeichen
- Vom Nutzer in Produktion geprüft: Anordnung, Flächen und Ortstaxe-Summen (Einzelheiten nur im Chat)
- Offen: BUG-5 (Low) beobachten
