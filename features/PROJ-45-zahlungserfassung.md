# PROJ-45: Zahlungserfassung

## Status: In Progress
**Created:** 2026-11-06
**Last Updated:** 2026-11-07

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
| Zahlungsart | ja | direkt nach dem Datum; Auswahl aus den aktiven Zahlungsarten des Kunden (Einstellungen → Zahlungen); vorbelegt mit der Standard-Zahlungsart („Überweisung“) |
| Provision | nein, nur bei Zahlungsart „über booking.com“ oder „über Airbnb“ | €, zwei Nachkommastellen, ≥ 0; von booking.com/Airbnb einbehalten |
| Zahlungsgebühr | nein, nur bei Zahlungsart „über booking.com“ | €, zwei Nachkommastellen, ≥ 0; z. B. Gebühr von „Payments by Booking.com“ |
| Betrag (mit Provision/Zahlungsgebühr „Zahlungsbetrag“) | ja | €, zwei Nachkommastellen, größer als 0; tatsächlich eingegangenes Geld; vorbelegt mit dem Offen-Betrag minus eingetragener Provision und Zahlungsgebühr (bei „bezahlt“/„überzahlt“ leer) |
| Notiz | nein | Freitext, höchstens 300 Zeichen (z. B. Verwendungszweck) |
| Beleg | nein | höchstens eine Datei: PDF bis 10 MB (unverändert) oder Bild (JPEG, PNG, HEIC/HEIF, WebP), verkleinert und als JPEG gespeichert wie beim Reisedokument (PROJ-29); am Handy direkt fotografieren; privat je Kunde |

- Eine Sammelüberweisung für mehrere Rechnungen wird als **je Rechnung eine Zahlung** erfasst.
- **Beglichen** je Zahlung = Betrag + Provision + Zahlungsgebühr.
- Wer und wann erfasst hat, wird festgehalten und im Detail angezeigt („erfasst von Maria Huber am Fr, 06.11.2026“).

