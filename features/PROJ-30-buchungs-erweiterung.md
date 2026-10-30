# PROJ-30: Buchungs-Erweiterung: Meldedaten, Buchungsquelle, Monatsauswahl

## Status: In Progress
**Created:** 2026-10-26
**Last Updated:** 2026-10-30

> Grundumfang ausgeliefert (Deployed). Änderung „Preisregel bei Verlängerung wählbar“ am 2026-10-30 per `/refine` festgelegt und entworfen (Tech Design unten), noch nicht gebaut.

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
- **Preis:** Bei gleicher oder früherer tatsächlicher Abreise gilt der eingetragene Nächtigungspreis unverändert (bei früherer Abreise ist der volle Zeitraum zu bezahlen).
- **Preis bei Verlängerung – wählbar je Buchung (geändert 2026-10-30):** Liegt die tatsächliche Abreise **nach** der geplanten, wählt der Inhaber im Buchungsformular unter dem Nächtigungspreis:
  - **„Preis gilt für den gesamten Aufenthalt“** (Voreinstellung): Der eingetragene Betrag wird unverändert abgerechnet.
  - **„Anteilig hochrechnen“**: vereinbarter Preis ÷ geplante Nächte × abzurechnende Nächte (auf Cent gerundet). Beispiel: 500 € für 5 Nächte, 1 Nacht länger → 600 €. Der hochgerechnete Betrag ist im Formular sofort sichtbar.
  - Die Auswahl erscheint **ausschließlich** bei tatsächlicher Abreise nach der geplanten (seltener Fall); sonst bleibt das Formular wie bisher. Im Buchungsdetail wird die gewählte Regel nicht eigens angezeigt.
  - Die Wahl wird an der Buchung gespeichert. Wird die Abreise wieder auf oder vor die geplante gesetzt, gilt der eingetragene Preis; die gespeicherte Wahl greift wieder, falls erneut verlängert wird.
  - Zusatzkosten bleiben in beiden Fällen unverändert.
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
Die Buchungsübersicht bekommt **dieselbe Sprungauswahl wie der Belegungskalender** (PROJ-9). Ein Klick auf die Monatsanzeige (z. B. „Oktober 2026“) öffnet ein Aufklappfeld mit der Beschriftung „Springen zu“, einem Datumsfeld und dem Knopf „Anzeigen“ (wie im Kalender). Die Liste springt in den Monat des gewählten Datums, das Feld schließt sich. Ohne gültiges Datum ist der Knopf deaktiviert. Vorbelegt ist der 1. des angezeigten Monats. Pfeile vor/zurück und „Heute“ bleiben erhalten. Bedienbar mit Tastatur und auf dem Handy.

Der **Belegungskalender bleibt unverändert**.

## User Stories
- Als Vermieter (Inhaber oder Mitarbeiter) möchte ich die Gästeblattnummer bei der Buchung eintragen, damit ich Buchung und Meldung eindeutig zuordnen kann.
- Als Vermieter möchte ich neben der geplanten auch die tatsächliche Abreise erfassen, damit frühere oder spätere Abreisen im Kalender, im Preis und später in der Ortstaxe richtig berücksichtigt werden.
- Als Inhaber möchte ich bei einer Verlängerung wählen, ob der eingetragene Preis für den gesamten Aufenthalt gilt oder anteilig hochgerechnet wird, damit ein mit dem Gast vereinbarter Pauschalpreis nicht ungewollt steigt und ich trotzdem bequem hochrechnen kann (Rabatt bleibt erhalten).
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
- [ ] Angenommen eine Buchung mit tatsächlicher Abreise gleich oder vor der geplanten, wenn der Inhaber das Formular öffnet, dann gibt es keine Auswahl zur Preisregel
- [ ] Angenommen eine Buchung mit Nächtigungspreis 500 € für 5 geplante Nächte, wenn der Inhaber die tatsächliche Abreise 1 Tag später setzt, dann erscheint die Auswahl mit „Preis gilt für den gesamten Aufenthalt“ vorausgewählt und der Preis bleibt bei 500 €
- [ ] Angenommen dieselbe Verlängerung, wenn der Inhaber „Anteilig hochrechnen“ wählt, dann zeigt das Formular sofort 600 € (und die abzurechnenden Nächte), und nach dem Speichern gilt 600 € in Detail, Liste und Gesamtpreis
- [ ] Angenommen „Preis gilt für den gesamten Aufenthalt“, wenn gespeichert wird, dann gilt der eingetragene Betrag in Detail, Liste und Gesamtpreis unverändert
- [ ] Angenommen eine Verlängerung mit gespeicherter Wahl, wenn die Buchung erneut bearbeitet wird, dann ist die gespeicherte Wahl ausgewählt
- [ ] Angenommen die Abreise wurde verlängert und „Anteilig hochrechnen“ gewählt, wenn die Abreise wieder auf das geplante Datum gesetzt wird, dann verschwindet die Auswahl und es gilt wieder der eingetragene Preis (500 €)
- [ ] Angenommen dieselbe Buchung, wenn die tatsächliche Abreise 2 Tage früher gesetzt wird, dann gibt es keine Auswahl und der Preis bleibt bei 500 €
- [ ] Angenommen eine Buchung mit Zusatzkosten, wenn die Abreise verlängert wird, dann bleiben die Zusatzkosten bei beiden Regeln unverändert
- [ ] Angenommen ein Mitarbeiter verlängert die Abreise, wenn er speichert, dann gilt die an der Buchung gespeicherte Regel (ohne gespeicherte Wahl: „gesamter Aufenthalt“); der Mitarbeiter sieht weder Beträge noch die Auswahl
- [ ] Angenommen „Anteilig hochrechnen“ und ein ungerader Betrag (z. B. 333,33 € für 3 Nächte, 1 Nacht länger), wenn hochgerechnet wird, dann wird auf Cent gerundet (444,44 €)
- [ ] Angenommen eine schon vor dieser Änderung verlängerte und hochgerechnete Buchung, wenn die Änderung ausgerollt ist, dann bleibt ihr Betrag unverändert und beim Bearbeiten ist „Anteilig hochrechnen“ ausgewählt
- [ ] Angenommen jemand sendet eine Preisregel direkt an den Server, wenn sie ungültig ist oder von einem Mitarbeiter kommt, dann wird sie abgelehnt bzw. nicht übernommen

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
- [ ] Angenommen die Buchungsübersicht zeigt „Oktober 2026“, wenn auf die Monatsanzeige geklickt wird, dann öffnet sich ein Feld „Springen zu“ mit Datumsfeld (vorbelegt 01.10.2026) und Knopf „Anzeigen“, wie im Belegungskalender
- [ ] Angenommen das Feld ist offen, wenn das Datum 14.03.2027 gewählt und „Anzeigen“ geklickt wird, dann zeigt die Liste März 2027 und das Feld schließt sich
- [ ] Angenommen das Datumsfeld ist leer oder ungültig, wenn das Feld offen ist, dann ist „Anzeigen“ deaktiviert
- [ ] Angenommen das Feld ist offen, wenn Escape gedrückt oder daneben geklickt wird, dann schließt es sich ohne Monatswechsel
- [ ] Angenommen nur Tastatur, wenn die Monatsanzeige fokussiert und Enter gedrückt wird, dann öffnet sich das Feld, das Datum ist eingebbar und mit Enter wird gesprungen
- [ ] Angenommen Filter für Wohnung, Art, Zustand oder Quelle sind gesetzt, wenn gesprungen wird, dann bleiben sie erhalten
- [ ] Angenommen eine Suche ist aktiv (Monatsleiste ausgeblendet), wenn die Liste angezeigt wird, dann bleibt die Monatsleiste wie bisher ausgeblendet
- [ ] Angenommen ein Handy mit 375 px Breite, wenn das Feld geöffnet wird, dann passt es ohne seitliches Scrollen auf den Bildschirm
- [ ] Angenommen der Belegungskalender, wenn auf die Zeitraumanzeige geklickt wird, dann verhält er sich unverändert wie bisher

