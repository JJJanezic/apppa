# PROJ-46: Bankkonten und booking.com Hotel-ID

## Status: Architected
**Created:** 2026-11-06
**Last Updated:** 2026-11-06

## Dependencies
- Requires: PROJ-28 (Kundenstammdaten): Stammdaten-Formular für Inhaber und Betreiber, Hinweis bei zwischenzeitlicher Änderung, Änderungsprotokoll
- Requires: PROJ-36 (Kleinunternehmer-Status): Abschnitt „Umsatzsteuer“, nach dem der neue Abschnitt „Bankkonten“ folgt; Muster für Listen im gemeinsamen Formular
- Requires: PROJ-38 (Stammdaten: Umbenennung und Logo): Reiter *Einstellungen → Stammdaten*
- Requires: PROJ-6 (Wohnungsverwaltung): Bearbeiten-Fenster der Wohnung (*Einstellungen → Wohnungen*)
- Wird voraussichtlich genutzt von: PROJ-10 (Channex-Verbindung: Hotel-ID als Ausgangspunkt der Zuordnung), späteren Rechnungs-Paketen (Platzhalter `{IBAN}`/`{Bankverbindung}`, Zahlen-mit-Code-QR), PROJ-45/PROJ-25 (Zahlungseingang auf Konto X)

## Überblick
Bisher steht die Bankverbindung eines Kunden nur als freier Text in der Rechnungs-Fußzeile (PROJ-39), und Wohnungen haben keinen Bezug zu booking.com. Dieses Paket ergänzt:

1. **Bankkonten des Kunden** in den Stammdaten: mehrere Konten, genau eines davon primär.
2. **Je Wohnung:** Feld „booking.com Hotel-ID“ und Auswahlfeld „Bankkonto“ für Kunden, die für verschiedene Wohnungen verschiedene Konten führen.

### Felder je Bankkonto
| Feld | Pflicht | Regeln |
|---|---|---|
| Bezeichnung | nein | höchstens 100 Zeichen, z. B. „Geschäftskonto Raiffeisen“ |
| Kontoinhaber | ja | höchstens 200 Zeichen; beim neuen Konto mit dem Kundennamen vorbelegt |
| IBAN | ja | siehe IBAN-Prüfung; je Kunde eindeutig (auch gegenüber archivierten Konten) |
| BIC | nein | 8 oder 11 Zeichen, Formatprüfung |
| Name der Bank | nein | höchstens 100 Zeichen |
| Primär | genau eines | Kennzeichen; das erste Konto wird automatisch primär |
| Status | – | aktiv oder archiviert |
| Notiz | nein | höchstens 500 Zeichen, nur intern |

**IBAN-Prüfung (ohne Online-Abfrage):**
- Leerzeichen werden entfernt, Kleinbuchstaben in Großbuchstaben umgewandelt.
- Geprüft werden: gültiges Länderkürzel, Länge je Land (Österreich 20 Zeichen), Prüfziffer.
- Ausländische IBANs sind erlaubt.
- Anzeige in Viererblöcken: „AT61 1904 3002 3457 3201“.

**BIC-Prüfung:** Leerzeichen entfernt, Großbuchstaben; 8 oder 11 Zeichen (4 Buchstaben Bank, 2 Buchstaben Land, 2 Zeichen Ort, optional 3 Zeichen Filiale). Kein Abgleich mit der IBAN.

**Anzeigename eines Kontos:** Bezeichnung; wenn leer, Name der Bank; wenn auch leer, nur die IBAN.

### Felder je Wohnung
| Feld | Pflicht | Regeln |
|---|---|---|
| booking.com Hotel-ID | nein | Buchstaben, Ziffern und Bindestrich, höchstens 30 Zeichen; führende/nachfolgende Leerzeichen entfernt, Schreibweise sonst unverändert; dieselbe ID darf bei mehreren Wohnungen stehen (ohne Warnung) |
| Bankkonto | ja (mit Voreinstellung) | „Primäres Konto“ (Voreinstellung, folgt automatisch dem jeweils primären Konto) oder ein bestimmtes aktives Konto (fest) |

**Auswahlfeld „Bankkonto“:**
- Erster Eintrag: „Primäres Konto (AT61 1904 … 3201)“, mit gekürzter IBAN des aktuell primären Kontos.
- Danach alle aktiven Konten: volle IBAN in Viererblöcken, Bezeichnung klein daneben, z. B. „AT61 1904 3002 3457 3201 · Geschäftskonto Raiffeisen“.
- Reihenfolge: primäres Konto zuerst, die übrigen in der Reihenfolge des Anlegens.
- Archivierte Konten erscheinen nicht.
- Noch kein Konto erfasst: Feld zeigt „Kein Bankkonto erfasst“ und ist gesperrt; darunter der Hinweis „Bankkonten erfassen Sie unter Einstellungen → Stammdaten“ mit Link. Die Wohnung lässt sich trotzdem speichern.

### Wer darf was
| Rolle | Bankkonten (Stammdaten) | Hotel-ID und Bankkonto der Wohnung |
|---|---|---|
| Inhaber | sehen und bearbeiten (*Einstellungen → Stammdaten*) | sehen und bearbeiten (*Einstellungen → Wohnungen*) |
| Betreiber | sehen und bearbeiten auf der Kunden-Detailseite, Abschnitt „Stammdaten“; bei deaktivierten Kunden nur lesen | kein Zugang (wie bisher bei Wohnungen) |
| Mitarbeiter | kein Zugang | kein Zugang in der Oberfläche (technisch lesbar: Hotel-ID und Kontokennung, siehe Technical Decisions) |

