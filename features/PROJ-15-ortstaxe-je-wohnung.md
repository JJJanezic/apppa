# PROJ-15: Ortstaxe je Wohnung

## Status: Planned
**Created:** 2026-11-01
**Last Updated:** 2026-11-01

## Dependencies
- Requires: PROJ-6 (Wohnungsverwaltung): Wohnungsformular unter *Einstellungen → Wohnungen*, nur Inhaber
- Requires: PROJ-8 (Manuelle Buchungen): Erwachsene, Kinder, Mitreisende mit Geburtsdatum, Zusatzkosten, „Preis prüfen“, Rollenregeln für Preise
- Requires: PROJ-7, PROJ-29 (Gäste): Geburtsdatum des Hauptgasts
- Requires: PROJ-30 (Buchungs-Erweiterung): tatsächliche Abreise (Abgabe-Nächte), abgerechnete Nächte und abgerechneter Übernachtungspreis, „Wohnsitz angemeldet“
- Requires: PROJ-32, PROJ-34, PROJ-35 (Zusatzkosten): Positionen mit Bezeichnung, Betrag, Reihenfolge und USt-Satz
- Requires: PROJ-36 (Kleinunternehmer-Status): Nettobetrag bei Kleinunternehmern = Bruttobetrag
- Wird genutzt von: PROJ-40 (Rechnungsentwurf übernimmt die Abgabe-Positionen wie jede Zusatzposition), PROJ-42 (Ausstellen mit PDF), PROJ-16 (Monatsbericht und Export), PROJ-11 (importierte Buchungen, siehe Open Questions)

## Überblick
Die Ortstaxe ist in Österreich je Bundesland und Gemeinde unterschiedlich geregelt, heißt je nach Gebiet anders (z. B. „Nächtigungsabgabe“, „Ortstaxe“, „Aufenthaltsabgabe“) und ändert sich mit der Zeit. Darum wird sie **je Wohnung** als **Verlauf von Tarifen** („gültig ab“) hinterlegt. Die App berechnet daraus die Abgabe jeder Buchung und legt sie als **Zusatzkosten-Position je Tarif** an.

### Tarife an der Wohnung (*Einstellungen → Wohnungen*, Wohnung bearbeiten)
- Neuer Abschnitt „Ortstaxe“ im Wohnungsformular, gespeichert mit dessen Speichern-Schaltfläche.
- Oben der aktuelle Tarif, z. B. „Aktuell: Nächtigungsabgabe € 2,50 pro Person und Nacht, befreit unter 15 Jahren, seit Do, 01.01.2026“. Ohne Eintrag: „Keine Ortstaxe hinterlegt: Buchungen dieser Wohnung erhalten keine Abgabe.“
- Darunter die Liste der Einträge, neueste oben. Einträge lassen sich hinzufügen, ändern und entfernen.
- Jeder Eintrag:

| Feld | Pflicht | Regeln |
|------|---------|--------|
| Gültig ab | ja | Datum; je Wohnung eindeutig |
| Bezeichnung | ja | Freitext, max. 100 Zeichen; Vorschläge „Nächtigungsabgabe“, „Ortstaxe“, „Aufenthaltsabgabe“ |
| Berechnungsart | ja | „Betrag pro Person und Nacht“ oder „Prozent vom Übernachtungspreis“ |
| Betrag | bei Betrag | € mit 2 Nachkommastellen, ab € 0,00 |
| Prozentsatz | bei Prozent | 2 Nachkommastellen, größer 0 bis 100 |
| Basis | bei Prozent | „Übernachtungspreis netto (ohne USt)“ oder „brutto (mit USt)“ |
| Befreit unter … Jahren | nein, nur bei Betrag | ganze Zahl 1–18; leer = keine Altersbefreiung |
| USt-Satz | ja | Prozent mit 2 Nachkommastellen, vorbelegt 0,00 |

- Ein Eintrag mit Betrag € 0,00 bedeutet „ab diesem Tag keine Abgabe“ (z. B. abgeschafft).

### Welcher Tarif gilt?
- **Je Nacht** gilt der jüngste Eintrag, dessen „gültig ab“ am oder vor dem Datum dieser Nacht liegt (Nacht = Datum, an dem sie beginnt).
- Nächte vor dem ersten Eintrag sind abgabefrei; die Buchung zeigt dann einen Hinweis.
- Reicht ein Aufenthalt über einen Tarifwechsel, entsteht **je Tarif-Eintrag eine eigene Position**, auch wenn die Bezeichnung gleich ist (für die Rechnung nötig).

