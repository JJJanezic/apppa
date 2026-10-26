# PROJ-30: Buchungs-Erweiterung: Meldedaten, Buchungsquelle, Monatsauswahl

## Status: Planned
**Created:** 2026-10-26
**Last Updated:** 2026-10-26

## Dependencies
- Requires: PROJ-8 (Manuelle Buchungen): Buchungsformular, Buchungs-Detail, Buchungsliste mit Monatsleiste und Filtern, Mitreisende, Preisvorschlag
- Requires: PROJ-9 (Belegungskalender): Farben nach Kanal, Legende, Dashboard- und Vollbild-Kalender
- Requires: PROJ-27 (Personenpreise und Kapazität): Preisvorschlag nach Preisart der Wohnung
- Wird voraussichtlich genutzt von: PROJ-16 (Tourismusabgabe-Berechnung: tatsächliche Abreise, „Wohnsitz angemeldet“), PROJ-26 (Gästeblatt: Gästeblattnummer, Abreisedaten), PROJ-18 (Auswertung Kanäle/Quellen), PROJ-11 (Kanal aus dem Import)

## Überblick
Buchungen bekommen zusätzliche Angaben für Meldewesen und Ortstaxe, eine eigene Buchungsquelle mit booking.com-Farbe im Kalender, und die Buchungsübersicht bekommt dieselbe Sprungauswahl wie der Belegungskalender. Außerdem stehen im Mitreisenden-Formular Nachname und Vorname in derselben Reihenfolge wie beim Hauptgast.

### Neue Angaben an der Buchung
Gilt für **Buchungen und Optionen**, nicht für Sperren.

| Angabe | Pflicht | Regeln |
|---|---|---|
| Gästeblattnummer | nein | Freitext, höchstens 30 Zeichen, führende/abschließende Leerzeichen werden entfernt. Jederzeit nachtragbar. Ist die Nummer im Konto schon bei einer anderen Buchung vergeben, erscheint eine **Warnung, die man übergehen kann** |
| Abreise geplant | ja | das bisherige Feld „Abreise“, umbenannt; vereinbartes Abreisedatum |
| Abreise | ja, mit Automatik | tatsächliche Abreise. Läuft beim Erfassen automatisch mit „Abreise geplant“ mit, bis sie bewusst geändert wird. Muss nach der Anreise liegen |
| Wohnsitz angemeldet | ja, mit Standard | Häkchen, Standard **nicht gesetzt**. Für die Ortstaxe relevant: bei angemeldetem Wohnsitz ist keine Abgabe zu entrichten (Berechnung in PROJ-16) |
| Buchungsquelle | ja, mit Standard | Auswahl (siehe unten), Standard **„Keine Angabe“** |

**Reihenfolge im Formular:** Anreise → Abreise geplant → Abreise.

### Regeln für Abreise geplant / Abreise
- **Belegung** (Kalender, Konfliktprüfung, Kapazitäts- und Überschneidungswarnungen, Buchungsliste nach Monat) richtet sich nach der **tatsächlichen Abreise**. Eine frühere Abreise gibt die Wohnung ab dem Tag frei; eine spätere Abreise wird wie jede Verlängerung auf Konflikte geprüft.
- **Abzurechnende Nächte** = Nächte von der Anreise bis zur **späteren** der beiden Abreisen.
  - Abreise = geplant oder später → Nächte bis zur tatsächlichen Abreise.
  - Abreise früher als geplant → voller gebuchter Zeitraum (bis geplante Abreise).
- **Ortstaxe-Nächte** (für PROJ-16) = Nächte von der Anreise bis zur **tatsächlichen** Abreise.
- **Preis:** Der vom Inhaber eingetragene Nächtigungspreis gilt als **vereinbarter Preis für den geplanten Zeitraum**. Liegt die tatsächliche Abreise später, wird der Nächtigungspreis automatisch anteilig hochgerechnet: vereinbarter Preis ÷ geplante Nächte × abzurechnende Nächte (auf Cent gerundet). Beispiel: 500 € für 5 Nächte, 1 Nacht länger → 600 €. Wird die Abreise wieder auf oder vor die geplante gesetzt, gilt wieder der vereinbarte Preis. Zusatzkosten bleiben unverändert.
- Der **Preisvorschlag** (PROJ-27) rechnet weiterhin für den geplanten Zeitraum.

