# PROJ-37: Rechnungen nacherfassen

## Status: Architected
**Created:** 2026-10-30
**Last Updated:** 2026-10-30

## Dependencies
- Requires: PROJ-4 (Kundenkonten & Rollen) — Rollen Inhaber/Mitarbeiter, Mandantentrennung
- Requires: PROJ-7 (Gäste-Datenbank) — Gastauswahl, Löschen/Anonymisieren, Zusammenführen
- Requires: PROJ-8 (Manuelle Buchungen) — Buchungen, Positionen, Buchungsdetail
- Requires: PROJ-28 (Kundenstammdaten) — Ort des Schalters „Rechnungen nacherfassen“
- Requires: PROJ-32, PROJ-34, PROJ-35, PROJ-36 — negative Beträge, Reihenfolge der Positionen, USt-Satz je Position, Kleinunternehmer-Status
- Wird genutzt von: PROJ-38 (Rechnung erstellen und ausstellen) — Rechnungsliste, Rechnungen je Buchung, Nummernvorschlag; PROJ-39 (PDF und Übersicht) — Filter, Erstellen aus der Übersicht

## Überblick
Das Rechnungsmodul wird in drei Teilen gebaut: **A** Rechnungen nacherfassen (dieses Feature), **B** Rechnung erstellen und ausstellen (PROJ-38), **C** PDF erzeugen und Übersicht ausbauen (PROJ-39). Ein Storno-Prozess folgt als eigenes Teilprojekt.

Teil A kommt zuerst: Kunden bringen Rechnungen aus ihrem bisherigen System mit. Sind diese erfasst, ist die Nummernfolge vollständig, bevor die App selbst Rechnungen ausstellt, und die Summe des bereits Verrechneten je Buchung stimmt.

**Eine nacherfasste Rechnung besteht aus:**

| Angabe | Pflicht | Regel |
|---|---|---|
| Rechnungsnummer | ja | freier Text bis 30 Zeichen, je Kunde eindeutig (ohne Rücksicht auf Groß-/Kleinschreibung und Leerzeichen am Rand) |
| Rechnungsdatum | ja | höchstens heute; älter als 7 Jahre → nur Hinweis |
| Buchung | nein | Auswahl per Suche (Gastname, Wohnung, Zeitraum); alle Buchungen und Optionen inkl. stornierter, keine Sperren |
| Gast | nein | mit Buchung: Hauptgast der Buchung vorbelegt, änderbar; ohne Buchung: Gastauswahl wie im Buchungsformular inkl. Neuanlage |
| Empfänger | ja | Freitext; vorbelegt mit der Firma des Gastes, sonst „Nachname Vorname“; jederzeit überschreibbar |
| Positionen | mind. eine | Bezeichnung, Betrag brutto (auch negativ), USt-Satz; mit Buchung aus der Buchung übernommen, anpassbar |
| PDF | nein | eine Datei, nur PDF, bis 10 MB |

**Positionen:** Wird eine Buchung gewählt, übernimmt die App deren Positionen (Übernachtung, Zusatzkosten, ggf. Stornogebühr) mit Bezeichnung, Betrag und USt-Satz in der Reihenfolge aus PROJ-34. Der Inhaber kann Positionen abwählen, Bezeichnung/Betrag/Satz ändern und eigene Positionen hinzufügen, bis die Rechnung dem PDF entspricht. Die Positionen sind eine **Kopie** zum Zeitpunkt der Erfassung; spätere Änderungen an der Buchung wirken nicht auf die Rechnung. Ohne Buchung beginnt die Positionsliste leer. Gesamtbetrag und enthaltene USt je Satz rechnet die App (wie PROJ-35). Gilt am Rechnungsdatum der Kleinunternehmer-Status (PROJ-36), wird keine USt ausgewiesen.

**Menüpunkt „Rechnungen“** zwischen „Gäste“ und „Einstellungen“ (am Handy unter „Mehr“), für Inhaber und Mitarbeiter:
- Liste mit Nummer, Datum, Empfänger, Buchung (Link oder „–“), Betrag, Status („nacherfasst“, ggf. Zusatz „ohne PDF“)
- Sortierung: Datum absteigend, bei gleichem Datum Nummer absteigend; seitenweise je 50
- Suchfeld nach Nummer oder Empfänger
- Knopf „Rechnung nacherfassen“ (nur Inhaber, nur wenn der Schalter eingeschaltet ist)
- Klick auf eine Zeile öffnet die **Rechnungsdetailseite**: alle Angaben, Positionen, USt je Satz, PDF öffnen/herunterladen; für Inhaber „Bearbeiten“ und „Löschen“

**Schalter „Rechnungen nacherfassen“** in *Einstellungen → Kunde* (PROJ-28), bedienbar durch Inhaber und Betreiber, Voreinstellung **ein**. Ausgeschaltet verschwindet nur der Knopf „Rechnung nacherfassen“; bestehende nacherfasste Rechnungen bleiben sichtbar und bearbeitbar. Wieder einschalten ist jederzeit möglich.

**Buchungsdetail:** Abschnitt „Rechnungen“ unter dem Preis, sobald mindestens eine Rechnung mit der Buchung verknüpft ist: je Rechnung Nummer, Datum, Empfänger, Betrag, Status mit Link; darunter „Verrechnet: € …“ und der Gesamtpreis zum Vergleich. Liegt die Summe über dem Gesamtpreis, erscheint der Hinweis „Verrechnet mehr als Gesamtpreis“ (keine Sperre). Ohne Rechnungen wird der Abschnitt ausgeblendet.

**Wer darf was:**