### Berechnung „Betrag pro Person und Nacht“
- **Abgabe-Nächte** = Anreise bis tatsächliche Abreise (PROJ-30).
- **Personen** je Nacht = Erwachsene + Kinder der Buchung.
- **Altersbefreiung tagesgenau:** Personen mit bekanntem Geburtsdatum (Hauptgast aus der Gäste-Datenbank, namentlich erfasste Mitreisende) sind in einer Nacht befreit, wenn sie am Datum dieser Nacht jünger als die Grenze sind. Ab der Nacht, die am Geburtstag beginnt, zahlen sie.
  - Beispiel: Grenze 15, Kind wird am 3. Aufenthaltstag 15 → die ersten 2 Nächte frei, ab der 3. Nacht abgabepflichtig.
- **Personen ohne Geburtsdatum** (nicht namentlich erfasst oder ohne Geburtsdatum) zahlen den normalen Tarif, auch Kinder. Das erfasste Kinderalter bei Anreise begründet keine Befreiung.
- **Persönlich befreit:** Hauptgast und Mitreisende, bei denen in der Buchung „Von der Ortstaxe befreit“ angehakt ist, zählen in keiner Nacht (siehe unten).
- Betrag je Position = abgabepflichtige Personennächte im Tarifzeitraum × Betrag.

### Häkchen „Von der Ortstaxe befreit“ je Person
- Im Buchungsformular beim **Hauptgast** und bei **jedem Mitreisenden** ein Häkchen „Von der Ortstaxe befreit“, Standard **nicht gesetzt**.
- Gilt nur für diese Buchung (auch beim Hauptgast; nicht in der Gäste-Datenbank).
- Eine befreite Person zählt bei Betrags-Tarifen in keiner Nacht, unabhängig von Alter und Geburtsdatum.
- Personen, die nicht namentlich erfasst sind, lassen sich nicht befreien; dafür trägt man sie als Mitreisende ein.
- Bei Prozent-Tarifen wirkt das Häkchen nicht (Abgabe hängt am Preis).
- Nur bei Buchungen und Optionen, nicht bei Sperren. Inhaber und Mitarbeiter dürfen es setzen (wie Mitreisende nachtragen).
- Das Buchungsdetail zeigt bei befreiten Personen „von der Ortstaxe befreit“.

### Berechnung „Prozent vom Übernachtungspreis“
- **Basis** ist der ganze **abgerechnete** Übernachtungspreis (PROJ-30), auch bei früherer Abreise. Bei Verlängerung zählt der vereinbarte bzw. hochgerechnete Preis.
- Netto = abgerechneter Preis ohne die USt der Übernachtung (PROJ-35). Bei Kleinunternehmer-Buchungen (PROJ-36) ist netto = brutto.
- Reicht der Aufenthalt über einen Tarifwechsel, wird die Basis gleichmäßig je **abgerechneter** Nacht auf die Tarifzeiträume verteilt.
- Keine Altersbefreiung.
- Betrag je Position = Basisanteil × Prozentsatz, auf Cent gerundet.

### Keine Abgabe
- Buchung mit „Wohnsitz angemeldet“ (PROJ-30), Sperren, Wohnungen ohne Tarif.
- Stornierte Buchungen: wie alle Zusatzkosten zählt nur noch die Stornogebühr (PROJ-8/35).
- Optionen werden wie Buchungen berechnet.

### Positionen in der Buchung
- Je Tarif-Eintrag eine normale Zusatzkosten-Position: **Bezeichnung des Eintrags, Betrag, USt-Satz des Eintrags**. Kein Zeitraum, keine Nächte oder Einzelpreise im Text.
- Neue Positionen kommen ans Ende der Zusatzkosten und lassen sich wie andere ordnen (PROJ-34). Ein Betrag von € 0,00 ergibt keine Position.
- **Automatisch:** Ändern sich im Buchungsformular Wohnung, Zeitraum, Abreise, Personen, Kinder, Mitreisende oder deren Geburtsdatum, ein Befreiungs-Häkchen, Hauptgast oder „Wohnsitz angemeldet“, rechnet die App die automatischen Positionen sofort neu (anlegen, ändern, entfernen). Im Formular sind sie als „automatisch berechnet“ gekennzeichnet.
- **Von Hand überschreibbar:** Ändert der Inhaber Bezeichnung oder Betrag einer Abgabe-Position oder entfernt er sie, rechnet die App für diese Buchung nicht mehr automatisch. Sie zeigt dann „Abgabe neu berechnen“ an, wenn die Berechnung abweicht. Ein Klick stellt die automatischen Positionen wieder her.
- **Hinweise im Formular und Detail (nur Inhaber):**
  - „Für N Personen fehlt das Geburtsdatum: Abgabe ohne Altersbefreiung berechnet“ (nur bei Tarifen mit Altersgrenze und mindestens einem Kind in der Buchung)
  - „Für N Nächte ist kein Ortstaxe-Tarif hinterlegt“