### Bedienung in den Stammdaten
- Neuer Abschnitt **„Bankkonten“** am Ende der Seite, nach „Umsatzsteuer“.
- Anlegen, Ändern, Primär-Setzen, Archivieren, Wiederherstellen und Löschen geschehen im Formular und werden wie der Umsatzsteuer-Verlauf erst mit dem gemeinsamen Knopf **„Speichern“** übernommen.
- Liste: primäres Konto oben mit Kennzeichen „Primär“, dann die übrigen aktiven Konten in der Reihenfolge des Anlegens, archivierte Konten unten mit Kennzeichen „archiviert“.
- Leerzustand: kurzer Erklärtext und Knopf „Bankkonto hinzufügen“.
- Höchstens 20 Konten je Kunde (aktiv und archiviert zusammen).

### Archivieren und Löschen
- **Primäres Konto:** weder archivierbar noch löschbar; zuerst ein anderes Konto primär setzen.
- **Löschen:** nur, wenn das Konto keiner Wohnung fest zugeordnet ist; sonst gesperrt mit Nennung der Wohnungen („Objekt · Wohnung“).
- **Archivieren:** Ist das Konto Wohnungen fest zugeordnet, nennt ein Hinweis diese Wohnungen; nach Bestätigung und Speichern werden sie auf „Primäres Konto“ zurückgestellt.
- **Wiederherstellen:** archiviertes Konto wird wieder aktiv; frühere Zuordnungen zu Wohnungen werden nicht wiederhergestellt.

## User Stories
- Als **Inhaber** möchte ich mehrere Bankkonten meines Unternehmens in den Stammdaten erfassen, damit die Bankdaten an einer Stelle gepflegt sind.
- Als **Inhaber** möchte ich ein Konto als primär kennzeichnen, damit klar ist, welches Konto standardmäßig gilt.
- Als **Inhaber mit mehreren Konten** möchte ich je Wohnung festlegen, auf welches Konto die Gäste zahlen, damit Einnahmen verschiedener Wohnungen auf verschiedenen Konten landen.
- Als **Inhaber** möchte ich, dass Wohnungen ohne eigene Wahl automatisch dem primären Konto folgen, damit ich nach einem Kontowechsel nicht jede Wohnung einzeln umstellen muss.
- Als **Inhaber** möchte ich je Wohnung die booking.com Hotel-ID hinterlegen, damit ich die Wohnung auf booking.com eindeutig zuordnen kann und die spätere Channex-Anbindung vorbereitet ist.
- Als **Inhaber** möchte ich Tippfehler in der IBAN sofort bemerken, damit keine falsche Bankverbindung gespeichert wird.
- Als **Betreiber** möchte ich die Bankkonten eines Kunden beim Onboarding selbst eintragen oder korrigieren können.
- Als **Inhaber** möchte ich ein aufgelöstes Konto archivieren statt löschen, damit es nachvollziehbar bleibt, aber nicht mehr auswählbar ist.

## Out of Scope
- Bankkonto auf Rechnungen verwenden: Platzhalter `{IBAN}`/`{Bankverbindung}` in Textbausteinen und Fußzeile, Auswahl des Kontos am Rechnungsentwurf (eigenes Paket, aufbauend auf PROJ-39/40/41)
- Zahlen-mit-Code-QR-Code (EPC-QR) auf der Rechnung (eigenes Paket)
- Zuordnung einer Zahlung zum Konto, auf dem sie eingegangen ist (Erweiterung PROJ-45) bzw. Bankabgleich (PROJ-25)
- Online-Prüfung von IBAN/BIC, automatisches Ermitteln von BIC oder Bankname aus der IBAN
- Kontonummer/BLZ (veraltet, in der IBAN enthalten), SEPA-Gläubiger-ID (nur für Lastschriften; App wickelt keine Zahlungen ab), Zugangsdaten zum Online-Banking (nie)
- Prüfung der Hotel-ID gegen booking.com; Zuordnung zu Zimmertypen/Listings (PROJ-10)
- Hotel-ID bzw. Bankkonto in der Wohnungsliste, im Kalender oder in Buchungen anzeigen
- Hotel-ID auf Objekt- oder Kundenebene
- Zugang für Mitarbeiter; Wohnungs-Zugang für den Betreiber
- Dublettenprüfung der IBAN über verschiedene Kunden hinweg

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Bankkonten: Anzeige und Zugang
- [ ] Angenommen ein Inhaber öffnet *Einstellungen → Stammdaten*, wenn die Seite lädt, dann steht nach dem Abschnitt „Umsatzsteuer“ der Abschnitt „Bankkonten“
- [ ] Angenommen der Kunde hat noch kein Bankkonto, wenn der Abschnitt angezeigt wird, dann erscheinen ein kurzer Erklärtext und der Knopf „Bankkonto hinzufügen“
- [ ] Angenommen es gibt mehrere Konten, wenn der Abschnitt angezeigt wird, dann steht das primäre Konto oben mit Kennzeichen „Primär“, danach die übrigen aktiven Konten in der Reihenfolge des Anlegens, archivierte Konten unten mit Kennzeichen „archiviert“
- [ ] Angenommen ein Konto wird angezeigt, wenn seine IBAN erscheint, dann ist sie in Viererblöcken formatiert
- [ ] Angenommen der Betreiber öffnet die Detailseite eines aktiven Kunden, wenn die Seite lädt, dann sieht er im Abschnitt „Stammdaten“ die Bankkonten und kann sie wie der Inhaber bearbeiten
- [ ] Angenommen ein Kunde ist deaktiviert, wenn der Betreiber dessen Detailseite öffnet, dann sind die Bankkonten nur lesbar
- [ ] Angenommen ein Mitarbeiter versucht, Bankkonten über einen anderen Weg als die Oberfläche zu lesen oder zu ändern, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt
- [ ] Angenommen ein Inhaber von Kunde A, wenn er versucht, Bankkonten von Kunde B zu lesen, anzulegen oder zu ändern, dann wird das abgelehnt (Mandantentrennung)