### Buchungsquelle
Eigene Liste der Buchung, **unabhängig** von der Marketing-Quelle der Gäste (diese entfällt später, siehe Out of Scope).

| Wert | Anzeige |
|---|---|
| website | Website |
| instagram | Instagram |
| google_ads | Google Ads |
| newsletter | Newsletter |
| referral | Empfehlung |
| platform_search | Plattform-Suche |
| booking_com | booking.com |
| custom | Eigene Angabe (Freitext, höchstens 100 Zeichen, Pflicht wenn gewählt) |
| none | Keine Angabe (Standard) |

**Farbe:** Buchungen mit Quelle „booking.com“ erscheinen in der booking.com-Farbe laut Design-Entwurf (**Accent-700**, weiße Schrift). Optionen mit Quelle „booking.com“ haben einen Rahmen in Accent-700. Alle anderen Quellen bleiben „Direkt“ (Neutral-800). Das gilt im Kalender auf dem Dashboard und auf der Vollbildseite (Zeitleiste, Monatsansicht, Tagesliste, Legende) und überall, wo Buchungen sonst eine Kanalfarbe tragen.

### Mitreisende
Im Formular „Mitreisende“ stehen die Felder in der Reihenfolge **Nachname, Vorname**, Geburtsdatum, wie beim Hauptgast. Die Grenze (Personen der Buchung minus Hauptgast) bleibt unverändert.

### Monatsauswahl in der Buchungsübersicht
Die Buchungsübersicht bekommt **dieselbe Sprungauswahl wie der Belegungskalender** (PROJ-9). Ein Klick auf die Monatsanzeige (z. B. „Oktober 2026“) öffnet ein Aufklappfeld mit der Beschriftung „Springen zu“, einem Datumsfeld und dem Knopf „Springen“. Die Liste springt in den Monat des gewählten Datums, das Feld schließt sich. Ohne gültiges Datum ist der Knopf deaktiviert. Vorbelegt ist der 1. des angezeigten Monats. Pfeile vor/zurück und „Heute“ bleiben erhalten. Bedienbar mit Tastatur und auf dem Handy.

Der **Belegungskalender bleibt unverändert**.

## User Stories
- Als Vermieter (Inhaber oder Mitarbeiter) möchte ich die Gästeblattnummer bei der Buchung eintragen, damit ich Buchung und Meldung eindeutig zuordnen kann.
- Als Vermieter möchte ich neben der geplanten auch die tatsächliche Abreise erfassen, damit frühere oder spätere Abreisen im Kalender, im Preis und später in der Ortstaxe richtig berücksichtigt werden.
- Als Inhaber möchte ich, dass sich der Preis bei einer Verlängerung automatisch anteilig erhöht, damit ich ihn nicht von Hand nachrechnen muss und ein gewährter Rabatt erhalten bleibt.
- Als Vermieter möchte ich bei einer Buchung „Wohnsitz angemeldet“ ankreuzen, damit für diesen Aufenthalt später keine Ortstaxe berechnet wird.
- Als Vermieter möchte ich bei jeder Buchung die Buchungsquelle auswählen (inkl. booking.com), damit ich weiß, woher meine Buchungen kommen, und booking.com-Buchungen im Kalender sofort erkenne.
- Als Vermieter möchte ich die Buchungsliste nach Quelle filtern, damit ich z. B. alle booking.com-Buchungen eines Monats sehe.
- Als Vermieter möchte ich in der Buchungsübersicht direkt zu einem beliebigen Monat springen, damit ich nicht viele Male auf die Pfeile klicken muss.
- Als Vermieter möchte ich Mitreisende in derselben Feldreihenfolge wie den Hauptgast erfassen, damit ich mich beim Abtippen nicht vertue.

