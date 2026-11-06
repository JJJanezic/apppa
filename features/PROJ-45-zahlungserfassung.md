# PROJ-45: Zahlungserfassung

## Status: Planned
**Created:** 2026-11-06
**Last Updated:** 2026-11-06

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen): Inhaber und Mitarbeiter, Mandantentrennung
- Requires: PROJ-8 (Manuelle Buchungen): Buchungsdetail, Anreise als Bezug der Fälligkeit
- Requires: PROJ-30 (Buchungs-Erweiterung): Buchungsquelle booking.com; wird um „Airbnb“ ergänzt (siehe Provisionsabzug)
- Requires: PROJ-29 (Reisedokument): Umwandlung von Handyfotos (HEIC usw.) in JPEG, auch für Belege
- Requires: PROJ-37 (Rechnungen nacherfassen): Rechnungsliste, Rechnungsdetail, Abschnitt „Rechnungen“ im Buchungsdetail, Formular „Rechnung nacherfassen“, Löschen nacherfasster Rechnungen
- Requires: PROJ-39 (Einstellungen → Rechnungen): Zahlungsregeln (Anzahlung %/Frist, Fälligkeit) je Baustein
- Requires: PROJ-40 / PROJ-42 (Entwurf, Ausstellen): Zahlungsregeln und Rechnungsbetrag (Schlussrechnung nach Abzug) an der ausgestellten Rechnung
- Requires: PROJ-44 (Rechnungsstorno): Gutschrift zu Rechnung, Status „storniert“
- Wird genutzt von: PROJ-43 (Rechnungsübersicht: Filter nach Zahlungsstatus), PROJ-14 (Dashboard: offene Zahlungen), PROJ-13 (Zahlungen aus Channex), PROJ-18 (Auswertungen), PROJ-25 (Bankabgleich)

## Überblick
Der Inhaber und seine Mitarbeiter erfassen eingegangene Zahlungen von Hand und ordnen jede **genau einer Rechnung** zu. Die Buchung ergibt sich aus der Rechnung. Daraus entsteht je Rechnung ein **Zahlungsstatus** und ein **Offen-Betrag**; bei App-Rechnungen zusätzlich die **Fälligkeit** samt „überfällig“. Die App wickelt keine Zahlungen ab (PRD), sie hält nur fest, was eingegangen ist.

### Zahlung
| Feld | Pflicht | Regeln |
|------|---------|--------|
| Rechnung | ja | genau eine; aus dem Rechnungsdetail fest, aus dem Buchungsdetail Auswahl unter den zahlbaren Rechnungen der Buchung |
| Zahlungsdatum | ja | vorbelegt mit heute; nicht in der Zukunft; darf vor dem Rechnungsdatum liegen (Vorauszahlung) |
| Betrag (bei Plattform-Buchungen „Ausbezahlt“) | ja | €, zwei Nachkommastellen, größer als 0; tatsächlich eingegangenes Geld; vorbelegt mit dem Offen-Betrag minus eingetragener Provision und Zahlungsgebühr (bei „bezahlt“/„überzahlt“ leer) |
| Provision | nein, nur bei Plattform-Buchungen | €, zwei Nachkommastellen, ≥ 0; von booking.com/Airbnb einbehalten |
| Zahlungsgebühr | nein, nur bei Plattform-Buchungen | €, zwei Nachkommastellen, ≥ 0; z. B. Gebühr von „Payments by Booking.com“ |
| Zahlungsart | ja | Auswahl aus den aktiven Zahlungsarten des Kunden (Einstellungen → Zahlungen); vorbelegt mit der Standard-Zahlungsart |
| Notiz | nein | Freitext, höchstens 300 Zeichen (z. B. Verwendungszweck) |
| Beleg | nein | höchstens eine Datei: PDF bis 10 MB (unverändert) oder Bild (JPEG, PNG, HEIC/HEIF, WebP), verkleinert und als JPEG gespeichert wie beim Reisedokument (PROJ-29); am Handy direkt fotografieren; privat je Kunde |

- Eine Sammelüberweisung für mehrere Rechnungen wird als **je Rechnung eine Zahlung** erfasst.
- **Beglichen** je Zahlung = Betrag + Provision + Zahlungsgebühr.
- Wer und wann erfasst hat, wird festgehalten und im Detail angezeigt („erfasst von Maria Huber am Fr, 06.11.2026“).

### Provisionsabzug (Plattform-Buchungen)
Zahlen booking.com oder Airbnb aus, fehlen Provision und Gebühren am Konto. Die Rechnung an den Gast bleibt unverändert (die Umsatzsteuer fällt auf den vollen Betrag an); Provision und Zahlungsgebühr verringern nur den **Offen-Betrag**.
- **Plattform-Buchung** = Buchungsquelle „booking.com“ oder „Airbnb“; nach dem Import (PROJ-11) zusätzlich Kanal booking.com bzw. Airbnb.
- Die Felder „Provision“ und „Zahlungsgebühr“ erscheinen nur bei Zahlungen an Rechnungen, die mit einer Plattform-Buchung verknüpft sind. Rechnungen ohne Buchung und andere Buchungsquellen: keine Felder.
- Beim Eintragen von Provision oder Gebühr sinkt der Vorschlag für „Ausbezahlt“ entsprechend, solange der Nutzer den Betrag nicht selbst geändert hat.
- Anzeige: „€ 425,00 + Provision € 70,00 + Gebühr € 5,00“; ohne Abzüge nur der Betrag.
- Zahlt der Gast direkt an den Vermieter und die Plattform verrechnet die Provision später gesondert, ist das eine Eingangsrechnung der Plattform und **kein** Abzug an der Gästerechnung; die Zahlung wird dann ohne Provision erfasst.
- **Buchungsquelle „Airbnb“ (Ergänzung an PROJ-30):** Die Auswahl der Buchungsquelle bekommt den Wert „Airbnb“ hinter „booking.com“, auch im Filter der Buchungsübersicht. Keine eigene Kalenderfarbe (wie bisher entschieden).
- **Buchungsquelle ändert sich später** von booking.com/Airbnb auf eine andere: Bereits erfasste Provisionen bleiben und zählen weiter; beim Bearbeiten bleiben die Felder sichtbar, solange ein Wert > 0 eingetragen ist.
- **Umhängen** einer Zahlung mit Provision oder Gebühr ist nur auf Rechnungen einer Plattform-Buchung möglich; sonst Hinweis „Provision und Zahlungsgebühr sind nur bei Buchungen über booking.com oder Airbnb möglich. Bitte zuerst auf 0 setzen.“