### Bankkonten: Anlegen und Ändern
- [ ] Angenommen ein Inhaber wählt „Bankkonto hinzufügen“, wenn die Eingabe erscheint, dann ist der Kontoinhaber mit dem Kundennamen vorbelegt
- [ ] Angenommen ein Inhaber erfasst Kontoinhaber und gültige IBAN und speichert, dann ist das Konto nach dem Neuladen vorhanden
- [ ] Angenommen der Kunde hat noch kein Konto, wenn das erste Konto gespeichert wird, dann ist es automatisch primär
- [ ] Angenommen es gibt ein primäres Konto, wenn der Inhaber ein anderes aktives Konto primär setzt und speichert, dann ist nur noch das neue Konto primär
- [ ] Angenommen der Inhaber ändert Felder eines bestehenden Kontos, wenn er speichert, dann sind die Änderungen nach dem Neuladen sichtbar und im Änderungsprotokoll vermerkt
- [ ] Angenommen der Inhaber hat Konten hinzugefügt oder geändert, aber nicht gespeichert, wenn er die Seite neu lädt, dann sind die Änderungen nicht übernommen
- [ ] Angenommen der Kunde hat 20 Konten (aktiv und archiviert), wenn der Inhaber ein weiteres hinzufügen will, dann ist das nicht möglich und ein Hinweis nennt die Höchstzahl

### Bankkonten: Validierung
- [ ] Angenommen jemand gibt als IBAN „at61 1904 3002 3457 3201“ ein, wenn gespeichert wird, dann wird „AT611904300234573201“ gespeichert und „AT61 1904 3002 3457 3201“ angezeigt
- [ ] Angenommen jemand gibt eine IBAN mit falscher Prüfziffer ein (z. B. „AT62 1904 3002 3457 3201“), wenn gespeichert wird, dann erscheint bei der IBAN eine verständliche Fehlermeldung und nichts wird gespeichert
- [ ] Angenommen jemand gibt eine österreichische IBAN mit 19 oder 21 Zeichen ein, wenn gespeichert wird, dann erscheint eine Fehlermeldung zur Länge
- [ ] Angenommen jemand gibt eine gültige deutsche IBAN ein, wenn gespeichert wird, dann wird sie akzeptiert
- [ ] Angenommen jemand gibt eine IBAN mit unbekanntem Länderkürzel ein, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen die IBAN ist beim selben Kunden bereits erfasst (auch bei einem archivierten Konto), wenn gespeichert wird, dann erscheint „Diese IBAN ist bereits erfasst“ und nichts wird gespeichert
- [ ] Angenommen dieselbe IBAN ist bei einem anderen Kunden erfasst, wenn gespeichert wird, dann wird sie akzeptiert
- [ ] Angenommen der Kontoinhaber ist leer oder besteht nur aus Leerzeichen, wenn gespeichert wird, dann erscheint beim Kontoinhaber eine Fehlermeldung
- [ ] Angenommen jemand gibt als BIC „rzbaatww“ ein, wenn gespeichert wird, dann wird „RZBAATWW“ gespeichert
- [ ] Angenommen jemand gibt einen BIC mit 9 Zeichen ein, wenn gespeichert wird, dann erscheint beim BIC eine Fehlermeldung
- [ ] Angenommen der BIC bleibt leer, wenn gespeichert wird, dann wird das Konto ohne BIC gespeichert
- [ ] Angenommen ein Konto hat weder Bezeichnung noch Bankname, wenn es angezeigt wird, dann erscheint nur die IBAN
- [ ] Angenommen ein Fehler bei einem Konto verhindert das Speichern, wenn die Meldung erscheint, dann bleiben alle Eingaben im Formular erhalten und das fehlerhafte Konto ist erkennbar markiert

### Bankkonten: Archivieren, Wiederherstellen, Löschen
- [ ] Angenommen ein Konto ist primär, wenn der Inhaber es archivieren oder löschen will, dann ist das nicht möglich und ein Hinweis sagt, dass zuerst ein anderes Konto primär werden muss
- [ ] Angenommen ein nicht primäres Konto ist keiner Wohnung fest zugeordnet, wenn der Inhaber es löscht und speichert, dann ist es entfernt
- [ ] Angenommen ein Konto ist Wohnungen fest zugeordnet, wenn der Inhaber es löschen will, dann ist Löschen gesperrt und der Hinweis nennt die Wohnungen („Objekt · Wohnung“)
- [ ] Angenommen ein nicht primäres Konto ist zwei Wohnungen fest zugeordnet, wenn der Inhaber es archivieren will, dann nennt ein Hinweis beide Wohnungen und kündigt an, dass sie auf „Primäres Konto“ zurückgestellt werden
- [ ] Angenommen der Inhaber bestätigt das Archivieren und speichert, wenn er danach die beiden Wohnungen öffnet, dann steht bei beiden „Primäres Konto“
- [ ] Angenommen ein Konto ist archiviert, wenn der Inhaber das Auswahlfeld einer Wohnung öffnet, dann erscheint das Konto dort nicht
- [ ] Angenommen ein Konto ist archiviert, wenn der Inhaber es wiederherstellt und speichert, dann ist es wieder aktiv und auswählbar; frühere Zuordnungen zu Wohnungen kommen nicht zurück
- [ ] Angenommen ein Wohnungskonto wurde zwischenzeitlich (in einem anderen Fenster) einer Wohnung fest zugeordnet, wenn der Inhaber das Konto in den Stammdaten löscht und speichert, dann wird das Speichern mit verständlicher Meldung abgelehnt und nichts gelöscht

