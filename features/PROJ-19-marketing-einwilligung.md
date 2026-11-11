# PROJ-19: Marketing-Einwilligung verwalten

## Status: Planned
**Created:** 2026-11-11
**Last Updated:** 2026-11-11

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Rollen Inhaber/Mitarbeiter, gewählter Kunde
- Requires: PROJ-7 (Gäste-Datenbank): Gastdetailseite, Gästeliste mit Filtern, Anonymisieren, Zusammenführen
- Requires: PROJ-26 (Gästeblatt): Erteilung der Einwilligung über das Gästeblatt (Unterschrift 2) und beim Nacherfassen; bestehende Einwilligungen am Gast
- Requires: PROJ-29 / PROJ-45: Umgang mit Belegen (PDF oder Bild, Handyfotos verkleinert, privat je Kunde)
- Wird genutzt von: PROJ-52 (Marketing: Segmente und CSV-Export): exportiert nur Gäste mit gültiger Einwilligung

## Überblick
PROJ-26 hat die **Erteilung** der Marketing-Einwilligung über das Gästeblatt gebaut; am Gast steht seither nur „erteilt am, über Gästeblatt“, sichtbar ist das bisher nirgends. PROJ-19 macht die Einwilligung **verwaltbar**: Stand und Verlauf auf der Gastdetailseite, Erteilung ohne Gästeblatt (z. B. per E-Mail), **Widerruf**, Korrektur irrtümlicher Einträge und ein Filter in der Gästeliste. Segmente und Export folgen in PROJ-52.

Die Einwilligung ist eine einzige Einwilligung je Gast und Kunde; sie deckt laut Text (Gästeblatt Teil B) Post, E-Mail und Telefon ab. Es gibt keine Aufteilung nach Kanälen.

## User Stories
- Als **Inhaber** möchte ich auf der Gastseite sehen, ob und seit wann ein Gast in Marketing eingewilligt hat und woher die Einwilligung stammt, damit ich vor einer Aussendung weiß, ob ich ihn anschreiben darf.
- Als **Inhaber oder Mitarbeiter** möchte ich einen Widerruf („Bitte keine Werbung mehr“) sofort am Gast eintragen, damit der Gast ab diesem Tag nicht mehr beworben wird, egal wer die Nachricht entgegengenommen hat.
- Als **Inhaber oder Mitarbeiter** möchte ich eine Einwilligung erfassen, die nicht über das Gästeblatt kam (E-Mail, Papier, Webformular), samt Datum, Weg und Beleg, damit ich sie später nachweisen kann.
- Als **Inhaber** möchte ich den vollständigen Verlauf aller Erteilungen und Widerrufe sehen, damit ich bei einer Anfrage der Datenschutzbehörde oder des Gastes Auskunft geben kann.
- Als **Inhaber** möchte ich einen irrtümlich erfassten Eintrag als „irrtümlich“ markieren, damit ein Fehler den Stand nicht verfälscht, der Nachweis aber erhalten bleibt.
- Als **Inhaber** möchte ich die Gästeliste nach Einwilligung filtern, damit ich schnell sehe, wie viele Gäste eingewilligt oder widerrufen haben.

## Begriffe und Regeln

### Stand der Einwilligung
Jeder Gast hat genau einen Stand, abgeleitet aus dem **jüngsten gültigen Eintrag** im Verlauf (nach Datum, bei gleichem Datum nach Erfassungszeit):
- **Erteilt**: jüngster Eintrag ist eine Erteilung → „Eingewilligt seit [Datum]“
- **Widerrufen**: jüngster Eintrag ist ein Widerruf → „Widerrufen am [Datum]“
- **Keine**: kein gültiger Eintrag → „Keine Einwilligung“

Als irrtümlich markierte Einträge zählen nicht.