| Aktion | Inhaber | Mitarbeiter | Betreiber |
|---|---|---|---|
| Rechnungsliste, Rechnungsdetail, Abschnitt im Buchungsdetail sehen | ✓ | ✓ | – |
| PDF öffnen und herunterladen | ✓ | ✓ | – |
| Rechnung nacherfassen, bearbeiten, PDF ersetzen/entfernen, löschen | ✓ | – | – |
| Schalter „Rechnungen nacherfassen“ umlegen | ✓ | – | ✓ |

## User Stories
- Als **Inhaber** möchte ich meine Rechnungen aus dem bisherigen System samt PDF in der App ablegen, damit alle Rechnungen an einem Ort liegen.
- Als **Inhaber** möchte ich eine Altrechnung mit der zugehörigen Buchung und dem Gast verknüpfen, damit ich im Buchungsdetail sehe, was bereits verrechnet ist.
- Als **Inhaber** möchte ich die Positionen der Buchung übernehmen und an die tatsächliche Rechnung anpassen, damit Beträge und USt je Satz der Altrechnung korrekt in der App stehen.
- Als **Inhaber** möchte ich vor dem Erfassen schnell suchen, ob eine Rechnungsnummer schon drin ist, damit ich nichts doppelt erfasse.
- Als **Inhaber** möchte ich eine Fehlerfassung korrigieren oder löschen, damit der Bestand sauber bleibt.
- Als **Inhaber** möchte ich das Nacherfassen ausschalten, sobald alle Altrechnungen erfasst sind, damit der Knopf nicht mehr im Weg ist.
- Als **Mitarbeiter** möchte ich die Rechnungen einer Buchung sehen und das PDF öffnen, damit ich weiß, was verrechnet wurde und was zu kassieren ist.
- Als **Betreiber** möchte ich den Schalter beim Onboarding eines Kunden setzen können.

## Out of Scope
- Rechnungen in der App erstellen und ausstellen, Nummernformat, Startnummer und Nummernvorschlag, Knopf „Rechnung“ im Buchungsdetail (PROJ-38)
- Rechnungs-PDF erzeugen; Jahres- und Betragsfilter; „Rechnung erstellen“ aus der Übersicht (PROJ-39)
- Stornorechnung/Gutschrift als Prozess (eigenes Teilprojekt) — alte Gutschriften werden einfach mit negativen Beträgen nacherfasst
- Auslesen der Daten aus dem PDF (Texterkennung)
- Mehrere Dateien je Rechnung; andere Dateiformate als PDF (Fotos, Word)
- Eigene Empfängeranschrift — sie steht im PDF
- Zahlungsstatus („bezahlt/offen“) je Rechnung (PROJ-13)
- Zweiter Einstieg „Rechnung nacherfassen“ im Buchungsdetail
- Massenimport (z. B. CSV) von Altrechnungen
- Zugriff des Betreibers auf Rechnungen eines Kunden

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Menüpunkt und Liste
- [ ] Angenommen ein Inhaber oder Mitarbeiter ist angemeldet, wenn er die Navigation am Desktop ansieht, dann steht „Rechnungen“ zwischen „Gäste“ und „Einstellungen“
- [ ] Angenommen ein Nutzer am Handy, wenn er die untere Leiste ansieht, dann liegt „Rechnungen“ unter „Mehr“
- [ ] Angenommen es gibt nacherfasste Rechnungen, wenn ein Nutzer „Rechnungen“ öffnet, dann sieht er Nummer, Datum („Mi, 28.10.2026“), Empfänger, Buchung (Link oder „–“), Betrag (zwei Nachkommastellen, negativ rot mit „-€“) und Status „nacherfasst“
- [ ] Angenommen eine Rechnung ohne PDF, wenn sie in der Liste steht, dann trägt sie den Zusatz „ohne PDF“
- [ ] Angenommen mehrere Rechnungen, wenn die Liste angezeigt wird, dann ist sie nach Datum absteigend und bei gleichem Datum nach Nummer absteigend sortiert
- [ ] Angenommen mehr als 50 Rechnungen, wenn die Liste angezeigt wird, dann wird seitenweise zu je 50 geblättert
- [ ] Angenommen ein Nutzer tippt einen Teil einer Nummer oder eines Empfängers ins Suchfeld, wenn die Liste aktualisiert ist, dann zeigt sie nur passende Rechnungen
- [ ] Angenommen keine Rechnungen und das Nacherfassen ist eingeschaltet, wenn ein Inhaber die Liste öffnet, dann steht „Noch keine Rechnungen“ mit dem Knopf „Rechnung nacherfassen“
- [ ] Angenommen keine Rechnungen, wenn ein Mitarbeiter die Liste öffnet, dann steht „Noch keine Rechnungen“ ohne Knopf
- [ ] Angenommen ein Nutzer klickt auf eine Zeile, wenn die Seite lädt, dann öffnet sich die Detailseite genau dieser Rechnung (auch in Safari)