### Provisionsabzug (Plattform-Buchungen)
Zahlen booking.com oder Airbnb aus, fehlen Provision und Gebühren am Konto. Die Rechnung an den Gast bleibt unverändert (die Umsatzsteuer fällt auf den vollen Betrag an); Provision und Zahlungsgebühr verringern nur den **Offen-Betrag**.
- **Plattform-Buchung** = Buchungsquelle „booking.com“ oder „Airbnb“; nach dem Import (PROJ-11) zusätzlich Kanal booking.com bzw. Airbnb.
- **Felder nach Zahlungsart (refine 2026-11-07):** „Provision“ und „Zahlungsgebühr“ erscheinen erst, wenn die Zahlungsart „über booking.com“ gewählt ist; bei „über Airbnb“ nur „Provision“. Erkannt wird die Zahlungsart an ihrem Namen („booking.com“ bzw. „Airbnb“ darin, Groß-/Kleinschreibung egal). Wechselt der Nutzer auf eine Zahlungsart ohne das Feld, wird es geleert. Die Felder stehen vor dem Betragsfeld, das dann „Zahlungsbetrag“ heißt.
- **Buchungsquelle bleibt Pflicht:** Gespeichert werden Provision und Zahlungsgebühr nur an Rechnungen, die mit einer Plattform-Buchung verknüpft sind. Sonst erscheint an der Zahlungsart der Hinweis, die Werte zuerst auf 0 zu setzen.
- Beim Eintragen von Provision oder Gebühr sinkt der Vorschlag für „Zahlungsbetrag“ entsprechend, solange der Nutzer den Betrag nicht selbst geändert hat.
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
- [ ] Angenommen „Zahlung erfassen“ wird geöffnet, wenn das Formular erscheint, dann folgt die Zahlungsart direkt auf das Zahlungsdatum, ist mit „Überweisung“ vorbelegt, und es gibt weder „Provision“ noch „Zahlungsgebühr“; das Betragsfeld heißt „Betrag“
- [ ] Angenommen eine Rechnung über € 500,00 zu einer Buchung mit Buchungsquelle „Airbnb“, wenn der Nutzer die Zahlungsart „über booking.com“ wählt, dann erscheinen vor dem Betragsfeld „Provision“ und „Zahlungsgebühr“, und das Betragsfeld heißt „Zahlungsbetrag“
- [ ] Angenommen das Formular, wenn der Nutzer die Zahlungsart „über Airbnb“ wählt, dann erscheint nur „Provision“, keine „Zahlungsgebühr“
- [ ] Angenommen eingetragene Provision und Zahlungsgebühr, wenn der Nutzer auf eine Zahlungsart ohne diese Felder wechselt, dann verschwinden sie samt Werten, und der Vorschlag für den Betrag steigt wieder
- [ ] Angenommen eine Rechnung zu einer Buchung mit anderer Buchungsquelle oder ohne Buchung und Zahlungsart „über booking.com“ mit Provision > 0, wenn gespeichert wird, dann erscheint der Hinweis, dass Provision und Zahlungsgebühr nur bei Buchungen über booking.com oder Airbnb möglich sind, und nichts wird gespeichert
- [ ] Angenommen das Formular mit Offen € 500,00, wenn der Nutzer Provision € 70,00 und Zahlungsgebühr € 5,00 einträgt und den Betrag nicht selbst geändert hat, dann ist „Zahlungsbetrag“ mit € 425,00 vorbelegt
- [ ] Angenommen der Nutzer hat „Zahlungsbetrag“ selbst geändert, wenn er danach die Provision ändert, dann bleibt sein Betrag stehen
- [ ] Angenommen Zahlungsbetrag € 425,00, Provision € 70,00, Zahlungsgebühr € 5,00, wenn gespeichert wird, dann ist die Rechnung „bezahlt“ mit Offen € 0,00, der Rechnungsbetrag bleibt € 500,00, und die Zahlung zeigt „€ 425,00 + Provision € 70,00 + Gebühr € 5,00“
- [ ] Angenommen eine Rechnung mit Provisionsabzug, wenn das Rechnungsdetail erscheint, dann stehen darunter getrennt „Eingegangen“, „Provision“, „Zahlungsgebühr“ und „Beglichen“
- [ ] Angenommen negative Werte in Provision oder Zahlungsgebühr, wenn gespeichert wird, dann erscheint „Der Betrag darf nicht negativ sein“
- [ ] Angenommen Zahlungsbetrag + Provision + Zahlungsgebühr übersteigen den Offen-Betrag, wenn gespeichert wird, dann erscheint der Hinweis auf Überzahlung wie bei anderen Zahlungen
- [ ] Angenommen die Buchungsquelle-Auswahl, wenn sie geöffnet wird, dann enthält sie „Airbnb“ hinter „booking.com“, auch im Filter der Buchungsübersicht
- [ ] Angenommen eine Zahlung mit Provision, wenn die Buchungsquelle der Buchung später auf „Website“ geändert wird, dann bleibt die Provision an der Zahlung und zählt weiter zu „Beglichen“
- [ ] Angenommen eine Zahlung mit Provision > 0, wenn der Inhaber sie auf eine Rechnung ohne Plattform-Buchung umhängen will, dann erscheint der Hinweis, Provision und Zahlungsgebühr zuerst auf 0 zu setzen, und nichts wird gespeichert
- [ ] Angenommen eine Airbnb-Rechnung mit Zahlungsbetrag € 425,00 und Provision € 75,00 wird storniert, wenn die Gutschrift erscheint, dann zeigt sie „Rückzahlung offen € 425,00“ (ohne Provision)
- [ ] Angenommen die Zahlungsliste mit Plattform-Zahlungen, wenn ein Zeitraum gewählt ist, dann zeigt sie je Zahlung Provision und Zahlungsgebühr und darunter getrennte Summen für eingegangen, Provision und Zahlungsgebühr
- [ ] Angenommen „Rechnung nacherfassen“ mit verknüpfter booking.com-Buchung, „Bereits bezahlt“ und Zahlungsart „über booking.com“, wenn der Inhaber Provision € 60,00 einträgt und speichert, dann begleicht die Zahlung den vollen Betrag mit Betrag = Rechnungsbetrag − € 60,00

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
| Provisionsfelder erscheinen nach Zahlungsart („über booking.com“: Provision und Zahlungsgebühr, „über Airbnb“: nur Provision), erkannt am Namen; Zahlungsart direkt nach dem Datum; „Ausbezahlt“ heißt „Zahlungsbetrag“; Buchungsquelle booking.com/Airbnb bleibt Voraussetzung fürs Speichern; gilt auch für „Bereits bezahlt“ | Nutzerentscheidung (refine 2026-11-07); Felder nur, wenn sie zur Zahlung passen; kein eigenes Kennzeichen an der Zahlungsart | 2026-11-07 |
| Direktzahlung des Gastes mit gesonderter Provisionsrechnung der Plattform = kein Abzug | Gast hat voll bezahlt; die Provision ist eine Eingangsrechnung des Vermieters | 2026-11-06 |
| Guthaben nach Storno nur aus tatsächlich eingegangenem Geld | Provision ist nie am Konto eingegangen und kann nicht an den Gast zurückgezahlt werden | 2026-11-06 |
| Filter nach Zahlungsstatus in der Rechnungsliste erst in PROJ-43 | Hält PROJ-45 klein; PROJ-43 baut darauf auf | 2026-11-06 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Zahlungsstatus, Summen, Guthaben und „überfällig“ beim Lesen in einer Lesesicht der Datenbank gebildet, nicht gespeichert | Nie widersprüchlich; eine Quelle für Rechnungsliste, Buchung, PROJ-43, PROJ-14 und PROJ-18 | 2026-11-06 |
| Fälligkeit aus dem Zahlungsplan der festgeschriebenen Fassung | Ist beim Ausstellen schon berechnet und gespeichert; passt zur Spec (Stand beim Ausstellen) | 2026-11-06 |
| Rückzahlungen als eigene Art in derselben Zahlungstabelle, an der Gutschrift | Eine Liste, eine Summenlogik, ein Dialog; Zahlungsliste zieht Rückzahlungen ab | 2026-11-06 |
| Schreiben nur über Datenbankfunktionen, direktes Schreiben gesperrt | Mitarbeiter dürfen anlegen, aber nicht ändern; Regeln (zahlbar, Plattform, Zahlungsart) gelten auch am Formular vorbei | 2026-11-06 |
| Funktion sperrt die Rechnung wie das Ausstellen der Gutschrift | Keine Zahlung auf eine gerade stornierte Rechnung | 2026-11-06 |
| Hinweise (Überzahlung, Doppelerfassung) kommen aus der Datenbank und werden bestätigt | Gleicher Stand wie beim Speichern, auch bei gleichzeitiger Erfassung | 2026-11-06 |
| „Bereits bezahlt“: Rechnung und Zahlung in einem Datenbankschritt | Keine halbe Erfassung bei Abbruch | 2026-11-06 |
| Löschsperre für Rechnungen mit Zahlungen in der Datenbank | Kein stilles Mitlöschen, auch nicht über andere Wege | 2026-11-06 |
| Belege in eigenem privatem Speicherbereich, Upload vom Browser, Bildumwandlung aus PROJ-29, nächtliche Aufräumaufgabe erweitert | Bewährter Weg; Vercel-Grenze für Anfragen; keine neuen Pakete | 2026-11-06 |
| Betreiber ohne Leseausnahme auf Zahlungen | Spec: kein Zugriff des Betreibers; anders als bei Rechnungen | 2026-11-06 |
| Zahlungsarten als eigene Tabelle mit Verweis, Standardarten per Migration und beim Anlegen neuer Kunden | Umbenennen wirkt auf alte Zahlungen; Löschen benutzter Arten technisch ausgeschlossen | 2026-11-06 |
| Bestehender, ausgeblendeter Menüpunkt „Zahlungen“ wird freigeschaltet und für alle Rollen geöffnet | War schon vorgesehen; Spec: Mitarbeiter sehen die Liste | 2026-11-06 |
| Gemeinsamer Kern private.save_payment für Erfassen und Ändern | Eine Stelle für alle Regeln und Hinweise; Ändern zusätzlich Inhaber, Stand und Umhängen | 2026-11-06 |
| Standardarten per Trigger auf tenants, bestehende Kunden per Migration | Jeder Kunde hat seine eigene, änderbare Liste; kein Schritt im Betreiber-Ablauf nötig | 2026-11-06 |
| Regeln der Zahlungsarten als Trigger mit Ausnahme beim Löschen des Kunden | Gelten auch bei direktem Schreiben; der Kunde lässt sich weiter löschen | 2026-11-06 |
| Verweis Zahlung → Zahlungsart ohne Kaskade (Prüfung am Ende der Anweisung) | Benutzte Arten nicht löschbar (23503), beim Löschen des Kunden räumt die Kaskade beides weg | 2026-11-06 |
| „Bereits bezahlt“ im Rahmen von public.save_invoice | Ein Aufruf, ein Vorgang: Rechnung und Zahlung entstehen gemeinsam oder gar nicht | 2026-11-06 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Rechnungstabelle** mit nacherfassten Rechnungen, Entwürfen, ausgestellten Rechnungen und Gutschriften; „storniert“ ergibt sich aus einer Gutschrift, die auf die Rechnung verweist (PROJ-44).
- **Festgeschriebene Fassung** jeder ausgestellten Rechnung enthält schon den **Zahlungsplan** (Anzahlung, Anzahlung fällig, Rest, fällig am), berechnet beim Ausstellen. Die Fälligkeit muss also nicht neu gerechnet werden und ändert sich nicht, wenn sich die Buchung später ändert.
- **Rechnungen dieser Buchung** liefert die Datenbank über eine eigene Lesefunktion; die Rechnungsliste liest direkt aus der Tabelle.
- **Bilder umwandeln** (HEIC → JPEG, drehen, verkleinern) und **direktes Hochladen vom Browser in einen privaten Speicher je Kunde** gibt es seit PROJ-29; eine nächtliche Aufräumaufgabe entfernt dort liegengebliebene Dateien.
- **Navigation:** Der Menüpunkt „Zahlungen“ ist schon vorgesehen, aber noch ausgeblendet und nur für Inhaber.
- **Protokoll:** Eine bestehende Protokollfunktion lässt sich an neue Tabellen hängen.