### Zahlbare Rechnungen
- **Ausgestellte App-Rechnungen** (Rechnung, Teilrechnung, Schlussrechnung), solange nicht storniert.
- **Nacherfasste Rechnungen** mit Betrag größer als 0.
- **Nicht zahlbar:** Entwürfe; stornierte Rechnungen (neue Zahlungen nicht möglich, vorhandene bleiben); nacherfasste Rechnungen mit Betrag ≤ 0 (kein Status, Anzeige „–“).
- **Gutschriften zu Rechnung** (PROJ-44) nehmen keine Zahlungen, sondern **Rückzahlungen** an (siehe Storno).
- Maßgeblich ist der **Rechnungsbetrag**, bei der Schlussrechnung also der Betrag nach Abzug der Teilrechnungen.

### Zahlungsstatus je Rechnung
Bezahlt (beglichen) = Summe aller Zahlungen einschließlich Provision und Zahlungsgebühr; Offen = Rechnungsbetrag − Bezahlt. Wo Abzüge vorkommen, zeigt das Rechnungsdetail getrennt „Eingegangen“, „Provision“, „Zahlungsgebühr“ und „Beglichen“.

| Status | Bedingung |
|--------|-----------|
| offen | keine Zahlung |
| teilweise | Bezahlt > 0 und kleiner als der Rechnungsbetrag |
| bezahlt | Bezahlt = Rechnungsbetrag |
| überzahlt | Bezahlt > Rechnungsbetrag; Hinweis beim Speichern („Damit ist die Rechnung um € … überzahlt“), keine Sperre |

### Fälligkeit (nur App-Rechnungen)
- Aus den Zahlungsregeln der ausgestellten Rechnung (PROJ-39/40): ohne Anzahlung **„fällig am …“** für den Rechnungsbetrag; mit Anzahlung **„Anzahlung € … fällig am …“** und **„Rest € … fällig am …“**. Bezug „Tage vor Anreise“ rechnet von der Anreise der Buchung zum Zeitpunkt des Ausstellens.
- **Überfällig** (rot) ist eine Rechnung, wenn heute nach einem Fälligkeitstag liegt und weniger bezahlt ist, als bis dahin fällig war (Anzahlung bzw. Anzahlung + Rest). Überfällig ist ein Zusatz zum Status („teilweise · überfällig“), kein eigener Status.
- Nacherfasste Rechnungen haben keine Fälligkeit und sind nie überfällig.

### Storno, Umhängen und Rückzahlung
- Wird eine Rechnung mit Zahlungen storniert, **bleiben die Zahlungen an der stornierten Rechnung**. Ihr **Guthaben** = tatsächlich eingegangene Beträge (ohne Provision und Zahlungsgebühr) − Rückzahlungen an der zugehörigen Gutschrift.
- **Umhängen:** Der Inhaber kann jede Zahlung über „Bearbeiten“ einer anderen zahlbaren Rechnung des Kunden zuordnen (Rechnungen derselben Buchung zuerst). Typisch: Zahlung von der stornierten auf die neue, korrigierte Rechnung. Gilt auch zum Berichtigen einer falsch zugeordneten Zahlung.
- **Rückzahlung:** An der Gutschrift erfasst der Inhaber „Rückzahlung erfassen“ (Datum, Betrag > 0, Zahlungsart, Notiz, Beleg; vorbelegt mit dem Guthaben; ohne Provision und Zahlungsgebühr). Rückzahlungen erscheinen überall mit Minus und rot („-€ 50,00“). Mehr als das Guthaben zurückzuzahlen ist mit Hinweis erlaubt.
- Anzeige: Rechnung „storniert · Guthaben € …“ und Gutschrift „Rückzahlung offen € …“, solange das Guthaben > 0; bei 0 nur „storniert“ bzw. „erstattet“ (wenn es Rückzahlungen gab) oder „–“ (wenn nie bezahlt wurde).

### Orte in der App
- **Rechnungsdetail:** Abschnitt „Zahlungen“ (bzw. „Rückzahlungen“ bei Gutschriften): Liste (Datum, Art, Betrag samt Provision/Gebühr, Notiz, Beleg-Symbol, erfasst von), darunter Rechnungsbetrag, Bezahlt, Offen, Status, Fälligkeit; Knopf „Zahlung erfassen“; je Zahlung „Bearbeiten“/„Löschen“ (Inhaber).
- **Buchungsdetail:** im bestehenden Abschnitt „Rechnungen“ je Rechnung Status und Offen-Betrag; darunter zusätzlich „Bezahlt: € …“ und „Offen: € …“ über alle nicht stornierten Rechnungen der Buchung; Knopf „Zahlung erfassen“ mit Auswahl der Rechnung (vorausgewählt, wenn nur eine zahlbar ist; ohne zahlbare Rechnung kein Knopf).
- **Rechnungsliste:** neue Spalte „Zahlung“ mit Status (und „überfällig“) je Rechnung; Filter nach Zahlungsstatus kommt mit PROJ-43.
- **Menüpunkt „Zahlungen“** zwischen „Rechnungen“ und „Einstellungen“ (Inhaber und Mitarbeiter): Liste aller Zahlungen und Rückzahlungen mit Datum, Rechnung (Link), Empfänger, Buchung (Link oder „–“), Zahlungsart, Betrag, Provision, Zahlungsgebühr, Beleg-Symbol; Filter Zeitraum (Monat mit Sprungauswahl wie in der Buchungsübersicht, „Alle Monate“), Zahlungsart, Suche (Rechnungsnummer, Empfänger, Notiz); Summen der gefilterten Beträge (eingegangen, Provision, Zahlungsgebühr); sortiert nach Datum absteigend, je 50 pro Seite. Erfasst wird nicht hier, sondern aus Rechnung oder Buchung.