### Nacherfassen: Formular und Pflichtangaben
- [ ] Angenommen ein Inhaber und das Nacherfassen ist eingeschaltet, wenn er „Rechnung nacherfassen“ wählt, dann öffnet sich das Formular mit Nummer, Datum, Buchung, Gast, Empfänger, Positionen und PDF
- [ ] Angenommen das Formular ist leer, wenn der Inhaber speichert, dann erscheinen Fehlermeldungen bei Nummer, Datum, Empfänger und Positionen, und nichts wird gespeichert
- [ ] Angenommen ein Rechnungsdatum nach heute, wenn gespeichert wird, dann erscheint „Das Rechnungsdatum darf nicht in der Zukunft liegen“
- [ ] Angenommen ein Rechnungsdatum älter als 7 Jahre, wenn das Datum eingegeben ist, dann erscheint ein Hinweis, das Speichern bleibt aber möglich
- [ ] Angenommen eine Nummer mit mehr als 30 Zeichen, wenn gespeichert wird, dann erscheint eine Fehlermeldung
- [ ] Angenommen beim Kunden existiert die Nummer „2025-0042“, wenn ein Inhaber „ 2025-0042 “ oder „R-1“ statt „r-1“ (vorhanden) erfasst, dann erscheint „Diese Rechnungsnummer ist bereits vergeben (Rechnung vom …)“ und nichts wird gespeichert
- [ ] Angenommen ein anderer Kunde hat dieselbe Nummer, wenn ein Inhaber sie erfasst, dann wird gespeichert (Nummern sind je Kunde eindeutig)
- [ ] Angenommen gültige Angaben, wenn der Inhaber speichert, dann erscheint die Rechnung in der Liste und er landet auf ihrer Detailseite
- [ ] Angenommen jemand umgeht die Prüfungen im Browser, wenn eine doppelte Nummer, ein Datum in der Zukunft oder eine Rechnung ohne Positionen gesendet wird, dann lehnt der Server ab

### Buchung, Gast und Empfänger
- [ ] Angenommen ein Inhaber sucht im Feld „Buchung“ nach Gastname, Wohnung oder Zeitraum, wenn Treffer erscheinen, dann zeigen sie z. B. „Huber Maria · Top 3 · Mi, 14.10.2026 – Sa, 17.10.2026“
- [ ] Angenommen es gibt eine stornierte Buchung und eine Sperre, wenn der Inhaber sucht, dann findet er die stornierte Buchung, die Sperre aber nicht
- [ ] Angenommen der Inhaber wählt eine Buchung, wenn die Auswahl übernommen ist, dann ist der Hauptgast der Buchung als Gast eingetragen
- [ ] Angenommen der Gast hat eine Firma, wenn er übernommen wird, dann ist der Empfänger mit dem Firmennamen vorbelegt; ohne Firma mit „Nachname Vorname“
- [ ] Angenommen der Empfänger ist vorbelegt, wenn der Inhaber ihn überschreibt und speichert, dann gilt sein Text
- [ ] Angenommen der Empfänger wurde von Hand geändert, wenn der Inhaber danach den Gast wechselt, dann bleibt sein Text erhalten
- [ ] Angenommen eine Buchung ist gewählt, wenn der Inhaber einen anderen Gast wählt, dann wird dieser verknüpft
- [ ] Angenommen keine Buchung, wenn der Inhaber im Feld „Gast“ sucht, dann kann er einen bestehenden Gast wählen oder wie im Buchungsformular einen neuen anlegen
- [ ] Angenommen weder Buchung noch Gast, wenn der Inhaber mit Empfänger und Positionen speichert, dann wird die Rechnung gespeichert

### Positionen und Beträge
- [ ] Angenommen eine Buchung mit Übernachtung, Reinigung und Rabatt, wenn der Inhaber sie wählt, dann erscheinen diese Positionen mit Bezeichnung, Betrag und USt-Satz in der Reihenfolge der Buchung
- [ ] Angenommen eine stornierte Buchung mit Stornogebühr, wenn der Inhaber sie wählt, dann wird die Stornogebühr als Position übernommen
- [ ] Angenommen übernommene Positionen, wenn der Inhaber eine abwählt, einen Betrag oder Satz ändert oder eine eigene Position hinzufügt, dann rechnen Gesamtbetrag und USt je Satz sofort neu
- [ ] Angenommen bereits Positionen eingetragen sind, wenn der Inhaber eine (andere) Buchung wählt, dann fragt die App, ob die Positionen durch die der Buchung ersetzt werden sollen
- [ ] Angenommen keine Buchung, wenn das Formular öffnet, dann ist die Positionsliste leer und der Inhaber trägt Positionen selbst ein
- [ ] Angenommen negative Positionen, wenn der Gesamtbetrag unter 0 fällt, dann wird gespeichert und der Betrag rot mit „-€“ angezeigt
- [ ] Angenommen Positionen mit 10 % und 20 %, wenn die Rechnung angezeigt wird, dann sind Gesamtbetrag brutto und die enthaltene USt je Satz ausgewiesen
- [ ] Angenommen am Rechnungsdatum gilt laut PROJ-36 „Kleinunternehmer“, wenn die Rechnung erfasst oder angezeigt wird, dann wird keine USt ausgewiesen
- [ ] Angenommen eine Rechnung ist gespeichert, wenn danach die verknüpfte Buchung geändert wird, dann bleiben die Positionen der Rechnung unverändert

### PDF
- [ ] Angenommen ein Inhaber wählt eine PDF-Datei bis 10 MB, wenn er speichert, dann ist das PDF an der Rechnung abgelegt
- [ ] Angenommen eine Datei, die kein PDF ist, oder ein PDF über 10 MB, wenn sie gewählt wird, dann erscheint eine verständliche Meldung und nichts wird abgelegt
- [ ] Angenommen eine Rechnung ohne PDF, wenn der Inhaber später ein PDF nachreicht, dann entfällt der Zusatz „ohne PDF“
- [ ] Angenommen eine Rechnung mit PDF, wenn der Inhaber ein neues PDF hochlädt und speichert, dann ersetzt es das alte, und das alte ist nicht mehr abrufbar
- [ ] Angenommen ein Inhaber oder Mitarbeiter öffnet die Rechnungsdetailseite, wenn ein PDF vorhanden ist, dann kann er es öffnen und herunterladen
- [ ] Angenommen jemand ist nicht angemeldet oder gehört zu einem anderen Kunden, wenn er eine PDF-Adresse aufruft, dann wird nichts ausgeliefert
- [ ] Angenommen ein Inhaber lädt ein PDF hoch, schließt das Formular aber ohne Speichern, wenn er später nachsieht, dann ist kein PDF abgelegt und keines bleibt dauerhaft liegen