## Out of Scope
- Mehr als „Personen minus Hauptgast“ Mitreisende: nicht benötigt (Grenze bleibt wie in PROJ-8)
- Entfernen der Marketing-Quelle bei den Gästen (PROJ-7): späteres Feature; bis dahin bestehen beide Listen unabhängig nebeneinander
- Airbnb als Buchungsquelle und Airbnb-Farbe: nicht gewünscht; Airbnb-Buchungen kommen mit dem Import (PROJ-11)
- Automatischer Import von booking.com-Buchungen und Abgleich der Quelle mit dem Channex-Kanal: PROJ-10/PROJ-11
- Berechnung der Ortstaxe (Nutzung von tatsächlicher Abreise und „Wohnsitz angemeldet“): PROJ-15/PROJ-16
- Gästeblatt selbst (Erstellung, Druck, Nummernkreis): PROJ-26; hier wird die Nummer nur erfasst, nicht vergeben
- Änderungen an der Sprungauswahl des Belegungskalenders (PROJ-9): bleibt wie sie ist
- Auswahl über ein Jahr-/Monatsraster: verworfen zugunsten der bekannten Sprungauswahl aus dem Kalender
- Abreise-Felder und Quelle für Sperren
- Anteilige Anpassung von Zusatzkosten bei Verlängerung

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Mitreisende
- [ ] Angenommen das Formular „Mitreisende“ ist offen, wenn eine Person hinzugefügt wird, dann steht das Feld „Nachname“ vor „Vorname“ (auf dem Handy oben, am Desktop links)
- [ ] Angenommen eine Buchung mit 5 Personen, wenn Mitreisende erfasst werden, dann sind weiterhin höchstens 4 möglich

### Gästeblattnummer
- [ ] Angenommen eine neue Buchung oder Option, wenn das Formular geöffnet wird, dann gibt es ein optionales Feld „Gästeblattnummer“
- [ ] Angenommen eine Sperre wird angelegt, wenn das Formular geöffnet wird, dann gibt es kein Feld „Gästeblattnummer“
- [ ] Angenommen eine Nummer mit mehr als 30 Zeichen, wenn gespeichert wird, dann erscheint eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen die Nummer „A-123“ ist im Konto bereits einer anderen Buchung zugeordnet, wenn eine weitere Buchung mit „A-123“ gespeichert wird, dann erscheint eine Warnung mit der anderen Buchung und man kann bewusst trotzdem speichern
- [ ] Angenommen die Nummer „A-123“ gibt es nur in einem anderen Kundenkonto, wenn sie gespeichert wird, dann erscheint keine Warnung
- [ ] Angenommen eine stornierte Buchung trägt „A-123“, wenn eine neue Buchung mit „A-123“ gespeichert wird, dann erscheint trotzdem die Warnung
- [ ] Angenommen eine Buchung hat eine Gästeblattnummer, wenn das Buchungs-Detail oder die Buchungsliste angezeigt wird, dann ist die Nummer sichtbar
- [ ] Angenommen eine Buchung hat die Gästeblattnummer „A-123“, wenn in der Buchungsliste nach „A-123“ gesucht wird, dann wird sie gefunden

### Abreise geplant / Abreise
- [ ] Angenommen das Buchungsformular, wenn es geöffnet wird, dann stehen die Felder in der Reihenfolge Anreise, Abreise geplant, Abreise
- [ ] Angenommen eine neue Buchung, wenn „Abreise geplant“ gesetzt wird und „Abreise“ noch nicht von Hand geändert wurde, dann übernimmt „Abreise“ dasselbe Datum
- [ ] Angenommen „Abreise“ wurde von Hand auf ein anderes Datum gesetzt, wenn „Abreise geplant“ danach geändert wird, dann bleibt „Abreise“ unverändert
- [ ] Angenommen „Abreise“ liegt am oder vor dem Anreisedatum, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen „Abreise geplant“ liegt am oder vor dem Anreisedatum, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen eine Buchung vom 1. bis 6. (geplant), wenn die tatsächliche Abreise auf den 4. gesetzt wird, dann zeigt der Kalender die Wohnung ab dem 4. als frei
- [ ] Angenommen eine Buchung vom 1. bis 6. (geplant) und eine andere Buchung ab dem 6., wenn die tatsächliche Abreise auf den 7. gesetzt wird, dann erscheint die Überschneidungswarnung wie bei jeder anderen Buchung
- [ ] Angenommen bestehende Buchungen aus der Zeit vor diesem Feature, wenn das Feature ausgerollt ist, dann steht in „Abreise geplant“ und „Abreise“ jeweils das bisherige Abreisedatum, beide Felder sind gleich
- [ ] Angenommen das Buchungs-Detail, wenn beide Abreisen gleich sind, dann wird nur ein Abreisedatum angezeigt; wenn sie abweichen, dann werden beide angezeigt
- [ ] Angenommen eine Option wird in eine Buchung umgewandelt, wenn das passiert, dann bleiben beide Abreisedaten erhalten

