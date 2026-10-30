# PROJ-37: Rechnungen nacherfassen

## Status: Planned
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
- [ ] Angenommen eine Buchung mit zwei verknüpften Rechnungen, wenn ein Inhaber oder Mitarbeiter das Buchungsdetail öffnet, dann steht unter dem Preis der Abschnitt „Rechnungen“ mit beiden Rechnungen (Link), „Verrechnet: € …“ und dem Gesamtpreis
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
- [ ] Kleinunternehmer-Status einer Rechnung: Rechnungsdatum (so festgelegt) oder bei verknüpfter Buchung deren Regel aus PROJ-36 (Abreise bzw. Stornodatum)? Wird spätestens in PROJ-38 einheitlich entschieden

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

### Technical Decisions
<!-- Added by /architecture -->
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