### Bearbeiten und Löschen
- [ ] Angenommen ein Inhaber öffnet eine nacherfasste Rechnung, wenn er „Bearbeiten“ wählt, dann kann er alle Angaben ändern, mit denselben Regeln wie beim Erfassen
- [ ] Angenommen eine Rechnung ohne Buchung, wenn der Inhaber nachträglich eine Buchung setzt, dann erscheint sie im Buchungsdetail dieser Buchung; entfernt er sie wieder, verschwindet sie dort
- [ ] Angenommen ein Inhaber wählt „Löschen“, wenn er bestätigt, dann sind Rechnung und PDF entfernt; bricht er ab, bleibt alles erhalten
- [ ] Angenommen zwei Inhaber bearbeiten gleichzeitig dieselbe Rechnung, wenn der zweite speichert, dann wird er auf die zwischenzeitliche Änderung hingewiesen
- [ ] Angenommen eine Rechnung wird angelegt, geändert oder gelöscht, wenn jemand das Änderungsprotokoll ansieht, dann ist dies mit Person und Zeitpunkt vermerkt

### Schalter „Rechnungen nacherfassen“
- [ ] Angenommen ein bestehender oder neuer Kunde, wenn der Inhaber *Einstellungen → Kunde* öffnet, dann ist der Schalter „Rechnungen nacherfassen“ eingeschaltet
- [ ] Angenommen der Inhaber schaltet ihn aus und speichert, wenn er „Rechnungen“ öffnet, dann gibt es keinen Knopf „Rechnung nacherfassen“, die bestehenden Rechnungen bleiben sichtbar und bearbeitbar
- [ ] Angenommen der Schalter ist aus, wenn jemand trotzdem eine Nacherfassung an den Server sendet, dann wird sie abgelehnt
- [ ] Angenommen der Schalter ist aus, wenn der Inhaber ihn wieder einschaltet, dann ist der Knopf wieder da
- [ ] Angenommen der Betreiber öffnet die Detailseite eines aktiven Kunden, wenn die Stammdaten angezeigt werden, dann kann er den Schalter umlegen

### Buchungsdetail
- [ ] Angenommen eine Buchung mit zwei verknüpften Rechnungen, wenn ein Inhaber oder Mitarbeiter das Buchungsdetail öffnet, dann steht unter dem Preis der Abschnitt „Rechnungen“ mit beiden Rechnungen (Link), „Verrechnet: € …“ und dem Gesamtpreis (auch für Mitarbeiter)
- [ ] Angenommen die Summe der Rechnungen liegt über dem Gesamtpreis, wenn der Abschnitt angezeigt wird, dann erscheint der Hinweis „Verrechnet mehr als Gesamtpreis“
- [ ] Angenommen eine Buchung ohne Rechnungen, wenn das Buchungsdetail angezeigt wird, dann gibt es keinen Abschnitt „Rechnungen“
- [ ] Angenommen das Buchungsdetail im Kalender-Panel (PROJ-9), wenn es Rechnungen gibt, dann erscheint der Abschnitt dort ebenso

### Rollen
- [ ] Angenommen ein Mitarbeiter, wenn er Liste oder Detailseite öffnet, dann sieht er alle Angaben und kann PDFs öffnen, aber es gibt keine Knöpfe zum Nacherfassen, Bearbeiten oder Löschen
- [ ] Angenommen ein Mitarbeiter sendet eine Nacherfassung, Änderung oder Löschung direkt an den Server, wenn sie ankommt, dann wird sie abgelehnt
- [ ] Angenommen ein Nutzer von Kunde A, wenn er die Adresse einer Rechnung von Kunde B aufruft, dann sieht er „nicht gefunden“

### Gäste (PROJ-7)
- [ ] Angenommen ein Gast ist mit einer Rechnung verknüpft und wird anonymisiert, wenn die Rechnung angezeigt wird, dann sind Empfänger, Positionen und PDF unverändert und der Gast heißt „Gelöschter Gast“
- [ ] Angenommen ein Gast hat Rechnungen, aber keine Buchungen, wenn der Inhaber „Gast löschen“ wählt, dann wird er anonymisiert statt endgültig gelöscht, mit derselben Erklärung wie bei Buchungen
- [ ] Angenommen zwei Gäste werden zusammengeführt, wenn der Vorgang abgeschlossen ist, dann hängen die Rechnungen beider am verbleibenden Gast

## Edge Cases
- **Altrechnung deckt nur einen Teil der Buchung** (z. B. Anzahlung): Positionen abwählen bzw. Betrag anpassen; im Buchungsdetail ist die Summe dann unter dem Gesamtpreis
- **Mehrere Altrechnungen für dieselbe Buchung**: alle verknüpfen; die Summe kann den Gesamtpreis übersteigen → nur Hinweis
- **Alte Stornorechnung oder Gutschrift**: mit negativen Positionen erfassen; sie mindert die verrechnete Summe der Buchung
- **Buchung in der App hat sich seit der Altrechnung geändert**: die Rechnung behält ihre Kopie; der Hinweis im Buchungsdetail zeigt Abweichungen
- **Empfänger-Text vorbelegt, dann Gast entfernt**: Empfänger bleibt stehen; der Inhaber passt ihn bei Bedarf an
- **Gast in der Buchung gewechselt, nachdem die Rechnung erfasst wurde**: die Rechnung behält ihren Gast
- **Rechnungsnummer mit anderem Format** (z. B. „2024/17“): wird gespeichert; der spätere Nummernvorschlag (PROJ-38) wertet nur `JJJJ-NNNN` aus
- **Upload bricht ab (Netzwerk)**: verständliche Meldung, die übrigen Eingaben bleiben im Formular erhalten
- **Beschädigtes oder passwortgeschütztes PDF**: wird abgelegt, sofern es eine PDF-Datei ist; die App prüft den Inhalt nicht
- **Kunde deaktiviert** (PROJ-5): Rechnungen bleiben erhalten und lesbar; Erfassen und Bearbeiten wie bei den übrigen Daten gesperrt
- **Kunde gelöscht** (PROJ-5): Rechnungen und PDFs werden mitgelöscht