### Einträge im Verlauf
| Art | Entsteht durch | Angaben |
|-----|----------------|---------|
| Erteilung über Gästeblatt | „Fertig“ auf dem Gästeblatt mit Häkchen (PROJ-26) | Datum = Unterschrift 2, Verweis aufs Gästeblatt (Lfd.-Nr., Buchung) |
| Erteilung über nacherfasstes Gästeblatt | Hochladen mit Häkchen (PROJ-26) | Datum = „Unterschrieben am“, sonst Hochladedatum; Verweis aufs Gästeblatt |
| Erteilung von Hand | Knopf „Einwilligung erfassen“ (neu) | Datum, Weg, Notiz, Beleg (siehe unten) |
| Widerruf | Knopf „Widerruf erfassen“ (neu) | Datum, Weg, Notiz, Beleg (siehe unten) |

Jeder Eintrag zeigt zusätzlich **erfasst von** (Person) und **erfasst am** (Zeitpunkt).

### Felder beim Erfassen von Hand (Erteilung und Widerruf)
| Feld | Pflicht | Regeln |
|------|---------|--------|
| Datum | ja | vorbelegt mit heute; nicht in der Zukunft; nicht vor dem Geburtsdatum des Gastes, falls bekannt |
| Weg | ja | Auswahl: „E-Mail“, „Schriftlich (Papier)“, „Webformular“, „Mündlich/telefonisch“ (nur beim Widerruf), „Sonstiges“ |
| Notiz | nein | bis 500 Zeichen, z. B. „Mail vom 3.12. an info@…“ |
| Beleg | nein | höchstens eine Datei: PDF bis 10 MB oder Bild (JPEG, PNG, HEIC/HEIF, WebP), verkleinert wie bei Zahlungsbelegen (PROJ-45); am Handy direkt fotografieren; privat je Kunde |

- Beim Erfassen einer **Erteilung** ohne Beleg erscheint der Hinweis: „Ohne Beleg lässt sich die Einwilligung später schwer nachweisen.“ Speichern ist trotzdem möglich.
- **Mündlich** ist nur beim Widerruf wählbar: Ein Widerruf muss in jeder Form wirken; eine mündliche Einwilligung ist nicht nachweisbar.

### Neue Erteilung nach Widerruf
Jede spätere, freiwillige Erteilung (Gästeblatt, nacherfasstes Gästeblatt, von Hand) macht den Gast wieder „Eingewilligt“. Der Widerruf bleibt im Verlauf sichtbar. Ein leeres Kästchen auf dem Gästeblatt ändert den Stand weiterhin nicht (PROJ-26).

### Irrtümlich markieren
- Nur **Inhaber**, nur bei **von Hand erfassten** Einträgen (Erteilung oder Widerruf).
- Pflichtangabe **Grund** (bis 200 Zeichen). Der Eintrag bleibt im Verlauf, durchgestrichen mit „irrtümlich – [Grund], [Person], [Datum]“, und zählt nicht mehr für den Stand.
- Die Markierung lässt sich **nicht zurücknehmen**; ist sie selbst ein Fehler, wird der Eintrag neu erfasst.
- Einträge aus einem Gästeblatt lassen sich nicht als irrtümlich markieren. Korrektur dort: ein Widerruf oder „Neu unterschreiben lassen“ (PROJ-26).
- Einträge werden **nie bearbeitet oder gelöscht** (außer Belege beim Anonymisieren, siehe unten).

## Bildschirme

### Gastdetailseite: Abschnitt „Marketing-Einwilligung“
- Platz: nach dem Abschnitt mit der Marketing-Quelle (die beiden werden klar unterschieden: Quelle = „Wie kam der Gast erstmals zu uns?“, Einwilligung = „Darf ich ihn bewerben?“).
- Oben der **Stand** als deutliche Zeile („Eingewilligt seit Mi, 12.08.2026 – über Gästeblatt 2026/014“, „Widerrufen am …“, „Keine Einwilligung“).
- Hinweis, wenn eingewilligt, aber **keine eigene Kontaktmöglichkeit**: „Eingewilligt, aber keine eigene E-Mail-Adresse oder Anschrift erfasst.“ (Plattform-Adressen zählen nicht als eigene.)
- Knöpfe **„Einwilligung erfassen“** und **„Widerruf erfassen“** (Inhaber und Mitarbeiter). „Widerruf erfassen“ nur bei Stand „Erteilt“; „Einwilligung erfassen“ immer außer bei anonymisierten Gästen.
- **Verlauf** darunter, neueste zuerst: Datum, Art (Erteilung/Widerruf), Weg bzw. Gästeblatt (Link zum PDF wie in der Gästeblatt-Liste), Notiz, Beleg-Symbol (öffnet die Datei), erfasst von/am; je von Hand erfasstem Eintrag „Als irrtümlich markieren“ (Inhaber).
- Leerer Zustand: „Noch keine Einwilligung erfasst. Gäste willigen in der Regel auf dem Gästeblatt ein.“
- Am Handy dieselben Inhalte untereinander; Erfassen im Dialog bzw. Vollbild-Blatt wie bei Zahlungen.