### Wohnung: Hotel-ID
- [ ] Angenommen ein Inhaber öffnet eine Wohnung in *Einstellungen → Wohnungen*, wenn das Bearbeiten-Fenster erscheint, dann gibt es das Feld „booking.com Hotel-ID“
- [ ] Angenommen der Inhaber gibt „ 1234567 “ ein, wenn er speichert, dann wird „1234567“ gespeichert
- [ ] Angenommen der Inhaber gibt „AB-12345x“ ein, wenn er speichert, dann wird „AB-12345x“ unverändert gespeichert
- [ ] Angenommen der Inhaber gibt Zeichen außer Buchstaben, Ziffern und Bindestrich ein (z. B. „123/45“ oder „12 34“), wenn er speichert, dann erscheint eine Fehlermeldung beim Feld
- [ ] Angenommen der Inhaber gibt mehr als 30 Zeichen ein, wenn er speichert, dann erscheint eine Fehlermeldung bzw. die Eingabe ist auf 30 Zeichen begrenzt
- [ ] Angenommen eine andere Wohnung hat bereits dieselbe Hotel-ID, wenn der Inhaber speichert, dann wird ohne Warnung gespeichert
- [ ] Angenommen der Inhaber leert die Hotel-ID, wenn er speichert, dann ist sie danach nicht angegeben
- [ ] Angenommen eine Wohnung wird neu angelegt, wenn das Formular erscheint, dann kann die Hotel-ID gleich mit erfasst werden

### Wohnung: Bankkonto
- [ ] Angenommen der Kunde hat Bankkonten, wenn der Inhaber das Auswahlfeld „Bankkonto“ einer Wohnung öffnet, dann steht zuerst „Primäres Konto (…)“ mit gekürzter IBAN des primären Kontos, danach alle aktiven Konten mit voller IBAN in Viererblöcken und Bezeichnung
- [ ] Angenommen eine Wohnung wurde vor diesem Feature angelegt, wenn sie geöffnet wird, dann ist „Primäres Konto“ ausgewählt
- [ ] Angenommen eine Wohnung wird neu angelegt, wenn das Formular erscheint, dann ist „Primäres Konto“ vorausgewählt
- [ ] Angenommen eine Wohnung steht auf „Primäres Konto“, wenn in den Stammdaten ein anderes Konto primär gesetzt wird, dann gilt für die Wohnung ab sofort das neue primäre Konto, ohne dass die Wohnung bearbeitet wird
- [ ] Angenommen der Inhaber wählt für eine Wohnung ein bestimmtes Konto und speichert, wenn danach ein anderes Konto primär gesetzt wird, dann bleibt das gewählte Konto der Wohnung zugeordnet
- [ ] Angenommen der Inhaber hat für eine Wohnung ausdrücklich das Konto gewählt, das gerade primär ist, wenn später ein anderes Konto primär wird, dann bleibt die Wohnung beim ausdrücklich gewählten Konto
- [ ] Angenommen der Kunde hat noch kein Bankkonto, wenn der Inhaber eine Wohnung öffnet, dann zeigt das Feld „Kein Bankkonto erfasst“, ist gesperrt, darunter steht der Hinweis mit Link zu *Einstellungen → Stammdaten*, und die Wohnung lässt sich trotzdem speichern
- [ ] Angenommen ein Konto wurde zwischenzeitlich archiviert, wenn der Inhaber eine Wohnung mit diesem Konto speichern will, dann wird das abgelehnt und die Wohnung behält „Primäres Konto“
- [ ] Angenommen jemand versucht, einer Wohnung ein Konto eines anderen Kunden zuzuordnen, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt
- [ ] Angenommen ein Mitarbeiter versucht, Hotel-ID oder Bankkonto einer Wohnung über einen anderen Weg als die Oberfläche zu ändern, wenn die Anfrage beim Server ankommt, dann wird sie abgelehnt
- [ ] Angenommen ein Mitarbeiter liest Wohnungen über einen anderen Weg als die Oberfläche, wenn er die Daten erhält, dann enthalten sie höchstens Hotel-ID und Kontokennung, aber keine IBAN oder sonstigen Kontodaten (bewusste Ausnahme, siehe Technical Decisions)