### Preis bei Verlängerung und früherer Abreise
- [ ] Angenommen eine Buchung mit vereinbartem Nächtigungspreis 500 € für 5 geplante Nächte, wenn die tatsächliche Abreise 1 Tag später gesetzt wird, dann beträgt der Nächtigungspreis 600 €
- [ ] Angenommen dieselbe Buchung, wenn die tatsächliche Abreise 2 Tage früher gesetzt wird, dann bleibt der Nächtigungspreis bei 500 €
- [ ] Angenommen die Abreise wurde verlängert und der Preis auf 600 € hochgerechnet, wenn die Abreise wieder auf das geplante Datum gesetzt wird, dann beträgt der Preis wieder 500 €
- [ ] Angenommen eine Verlängerung, wenn der Inhaber das Formular sieht, dann zeigt es den vereinbarten Preis, die abzurechnenden Nächte und den hochgerechneten Preis
- [ ] Angenommen eine Buchung mit Zusatzkosten, wenn die Abreise verlängert wird, dann bleiben die Zusatzkosten unverändert
- [ ] Angenommen ein Mitarbeiter verlängert die Abreise, wenn er speichert, dann wird der Preis ebenso automatisch hochgerechnet, ohne dass der Mitarbeiter Beträge sieht
- [ ] Angenommen ein ungerader Betrag (z. B. 333,33 € für 3 Nächte, 1 Nacht länger), wenn hochgerechnet wird, dann wird auf Cent gerundet (444,44 €)

### Wohnsitz angemeldet
- [ ] Angenommen eine neue Buchung oder Option, wenn das Formular geöffnet wird, dann ist „Wohnsitz angemeldet“ nicht angehakt
- [ ] Angenommen bestehende Buchungen, wenn das Feature ausgerollt ist, dann ist „Wohnsitz angemeldet“ bei allen nicht angehakt
- [ ] Angenommen „Wohnsitz angemeldet“ ist angehakt, wenn das Buchungs-Detail angezeigt wird, dann ist der Hinweis „Wohnsitz angemeldet“ sichtbar
- [ ] Angenommen Inhaber oder Mitarbeiter, wenn sie eine Buchung bearbeiten, dann können beide das Häkchen setzen und entfernen

### Buchungsquelle
- [ ] Angenommen eine neue Buchung oder Option, wenn das Formular geöffnet wird, dann ist die Buchungsquelle „Keine Angabe“ vorausgewählt
- [ ] Angenommen die Buchungsquelle-Auswahl, wenn sie geöffnet wird, dann zeigt sie Website, Instagram, Google Ads, Newsletter, Empfehlung, Plattform-Suche, booking.com, Eigene Angabe, Keine Angabe
- [ ] Angenommen „Eigene Angabe“ ist gewählt und der Freitext leer, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen eine Buchung mit Quelle „booking.com“, wenn der Kalender auf Dashboard oder Vollbildseite angezeigt wird, dann ist der Balken in Accent-700 mit weißer Schrift
- [ ] Angenommen eine Option mit Quelle „booking.com“, wenn der Kalender angezeigt wird, dann hat sie einen Rahmen in Accent-700
- [ ] Angenommen eine Buchung mit einer anderen Quelle als booking.com, wenn der Kalender angezeigt wird, dann bleibt sie in der Farbe „Direkt“
- [ ] Angenommen der Kalender, wenn die Legende angezeigt wird, dann enthält sie „booking.com“ mit der Farbe Accent-700
- [ ] Angenommen eine Buchung mit Quelle, wenn das Buchungs-Detail angezeigt wird, dann ist die Quelle sichtbar (bei „Eigene Angabe“ der Freitext)
- [ ] Angenommen die Buchungsliste, wenn der Filter „Quelle“ auf „booking.com“ gesetzt wird, dann erscheinen nur Buchungen und Optionen mit dieser Quelle; der Filter steht in der Adresse wie die anderen Filter
- [ ] Angenommen bestehende Buchungen, wenn das Feature ausgerollt ist, dann haben sie die Quelle „Keine Angabe“
- [ ] Angenommen ein Gast hat eine Marketing-Quelle, wenn eine Buchung für ihn angelegt wird, dann wird die Buchungsquelle davon nicht beeinflusst