- **Mitarbeiter** sehen keine Preise und damit keine Abgabe-Positionen. Speichern sie Änderungen, werden automatische Positionen nach derselben Regel neu berechnet. Sind die Positionen von Hand überschrieben, bleiben sie unverändert, und der Inhaber sieht „Preis prüfen“.

### Bestehende Buchungen und spätere Tarifänderungen
- Das Anlegen oder Ändern eines Tarifs ändert **keine gespeicherte Buchung**.
- Öffnet der Inhaber eine Buchung zum Bearbeiten und weicht die aktuelle Berechnung von den gespeicherten Abgabe-Positionen ab (oder fehlen sie ganz), bietet die App „Abgabe berechnen“ bzw. „Abgabe neu berechnen“ an. Erst ein Klick übernimmt es.
  - Gibt es schon eine von Hand eingetragene Position mit der Tarifbezeichnung (z. B. „Nächtigungsabgabe“ aus PROJ-32), erscheint zusätzlich: „Es gibt bereits eine Position ‚Nächtigungsabgabe‘. Bitte prüfen, sonst wird die Abgabe doppelt verrechnet.“
  - Buchungen mit ausgestellter oder nacherfasster Rechnung bekommen keinen solchen Vorschlag.
- Die automatische Neuberechnung beim Ändern einer Buchung (oben) gilt für Buchungen, die bereits automatische Positionen haben, und für neue Buchungen.

### Wer darf was
| Aktion | Inhaber | Mitarbeiter |
|--------|---------|-------------|
| Tarife einer Wohnung sehen und bearbeiten | ✓ | – |
| Abgabe-Positionen sehen, überschreiben, neu berechnen | ✓ | – |
| Buchungsänderungen, die eine Neuberechnung auslösen | ✓ | ✓ (ohne die Beträge zu sehen) |

## User Stories
- Als **Inhaber** möchte ich je Wohnung die Ortstaxe mit der in meiner Gegend üblichen Bezeichnung hinterlegen, damit sie in Buchung und Rechnung richtig heißt.
- Als **Inhaber** möchte ich eine Erhöhung schon vorab mit „gültig ab“ eintragen, damit Aufenthalte über den Stichtag richtig und getrennt abgerechnet werden.
- Als **Inhaber** möchte ich Kinder unter einem bestimmten Alter befreien und die Abgabe tagesgenau nach dem Geburtsdatum berechnen lassen, damit ein Geburtstag während des Aufenthalts richtig berücksichtigt wird.
- Als **Inhaber in Wien** möchte ich die Abgabe als Prozentsatz vom Übernachtungspreis (netto oder brutto) hinterlegen, damit auch prozentuale Regeln abgebildet sind.
- Als **Inhaber** möchte ich, dass die Abgabe in jeder Buchung automatisch als eigene Position erscheint, damit ich sie nicht mehr von Hand ausrechne.
- Als **Inhaber** möchte ich die berechnete Abgabe im Sonderfall von Hand ändern können (z. B. bei einer Befreiung, die die App nicht kennt).
- Als **Inhaber oder Mitarbeiter** möchte ich einzelne Personen eines Aufenthalts von der Ortstaxe befreien, damit gesetzlich befreite Gäste nicht verrechnet werden.
- Als **Mitarbeiter** möchte ich beim Check-in Mitreisende mit Geburtsdatum nachtragen, und die Abgabe soll sich dabei von selbst anpassen.

