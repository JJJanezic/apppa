# PROJ-19: Marketing-Einwilligung verwalten

## Status: In Progress
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
| Eigene Verlaufstabelle je Gast, unveränderlich per Schutzregel; nur Irrtümlich-Markierung und Leeren beim Anonymisieren erlaubt | Nachweis nach DSGVO; Muster wie beim Gästeblatt | 2026-11-11 |
| Stand (erteilt/widerrufen/keine + Datum) zusätzlich am Gast, von der Datenbank nach jeder Änderung neu berechnet | Schneller Filter in der Gästeliste und Export (PROJ-52) ohne Durchrechnen des Verlaufs; ein Ort für die Regel | 2026-11-11 |
| Gästeblatt über die bestehende interne Funktion anbinden, die heute die Einwilligung setzt | Gästeblatt-„Fertig“ und Hochladen bleiben unverändert; nur eine Stelle wird umgestellt | 2026-11-11 |
| Schreiben nur über Datenbank-Funktionen (Erfassen, Irrtümlich), keine direkten Schreibrechte | Regeln (Rollen, mündlich nur Widerruf, Widerruf nur bei Erteilt, gesperrte Gäste) an einer Stelle durchgesetzt | 2026-11-11 |
| Belege in eigenem privatem Speicherbereich, gleiche Regeln und gleiches Eingabefeld wie Zahlungsbelege | Bekannte Bedienung samt Handyfoto; Zugriffsprüfung und Aufräumen getrennt von Zahlungen | 2026-11-11 |
| Nicht gespeicherte Belege räumt der bestehende nächtliche Aufräumlauf mit auf | Kein zusätzlicher Zeitplan nötig | 2026-11-11 |
| Rückfrage „ändert den Stand nicht“: Schreibfunktion meldet Ergebnis, Dialog bestätigt | Muster der Hinweise aus der Zahlungserfassung (PROJ-45) | 2026-11-11 |
| Übernahme bestehender Daten aus allen Gästeblättern mit Häkchen (auch ersetzten), nicht nur aus dem Vermerk am Gast | Der Vermerk am Gast hält nur die jüngste Erteilung; der Verlauf soll vollständig sein | 2026-11-11 |
| Keine neuen Pakete | Alles mit vorhandenen Bausteinen machbar | 2026-11-11 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Kein neues Paket, keine neue Seite. PROJ-19 ergänzt die **Gastdetailseite** um einen Abschnitt, die **Gästeliste** um einen Filter und die Datenbank um einen **Verlauf der Einwilligung je Gast**. Fast alles nutzt Vorhandenes: Belege wie bei Zahlungen (PROJ-45), Protokoll wie überall, Anbindung an das Gästeblatt über die eine Stelle, an der es heute die Einwilligung setzt.

### A) Bildschirm-Aufbau

```
Gastdetailseite (/gaeste/[id], bestehend)
+-- … bestehende Abschnitte (Kontakt, Adresse, Firma, Marketing-Quelle …)
+-- NEU Abschnitt „Marketing-Einwilligung“
    +-- Stand-Zeile („Eingewilligt seit …“ / „Widerrufen am …“ / „Keine Einwilligung“)
    +-- Hinweis „keine eigene E-Mail-Adresse oder Anschrift“ (nur bei Stand „Erteilt“)
    +-- Knöpfe „Einwilligung erfassen“ / „Widerruf erfassen“ (Inhaber und Mitarbeiter)
    +-- Verlauf (neueste zuerst)
    |   +-- Eintrag: Datum, Art, Weg bzw. Gästeblatt-Link, Notiz, Beleg-Symbol, erfasst von/am
    |   +-- irrtümliche Einträge durchgestrichen mit Grund
    |   +-- „Als irrtümlich markieren“ (nur Inhaber, nur von Hand erfasste Einträge)
    +-- Leerer Zustand
+-- NEU Dialog „Einwilligung erfassen“ / „Widerruf erfassen“ (ein Dialog, zwei Arten)
|   +-- Datum, Weg (Auswahl je nach Art), Notiz
|   +-- Beleg-Feld (bestehendes Feld aus der Zahlungserfassung, wiederverwendet)
|   +-- Hinweis „ohne Beleg“ bzw. „liegt vor dem letzten Eintrag, ändert den Stand nicht“ (Rückfrage)
+-- NEU Dialog „Als irrtümlich markieren“ (Grund, Bestätigen)

Gästeliste (/gaeste, bestehend)
+-- Filterleiste: NEU Auswahl „Marketing-Einwilligung“ (Alle / Erteilt / Widerrufen / Keine)
```