### Gästeliste: Filter „Marketing-Einwilligung“
- Neuer Filter neben Herkunftsland und Marketing-Quelle: „Alle“ (Standard), „Erteilt“, „Widerrufen“, „Keine“.
- Wirkt zusammen mit Suche und den anderen Filtern; keine neue Spalte.
- Anonymisierte Gäste haben immer „Keine“.

## Rechte
| Aktion | Inhaber | Mitarbeiter |
|--------|---------|-------------|
| Stand und Verlauf sehen, Belege öffnen | ja | ja |
| Einwilligung von Hand erfassen | ja | ja |
| Widerruf erfassen | ja | ja |
| Eintrag als irrtümlich markieren | ja | nein |
| Filter in der Gästeliste | ja | ja |

Ausnahme zu PROJ-7: Mitarbeiter dürfen Gäste sonst nicht bearbeiten, Einwilligung und Widerruf aber schon (siehe Entscheidungen).

## Anonymisieren und Zusammenführen
- **Anonymisieren** (PROJ-7): Der Verlauf bleibt am „Gelöschten Gast“ erhalten (Datum, Art, Weg, Verweis aufs Gästeblatt, erfasst von); **Belege werden gelöscht**, **Notizen geleert**. Der Stand wird „Keine“; neue Einträge sind gesperrt.
- **Zusammenführen** (PROJ-7): Die Verläufe beider Gäste werden vereint; der Stand ergibt sich neu aus dem jüngsten gültigen Eintrag. (Ersetzt die bisherige Regel „jüngste Erteilung gilt“ aus PROJ-26, damit ein jüngerer Widerruf nicht verloren geht.)

## Bestehende Daten
- Jede bestehende Einwilligung am Gast (aus PROJ-26: Datum und Gästeblatt) wird als Eintrag „Erteilung über Gästeblatt“ bzw. „über nacherfasstes Gästeblatt“ in den Verlauf übernommen. „Erfasst von/am“ stammt, soweit vorhanden, vom Gästeblatt.
- Ersetzte Gästeblätter („Neu unterschreiben lassen“) mit Häkchen bleiben als Erteilung im Verlauf, da sie tatsächlich unterschrieben wurden.

## Protokoll
Erteilen, Widerrufen und Irrtümlich-Markieren erscheinen im Protokoll (audit_log) mit Person und Zeit.

## Out of Scope
- **Segmente und CSV-Export** → PROJ-52 (Marketing: Segmente und CSV-Export)
- E-Mail- oder Newsletter-Versand aus der App → PROJ-22
- Einwilligung getrennt nach Kanälen (nur E-Mail, nur Post) – eine Einwilligung deckt laut Text alle Kanäle ab
- Online-Formular bzw. Abmeldelink, über den der Gast selbst einwilligt oder widerruft
- Ablauf einer Einwilligung nach Zeit (z. B. „gilt 3 Jahre“)
- Speichern, welche Fassung des Einwilligungstexts erteilt wurde (beim Gästeblatt steht sie im PDF; bei Erteilung von Hand im Beleg)
- Anzeige des Stands im Buchungsdetail, auf dem Gästeblatt oder im Dashboard
- Neue Spalte in der Gästeliste
- Einwilligung für Mitreisende (nur Hauptgäste, wie bisher)
- Aufbewahrungsfristen bzw. automatisches Löschen des Verlaufs
- Plattform-Adressen von booking.com/Airbnb ausschließen: Kennzeichnung gibt es schon (PROJ-7); wirksam wird der Ausschluss im Export (PROJ-52) und mit dem Import (PROJ-11)