## Out of Scope
- Monatsbericht je Gemeinde und Export → PROJ-16
- Regeln je Gemeinde und Vorlagen je Bundesland (ursprünglicher Zuschnitt von PROJ-15) → ersetzt durch Tarife je Wohnung
- Tarif in einem Schritt für mehrere Wohnungen anlegen bzw. kopieren → bewusst nicht, ggf. später
- Altersbefreiung bei Prozent-Tarifen
- Befreiungsgründe als Auswahl oder Nachweis zur Befreiung → nur das Häkchen je Person
- Höchstdauer je Aufenthalt (Abgabe nur für die ersten N Nächte) → im Einzelfall durch Überschreiben der Position
- Befreiung nicht namentlich erfasster Personen
- Mindest- oder Höchstbeträge je Aufenthalt
- Automatisches Nachziehen gespeicherter Buchungen bei Tarifänderungen
- Rechenweg (Zeitraum, Nächte, Einzelpreis) im Positionstext
- Geburtsdatum je Kind im Buchungsformular statt Alter (Personen ohne Geburtsdatum zahlen voll)
- Abgabe für importierte booking.com-/Airbnb-Buchungen → PROJ-11

## Acceptance Criteria

### Tarife an der Wohnung
- [ ] Angenommen eine Wohnung ohne Tarif, wenn der Inhaber sie bearbeitet, dann zeigt der Abschnitt „Ortstaxe“ „Keine Ortstaxe hinterlegt: Buchungen dieser Wohnung erhalten keine Abgabe.“ und „Tarif hinzufügen“
- [ ] Angenommen der Inhaber legt einen Eintrag „ab 01.01.2026, Nächtigungsabgabe, Betrag € 2,50, befreit unter 15“ an, wenn er speichert und die Wohnung erneut öffnet, dann steht oben „Aktuell: Nächtigungsabgabe € 2,50 pro Person und Nacht, befreit unter 15 Jahren, seit Do, 01.01.2026“
- [ ] Angenommen es gibt mehrere Einträge, wenn die Liste angezeigt wird, dann steht der neueste oben, und ein Eintrag mit „gültig ab“ in der Zukunft ist als „künftig“ gekennzeichnet; „Aktuell“ zeigt den heute gültigen
- [ ] Angenommen der Inhaber wählt „Prozent vom Übernachtungspreis“, wenn das Formular angezeigt wird, dann gibt es Prozentsatz und Basis (netto/brutto), aber kein Feld für die Altersgrenze
- [ ] Angenommen ein Eintrag hat „gültig ab“ wie ein anderer Eintrag derselben Wohnung, wenn der Inhaber speichert, dann erscheint „Für dieses Datum gibt es schon einen Tarif“
- [ ] Angenommen Bezeichnung leer, Betrag negativ, Prozentsatz 0 oder über 100, Altersgrenze außerhalb 1–18 oder ein USt-Satz außerhalb 0–100, wenn der Inhaber speichert, dann erscheint je Feld eine Meldung und nichts wird gespeichert
- [ ] Angenommen ein neuer Eintrag, wenn er angelegt wird, dann ist der USt-Satz mit 0,00 vorbelegt und die Bezeichnung bietet „Nächtigungsabgabe“, „Ortstaxe“ und „Aufenthaltsabgabe“ an
- [ ] Angenommen der Inhaber ändert oder entfernt Einträge, wenn er speichert, dann steht die Änderung mit Person und Zeitpunkt im Änderungsprotokoll (PROJ-1)
- [ ] Angenommen der Nutzer ist Mitarbeiter, wenn er versucht, Tarife zu lesen oder zu ändern, dann ist das nicht möglich
- [ ] Angenommen ein Inhaber von Kunde A, wenn er Tarife liest oder ändert, dann betrifft das nur Wohnungen von Kunde A