### Allgemein
- [ ] Angenommen Inhaber und Betreiber haben die Stammdaten gleichzeitig geöffnet und einer hat Bankkonten gespeichert, wenn der andere speichert, dann erscheint der bestehende Hinweis „Die Kundendaten wurden inzwischen geändert“ und nichts wird überschrieben
- [ ] Angenommen Bankkonten, Hotel-ID oder Wohnungskonto werden geändert, wenn gespeichert wird, dann steht im Änderungsprotokoll, wer wann was geändert hat
- [ ] Angenommen Stammdaten-Seite oder Wohnungs-Fenster werden auf einem Handy (375 px Breite) geöffnet, wenn Konten mit langer IBAN und Bezeichnung angezeigt werden, dann gibt es kein seitliches Scrollen
- [ ] Angenommen bestehende Kunden und Wohnungen, wenn das Feature eingespielt wird, dann haben Kunden keine Bankkonten, Wohnungen keine Hotel-ID und „Primäres Konto“, und alle bisherigen Daten bleiben unverändert
- [ ] Angenommen das Speichern schlägt fehl (z. B. keine Verbindung), wenn der Nutzer speichert, dann erscheint eine Fehlermeldung und alle Eingaben bleiben erhalten

## Edge Cases
- **Alle aktiven Konten außer dem primären archiviert:** Auswahlfeld bei der Wohnung zeigt „Primäres Konto (…)“ und das primäre Konto selbst.
- **Nur archivierte Konten möglich?** Nein: Das primäre Konto ist nie archiviert. Gibt es mindestens ein Konto, gibt es genau ein aktives primäres.
- **Letztes Konto löschen:** Nicht möglich, da es primär ist. Ein Kunde mit Konten kann nicht auf null Konten zurück; das ist gewollt (Bankverbindung bleibt erhalten).
- **Primär setzen und altes Primärkonto archivieren in einem Speichervorgang:** erlaubt, solange am Ende genau ein aktives Konto primär ist.
- **Neues Konto anlegen und gleich primär setzen, bevor gespeichert wird:** erlaubt; nach dem Speichern ist nur das neue Konto primär.
- **Archivierte Wohnung mit fest zugeordnetem Konto:** zählt beim Löschen als Zuordnung (Löschen gesperrt) und wird beim Archivieren des Kontos ebenfalls auf „Primäres Konto“ zurückgestellt.
- **IBAN mit Sonderzeichen oder Bindestrichen eingefügt** (z. B. aus einer E-Mail „AT61-1904-…“): Fehlermeldung zum Format; nur Leerzeichen werden automatisch entfernt.
- **Kontoinhaber weicht vom Kundennamen ab** (z. B. Privatkonto des Inhabers): erlaubt, keine Prüfung.
- **Kundenname wird später geändert:** Kontoinhaber bestehender Konten bleibt unverändert (Vorbelegung nur beim Anlegen).
- **Kunde wird während der Bearbeitung deaktiviert:** Speichern wird abgelehnt, wie bei den übrigen Stammdaten.
- **Sehr lange Bezeichnung oder Bankname am Handy:** werden umgebrochen, kein seitliches Scrollen; im Auswahlfeld wird die Bezeichnung gekürzt, die IBAN bleibt vollständig lesbar.
- **Hotel-ID mit Groß- und Kleinbuchstaben gemischt:** wird unverändert gespeichert; „AB12“ und „ab12“ gelten als verschiedene Eingaben (keine Prüfung auf Dubletten ohnehin).

## Technical Requirements
- Rechte serverseitig durchgesetzt (Inhaber nur eigener Kunde, Betreiber Bankkonten aller aktiven Kunden, Mitarbeiter keinerlei Zugriff auf Bankkonten), nicht nur in der Oberfläche
- Regel „genau ein aktives primäres Konto, sobald es Konten gibt“ und IBAN-Eindeutigkeit je Kunde serverseitig abgesichert
- Wohnung darf nur auf ein aktives Konto desselben Kunden verweisen
- Validierungsregeln gleich in Oberfläche und Server
- Deutsche Texte über die bestehende i18n-Struktur
- Responsiv ab 375 px Breite