### Grundidee
Zwei neue Tabellen: **Zahlungen** und **Zahlungsarten**. Zahlungsstatus, Bezahlt, Offen, Guthaben und „überfällig“ werden **nicht gespeichert**, sondern beim Lesen aus den Zahlungen gebildet, in einer gemeinsamen Lesesicht der Datenbank. So können sie nie auseinanderlaufen, und PROJ-43 (Filter), PROJ-14 (Dashboard) und PROJ-18 (Auswertung) nutzen dieselbe Quelle.

Rückzahlungen sind ebenfalls Einträge in der Zahlungstabelle, gekennzeichnet als „Rückzahlung“ und an der Gutschrift statt an der Rechnung.

### Seiten und Bausteine der Oberfläche
```
Rechnungsdetail (besteht)
+-- NEU Abschnitt „Zahlungen“ (zahlbare und stornierte Rechnungen)
|   +-- Liste: Datum · Art · Betrag (+ Provision + Gebühr) · Notiz · Beleg · erfasst von
|   |   +-- je Zahlung „Bearbeiten“ / „Löschen“ (nur Inhaber)
|   +-- Summenblock: Rechnungsbetrag · Eingegangen · Provision · Zahlungsgebühr · Beglichen · Offen
|   +-- Status-Kennzeichen (offen/teilweise/bezahlt/überzahlt, „überfällig“ rot)
|   +-- Fälligkeit (App-Rechnungen): „fällig am …“ bzw. „Anzahlung … / Rest …“
|   +-- Knopf „Zahlung erfassen“ (nicht bei storniert)
|   +-- storniert: „storniert · Guthaben € …“
+-- NEU Abschnitt „Rückzahlungen“ (Gutschriften)
    +-- Liste, „Rückzahlung offen € …“ bzw. „erstattet“, Knopf „Rückzahlung erfassen“

Zahlungs-Dialog (neu, ein Baustein für Erfassen, Bearbeiten, Rückzahlung)
+-- Rechnung: fest, oder Auswahl (aus der Buchung; beim Umhängen mit Suche, gleiche Buchung zuerst)
+-- Zahlungsdatum · Zahlungsart (aktive Arten, Standard vorbelegt)
+-- Provision · Zahlungsgebühr (nach Zahlungsart: booking.com beide, Airbnb nur Provision; Vorschlag für „Zahlungsbetrag“ folgt)
+-- Betrag bzw. „Zahlungsbetrag“ · Notiz mit Zähler
+-- Beleg: Datei wählen / am Handy fotografieren, Vorschau, ersetzen/entfernen (Inhaber)
+-- Hinweise vor dem Speichern: Überzahlung, gleiche Zahlung schon erfasst, Rückzahlung über Guthaben
    (Bestätigen und trotzdem speichern)

Buchungsdetail, Abschnitt „Rechnungen“ (besteht)
+-- je Rechnung NEU Status-Kennzeichen und Offen-Betrag
+-- NEU „Bezahlt: € …“ und „Offen: € …“ über alle nicht stornierten Rechnungen
+-- NEU Knopf „Zahlung erfassen“ (öffnet den Dialog mit Rechnungsauswahl)

Rechnungsliste (besteht)
+-- NEU Spalte „Zahlung“ mit Status-Kennzeichen (Handy: Zeile in der Karte)

Formular „Rechnung nacherfassen“ (besteht, nur beim Anlegen)
+-- NEU Schalter „Bereits bezahlt“ → Datum, Zahlungsart, bei Plattform-Buchung Provision/Gebühr

Menüpunkt „Zahlungen“ (neu, /zahlungen, Inhaber und Mitarbeiter)
+-- Kopf: Monats-Sprungauswahl (wie Buchungsübersicht) · „Alle Monate“ · Zahlungsart · Suche
+-- Tabelle (Desktop) bzw. Karten (Handy): Datum · Rechnung · Empfänger · Buchung · Art ·
|   Betrag · Provision · Gebühr · Beleg  (nur die Rechnungsnummer ist der Link – Safari)
+-- Summenzeile: Eingegangen (Rückzahlungen abgezogen) · Provision · Zahlungsgebühr
+-- Blättern je 50, Gesamtzahl; leerer Zustand mit Hinweis

Einstellungen → Zahlungen (neuer Reiter hinter „Rechnungen“, nur Inhaber)
+-- Liste der Zahlungsarten mit Griff zum Ordnen (wie Preispositionen, PROJ-34)
|   +-- je Art: Name · „Standard“ · aktiv/deaktiviert · Umbenennen · Löschen (nur unbenutzt)
+-- „Zahlungsart hinzufügen“

Buchungsformular und -filter (bestehen)
+-- Buchungsquelle NEU „Airbnb“ hinter „booking.com“ (ohne Kalenderfarbe)
```

### Datenmodell (in Worten)
**Zahlungsart** (je Kunde):
- Name (bis 50 Zeichen, je Kunde eindeutig ohne Groß-/Kleinschreibung), Reihenfolge, aktiv ja/nein, Standard ja/nein (höchstens eine je Kunde)
- Bestehende Kunden bekommen die sechs Standardarten mit der Migration, neue Kunden beim Anlegen automatisch

**Zahlung** (je Kunde):
- Art des Eintrags: **Zahlung** oder **Rückzahlung**
- Rechnung (Pflicht): bei Zahlungen eine zahlbare oder stornierte Rechnung, bei Rückzahlungen eine Gutschrift
- Zahlungsdatum, Betrag in Cent (> 0), Provision und Zahlungsgebühr in Cent (≥ 0, Standard 0; bei Rückzahlungen immer 0)
- Zahlungsart (Verweis; eine Art mit Zahlungen kann nicht gelöscht werden)
- Notiz (bis 300 Zeichen), Beleg (Dateiname im Speicher, Dateityp)
- erfasst von, erfasst am; zuletzt geändert von/am
- Eine Rechnung mit Zahlungen kann nicht gelöscht werden (Datenbanksperre; die Oberfläche zeigt die Meldung aus der Spec)

**Lesesicht „Zahlungsstand je Rechnung“** (mit den Rechten des Lesenden):
- Eingegangen, Provision, Zahlungsgebühr, Beglichen, Offen, Status (offen/teilweise/bezahlt/überzahlt bzw. „–“), überfällig ja/nein (aus dem Zahlungsplan der Fassung und dem heutigen Tag in Wien)
- Bei stornierten Rechnungen und Gutschriften: Guthaben = Eingegangen an der Rechnung − Rückzahlungen an der Gutschrift; Gutschrift „Rückzahlung offen“/„erstattet“/„–“

**Buchungsquelle:** erlaubte Werte um „Airbnb“ erweitert. Eine **Plattform-Buchung** ist eine mit Quelle booking.com oder Airbnb (später zusätzlich der Kanal aus dem Import).