## Edge Cases
- **Abreise geplant und Abreise gleichzeitig geändert:** Beide gelten wie eingegeben; Preis- und Belegungsregeln rechnen mit den gespeicherten Werten.
- **Pauschalpreis für einen verlängerten Aufenthalt** (Anlassfall 2026-10-30): Inhaber wählt „Preis gilt für den gesamten Aufenthalt“ und trägt den vereinbarten Gesamtbetrag ein. Der eine betroffene Bestandsfall in Produktion wird vom Nutzer von Hand umgestellt.
- **Verlängerung durch einen Mitarbeiter bei neuer Buchung ohne gespeicherte Wahl:** gilt „gesamter Aufenthalt“, der Betrag ändert sich nicht; der Inhaber kann später auf „anteilig“ umstellen.
- **Bereits erfasste Rechnungen (PROJ-37):** bleiben unverändert (Positionen sind eine Kopie); im Buchungsdetail kann sich „Gesamtpreis“ gegenüber „Verrechnet“ verschieben, wenn die Regel nachträglich umgestellt wird.
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
- [ ] Beim Bearbeiten: soll „Abreise“ weiter automatisch mitlaufen, wenn beide Daten beim Öffnen gleich sind? (Design-Annahme: ja)
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
| **Geändert:** Preisregel bei Verlängerung je Buchung wählbar – „Preis gilt für den gesamten Aufenthalt“ (Voreinstellung) oder „Anteilig hochrechnen“ | Anlassfall im Livebetrieb: vereinbarter Pauschalpreis wurde ungewollt erhöht und ließ sich nicht verhindern; Hochrechnen bleibt als Option für Preise pro Nacht/Rabatte | 2026-10-30 |
| Auswahl nur bei tatsächlicher Abreise nach der geplanten | Seltener Fall; Formular soll sonst übersichtlich bleiben (Nutzervorgabe) | 2026-10-30 |
| Keine Anzeige der gewählten Regel im Buchungsdetail | Nutzerentscheidung; der Betrag genügt | 2026-10-30 |
| Bestehende verlängerte Buchungen behalten „Anteilig hochrechnen“ | Keine stillen Betragsänderungen an Buchungen und Rechnungen; der eine Anlassfall wird vom Nutzer von Hand umgestellt | 2026-10-30 |
| Mitarbeiter sehen die Auswahl nicht; ihre Verlängerungen folgen der gespeicherten Regel (sonst „gesamter Aufenthalt“) | Mitarbeiter sehen keine Beträge (PROJ-8); kein ungewolltes Erhöhen durch Mitarbeiter | 2026-10-30 |
| Eigene Buchungsquelle, nicht an die Gäste-Liste gekoppelt | Die Marketing-Quelle der Gäste wird später entfernt; nur die Liste bei der Buchung bleibt | 2026-10-26 |
| Nur booking.com bekommt eine eigene Farbe, kein Airbnb | Nutzerwunsch; Airbnb kommt über den Import (PROJ-11) | 2026-10-26 |
| Quelle als Filter in der Buchungsliste | Schnelle Übersicht z. B. über alle booking.com-Buchungen | 2026-10-26 |
| Bestehende Buchungen: beide Abreisefelder mit dem bisherigen Datum befüllen | Nutzerwunsch; keine Lücken, keine Preis- oder Belegungsänderung durch das Ausrollen | 2026-10-26 |
| Buchungsübersicht übernimmt die Sprungauswahl des Belegungskalenders; Kalender bleibt unverändert | Nutzerwunsch; einheitliche, bereits bekannte Bedienung in Liste und Kalender | 2026-10-26 |
| Neue Felder nur für Buchungen und Optionen | Sperren haben keinen Gast, keine Meldung und keine Ortstaxe | 2026-10-26 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Bestehende Spalte `departure` = tatsächliche Abreise, neue Spalte für geplante Abreise | Belegungsabfragen, Indizes, Konfliktprüfung und Kalender bleiben unverändert korrekt | 2026-10-27 |
| Abgerechneter Nächtigungspreis als gespeicherter, serverseitig berechneter Wert neben dem vereinbarten | Fertiger Betrag für Liste, Detail, PROJ-13/18; Mitarbeiter-Änderungen rechnen mit, ohne Beträge zu sehen | 2026-10-27 |
| Vereinbarter Preis bleibt im bisherigen Betragsfeld | Formular unverändert; Rücksetzen der Abreise stellt den vereinbarten Preis automatisch wieder her | 2026-10-27 |
| Buchungsquelle als eigene Spalte, Kanal-Spalte bleibt für den Import | Klare Trennung Vermieter-Angabe vs. technischer Kanal; eine Farbregel vereint beide | 2026-10-27 |
| Gästeblattnummer ohne Unique-Constraint, Index auf Kleinschreibung je Kunde | Doppelung ist nur Warnung; Index für Prüfung (Groß/Klein egal) und Suche | 2026-10-27 |
| Nummer-Warnung mit eigener Bestätigung, für Inhaber und Mitarbeiter | Übersteuern von Überschneidungen bleibt Inhabern vorbehalten (PROJ-8); Nummer-Doppelung gefährdet keine Belegung | 2026-10-27 |
| „Preis prüfen“ nicht bei reiner Änderung der tatsächlichen Abreise | Preis folgt automatisch anteilig; nur geänderte Planung braucht die Prüfung durch den Inhaber | 2026-10-27 |
| Preisregel bei Verlängerung als eigene Angabe bei den Beträgen der Buchung (nur Inhaber lesbar) | Gehört zum Preis; Mitarbeiter sehen keine Beträge und brauchen die Regel nicht; gleiche Leseregeln wie die übrigen Beträge | 2026-10-30 |
| Abgerechneter Preis bleibt gespeichert und wird von der Datenbank gebildet, jetzt mit der gewählten Regel | Detail, Liste, Gesamtpreis und Rechnungsabschnitt lesen weiter einen fertigen Betrag; Browser kann ihn nicht verfälschen | 2026-10-30 |
| Bestand: verlängerte Buchungen erhalten „anteilig“, alle anderen „gesamter Aufenthalt“ | Keine Betragsänderung durch das Ausrollen; neue Verlängerungen starten mit der vom Nutzer gewünschten Voreinstellung | 2026-10-30 |
| Wahl wird auch ohne aktuelle Verlängerung gespeichert; Mitarbeiter-Speichern lässt sie unverändert | Erneute Verlängerung behält die Entscheidung des Inhabers; Mitarbeiter können den Preis nicht ungewollt erhöhen | 2026-10-30 |
| Sprungauswahl als gemeinsamer Baustein für Kalender und Buchungsliste | Einheitliche Bedienung, eine Stelle für Pflege; Kalender-E2E-Tests sichern Unverändertheit | 2026-10-27 |
| Ganzzahlige Cent-Rechnung, kaufmännisch gerundet, gleiche Regel in Browser und Server | Identische Werte in Vorschau und gespeichertem Betrag | 2026-10-27 |
| Sperren: geplante = tatsächliche Abreise, Quelle „none“, keine Nummer, per Datenbankregel | Spec: neue Felder nicht für Sperren; Regel verhindert inkonsistente Daten | 2026-10-27 |
| Keine erneute Gästeblatt-Warnung, wenn die bearbeitete Buchung die Nummer schon trägt | Die Doppelung wurde beim ersten Speichern bestätigt; sonst bei jeder Änderung erneut bestätigen | 2026-10-27 |
| Trigger setzt geplante = tatsächliche Abreise für Sperren und bei fehlender Angabe | `save_block` bleibt unverändert; direktes Schreiben (Import PROJ-11) bleibt gültig | 2026-10-27 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Reine Erweiterung bestehender Bausteine aus PROJ-8, PROJ-9 und PROJ-27. Keine neue Seite, keine neue Tabelle, keine neuen Pakete. Datenbank: neue Spalten an der Buchung und am Betrag, Anpassung der bestehenden Speicher- und Warnfunktionen. Oberfläche: Buchungsformular, Buchungs-Detail, Buchungsliste mit Filtern, Mitreisende, Kalenderfarben.