### Einstellungen → Zahlungen
- Neuer Reiter „Zahlungen“ hinter „Rechnungen“, nur für Inhaber.
- Neue und bestehende Kunden starten mit: **Überweisung** (Standard), **Bar**, **Karte**, **PayPal**, **über booking.com**, **über Airbnb**.
- Inhaber kann Zahlungsarten anlegen, umbenennen, ordnen (Reihenfolge = Reihenfolge in der Auswahl), eine als **Standard** markieren und **deaktivieren**/wieder aktivieren. Name Pflicht, höchstens 50 Zeichen, je Kunde eindeutig (ohne Groß-/Kleinschreibung).
- Deaktivierte Arten sind nicht mehr wählbar, stehen aber weiter an alten Zahlungen. **Löschen** nur, solange keine Zahlung sie verwendet.
- Mindestens eine aktive Zahlungsart muss bleiben; die Standard-Art kann nicht deaktiviert werden, ohne vorher eine andere als Standard zu wählen.
- Umbenennen wirkt auch auf die Anzeige alter Zahlungen.

### Nacherfassen mit „Bereits bezahlt“
- Das Formular „Rechnung nacherfassen“ (PROJ-37) bekommt optional **„Bereits bezahlt“** mit Zahlungsdatum (vorbelegt Rechnungsdatum) und Zahlungsart. Ist eine Plattform-Buchung verknüpft, stehen zusätzlich Provision und Zahlungsgebühr zur Wahl. Beim Speichern entsteht eine Zahlung, die den vollen Rechnungsbetrag begleicht (Betrag = Rechnungsbetrag − Provision − Zahlungsgebühr). Nur beim Anlegen und nur bei Betrag > 0.
- Bestehende Altrechnungen ohne Zahlung gelten als „offen“, bis eine Zahlung erfasst wird.

### Wer darf was
| | Inhaber | Mitarbeiter | Betreiber |
|---|---|---|---|
| Zahlungen, Status, Fälligkeit, Zahlungsliste sehen | ja | ja | nein |
| Zahlung bzw. Rückzahlung erfassen (mit Beleg) | ja | ja | nein |
| Zahlung bearbeiten, umhängen, Beleg ersetzen/entfernen, löschen | ja | nein | nein |
| Einstellungen → Zahlungen | ja | nein | nein |

## User Stories
- Als **Inhaber** möchte ich eine eingegangene Überweisung mit Datum, Betrag und Zahlungsart an der Rechnung erfassen, damit ich sehe, welche Rechnungen bezahlt sind.
- Als **Mitarbeiter** möchte ich bei der Schlüsselübergabe eine Barzahlung samt Foto der Quittung erfassen, damit der Inhaber sie nicht nachtragen muss.
- Als **Inhaber** möchte ich je Rechnung den Status offen/teilweise/bezahlt/überzahlt und den Offen-Betrag sehen, damit ich weiß, wem ich nachgehen muss.
- Als **Inhaber** möchte ich sehen, ob eine Anzahlung oder der Rest überfällig ist, damit ich rechtzeitig mahne.
- Als **Inhaber** möchte ich nach dem Storno die Zahlung auf die neue, korrigierte Rechnung umhängen oder eine Rückzahlung an den Gast erfassen, damit Rechnung und Geld zusammenpassen.
- Als **Inhaber** möchte ich bei einer Auszahlung von booking.com oder Airbnb Provision und Zahlungsgebühr angeben, damit die Rechnung trotz geringerem Geldeingang als bezahlt gilt und ich die Provisionen später auswerten kann.
- Als **Inhaber** möchte ich alle Zahlungen eines Monats mit Summe sehen, damit ich sie mit meinem Konto vergleichen kann.
- Als **Inhaber** möchte ich die Liste der Zahlungsarten selbst festlegen, damit sie zu meinem Betrieb passt.
- Als **Inhaber** möchte ich beim Nacherfassen einer Altrechnung gleich „bereits bezahlt“ angeben, damit alte Rechnungen nicht als offen erscheinen.

## Out of Scope
- Zahlungsabwicklung, Zahlungslinks, Online-Zahlung (Non-Goal; PROJ-24)
- Zahlungen aus Channex/booking.com/Airbnb übernehmen, Zahlungen ohne Rechnung an der Buchung (PROJ-13)
- Bankabgleich, Kontoauszug-Import, automatische Zuordnung (PROJ-25)
- Eine Zahlung auf mehrere Rechnungen aufteilen (je Rechnung eine Zahlung)
- Sammelaktion „mehrere Rechnungen als bezahlt erfassen“ (bewusst nicht; nur „Bereits bezahlt“ beim Nacherfassen)
- Filter nach Zahlungsstatus, Jahres-/Betragsfilter in der Rechnungsliste (PROJ-43)
- Offene Zahlungen auf dem Dashboard (PROJ-14)
- Mahnwesen, Mahnschreiben, Erinnerungen per E-Mail (PROJ-22 bzw. später)
- Zahlungsbestätigung bzw. Quittung als PDF für den Gast
- CSV-Export der Zahlungsliste (später, z. B. mit PROJ-18)
- Auswertung der Provisionen je Plattform, Wohnung und Zeitraum (PROJ-18; Daten werden hier schon getrennt erfasst)
- Eingangsrechnungen der Plattformen (Provision, die booking.com bei Direktzahlung des Gastes gesondert verrechnet)
- Provision bei anderen Buchungsquellen oder Rechnungen ohne Buchung
- Kalenderfarbe für Buchungsquelle „Airbnb“
- Status für nacherfasste Rechnungen mit Betrag ≤ 0 und Rückzahlungen daran
- Automatisches Verfallen einer Option bei nicht bezahlter Anzahlung
- Fremdwährungen (nur Euro)
- Zugriff des Betreibers auf Zahlungen