## Technical Requirements (optional)
- Security: Mandantentrennung wie bei allen Kundendaten; Rollenprüfung serverseitig; PDFs nie über öffentliche Adressen
- Grenzen: PDF bis 10 MB; Nummer bis 30 Zeichen; Positionen mit denselben Betrags- und Satzgrenzen wie in Buchungen (PROJ-32, PROJ-35)
- Aufbewahrung: Rechnungen werden nicht automatisch gelöscht
- Browser: Chrome, Firefox, Safari; responsiv für Desktop und Handy

## Open Questions
- [ ] Kleinunternehmer-Status einer Rechnung: Rechnungsdatum (so festgelegt und an der Rechnung festgehalten) oder bei verknüpfter Buchung deren Regel aus PROJ-36 (Abreise bzw. Stornodatum)? Wird spätestens in PROJ-38 einheitlich entschieden

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Rechnungsmodul in drei Teile (A Nacherfassen, B Erstellen/Ausstellen, C PDF/Übersicht); Storno eigenes Teilprojekt | Kleinere, getrennt auslieferbare Schritte; Nacherfassen zuerst, damit Nummernfolge und Verrechnetes stimmen | 2026-10-30 |
| Menüpunkt „Rechnungen“ schon in Teil A als einfache Liste | Einziger Einstieg, der auch Rechnungen ohne Buchung abdeckt; Teil C baut die Liste nur aus | 2026-10-30 |
| Buchung und Gast optional, Empfänger Pflicht | Sehr alte Rechnungen haben oft keine Buchung/keinen Gast in der App; Pflicht würde das Nacherfassen bremsen | 2026-10-30 |
| Empfänger vorbelegt: Firma, sonst Gast; immer überschreibbar | Entspricht dem üblichen Rechnungsempfänger; Altrechnungen weichen manchmal ab | 2026-10-30 |
| Positionen aus der Buchung als Kopie, anpassbar | Altrechnungen decken sich nicht immer mit der Buchung (Teilrechnung, spätere Preisänderung); Kopie bleibt stabil | 2026-10-30 |
| Gesamtbetrag und USt je Satz werden aus Positionen berechnet | Einheitlich mit PROJ-35; spätere Auswertungen bekommen saubere Netto-/Steuerwerte | 2026-10-30 |
| Schalter „Rechnungen nacherfassen“ in den Kundenstammdaten, Voreinstellung ein, wirkt nur auf den Knopf | Nach der Übernahme der Altrechnungen wird der Knopf nicht mehr gebraucht; Korrekturen bleiben möglich | 2026-10-30 |
| Nacherfasste Rechnungen bearbeitbar und löschbar (mit Bestätigung und Protokoll) | Sie sind Kopien, das Original liegt im Altsystem; Fehlerfassungen müssen entfernbar sein. Gilt nicht für in der App ausgestellte Rechnungen (PROJ-38) | 2026-10-30 |
| PDF optional, nur PDF bis 10 MB, eine Datei | Originale liegen teils nur auf Papier; Kennzeichnung „ohne PDF“ und Nachreichen möglich | 2026-10-30 |
| Rechnungsnummer freier Text bis 30 Zeichen, je Kunde eindeutig | Altsysteme nummerieren unterschiedlich; Doppelungen wären Erfassungsfehler | 2026-10-30 |
| Datum höchstens heute; älter als 7 Jahre nur Hinweis | Altrechnungen liegen nie in der Zukunft; ältere zu erfassen ist erlaubt | 2026-10-30 |
| Mitarbeiter sehen Rechnungen und PDFs, dürfen nichts ändern | Sie müssen wissen, was verrechnet bzw. zu kassieren ist | 2026-10-30 |
| Liste mit Suchfeld, ohne Filter | Schnelle Doppelprüfung beim Erfassen; Jahres-/Betragsfilter folgen in PROJ-39 | 2026-10-30 |
| Abschnitt „Rechnungen“ im Buchungsdetail nur, wenn Rechnungen vorhanden; Überschreitung nur Hinweis | Schlanke Seite; Altdaten weichen legitim ab | 2026-10-30 |
| Wählbar: alle Buchungen und Optionen inkl. stornierter, keine Sperren | Alte Stornorechnungen gehören zu stornierten Buchungen; Sperren haben weder Gast noch Preis | 2026-10-30 |
| Rechnungen überstehen Anonymisieren; Gast mit Rechnungen nur anonymisierbar; Zusammenführen zieht Rechnungen mit | Aufbewahrungspflicht 7 Jahre (BAO) geht vor; gleiche Regel wie Buchungen in PROJ-7 | 2026-10-30 |
| Kein zweiter Einstieg im Buchungsdetail | Knopfleiste bleibt schlank; Buchungssuche im Formular reicht | 2026-10-30 |
| Mitarbeiter sehen im Rechnungsabschnitt des Buchungsdetails auch Gesamtpreis und Vergleich | Entscheidung des Nutzers in /architecture; abweichend von PROJ-8/35, wo Mitarbeiter keine Buchungspreise sehen | 2026-10-30 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Tabellen „Rechnung“ und „Rechnungsposition“ statt Felder an der Buchung | Mehrere Rechnungen je Buchung, Rechnungen ohne Buchung; Positionen sind eine unabhängige Kopie | 2026-10-30 |
| Gleiches Datenmodell wie später für ausgestellte Rechnungen (Feld „Herkunft“) | PROJ-38/39 bauen ohne Umbau darauf auf; Liste, Summen und Nummernprüfung gelten für beide | 2026-10-30 |
| Gesamtbetrag und Kleinunternehmer-Kennzeichen von der Datenbank gebildet und gespeichert | Liste und Summen brauchen keine Neuberechnung; Werte lassen sich nicht vom Browser verfälschen; Mitarbeiter brauchen den Status-Verlauf nicht | 2026-10-30 |
| Kleinunternehmer-Kennzeichen nach Rechnungsdatum, festgehalten an der Rechnung | Wie im Spec-Interview festgelegt; ändert sich der Verlauf später, bleibt die erfasste Rechnung stabil | 2026-10-30 |
| Eindeutigkeit über einen Vergleichsschlüssel (Kleinschreibung, ohne Rand-Leerzeichen) je Kunde in der Datenbank | Doppelte Nummern werden auch bei gleichzeitigen Eingaben sicher abgelehnt | 2026-10-30 |
| Neuer privater Speicherbereich „Rechnungen“, Upload direkt vom Browser | Trennung von Ausweisbildern (andere Regeln, Größe, Typ); Vercel-Grenze von 4,5 MB je Server-Anfrage | 2026-10-30 |
| Bestehende tägliche Bereinigung erweitern statt zweitem Zeitplan | Ein Zeitplan, ein Schlüssel, gleiche Logik („älter als 24 Stunden und unverwendet“) | 2026-10-30 |
| Eine Speicherfunktion für Anlegen und Ändern, Positionen im selben Schritt | Rechnung und Positionen gelingen oder scheitern gemeinsam; Konfliktschutz wie PROJ-28 | 2026-10-30 |
| Eigene Lesefunktion „Rechnungen einer Buchung“ mit Gesamtpreis für alle Mitglieder | Nutzerentscheidung: Mitarbeiter sehen im Rechnungsabschnitt auch den Gesamtpreis; Buchungspreise bleiben sonst für sie verborgen | 2026-10-30 |
| Buchungssuche als Datenbank-Funktion, höchstens 20 Treffer | Suche über Gast, Wohnung und Zeitraum über alle Jahre; schnelle Antwort auch bei vielen Buchungen | 2026-10-30 |
| Formular als seitliches Panel, Liste und Detail als eigene Seiten | Gleiches Bedienmuster wie Buchungen und Gäste; Detail per Adresse verlinkbar (Buchungsdetail, Liste) | 2026-10-30 |
| Suchbegriff und Seite in der Adresszeile | Zurück-Knopf und Rückkehr aus dem Detail behalten den Stand; Vorbereitung für die Filter in PROJ-39 | 2026-10-30 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ausgangslage (bereits vorhanden)
- **Privater Dateispeicher** samt Muster aus PROJ-29: Upload direkt vom Browser in einen Ordner je Kunde, kurzlebige Abruf-Links, Löschen nur durch den Server, tägliche Bereinigung per Vercel Cron (`/api/cron/ausweisbilder`).
- **Geschützte Datenbank-Funktionen** mit Konfliktschutz („erwarteter Stand“) wie bei den Kundenstammdaten (PROJ-28) und automatisches **Änderungsprotokoll** für Tabellen.
- **Bausteine:** Gastauswahl samt Neuanlage (`guest-picker`), sortierbare Positionen mit USt-Satz (`sortable-charges`, `vat-rate-input`, `label-combobox`), Betragsfeld und -anzeige (PROJ-31/32), Rechenregel `vatBreakdown` (PROJ-35), Detail-Panel, Seitenkopf, leere Zustände, Bestätigungsdialog, zentrale Navigation.
- **Gast-Funktionen** Löschen, Anonymisieren und Zusammenführen (PROJ-7), **Kunde löschen** durch den Betreiber (PROJ-5).