### A) Komponenten-Struktur

```
Buchungsübersicht (/buchungen)
+-- Filterleiste (booking-filters)
|   +-- Monatsleiste: ‹ [Oktober 2026 ▾] › Heute
|   |   +-- NEU: Sprungauswahl (gemeinsamer Baustein, auch im Kalender)
|   |       +-- „Springen zu“ + Datumsfeld (vorbelegt 1. des Monats) + Knopf „Anzeigen“
|   +-- Wohnung | Art | Zustand | NEU: Quelle   (alle in der Adresse)
|   +-- Suche (findet jetzt auch die Gästeblattnummer)
+-- Buchungsliste (booking-list)
    +-- Zeile: Nummer, NEU: Gästeblattnummer (klein, falls vorhanden), Gast, Zeitraum, Betrag

Buchungsformular (booking-panel, Buchung und Option)
+-- Wohnung, Gast, Personen (unverändert)
+-- Zeitraum: Anreise → Abreise geplant → NEU: Abreise (läuft mit, bis von Hand geändert)
+-- NEU: Gästeblattnummer (optional)
+-- NEU: Buchungsquelle (Auswahl) + Freitext bei „Eigene Angabe“
+-- NEU: Häkchen „Wohnsitz angemeldet“
+-- Preis (nur Inhaber)
|   +-- Nächtigungspreis = vereinbarter Preis für den geplanten Zeitraum (Preisvorschlag wie bisher)
|   +-- NEU: Hinweis bei Verlängerung: „vereinbart X € für N Nächte · abzurechnen M Nächte · Y €“
|   +-- Zusatzkosten (unverändert)
+-- Warnungen (booking-warnings)
    +-- Überschneidung, Überbelegung (wie bisher)
    +-- NEU: „Gästeblattnummer bereits vergeben bei Buchung 2026-0012 (Huber, Anna)“ + „Trotzdem speichern“

Sperren-Formular (block-panel): unverändert, keine neuen Felder

Buchungs-Detail (booking-detail)
+-- Abreise: ein Datum, wenn gleich; sonst „Abreise geplant“ und „Abreise“
+-- NEU: Gästeblattnummer, Buchungsquelle (bei „Eigene Angabe“ der Freitext), Hinweis „Wohnsitz angemeldet“
+-- Preis (nur Inhaber): abgerechneter Nächtigungspreis; bei Verlängerung zusätzlich der vereinbarte

Mitreisende (companions-panel): Reihenfolge Nachname, Vorname, Geburtsdatum

Belegungskalender (Dashboard + Vollbild)
+-- Farbregel (entry-style): Quelle booking.com → Accent-700 (Option: Rahmen Accent-700), sonst „Direkt“
+-- Legende: NEU „booking.com“
+-- Sprungauswahl nutzt denselben gemeinsamen Baustein, Verhalten unverändert
```

### B) Datenmodell (in Worten)

**Buchung (bestehende Tabelle, neue bzw. umgedeutete Angaben):**
- **Abreise (tatsächlich):** das bestehende Feld „Abreise“ bleibt technisch erhalten und bedeutet ab jetzt die tatsächliche Abreise. Dadurch rechnen Kalender, Konfliktprüfung, Kapazitätswarnung, Monatsliste und alle bestehenden Abfragen automatisch nach der tatsächlichen Abreise, ohne dass sie umgebaut werden müssen.
- **Abreise geplant (neu):** Pflicht, muss nach der Anreise liegen, höchstens 365 Nächte. Beim Ausrollen mit dem bisherigen Abreisedatum befüllt.
- **Gästeblattnummer (neu):** optional, höchstens 30 Zeichen, ohne Rand-Leerzeichen; nur Leerzeichen = leer. Nicht eindeutig (Doppelungen sind nur eine Warnung). Ein Suchindex über die Nummer in Kleinschreibung je Kunde macht die Doppelungsprüfung und die Suche schnell.
- **Buchungsquelle (neu):** einer der Werte website, instagram, google_ads, newsletter, referral, platform_search, booking_com, custom, none; Standard none.
- **Eigene Quelle (neu):** Freitext bis 100 Zeichen, genau dann gefüllt, wenn die Quelle „custom“ ist (Wechsel auf eine andere Quelle verwirft ihn).
- **Wohnsitz angemeldet (neu):** ja/nein, Standard nein.
- **Sperren:** Abreise geplant = Abreise, Quelle „none“, keine Gästeblattnummer, Häkchen nein; von der Datenbank erzwungen.
- Das bestehende Feld **Kanal** bleibt unberührt und ist für den Import (PROJ-11) reserviert.