### Schreiben: über Datenbankfunktionen
Erfassen, Bearbeiten/Umhängen und Löschen laufen über **eigene Datenbankfunktionen**, die Server-Aktionen der App aufrufen. Jede Funktion:
1. prüft Person und Rolle (Erfassen: Inhaber und Mitarbeiter; Ändern/Löschen: nur Inhaber), Kunde aktiv
2. **sperrt die Rechnung** für die Dauer des Schritts. Das Ausstellen einer Gutschrift (PROJ-44) sperrt dieselbe Rechnung. Damit kann eine Zahlung nie auf eine gerade stornierte Rechnung fallen („Diese Rechnung wurde inzwischen storniert“)
3. prüft alle Regeln der Spec: Rechnung zahlbar (bzw. Gutschrift bei Rückzahlung), Datum nicht in der Zukunft, Beträge, Provision nur bei Plattform-Buchung, Zahlungsart aktiv (beim Bearbeiten bleibt die bisherige erlaubt), Beleg gehört zum Kunden
4. liefert Hinweise (Überzahlung, gleiche Zahlung schon erfasst, Rückzahlung über Guthaben) zurück, solange sie nicht bestätigt sind; mit Bestätigung wird gespeichert
5. schreibt das Protokoll

Lesen ist über die Zugriffsregeln (RLS) für alle Mitglieder des Kunden erlaubt; direktes Schreiben in die Tabelle ist gesperrt. So kann ein Mitarbeiter auch am Formular vorbei nichts ändern oder löschen.

**„Bereits bezahlt“ beim Nacherfassen:** Rechnung und Zahlung entstehen in **einem** Datenbankschritt, damit nie eine halbe Erfassung übrig bleibt.

**Zahlungsarten** schreibt nur der Inhaber, direkt über Zugriffsregeln; die Regeln „mindestens eine aktiv“, „Standard nicht deaktivierbar“ und „löschen nur unbenutzt“ prüft die Datenbank zusätzlich.

### Belege
- Neuer **privater Speicherbereich** je Kunde, nur PDF und JPEG, bis 10 MB. Bilder werden wie beim Reisedokument im Browser umgewandelt (bestehender Baustein), PDFs unverändert hochgeladen.
- Hochladen direkt vom Browser in den Speicher (Grenze der Server-Anfragen auf Vercel), unter zufälligem Namen; Mitglieder dürfen hochladen, nur Inhaber löschen.
- Ansehen über kurzlebige, signierte Links, nur für Mitglieder des Kunden.
- Wird ein Beleg ersetzt, entfernt oder die Zahlung gelöscht, löscht der Server die alte Datei. Liegengebliebene Dateien (Hochladen gelungen, Speichern nicht) entfernt die **bestehende nächtliche Aufräumaufgabe**, erweitert um diesen Bereich.

### Zahlungsstatus, Fälligkeit und Vorschläge
- Die **Datenbank** bildet Status und Summen (Lesesicht). Eine **gleichlautende Regel in der App** berechnet nur Vorschläge und Hinweise im Dialog (Offen-Betrag, „Zahlungsbetrag“ nach Abzug von Provision und Gebühr, Überzahlung). Gespeichert und angezeigt wird immer das Ergebnis der Datenbank.
- „Überfällig“: heute (Wien) nach einem Fälligkeitstag, und Beglichen kleiner als bis dahin fällig. Nacherfasste Rechnungen haben keinen Zahlungsplan.

### Listen
- **Rechnungsliste** und **Rechnungen dieser Buchung** lesen den Zahlungsstand zusätzlich aus der Lesesicht; die Buchungssummen „Bezahlt/Offen“ ergeben sich daraus.
- **Zahlungsliste:** eigene Lesesicht (Zahlung mit Rechnung, Empfänger, Buchung, Zahlungsart), gefiltert nach Monat, Art und Suche, je 50; die Summen kommen aus einer eigenen Abfrage über denselben Filter, damit sie alle Seiten umfassen. Passende Datenbank-Indizes für Kunde + Datum halten die Liste unter einer Sekunde.

### Rechte (Zusammenfassung)
| | Inhaber | Mitarbeiter | Betreiber |
|---|---|---|---|
| Lesen (RLS) | ja | ja | nein (keine Ausnahme für den Betreiber, anders als bei Rechnungen) |
| Erfassen (Funktion) | ja | ja | nein |
| Ändern, Umhängen, Löschen (Funktion) | ja | nein | nein |
| Belege hochladen / löschen | ja / ja | ja / nein | nein |
| Zahlungsarten | ja | nein | nein |
| Seiten | alle | „Zahlungen“, Dialoge; nicht Einstellungen → Zahlungen | – |

### Für /frontend und /backend
- **/frontend:** Abschnitte in Rechnungsdetail und Buchungsdetail, Zahlungs-Dialog (inkl. Umhängen, Rückzahlung, Belege, Hinweise), Spalte „Zahlung“, Schalter „Bereits bezahlt“, Seite „Zahlungen“, Reiter „Einstellungen → Zahlungen“, Menüpunkt freischalten (alle Rollen), Buchungsquelle „Airbnb“ in Formular, Detail und Filter, Texte in der Übersetzungsdatei, Regel-Datei mit Tests. Bis zur Migration zeigen die Seiten leere Zustände, Speichern meldet „wird eingerichtet“.
- **/backend:** Tabellen, Standardarten (Migration + neue Kunden), Buchungsquelle „Airbnb“, Zugriffsregeln, Schreibfunktionen mit Sperre, Lesesichten, Löschsperre für Rechnungen mit Zahlungen, Speicherbereich mit Regeln, Aufräumaufgabe erweitern, Protokoll, Indizes.

### Für /qa
- Gleichzeitig: Zahlung erfassen, während die Rechnung storniert wird; zwei Personen erfassen dieselbe Zahlung
- Am Formular vorbei: Mitarbeiter ändert/löscht, Betreiber liest, fremder Kunde, Zahlung an Entwurf/Gutschrift/negative Altrechnung, Provision bei Nicht-Plattform-Buchung, deaktivierte Zahlungsart, Datum in der Zukunft
- Rechenregeln: Status-Grenzen, Schlussrechnung nach Abzug, Überzahlung, Guthaben ohne Provision, „überfällig“ am und nach dem Fälligkeitstag
- Belege: HEIC aus dem iPhone, PDF über 10 MB, fremder Link, Ersetzen löscht alte Datei
- Löschsperre der nacherfassten Rechnung; „Bereits bezahlt“ in einem Schritt
- Layout und axe auf drei Breiten, Safari-Zeilenklick in der Zahlungsliste

### Abhängigkeiten
Keine neuen Pakete (Bildumwandlung, Hochladen, Griff zum Ordnen und Monatsauswahl sind vorhanden).

## Implementation Notes (Frontend)