### A) Seiten und Bausteine
```
Navigation
+-- NEU „Rechnungen“ (/rechnungen) nach „Gäste“, für Inhaber und Mitarbeiter; am Handy unter „Mehr“

Rechnungsliste (/rechnungen)
+-- Seitenkopf „Rechnungen“ + Knopf „Rechnung nacherfassen“ (nur Inhaber, nur wenn Schalter ein)
+-- Suchfeld (Nummer oder Empfänger; Suchbegriff steht in der Adresszeile)
+-- Tabelle (Desktop) bzw. Karten (Handy): Nummer · Datum · Empfänger · Buchung · Betrag · Status
|   +-- Nummer ist der Link (kein Overlay über der Zeile – Safari-Fehler)
+-- Blättern je 50 (vorhandener Baustein „Pagination“)
+-- Leerer Zustand „Noch keine Rechnungen“ (+ Knopf für Inhaber)

Rechnungsdetail (/rechnungen/[id])
+-- Kopf: Nummer, Datum, Status („nacherfasst“, ggf. „ohne PDF“)
+-- Empfänger · Gast (Link) · Buchung (Link)
+-- Positionen (Bezeichnung · Satz · Betrag), Gesamtbetrag
+-- „darin enthaltene USt“ je Satz bzw. „Keine Umsatzsteuer (Kleinunternehmer)“
+-- PDF: „Öffnen“ (neuer Tab) und „Herunterladen“
+-- Inhaber: „Bearbeiten“ (öffnet Formular-Panel) · „Löschen“ (Bestätigungsdialog)

Formular-Panel „Rechnung nacherfassen“ / „Rechnung bearbeiten“ (seitliches Panel wie Buchungen)
+-- Rechnungsnummer · Rechnungsdatum (Hinweis bei > 7 Jahren)
+-- NEU Buchungsauswahl (Kombinationsfeld mit Suche, Popover + Command)
|   +-- bei Wahl: Gast und Empfänger vorbelegen, Positionen übernehmen (Rückfrage, falls schon Positionen da sind)
+-- Gastauswahl (vorhandener Baustein, inkl. Neuanlage)
+-- Empfänger (Text; bleibt, sobald von Hand geändert)
+-- Positionen: vorhandene sortierbare Zeilen mit Bezeichnung · Betrag · USt-Satz · Entfernen; „Position hinzufügen“
+-- Summe und USt je Satz, laufend neu gerechnet
+-- PDF-Feld: Datei wählen · Fortschritt · „Ersetzen“ · „Entfernen“
+-- Speichern · Abbrechen

Buchungsdetail (Seite und Kalender-Panel)
+-- NEU Abschnitt „Rechnungen“ unter dem Preis (nur wenn vorhanden)
    +-- je Rechnung: Nummer (Link) · Datum · Empfänger · Betrag · Status
    +-- „Verrechnet: € …“ · „Gesamtpreis: € …“ · ggf. Hinweis „Verrechnet mehr als Gesamtpreis“

Einstellungen → Kunde (Inhaber) und Betreiber-Kundendetail
+-- NEU Schalter „Rechnungen nacherfassen“ im Stammdaten-Formular
```

