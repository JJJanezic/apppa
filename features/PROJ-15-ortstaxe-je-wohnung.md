# PROJ-15: Ortstaxe je Wohnung

## Status: In Progress
**Created:** 2026-11-01
**Last Updated:** 2026-11-01 (Frontend)

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
- [x] USt-Satz der Abgabe: 0,00 % vom Nutzer bestätigt (2026-11-01); bleibt je Eintrag änderbar
- [ ] Wien: gibt es tatsächlich keine Altersbefreiung bei der Ortstaxe? (Annahme für „keine Altersgrenze bei Prozent“)
- [ ] Gelten Höchstdauern je Aufenthalt (Abgabe nur für die ersten N Nächte) in Gemeinden der Pilotkunden? Falls ja, später ergänzen
- [x] Importierte Buchungen: wird bei PROJ-11 (Buchungsimport) geklärt, nicht in PROJ-15 (Nutzer, 2026-11-01)

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
| Rechenregel zweimal: in der App (Formular, Hinweise, Abweichungs-Angebot) und in der Datenbank (maßgeblich beim Speichern), mit gemeinsamer Beispieltabelle für die Tests beider Fassungen | Mitarbeiter sehen keine Preise, ihre Speichervorgänge dürfen keine Beträge mitschicken; Vorbild ist der Preisvorschlag aus PROJ-27 (`suggested_nights_cents`). Die Beispieltabelle verhindert, dass beide Fassungen auseinanderlaufen | 2026-11-01 |
| Die Datenbank rechnet automatische Positionen beim Speichern selbst und übernimmt keine vom Browser gesendeten Abgabe-Beträge im Automatik-Zustand | Niemand kann über einen direkten Aufruf falsche Abgaben speichern; Formular und Server kommen bei gleicher Regel zum selben Ergebnis | 2026-11-01 |
| Neuberechnung beim Speichern nur, wenn sich eine Berechnungsgrundlage geändert hat oder der Inhaber „Abgabe (neu) berechnen“ gewählt hat | Setzt „Tarifänderungen ziehen nicht nach, ohne Klick bleibt der gespeicherte Betrag“ um; reine Notizänderungen lassen die Abgabe in Ruhe | 2026-11-01 |
| Abgabe-Zustand je Buchung: „noch nicht berechnet“ / „automatisch“ / „von Hand“ | Altbestand (vor PROJ-15) bleibt unangetastet, neue Buchungen rechnen automatisch, überschriebene bleiben stehen; der Zustand steuert Server, Formular und „Preis prüfen“ | 2026-11-01 |
| Tarife in einer eigenen Tabelle je Wohnung, Speichern als Ganzes (Liste ersetzen) über eine Datenbankfunktion im selben Speichervorgang wie die Wohnung | Wie der Kleinunternehmer-Verlauf (PROJ-36); eindeutiges „gültig ab“ je Wohnung in der Datenbank abgesichert; nur Inhaber lesen und schreiben | 2026-11-01 |
| Abgabe-Positionen bleiben normale Zeilen der Zusatzkosten, ergänzt um Kennzeichen „Ortstaxe“, Verweis auf den Tarif-Eintrag und Zahl der abgabepflichtigen Personennächte | Reihenfolge (PROJ-34), USt-Aufstellung (PROJ-35), Rechnungsentwurf (PROJ-40) und Summen funktionieren ohne Änderung; PROJ-16 kann später nach Tarif/Gemeinde und Nächtigungen auswerten | 2026-11-01 |
| Verweis auf den Tarif wird beim Entfernen des Eintrags geleert, die Position bleibt mit Kennzeichen erhalten | Spec: Entfernen eines Tarifs ändert gespeicherte Buchungen nicht | 2026-11-01 |
| Befreiungs-Häkchen als Ja/Nein-Feld an der Buchung (Hauptgast) und je Mitreisendem | Gilt nur für den Aufenthalt (Produktentscheidung); Gästedatensatz bleibt unberührt | 2026-11-01 |
| Kleinunternehmer-Regel (PROJ-36) bekommt zusätzlich eine Datenbank-Fassung | Prozent-Tarife mit Basis netto müssen auch bei Mitarbeiter-Speichern serverseitig rechnen; PROJ-42 braucht die Fassung ohnehin beim Festschreiben (offener Punkt aus PROJ-36) | 2026-11-01 |
| Keine neuen Pakete | Formular, Liste und Häkchen mit vorhandenen shadcn-Bausteinen (Checkbox, RadioGroup, Select, Input, AmountInput) | 2026-11-01 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-15 erweitert drei bestehende Stellen und bringt eine neue Rechenregel:
1. **Wohnungsformular** (*Einstellungen → Wohnungen*): neuer Abschnitt „Ortstaxe“ mit Tarifliste.
2. **Buchung** (Formular, Mitreisende-Nachtrag, Detail): Befreiungs-Häkchen, automatische Abgabe-Positionen, Hinweise.
3. **Speichern in der Datenbank**: rechnet die Abgabe maßgeblich und schützt sie vor falschen Werten.
4. **Rechenregel „Ortstaxe“**: einmal in der App (für sofortige Anzeige im Formular) und einmal in der Datenbank (für das Speichern, auch durch Mitarbeiter), geprüft mit derselben Beispieltabelle.