**Gebaut (2026-11-06):** Abschnitt „Zahlungen“ bzw. „Rückzahlungen“ im Rechnungsdetail (ausgestellte und nacherfasste Rechnungen, Gutschriften) mit Liste, Summen, Status, Fälligkeit samt „überfällig“, Hinweis bei stornierter Rechnung mit Guthaben und Knöpfen; Zahlungs-Dialog für Erfassen, Bearbeiten/Umhängen (Suche nach anderer Rechnung), Rückzahlung, Provision/Zahlungsgebühr bei Plattform-Buchungen mit mitlaufendem Vorschlag für „Ausbezahlt“, Beleg (PDF oder umgewandeltes Foto) und Bestätigungsdialog für Hinweise der Datenbank; im Buchungsdetail Status und Offen je Rechnung, „Bezahlt/Offen“ und „Zahlung erfassen“ mit Rechnungsauswahl; Spalte „Zahlung“ in der Rechnungsliste (Handy: Kennzeichen in der Karte); Seite „Zahlungen“ (Menüpunkt für Inhaber und Mitarbeiter) mit Monats-Sprungauswahl, „Alle Monate“, Zahlungsart, Suche, Summen, Blättern, Tabelle/Karten; Einstellungen → Zahlungen (Zahlungsarten anlegen, umbenennen, per Griff ordnen, Standard, deaktivieren, löschen); „Bereits bezahlt“ im Formular „Rechnung nacherfassen“ (nur beim Anlegen und bei Betrag > 0; Provision/Gebühr bei Plattform-Buchung); Buchungsquelle „Airbnb“ (Formular, Detail, Filter `?quelle=airbnb`, ohne Kalenderfarbe); Löschsperre-Meldung für Rechnungen mit Zahlungen.

**Bis zur Migration:** Die Lesefunktionen erkennen fehlende Tabellen/Sichten/Funktionen und zeigen den Stand ohne Zahlungen (alle zahlbaren Rechnungen „offen“), leere Listen und den Hinweis „wird gerade eingerichtet“. Speichern meldet „Diese Funktion wird gerade eingerichtet.“; „Bereits bezahlt“ ist dann gesperrt. Achtung: Die Buchungsquelle „Airbnb“ lehnt die Datenbank bis zur Migration ab (Prüfregel der Spalte).

**Regeln und Dateien**
- `src/lib/payments.ts`: Typen, Grenzen, `computePaymentState` (gleiche Regel wie die Lesesicht), `statusOf`, `dueByToday`/`isOverdue`, `suggestedAmountCents`, `overpaidByCents`, `isPlatformSource`, Filter der Zahlungsliste in der Adresse, Belegprüfung (Tests: `payments.test.ts`, 18)
- `src/lib/validation/payments.ts`: `paymentSchema`, `alreadyPaidSchema`, `paymentMethodNameSchema`
- `src/lib/payments-data.ts`: `getPaymentMethods`, `getPaymentMethodsWithUsage`, `getPaymentStates`, `getPlatformBookings`, `getInvoicePayments`, `getPaymentPage`, `hasAnyPayment`, `receiptLink`; `src/lib/payment-files.ts`: `removeReceiptFiles`
- Aktionen: `src/app/(app)/zahlungen/actions.ts` (`recordPayment`, `updatePayment`, `deletePayment`, `prepareReceiptUpload`, `openReceipt`, `searchPayableInvoices`, `listActivePaymentMethods`), `src/app/(app)/einstellungen/zahlungen/actions.ts` (Zahlungsarten); `saveInvoice` nimmt `alreadyPaid`, `loadInvoiceBooking` liefert `platform`
- Bausteine `src/components/payments/`: `invoice-payments`, `payment-dialog`, `payment-buttons`, `payment-status`, `receipt-field`, `receipt-link`, `payment-filters`, `payment-list`, `payment-methods-settings`, `already-paid-fields`; geändert: `booking-invoices`, `invoice-list`, `invoice-panel`, `settings-tabs`, `navigation.ts`
- Texte: `messages/de.json` → `payments.*`, `paymentMethods.*`, `bookings.source.airbnb`, `invoices.col.payment`, `invoices.errors.invoiceHasPayments`, `settings.payments`

**Vertrag für /backend** (so ruft die Oberfläche die Datenbank auf; Namen dürfen sich in /backend ändern, dann hier und im Code nachziehen)
- Tabelle `payment_methods` (id, tenant_id, name, position, active, is_default; Name je Kunde eindeutig ohne Groß-/Kleinschreibung → Fehler 23505; Verweis von Zahlungen → 23503 beim Löschen); Standardarten für bestehende und neue Kunden; Funktionen `set_default_payment_method(p_tenant_id, p_method_id)`, `reorder_payment_methods(p_tenant_id, p_ids uuid[])`; Regeln „mindestens eine aktiv“ (P0962), „Standard nicht deaktivierbar“ (P0963), Stand (P0964)
- Tabelle `payments` (id, tenant_id, invoice_id, kind payment|refund, paid_on, amount_cents, commission_cents, fee_cents, method_id, note, receipt_path, created_by → `payments_created_by_fkey` auf profiles, created_at, updated_by, updated_at); RLS lesen für Mitglieder ohne Betreiber-Ausnahme, kein direktes Schreiben
- `record_payment(p_input jsonb)` / `update_payment(p_input jsonb mit id, updated_at)`: Eingaben tenant_id, kind, invoice_id, paid_on, amount_cents, commission_cents, fee_cents, method_id, note, receipt_path, confirmed. Antwort `{ saved, id, warnings: [{code: overpaid|duplicate|refundOver, cents, date?}], invoice_id, previous_invoice_id, booking_ids, unused_receipt }`; ohne `confirmed` und mit Hinweisen `saved: false`. Fehler P0950 Rolle, P0951 nicht gefunden, P0952 nicht zahlbar, P0953 storniert, P0954 keine Gutschrift, P0955 Datum Zukunft, P0956 Betrag, P0957 Provision nicht erlaubt, P0958 Zahlungsart inaktiv, P0959 Beleg fehlt, P0960 Stand, P0016 Kunde deaktiviert
- `delete_payment(p_payment_id)` → `{ invoice_id, booking_id, receipt_path }`
- Lesesicht `invoice_payment_status` (invoice_id, tenant_id, mode none|payable|cancelled|credit, status, total/received/commission/fee/settled/open/balance/refunded_cents, overdue)
- Lesesicht `payment_list` (Spalten der Zahlung + method_id, method_name, invoice_number, recipient, booking_id, booking_number, note, created_at, receipt_path) und Funktion `payment_list_totals(p_tenant_id, p_from, p_to, p_method_id, p_query)` → received_cents (Rückzahlungen abgezogen), commission_cents, fee_cents
- `search_payable_invoices(p_tenant_id, p_query, p_booking_id, p_limit)` → id, number, kind, recipient, open_cents, booking_id, platform (gleiche Buchung zuerst)
- `save_invoice`: optional `already_paid { paid_on, method_id, commission_cents, fee_cents }` nur beim Anlegen, Zahlung über den vollen Betrag im selben Schritt; `delete_invoice` mit Zahlungen → P0961
- Speicherbereich `payment-receipts` (privat, PDF/JPEG, 10 MB, Ordner je Kunde; Mitglieder laden hoch, Server löscht), tägliche Bereinigung erweitern
- Buchungsquelle `airbnb` in der Prüfregel der Spalte `bookings.source`