### Berechnung Betrag pro Person und Nacht
- [ ] Angenommen Tarif € 2,50 ohne Altersgrenze, wenn eine Buchung mit 2 Erwachsenen und 1 Kind für 4 Nächte erfasst wird, dann gibt es eine Position „Nächtigungsabgabe“ über € 30,00 mit USt 0,00 %
- [ ] Angenommen Tarif € 2,50 „befreit unter 15“, wenn eine Buchung mit 2 Erwachsenen (Hauptgast mit Geburtsdatum, 1 Erwachsener ohne Namen) und 1 Kind als Mitreisender mit Geburtsdatum 10 Jahre alt für 4 Nächte erfasst wird, dann beträgt die Abgabe € 20,00
- [ ] Angenommen Tarif „befreit unter 15“, wenn ein mitreisendes Kind am 3. Tag eines Aufenthalts von 5 Nächten 15 wird, dann ist es für die ersten 2 Nächte befreit und zahlt für die Nächte 3 bis 5
- [ ] Angenommen Tarif „befreit unter 15“, wenn ein Kind mit Alter 4 ohne Geburtsdatum erfasst ist, dann zahlt es den normalen Tarif, und der Inhaber sieht „Für 1 Person fehlt das Geburtsdatum: Abgabe ohne Altersbefreiung berechnet“
- [ ] Angenommen der Inhaber trägt beim Mitreisenden das Geburtsdatum nach, wenn das Kind dadurch befreit ist, dann sinkt die Abgabe sofort und der Hinweis verschwindet
- [ ] Angenommen geplante Abreise am 10., tatsächliche am 8., wenn die Abgabe berechnet wird, dann zählen nur die Nächte bis zum 8.

### Persönliche Befreiung
- [ ] Angenommen eine neue Buchung, wenn das Formular angezeigt wird, dann gibt es beim Hauptgast und bei jedem Mitreisenden das Häkchen „Von der Ortstaxe befreit“, nicht gesetzt
- [ ] Angenommen Tarif € 2,50, 2 Erwachsene, 4 Nächte, wenn der Inhaber beim Hauptgast „Von der Ortstaxe befreit“ anhakt, dann sinkt die Abgabe sofort von € 20,00 auf € 10,00
- [ ] Angenommen ein befreiter Mitreisender mit Geburtsdatum über der Altersgrenze, wenn die Abgabe berechnet wird, dann zählt er in keiner Nacht
- [ ] Angenommen ein Mitreisender ohne Geburtsdatum ist befreit, wenn die Abgabe berechnet wird, dann zählt er nicht und es gibt für ihn keinen Hinweis „Geburtsdatum fehlt“
- [ ] Angenommen der Hauptgast ist in Buchung A befreit, wenn für denselben Gast Buchung B erfasst wird, dann ist das Häkchen in Buchung B nicht gesetzt
- [ ] Angenommen ein Prozent-Tarif, wenn Personen befreit sind, dann bleibt die Abgabe unverändert
- [ ] Angenommen ein Mitarbeiter hakt bei einem Mitreisenden „Von der Ortstaxe befreit“ an, wenn er speichert, dann ist die automatische Abgabe neu berechnet
- [ ] Angenommen eine Person ist befreit, wenn das Buchungsdetail angezeigt wird, dann steht bei ihr „von der Ortstaxe befreit“
- [ ] Angenommen das Häkchen wird geändert, wenn die Buchung gespeichert ist, dann steht die Änderung im Änderungsprotokoll

### Tarifwechsel während des Aufenthalts
- [ ] Angenommen Tarif A € 2,00 ab 01.01.2026 und Tarif B € 2,50 ab 01.01.2027, beide „Nächtigungsabgabe“, wenn eine Buchung für 2 Personen vom 29.12.2026 bis 03.01.2027 erfasst wird, dann gibt es zwei Positionen „Nächtigungsabgabe“: € 12,00 (3 Nächte) und € 10,00 (2 Nächte)
- [ ] Angenommen der erste Tarif gilt ab 01.01.2027, wenn eine Buchung vom 29.12.2026 bis 03.01.2027 erfasst wird, dann werden nur die Nächte ab 01.01. berechnet und der Inhaber sieht „Für 3 Nächte ist kein Ortstaxe-Tarif hinterlegt“
- [ ] Angenommen zwei Einträge mit verschiedenen Bezeichnungen und USt-Sätzen, wenn ein Aufenthalt beide berührt, dann trägt jede Position Bezeichnung und USt-Satz ihres Eintrags

### Berechnung Prozent
- [ ] Angenommen Tarif 3,20 % netto, Übernachtung € 440,00 brutto mit 10 % USt, keine Kleinunternehmer-Buchung, wenn die Abgabe berechnet wird, dann beträgt sie € 12,80 (3,20 % von € 400,00)
- [ ] Angenommen derselbe Tarif mit Basis brutto, wenn die Abgabe berechnet wird, dann beträgt sie € 14,08
- [ ] Angenommen eine Kleinunternehmer-Buchung und Basis netto, wenn die Abgabe berechnet wird, dann ist die Basis der abgerechnete Preis selbst
- [ ] Angenommen 5 abgerechnete Nächte zu € 500,00, tatsächliche Abreise nach 3 Nächten, wenn die Abgabe berechnet wird, dann ist die Basis € 500,00
- [ ] Angenommen ein Prozent-Wechsel nach der 2. von 5 abgerechneten Nächten, wenn die Abgabe berechnet wird, dann entfallen 2/5 der Basis auf den alten und 3/5 auf den neuen Tarif, je Position auf Cent gerundet