Kein neuer Menüpunkt, keine neue Seite, keine neuen Pakete.

### A) Komponentenstruktur

```
Einstellungen → Wohnungen → Wohnung bearbeiten (bestehendes Seitenpanel)
+-- (bestehend) Objekt, Name, Kapazität, Preisart, Reinigung, Zeiten, Notiz
+-- NEU Abschnitt „Ortstaxe“
    +-- Zeile „Aktuell: …“ bzw. Leerzustand „Keine Ortstaxe hinterlegt …“
    +-- Tarifliste (neueste oben, künftige mit Kennzeichen „künftig“)
    |   +-- Tarif-Eintrag (aufklappbar bzw. als Karte)
    |       +-- Gültig ab (Datum)
    |       +-- Bezeichnung (Eingabe mit Vorschlägen)
    |       +-- Berechnungsart (Auswahl: Betrag pro Person und Nacht / Prozent)
    |       +-- Betrag  —oder—  Prozentsatz + Basis netto/brutto
    |       +-- Befreit unter … Jahren (nur bei Betrag)
    |       +-- USt % (vorbelegt 0,00)
    |       +-- Entfernen
    +-- Knopf „Tarif hinzufügen“
    (gespeichert mit dem bestehenden „Speichern“ der Wohnung)

Buchungsformular (bestehendes Panel)
+-- Hauptgast  + NEU Häkchen „Von der Ortstaxe befreit“
+-- Personen / Kinder (unverändert)
+-- Mitreisende  + NEU je Person Häkchen „Von der Ortstaxe befreit“
+-- Preis (nur Inhaber)
    +-- Übernachtung (unverändert)
    +-- Zusatzkosten (ordnen wie PROJ-34)
    |   +-- NEU Abgabe-Positionen mit Kennzeichen „automatisch berechnet“
    +-- NEU Ortstaxe-Hinweisfeld (nur wenn nötig)
        +-- „Für N Personen fehlt das Geburtsdatum …“
        +-- „Für N Nächte ist kein Ortstaxe-Tarif hinterlegt“
        +-- Knopf „Abgabe berechnen“ / „Abgabe neu berechnen“
        +-- ggf. Warnung „Es gibt bereits eine Position ‚…‘ … doppelt“

Mitreisende nachtragen (bestehendes Panel, auch für Mitarbeiter)
+-- je Person NEU Häkchen „Von der Ortstaxe befreit“

Buchungsdetail (bestehend)
+-- Hauptgast / Mitreisende: Zusatz „von der Ortstaxe befreit“
+-- Preis (nur Inhaber): Abgabe-Positionen als normale Zusatzpositionen
+-- Ortstaxe-Hinweise (nur Inhaber), „Preis prüfen“ wie bisher
```