## Acceptance Criteria

### Zahlung erfassen
- [ ] Angenommen eine ausgestellte, nicht stornierte Rechnung über € 450,00 ohne Zahlung, wenn ein Inhaber im Rechnungsdetail „Zahlung erfassen“ wählt, dann ist das Datum mit heute, der Betrag mit „450,00“ und die Zahlungsart mit der Standard-Art vorbelegt
- [ ] Angenommen das Formular „Zahlung erfassen“, wenn der Nutzer Datum, Betrag oder Zahlungsart leert und speichert, dann erscheint je Feld eine Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen das Formular, wenn der Nutzer ein Datum in der Zukunft wählt, dann erscheint „Das Zahlungsdatum darf nicht in der Zukunft liegen“ und Speichern ist nicht möglich
- [ ] Angenommen das Formular, wenn der Nutzer einen Betrag von 0 oder kleiner eingibt, dann erscheint „Der Betrag muss größer als 0 sein“
- [ ] Angenommen das Formular, wenn der Nutzer ein Zahlungsdatum vor dem Rechnungsdatum wählt, dann wird die Zahlung ohne Hinweis gespeichert
- [ ] Angenommen eine Notiz mit mehr als 300 Zeichen, wenn gespeichert wird, dann erscheint ein Hinweis auf die Höchstlänge
- [ ] Angenommen die Auswahl der Zahlungsart, wenn sie geöffnet wird, dann enthält sie nur aktive Zahlungsarten in der Reihenfolge der Einstellungen
- [ ] Angenommen eine gespeicherte Zahlung, wenn das Rechnungsdetail erscheint, dann steht sie in der Liste mit Datum („Fr, 06.11.2026“), Zahlungsart, Betrag („€ 450,00“), Notiz und „erfasst von [Name] am [Datum]“
- [ ] Angenommen der Server ist nicht erreichbar, wenn der Nutzer speichert, dann erscheint eine Fehlermeldung und die Eingaben bleiben erhalten

### Provisionsabzug
- [ ] Angenommen eine Rechnung über € 500,00 zu einer Buchung mit Buchungsquelle „Airbnb“, wenn „Zahlung erfassen“ geöffnet wird, dann gibt es die Felder „Ausbezahlt“, „Provision“ und „Zahlungsgebühr“
- [ ] Angenommen eine Rechnung zu einer Buchung mit anderer Buchungsquelle oder ohne Buchung, wenn „Zahlung erfassen“ geöffnet wird, dann gibt es weder „Provision“ noch „Zahlungsgebühr“, und das Betragsfeld heißt „Betrag“
- [ ] Angenommen das Formular mit Offen € 500,00, wenn der Nutzer Provision € 70,00 und Zahlungsgebühr € 5,00 einträgt und den Betrag nicht selbst geändert hat, dann ist „Ausbezahlt“ mit € 425,00 vorbelegt
- [ ] Angenommen der Nutzer hat „Ausbezahlt“ selbst geändert, wenn er danach die Provision ändert, dann bleibt sein Betrag stehen
- [ ] Angenommen Ausbezahlt € 425,00, Provision € 70,00, Zahlungsgebühr € 5,00, wenn gespeichert wird, dann ist die Rechnung „bezahlt“ mit Offen € 0,00, der Rechnungsbetrag bleibt € 500,00, und die Zahlung zeigt „€ 425,00 + Provision € 70,00 + Gebühr € 5,00“
- [ ] Angenommen eine Rechnung mit Provisionsabzug, wenn das Rechnungsdetail erscheint, dann stehen darunter getrennt „Eingegangen“, „Provision“, „Zahlungsgebühr“ und „Beglichen“
- [ ] Angenommen negative Werte in Provision oder Zahlungsgebühr, wenn gespeichert wird, dann erscheint „Der Betrag darf nicht negativ sein“
- [ ] Angenommen Ausbezahlt + Provision + Zahlungsgebühr übersteigen den Offen-Betrag, wenn gespeichert wird, dann erscheint der Hinweis auf Überzahlung wie bei anderen Zahlungen
- [ ] Angenommen die Buchungsquelle-Auswahl, wenn sie geöffnet wird, dann enthält sie „Airbnb“ hinter „booking.com“, auch im Filter der Buchungsübersicht
- [ ] Angenommen eine Zahlung mit Provision, wenn die Buchungsquelle der Buchung später auf „Website“ geändert wird, dann bleibt die Provision an der Zahlung und zählt weiter zu „Beglichen“
- [ ] Angenommen eine Zahlung mit Provision > 0, wenn der Inhaber sie auf eine Rechnung ohne Plattform-Buchung umhängen will, dann erscheint der Hinweis, Provision und Zahlungsgebühr zuerst auf 0 zu setzen, und nichts wird gespeichert
- [ ] Angenommen eine Airbnb-Rechnung mit Ausbezahlt € 425,00 und Provision € 75,00 wird storniert, wenn die Gutschrift erscheint, dann zeigt sie „Rückzahlung offen € 425,00“ (ohne Provision)
- [ ] Angenommen die Zahlungsliste mit Plattform-Zahlungen, wenn ein Zeitraum gewählt ist, dann zeigt sie je Zahlung Provision und Zahlungsgebühr und darunter getrennte Summen für eingegangen, Provision und Zahlungsgebühr
- [ ] Angenommen „Rechnung nacherfassen“ mit verknüpfter booking.com-Buchung und „Bereits bezahlt“, wenn der Inhaber Provision € 60,00 einträgt und speichert, dann begleicht die Zahlung den vollen Betrag mit Betrag = Rechnungsbetrag − € 60,00