## Acceptance Criteria

**Anzeige**
- [ ] Angenommen ein Gast hat über das Gästeblatt am 12.08.2026 eingewilligt, wenn Inhaber oder Mitarbeiter die Gastseite öffnen, dann steht im Abschnitt „Marketing-Einwilligung“ „Eingewilligt seit Mi, 12.08.2026“ mit Verweis auf das Gästeblatt, und der Verlauf zeigt diesen Eintrag mit Link zum PDF
- [ ] Angenommen ein Gast hat keinen Eintrag, wenn die Gastseite geöffnet wird, dann steht „Keine Einwilligung“ und der leere Zustand mit Hinweis auf das Gästeblatt
- [ ] Angenommen ein Gast hat eingewilligt, aber nur eine von der Plattform übernommene E-Mail und keine Anschrift, wenn die Gastseite geöffnet wird, dann erscheint der Hinweis „Eingewilligt, aber keine eigene E-Mail-Adresse oder Anschrift erfasst.“
- [ ] Angenommen die Einwilligungen aus PROJ-26 bestehen schon, wenn PROJ-19 ausgeliefert wird, dann erscheint jede davon als Eintrag im Verlauf und der Stand ist „Erteilt“ mit unverändertem Datum

**Erteilung von Hand**
- [ ] Angenommen ein Mitarbeiter öffnet „Einwilligung erfassen“, wenn er Datum und Weg „E-Mail“ wählt und speichert, dann ist der Stand „Eingewilligt seit [Datum]“ und der Eintrag zeigt Weg, „erfasst von [Mitarbeiter]“ und Zeitpunkt
- [ ] Angenommen „Einwilligung erfassen“ ohne Beleg, wenn der Dialog angezeigt wird, dann steht der Hinweis „Ohne Beleg lässt sich die Einwilligung später schwer nachweisen.“ und Speichern ist trotzdem möglich
- [ ] Angenommen ein Datum in der Zukunft oder kein Weg, wenn gespeichert wird, dann erscheint eine Fehlermeldung am Feld und nichts wird gespeichert
- [ ] Angenommen „Einwilligung erfassen“, wenn der Nutzer die Auswahl „Weg“ öffnet, dann gibt es „Mündlich/telefonisch“ nicht
- [ ] Angenommen ein Beleg als HEIC-Foto vom Handy, wenn gespeichert wird, dann wird er wie ein Zahlungsbeleg verkleinert abgelegt und lässt sich über das Beleg-Symbol öffnen
- [ ] Angenommen ein PDF über 10 MB oder ein anderes Dateiformat, wenn es gewählt wird, dann erscheint eine Fehlermeldung und die Datei wird nicht übernommen

**Widerruf**
- [ ] Angenommen der Stand ist „Erteilt“, wenn ein Mitarbeiter „Widerruf erfassen“ mit Weg „Mündlich/telefonisch“ und heutigem Datum speichert, dann ist der Stand „Widerrufen am [heute]“ und die frühere Erteilung bleibt im Verlauf sichtbar
- [ ] Angenommen der Stand ist „Widerrufen“ oder „Keine“, wenn die Gastseite angezeigt wird, dann gibt es keinen Knopf „Widerruf erfassen“
- [ ] Angenommen ein Widerruf am 01.12.2026, wenn der Gast am 15.07.2027 ein Gästeblatt mit Häkchen unterschreibt, dann ist der Stand „Eingewilligt seit 15.07.2027“ und der Widerruf bleibt im Verlauf
- [ ] Angenommen ein Widerruf am 01.12.2026, wenn der Gast danach ein Gästeblatt ohne Häkchen unterschreibt, dann bleibt der Stand „Widerrufen am 01.12.2026“
- [ ] Angenommen ein Widerruf mit Datum vor der jüngsten Erteilung (z. B. Mail vom 03.11. erst nach einem Gästeblatt vom 05.11. eingetragen), wenn gespeichert wird, dann zählt der jüngere Eintrag nach Datum (die Erteilung vom 05.11.) und vor dem Speichern erscheint der Hinweis „Der Widerruf liegt vor der letzten Einwilligung und ändert den Stand nicht.“