### B) Datenmodell (in Worten)

**Rechnung** (neue Tabelle, je Kunde):
- Rechnungsnummer (Text, höchstens 30 Zeichen) und ein daraus abgeleiteter **Vergleichsschlüssel** (ohne Rand-Leerzeichen, Kleinschreibung), der je Kunde eindeutig sein muss
- Rechnungsdatum (nicht nach heute, Zeitzone Wien)
- Herkunft: „nacherfasst“ (PROJ-38 ergänzt „ausgestellt“)
- Buchung (optional; nur Buchungen und Optionen desselben Kunden, keine Sperren)
- Gast (optional; nur Gäste desselben Kunden)
- Empfänger (Text, Pflicht, höchstens 200 Zeichen)
- **Kleinunternehmer-Kennzeichen**: beim Speichern aus dem Verlauf (PROJ-36) zum Rechnungsdatum ermittelt und an der Rechnung festgehalten
- **Gesamtbetrag** in Cent, von der Datenbank aus den Positionen gebildet (nie vom Browser übernommen)
- PDF: Speicherort der Datei (optional)
- Zeitstempel und Bearbeiter wie bei allen Tabellen; Änderungsprotokoll

**Rechnungsposition** (neue Tabelle):
- Rechnung, Reihenfolge, Bezeichnung, Bruttobetrag in Cent (auch negativ), USt-Satz (0,00–100,00)
- Grenzen wie bei den Zusatzkosten der Buchungen (PROJ-32/35); mindestens eine Position je Rechnung

**Kunde** (bestehende Tabelle): neues Feld „Rechnungen nacherfassen“ (ja/nein, Standard ja; bestehende Kunden bekommen „ja“).

**Rechnungs-PDFs** liegen in einem neuen **privaten Speicherbereich** („Rechnungen“) in Supabase Storage (EU): ein Ordner je Kunde, zufälliger Dateiname, nur PDF, höchstens 10 MB, kein öffentlicher Zugriff.

### C) Rechte

| Aktion | Inhaber | Mitarbeiter | Betreiber-Admin |
|---|---|---|---|
| Rechnungen, Positionen, PDF lesen | ✓ | ✓ | ✓ (Datenbank, wie alle Kundendaten; keine eigene Oberfläche) |
| Abschnitt im Buchungsdetail inkl. Gesamtpreis | ✓ | ✓ | – |
| Nacherfassen (nur bei Schalter ein), bearbeiten, löschen | ✓ | – | – |
| PDF hochladen | ✓ (in den eigenen Ordner) | – | – |
| Schalter umlegen | ✓ | – | ✓ |

- Alle Prüfungen (Rolle, Schalter, Mandant, Nummer, Datum, Positionen, Datei gehört zum Kunden und hängt an keiner anderen Rechnung) macht die **Datenbank**, nicht nur die Oberfläche.
- Der Schalter gilt nur fürs **Anlegen**; Bearbeiten und Löschen bleiben immer möglich.
- Bei **deaktivierten Kunden** sind Rechnungen wie alle Daten nur lesbar.
- **Mitarbeiter** sehen Buchungspreise weiterhin nicht im Preisbereich der Buchung. Für den Rechnungsabschnitt liefert eine eigene Lesefunktion Rechnungen, verrechnete Summe und Gesamtpreis an alle Mitglieder (Entscheidung des Nutzers).

### D) Speichern und Löschen
- **Rechnung speichern** (eine geschützte Funktion für Anlegen und Ändern): Rechnung und alle Positionen in einem Schritt; beim Ändern mit Konfliktschutz („inzwischen geändert“). Sie bildet Gesamtbetrag und Kleinunternehmer-Kennzeichen selbst und meldet die nicht mehr verwendete PDF-Datei zurück (ersetzt oder entfernt). Doppelte Nummern meldet sie mit Datum der vorhandenen Rechnung.
- **Rechnung löschen** (geschützte Funktion): entfernt Rechnung und Positionen und meldet das PDF zurück. Der Server löscht die gemeldeten Dateien sofort.
- Nach dem Anlegen leitet die Server-Aktion selbst auf die neue Rechnung weiter (bewährtes Muster gegen verworfene Navigation in Next 16).