**Refine 2026-11-07 (Felder nach Zahlungsart):** Im Zahlungs-Dialog steht die Zahlungsart direkt nach dem Datum (vorbelegt mit der Standard-Zahlungsart „Überweisung“). „Provision“ und „Zahlungsgebühr“ erscheinen nach Zahlungsart (`methodDeductions` in `src/lib/payments.ts`: Name enthält „booking.com“ → beide, „Airbnb“ → nur Provision), vor dem Betragsfeld, das dann „Zahlungsbetrag“ heißt (früher „Ausbezahlt“). Beim Wechsel der Zahlungsart werden nicht mehr passende Felder geleert, der Vorschlag folgt. Felder mit Wert > 0 bleiben beim Bearbeiten älterer Zahlungen sichtbar. Die Sperre nach Buchungsquelle bleibt (Hinweis jetzt an der Zahlungsart). „Bereits bezahlt“ beim Nacherfassen gleich: Felder nach Zahlungsart, Hinweis bei Rechnung ohne Plattform-Buchung statt stillem Verwerfen. Keine Datenbankänderung.

## Implementation Notes (Backend)

**Gebaut (2026-11-06), in Dev eingespielt:** Migrationen `20261106171901_payments.sql` und `20261106173728_payments_save_invoice_check.sql` (stellt die Sperre für abgezogene nacherfasste Rechnungen aus PROJ-42 in `public.save_invoice` wieder her, die die erste Migration beim Ergänzen von „Bereits bezahlt“ verloren hatte). Der Vertrag aus den Frontend-Notizen ist unverändert umgesetzt.

- **Tabellen:** `payment_methods` (Name je Kunde eindeutig ohne Groß-/Kleinschreibung, höchstens ein Standard, Standard immer aktiv) und `payments` (Zahlung/Rückzahlung, Beträge in Cent, Rückzahlung ohne Provision/Gebühr, Beleg im Ordner des eigenen Kunden, Verweis auf Rechnung mit Kaskade, auf Zahlungsart ohne Kaskade → benutzte Arten nicht löschbar). Standardfelder und Änderungsprotokoll über `private.enable_tenant_table`.
- **Zugriff:** Lesen nur Mitglieder (ohne Betreiber-Ausnahme, auch in den Lesesichten). Zahlungen ohne direktes Schreiben; `record_payment`/`update_payment` (gemeinsamer Kern `private.save_payment`) und `delete_payment`. Zahlungsarten: Inhaber schreiben Name/aktiv direkt (Spaltenrechte), Reihenfolge und Standard über `reorder_payment_methods`/`set_default_payment_method`; Regeln per Trigger (neue Art ans Ende, Standard nicht deaktivierbar/löschbar, letzte aktive Art bleibt, deaktivierter Kunde), Ausnahme beim Löschen des ganzen Kunden.
- **Standardarten:** für alle 14 Kunden in Dev angelegt; neue Kunden bekommen sie per Trigger auf `tenants`.
- **Gleichzeitigkeit:** `save_payment` sperrt die Rechnung (beim Umhängen beide, in fester Reihenfolge), wie `issue_credit_note`; Stand der Zahlung über `updated_at` (P0960).
- **Regeln in der Datenbank:** zahlbar (keine Entwürfe, Gutschriften, Altrechnungen ≤ 0), storniert (keine neuen Zahlungen; vorhandene bleiben änderbar, solange sie an der stornierten Rechnung bleiben), Rückzahlung nur an Gutschriften, Provision/Gebühr nur bei Plattform-Buchung (`private.is_platform_booking`: Quelle booking.com/Airbnb oder Kanal; eine bestehende Zahlung an derselben Rechnung behält ihre Werte), Zahlungsart aktiv (beim Ändern auch die bisherige), Datum nicht in der Zukunft (Wien), Beleg vorhanden und nur an einer Zahlung. Hinweise: Überzahlung, gleiche Zahlung (Datum + Betrag), Rückzahlung über dem Guthaben.
- **Lesesichten:** `invoice_payment_status` (gleiche Regel wie `computePaymentState`; überfällig aus `issued_snapshot.schedule`) und `payment_list`, beide `security_invoker`; Summen über `payment_list_totals`.
- **„Bereits bezahlt“:** `public.save_invoice` legt nach dem Speichern im selben Schritt die Zahlung über den vollen Betrag an (Betrag = Rechnungsbetrag − Provision − Gebühr); ungültige Angaben rollen beides zurück (Meldung `alreadyPaidInvalid`).
- **Löschsperre:** `delete_invoice` lehnt Rechnungen mit Zahlungen ab (P0961).
- **Belege:** Speicherbereich `payment-receipts` (privat, PDF/JPEG, 10 MB); Mitglieder laden in den eigenen Ordner, lesen nur verwendete Belege; Löschen nur der Server (`removeReceiptFiles`, beim Löschen eines Kunden `removeTenantReceipts`). Die tägliche Bereinigung (`/api/cron/ausweisbilder`) entfernt Belege ohne Zahlung nach 24 Stunden (`unused_payment_receipts`).
- **Buchungsquelle „airbnb“** in der Prüfregel von `bookings.source`.
- **Tests:** `supabase/tests/payments.integration.test.ts` (18 Tests: Zahlungsarten und Regeln, Erfassen/Status/Hinweise, Zahlbarkeit, Provision, überfällig, Rechte, kein direktes Schreiben, fremder Kunde und Betreiber, Löschsperre, Storno/Rückzahlung/Umhängen, Suche, Belege, „Bereits bezahlt“ samt Zurückrollen, Zahlungsliste und Summen); Cron-Test um Belege erweitert; der Buchungstest prüft statt „airbnb“ jetzt einen unbekannten Wert. Alle Integrationstests außer den Anmelde-Dateien (Anmeldegrenzen) und alle 738 Unit-Tests grün; Build und Lint sauber; Advisors nur mit der bekannten Auth-Warnung „OTP-Ablauf“.
- **Für /deploy:** beide Migrationen vor dem Code einspielen; danach legt die Migration bei jedem Kunden die Standardarten an.

## QA Test Results

**Tested:** 2026-11-06
**App URL:** http://localhost:3000 (Produktions-Build, Supabase „apppa-dev“)
**Tester:** QA Engineer (AI)
**Automatisiert:** `tests/PROJ-45-zahlungserfassung.spec.ts` (15 E2E-Tests, Abläufe Desktop, Layout/axe Desktop/Tablet/Handy), `supabase/tests/payments.integration.test.ts` (18), `src/lib/payments.test.ts` (18), neu `src/lib/validation/payments.test.ts` (7)

### Acceptance Criteria Status

#### Zahlung erfassen
- [x] Vorbelegung Datum heute, Betrag = Offen-Betrag, Standard-Zahlungsart; ohne Plattform-Buchung keine Provisionsfelder (E2E)
- [x] Pflichtfelder, Datum in der Zukunft, Betrag 0, Notiz > 300 Zeichen: Meldungen, nichts gespeichert (E2E, Unit)
- [x] Datum vor dem Rechnungsdatum ohne Hinweis (Integration)
- [x] Nur aktive Zahlungsarten in der Reihenfolge der Einstellungen (E2E, Integration)
- [x] Liste mit Datum, Art, Betrag, Notiz, „erfasst von [Name] am [Datum]“ (E2E)
- [x] Fehlermeldung bei Server-Fehler, Eingaben bleiben (Dialog bleibt offen; geprüft mit „nicht gefunden“ während der Fehlersuche)