### Beleg
- [ ] Angenommen das Formular, wenn der Nutzer ein PDF bis 10 MB anhängt und speichert, dann zeigt die Zahlung ein Beleg-Symbol, das das PDF öffnet
- [ ] Angenommen ein PDF über 10 MB, wenn der Nutzer es anhängt, dann erscheint ein Hinweis mit der Höchstgröße und es wird nicht übernommen
- [ ] Angenommen ein HEIC-Foto vom iPhone, wenn der Nutzer es als Beleg anhängt, dann wird es als JPEG gespeichert und in Chrome, Firefox und Safari richtig herum angezeigt
- [ ] Angenommen ein anderes Dateiformat (z. B. .docx), wenn der Nutzer es anhängt, dann erscheint ein Hinweis auf die erlaubten Formate
- [ ] Angenommen ein Nutzer eines anderen Kunden kennt die Adresse eines Belegs, wenn er sie aufruft, dann erhält er keinen Zugriff
- [ ] Angenommen eine Zahlung mit Beleg, wenn ein Inhaber den Beleg ersetzt oder entfernt, dann ist die alte Datei nicht mehr abrufbar

### Status und Offen-Betrag
- [ ] Angenommen eine zahlbare Rechnung über € 450,00 ohne Zahlungen, wenn das Rechnungsdetail erscheint, dann zeigt es „offen“, Bezahlt € 0,00, Offen € 450,00
- [ ] Angenommen Zahlungen über € 100,00, wenn das Rechnungsdetail erscheint, dann zeigt es „teilweise“ und Offen € 350,00
- [ ] Angenommen Zahlungen über genau € 450,00, wenn das Rechnungsdetail erscheint, dann zeigt es „bezahlt“ und Offen € 0,00
- [ ] Angenommen bisher € 400,00 bezahlt, wenn der Nutzer weitere € 100,00 speichern will, dann erscheint „Damit ist die Rechnung um € 50,00 überzahlt“; nach Bestätigung wird gespeichert und der Status ist „überzahlt“ mit Offen „-€ 50,00“
- [ ] Angenommen eine Schlussrechnung mit Rechnungsbetrag € 800,00 nach Abzug einer Teilrechnung, wenn Zahlungen über € 800,00 erfasst sind, dann ist sie „bezahlt“
- [ ] Angenommen die Rechnung ist „bezahlt“, wenn „Zahlung erfassen“ geöffnet wird, dann ist der Betrag leer
- [ ] Angenommen eine Zahlung wird gelöscht oder ihr Betrag geändert, wenn das Rechnungsdetail erscheint, dann sind Bezahlt, Offen und Status neu berechnet
- [ ] Angenommen ein Entwurf, wenn der Nutzer ihn öffnet, dann gibt es keinen Abschnitt „Zahlungen“ und keinen Knopf „Zahlung erfassen“
- [ ] Angenommen eine nacherfasste Rechnung mit Betrag € 0,00 oder negativem Betrag, wenn sie angezeigt wird, dann steht als Zahlungsstatus „–“ und es gibt keinen Knopf „Zahlung erfassen“
- [ ] Angenommen eine nacherfasste Rechnung mit Zahlungen, wenn der Inhaber ihren Betrag ändert, dann werden Status und Offen-Betrag nach dem neuen Betrag berechnet

### Fälligkeit
- [ ] Angenommen eine App-Rechnung mit Zahlungsregel „fällig 14 Tage nach Rechnungsdatum“ vom 01.11.2026, wenn das Rechnungsdetail erscheint, dann steht „fällig am So, 15.11.2026“
- [ ] Angenommen eine App-Rechnung mit Anzahlung 20 % binnen 3 Tagen und Rest 1 Tag vor Anreise, wenn das Rechnungsdetail erscheint, dann stehen „Anzahlung € … fällig am …“ und „Rest € … fällig am …“
- [ ] Angenommen der Fälligkeitstag der Anzahlung ist vorbei und weniger als die Anzahlung ist bezahlt, wenn Rechnungsdetail, Buchungsdetail oder Rechnungsliste erscheinen, dann ist die Rechnung rot als „überfällig“ gekennzeichnet (z. B. „offen · überfällig“)
- [ ] Angenommen die Anzahlung ist voll bezahlt und der Rest noch nicht fällig, wenn die Rechnung angezeigt wird, dann ist sie „teilweise“ ohne „überfällig“
- [ ] Angenommen heute ist der Fälligkeitstag, wenn die Rechnung nicht bezahlt ist, dann ist sie noch nicht überfällig
- [ ] Angenommen eine nacherfasste Rechnung, wenn sie angezeigt wird, dann gibt es weder Fälligkeit noch „überfällig“

### Buchungsdetail und Rechnungsliste
- [ ] Angenommen eine Buchung mit zwei nicht stornierten Rechnungen, wenn das Buchungsdetail erscheint, dann zeigt der Abschnitt „Rechnungen“ je Rechnung Status und Offen-Betrag sowie darunter „Bezahlt: € …“ und „Offen: € …“ über beide
- [ ] Angenommen eine Buchung mit genau einer zahlbaren Rechnung, wenn der Nutzer im Buchungsdetail „Zahlung erfassen“ wählt, dann ist diese Rechnung vorausgewählt
- [ ] Angenommen eine Buchung mit mehreren zahlbaren Rechnungen, wenn der Nutzer „Zahlung erfassen“ wählt, dann muss er die Rechnung auswählen (Nummer, Art, Offen-Betrag); der Betrag folgt dem Offen-Betrag der gewählten Rechnung
- [ ] Angenommen eine Buchung ohne zahlbare Rechnung, wenn das Buchungsdetail erscheint, dann gibt es keinen Knopf „Zahlung erfassen“
- [ ] Angenommen die Rechnungsliste, wenn sie erscheint, dann zeigt die neue Spalte „Zahlung“ je Rechnung den Status (ggf. mit „überfällig“), bei Entwürfen und Rechnungen ohne Status „–“