## Open Questions
- [ ] Wie und wo wird das Konto auf Rechnungen verwendet (Platzhalter, Kontoauswahl am Entwurf, Vorrang Wohnungskonto vor primärem Konto, EPC-QR)? Klärung im späteren Rechnungs-Paket.
- [ ] Reicht für Channex (PROJ-10) die Hotel-ID je Wohnung, oder braucht es zusätzlich Zimmertyp-/Rate-IDs? Klärung in PROJ-10.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigenes Feature PROJ-46 statt Änderung von PROJ-28/PROJ-6 | Beide sind deployed; Bankkonten und Wohnungszuordnung sind gemeinsam testbar und deploybar (wie PROJ-38 für das Logo) | 2026-11-06 |
| Hotel-ID je Wohnung, nicht je Kunde | Die booking.com-ID gehört zu einer Unterkunft; ein Kunde kann mehrere haben; Channex ordnet ebenfalls je Wohnung zu | 2026-11-06 |
| Hotel-ID: Buchstaben, Ziffern, Bindestrich, max. 30 Zeichen | Sicherheitshalber nicht auf Ziffern beschränkt (Nutzerwunsch); blockiert keine ungewöhnlichen Kennungen | 2026-11-06 |
| Dieselbe Hotel-ID bei mehreren Wohnungen erlaubt, ohne Warnung | Eine booking.com-Unterkunft umfasst oft mehrere Wohnungen als Zimmertypen | 2026-11-06 |
| Wohnungskonto mit Voreinstellung „Primäres Konto“, das automatisch folgt; ausdrückliche Wahl bleibt fest | Wechsel des Hauptkontos ohne Umstellen jeder Wohnung; trotzdem abweichende Konten je Wohnung möglich | 2026-11-06 |
| Löschen nur ohne feste Zuordnung zu Wohnungen; Archivieren stellt zugeordnete Wohnungen nach Bestätigung auf „Primäres Konto“ zurück | Keine Wohnung verweist ins Leere; aufgelöste Konten bleiben nachvollziehbar | 2026-11-06 |
| Primäres Konto weder archivier- noch löschbar; erstes Konto automatisch primär | Sobald es Konten gibt, ist immer genau eines primär; „Primäres Konto“ bei Wohnungen ist damit immer auflösbar | 2026-11-06 |
| Rollen wie bei den Stammdaten: Inhaber und Betreiber (Konten), nur Inhaber (Wohnung), Mitarbeiter nichts | Einheitlich mit PROJ-28/36/38 und PROJ-6; Betreiber kann beim Onboarding miterfassen | 2026-11-06 |
| Speichern mit dem gemeinsamen Knopf der Stammdaten-Seite | Einheitlich mit dem Umsatzsteuer-Verlauf (PROJ-36); ein Speichervorgang, ein Hinweis bei zwischenzeitlicher Änderung | 2026-11-06 |
| IBAN mit Länge-/Prüfziffernprüfung, ausländische erlaubt; BIC optional mit Formatprüfung | Fängt Tippfehler ab ohne Online-Abfrage; BIC im SEPA-Raum nicht mehr nötig, auf Rechnungen aber üblich | 2026-11-06 |
| IBAN je Kunde eindeutig (auch gegenüber archivierten), über Kunden hinweg nicht geprüft | Verhindert doppelte Einträge; verschiedene Kunden können legitim dasselbe Konto nennen (z. B. Ehepaar) und dürfen voneinander nichts erfahren | 2026-11-06 |
| Kontoinhaber Pflicht, mit Kundennamen vorbelegt; Bezeichnung optional mit Ersatzanzeige | Kontoinhaber gehört zur Bankverbindung; Bezeichnung nur zur Unterscheidung | 2026-11-06 |
| Keine Kontonummer/BLZ, keine SEPA-Gläubiger-ID, keine Banking-Zugangsdaten | Veraltet bzw. nur für Lastschriften nötig; App wickelt keine Zahlungen ab (PRD) | 2026-11-06 |
| Höchstens 20 Konten je Kunde | Auswahl bleibt übersichtlich; bei Bedarf anhebbar | 2026-11-06 |
| Kein Konto erfasst: Feld bei der Wohnung gesperrt mit Hinweis und Link, Wohnung trotzdem speicherbar | Bankkonten sind optional; Wohnungsverwaltung darf nicht blockiert werden | 2026-11-06 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Konten über die bestehende Stammdaten-Speicherfunktion, in einem Schritt mit den übrigen Stammdaten | Ein Speichern-Knopf, ein Konfliktschutz, alles-oder-nichts; gleiches Muster wie PROJ-36 | 2026-11-06 |
| Abgleich je Konto statt vollständigem Ersetzen | Wohnungen verweisen auf einzelne Konten; Ersetzen würde Verweise zerstören | 2026-11-06 |
| Kennung neuer Konten entsteht im Formular | Neues Konto kann im selben Speichervorgang primär werden; Abgleich ohne Zwischenschritt | 2026-11-06 |
| Wohnung: leerer Kontoverweis = „Primäres Konto“ | Folgt automatisch ohne Änderung an Wohnungen beim Primär-Wechsel; bestehende Wohnungen brauchen keine Datenübernahme | 2026-11-06 |
| Verweis Wohnung → Konto nur innerhalb desselben Kunden, Löschen bei Verweis von der Datenbank gesperrt, archivierte Konten an der Wohnung abgelehnt | Mandantentrennung und keine Verweise ins Leere, auch bei gleichzeitigem Arbeiten in zwei Fenstern | 2026-11-06 |
| Primär-Regeln (höchstens eines, nie archiviert) in der Datenbank, „genau eines, sobald Konten existieren“ in der Speicherfunktion | Absicherung unabhängig von der Oberfläche | 2026-11-06 |
| Bankkonten für Mitarbeiter nicht lesbar; Hotel-ID und Kontokennung an der Wohnung technisch für Mitglieder lesbar | Bankdaten sind sensibel (wie Umsatzsteuer-Verlauf); Wohnungsfelder folgen der bestehenden Leseregel der Wohnungen, IBAN bleibt geschützt | 2026-11-06 |
| `ibantools` für IBAN/BIC statt eigener Länderliste | Länderlängen ändern sich gelegentlich; gepflegtes, abhängigkeitsfreies Paket statt eigener Tabelle | 2026-11-06 |
| Konten als aufklappbare Karten im Formular statt eigenem Dialog | Änderungen werden wie alle Stammdaten erst mit „Speichern“ übernommen; ein Dialog würde ein eigenes Speichern suggerieren | 2026-11-06 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Überblick
Keine neue Seite. Erweitert werden:
- das gemeinsame Stammdaten-Formular (Inhaber unter *Einstellungen → Stammdaten*, Betreiber auf der Kunden-Detailseite) um den Bereich „Bankkonten“ nach „Umsatzsteuer“,
- die bestehende geschützte Speicherfunktion der Stammdaten (PROJ-28/36), die die Konten mitspeichert,
- das Bearbeiten-/Anlegen-Fenster der Wohnung um „booking.com Hotel-ID“ und „Bankkonto“,
- eine neue Tabelle „Bankkonten“ und zwei neue Felder an der Wohnung.