### Keine Abgabe
- [ ] Angenommen „Wohnsitz angemeldet“ ist gesetzt, wenn die Buchung gespeichert wird, dann hat sie keine automatische Abgabe-Position
- [ ] Angenommen eine Wohnung ohne Tarif, wenn eine Buchung erfasst wird, dann entsteht keine Abgabe-Position und kein Hinweis
- [ ] Angenommen ein Tarif-Eintrag mit € 0,00, wenn ein Aufenthalt in seinen Zeitraum fällt, dann entsteht für diese Nächte keine Position
- [ ] Angenommen eine Sperre, wenn sie gespeichert wird, dann gibt es keine Abgabe
- [ ] Angenommen eine Option, wenn sie gespeichert wird, dann wird die Abgabe wie bei einer Buchung berechnet

### Automatisch und von Hand
- [ ] Angenommen eine Buchung mit automatischer Abgabe, wenn der Inhaber im Formular Zeitraum, Personen, Kinder, Mitreisende, Geburtsdaten, Befreiungs-Häkchen, Hauptgast, Wohnung oder „Wohnsitz angemeldet“ ändert, dann passen sich die Abgabe-Positionen sofort an
- [ ] Angenommen eine automatische Abgabe-Position, wenn sie im Formular angezeigt wird, dann ist sie als „automatisch berechnet“ gekennzeichnet; im Buchungsdetail erscheint sie als normale Zusatzposition mit Bezeichnung, Betrag und USt-Satz
- [ ] Angenommen der Inhaber ändert den Betrag einer Abgabe-Position, wenn er danach die Personenzahl ändert, dann bleibt die Position unverändert und die App bietet „Abgabe neu berechnen“ an
- [ ] Angenommen der Inhaber entfernt die Abgabe-Position, wenn er speichert, dann bleibt die Buchung ohne Abgabe und die App legt sie nicht von selbst wieder an
- [ ] Angenommen eine von Hand geänderte Abgabe, wenn der Inhaber „Abgabe neu berechnen“ wählt, dann ersetzt die App sie durch die berechneten Positionen und rechnet wieder automatisch
- [ ] Angenommen ein Mitarbeiter trägt bei einer Buchung mit automatischer Abgabe Mitreisende mit Geburtsdatum nach, wenn er speichert, dann ist die Abgabe neu berechnet
- [ ] Angenommen ein Mitarbeiter ändert eine Buchung mit von Hand geänderter Abgabe, wenn die Änderung die Berechnung beeinflusst, dann bleiben die Positionen unverändert und der Inhaber sieht „Preis prüfen“
- [ ] Angenommen der Nutzer ist Mitarbeiter, wenn er eine Buchung öffnet, dann sieht er weder Abgabe-Positionen noch Abgabe-Hinweise

### Bestehende Buchungen und Tarifänderungen
- [ ] Angenommen eine gespeicherte Buchung ohne Abgabe-Position, wenn der Inhaber einen Tarif für die Wohnung anlegt, dann bleibt die Buchung unverändert
- [ ] Angenommen dieselbe Buchung, wenn der Inhaber sie bearbeitet, dann bietet die App „Abgabe berechnen“ an; erst ein Klick legt die Positionen an
- [ ] Angenommen die Buchung hat eine von Hand eingetragene Position mit der Tarifbezeichnung, wenn die App „Abgabe berechnen“ anbietet, dann erscheint auch der Hinweis auf mögliche doppelte Verrechnung
- [ ] Angenommen eine Buchung mit automatischer Abgabe und danach eine Tariferhöhung für ihren Zeitraum, wenn der Inhaber die Buchung bearbeitet, dann bietet die App „Abgabe neu berechnen“ an; ohne Klick bleibt der gespeicherte Betrag
- [ ] Angenommen eine Buchung mit ausgestellter oder nacherfasster Rechnung, wenn der Inhaber sie bearbeitet, dann gibt es keinen Vorschlag „Abgabe berechnen“ bzw. „Abgabe neu berechnen“ aufgrund einer Tarifänderung