### Storno, Umhängen, Rückzahlung
- [ ] Angenommen eine Rechnung mit Zahlungen über € 450,00 wird storniert, wenn das Rechnungsdetail erscheint, dann stehen die Zahlungen weiter dort, Status „storniert · Guthaben € 450,00“, kein Knopf „Zahlung erfassen“
- [ ] Angenommen die zugehörige Gutschrift, wenn sie angezeigt wird, dann zeigt sie „Rückzahlung offen € 450,00“ und den Knopf „Rückzahlung erfassen“ (vorbelegt € 450,00)
- [ ] Angenommen der Inhaber erfasst eine Rückzahlung über € 450,00, wenn die Rechnung und die Gutschrift angezeigt werden, dann zeigt die Rechnung „storniert“, die Gutschrift „erstattet“, und die Rückzahlung erscheint als „-€ 450,00“ in Rot
- [ ] Angenommen eine stornierte Rechnung ohne Zahlungen, wenn die Gutschrift angezeigt wird, dann steht als Zahlungsstatus „–“ und es gibt keinen Knopf „Rückzahlung erfassen“
- [ ] Angenommen eine Zahlung an einer stornierten Rechnung, wenn der Inhaber sie bearbeitet und eine andere zahlbare Rechnung wählt, dann steht sie danach an der neuen Rechnung, und Guthaben und Status beider Rechnungen sind neu berechnet
- [ ] Angenommen die Auswahl beim Umhängen, wenn sie geöffnet wird, dann stehen zahlbare Rechnungen derselben Buchung zuerst, danach die übrigen zahlbaren Rechnungen des Kunden (Suche nach Nummer und Empfänger)
- [ ] Angenommen eine Rückzahlung über mehr als das Guthaben, wenn gespeichert wird, dann erscheint ein Hinweis, nach Bestätigung wird gespeichert

### Bearbeiten und Löschen
- [ ] Angenommen eine Zahlung, wenn ein Inhaber „Bearbeiten“ wählt, dann kann er alle Felder einschließlich Rechnung und Beleg ändern
- [ ] Angenommen eine Zahlung, wenn ein Inhaber „Löschen“ wählt, dann erscheint ein Bestätigungsdialog mit Datum und Betrag, bevor sie samt Beleg entfernt wird
- [ ] Angenommen eine nacherfasste Rechnung mit Zahlungen, wenn der Inhaber sie löschen will, dann erscheint „Diese Rechnung hat Zahlungen. Bitte zuerst die Zahlungen einer anderen Rechnung zuordnen oder löschen.“ und sie wird nicht gelöscht
- [ ] Angenommen eine Zahlung mit deaktivierter Zahlungsart, wenn der Inhaber sie bearbeitet, dann bleibt die bisherige Art wählbar, bis er eine andere wählt

### Nacherfassen mit „Bereits bezahlt“
- [ ] Angenommen das Formular „Rechnung nacherfassen“ mit Betrag > 0, wenn der Inhaber „Bereits bezahlt“ einschaltet, dann erscheinen Zahlungsdatum (vorbelegt Rechnungsdatum) und Zahlungsart (vorbelegt Standard)
- [ ] Angenommen „Bereits bezahlt“ ist eingeschaltet, wenn gespeichert wird, dann hat die Rechnung eine Zahlung über den vollen Betrag und den Status „bezahlt“
- [ ] Angenommen Betrag ≤ 0, wenn das Formular erscheint, dann ist „Bereits bezahlt“ nicht verfügbar
- [ ] Angenommen eine bestehende nacherfasste Rechnung wird bearbeitet, wenn das Formular erscheint, dann gibt es „Bereits bezahlt“ nicht (Zahlungen über den Abschnitt „Zahlungen“)

### Zahlungsliste
- [ ] Angenommen Zahlungen in mehreren Monaten, wenn ein Nutzer „Zahlungen“ öffnet, dann sieht er die Zahlungen des aktuellen Monats nach Datum absteigend mit Datum, Rechnung (Link), Empfänger, Buchung (Link oder „–“), Zahlungsart, Betrag und Beleg-Symbol
- [ ] Angenommen die Zahlungsliste, wenn der Nutzer einen anderen Monat oder „Alle Monate“ wählt, dann zeigt sie die Zahlungen dieses Zeitraums
- [ ] Angenommen die Zahlungsliste, wenn der Nutzer nach Zahlungsart filtert oder nach Rechnungsnummer, Empfänger oder Notiz sucht, dann erscheinen nur passende Zahlungen
- [ ] Angenommen ein Filter ist gesetzt, wenn die Liste erscheint, dann steht darunter die Summe der gefilterten Beträge, Rückzahlungen abgezogen
- [ ] Angenommen mehr als 50 Treffer, wenn die Liste erscheint, dann wird je 50 geblättert und die Gesamtzahl angezeigt
- [ ] Angenommen keine Zahlungen im Zeitraum, wenn die Liste erscheint, dann steht „Keine Zahlungen in diesem Zeitraum“ mit dem Hinweis, dass Zahlungen in Rechnung oder Buchung erfasst werden
- [ ] Angenommen ein Handy, wenn die Liste erscheint, dann werden Karten statt einer Tabelle gezeigt; ein Tipp auf eine Zahlung öffnet die Rechnung (auch in Safari die richtige)