**Beträge je Buchung (bestehende Tabelle, nur Inhaber lesbar):**
- **Nächtigungspreis vereinbart:** das bestehende Feld, unverändert der Wert, den der Inhaber einträgt bzw. der Preisvorschlag; gilt für den geplanten Zeitraum.
- **Nächtigungspreis abgerechnet (neu):** wird bei jedem Speichern vom Server berechnet: vereinbarter Preis ÷ geplante Nächte × abzurechnende Nächte, kaufmännisch auf Cent gerundet. Abzurechnende Nächte = Anreise bis zur späteren der beiden Abreisen. Beim Ausrollen = vereinbarter Preis.
- Gesamtbetrag in Liste und Detail (und später Zahlungen PROJ-13) = abgerechneter Nächtigungspreis + Zusatzkosten.

**Abgeleitete Größen (nicht gespeichert, gemeinsame Rechenregel in Browser und Server):**
- Geplante Nächte = Anreise bis Abreise geplant
- Abzurechnende Nächte = Anreise bis zur späteren Abreise
- Ortstaxe-Nächte = Anreise bis tatsächliche Abreise (für PROJ-16 bereitgestellt)

**Mandantentrennung:** Alle neuen Felder liegen in den bestehenden, bereits mandantengetrennten Tabellen (RLS-Muster PROJ-1). Die Doppelungsprüfung sucht nur im eigenen Kundenkonto.

### C) Abläufe

**Speichern einer Buchung/Option (bestehende Serverfunktion, erweitert):**
1. Prüfregeln wie im Browser (beide Abreisen nach Anreise, Längen, Quelle/Freitext).
2. Warnungen ermitteln: Überschneidung und Überbelegung mit der tatsächlichen Abreise (wie bisher), dazu neu „Gästeblattnummer schon vergeben“ (Groß/Klein egal, auch stornierte Buchungen, nicht die eigene).
3. Zwei getrennte Bestätigungen: Überschneidung/Überbelegung darf wie bisher nur der Inhaber übersteuern. Die Gästeblattnummer-Warnung dürfen **Inhaber und Mitarbeiter** übergehen (keine Gefahr für die Belegung, Nummer wird meist vom Mitarbeiter beim Check-in eingetragen).
4. Abgerechneten Preis neu berechnen, für Inhaber und Mitarbeiter gleich. Mitarbeiter ändern den vereinbarten Preis nie und sehen keine Beträge.
5. „Preis prüfen“ für Mitarbeiter-Änderungen: nur noch bei Änderung von Anreise, **geplanter** Abreise, Wohnung oder (bei Personenpreisen) Personen. Eine reine Änderung der tatsächlichen Abreise löst es nicht aus, weil der Preis automatisch anteilig folgt.
6. Preisvorschlag (PROJ-27) rechnet mit den geplanten Nächten.

**Warnungs-Vorschau im Formular:** Die bestehende Vorschau bekommt zusätzlich die Gästeblattnummer und zeigt die Doppelung schon beim Tippen (verzögert, wie die bestehenden Warnungen).

**Automatik „Abreise läuft mit“ (nur im Browser):** Neue Buchung: Abreise folgt der geplanten Abreise, bis sie von Hand geändert wird. Bearbeiten: sind beide beim Öffnen gleich, läuft sie weiter mit; weichen sie ab, bleibt sie fest.

**Option → Buchung:** Umwandlung ändert keine Daten; beide Abreisen, Quelle, Nummer und Häkchen bleiben erhalten. Die Konfliktprüfung dabei nutzt die tatsächliche Abreise.

**Kalenderfarbe:** Eine einzige Farbregel bestimmt den „Farbkanal“ eines Eintrags: Quelle booking.com (heute) bzw. importierter Kanal booking.com (später PROJ-11) → booking.com-Farbe, sonst „Direkt“. Damit greift sie überall, wo Kanalfarben vorkommen (Zeitleiste, Monatsansicht, Tagesliste, Detailpanel, Legende).

**Monatsauswahl:** Die Sprungauswahl des Kalenders wird in einen kleinen gemeinsamen Baustein ausgelagert (shadcn Popover + Datumsfeld + Knopf). Die Buchungsübersicht setzt beim Springen nur den Monat in der Adresse; alle anderen Filter bleiben. Bei aktiver Suche bleibt die Monatsleiste ausgeblendet.

### D) Technische Entscheidungen (Begründung)
- **Bestehendes Feld „Abreise“ = tatsächliche Abreise, neues Feld für die geplante:** Belegung richtet sich nach der tatsächlichen Abreise. So bleiben Kalender, Konfliktprüfung, Monatsliste, Indizes und künftige Channex-Sperren ohne Umbau korrekt; nur Preis und Formular müssen die geplante Abreise kennen.
- **Abgerechneter Preis wird gespeichert, nicht nur angezeigt:** Liste, Detail und später Zahlungen und Auswertungen lesen einen fertigen Betrag; Mitarbeiter-Änderungen rechnen serverseitig mit, ohne dass Beträge zum Mitarbeiter gelangen.
- **Vereinbarter Preis bleibt im bisherigen Feld:** Das Formular schreibt und liest weiterhin genau den eingetippten Wert; Zurücksetzen auf das geplante Datum ergibt automatisch wieder den vereinbarten Preis.
- **Buchungsquelle als eigenes Feld neben dem Kanal:** Kanal kommt technisch vom Import, Quelle ist eine Angabe des Vermieters. Getrennt bleiben beide klar; die Kalenderfarbe vereint sie an einer Stelle.
- **Gästeblattnummer ohne Eindeutigkeitsregel, nur Warnung:** Vorgabe der Spec; ein Suchindex genügt für Prüfung und Suche.
- **Getrennte Bestätigung für die Nummer-Warnung:** Übersteuern von Überschneidungen bleibt Inhabern vorbehalten (PROJ-8), die harmlose Nummer-Warnung können beide Rollen bestätigen.
- **Gemeinsamer Sprung-Baustein:** Eine Bedienung für Kalender und Liste; die bestehenden Kalender-E2E-Tests sichern ab, dass sich der Kalender nicht ändert.
- **Rundung:** Ganzzahlige Cent-Rechnung, kaufmännisch gerundet, in Browser und Server nach derselben Regel (Beispiel 333,33 € / 3 × 4 = 444,44 €).

### E) Ausrollen
Eine Migration: neue Spalten mit Standardwerten, Befüllen von „Abreise geplant“ mit der bisherigen Abreise und „abgerechnet“ mit dem vereinbarten Preis, danach Pflicht-Regeln aktivieren; Speicher-, Warn- und Vorschau-Funktion ersetzen. Keine Datenänderung an Belegung oder Preisen bestehender Buchungen. Danach Datenbank-Typen neu erzeugen.