#### Beleg
- [x] PDF anhängen, Beleg-Symbol öffnet ihn (E2E; Ablage `<Kunde>/<zufällig>.pdf`)
- [x] Bild (PNG) wird als JPEG gespeichert; falsches Format (.docx) abgelehnt (E2E)
- [x] Fremder Kunde liest den Beleg nicht, lädt nicht in fremde Ordner (Integration)
- [x] Ersetzen/Entfernen meldet den alten Beleg zum Löschen (Integration)
- [ ] Nicht automatisiert: PDF über 10 MB im Browser, HEIC vom iPhone (Umwandlung = Baustein aus PROJ-29, dort getestet)

#### Status und Offen-Betrag
- [x] offen → teilweise → bezahlt → überzahlt mit Offen „-€ 50,00“ (E2E, Integration)
- [x] Hinweis „um € … überzahlt“ und „gleiche Zahlung“, nach Bestätigung gespeichert (E2E, Integration)
- [x] Schlussrechnung nach Abzug, Löschen/Ändern berechnet neu (Integration, Regel-Tests)
- [x] Bezahlt: Betrag leer (E2E); Entwurf und Altrechnung ≤ 0 ohne Status/Knopf (Integration)

#### Fälligkeit
- [x] Überfällig nach dem Fälligkeitstag, nicht am Tag selbst; Anzahlung überfällig, nach Zahlung nicht mehr (Integration); „überfällig“ im Rechnungsdetail (E2E)
- [x] Nacherfasste Rechnungen nie überfällig (Regel-Tests)

#### Buchungsdetail und Rechnungsliste
- [x] Status je Rechnung, „Bezahlt“/„Offen“, „Zahlung erfassen“ mit vorausgewählter Rechnung (E2E)
- [x] Spalte „Zahlung“ in der Rechnungsliste (E2E)

#### Storno, Umhängen, Rückzahlung
- [x] Stornierte Rechnung „Guthaben € …“, kein „Zahlung erfassen“; Gutschrift „Rückzahlung offen“, Rückzahlung vorbelegt, danach „erstattet“, Betrag „-€ …“ (E2E)
- [x] Umhängen auf andere Rechnung, Rückweg auf stornierte Rechnung gesperrt, Provision nur auf Plattform-Buchung, Suche gleiche Buchung zuerst (Integration)
- [x] Rückzahlung über Guthaben mit Hinweis (Integration)

#### Bearbeiten und Löschen
- [x] Inhaber ändert (inkl. Zahlungsart) und löscht mit Bestätigung (E2E)
- [x] Löschsperre der nacherfassten Rechnung mit Zahlungen, Meldung wie in der Spec (E2E)
- [x] BUG-2 behoben (Nachtest): Löschen wechselt zuverlässig zur Liste mit „Rechnung gelöscht.“ (11 von 11 Läufen)

#### Nacherfassen mit „Bereits bezahlt“
- [x] Datenbank: Zahlung über den vollen Betrag im selben Schritt, mit Provision, Zurückrollen bei ungültiger Zahlungsart (Integration)
- [x] BUG-1 behoben (Nachtest): Schalter zeigt Zahlungsdatum (= Rechnungsdatum) und Standard-Zahlungsart; Rechnung danach „bezahlt“ (E2E)

#### Zahlungsliste
- [x] Monat mit Summen (eingegangen, Provision, Gebühr), Filter Zahlungsart (in der Adresse), Suche nach Notiz, „Alle Monate“, leerer Zeitraum, leere Liste (E2E, Integration)
- [x] Handy: Karten ohne waagrechtes Scrollen, ohne axe-Fehler (E2E Layout); Tipp auf Karte nicht eigens automatisiert

#### Einstellungen → Zahlungen
- [x] Standardarten, anlegen, doppelter Name, Standard nicht deaktivierbar, Deaktivieren nimmt die Art aus der Auswahl (E2E); Reihenfolge, Standard wechseln, letzte aktive Art, benutzte Art nicht löschbar (Integration)

#### Rechte
- [x] Mitarbeiter sehen und erfassen mit Beleg, keine Knöpfe zum Ändern, Einstellungen → Zahlungen nicht erreichbar, Menüpunkt „Zahlungen“ vorhanden (E2E); Ändern/Löschen auch direkt abgelehnt (Integration)
- [x] Betreiber und fremder Kunde: keine Zahlungen, keine Zahlungsarten, kein Zahlungsstand, kein Erfassen (Integration)

#### Allgemein
- [x] Rechnungsdetail, Zahlungsliste, Einstellungen → Zahlungen auf 375/768/1440 px ohne waagrechtes Scrollen und ohne axe-Fehler (E2E)
- [x] Formate „€ 1.234,56“, „-€ 50,00“ rot, „Fr, 06.11.2026“

### Edge Cases Status
- [x] Gleiche Zahlung zweimal: Hinweis, Speichern möglich (Integration, E2E)
- [x] Rechnung storniert, dann Zahlung: abgelehnt „inzwischen storniert“ (Integration); echte Gleichzeitigkeit durch die Sperre auf der Rechnung (Code geprüft, kein Lasttest)
- [x] Teilrechnung bezahlt + Schlussrechnung: keine Verrechnung (Regel)
- [x] Zahlungsart deaktiviert: Speichern abgelehnt (Integration)
- [x] Überzahlt, dann storniert: Guthaben = eingegangen ohne Provision (Integration)
- [x] Buchungsquelle „Airbnb“: Formular/Filter (E2E), Datenbank (Integration)

### Security Audit Results
- [x] Ohne Anmeldung: Tabellen, Lesesichten und Funktionen abgelehnt (42501), internes Schema nicht erreichbar (PGRST106)
- [x] Mandantentrennung: fremder Inhaber liest und schreibt nichts, auch nicht mit eigenem Kunden in der Eingabe (P0951); Summen für fremden Kunden leer
- [x] Betreiber ohne Mitgliedschaft: keine Zahlungen, Zahlungsarten, kein Zahlungsstand
- [x] Rollen: Mitarbeiter ändern/löschen weder über die Oberfläche noch direkt (P0950); kein direktes Schreiben in `payments`, auch nicht für Inhaber
- [x] Belege: nur eigener Ordner, nur verwendete Belege lesbar, Beleg nicht an zwei Zahlungen, Pfadformat geprüft
- [x] Eingaben: Beträge, Datum, Notiz in Datenbank und Server geprüft; Notiz wird als Text dargestellt (kein HTML)
- [ ] Hinweis (Low, kein Bug): Mitglieder können beliebig viele Dateien in den eigenen Beleg-Ordner laden; ungenutzte räumt die tägliche Bereinigung nach 24 Stunden weg

### Bugs Found

#### BUG-1: „Bereits bezahlt“ lässt die Seite abstürzen
- **Severity:** High
- **Steps to Reproduce:**
  1. Rechnungen → „Rechnung nacherfassen“, Nummer, Datum, Empfänger und eine Position mit Betrag > 0 eintragen
  2. Schalter „Bereits bezahlt“ einschalten
  3. Expected: Zahlungsdatum, Zahlungsart und Hinweis „Betrag der Zahlung: € …“ erscheinen
  4. Actual: „Da ist etwas schiefgelaufen. Die Seite konnte nicht geladen werden.“