**Irrtümlich markieren**
- [ ] Angenommen ein von Hand erfasster Eintrag, wenn der Inhaber „Als irrtümlich markieren“ mit Grund bestätigt, dann bleibt der Eintrag durchgestrichen mit Grund, Person und Datum im Verlauf und der Stand ergibt sich aus den übrigen Einträgen
- [ ] Angenommen ein Eintrag aus einem Gästeblatt, wenn der Inhaber den Verlauf ansieht, dann gibt es dort keinen Knopf „Als irrtümlich markieren“
- [ ] Angenommen ein Mitarbeiter sieht den Verlauf, wenn er einen von Hand erfassten Eintrag ansieht, dann gibt es keinen Knopf „Als irrtümlich markieren“; ein direkter Versuch wird abgelehnt
- [ ] Angenommen „Als irrtümlich markieren“ ohne Grund, wenn bestätigt wird, dann erscheint eine Fehlermeldung und nichts wird geändert

**Gästeliste**
- [ ] Angenommen Gäste mit Stand „Erteilt“, „Widerrufen“ und „Keine“, wenn der Filter „Marketing-Einwilligung: Erteilt“ gewählt wird, dann zeigt die Liste nur Gäste mit Stand „Erteilt“; Suche und andere Filter wirken zusammen
- [ ] Angenommen ein anonymisierter Gast mit früherer Einwilligung, wenn nach „Erteilt“ gefiltert wird, dann erscheint er nicht

**Anonymisieren und Zusammenführen**
- [ ] Angenommen ein Gast mit Verlauf und Belegen, wenn der Inhaber ihn anonymisiert, dann bleiben die Einträge (Datum, Art, Weg, Gästeblatt-Verweis, erfasst von) erhalten, Belege sind gelöscht, Notizen leer, der Stand ist „Keine“ und die Knöpfe zum Erfassen fehlen
- [ ] Angenommen Gast A mit Erteilung vom 01.03. und Gast B mit Widerruf vom 01.06., wenn sie zusammengeführt werden, dann zeigt der verbleibende Gast beide Einträge und den Stand „Widerrufen am 01.06.“

**Rechte und Protokoll**
- [ ] Angenommen ein Nutzer eines anderen Kunden, wenn er Verlauf oder Beleg eines fremden Gastes abruft, dann wird der Zugriff verweigert
- [ ] Angenommen eine Erteilung, ein Widerruf oder eine Irrtümlich-Markierung, wenn sie gespeichert ist, dann steht sie mit Person und Zeitpunkt im Protokoll
- [ ] Angenommen ein bestehender Eintrag, wenn jemand versucht, ihn zu ändern oder zu löschen, dann wird das abgelehnt

## Edge Cases
- **Zwei Personen gleichzeitig:** Ein Mitarbeiter erfasst einen Widerruf, während der Inhaber eine Erteilung erfasst. Beide Einträge werden gespeichert; der Stand ergibt sich nach Datum bzw. Erfassungszeit. Kein Überschreiben.
- **Widerruf, obwohl keine Einwilligung besteht** (Gast schreibt „keine Werbung“, hat aber nie eingewilligt): „Widerruf erfassen“ ist nur bei „Erteilt“ sichtbar. Der Wunsch wird nicht als Eintrag gebraucht, da ohne Einwilligung ohnehin nicht beworben wird. (Siehe offene Frage.)
- **Erteilung von Hand mit Datum vor einem bestehenden Widerruf:** gespeichert, ändert den Stand aber nicht; Hinweis wie beim Widerruf („Die Einwilligung liegt vor dem letzten Widerruf und ändert den Stand nicht.“).
- **Gleiches Datum für Erteilung und Widerruf:** Der später erfasste Eintrag zählt.
- **Gästeblatt wird neu unterschrieben** (PROJ-26): Die Erteilung aus dem ersetzten Blatt bleibt im Verlauf; das neue Blatt fügt nur bei Häkchen eine Erteilung hinzu.
- **Hochladen schlägt fehl** (Netz weg): Fehlermeldung, Eingaben im Dialog bleiben erhalten, kein halber Eintrag.
- **Beleg öffnen nach Anonymisieren:** Beleg-Symbol fehlt, da die Datei gelöscht ist.
- **Gast ohne Geburtsdatum:** Die Prüfung „nicht vor dem Geburtsdatum“ entfällt.
- **Kunde deaktiviert oder gelöscht** (PROJ-5): Verlauf und Belege werden mit dem Kunden gelöscht wie andere Gästedaten.