### F) Pakete
Keine neuen Pakete. Genutzt werden vorhandene shadcn/ui-Bausteine (Popover, Select, Checkbox, Input, Label, Button).

### Änderung: Preisregel bei Verlängerung wählbar (Tech Design 2026-10-30)

**Ausgangslage:** Der eingetragene Preis steht im Feld „Nächtigungspreis vereinbart“, daneben speichert die Datenbank den „abgerechneten“ Preis. Diesen bildet die Speicherfunktion der Buchung bei jedem Speichern; heute bei Verlängerung immer anteilig. Formular-Vorschau, Detail, Liste, Gesamtpreis und die Rechnungen je Buchung (PROJ-37) lesen den abgerechneten Preis.

**A) Oberfläche**
```
Buchungsformular (nur Inhaber, Abschnitt Preis)
+-- Nächtigungspreis (wie bisher)
+-- NEU Auswahl „Preis bei Verlängerung“ – nur wenn tatsächliche Abreise nach der geplanten
|   +-- ( ) Preis gilt für den gesamten Aufenthalt   (vorausgewählt)
|   +-- ( ) Anteilig hochrechnen → zeigt sofort den hochgerechneten Betrag und die Nächte
+-- Gesamtpreis (rechnet mit der gewählten Regel)

Buchungsdetail: unverändert (die bestehende Zeile „vereinbart … für N Nächte“ erscheint wie bisher nur, wenn tatsächlich hochgerechnet wurde)
Mitarbeiter: sehen weder Beträge noch die Auswahl
```

**B) Daten**
- **Neue Angabe „Preisregel bei Verlängerung“** an den Beträgen der Buchung: „gesamter Aufenthalt“ oder „anteilig“. Sie liegt bei den übrigen Beträgen, die nur Inhaber lesen dürfen.
- **Neue Buchungen:** „gesamter Aufenthalt“.
- **Bestand:** Buchungen, deren tatsächliche Abreise schon nach der geplanten liegt, bekommen beim Ausrollen „anteilig“. Ihre Beträge bleiben unverändert. Alle übrigen bekommen „gesamter Aufenthalt“; bei ihnen ändert sich nichts, weil die Regel nur bei Verlängerung wirkt.
- **Abgerechneter Preis:** Die Datenbank bildet ihn weiterhin bei jedem Speichern selbst: bei Verlängerung mit „anteilig“ hochgerechnet, sonst der eingetragene Preis.

**C) Abläufe**
- **Inhaber speichert:** Die Wahl wird mitgeschickt und gespeichert, auch wenn gerade keine Verlängerung vorliegt. So greift sie bei einer erneuten Verlängerung wieder.
- **Mitarbeiter speichert:** Die gespeicherte Wahl bleibt unverändert. Ein Wert vom Mitarbeiter wird ignoriert, ungültige Werte werden abgelehnt.
- Die **Vorschau im Formular** nutzt dieselbe Rechenregel wie die Datenbank (Browser und Server gleich, wie bisher).
- **Nicht betroffen:**
  - Zusatzkosten
  - Stornogebühr
  - Ortstaxe-Nächte
  - Preisvorschlag (rechnet weiter für den geplanten Zeitraum)
  - bereits erfasste Rechnungen (Kopie)

**D) Rechte und Sicherheit**
- Die neue Angabe ist nur für Inhaber lesbar und nur über die Speicherfunktion änderbar, wie die übrigen Beträge.
- Die Datenbank prüft den Wert selbst.

**E) Ausrollen:** Eine Migration mit dem neuen Feld samt Voreinstellung und der Befüllung des Bestands. Dazu kommen die angepasste Rechenregel und die angepasste Speicherfunktion. Keine neuen Pakete, keine Umgebungsvariablen.

**F) Tests**
- **Unit:** Rechenregel mit beiden Wahlen; Grenzfälle wie gleiche und frühere Abreise oder Rundung.
- **Datenbank (gegen Dev):** neue Buchung mit Voreinstellung; Verlängerung mit beiden Wahlen; Zurücksetzen und erneutes Verlängern; Mitarbeiter-Verlängerung behält die Wahl; Mitarbeiter-Wert wird ignoriert; ungültiger Wert wird abgelehnt; Bestand nach Migration.
- **E2E:**
  - Auswahl nur bei Verlängerung sichtbar, Vorauswahl
  - Umschalten zeigt sofort den Betrag
  - Detail und Liste nach dem Speichern
  - erneutes Bearbeiten zeigt die gespeicherte Wahl
  - Mitarbeiter ohne Auswahl
  - Layout und axe
- **Regression:** PROJ-8/27/32/35 (Preise, Zusatzkosten, USt), PROJ-37 (Gesamtpreis im Rechnungsabschnitt)

**Umfang:** Frontend (Auswahl, Vorschau) und Backend (Migration, Speicherfunktion).

### Umsetzung Frontend: Preisregel bei Verlängerung (2026-10-30)
- **Regeln** `src/lib/bookings.ts`: `EXTENSION_PRICING` (`total` = gesamter Aufenthalt, `prorated` = anteilig), `BookingAmounts.extensionPricing`. `billedNightsCents(…, pricing)` liefert bei `total` immer den eingetragenen Preis. Unit-Tests für beide Regeln in `bookings.test.ts`.
- **Prüfschema** `src/lib/validation/bookings.ts`: Feld `extensionPricing` (nur die beiden Werte), wird mit den Beträgen übergeben. Test in `validation/bookings.test.ts`.
- **Formular** `booking-panel.tsx`: Auswahl „Preis bei Verlängerung“ (RadioGroup, gleiches Muster wie „Art“) unter Nächtigungspreis und USt-Satz, nur bei tatsächlicher Abreise nach der geplanten. Vorausgewählt ist bei neuen Buchungen „Preis gilt für den gesamten Aufenthalt“, beim Bearbeiten die gespeicherte Wahl. Gesamtpreis und Hinweis „Verlängert: vereinbart … abzurechnen …“ folgen der Wahl; der Hinweis erscheint nur bei „anteilig“. Der Preisbereich ist weiterhin nur für Inhaber sichtbar.
- **Server-Aktion** `saveBooking`: übergibt `nights_extension_pricing` in den Beträgen (Inhaber). Mitarbeiter schicken wie bisher keine Beträge.
- **Lesen** `getBooking`: liest `booking_amounts.nights_extension_pricing` (Inhaber); fehlt der Wert, gilt `total`.
- **Buchungsdetail:** unverändert (die bestehende Zeile „vereinbart … für N Nächte“ erscheint nur, wenn der abgerechnete vom eingetragenen Preis abweicht, also bei „anteilig“).
- **Texte** `messages/de.json`: `bookings.panel.extensionPricing`, `bookings.panel.extensionPricingOption.total|prorated`.
- **Typen** `src/types/database.ts` von Hand ergänzt (`booking_amounts.nights_extension_pricing`); `/backend` erzeugt sie neu.
- **Offen für /backend:**
  - Spalte `booking_amounts.nights_extension_pricing` (`total`/`prorated`, Standard `total`, Prüfregel); Bestand mit `departure > planned_departure` → `prorated`
  - `private.billed_nights_cents` bzw. `refresh_billed_nights` mit der Regel
  - `save_booking` übernimmt `amounts.nights_extension_pricing` nur vom Inhaber (ungültig → 22023); Mitarbeiter-Speichern lässt den Wert unverändert
  - Integrationstests
  - **Bis zur Migration** schlagen Buchungsdetail und „Bearbeiten“ in Dev beim Laden fehl (Spalte fehlt).