### Folgefunktionen
- [ ] Angenommen eine Buchung mit Abgabe-Positionen, wenn der Inhaber einen Rechnungsentwurf erstellt (PROJ-40), dann stehen die Abgabe-Positionen wie andere Zusatzpositionen zur Auswahl
- [ ] Angenommen eine Buchung mit Abgabe, wenn das Buchungsdetail die enthaltene USt je Satz zeigt (PROJ-35), dann zählen die Abgabe-Positionen mit ihrem Satz

## Edge Cases
- **Geburtstag am Anreisetag:** Die Person hat die Grenze in der ersten Nacht erreicht und zahlt ab der ersten Nacht.
- **Hauptgast ohne Geburtsdatum oder mit Geburtsdatum unter der Grenze:** Ohne Geburtsdatum zahlt er; mit Geburtsdatum gilt die tagesgenaue Regel wie für alle anderen.
- **Geburtsdatum des Hauptgasts wird in der Gäste-Datenbank geändert:** Gespeicherte Buchungen bleiben; beim nächsten Bearbeiten bietet die App bei Abweichung „Abgabe neu berechnen“ an.
- **Mehr Mitreisende mit Geburtsdatum als Kinder erfasst** (z. B. Erwachsene namentlich erfasst): unerheblich, entscheidend ist das Geburtsdatum der jeweiligen Person; die Summe der Personen bleibt Erwachsene + Kinder.
- **Mitreisender mit Häkchen wird entfernt:** Die Befreiung entfällt mit ihm; die Person zählt, falls sie über Erwachsene/Kinder weiter erfasst ist, als Person ohne Geburtsdatum.
- **Alle Personen befreit:** Bei Betrags-Tarifen entsteht keine Position.
- **Wohnung einer Buchung wird gewechselt:** Es gelten die Tarife der neuen Wohnung; automatische Positionen werden neu berechnet.
- **Tarif-Eintrag wird entfernt, auf den gespeicherte Buchungen beruhen:** Die Buchungen bleiben unverändert; beim nächsten Bearbeiten wird die Abweichung angeboten.
- **Übernachtungspreis € 0 oder negativer Endbetrag (PROJ-32) bei Prozent-Tarif:** Die Basis ist der abgerechnete Übernachtungspreis; bei € 0 entsteht keine Position. Zusatzkosten und Rabatte zählen nicht zur Basis.
- **Rundung bei Prozent und mehreren Tarifzeiträumen:** Jede Position wird für sich auf Cent gerundet; die Summe kann um 1 Cent von der ungeteilten Rechnung abweichen.
- **Stornierte Buchung mit Abgabe-Positionen:** Die Positionen bleiben gespeichert, zählen aber wie alle Zusatzkosten nicht mehr (nur die Stornogebühr).
- **Rechnungsentwurf existiert, Abgabe ändert sich:** Der Entwurf erkennt die geänderte Buchung wie bei jeder Positionsänderung (Änderungshinweis aus PROJ-40).
- **Sehr lange Aufenthalte (Dienstwohnungen, z. B. 6 Monate):** Die Berechnung je Nacht muss auch für einige hundert Nächte sofort im Formular erscheinen.

## Technical Requirements (optional)
- Eine Rechenregel an einer Stelle, die Buchungsformular, Speichern (auch für Mitarbeiter) und später PROJ-16/PROJ-42 gleich nutzen; gut mit Unit-Tests abzudecken
- Beträge in Cent; Prozentsätze und Steuersätze mit 2 Nachkommastellen
- Mandantentrennung und Rollen wie bei den Wohnungsdaten (nur Inhaber)