### E) PDF hochladen und abrufen
1. Der Browser prüft Dateityp und Größe (PDF, ≤ 10 MB) und lädt die Datei **direkt in den privaten Speicher**, nicht über den App-Server (Vercel begrenzt Server-Anfragen auf 4,5 MB). Der Speicher prüft Typ und Größe ein zweites Mal.
2. Das Formular merkt sich den Speicherort; erst **Speichern** hängt die Datei an die Rechnung.
3. **Abruf:** Der Server erzeugt beim Öffnen des Rechnungsdetails kurzlebige Links (10 Minuten) zum Öffnen und Herunterladen – nur wenn die Datei an einer Rechnung des eigenen Kunden hängt.
4. **Bereinigung:** Die bestehende tägliche Bereinigung wird auf den neuen Speicherbereich erweitert: Dateien älter als 24 Stunden, die an keiner Rechnung hängen, werden gelöscht (Upload ohne Speichern, abgebrochene Löschungen).

### F) Buchungsauswahl und Übernahme der Positionen
- Neue **Suchfunktion für Buchungen** (nur Inhaber): sucht in Gastname, Wohnung und Zeitraum, liefert höchstens 20 Treffer, neueste zuerst, ohne Sperren, mit stornierten.
- Bei Wahl einer Buchung lädt das Formular deren Positionen (Inhaber dürfen Buchungspreise lesen): bei aktiven Buchungen abgerechnete Übernachtung (anteilig nach PROJ-30) und Zusatzkosten in der Reihenfolge aus PROJ-34; bei stornierten nur die Stornogebühr. Je Position werden Bezeichnung, Betrag und Satz kopiert.
- Summe und USt je Satz rechnet das Formular mit der vorhandenen Regel `vatBreakdown`; die Datenbank rechnet den Gesamtbetrag beim Speichern unabhängig nach.

### G) Anpassungen an bestehenden Funktionen
- **Gast löschen:** Hat ein Gast Rechnungen (auch ohne Buchungen), wird er anonymisiert statt gelöscht.
- **Gast anonymisieren:** keine Änderung an Rechnungen; die Verknüpfung bleibt, der Gast heißt „Gelöschter Gast“.
- **Gäste zusammenführen:** hängt die Rechnungen des aufgelösten Gastes an den verbleibenden.
- **Kunde löschen (Betreiber):** Rechnungen und Positionen gehen mit; der Server entfernt zusätzlich den PDF-Ordner des Kunden.
- **Kundenstammdaten speichern:** nimmt den neuen Schalter mit (Inhaber und Betreiber, bestehender Konfliktschutz).
- **Navigation:** neuer Eintrag „Rechnungen“ (bereit, für beide Rollen, Handy „Mehr“).

### H) Tests
- **Unit:** Vergleichsschlüssel der Nummer, Übernahme der Positionen aus einer Buchung (aktiv, anteilig, storniert), Summen und USt je Satz, Empfänger-Vorbelegung (Firma/Gast, von Hand geändert bleibt), Datei-Prüfung (Typ, Größe).
- **Datenbank (gegen „apppa-dev“):** doppelte Nummer je Kunde (Groß-/Kleinschreibung, Leerzeichen) abgelehnt, bei anderem Kunden erlaubt; Datum in der Zukunft, leere Positionsliste, Sperre als Buchung, fremde Buchung/fremder Gast abgelehnt; Gesamtbetrag aus Positionen; Kleinunternehmer-Kennzeichen nach Rechnungsdatum; Schalter aus → Anlegen abgelehnt, Ändern erlaubt; Mitarbeiter darf nichts schreiben; Kunde B sieht keine Rechnungen/PDFs von Kunde A; Konfliktschutz; Gast mit Rechnungen wird anonymisiert statt gelöscht; Zusammenführen zieht Rechnungen mit; Bereinigung löscht nur unverwendete Dateien.
- **E2E:** Nacherfassen mit und ohne Buchung inkl. PDF; Bearbeiten, PDF ersetzen, Löschen; Suche und Blättern; Abschnitt im Buchungsdetail (auch Kalender-Panel, auch als Mitarbeiter); Schalter; Handy-Breite; Safari-Zeilenklick; axe.
- **Regression:** PROJ-7 (Löschen/Zusammenführen), PROJ-8/30/35 (Buchungsdetail), PROJ-28 (Stammdaten), PROJ-29 (Bereinigung).

### I) Was sich an Sicherheit und Datenbank ändert (Freigabe nötig)
- Zwei neue Tabellen (Rechnung, Rechnungsposition) mit Mandanten-Zugriffsregeln und Protokoll
- Neues Feld am Kunden („Rechnungen nacherfassen“)
- Neuer privater Speicherbereich „Rechnungen“ mit Zugriffsregeln
- Neue geschützte Funktionen: Rechnung speichern, Rechnung löschen, Buchungssuche, Rechnungen einer Buchung (mit Gesamtpreis, auch für Mitarbeiter)
- Geänderte Funktionen: Gast löschen, Gäste zusammenführen, Kunde löschen, Kundenstammdaten speichern; tägliche Bereinigung

### Abhängigkeiten (Pakete)
Keine neuen Pakete. Genutzt werden vorhandene shadcn-Bausteine (`Popover`, `Command`, `Switch`, `Table`, `Pagination`, `Sheet`, `AlertDialog`), das Sortieren aus PROJ-34 und Supabase Storage.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