## Implementation Notes (Frontend)
**Stand 2026-10-27.** Die Oberfläche ist fertig. **Ohne die Migration aus `/backend` schlagen Buchungsliste, Buchungs-Detail, Gast-Detail und Kalender beim Laden fehl**, weil sie die neuen Spalten abfragen (wie bei PROJ-28/29).

**Daten und Regeln**
- Spalten `bookings`: `planned_departure` (Abreise geplant), `departure` (bleibt, = tatsächliche Abreise), `guest_sheet_number`, `residence_registered`, `source`, `source_custom`; `booking_amounts.billed_nights_cents`. `src/types/database.ts` von Hand ergänzt (inkl. `p_guest_sheet_number` in `booking_warnings`); `/backend` erzeugt die Typen neu.
- `src/lib/bookings.ts`: `BOOKING_SOURCES`, `billableNights` (bis zur späteren Abreise), `taxNights` (bis zur tatsächlichen, für PROJ-16), `billedNightsCents` (anteilig, kaufmännisch auf Cent), `guestSheetKey` (Groß/Klein, Rand-Leerzeichen egal), Filter `quelle` in der Adresse (`booking-com`, `google-ads`, `empfehlung`, `plattform-suche`, `eigene`, `keine` …). Der Quellen-Filter blendet Sperren immer aus.
- `src/lib/validation/bookings.ts`: geplante und tatsächliche Abreise je nach der Anreise und höchstens 365 Nächte; Gästeblattnummer höchstens 30 Zeichen, leer → null; Quelle Pflicht mit Standard `none`; Freitext Pflicht bei `custom` (≤ 100), sonst verworfen; „Wohnsitz angemeldet“ als ja/nein.

**Oberfläche**
- Buchungsformular: Anreise → Abreise geplant → Abreise (Abreise läuft mit, bis sie von Hand geändert wird; beim Bearbeiten nur, wenn beide gleich sind). Buchungsquelle (Auswahl + „Eigene Quelle“), Abschnitt „Meldung“ mit Gästeblattnummer und „Wohnsitz angemeldet“. Preisvorschlag rechnet mit den geplanten Nächten. Bei Verlängerung Hinweis „vereinbart X für N Nächte, abzurechnen M Nächte: Y“, bei früherer Abreise Hinweis auf den vollen Zeitraum; der Endbetrag nutzt den abgerechneten Preis.
- Warnung „Gästeblattnummer bereits vergeben“ (`GuestSheetWarning`) mit eigener Bestätigung für Inhaber **und** Mitarbeiter; Überschneidungen bleiben Inhabern vorbehalten.
- Buchungs-Detail: „Abreise geplant“ nur bei Abweichung; Nächte mit „abgerechnet M Nächte“ bei Abweichung; Buchungsquelle (bei „Eigene Angabe“ der Freitext), Gästeblattnummer, „Wohnsitz angemeldet (keine Ortstaxe)“. Preis: abgerechneter Übernachtungspreis, darunter der vereinbarte bei Hochrechnung.
- Buchungsliste: Gästeblattnummer neben der Buchungsnummer („Gästeblatt A-123“); Suche findet die Gästeblattnummer; neuer Filter „Quelle“.
- Monatsauswahl: gemeinsamer Baustein `src/components/date-jump.tsx` (shadcn Popover). Buchungsübersicht: vorbelegt mit dem 1. des Monats, Sprung behält alle Filter. Der Belegungskalender nutzt denselben Baustein ohne Vorbelegung (Verhalten unverändert).
- Kalender: Farbregel `colorChannel` in `entry-style.ts`: Quelle booking.com → Accent-700 (Option: Rahmen Accent-700); Legende „booking.com“.
- Mitreisende: Reihenfolge Nachname, Vorname; nach „Person hinzufügen“ steht der Fokus im Vornamen (Nachname ist vorbelegt).

**Server-Aktionen**
- `saveBooking` übergibt `planned_departure`, `departure`, `guest_sheet_number`, `confirm_guest_sheet_number`, `residence_registered`, `source`, `source_custom` und den vereinbarten Preis. Liefert die Datenbank nur die Gästeblatt-Warnung, lautet der Fehler `guestSheetDuplicate` (für alle bestätigbar).
- `checkBookingWarnings` übergibt `p_guest_sheet_number` und liest `guest_sheet_duplicates`.

**Offen für /backend** (erledigt, siehe Implementation Notes (Backend))
- Migration: Spalten mit Prüfregeln (Abreise geplant nach Anreise, ≤ 365 Nächte; Nummer ≤ 30 Zeichen, getrimmt, nicht leer; Quelle-Werte; Freitext genau bei `custom`, ≤ 100; Sperren: geplant = tatsächlich, Quelle `none`, keine Nummer, Häkchen aus). Befüllen: `planned_departure = departure`, `billed_nights_cents = nights_cents`. Index auf `(tenant_id, lower(guest_sheet_number))`.
- `save_booking`: neue Felder; `billed_nights_cents` für Inhaber und Mitarbeiter berechnen; Vorschlag mit geplanten Nächten; „Preis prüfen“ nur bei Änderung von Anreise, geplanter Abreise, Wohnung bzw. Personen (Personenpreis); Gästeblatt-Doppelung als Warnung `guest_sheet_duplicates`, übergehbar mit `confirm_guest_sheet_number` (alle Mitglieder), Überschneidung weiter nur Inhaber.
- `save_block`: geplante = tatsächliche Abreise setzen. `public.booking_warnings`/`private.booking_warnings_for`: Parameter `p_guest_sheet_number`, Ergebnis `guest_sheet_duplicates` (`id, kind, number, guest_name, cancelled`, nur eigenes Konto, auch storniert, ohne die eigene Buchung).
- Bestehende E2E-Tests (PROJ-8, PROJ-9, PROJ-27, PROJ-29) füllen „Abreise“ als einziges Abreisefeld bzw. nutzen `getByLabel('Abreise')` ohne `exact`: in `/qa` auf „Abreise geplant“ umstellen.

## Implementation Notes (Backend)
**Stand 2026-10-27.** Migration `supabase/migrations/20261027063426_booking_extension.sql`, auf Dev („apppa-dev“) angewendet; Typen neu erzeugt (identisch mit der Handfassung). Advisors: nur die bekannten Auth-Hinweise (OTP-Laufzeit, Leaked-Password-Schutz), nichts aus der Migration.