### B) Datenmodell (in Worten)

**Neu: Ortstaxe-Tarife** (je Wohnung beliebig viele Einträge)
- Kunde, Wohnung
- Gültig ab (je Wohnung eindeutig)
- Bezeichnung (1–100 Zeichen)
- Berechnungsart: Betrag pro Person und Nacht oder Prozent
- Betrag in Cent (bei Betrag) bzw. Prozentsatz in Hundertstel-Prozent (bei Prozent; gleiche Darstellung wie die USt-Sätze aus PROJ-35)
- Basis netto oder brutto (nur bei Prozent)
- Befreit unter … Jahren (1–18, leer = keine; nur bei Betrag)
- USt-Satz (vorbelegt 0,00 %)
- Angelegt/geändert von und wann; jede Änderung im Änderungsprotokoll (PROJ-1)
- Lesen und Schreiben nur durch Inhaber des Kunden; Mitarbeiter und andere Kunden haben keinen Zugriff

**Erweitert: Buchung**
- Abgabe-Zustand: „noch nicht berechnet“ (alle Buchungen vor PROJ-15), „automatisch“ (Standard für neue Buchungen und Optionen), „von Hand“ (Inhaber hat überschrieben)
- Hauptgast von der Ortstaxe befreit (ja/nein, Standard nein)

**Erweitert: Mitreisende**
- Von der Ortstaxe befreit (ja/nein, Standard nein)

**Erweitert: Zusatzkosten-Positionen**
- Kennzeichen „Ortstaxe“ (sonst normale Position)
- Verweis auf den Tarif-Eintrag (wird geleert, wenn der Eintrag entfernt wird)
- Abgabepflichtige Personennächte (nur bei Betrags-Tarifen; Grundlage für den späteren Monatsbericht PROJ-16)

**Gelesen, nicht geändert:** Geburtsdatum des Hauptgasts (Gäste-Datenbank), Geburtsdaten der Mitreisenden, Erwachsene/Kinder, Anreise, geplante und tatsächliche Abreise, abgerechneter Übernachtungspreis mit USt-Satz, „Wohnsitz angemeldet“, Kleinunternehmer-Verlauf, verknüpfte Rechnungen.

**Bestehende Daten:** Keine Umrechnung. Bestehende Buchungen erhalten den Zustand „noch nicht berechnet“, alle Häkchen „nein“. Von Hand eingetragene „Nächtigungsabgabe“-Positionen bleiben normale Positionen.

### C) Ablauf beim Rechnen und Speichern

**Rechenregel (beide Fassungen gleich)**
- Eingaben: Tarifliste der Wohnung, Aufenthalt (Anreise, tatsächliche Abreise, abgerechnete Nächte, abgerechneter Übernachtungspreis und dessen USt-Satz), Personen (Erwachsene + Kinder), Personen mit Geburtsdatum und Befreiungs-Häkchen, „Wohnsitz angemeldet“, Kleinunternehmer-Status der Buchung.
- Ergebnis: je berührtem Tarif-Eintrag eine Position (Bezeichnung, Betrag, USt-Satz, Personennächte) sowie die Hinweise „Geburtsdatum fehlt“ (Anzahl) und „Nächte ohne Tarif“ (Anzahl).
- Lange Aufenthalte (einige hundert Nächte) sind unkritisch: gerechnet wird je Nacht über wenige Personen.