## Open Questions
- [ ] USt-Satz der Abgabe: Vorbelegung 0,00 % als „durchlaufender Posten“ mit Steuerberater bestätigen; je Eintrag änderbar
- [ ] Wien: gibt es tatsächlich keine Altersbefreiung bei der Ortstaxe? (Annahme für „keine Altersgrenze bei Prozent“)
- [ ] Gelten Höchstdauern je Aufenthalt (Abgabe nur für die ersten N Nächte) in Gemeinden der Pilotkunden? Falls ja, später ergänzen
- [ ] Importierte Buchungen (PROJ-11): Abgabe nach derselben Regel berechnen, auch wenn booking.com/Airbnb sie bereits ausweisen? Klärung in PROJ-11

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Tarife je Wohnung statt Regeln je Gemeinde mit Bundesland-Vorlagen | Vorgabe des Nutzers: Regelung bundesland- und gemeindespezifisch, Pflege direkt an der Wohnung unter *Einstellungen → Wohnungen* | 2026-11-01 |
| Berechnung in der Buchung gehört zu PROJ-15; PROJ-16 behält Monatsbericht und Export | Sofortiger Nutzen; Abgabe steht korrekt auf den Rechnungen aus PROJ-42 | 2026-11-01 |
| Berechnungsarten „Betrag pro Person und Nacht“ und „Prozent vom Übernachtungspreis“ | Nutzerwahl; Prozent für Wien | 2026-11-01 |
| Basis netto/brutto je Tarif-Eintrag wählbar | Nutzerwahl | 2026-11-01 |
| Verlauf mit „gültig ab“; jeder Eintrag enthält alle Regeln inkl. Bezeichnung | Gesetzgeber kann Satz, Altersgrenze und Bezeichnung ändern; alte Zeiträume bleiben richtig | 2026-11-01 |
| Tarif je Nacht; je Tarif-Eintrag eine eigene Position | Nutzervorgabe: getrennte Leistungsdatensätze für die Rechnung | 2026-11-01 |
| Altersbefreiung „unter X Jahren“, tagesgenau nach Geburtsdatum | Nutzervorgabe: Nächte vor dem Geburtstag frei, danach abgabepflichtig; entspricht „bis zum vollendeten X. Lebensjahr“ | 2026-11-01 |
| Personen ohne Geburtsdatum zahlen den normalen Tarif | Nutzervorgabe: Befreiung nur mit nachgewiesenem Geburtsdatum (Hauptgast oder Mitreisender) | 2026-11-01 |
| Bei Prozent keine Altersbefreiung | Nutzerwahl; Prozent hängt am Preis, nicht an Personen | 2026-11-01 |
| Prozent-Basis = ganzer abgerechneter Übernachtungspreis, gleichmäßig je abgerechneter Nacht verteilt | Nutzerwahl: tatsächlich bezahltes Entgelt | 2026-11-01 |
| Positionstext nur Bezeichnung, mit Betrag und USt-Satz | Nutzervorgabe: normale Zusatzposition ohne Rechenweg | 2026-11-01 |
| Automatisch berechnet, aber von Hand überschreibbar; danach „Abgabe neu berechnen“ | Nutzerwahl; Sonderfälle (unbekannte Befreiungen) bleiben möglich | 2026-11-01 |
| Bestehende Buchungen bleiben; Angebot beim Bearbeiten, Hinweis auf mögliche Doppelung | Nutzerwahl; keine stillen Änderungen an Altbestand mit von Hand eingetragener Abgabe | 2026-11-01 |
| Tarifänderungen ziehen gespeicherte Buchungen nicht nach; Angebot beim nächsten Bearbeiten | Nutzerwahl | 2026-11-01 |
| Kein Kopieren von Tarifen auf andere Wohnungen | Nutzerwahl; PROJ-15 bleibt kleiner | 2026-11-01 |
| USt-Satz je Tarif-Eintrag, vorbelegt 0,00 % | Nutzer nannte USt als Bestandteil der Position; PROJ-35 belegt „Nächtigungsabgabe“ schon mit 0 % vor | 2026-11-01 |
| Mitarbeiter-Änderungen berechnen automatische Positionen neu; bei überschriebener Abgabe „Preis prüfen“ | Abgabe ist gesetzlich berechnet, nicht verhandelt; Geburtsdaten werden oft erst beim Check-in nachgetragen | 2026-11-01 |
| Häkchen „Von der Ortstaxe befreit“ je Person (Hauptgast und Mitreisende), Standard nicht gesetzt | Nutzervorgabe: grundsätzlich befreite Personen | 2026-11-01 |
| Häkchen des Hauptgasts an der Buchung, nicht in der Gäste-Datenbank | Nutzerwahl; Befreiungen hängen meist am Aufenthalt | 2026-11-01 |
| Häkchen wirkt nur bei Betrags-Tarifen | Prozent hängt am Preis, nicht an Personen (wie Altersbefreiung) | 2026-11-01 |
| Nur Inhaber pflegt Tarife | *Einstellungen → Wohnungen* ist Inhabern vorbehalten (PROJ-6) | 2026-11-01 |

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