**Schema**
- `bookings`: `planned_departure` (Pflicht, nach Anreise, ≤ 365 Nächte), `guest_sheet_number` (getrimmt, 1–30 Zeichen oder leer), `residence_registered` (Standard nein), `source` (feste Werte, Standard `none`), `source_custom` (getrimmt, 1–100, genau bei `custom`). Regel für Sperren: geplante = tatsächliche Abreise, Quelle `none`, keine Nummer, Häkchen aus. Bestand: `planned_departure = departure`.
- Trigger `bookings_departure_defaults`: Sperren und Einträge ohne geplante Abreise erhalten die tatsächliche (auch bei direktem Schreiben, z. B. späterer Import).
- Index `bookings_guest_sheet_idx` auf `(tenant_id, lower(guest_sheet_number))`.
- `booking_amounts.billed_nights_cents` (0–100.000.000), Bestand = `nights_cents`; neue Zeilen starten mit dem vereinbarten Preis (Trigger).

**Funktionen**
- `private.billed_nights_cents` (anteilig, `round(numeric)`; über dem Höchstbetrag Fehler `P0809` → Meldung `billedTooHigh`) und `private.refresh_billed_nights` (nach jedem `save_booking`, für Inhaber und Mitarbeiter).
- `private.guest_sheet_duplicates`: andere Buchungen/Optionen des Kunden mit derselben Nummer (Groß/Klein egal, auch storniert). **Abweichung zum Design:** Trägt die bearbeitete Buchung die Nummer bereits, gibt es keine erneute Warnung (sonst müsste man bei jeder Änderung neu bestätigen).
- `booking_warnings` (public/private) mit neuem Parameter `p_guest_sheet_number`; Ergebnis zusätzlich `guest_sheet_duplicates`. Alte Signatur entfernt.
- `save_booking`: neue Felder; Pflichtfeld `planned_departure` (fehlt es → `P0807`); Freitext nur bei `custom`; Vorschlag und „Preis prüfen“ mit der geplanten Abreise; Gästeblatt-Warnung mit eigener Bestätigung `confirm_guest_sheet_number` (alle Mitglieder), Überschneidungen weiter nur Inhaber. `save_block` und `confirm_option` unverändert (Trigger bzw. keine Datumsänderung).

**Tests** (`supabase/tests/bookings.integration.test.ts`, Block „Buchungs-Erweiterung (PROJ-30)“): Bestand und Standardwerte, Pflicht der geplanten Abreise, Verlängerung 500 € → 600 € und zurück, frühere Abreise gibt frei, erneute Verlängerung warnt, Rundung 333,33 € → 444,44 €, Zusatzkosten unverändert, Mitarbeiter-Verlängerung ohne „Preis prüfen“ und ohne Beträge, Planänderung setzt „Preis prüfen“, Gästeblatt-Doppelung (Schreibweise, fremdes Konto, storniert, Bestätigung durch Mitarbeiter, Vorschau, unveränderte Nummer, 31 Zeichen), Quelle/Freitext/Häkchen, ungültige Werte, Option → Buchung, Sperren. 43 Tests in Buchungs- und Reisedokument-Suite grün.

## QA Test Results

**Tested:** 2026-10-27
**App URL:** http://localhost:3000 (Produktions-Build, `npm run start`) gegen Supabase „apppa-dev“
**Tester:** QA Engineer (AI)
**Automatisiert:** `tests/PROJ-30-buchungs-erweiterung.spec.ts` (8 Tests desktop, Layout zusätzlich mobil), Integrationstests `supabase/tests/bookings.integration.test.ts` (Block PROJ-30), Unit-Tests `src/lib/bookings.test.ts`, `src/lib/validation/bookings.test.ts`

### Acceptance Criteria Status

#### Mitreisende (2/2)
- [x] Nachname vor Vorname (Desktop links, Handy oben); Fokus springt nach „Person hinzufügen“ in den Vornamen
- [x] Bei 5 Personen höchstens 4 Mitreisende

#### Gästeblattnummer (9/9)
- [x] Optionales Feld bei Buchung und Option, nicht bei Sperren
- [x] Mehr als 30 Zeichen: Fehlermeldung, nichts gespeichert (Browser und Datenbank)
- [x] Doppelung im eigenen Konto warnt mit der anderen Buchung, „Trotzdem speichern“ (auch Mitarbeiter)
- [x] Gleiche Nummer nur in einem anderen Konto: keine Warnung (Integrationstest)
- [x] Stornierte Buchung mit der Nummer: Warnung, als „storniert“ gekennzeichnet
- [x] Nummer im Detail und in der Liste sichtbar; Suche nach „A-123“ findet die Buchung

#### Abreise geplant / Abreise (10/10)
- [x] Reihenfolge Anreise → Abreise geplant → Abreise
- [x] Abreise läuft mit, bis sie von Hand geändert wird; danach bleibt sie fest
- [x] Abreise bzw. geplante Abreise am/vor der Anreise: je eigene Fehlermeldung
- [x] Frühere Abreise gibt die Wohnung im Kalender frei; spätere Abreise löst die Überschneidungswarnung aus
- [x] Bestand: beide Felder mit dem bisherigen Datum
- [x] Detail: ein Datum bei Gleichheit, beide bei Abweichung
- [x] Option → Buchung behält beide Abreisen (Integrationstest)

#### Preis bei Verlängerung und früherer Abreise (7/7)
- [x] 500 € / 5 Nächte, 1 Tag länger → 600 €; 2 Tage früher → 500 €; zurück auf geplant → 500 €
- [x] Formular zeigt vereinbarten Preis, abzurechnende Nächte und hochgerechneten Preis
- [x] Zusatzkosten bleiben unverändert
- [x] Mitarbeiter verlängert: Preis wird hochgerechnet, Mitarbeiter sieht keine Beträge, kein „Preis prüfen“
- [x] Rundung 333,33 € / 3 Nächte, 1 Nacht länger → 444,44 €

#### Wohnsitz angemeldet (4/4)
- [x] Standard nicht angehakt (neu und Bestand); Hinweis im Detail; Inhaber und Mitarbeiter können es setzen

#### Buchungsquelle (11/11)
- [x] Standard „Keine Angabe“; Liste mit allen 9 Werten in der Spec-Reihenfolge
- [x] „Eigene Angabe“ ohne Freitext: Fehlermeldung; Wechsel verwirft den Freitext
- [x] booking.com: Balken Accent-700 (rgb 0,103,134) mit weißer Schrift, Option mit Rahmen Accent-700, andere Quellen „Direkt“; Legende mit „booking.com“ (Dashboard und Vollbild)
- [x] Detail zeigt Quelle bzw. Freitext; Filter „Quelle“ in der Adresse (`quelle=booking-com`); Bestand „Keine Angabe“; Marketing-Quelle des Gastes ohne Einfluss