Am Handy stehen die Verlaufseinträge als Karten untereinander; die Dialoge verhalten sich wie bei der Zahlungserfassung.

### B) Daten (in Worten)

**Neu: Verlauf der Marketing-Einwilligung** – je Eintrag:
- Kunde und Gast
- Art: Erteilung oder Widerruf
- Herkunft: Gästeblatt, nacherfasstes Gästeblatt oder von Hand
- Datum (Tag, an dem erteilt bzw. widerrufen wurde)
- Weg (nur von Hand): E-Mail, schriftlich, Webformular, mündlich/telefonisch (nur Widerruf), Sonstiges
- Verweis aufs Gästeblatt (nur bei Herkunft Gästeblatt)
- Notiz (bis 500 Zeichen), Beleg (Speicherort der Datei)
- erfasst von, erfasst am
- Irrtümlich: markiert am, von, Grund (sonst leer)

**Am Gast** (bestehende Tabelle): Der heutige Vermerk „Einwilligung erteilt am, über Gästeblatt“ wird zum **Stand** erweitert: Stand (erteilt / widerrufen / keine) und Datum des maßgeblichen Eintrags. Die Datenbank rechnet ihn nach jeder Änderung am Verlauf neu aus (jüngster nicht irrtümlicher Eintrag nach Datum, bei Gleichstand nach Erfassungszeit). So sind der Filter in der Gästeliste und später der Export (PROJ-52) schnell, ohne den Verlauf jedes Mal durchzurechnen.

**Belege:** eigener privater Speicherbereich je Kunde, gleiche Regeln wie Zahlungsbelege (PDF bis 10 MB, Bilder als JPEG; Lesen nur Mitglieder des Kunden über kurzlebige Links).

**Bestehende Daten:** Eine Datenbank-Umstellung legt für jedes Gästeblatt mit Häkchen (auch ersetzte) einen Eintrag „Erteilung über (nacherfasstes) Gästeblatt“ an, mit Datum und Person vom Blatt, und rechnet den Stand aller Gäste aus.

### C) Abläufe

| Ablauf | Was passiert |
|--------|--------------|
| Gästeblatt „Fertig“ / Hochladen mit Häkchen (PROJ-26) | Die bestehende zentrale Stelle, die heute die Einwilligung am Gast setzt, legt stattdessen einen Verlaufseintrag an; der Stand folgt automatisch. Am Gästeblatt selbst ändert sich nichts. |
| Erfassen von Hand | Eine Schreibfunktion in der Datenbank prüft Rechte, Datum, Weg (mündlich nur beim Widerruf), „Widerruf nur bei Stand erteilt“ und gesperrte Gäste; sie meldet, ob der Eintrag den Stand ändert. Ändert er ihn nicht, fragt der Dialog vorher nach. |
| Irrtümlich markieren | Eigene Schreibfunktion, nur Inhaber, nur Einträge „von Hand“, Grund Pflicht, nur einmal. |
| Unveränderlichkeit | Eine Schutzregel verhindert Ändern und Löschen von Einträgen (Muster wie beim Gästeblatt); erlaubt sind nur die Irrtümlich-Markierung und das Leeren beim Anonymisieren. |
| Anonymisieren (PROJ-7) | Bestehende Funktion ergänzt: Notizen und Beleg-Verweise leeren, Stand „keine“; die App löscht danach die Beleg-Dateien. Neue Einträge sind gesperrt. |
| Zusammenführen (PROJ-7) | Bestehende Funktion ergänzt: Einträge des entfernten Gastes wandern zum verbleibenden, Stand wird neu berechnet (ersetzt „jüngste Erteilung gilt“). |
| Kunde löschen (PROJ-5) | Verlauf wird mit dem Kunden gelöscht; Beleg-Dateien des Kunden werden entfernt wie Zahlungsbelege. |
| Liegengebliebene Belege | Hochgeladen, aber nie gespeichert (Dialog abgebrochen): Der bestehende nächtliche Aufräumlauf entfernt sie mit. |
| Protokoll | Der Verlauf hängt am bestehenden Protokoll (Anlegen, Irrtümlich-Markieren). |

### D) Rechte
- Lesen von Verlauf, Stand und Belegen: alle Mitglieder des Kunden.
- Erfassen von Erteilung und Widerruf: Inhaber und Mitarbeiter, nur über die Schreibfunktion (kein direktes Schreiben in die Tabelle).
- Irrtümlich markieren: nur Inhaber.
- Mandantentrennung wie überall über die Zugriffsregeln der Datenbank; Belege zusätzlich über die Regeln des Speicherbereichs.