### B) Oberfläche (Komponenten)
```
Stammdaten-Formular (gemeinsam für Inhaber und Betreiber)
+-- Logo, Name, Adresse, Nummern, Umsatzsteuer (unverändert)
+-- NEU Bereich „Bankkonten“
|   +-- Leerzustand: Erklärtext + „Bankkonto hinzufügen“
|   +-- Liste der Konten (primär oben, dann aktive nach Anlage, dann archivierte)
|   |   +-- je Konto eine Karte, zugeklappt:
|   |   |     Anzeigename · IBAN in Viererblöcken · Kennzeichen „Primär“ bzw. „archiviert“
|   |   |     Aktionen: Bearbeiten (aufklappen) · Als primär festlegen · Archivieren/Wiederherstellen · Löschen
|   |   +-- aufgeklappt: Bezeichnung, Kontoinhaber, IBAN, BIC, Name der Bank, Notiz
|   +-- „Bankkonto hinzufügen“ (neue Karte aufgeklappt, Kontoinhaber = Kundenname; gesperrt bei 20)
|   +-- Bestätigung beim Archivieren eines zugeordneten Kontos (nennt die Wohnungen)
+-- Hinweis „inzwischen geändert“ (unverändert, gilt auch für die Konten)
+-- Speichern (eine Schaltfläche für alles)

Wohnungs-Fenster (Einstellungen → Wohnungen, nur Inhaber)
+-- bisherige Felder (unverändert)
+-- NEU Abschnitt „booking.com und Bankkonto“
    +-- Feld „booking.com Hotel-ID“
    +-- Auswahl „Bankkonto“: „Primäres Konto (AT61 1904 … 3201)“ · aktive Konten (IBAN · Bezeichnung)
    +-- ohne Konten: gesperrt, „Kein Bankkonto erfasst“ + Hinweis mit Link zu den Stammdaten
```
- **Bausteine:** vorhandene shadcn-Komponenten: `Card`, `Collapsible` (Auf-/Zuklappen), `Badge` (Primär/archiviert), `Input`, `Textarea` (Notiz), `Select` (Bankkonto), `DropdownMenu` (Aktionen je Konto), `AlertDialog` (Bestätigung Archivieren). Nichts Neues installieren.
- **Neue App-Komponente:** „Bankkonten-Bereich“ im Ordner der Stammdaten-Komponenten, analog zum Umsatzsteuer-Bereich.
- **Wohnungs-Zuordnungen anzeigen:** Beim Laden der Stammdaten wird je Konto mitgeladen, welche Wohnungen es fest verwenden („Objekt · Wohnung“). Damit kann das Formular Löschen sperren und beim Archivieren die Wohnungen nennen, ohne nachzufragen.
- **Handy (375 px):** Karten einspaltig, IBAN darf umbrechen; im Auswahlfeld wird die Bezeichnung gekürzt, die IBAN bleibt vollständig.
- **Deaktivierter Kunde (Betreiber):** nur lesbar, ohne Aktionen.

### C) Datenmodell (in Worten)
**Neue Tabelle „Bankkonten“** — je Konto:
- Kunde (Mandant), eindeutige Kennung
- Bezeichnung, Kontoinhaber, IBAN (ohne Leerzeichen, Großbuchstaben), BIC, Name der Bank, Notiz
- Kennzeichen „primär“ und „archiviert“
- Reihenfolge des Anlegens (für die Sortierung)
- die üblichen Felder „angelegt/geändert von/am“

Regeln in der Datenbank:
- IBAN je Kunde nur einmal (auch archivierte)
- je Kunde höchstens ein primäres Konto; ein primäres Konto ist nie archiviert
- Grundformat von IBAN, BIC und Längen als Prüfregel abgesichert

**Wohnung (bestehend), zwei neue Felder:**
- „booking.com Hotel-ID“ (leer = nicht angegeben; Prüfregel: Buchstaben, Ziffern, Bindestrich, 1–30 Zeichen)
- „Bankkonto“: Verweis auf ein Konto **desselben Kunden** oder leer. **Leer bedeutet „Primäres Konto“** — so folgt die Wohnung automatisch, ohne dass beim Primär-Wechsel Wohnungen geändert werden müssen.
- Eine Prüfung beim Speichern der Wohnung lehnt archivierte Konten ab.
- Ein Konto, auf das eine Wohnung verweist, lässt sich in der Datenbank nicht löschen.

Bestehende Kunden und Wohnungen: keine Konten, Felder leer (= „Primäres Konto“). Keine Datenübernahme.

**Lesen:**
- Bankkonten: Inhaber des Kunden und Betreiber-Admin. Mitarbeiter können die Tabelle nicht lesen (wie beim Umsatzsteuer-Verlauf).
- Wohnungsfelder: wie alle Wohnungsfelder lesbar für Mitglieder (also technisch auch für Mitarbeiter: Hotel-ID und die Kontokennung, nicht aber IBAN oder sonstige Kontodaten). In der Oberfläche sehen Mitarbeiter beides nicht.

**Schreiben:**
- Bankkonten: nur über die Speicherfunktion der Stammdaten; direktes Ändern ist für alle gesperrt.
- Wohnungsfelder: wie bisher nur Inhaber.

**Kunde (bestehend):** „zuletzt geändert am“ wird auch gesetzt, wenn sich nur Konten ändern — der vorhandene Konfliktschutz greift ohne Zusatzaufwand.

**Protokoll:** Das allgemeine Änderungsprotokoll (PROJ-1) erfasst die neue Tabelle und die Wohnungsfelder. Im Betreiber-Protokoll erscheint in „Stammdaten geändert“ die Feldangabe „Bankkonten“.