## Technical Requirements
- Mandantentrennung wie überall: Verlauf und Belege nur für Mitglieder des Kunden.
- Belege im privaten Speicher je Kunde, Abruf nur über kurzlebige Links (wie Zahlungsbelege).
- Einträge unveränderlich; nur die Irrtümlich-Markierung kommt hinzu.
- Stand muss für den Filter in der Gästeliste und für PROJ-52 schnell abfragbar sein.
- Browser: Chrome, Firefox, Safari, auch iPad und Handy.

## Open Questions
- [ ] Soll ein „Werbewiderspruch“ ohne vorherige Einwilligung (Gast verlangt vorsorglich „keine Werbung“) als eigener Eintrag festgehalten werden, damit niemand später versehentlich eine Einwilligung von Hand erfasst? Vorschlag: nicht in PROJ-19, bei Bedarf über /refine.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| PROJ-19 in zwei Specs geteilt: Einwilligung verwalten (PROJ-19) und Segmente/CSV-Export (PROJ-52) | Getrennt test- und auslieferbar, andere Bildschirme; der Export baut auf Stand und Widerruf auf | 2026-11-11 |
| Inhaber und Mitarbeiter erfassen Einwilligung und Widerruf (Ausnahme zu PROJ-7) | Mitarbeiter haben den Gastkontakt; ein Widerruf muss sofort wirken, egal wer ihn entgegennimmt; jeder Schritt wird protokolliert | 2026-11-11 |
| Erteilung von Hand: Datum und Weg Pflicht, Notiz und Beleg optional, Hinweis ohne Beleg | Nachweispflicht nach DSGVO, aber ohne Hürde (E-Mail muss nicht erst als PDF gespeichert werden) | 2026-11-11 |
| „Mündlich/telefonisch“ nur beim Widerruf | Widerruf muss formlos wirken; mündliche Einwilligung ist nicht nachweisbar | 2026-11-11 |
| Neue Erteilung nach Widerruf gilt wieder | Jede freiwillige Entscheidung des Gastes zählt; der Widerruf bleibt im Verlauf | 2026-11-11 |
| Stand = jüngster gültiger Eintrag nach Datum | Einfach, nachvollziehbar; nachgetragene ältere Einträge ändern den Stand nicht, Hinweis beim Speichern | 2026-11-11 |
| Einträge unveränderlich; Inhaber markiert von Hand erfasste Einträge mit Grund als irrtümlich | Nachweis bleibt erhalten, Fehler verfälschen den Stand nicht; Gästeblatt-Einträge korrigiert man über Widerruf oder Neu-Unterschreiben | 2026-11-11 |
| Anzeige auf der Gastdetailseite und Filter in der Gästeliste, keine Spalte | Überblick ohne engere Liste am Handy; Export folgt in PROJ-52 | 2026-11-11 |
| Anonymisieren: Verlauf bleibt, Belege gelöscht, Notizen geleert | Vom Nutzer so entschieden: Nachweis, dass eine Einwilligung bestand bzw. widerrufen wurde, bleibt; Dateien und Freitext können personenbezogene Daten enthalten | 2026-11-11 |
| Zusammenführen vereint die Verläufe; ersetzt „jüngste Erteilung gilt“ aus PROJ-26 | Ein jüngerer Widerruf des einen Gastes darf nicht durch die Erteilung des anderen verloren gehen | 2026-11-11 |
| Eine Einwilligung für alle Kanäle | Text auf dem Gästeblatt (Teil B) umfasst Post, E-Mail und Telefon | 2026-11-11 |
| Bestehende Einwilligungen aus PROJ-26 werden in den Verlauf übernommen | Kein Bruch für bereits unterschriebene Gästeblätter | 2026-11-11 |

### Technical Decisions
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