**Im Formular (Inhaber)**
- Bei jeder Änderung einer Berechnungsgrundlage rechnet die App-Fassung sofort neu und ersetzt die automatischen Positionen in der Liste; manuelle Positionen und deren Reihenfolge bleiben.
- Ändert der Inhaber eine Abgabe-Position oder entfernt er sie, wechselt das Formular in „von Hand“.
- Beim Öffnen vergleicht die App die gespeicherten Abgabe-Positionen mit einer frischen Berechnung. Bei Abweichung erscheint „Abgabe neu berechnen“ bzw. bei „noch nicht berechnet“ „Abgabe berechnen“. Ausnahme: Die Buchung hat eine ausgestellte oder nacherfasste Rechnung.
- Die App braucht dafür im Formular die Tarife der gewählten Wohnung und das Geburtsdatum des Hauptgasts. Beides wird nur für Inhaber geladen.

**Beim Speichern (Datenbank, maßgeblich)**
- Zustand „automatisch“: Die Datenbank vergleicht die Berechnungsgrundlagen vor und nach dem Speichern. Haben sie sich geändert, oder hat der Inhaber „Abgabe (neu) berechnen“ gewählt, rechnet sie die Abgabe-Positionen selbst neu und ersetzt sie. Vom Browser gesendete Abgabe-Beträge werden in diesem Zustand nicht übernommen. Ohne Änderung bleiben die gespeicherten Positionen (Tarifänderungen ziehen nicht nach).
- Zustand „von Hand“: Die Abgabe-Positionen des Inhabers werden wie normale Zusatzkosten gespeichert.
- Zustand „noch nicht berechnet“: nichts wird gerechnet, bis der Inhaber „Abgabe berechnen“ wählt; dann wechselt die Buchung auf „automatisch“.
- **Mitarbeiter** (Buchung speichern oder Mitreisende nachtragen): bei „automatisch“ wie oben; bei „von Hand“ bleiben die Positionen, und bei geänderten Grundlagen wird „Preis prüfen“ gesetzt; bei „noch nicht berechnet“ passiert nichts.
- Optionen werden wie Buchungen behandelt, Sperren nie. Stornieren ändert an den Positionen nichts.

**Speichern der Tarife**
- Das bestehende Speichern der Wohnung übergibt die vollständige Tarifliste an eine neue Datenbankfunktion, die sie als Ganzes ersetzt (wie der Kleinunternehmer-Verlauf). Prüfungen (Pflichtfelder, Bereiche, eindeutiges Datum) im Formular und in der Datenbank.
- Gespeicherte Buchungen werden dabei nicht angefasst.

### D) Technische Entscheidungen (Begründung für PM)
- **Zwei Fassungen der Rechenregel:** Der Inhaber soll die Abgabe beim Tippen sehen (App-Fassung). Mitarbeiter speichern ohne Preise zu sehen, und niemand soll über Umwege falsche Abgaben speichern können, darum rechnet beim Speichern die Datenbank. Damit beide gleich rechnen, laufen dieselben Beispielfälle (u. a. alle Rechenbeispiele aus den Akzeptanzkriterien) gegen beide Fassungen. Dasselbe Muster wird bereits beim Preisvorschlag (PROJ-27) verwendet.
- **Abgabe als normale Zusatzposition mit Kennzeichen:** Reihenfolge, USt-Aufstellung, Rechnungsentwurf und Summen funktionieren ohne Umbau. Das Kennzeichen und die Personennächte genügen später für den Monatsbericht (PROJ-16).
- **Zustand je Buchung:** Er trennt sauber Altbestand, Automatik und Handeingabe. Ohne ihn könnte die App nicht unterscheiden, ob fehlende Abgabe-Positionen bewusst entfernt oder nie berechnet wurden.
- **Kleinunternehmer-Regel auch in der Datenbank:** nötig für Prozent-Tarife mit Basis netto; wird von PROJ-42 beim Festschreiben ohnehin gebraucht.

### E) Abhängigkeiten
- Keine neuen Pakete.