#### Monatsauswahl (9/9)
- [x] Klick auf die Monatsanzeige öffnet „Springen zu“, vorbelegt mit dem 1.; Sprung nach März 2027, Feld schließt sich
- [x] Leeres Datum: Knopf deaktiviert; Escape schließt ohne Monatswechsel
- [x] Tastatur: Enter öffnet, Fokus im Datumsfeld, Enter springt
- [x] Filter (Wohnung, Quelle) bleiben erhalten; bei aktiver Suche keine Monatsleiste
- [x] 375 px: Feld passt ohne seitliches Scrollen
- [x] Belegungskalender unverändert (alle PROJ-9-Tests grün)

### Edge Cases Status
- [x] Beide Abreisen gleichzeitig geändert: gespeicherte Werte gelten
- [x] Verlängerung mit Konflikt: Warnung, Mitarbeiter blockiert, Inhaber übersteuert
- [x] Frühere Abreise, neue Buchung in der Lücke, danach wieder verlängert: Warnung (Integrationstest)
- [x] Stornierte Buchung behält alle Angaben, Nummer zählt weiter für die Warnung
- [x] Nummer nur aus Leerzeichen → leer; Groß/Klein gilt als gleich
- [x] Gleichzeitige Bearbeitung: Hinweis „inzwischen geändert“ (PROJ-8-Test grün)
- [x] Zusätzlich: erneutes Speichern mit unveränderter Nummer warnt nicht erneut (bewusste Entscheidung im Backend)
- [x] BUG-1 (behoben): Gästeblattnummern mit Schrägstrich oder Punkt werden über die Suche gefunden

### Security Audit Results
- [x] Mandantentrennung: Doppelungsprüfung und Vorschau nur nach `is_member`; `p_exclude` einer fremden Buchung verrät nichts (Abfrage mit Kundenkennung)
- [x] Beträge: `billed_nights_cents` nur für Inhaber lesbar (RLS), für Mitarbeiter auch nicht über eingebettete Abfragen; Clients können den abgerechneten Preis nicht setzen (nur `save_booking` rechnet)
- [x] Direktes Schreiben: Prüfregeln greifen auch bei Systemrechten (Sperre mit Quelle abgelehnt, ungültige Quelle/Nummer → 23514)
- [x] XSS: Freitext und Nummer werden als Text ausgegeben (React)
- [x] Suche: Filterwerte für PostgREST weiterhin auf Buchstaben, Ziffern, Leerzeichen und Bindestrich beschränkt (keine Filter-Injektion)
- [x] Hilfsfunktionen im Schema `private` ohne Ausführungsrecht für `authenticated`

### Regression
- [x] PROJ-8 (27 Tests desktop, Layout mobil), PROJ-9 (26 desktop, Layout mobil), PROJ-27 (Buchung/Mitarbeiter, 8), PROJ-29 (Rollen/Titel, 7): grün, nach Umstellung der Tests von „Abreise“ auf „Abreise geplant“
- [x] Integrationstests Buchungen und Reisedokumente: 43 grün; Unit-Tests: 295 grün; Build und Lint ohne Fehler

### Nicht geprüft
- Firefox und Safari: Die Playwright-Projekte laufen nur in Chrome (Desktop/Tablet/Handy-Breiten); bitte beim Staging-Test kurz in Safari prüfen (Datumsfeld im Popover, bekannter Safari-Zeilenklick in der Buchungsliste aus PROJ-8)

### Bugs Found

#### BUG-1: Gästeblattnummer mit „/“ oder „.“ nicht über die Suche auffindbar — behoben 2026-10-27
- **Severity:** Low
- **Fix:** Eigene Bereinigung für die Nummernsuche (`cleanSheetQuery` in `src/lib/bookings-data.ts`, erlaubt zusätzlich „/“, „.“, „_“; Wert in der Abfrage in Anführungszeichen). E2E-Test sucht „gb/2026.17“.
- **Steps to Reproduce:**
  1. Buchung mit Gästeblattnummer „GB/2026.17“ speichern
  2. In der Buchungsliste nach „GB/2026.17“ suchen
  3. Expected: die Buchung wird gefunden
  4. Actual: kein Treffer. Die Suche ersetzt Sonderzeichen durch Leerzeichen („GB 2026 17“), die Nummer enthält aber keine Leerzeichen
- **Priority:** Nice to have (Nummern mit Bindestrich wie „A-123“ funktionieren)

#### BUG-2: Knopf-Beschriftung weicht vom Belegungskalender ab — behoben 2026-10-27
- **Severity:** Low
- **Fix:** Entscheidung des Nutzers: überall „Anzeigen“ (wie im Kalender); Buchungsübersicht angepasst, Spec-Text entsprechend.
- **Steps to Reproduce:**
  1. Belegungskalender: Zeitraum anklicken → Knopf heißt „Anzeigen“
  2. Buchungsübersicht: Monat anklicken → Knopf heißt „Springen“
  3. Expected: „wie im Belegungskalender“ (Spec); die Spec nennt aber ausdrücklich „Springen“ und verlangt einen unveränderten Kalender
  4. Actual: zwei Beschriftungen für dieselbe Bedienung
- **Priority:** Nice to have (Produktentscheidung: Kalender angleichen oder Liste auf „Anzeigen“)

#### Hinweis (kein Bug): Kanal und Quelle im Detail
Das Detail zeigt weiterhin „Kanal: Direkt“ und darunter „Buchungsquelle: booking.com“. Fachlich richtig (Kanal kommt mit PROJ-11), kann aber verwirren.

### Summary
- **Acceptance Criteria:** 52/52 passed
- **Bugs Found:** 2 total (0 critical, 0 high, 0 medium, 2 low), beide behoben
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment
_Stand 2026-10-27 (/deploy, Tag `v1.7.0`)_

- **Staging:** https://staging.apppa.at (Vercel `apppa-staging`, Supabase `iikzjqjjxoznrkkixfqa`); der Nutzer hat die Auslieferung nach Production freigegeben. Rückmeldung zum Build-Status „Ready“ und zur Safari-Prüfung lag nicht einzeln vor
- **Production:** https://app.apppa.at (Vercel `apppa`, Supabase `ahclrqbhfpidxjzbpfgb`), Commit `20d23c8`, 2026-10-27
- **Migration** in Staging und Production eingespielt: `20261027063426_booking_extension.sql` (Abreise geplant, Gästeblattnummer, Wohnsitz, Buchungsquelle, abgerechneter Preis, Funktionen)
- **Advisors:** kein Befund zur Datenbank. Nur bekannte Auth-Hinweise (Staging: Gültigkeit der Mail-Links, Passwort-Leak-Prüfung; Production: Gültigkeit der Mail-Links)
- Keine neuen Umgebungsvariablen, kein `config push`