### Einstellungen → Zahlungen
- [ ] Angenommen ein Kunde ohne eigene Einstellung, wenn der Inhaber „Einstellungen → Zahlungen“ öffnet, dann stehen dort Überweisung (Standard), Bar, Karte, PayPal, über booking.com, über Airbnb
- [ ] Angenommen der Reiter, wenn der Inhaber eine Zahlungsart anlegt, umbenennt oder die Reihenfolge ändert, dann wirkt das sofort in der Auswahl beim Erfassen
- [ ] Angenommen eine Zahlungsart mit gleichem Namen (ohne Groß-/Kleinschreibung) existiert, wenn der Inhaber sie anlegt, dann erscheint „Diese Zahlungsart gibt es bereits“
- [ ] Angenommen ein leerer Name oder mehr als 50 Zeichen, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen eine Zahlungsart wird verwendet, wenn der Inhaber sie löschen will, dann ist nur „Deaktivieren“ möglich, mit Hinweis auf die Verwendung
- [ ] Angenommen eine unbenutzte Zahlungsart, wenn der Inhaber sie löscht (nach Bestätigung), dann verschwindet sie
- [ ] Angenommen nur eine aktive Zahlungsart, wenn der Inhaber sie deaktivieren oder löschen will, dann ist das nicht möglich
- [ ] Angenommen die Standard-Art, wenn der Inhaber sie deaktivieren will, dann erscheint der Hinweis, zuerst eine andere als Standard zu wählen

### Rechte
- [ ] Angenommen ein Mitarbeiter, wenn er Rechnungsdetail, Buchungsdetail oder „Zahlungen“ öffnet, dann sieht er Zahlungen, Status, Offen-Betrag und Fälligkeit und kann Zahlungen bzw. Rückzahlungen mit Beleg erfassen
- [ ] Angenommen ein Mitarbeiter, wenn er eine Zahlung ansieht, dann gibt es weder „Bearbeiten“ noch „Löschen“, und auch ein direkter Aufruf der Änderung wird abgelehnt
- [ ] Angenommen ein Mitarbeiter, wenn er die Einstellungen öffnet, dann gibt es keinen Reiter „Zahlungen“, und der direkte Aufruf der Adresse führt nicht zum Reiter
- [ ] Angenommen der Betreiber (ohne Mitgliedschaft beim Kunden), wenn er Zahlungen eines Kunden abfragt, dann erhält er keine
- [ ] Angenommen ein Nutzer von Kunde A, wenn er Zahlungen, Belege oder Zahlungsarten von Kunde B abfragt oder ändern will, dann erhält er keinen Zugriff

### Allgemein
- [ ] Angenommen alle Seiten dieses Features, wenn sie auf Handy, Tablet und Desktop geöffnet werden, dann sind sie ohne waagrechtes Scrollen bedienbar und ohne Barrierefreiheitsfehler (axe)
- [ ] Angenommen Beträge und Daten, wenn sie angezeigt werden, dann im Format von PROJ-31 („€ 1.234,56“, „-€ 50,00“ rot, „Fr, 06.11.2026“)

## Edge Cases
- **Zwei Nutzer erfassen gleichzeitig dieselbe Zahlung:** Beide werden gespeichert (keine Sperre). Gibt es an der Rechnung bereits eine Zahlung mit gleichem Datum und Betrag, erscheint vor dem Speichern der Hinweis „Eine Zahlung über € … vom … ist bereits erfasst“; der Nutzer kann trotzdem speichern.
- **Rechnung wird storniert, während jemand eine Zahlung erfasst:** Das Speichern wird abgelehnt mit „Diese Rechnung wurde inzwischen storniert“; Eingaben bleiben erhalten, der Nutzer kann eine andere Rechnung wählen.
- **Umhängen auf eine inzwischen stornierte Rechnung:** abgelehnt wie oben.
- **Teilrechnung bezahlt, dann von einer Schlussrechnung abgezogen:** Die Teilrechnung bleibt „bezahlt“, die Schlussrechnung bezieht sich auf ihren Rechnungsbetrag nach Abzug; keine Verrechnung zwischen beiden.
- **Abreise oder Anreise ändert sich nach dem Ausstellen:** Die Fälligkeit bleibt beim Wert der ausgestellten Rechnung (Stand beim Ausstellen), weil die Rechnung festgeschrieben ist.
- **Buchung wird storniert, Rechnung nicht:** Rechnung bleibt zahlbar mit ihrem Status; erst die Gutschrift (PROJ-44) ändert ihn.
- **Zahlungsart wird umbenannt:** alle alten Zahlungen zeigen den neuen Namen.
- **Zahlungsart wird deaktiviert, während jemand das Formular offen hat:** Speichern wird abgelehnt mit „Diese Zahlungsart ist nicht mehr verfügbar“.
- **Beleg-Upload bricht ab (Netz am Handy):** Die Zahlung wird nicht ohne Hinweis gespeichert; der Nutzer kann erneut hochladen oder ohne Beleg speichern.
- **Rundung:** Alle Beträge in Cent; Offen-Betrag und Anzahlung (Prozent vom Rechnungsbetrag, auf Cent gerundet wie in PROJ-39) ohne Rundungsdifferenzen.
- **Sehr viele Zahlungen an einer Rechnung (z. B. Monatsmiete Dienstwohnung):** Liste im Rechnungsdetail vollständig, nach Datum aufsteigend.
- **Betreiber ist zugleich Inhaber eines Kunden:** gilt in diesem Kunden als Inhaber.
- **Rechnung überzahlt, dann storniert:** Guthaben = gesamte Zahlungen; Rückzahlung vorbelegt mit diesem Betrag.

## Technical Requirements
- Mandantentrennung für Zahlungen, Belege und Zahlungsarten auf Datenbankebene (RLS), wie bei allen Kundendaten; Mitarbeiter dürfen nur anlegen, nicht ändern oder löschen (auch serverseitig geprüft)
- Status, Bezahlt und Offen werden aus den gespeicherten Zahlungen gebildet, nicht vom Browser übernommen
- Belege privat je Kunde, Upload direkt in den Speicher (Grenze der Server-Anfragen auf Vercel), Bilder wie PROJ-29 im Browser umgewandelt
- Anlegen, Ändern, Umhängen und Löschen von Zahlungen sowie Änderungen an Zahlungsarten im Protokoll (audit_log)
- Zahlungsliste mit 50 Einträgen in unter 1 Sekunde, auch bei mehreren tausend Zahlungen je Kunde
- Browser: Chrome, Firefox, Safari (Desktop und Handy)