### Monatsauswahl
- [ ] Angenommen die Buchungsübersicht zeigt „Oktober 2026“, wenn auf die Monatsanzeige geklickt wird, dann öffnet sich ein Feld „Springen zu“ mit Datumsfeld (vorbelegt 01.10.2026) und Knopf „Springen“, wie im Belegungskalender
- [ ] Angenommen das Feld ist offen, wenn das Datum 14.03.2027 gewählt und „Springen“ geklickt wird, dann zeigt die Liste März 2027 und das Feld schließt sich
- [ ] Angenommen das Datumsfeld ist leer oder ungültig, wenn das Feld offen ist, dann ist „Springen“ deaktiviert
- [ ] Angenommen das Feld ist offen, wenn Escape gedrückt oder daneben geklickt wird, dann schließt es sich ohne Monatswechsel
- [ ] Angenommen nur Tastatur, wenn die Monatsanzeige fokussiert und Enter gedrückt wird, dann öffnet sich das Feld, das Datum ist eingebbar und mit Enter wird gesprungen
- [ ] Angenommen Filter für Wohnung, Art, Zustand oder Quelle sind gesetzt, wenn gesprungen wird, dann bleiben sie erhalten
- [ ] Angenommen eine Suche ist aktiv (Monatsleiste ausgeblendet), wenn die Liste angezeigt wird, dann bleibt die Monatsleiste wie bisher ausgeblendet
- [ ] Angenommen ein Handy mit 375 px Breite, wenn das Feld geöffnet wird, dann passt es ohne seitliches Scrollen auf den Bildschirm
- [ ] Angenommen der Belegungskalender, wenn auf die Zeitraumanzeige geklickt wird, dann verhält er sich unverändert wie bisher

## Edge Cases
- **Abreise geplant und Abreise gleichzeitig geändert:** Beide gelten wie eingegeben; Preis- und Belegungsregeln rechnen mit den gespeicherten Werten.
- **Planung wird nachträglich verlängert** (Gast bucht offiziell länger): Der Inhaber ändert „Abreise geplant“ und trägt ggf. einen neuen vereinbarten Preis ein; der Preisvorschlag rechnet für den neuen geplanten Zeitraum.
- **Tatsächliche Abreise später, aber Konflikt mit Folgebuchung:** Überschneidungswarnung wie bisher; Inhaber dürfen bewusst übersteuern, Mitarbeiter nicht (Regel aus PROJ-8).
- **Frühere Abreise und neue Buchung in der freigewordenen Zeit:** Erlaubt, da die Belegung nach der tatsächlichen Abreise geht. Wird die tatsächliche Abreise danach wieder nach hinten verschoben, greift die Überschneidungswarnung.
- **Stornierte Buchung:** Abreisedaten, Quelle, Gästeblattnummer und Häkchen bleiben zur Ansicht erhalten; die Gästeblattnummer zählt weiterhin für die Doppelungswarnung.
- **Gästeblattnummer nur aus Leerzeichen:** wird als leer gespeichert.
- **Gleiche Gästeblattnummer bei Groß/Klein-Unterschied** („a-123“ vs. „A-123“): gilt als dieselbe Nummer (Warnung).
- **Wechsel der Quelle von „Eigene Angabe“ auf etwas anderes:** Der Freitext wird verworfen.
- **Anonymisierter Gast:** Quelle, Gästeblattnummer, Abreisedaten und Häkchen der Buchung bleiben erhalten (keine personenbezogenen Daten).
- **Gleichzeitige Bearbeitung:** Wie bisher in PROJ-8: Wer zuletzt speichert, bekommt einen Hinweis, dass die Buchung inzwischen geändert wurde.
- **Monatsauswahl mit gefilterter Liste:** Andere Filter (Wohnung, Art, Zustand, Quelle) bleiben beim Monatswechsel erhalten.
- **Datum weit in Vergangenheit oder Zukunft:** Die Liste zeigt den Monat wie bisher bei Monaten aus der Adresse (leere Liste, wenn keine Buchungen).