### F) Für /frontend und /backend
- **Frontend:** Abschnitt „Ortstaxe“ im Wohnungs-Panel (Liste mit Hinzufügen/Entfernen im bestehenden Formular), Häkchen im Buchungsformular und im Mitreisende-Panel, Kennzeichen „automatisch berechnet“ in der Zusatzkosten-Liste, Hinweisfeld mit „Abgabe (neu) berechnen“, Anzeige „von der Ortstaxe befreit“ im Detail. App-Fassung der Rechenregel als reine Rechenbibliothek mit Unit-Tests (Beispieltabelle). Texte in `messages/de.json`.
- **Backend:** Tabelle für Tarife mit Inhaber-Regeln und Protokoll, Funktion zum Ersetzen der Tarifliste, neue Felder an Buchung, Mitreisenden und Zusatzkosten, Datenbank-Fassung der Rechenregel und der Kleinunternehmer-Regel, Erweiterung von „Buchung speichern“ und „Mitreisende speichern“ um Zustand, Häkchen, Neuberechnung und „Preis prüfen“. Integrationstests mit derselben Beispieltabelle sowie für Rollen und Mandantentrennung.


## Implementation Notes (Frontend, 2026-11-01)

**Gebaut**
- `src/lib/tourist-tax.ts`: Rechenregel (App-Fassung) `computeTouristTax` – Betrags-Tarife je tatsächlicher Nacht mit tagesgenauer Altersbefreiung und Häkchen, Prozent-Tarife je abgerechneter Nacht (Basis netto/brutto, Kleinunternehmer = brutto, Rundung je Position, exakt über BigInt), Hinweise „Geburtsdatum fehlt“ (nur bei Altersgrenze und Kindern) und „Nächte ohne Tarif“. Dazu Vergleich gespeichert/berechnet (`sameTaxLines`), Doppelungs-Hinweis (`duplicateTaxLabels`), Lesen der Tabellenzeilen. 31 Unit-Tests in `tourist-tax.test.ts` = Beispieltabelle für die Datenbank-Fassung.
- Wohnungsformular: Abschnitt „Ortstaxe“ (`src/components/apartments/tourist-tax-fields.tsx`) mit Zeile „Aktuell“/Leerzustand, Einträgen neueste oben (neue werden oben eingefügt, vorbelegt mit Bezeichnung und Werten des neuesten), Kennzeichen „künftig“, Berechnungsart, Betrag + „befreit unter … Jahren“ bzw. Prozentsatz + Basis, USt-Satz (0,00 vorbelegt), Bezeichnung mit Auswahl „Nächtigungsabgabe/Ortstaxe/Aufenthaltsabgabe“. Prüfregeln in `src/lib/validation/apartments.ts` (inkl. Datum je Wohnung einmal), Unit-Tests ergänzt.
- Buchungsformular: Häkchen „Hauptgast von der Ortstaxe befreit“ (alle Mitglieder); für Inhaber Abgabe-Positionen mit Kennzeichen „automatisch berechnet“ bzw. „von Hand geändert“, Neuberechnung bei geänderter Berechnungsgrundlage (nicht beim Öffnen), Wechsel auf „von Hand“ beim Ändern/Entfernen einer Abgabe-Position, Hinweisfeld mit „Abgabe berechnen“/„Abgabe neu berechnen“ und Doppelungs-Hinweis. Geburtsdatum des gewählten Hauptgasts über neue Aktion `loadGuestBirthDate` (nur Inhaber).
- Mitreisende-Panel: Häkchen „Von der Ortstaxe befreit“ je Person.
- Buchungsdetail: „von der Ortstaxe befreit“ bei Hauptgast und Mitreisenden; Ortstaxe-Hinweise im Preisbereich (Inhaber).