### E) Technische Entscheidungen (Begründung)
- **Verlauf als eigene Tabelle, Stand zusätzlich am Gast:** Der Verlauf ist der Nachweis; der Stand am Gast macht Filter und Export schnell. Die Datenbank hält beide zusammen, nicht die App.
- **Anbindung des Gästeblatts über eine Stelle:** Gästeblatt-„Fertig“ und Hochladen rufen schon heute dieselbe interne Funktion auf. Wird nur sie umgestellt, bleibt PROJ-26 unberührt.
- **Belege wie bei Zahlungen, eigener Speicherbereich:** gleiche Bedienung (auch Handyfoto), gleiche Sicherheit; eigener Bereich, weil sich die Zugriffsprüfung auf den jeweiligen Datensatz bezieht und Aufräumen und Löschen getrennt laufen.
- **„Ändert den Stand nicht“ als Rückfrage:** Die Schreibfunktion meldet das Ergebnis vorab, der Dialog fragt nach; gleiches Muster wie die Hinweise bei der Zahlungserfassung.
- **Kein neues Paket.**

### F) Abhängigkeiten (Pakete)
- Keine neuen Pakete.

### G) Arbeitsteilung
- **/frontend:** Abschnitt auf der Gastdetailseite, Dialoge (Beleg-Feld aus der Zahlungserfassung wiederverwenden bzw. für beide Zwecke verallgemeinern), Filter in der Gästeliste, Texte.
- **/backend:** Verlaufstabelle mit Schutzregel und Protokoll, Stand am Gast samt Neuberechnung, Schreibfunktionen (Erfassen, Irrtümlich), Anbindung Gästeblatt, Anonymisieren, Zusammenführen, Kunde löschen, Filter in der Gästelisten-Abfrage, Speicherbereich mit Regeln, Aufräumen, Übernahme der bestehenden Einwilligungen, Typen neu erzeugen.

## Implementation Notes (Frontend, 2026-11-11)

### Gebaut
- **Gastdetailseite:** Abschnitt „Marketing-Einwilligung“ unter den Angaben, über die ganze Breite, vor „Buchungen“ (`src/components/guests/marketing-consent-section.tsx`).
  - Stand-Zeile; Widerruf in Magenta.
  - Hinweis „keine eigene E-Mail-Adresse oder Anschrift“ (`hasOwnContact`: direkt erfasste E-Mail oder Straße mit PLZ/Ort).
  - Knöpfe für Inhaber und Mitarbeiter; „Widerruf erfassen“ nur bei Stand „Erteilt“; bei anonymisierten Gästen keine Knöpfe.
  - Verlauf mit Gästeblatt-Link (`/api/gaesteblatt/[id]/pdf`), Beleg-Symbol, „Erfasst von … am …“, irrtümliche Einträge durchgestrichen mit Grund.
- **Dialog Erteilung/Widerruf** (`consent-dialog.tsx`, Seitenpanel wie bei Zahlungen):
  - Datum (heute vorbelegt, nicht in der Zukunft, nicht vor dem Geburtsdatum), Weg (mündlich nur beim Widerruf), Notiz (500), Beleg.
  - Ohne Beleg bei Erteilung: Hinweis in Magenta.
  - Liegt das Datum vor dem jüngsten gültigen Eintrag: Hinweis schon im Formular; die Datenbank meldet `warnings`, Rückfrage „Trotzdem speichern“.
- **Dialog „Als irrtümlich markieren“** (`consent-void-dialog.tsx`, nur Inhaber, nur Einträge „von Hand“): Grund Pflicht (200).
- **Gästeliste:** Filter „Marketing-Einwilligung“ (Alle/Erteilt/Widerrufen/Keine), Adresse `?einwilligung=erteilt|widerrufen|keine`.
- **Beleg-Feld und Beleg-Symbol** der Zahlungen verallgemeinert (Speicherbereich, Upload-/Abruf-Aktion und Texte als Parameter; Zahlungen unverändert).
- **Aktionen:** `src/app/(app)/gaeste/consent-actions.ts`. **Lesen:** `src/lib/marketing-consent-data.ts`. **Regeln/Typen:** `src/lib/marketing-consent.ts`, `src/lib/validation/marketing-consent.ts`. **Texte:** `guests.consent`, `guests.consentFilter`, `guests.errors.consent*`.
- **Übergang bis /backend:**
  - Fehlt der Verlauf, zeigt die Gastseite den Vermerk aus PROJ-26 (`marketing_consent_at`, `marketing_consent_sheet_id`) als einzigen Eintrag.
  - Erfassen meldet „Diese Funktion wird gerade eingerichtet.“
  - Der Filter liefert eine leere Liste (Log „guest_list … p_consent“).