## Open Questions
- [ ] Steuerberater: Ist für Barzahlungen eine Quittung bzw. ein Eintrag in der Registrierkasse nötig, der über die Erfassung hinausgeht? (Betrifft nicht die App, nur den Hinweis an Pilotkunden)
- [ ] PROJ-13: Wie werden Channex-Zahlungen ohne Rechnung später einer Rechnung zugeordnet (eigener Zustand „nicht zugeordnet“ an der Buchung)? Bewusst dort zu klären.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Jede Zahlung gehört genau einer Rechnung; Buchung ergibt sich daraus | Nutzerentscheidung; eindeutiger Status je Rechnung; Zahlungen ohne Rechnung (Channex) erst mit PROJ-13 | 2026-11-06 |
| Sammelüberweisung = je Rechnung eine Zahlung, kein Aufteilen | Nutzerentscheidung; einfach und eindeutig; Aufteilen eher Thema des Bankabgleichs (PROJ-25) | 2026-11-06 |
| Felder Datum, Betrag, Zahlungsart (Pflicht), Notiz, Beleg (optional) | Nutzerentscheidung; Beleg ausdrücklich nicht verpflichtend | 2026-11-06 |
| Zahlungsarten je Kunde in Einstellungen → Zahlungen, vorbelegt, mit Standard, deaktivierbar, löschbar nur unbenutzt | Nutzerwunsch; passt sich dem Betrieb an, alte Zahlungen behalten ihre Art | 2026-11-06 |
| Ein Beleg je Zahlung: PDF bis 10 MB oder Bild (umgewandelt wie PROJ-29) | Nutzerentscheidung; Kontoauszug als PDF oder Foto der Quittung am Handy | 2026-11-06 |
| Erfassen und Ansehen in Rechnung und Buchung, dazu eigener Menüpunkt „Zahlungen“ zwischen „Rechnungen“ und „Einstellungen“ | Nutzerentscheidung; Monatsliste mit Summe zum Abgleich mit dem Konto | 2026-11-06 |
| Mitarbeiter sehen alles und erfassen (mit Beleg), Bearbeiten/Löschen/Einstellungen nur Inhaber; Betreiber kein Zugriff | Nutzerentscheidung (weicht vom PRD-Satz „Mitarbeiter ohne Zugriff auf Zahlungen“ ab): Barzahlung bei Schlüsselübergabe; Korrekturen bleiben beim Inhaber | 2026-11-06 |
| Status offen/teilweise/bezahlt/überzahlt; Überzahlung mit Hinweis erlaubt; Betrag vorbelegt mit Offen-Betrag | Nutzerentscheidung; Überzahlungen kommen vor (Trinkgeld, Doppelzahlung) und sollen sichtbar sein | 2026-11-06 |
| Bei Storno bleiben Zahlungen an der Rechnung; Umhängen auf andere Rechnung oder Rückzahlung an der Gutschrift | Nutzerentscheidung; deckt beide üblichen Fälle ab (Neuausstellung bzw. Erstattung); schließt Open Question aus PROJ-44 | 2026-11-06 |
| Nacherfasste Rechnungen nehmen Zahlungen; „Bereits bezahlt“ nur beim Anlegen; keine Sammelaktion | Nutzerentscheidung; bestehende Altrechnungen bleiben offen, bis der Inhaber nachträgt | 2026-11-06 |
| Nacherfasste Rechnungen mit Betrag ≤ 0: kein Status, keine Zahlungen | Nutzerentscheidung; App weiß nicht, ob damals erstattet wurde | 2026-11-06 |
| Löschen einer nacherfassten Rechnung mit Zahlungen gesperrt | Nutzerentscheidung; kein stilles Mitlöschen von Geldbewegungen | 2026-11-06 |
| Fälligkeit und „überfällig“ für App-Rechnungen aus deren Zahlungsregeln, als Zusatz zum Status | Nutzerentscheidung; Zahlungsregeln liegen schon an der Rechnung (PROJ-39/40) | 2026-11-06 |
| Rückzahlungen mit Minus in Rot, vorbelegt mit Guthaben, Überschreiten mit Hinweis erlaubt | Einheitlich mit negativen Beträgen (PROJ-32) und Überzahlung | 2026-11-06 |
| Buchungsdetail zeigt Bezahlt/Offen über alle nicht stornierten Rechnungen | Überblick je Aufenthalt ohne Rechnungen einzeln zu öffnen | 2026-11-06 |
| Provision und Zahlungsgebühr als zwei optionale Felder an der Zahlung; verringern den Offen-Betrag, nicht den Rechnungsbetrag | Nutzerwunsch (getrennte Felder für spätere Auswertung); Rechnung an den Gast bleibt steuerlich unverändert; Provision als Feld der Zahlung, weil sie nur bei Auszahlung durch die Plattform am Konto fehlt | 2026-11-06 |
| Provisionsfelder nur bei Buchungsquelle booking.com oder Airbnb (später auch Kanal aus dem Import) | Nutzerentscheidung; Provision fällt nur bei Plattform-Buchungen an | 2026-11-06 |
| Buchungsquelle „Airbnb“ ergänzen (ohne Kalenderfarbe), mit PROJ-45 gebaut | Nutzerentscheidung; von Hand erfasste Airbnb-Buchungen gibt es vor dem Import (PROJ-11); Ergänzung an PROJ-30 | 2026-11-06 |
| Direktzahlung des Gastes mit gesonderter Provisionsrechnung der Plattform = kein Abzug | Gast hat voll bezahlt; die Provision ist eine Eingangsrechnung des Vermieters | 2026-11-06 |
| Guthaben nach Storno nur aus tatsächlich eingegangenem Geld | Provision ist nie am Konto eingegangen und kann nicht an den Gast zurückgezahlt werden | 2026-11-06 |
| Filter nach Zahlungsstatus in der Rechnungsliste erst in PROJ-43 | Hält PROJ-45 klein; PROJ-43 baut darauf auf | 2026-11-06 |

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