**Abweichungen / Präzisierungen**
- Das Angebot „Abgabe neu berechnen“ erscheint bei „von Hand“ auch für Buchungen mit Rechnung (bewusste Handlung des Inhabers); bei „automatisch“/„noch nicht berechnet“ nicht, wenn eine nacherfasste oder ausgestellte Rechnung existiert.
- Ändern des USt-Satzes einer Abgabe-Position zählt ebenfalls als Änderung von Hand.
- Ohne Migration sind Wohnungs- und Buchungsseiten in Dev nicht lesbar (neue Spalten/Tabelle in den Abfragen) – wie bei PROJ-40 wird das mit `/backend` behoben.

### Offen für /backend (Schnittstelle, Typen bereits in `src/types/database.ts`)
- **Tabelle `apartment_tourist_tax_rates`**: id, tenant_id, apartment_id (FK `(apartment_id, tenant_id)` → apartments, Name `apartment_tourist_tax_rates_apartment_fkey`), valid_from (date, eindeutig je Wohnung – Name der Regel muss `apartment_tourist_tax_rates` enthalten, die Aktion erkennt 23505 daran), label (1–100, getrimmt), method (`per_person_night` | `percent`), amount_cents (0–100.000, Pflicht bei Betrag), percent_rate (numeric(5,2), > 0 bis 100, Pflicht bei Prozent), base (`net` | `gross`, Pflicht bei Prozent), exempt_under_age (1–18 oder null, nur bei Betrag), vat_rate (numeric(5,2), Standard 0), created/updated_at/by. RLS: nur Inhaber lesen/schreiben; Änderungsprotokoll.
- **Funktion `save_tourist_tax_rates(p_apartment_id uuid, p_rates jsonb)`**: ersetzt die Liste als Ganzes (Felder je Eintrag: id, valid_from, label, method, amount_cents, percent_rate als Text „3.20“, base, exempt_under_age, vat_rate als Text „0.00“); nur Inhaber des Kunden der Wohnung; bei unveränderter Liste keine Änderung. Wird bei jedem Speichern einer Wohnung aufgerufen (auch Anlegen).
- **`bookings`**: `tourist_tax_mode` text (`pending` | `auto` | `manual`, Standard für neue Zeilen `auto`, bestehende Buchungen per Migration `pending`), `main_guest_tourist_tax_exempt` boolean (Standard false).
- **`booking_companions`**: `tourist_tax_exempt` boolean (Standard false).
- **`booking_charges`**: `tourist_tax` boolean (Standard false), `tourist_tax_rate_id` uuid null (FK auf den Tarif, beim Löschen null), `tax_person_nights` integer null.
- **`save_booking`**: neue Eingaben `main_guest_tourist_tax_exempt`, `tourist_tax_mode`, `tourist_tax_recalculate` (boolean), je Position `tourist_tax: { rate_id, person_nights } | null`. Regeln laut Tech Design C: Zustand „automatisch“ → bei geänderter Berechnungsgrundlage oder `tourist_tax_recalculate` Abgabe-Positionen selbst rechnen (gesendete Abgabe-Beträge ignorieren, Reihenfolge der übrigen Positionen erhalten; Abgabe-Positionen an der Stelle der bisherigen ersten bzw. am Ende); „von Hand“ → gesendete Positionen übernehmen; „noch nicht berechnet“ → nichts rechnen, mit `tourist_tax_recalculate` auf „automatisch“. Zustand und Neuberechnung nur von Inhabern; Mitarbeiter: Häkchen ja, bei „automatisch“ neu rechnen, bei „von Hand“ und geänderter Grundlage `price_review`. Neue Buchungen: „automatisch“.
- **`save_companions`**: je Person `tourist_tax_exempt`; danach wie Mitarbeiter-Änderung (automatisch neu rechnen bzw. `price_review`).
- **Datenbank-Fassung der Rechenregel** und **Kleinunternehmer-Regel** (`vatStatusForBooking`), geprüft mit den Fällen aus `src/lib/tourist-tax.test.ts`.
- Lesen: `findBooking` liest zusätzlich `guests.birth_date` und `invoices(origin)` (vorhanden).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