- **Tests:** `src/lib/marketing-consent.test.ts`, Filter in `src/lib/guests.test.ts`.
- **Sichttest:** gebauter Server, Desktop und Handy: Gastseite, Widerrufs-Dialog mit Pflichtfeldmeldung, Gästeliste mit Filter.

### Erwartete Datenbank-Schnittstellen (für /backend)

**Neue Tabelle `marketing_consent_events`**

Spalten:
- `id`, `tenant_id`, `guest_id`
- `kind`: `grant` | `revoke`
- `origin`: `sheet` | `sheet_upload` | `manual`
- `occurred_on` (date)
- `channel`: `email` | `paper` | `webform` | `oral` | `other`; nur bei `manual`; `oral` nur bei `revoke`
- `guest_sheet_id` (nur Gästeblatt)
- `note` (≤ 500), `receipt_path`
- `created_at`, `created_by`
- `voided_at`, `voided_by`, `void_reason` (≤ 200)

Regeln:
- Lesen dürfen Mitglieder.
- Keine direkten Schreibrechte.
- Schutzregel: nur die Irrtümlich-Markierung und das Leeren beim Anonymisieren sind erlaubt.
- Hängt am Protokoll.

**Neue Sicht `marketing_consent_history`** (security_invoker)
- Alle Spalten der Tabelle.
- Dazu `sheet_number`, `booking_id`, `booking_number` (über das Gästeblatt) sowie `created_by_name` und `voided_by_name`.

**Neue Spalten an `guests`**
- `marketing_consent_state`: `granted` | `revoked` | `none`, Standard `none`.
- `marketing_consent_on` (date).
- Werden nach jeder Änderung neu berechnet: jüngster nicht irrtümlicher Eintrag nach `occurred_on`, dann `created_at`.
- `marketing_consent_at`/`_sheet_id` können danach entfallen oder bleiben; das entscheidet /backend.

**Funktion `record_marketing_consent(p_input jsonb)`** für Mitglieder
- Eingabe: `tenant_id`, `guest_id`, `kind`, `occurred_on`, `channel`, `note`, `receipt_path`, `confirmed`.
- Ergebnis: `{saved, id, warnings: [{code: 'notEffective', latestOn, latestKind}]}`.
- `saved = false` mit Hinweis, wenn der Eintrag vor dem maßgeblichen liegt und `confirmed` fehlt.

**Funktion `void_marketing_consent(p_entry_id, p_reason)`**
- Nur Inhaber, nur `origin = manual`, nur einmal.

**`guest_list`**
- Neuer Parameter `p_consent` (`granted` | `revoked` | `none`, null = alle).

**`private.note_marketing_consent`**
- Legt einen Eintrag an (`origin` je nach Blattart, Datum in Wiener Zeit, Person vom Blatt).

**Anpassungen**
- `anonymize_guest`: Notizen und Beleg-Verweise leeren, Stand `none`, Belegpfade zurückgeben bzw. Dateien entfernen; neue Einträge sperren (P0993).
- `merge_guests`: Einträge umhängen, Stand neu berechnen.
- `admin_delete_tenant`: Einträge und Belege entfernen.

**Speicherbereich `marketing-consent-receipts`**
- Privat, PDF/JPEG, 10 MB; Ordner = Kunde.
- Hochladen und Lesen nur für Mitglieder (Lesen nur, wenn der Pfad an einem Eintrag hängt).
- Aufräumen nicht genutzter Belege im nächtlichen Lauf.

**Übernahme bestehender Daten**
- Je `guest_sheets` mit `marketing_consent = true` (auch ersetzte) ein Eintrag; danach den Stand aller Gäste berechnen.

**Fehlercodes**

| Code | Bedeutung |
|------|-----------|
| 42501 | nur Inhaber |
| P0988 | Beleg fehlt |
| P0992 | Gast nicht gefunden |
| P0993 | Gast anonymisiert |
| P0994 | Datum in der Zukunft |
| P0995 | Datum vor dem Geburtsdatum |
| P0996 | Weg ungültig |
| P0997 | Widerruf ohne Erteilung |
| P0998 | nicht als irrtümlich markierbar |
| P0999 | bereits irrtümlich |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