### D) Speichern der Stammdaten
Die bestehende Speicherfunktion erhält die Kontenliste als zusätzlichen Teil der Formulardaten. Anders als beim Umsatzsteuer-Verlauf wird die Liste **nicht vollständig ersetzt**, weil Wohnungen auf einzelne Konten verweisen. Stattdessen:
1. Rechte, aktiver Kunde, Stand vergleichen (unverändert)
2. Stammdaten und Umsatzsteuer-Verlauf speichern (unverändert)
3. **NEU Konten abgleichen:** Jedes Konto trägt eine feste Kennung, die beim Hinzufügen bereits im Formular vergeben wird. Fehlende Konten werden gelöscht (nur wenn keine Wohnung sie verwendet, sonst Abbruch mit Meldung samt Wohnungen), vorhandene geändert, neue angelegt.
4. **NEU Archivieren:** Wohnungen, die auf ein nun archiviertes Konto verweisen, werden auf „Primäres Konto“ (leer) zurückgestellt — auch archivierte Wohnungen.
5. **NEU Abschlussprüfung:** höchstens 20 Konten; gibt es Konten, ist genau ein aktives primär (erstes Konto wird automatisch primär); keine doppelte IBAN.
6. Protokoll nur bei echter Änderung, Feldliste ggf. mit „Bankkonten“

Alles in einem Schritt: entweder alles gespeichert oder nichts. Weil die Kennung schon im Formular entsteht, sind „neues Konto anlegen und sofort primär setzen“ sowie „anderes primär setzen und altes archivieren“ in einem Speichervorgang möglich.

**Wettlauf mit dem Wohnungs-Fenster:** Wird ein Konto gelöscht, während in einem anderen Fenster eine Wohnung darauf umgestellt wurde, verhindert der Datenbank-Verweis das Löschen → verständliche Meldung, nichts gespeichert. Wird eine Wohnung auf ein inzwischen archiviertes Konto gespeichert, lehnt die Prüfung an der Wohnung ab → Meldung, Wohnung bleibt unverändert.

### E) Prüfregeln (Oberfläche und Server gleich)
- **IBAN:** Leerzeichen entfernen, Großbuchstaben; Länderkürzel, Länge je Land und Prüfziffer über das Paket `ibantools` (aktuelle Länderliste, keine eigene Pflege). Anzeige in Viererblöcken über eine kleine eigene Hilfsfunktion; gekürzte Form „AT61 1904 … 3201“ für die Primär-Auswahl.
- **BIC:** Leerzeichen entfernen, Großbuchstaben; 8 oder 11 Zeichen, Format über `ibantools`.
- **Hotel-ID:** außen getrimmt; Buchstaben, Ziffern, Bindestrich; 1–30 Zeichen.
- **Längen:** Bezeichnung und Bankname 100, Kontoinhaber 200, Notiz 500.
- Die Datenbank sichert zusätzlich Grundformat, Eindeutigkeit und die Primär-Regeln ab; die Prüfziffer prüft der Server vor dem Aufruf.

### F) Wohnung speichern
Anlegen und Bearbeiten der Wohnung übernehmen die beiden neuen Felder in die bestehenden Speicherwege. Das Fenster lädt beim Öffnen die aktiven Konten des Kunden und das primäre Konto (nur Inhaber, kleiner Zusatzabruf). „Primäres Konto“ wird als leerer Wert gespeichert.

### G) Tests
- **Unit:** IBAN-/BIC-/Hotel-ID-Prüfung (Beispiele aus den Akzeptanzkriterien), Viererblöcke und gekürzte IBAN, Anzeigename, Formularregeln (genau ein primär, Höchstzahl, doppelte IBAN im Formular, Löschen/Archivieren des primären gesperrt).
- **Datenbank/Integration:** Abgleich (anlegen, ändern, löschen, archivieren mit Rückstellung der Wohnungen), Primär-Regeln, doppelte IBAN abgelehnt, Löschen bei Verweis abgelehnt, Wohnung auf archiviertes oder fremdes Konto abgelehnt, Mitarbeiter kann Konten weder lesen noch ändern, fremder Inhaber abgewiesen, Betreiber bei deaktiviertem Kunden abgewiesen, Protokoll mit „Bankkonten“.
- **E2E:** Konten erfassen und primär wechseln (Wohnung folgt), feste Zuordnung bleibt, Archivieren mit Bestätigung, leerer Zustand bei der Wohnung mit Link, Konfliktfall Inhaber/Betreiber, Handy-Breite, axe.
- **Regression:** PROJ-28/36/38 (Stammdaten, Verlauf, Logo, Konflikt), PROJ-6/27/15 (Wohnung anlegen/bearbeiten).

### H) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- Neue Tabelle mit Mandantentrennung; Lesen nur Inhaber + Admin, kein direktes Schreiben
- Speicherfunktion der Stammdaten erweitert (Kontenabgleich, Rückstellung von Wohnungen, Feldliste)
- Wohnung: zwei neue Felder mit Prüfregeln, Verweis nur auf eigene, aktive Konten
- Änderungsprotokoll erfasst die neue Tabelle

### Abhängigkeiten (Pakete)
- `ibantools`: Prüfung von IBAN (Länderlängen, Prüfziffer) und BIC; ohne weitere Abhängigkeiten. Vor dem Einbau sauber ohne `legacy-peer-deps` prüfen.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