- **Ursache:** `src/components/payments/already-paid-fields.tsx` setzt `<FormDescription>` außerhalb eines `FormField`/`FormItem`; `useFormField` wirft „should be used within <FormField>“, sobald der Betrag angezeigt wird. Abhilfe: einfacher Absatz statt `FormDescription`.
- **Test:** E2E „Nacherfassen mit ‚Bereits bezahlt‘“ schlägt fehl
- **Priority:** Fix before deployment
- **Status:** behoben 2026-11-06: einfacher Absatz statt `FormDescription`; dabei gefunden und behoben: die Standard-Zahlungsart war nicht vorbelegt (wird jetzt gesetzt, sobald die Liste geladen ist)

#### BUG-2: Nach „Rechnung löschen“ bleibt die Seite sporadisch auf „Seite nicht gefunden“ (Regression PROJ-37)
- **Severity:** High (bestehender E2E-Test schlägt fehl)
- **Steps to Reproduce:**
  1. Nacherfasste Rechnung ohne Zahlungen öffnen, „Löschen“ → „Endgültig löschen“
  2. Expected: Wechsel zur Rechnungsliste mit „Rechnung gelöscht.“
  3. Actual: in etwa jedem zweiten Lauf bleibt die Adresse auf `/rechnungen/<id>` und die Seite zeigt „Seite nicht gefunden“ (die Rechnung ist gelöscht)
- **Nachweis:** PROJ-37-Test „Löschen – Abbrechen behält, Bestätigen entfernt …“ 2 von 4 bzw. 1 von 2 Läufen rot; mit vorübergehend ausgeblendetem Abschnitt „Zahlungen“ 4 von 4 grün. Vermutlich überholt das Neuladen der Detailseite (zusätzliche Abfragen des Zahlungsabschnitts) die Weiterleitung aus `deleteInvoice` (bekanntes Next-16-Verhalten, siehe `router-push`-Notiz); die Rückfall-Weiterleitung nach 4 s kommt nicht rechtzeitig.
- **Priority:** Fix before deployment
- **Status:** behoben 2026-11-06: `deleteInvoice` leitet nicht mehr selbst weiter; der Browser wechselt fest zur Liste (`/rechnungen?geloescht=1`), die Liste zeigt die Bestätigung über `DeletedNotice` (Muster aus dem Gast-Löschen, PROJ-7). Vermutete Ursache: Neuladen der aktuellen Seite nach der Aktion (Cookies der Sitzung bzw. revalidatePath) überholte die Weiterleitung; mit dem schwereren Rechnungsdetail häufiger. Nur `revalidatePath` wegzulassen reichte nicht (5 von 6)

#### BUG-3: Gutschrift ohne Zahlungen zeigt einen leeren Abschnitt „Rückzahlungen“
- **Severity:** Low
- **Steps to Reproduce:** Rechnung ohne Zahlungen stornieren, Gutschrift öffnen
- **Expected (Spec):** Zahlungsstatus „–“, kein Knopf
- **Actual:** kein Knopf (richtig), aber Abschnitt mit „Noch keine Rückzahlung erfasst.“ und Summen € 0,00
- **Priority:** Nice to have
- **Status:** behoben 2026-11-06: Abschnitt entfällt bei Gutschrift ohne Guthaben und ohne Rückzahlungen (E2E „BUG-3“)

### Testpflege (keine Bugs, durch die Spec beabsichtigt)
- `tests/PROJ-37-rechnungen-nacherfassen.spec.ts`: Spaltenköpfe mit „Zahlung“; „Zahlungen“ steht zwischen „Rechnungen“ und „Einstellungen“
- `tests/PROJ-2-app-shell.spec.ts`: „Zahlungen“ ist fertig (nicht mehr unter den fehlenden Bereichen, nicht mehr 404), Tastaturtest mit einem Tab mehr

### Regression
- PROJ-37 (Liste, Nacherfassen, Rollen, Layout), PROJ-44 (Ausstellen und Wirkung, QA-Fälle), PROJ-30 (Quelle), PROJ-2 (Desktop und Handy): grün außer BUG-2
- Integrationstests aller Bereiche grün (außer Anmelde-Dateien, wegen Anmeldegrenzen nicht gelaufen); 745 Unit-Tests grün
- Nicht geprüft: Firefox und Safari (optional, nicht gelaufen)

### Nachtest nach den Korrekturen (2026-11-06)
- PROJ-45 E2E (Desktop): alle 16 grün, darunter der neue Regressionstest „BUG-3“
- PROJ-37 „Löschen – Abbrechen behält, Bestätigen entfernt …“: 11 von 11 Läufen grün; Block „Bearbeiten, Löschen, Buchungsdetail“ 7 von 8, der eine Ausreißer beim **Anlegen** (Detailseite erschien nicht binnen 5 s), in 5 Wiederholungen danach nicht mehr aufgetreten — als Beobachtung notiert, kein reproduzierbarer Fehler
- PROJ-7 Gast löschen (gemeinsamer Baustein `DeletedNotice`): grün
- 745 Unit-Tests, Lint, Typen: grün

### Summary
- **Acceptance Criteria:** alle bestanden (nach Nachtest)
- **Bugs Found:** 3 total (0 critical, 2 high, 0 medium, 1 low) — alle behoben
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy (beide Migrationen vor dem Code einspielen)

## Deployment

- **Datum:** 2026-11-06
- **Commit:** `9f55218`, Tag `v1.27.0-PROJ-45`
- **Staging:** https://staging.apppa.at; vom Nutzer geprüft und freigegeben („liefere nach prod aus“). Staging hat derzeit keinen Kunden, die Standard-Zahlungsarten entstehen dort beim Anlegen eines Kunden
- **Produktion:** https://app.apppa.at, vom Nutzer als „Ready“ und geprüft gemeldet. Beide Kunden haben je 6 Zahlungsarten („Überweisung“ Standard), noch keine Zahlungen; Speicherbereich `payment-receipts` angelegt
- **Migrationen** in Staging und Produktion, in dieser Reihenfolge: `20261106171901_payments.sql`, `20261106173728_payments_save_invoice_check.sql`. `db advisors`: nur der bekannte Auth-Hinweis (OTP-Ablauf)
- **Vorprüfung:** Lint, Unit 745, Build, Secret-Scan sauber. Integration: der gemeinsame Lauf von `npm test` scheiterte an Zeitüberschreitungen der Dev-Datenbank (96 Tests, nur Timeouts); einzeln liefen alle Dateien grün, rot blieb zeitweise nur der bekannte RLS-Test „Person ohne Mitgliedschaft“ (Testreste im Dev-Protokoll, ~19.800 Zeilen)
- **Kein `config push`**, keine neuen Umgebungsvariablen
- **Hinweis für den Betrieb:** Bestehende nacherfasste Rechnungen gelten als „offen“, bis eine Zahlung erfasst wird (Spec)