## Technical Requirements (optional)
- Sicherheit: Alle neuen Angaben mandantengetrennt (Muster aus PROJ-1); Beträge weiterhin nur für Inhaber sichtbar
- Prüfung auf Server und im Browser mit denselben Regeln
- Bestehende Buchungen werden beim Ausrollen ohne Datenverlust ergänzt (beide Felder „Abreise geplant“ und „Abreise“ werden mit dem bisherigen Abreisedatum befüllt, sodass in beiden dieselbe Information steht; Häkchen nicht gesetzt; Quelle „Keine Angabe“)
- Browser: Chrome, Firefox, Safari (Desktop und mobil)

## Open Questions
- [ ] Wann wird die Marketing-Quelle bei den Gästen entfernt, und sollen bestehende Gäste-Quellen dabei auf ihre Buchungen übertragen werden?
- [ ] Wie verhält sich die manuell gesetzte Quelle „booking.com“, wenn PROJ-11 Buchungen von booking.com importiert (Kanal vs. Quelle zusammenführen)?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Feature statt mehrerer | Alle Punkte ändern dieselbe Buchungsmaske und -übersicht, sind klein und gemeinsam test- und ausrollbar | 2026-10-26 |
| Keine Erhöhung der Mitreisenden-Grenze | Nutzer hat den Wunsch zurückgezogen; Grenze „Personen minus Hauptgast“ hält Personenzahl, Preis und Gästeblatt stimmig | 2026-10-26 |
| Gästeblattnummer optional, Warnung bei Doppelung (übergehbar) | Nummer wird oft erst beim Check-in vergeben; Doppelungen sind meist Tippfehler, aber nicht ausgeschlossen | 2026-10-26 |
| Bisherige „Abreise“ wird „Abreise geplant“, neue „Abreise“ = tatsächliche | Feldreihenfolge Anreise → geplant → tatsächlich; Gästeblatt und Ortstaxe brauchen den tatsächlichen Aufenthalt | 2026-10-26 |
| „Abreise“ läuft beim Erfassen automatisch mit „Abreise geplant“ mit | Im Normalfall sind beide gleich; kein doppeltes Eintippen | 2026-10-26 |
| Belegung nach tatsächlicher Abreise | Frühe Abreise gibt die Wohnung frei, Verlängerung muss Konflikte prüfen | 2026-10-26 |
| Preis nach späterer Abreise, Ortstaxe nach tatsächlicher | Vorgabe des Nutzers: bei früherer Abreise ist der volle Zeitraum zu bezahlen, Abgabe nur für den tatsächlichen Aufenthalt | 2026-10-26 |
| Preis bei Verlängerung automatisch anteilig hochrechnen | Nutzerwunsch „automatisch anpassen“; anteilig, damit ein eigener Preis bzw. Rabatt erhalten bleibt | 2026-10-26 |
| Eigene Buchungsquelle, nicht an die Gäste-Liste gekoppelt | Die Marketing-Quelle der Gäste wird später entfernt; nur die Liste bei der Buchung bleibt | 2026-10-26 |
| Nur booking.com bekommt eine eigene Farbe, kein Airbnb | Nutzerwunsch; Airbnb kommt über den Import (PROJ-11) | 2026-10-26 |
| Quelle als Filter in der Buchungsliste | Schnelle Übersicht z. B. über alle booking.com-Buchungen | 2026-10-26 |
| Bestehende Buchungen: beide Abreisefelder mit dem bisherigen Datum befüllen | Nutzerwunsch; keine Lücken, keine Preis- oder Belegungsänderung durch das Ausrollen | 2026-10-26 |
| Buchungsübersicht übernimmt die Sprungauswahl des Belegungskalenders; Kalender bleibt unverändert | Nutzerwunsch; einheitliche, bereits bekannte Bedienung in Liste und Kalender | 2026-10-26 |
| Neue Felder nur für Buchungen und Optionen | Sperren haben keinen Gast, keine Meldung und keine Ortstaxe | 2026-10-26 |

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
