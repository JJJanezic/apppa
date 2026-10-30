# PROJ-37: Rechnungen nacherfassen

## Status: Architected
**Created:** 2026-10-30
**Last Updated:** 2026-10-30

> Grundumfang am 2026-10-30 in Production ausgeliefert (Commit 49a8b9b). Erweiterung „Rechnungen in der Buchungsübersicht“ am 2026-10-30 per `/refine` ergänzt, noch nicht gebaut.

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

**Buchungsübersicht** (`/buchungen`, Erweiterung 2026-10-30):
- Neue Spalte „Rechnungen“ hinter „Status“: je verknüpfter Rechnung die Nummer als Link zur Rechnungsdetailseite, mehrere untereinander nach Rechnungsdatum; ohne Rechnung (und bei Sperren immer) leer. Für Inhaber und Mitarbeiter.
- Am Handy (Karten, die ganze Karte ist der Link zur Buchung): Zeile „Rechnungen: 2026-0011, 2026-0012“ als Text; ohne Rechnung entfällt die Zeile.
- Neues Filterfeld „Rechnung“: „Alle“ (Standard), „ohne Rechnung“, „mit Rechnung“. Als „Rechnung vorhanden“ zählt jede mit der Buchung verknüpfte Rechnung, unabhängig vom Betrag (eine Anzahlungsrechnung genügt).
- „ohne Rechnung“ und „mit Rechnung“ wirken **über alle Buchungen**, nicht nur im gewählten Monat (auch künftige, ohne Stichtag): Die Monatsauswahl wird durch den Hinweis „Alle Monate“ ersetzt, sortiert nach Anreise absteigend, seitenweise je 50, mit Gesamtzahl (z. B. „23 Buchungen ohne Rechnung“). „Alle“ führt zurück in den gewählten Monat.
- Sperren sind bei „ohne Rechnung“ und „mit Rechnung“ ausgeschlossen. Die übrigen Filter (Wohnung, Art, Zustand, Quelle, Suche) wirken mit; Standard-Zustand bleibt „aktiv“, stornierte Buchungen nur mit „storniert“.
- Die Wahl steht in der Adresszeile (`?rechnung=ohne` bzw. `mit`); „Filter zurücksetzen“ setzt sie mit zurück.

**Wer darf was:**

| Aktion | Inhaber | Mitarbeiter | Betreiber |
|---|---|---|---|
| Rechnungsliste, Rechnungsdetail, Abschnitt im Buchungsdetail sehen | ✓ | ✓ | – |
| Spalte „Rechnungen“ und Filter „Rechnung“ in der Buchungsübersicht | ✓ | ✓ | – |
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
- Als **Inhaber** möchte ich in der Buchungsübersicht die Rechnungen jeder Buchung sehen und anklicken, damit ich ohne Umweg zur Rechnung komme.
- Als **Inhaber** möchte ich alle Buchungen ohne Rechnung auf einen Blick finden, damit ich nichts zu verrechnen vergesse.

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

### Buchungsübersicht (Erweiterung 2026-10-30)
- [ ] Angenommen eine Buchung mit zwei Rechnungen, wenn ein Inhaber oder Mitarbeiter die Buchungsübersicht am Desktop öffnet, dann stehen in der Spalte „Rechnungen“ beide Nummern untereinander (nach Rechnungsdatum), jede als Link zur Rechnungsdetailseite
- [ ] Angenommen eine Buchung ohne Rechnung bzw. eine Sperre, wenn die Übersicht angezeigt wird, dann bleibt die Zelle „Rechnungen“ leer
- [ ] Angenommen ein Nutzer am Handy, wenn eine Buchung Rechnungen hat, dann zeigt ihre Karte „Rechnungen: …“ mit den Nummern als Text; ohne Rechnung fehlt die Zeile
- [ ] Angenommen der Filter „Rechnung“, wenn der Nutzer ihn öffnet, dann gibt es „Alle“ (Standard), „ohne Rechnung“ und „mit Rechnung“
- [ ] Angenommen Buchungen mit und ohne Rechnung in verschiedenen Monaten (auch künftige), wenn der Nutzer „ohne Rechnung“ wählt, dann zeigt die Liste alle Buchungen und Optionen ohne verknüpfte Rechnung über alle Monate, ohne Sperren, mit dem Hinweis „Alle Monate“ und der Gesamtzahl
- [ ] Angenommen eine Buchung mit nur einer Anzahlungsrechnung unter dem Gesamtpreis, wenn „ohne Rechnung“ gewählt ist, dann erscheint sie nicht (bei „mit Rechnung“ schon)
- [ ] Angenommen „mit Rechnung“, wenn die Liste angezeigt wird, dann stehen darin nur Buchungen mit mindestens einer verknüpften Rechnung, über alle Monate
- [ ] Angenommen der Filter „ohne Rechnung“, wenn die Liste angezeigt wird, dann ist sie nach Anreise absteigend sortiert; bei mehr als 50 Treffern wird seitenweise je 50 geblättert
- [ ] Angenommen „ohne Rechnung“ zusammen mit Wohnung, Art, Quelle oder Suche, wenn die Liste angezeigt wird, dann wirken alle Filter zusammen; stornierte Buchungen erscheinen nur mit Zustand „storniert“
- [ ] Angenommen „ohne Rechnung“ ist gewählt, wenn der Nutzer die Seite neu lädt oder aus einer Buchung zurückkommt, dann ist der Filter noch gesetzt (Adresszeile)
- [ ] Angenommen „ohne Rechnung“ ist gewählt, wenn der Nutzer „Alle“ wählt oder „Filter zurücksetzen“, dann zeigt die Liste wieder den gewählten Monat mit Monatsauswahl
- [ ] Angenommen eine Rechnung wird einer Buchung zugeordnet oder von ihr gelöst, wenn der Nutzer danach die Übersicht öffnet, dann stimmen Spalte und Filter

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
- **Buchungsübersicht, sehr viele Buchungen ohne Rechnung** (z. B. Altbuchungen vor der App): Liste bleibt vollständig, seitenweise je 50 mit Gesamtzahl
- **Buchungsübersicht, Gutschrift mit negativer Summe an einer Buchung**: zählt als Rechnung; die Buchung erscheint unter „mit Rechnung“, nicht unter „ohne Rechnung“
- **Buchungsübersicht, viele Rechnungen an einer Buchung**: alle Nummern untereinander, lange Nummern umbrechen; kein seitliches Scrollen

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
| Buchungsübersicht: Spalte „Rechnungen“ mit Nummern als Links und Filter „Rechnung“ (Alle / ohne / mit); als Refinement von PROJ-37, nicht als eigenes Feature | Nutzerwunsch nach dem Release: Rechnungen direkt aus der Liste erreichen und Unverrechnetes finden; gehört fachlich zu den Rechnungen je Buchung | 2026-10-30 |
| „Rechnung vorhanden“ = mindestens eine verknüpfte Rechnung, unabhängig vom Betrag | Einfach und eindeutig; Teilverrechnung zeigt weiterhin das Buchungsdetail („Verrechnet“ / „Gesamtpreis“) | 2026-10-30 |
| Filter „ohne/mit Rechnung“ wirkt über alle Buchungen (alle Monate, auch künftige), Sperren ausgeschlossen, übrige Filter wirken mit | Nutzerentscheidung: auf einen Blick alles Unverrechnete; Sperren bekommen nie eine Rechnung | 2026-10-30 |
| Bei aktivem Rechnungsfilter Anreise absteigend, je 50 pro Seite, Gesamtzahl, Hinweis „Alle Monate“ statt Monatsauswahl | Wie die Suche; lange Listen bleiben vollständig und übersichtlich | 2026-10-30 |
| Rechnungsnummern am Handy als Text in der Karte | Die Karte ist schon der Link zur Buchung (kein Link im Link); gleiche Lösung wie in der Rechnungsliste (BUG-3 akzeptiert) | 2026-10-30 |
| Spalte und Filter für Inhaber und Mitarbeiter | Mitarbeiter dürfen Rechnungen sehen (Rollen-Tabelle) | 2026-10-30 |
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
| Buchungsübersicht: Rechnungen in derselben Abfrage wie die Buchungen mitlesen, keine neue Datenbank-Funktion, keine Migration | Bestehende Lese- und Mandantenregeln gelten; vorhandener Index reicht; kein zusätzlicher Code in der Datenbank | 2026-10-30 |
| Rechnungsfilter als eigener Modus der Liste (alle Monate, je 50, Gesamtzahl), Monatsauswahl wird wie bei der Suche ersetzt | Bekanntes Bedienmuster; die Monatsliste mit bis zu 1.000 Zeilen wäre über alle Jahre zu groß | 2026-10-30 |
| Filterwerte `rechnung=ohne/mit` und `seite` in der Adresszeile, Monat bleibt erhalten | Zurück-Knopf und Neuladen behalten den Stand; „Alle“ führt in den vorherigen Monat zurück | 2026-10-30 |
| Rechnung speichern/löschen lädt zusätzlich die Buchungsübersicht neu | Spalte und Filter zeigen sofort den neuen Stand | 2026-10-30 |

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

### Erweiterung: Rechnungen in der Buchungsübersicht (Tech Design 2026-10-30)

**Ausgangslage:** Die Buchungsübersicht (`/buchungen`) lädt die Buchungen eines Monats direkt aus der Datenbank (bis 1.000) bzw. bei einer Suche bis zu 50 Treffer über alle Monate; im Suchmodus ersetzt ein Hinweis die Monatsauswahl. Rechnungen hängen über die Buchung (gleicher Kunde) an der Buchung; Mitglieder dürfen sie lesen (RLS aus dem Grundumfang).

**A) Seiten und Bausteine**
```
Buchungsübersicht (/buchungen)
+-- Filterleiste (vorhanden)
|   +-- Monatsauswahl – entfällt bei aktivem Rechnungsfilter oder Suche → Hinweis „Alle Monate“
|   +-- Suche, Wohnung, Art, Zustand, Quelle (vorhanden)
|   +-- NEU Auswahl „Rechnung“: Alle · ohne Rechnung · mit Rechnung
|   +-- „Filter zurücksetzen“ (setzt „Rechnung“ und Seite mit zurück)
+-- Anzahl: „23 Buchungen ohne Rechnung“ / „… mit Rechnung“ (Gesamtzahl über alle Seiten)
+-- Tabelle (Desktop/Tablet)
|   +-- NEU Spalte „Rechnungen“ hinter „Status“: Nummern als Links zur Rechnung, untereinander nach Rechnungsdatum; leer ohne Rechnung und bei Sperren
+-- Karten (Handy)
|   +-- NEU Zeile „Rechnungen: 2026-0011, 2026-0012“ als Text (die Karte bleibt der Link zur Buchung)
+-- NEU Blättern je 50 (nur bei aktivem Rechnungsfilter; vorhandener Baustein „Pagination“ wie in der Rechnungsliste)
```

**B) Daten**
- **Keine neue Tabelle, keine Migration.** Die Liste liest zu jeder Buchung ihre Rechnungen (Nummer, Datum, Kennung) in derselben Abfrage mit. Die Mandanten- und Rollenregeln der Rechnungen gelten dabei unverändert.
- **Rechnungsfilter:** „ohne Rechnung“ = Buchungen und Optionen, an denen keine Rechnung hängt; „mit Rechnung“ = mindestens eine. Beide ohne Monatsgrenze, ohne Sperren, kombiniert mit Wohnung, Art, Zustand, Quelle und Suche. Sortiert nach Anreise absteigend (bei gleichem Tag Buchungsnummer), je 50, mit Gesamtzahl aus der Datenbank.
- Für die Abfrage „Rechnungen einer Buchung“ gibt es schon einen passenden Index aus dem Grundumfang; auch mit vielen Buchungen bleibt die Liste schnell.

**C) Adresse**
- `?rechnung=ohne` bzw. `?rechnung=mit`, dazu `&seite=2` usw.; ohne Angabe „Alle“. Ungültige Werte gelten als „Alle“ bzw. Seite 1.
- Monat (`monat`) bleibt in der Adresse erhalten, damit „Alle“ wieder in den zuvor gewählten Monat führt.
- Ändert sich ein Filter, beginnt die Liste wieder bei Seite 1.

**D) Anpassungen an bestehenden Teilen**
- **Rechnung speichern/löschen:** Die Buchungsübersicht wird zusätzlich neu geladen, damit Spalte und Filter sofort stimmen (bisher nur Rechnungsliste, Buchungsdetail und Kalender).
- **Suche ohne Rechnungsfilter** bleibt wie heute (bis 50 Treffer, Hinweis bei mehr). Mit Rechnungsfilter gilt das Blättern je 50.
- **Überschneidungs-Hinweis** der Liste: wird wie bisher für die angezeigten Zeilen ermittelt; bei Rechnungsfilter können die Zeilen über mehrere Jahre reichen, die Abfrage bleibt auf die Wohnungen der Seite begrenzt.

**E) Rechte**
- Spalte und Filter für Inhaber und Mitarbeiter (Rechnungen sind für beide lesbar). Betreiber ohne Mitgliedschaft sehen die Buchungsübersicht wie bisher nicht.
- Keine neuen Schreibrechte.

**F) Tests**
- **Unit:** Lesen und Schreiben der Adresse (`rechnung`, `seite`, Zurücksetzen, Seite 1 nach Filterwechsel).
- **E2E:** Spalte mit Links (mehrere, Reihenfolge), leer ohne Rechnung und bei Sperre, Handy-Zeile; „ohne/mit Rechnung“ über mehrere Monate inkl. künftiger, ohne Sperren, Anzahlungsrechnung zählt, Kombination mit Zustand „storniert“ und Suche, Blättern ab 51, Gesamtzahl, Zurück zur Monatsansicht; Mitarbeiter; Rechnung zuordnen/lösen wirkt sofort; Layout/axe auf drei Breiten; Safari-Zeilenklick bleibt.
- **Regression:** PROJ-8/PROJ-30 Buchungsliste (Monatsauswahl, Filter, Suche).

**Abhängigkeiten (Pakete):** keine neuen.

**Umfang:** reine Frontend-/Abfrage-Änderung; `/backend` ist voraussichtlich nicht nötig.

### Umsetzung Frontend (2026-10-30)
- **Regeln** `src/lib/invoices.ts`: Typen (Rechnung, Zeile, Liste, Buchungsabschnitt), Grenzen (`INVOICE_LIMITS`: Nummer 30, Empfänger 200, 50 Positionen, PDF 10 MB), `invoiceNumberKey`, `recipientFor` (Firma, sonst „Nachname Vorname“), `linesFromBooking` (aktiv: abgerechnete Übernachtung + Zusatzkosten in Reihenfolge; storniert: nur Stornogebühr), `invoiceVatShares`, `isOldInvoiceDate` (> 7 Jahre), `checkPdfFile`, Adresse der Liste (`?q=…&seite=…`). Unit-Tests `invoices.test.ts`.
- **Prüfregeln** `src/lib/validation/invoices.ts` (Browser und Server): Pflicht Nummer/Datum/Empfänger/≥ 1 Position, Datum ≤ heute, Positionen wie Zusatzkosten (negativ erlaubt, Satz 0–100), Upload muss fertig sein. Tests `invoices.test.ts`.
- **Seiten:** `/rechnungen` (Liste, Suchfeld, Blättern je 50, Leerzustände; Knopf nur Inhaber + Schalter ein) und `/rechnungen/[id]` (Angaben, Gast/Buchung als Link, Positionen mit Satz, Gesamtbetrag, USt je Satz bzw. „Keine Umsatzsteuer (Kleinunternehmer)“ nach dem an der Rechnung gespeicherten Kennzeichen, PDF öffnen/herunterladen; Inhaber: Bearbeiten, Löschen mit Bestätigung).
- **Bausteine** `src/components/invoices/`: `invoice-list` (Tabelle, nur die Nummer ist der Link – Safari; Handy-Karten), `invoice-search`, `invoice-status` („nacherfasst“, „ohne PDF“), `invoice-panel` (Formular), `booking-picker`, `invoice-pdf-field`, `invoice-buttons` (Nacherfassen, Bearbeiten, Löschen), `booking-invoices` (Abschnitt im Buchungsdetail).
- **Formular:** Buchungssuche ab 2 Zeichen (übernimmt Hauptgast, Empfänger solange nicht von Hand geändert, Positionen; sind schon Positionen eingetragen → Rückfrage „Positionen ersetzen?“). Gast: bestehend (Suche) oder neu (Gast-Felder + Dublettenprüfung wie im Buchungsformular); Empfänger läuft beim neuen Gast mit. Positionen sortierbar (Baustein aus PROJ-34), Bezeichnungsauswahl und Satz (PROJ-35); Satz-Felder und USt-Aufstellung entfallen, wenn am Rechnungsdatum (sonst heute) Kleinunternehmer gilt. Doppelte Nummer → Fehler am Feld „… (Rechnung vom …)“. Nach dem Anlegen leitet die Aktion selbst zur Detailseite (redirect).
- **Abweichung vom Tech Design:** Buchungsauswahl als eingebettete Suche wie die Gastsuche (Command ohne Popover), damit beide Felder gleich bedient werden.
- **PDF:** Prüfung im Browser (PDF, ≤ 10 MB), Upload direkt in den Speicherbereich `invoices` über `prepareInvoiceUpload` (Pfad `<Kunde>/<zufällig>.pdf`); erst „Speichern“ hängt die Datei an. Abruf-Links 10 Minuten (`getInvoice`).
- **Server-Aktionen** `src/app/(app)/rechnungen/actions.ts` (nur Inhaber): `saveInvoice`, `deleteInvoice`, `prepareInvoiceUpload`, `searchInvoiceBookings`, `loadInvoiceBooking`. Löschen gemeldeter PDFs über `src/lib/invoice-files.ts`.
- **Lesen** `src/lib/invoices-data.ts`: `getInvoicePage`, `hasAnyInvoice`, `getInvoice`, `getInvoiceBackfillEnabled`, `getBookingInvoices`.
- **Buchungsdetail** (Seite und Kalender-Panel): Abschnitt „Rechnungen“ unter dem Preis für alle Mitglieder, nur wenn Rechnungen verknüpft sind; „Verrechnet“, „Gesamtpreis“, Hinweis „Verrechnet mehr als Gesamtpreis“.
- **Navigation:** Eintrag „Rechnungen“ (`invoices`, Symbol Receipt) nach „Gäste“, beide Rollen, Handy unter „Mehr“; Tests in `navigation.test.ts` angepasst.
- **Schalter** „Rechnungen nacherfassen“ im Stammdaten-Formular (Inhaber und Betreiber), Abschnitt „Rechnungen“; Feld `invoiceBackfill` in Schema, Laden (`MASTER_DATA_COLUMNS`) und Speichern (`invoice_backfill_enabled` in `p_data`).
- **Gast löschen:** `guestStays` zählt Rechnungen (`stays.invoices`); mit Rechnungen wird anonymisiert, eigener Erklärungstext (`guests.delete.textAnonymizeInvoices`).
- **Texte** `messages/de.json`: `nav.invoices`, Namespace `invoices`, `tenantData.fields.invoiceBackfill*`, `tenantData.sections.invoices`.
- **Typen** `src/types/database.ts` von Hand ergänzt (Tabellen `invoices`, `invoice_lines`, Feld `tenants.invoice_backfill_enabled`, Funktionen); `/backend` erzeugt sie neu.
- **Offen für /backend** (Schnittstelle, die das Frontend erwartet):
  - Tabellen `invoices` (tenant_id, number, number_key eindeutig je Kunde, invoice_date, origin 'backfilled', booking_id, guest_id, recipient, small_business, total_cents, pdf_path, Standardfelder) und `invoice_lines` (invoice_id, tenant_id, position, label, amount_cents, vat_rate); RLS Lesen für Mitglieder, kein direktes Schreiben; Änderungsprotokoll.
  - `tenants.invoice_backfill_enabled` (Standard true) und `update_tenant_master_data` mit Schlüssel `invoice_backfill_enabled`.
  - `save_invoice(p_input jsonb) → jsonb {id, unused_pdf, previous_booking_id}`; Eingabe: id, updated_at, tenant_id, number, invoice_date, booking_id, guest_id, new_guest, recipient, lines[{label, amount_cents, vat_rate}], pdf_path. Fehlercodes: P0901 nur Inhaber, P0902 nicht gefunden, P0903 inzwischen geändert, P0904 Nummer vergeben (Datum der vorhandenen Rechnung als `detail` „JJJJ-MM-TT“), P0905 Schalter aus, P0906 Datum in der Zukunft, P0907 PDF fehlt/vergeben, P0908 Buchung ungültig, P0909 Gast ungültig, P0016 Kunde deaktiviert, P0705/P0804 wie Buchungen.
  - `delete_invoice(p_invoice_id) → text` (PDF-Pfad oder null).
  - `search_invoice_bookings(p_tenant_id, p_query, p_limit)` → id, kind, number, guest_last_name, guest_first_name, apartment_name, property_name, arrival, departure, cancelled.
  - `booking_invoices(p_booking_id) → jsonb {booking_total_cents, invoices[{id, number, invoice_date, recipient, total_cents, origin, has_pdf}]}` für alle Mitglieder.
  - Speicherbereich `invoices` (privat, nur PDF, 10 MB, Upload nur Inhaber in den eigenen Ordner), Bereinigung `unused_invoice_pdfs` im Cron, PDF-Ordner beim Löschen des Kunden, Gast löschen/zusammenführen.
  - **Ohne Migration schlagen *Einstellungen → Kunde* und die Betreiber-Detailseite beim Laden fehl** (Spalte `invoice_backfill_enabled` fehlt); Rechnungsliste zeigt den Leerzustand, Speichern meldet einen Fehler.

### Umsetzung Backend (2026-10-30)
- **Migration** `supabase/migrations/20261030071155_invoices.sql`, eingespielt in Dev:
  - `tenants.invoice_backfill_enabled` (Standard true, bestehende Kunden ein).
  - Tabellen `invoices` (Nummer ≤ 30 Zeichen, `number_key` = Kleinschreibung, eindeutig je Kunde; Datum ≥ 1990; `origin` 'backfilled'; Empfänger ≤ 200; `small_business`; `total_cents` bigint; `pdf_path` eindeutig) und `invoice_lines` (Position 1–50, Bezeichnung 1–100, Betrag ±1.000.000,00 €, Satz 0–100). Buchung bzw. Gast über (id, tenant_id) desselben Kunden, beim Entfernen `set null` nur der Verknüpfung; Löschen des Kunden löscht alles mit. Indizes für Liste, Buchung, Gast.
  - RLS: Lesen Mitglieder und Admin; kein direktes Schreiben (nur `select` gewährt). Änderungsprotokoll über `private.enable_tenant_table`.
  - Speicherbereich `invoices` (privat, `application/pdf`, 10 MB). Hochladen nur Inhaber in den Ordner des eigenen Kunden; lesen Mitglieder/Admin nur PDFs, die an einer Rechnung des Kunden hängen; kein Ändern/Löschen durch Nutzer.
  - `save_invoice`: Inhaber-Prüfung, Schalter nur beim Anlegen, Konfliktschutz, Prüfregeln, Nummer mit Datum der vorhandenen Rechnung (`detail`), Buchung ohne Sperren, Gast desselben Kunden bzw. neuer Gast (wie `save_booking`), PDF muss im eigenen Ordner liegen und unbenutzt sein, Kleinunternehmer nach Rechnungsdatum, Gesamtbetrag aus den Positionen, Positionen vollständig ersetzt; gleichzeitige Doppelungen über die Eindeutigkeit abgefangen. Ergebnis `{id, unused_pdf, previous_booking_id}`.
  - `delete_invoice` (Inhaber; meldet das PDF), `search_invoice_bookings` (Inhaber; Wörter in Gast/Firma, Wohnung, Objekt, Buchungsnummer; „14.10.2026“ = Buchungen über diesen Tag, „10.2026“ = Monat; höchstens 20, neueste zuerst), `booking_invoices` (alle Mitglieder; Gesamtpreis aktiv = abgerechnete Übernachtung + Zusatzkosten, storniert = Stornogebühr), `unused_invoice_pdfs` (nur Server).
  - Geändert: `update_tenant_master_data` (Schlüssel `invoice_backfill_enabled`, Protokoll-Feld), `delete_guest` (auch bei Rechnungen anonymisieren), `merge_guests` (Rechnungen umhängen).
- **Server:** Tägliche Bereinigung (`/api/cron/ausweisbilder`) räumt zusätzlich unbenutzte PDFs älter als 24 Stunden weg (`removeUnusedInvoicePdfs`); Kunde löschen (Betreiber) entfernt den PDF-Ordner (`removeTenantInvoices`).
- **Typen** mit `npm run db:types` neu erzeugt (Verknüpfungen jetzt über id + tenant_id). Advisors: nur die zwei bekannten Auth-Hinweise.
- **Tests:**
  - neu `supabase/tests/invoices.integration.test.ts` (26): Speichern, Gesamtbetrag, negative Beträge, doppelte Nummer (Groß-/Kleinschreibung, Leerzeichen, Datum im Detail), andere Kunden, Datum/Positionen/Pflichtangaben, Kleinunternehmer nach Datum, neuer Gast, fremde Buchung/Gast/Sperre, Konfliktschutz, Schalter aus (Anlegen nein, Ändern/Löschen ja), Löschen mit PDF, Protokoll, PDF-Regeln (Typ, Größe, Ordner, Rolle, vorhanden/unbenutzt, Lesen nach Ersetzen), Bereinigung, Rechte Mitarbeiter/fremder Kunde, Buchungssuche (Gast, Wohnung, Tag, Monat, storniert, ungültiges Datum), Rechnungen je Buchung inkl. Gesamtpreis für Mitarbeiter, Anonymisieren, Zusammenführen, Schalter über Stammdaten, Abfragen wie die App (Liste mit Suche, Detail).
  - Cron-Test um die PDF-Bereinigung erweitert.
  - Regression: alle 548 Unit-/Integrationstests grün; E2E PROJ-28 (desktop) 19/19 grün.
- **Hinweis für /deploy:** Neuer Speicherbereich entsteht per Migration; kein neuer Umgebungs-Schlüssel.

## QA Test Results

**Tested:** 2026-10-30
**App URL:** http://localhost:3000 (gebauter Server, Supabase „apppa-dev“; Safari gegen `npm run dev`)
**Tester:** QA Engineer (AI)

### Automatisierte Tests
- `npm test`: 48 Dateien, **550/550 grün** (inkl. `supabase/tests/invoices.integration.test.ts` mit 26 Datenbank-Tests und Cron-Test der PDF-Bereinigung)
- `npm run lint`, `npm run build`: grün
- **Neu** `tests/PROJ-37-rechnungen-nacherfassen.spec.ts` (20 Tests): Desktop 20/20, Tablet und Handy (Navigation, Layout) grün, Firefox (Nacherfassen, 7 Tests) grün, Safari (Liste mit Zeilenklick, Nacherfassen mit PDF) grün
- Regression E2E: PROJ-7 (Löschen, Zusammenführen, Anonymisieren) 5/5, PROJ-8 (Gast-Detail, Layout Liste/Detail/Panel) 4/4, PROJ-35 (Formular und Detail) 8/8; PROJ-28 lief im Backend-Schritt (19/19), der Schalter ist zusätzlich in PROJ-37 abgedeckt

### Acceptance Criteria Status

#### Menüpunkt und Liste (10)
- [x] „Rechnungen“ zwischen „Gäste“ und „Einstellungen“ (Desktop); am Handy unter „Mehr“
- [x] Spalten Nummer, Datum „Mi, 28.10.2026“, Empfänger, Buchung (Link bzw. „–“), Betrag (negativ rot „-€ 50,00“), Status „nacherfasst“ – am Handy siehe BUG-3
- [x] Zusatz „ohne PDF“
- [x] Sortierung Datum absteigend, bei gleichem Datum Nummer absteigend
- [x] Seitenweise je 50 (51 Rechnungen → Seite 2 mit einer Zeile)
- [x] Suche nach Teil der Nummer („2024/“) und des Empfängers („gutschr“), Begriff in der Adresse
- [x] Leerzustand Inhaber mit Knopf, Mitarbeiter ohne Knopf
- [x] Klick öffnet genau diese Rechnung (Chrome, Firefox, Safari; Handy über die Karte)

#### Nacherfassen: Formular und Pflichtangaben (9)
- [x] Formular mit Nummer, Datum, Buchung, Gast, Empfänger, Positionen, PDF
- [x] Leeres Formular: Meldungen bei Nummer, Datum, Empfänger, Positionen; nichts gespeichert
- [x] Datum in der Zukunft → „Das Rechnungsdatum darf nicht in der Zukunft liegen“
- [x] Datum älter als 7 Jahre → Hinweis, Speichern möglich (vor 1990 siehe BUG-2)
- [x] Nummer > 30 Zeichen → Meldung
- [x] Doppelte Nummer „ 2025-0042 “ bzw. „R-1“ zu „r-1“ → „… bereits vergeben (Rechnung vom Fr, 14.03.2025)“
- [x] Gleiche Nummer bei anderem Kunden wird gespeichert
- [x] Gültig → Rechnung in der Liste, Weiterleitung auf die Detailseite
- [x] Server lehnt doppelte Nummer, Datum in der Zukunft, leere Positionen ab (Integrationstests)

#### Buchung, Gast und Empfänger (9)
- [x] Treffer „Huber Maria · Haus See · Top 3 · Mi, 14.10.2026 – Sa, 17.10.2026“ (Suche nach Gast, Wohnung, Monat „10.2026“)
- [x] Stornierte Buchung wird gefunden, Sperre nicht
- [x] Hauptgast der Buchung vorbelegt
- [x] Empfänger = Firma, sonst „Nachname Vorname“ (auch beim neuen Gast)
- [x] Überschriebener Empfänger wird gespeichert
- [x] Von Hand geänderter Empfänger bleibt beim Gastwechsel
- [x] Anderer Gast bei gewählter Buchung wird verknüpft
- [x] Ohne Buchung: bestehenden Gast suchen oder neu anlegen
- [x] Weder Buchung noch Gast: Speichern mit Empfänger und Positionen

#### Positionen und Beträge (9)
- [x] Übernachtung, Reinigung, Rabatt mit Betrag und Satz in der Reihenfolge der Buchung
- [x] Stornierte Buchung → Stornogebühr als Position
- [x] Abwählen, Betrag ändern, Position hinzufügen → Summe und USt je Satz sofort neu
- [x] Andere Buchung bei vorhandenen Positionen → Rückfrage „Positionen ersetzen?“ (Ersetzen/Behalten)
- [x] Ohne Buchung leere Positionsliste
- [x] Gesamtbetrag unter 0 wird gespeichert, rot mit „-€“
- [x] 10 % und 20 %: Gesamtbetrag brutto und enthaltene USt je Satz (€ 18,18 / € 8,33)
- [x] Kleinunternehmer am Rechnungsdatum: keine Satzfelder, im Detail „Keine Umsatzsteuer (Kleinunternehmer)“; Datum mit USt blendet die Felder wieder ein
- [x] Spätere Änderung der Buchung lässt die Positionen der Rechnung unverändert

#### PDF (7)
- [x] PDF bis 10 MB wird abgelegt (Pfad im Ordner des Kunden)
- [x] Kein PDF bzw. > 10 MB → verständliche Meldung, nichts abgelegt
- [x] PDF nachreichen → „ohne PDF“ entfällt
- [x] Ersetzen → altes PDF gelöscht, alter Link liefert nichts mehr
- [x] Öffnen und Herunterladen liefern das PDF (Inhaber und Mitarbeiter)
- [x] Ohne Anmeldung bzw. fremder Kunde: kein Abruf-Link, kein Download
- [x] Upload ohne Speichern: nicht an der Rechnung, Bereinigung nach 24 Stunden (Integrations- und Cron-Test)

#### Bearbeiten und Löschen (5)
- [x] Bearbeiten mit denselben Regeln
- [x] Buchung nachträglich setzen → im Buchungsdetail; entfernen → verschwindet dort
- [x] Löschen: Abbrechen behält alles, Bestätigen entfernt Rechnung und PDF
- [x] Gleichzeitige Bearbeitung → Hinweis „Die Rechnung wurde inzwischen geändert …“, nichts überschrieben
- [x] Protokoll mit Person: „insert“ und „delete“ mit Inhaber als Akteur

#### Schalter „Rechnungen nacherfassen“ (5)
- [x] Voreinstellung ein
- [x] Aus → kein Knopf, Rechnungen sichtbar und bearbeitbar
- [x] Aus → Anlegen am Server abgelehnt (Integrationstest P0905)
- [x] Wieder ein → Knopf da
- [x] Betreiber legt den Schalter auf der Kunden-Detailseite um

#### Buchungsdetail (4)
- [x] Zwei Rechnungen mit Link, „Verrechnet“, „Gesamtpreis“, auch für Mitarbeiter
- [x] Summe über Gesamtpreis → „Verrechnet mehr als Gesamtpreis“
- [x] Ohne Rechnungen kein Abschnitt
- [x] Kalender-Panel zeigt den Abschnitt ebenso

#### Rollen (3)
- [x] Mitarbeiter: alle Angaben, PDF öffnen, keine Knöpfe
- [x] Mitarbeiter-Schreibzugriffe am Server abgelehnt (Integrationstests; Server-Aktionen prüfen zusätzlich die Rolle)
- [x] Kunde B ruft Rechnung von Kunde A auf → „Seite nicht gefunden“

#### Gäste (3)
- [x] Anonymisierter Gast: Empfänger und Positionen unverändert, Gast „Gelöschter Gast“
- [x] Gast nur mit Rechnungen → anonymisiert statt gelöscht, eigener Erklärungstext
- [x] Zusammenführen hängt Rechnungen um (Integrationstest; PROJ-7-Regression grün)

### Edge Cases Status
- [x] Teilrechnung/Anzahlung: Summe unter dem Gesamtpreis, kein Hinweis
- [x] Mehrere Rechnungen je Buchung, Summe darüber → nur Hinweis
- [x] Alte Gutschrift mit negativen Positionen mindert die verrechnete Summe
- [x] Buchung seit der Altrechnung geändert → Rechnung behält ihre Kopie
- [x] Empfänger bleibt, wenn der Gast entfernt bzw. gewechselt wird
- [x] Nummer mit anderem Format („2024/17“) wird gespeichert und gefunden
- [x] Upload-Fehler: eigene Meldung, übrige Eingaben bleiben (Code geprüft)
- [x] Inhalt des PDFs wird nicht geprüft (Minimal-PDF wird abgelegt)
- [x] Kunde deaktiviert: Schreiben am Server gesperrt (`has_role` nur bei aktivem Kunden); Meldung lautet „Das darf nur ein Inhaber.“ statt des Deaktiviert-Texts – Mitglieder deaktivierter Kunden kommen laut PROJ-5 ohnehin nicht in die App
- [x] Kunde gelöscht: Rechnungen per Fremdschlüssel mitgelöscht, PDF-Ordner durch den Server (Code und Integrationstest)

### Security Audit Results
- [x] Authentifizierung: Seiten und Aktionen nur angemeldet; PDF-Download anonym liefert nichts
- [x] Mandantentrennung: Rechnungen, Positionen, PDFs nur für Mitglieder; Detailseite fremder Rechnung „nicht gefunden“; fremde Buchung/Gast/PDF-Pfad in `save_invoice` abgelehnt
- [x] Rollen: Schreiben nur über `save_invoice`/`delete_invoice` (kein direktes insert/update/delete), Inhaber-Prüfung in Datenbank und Server-Aktion
- [x] Speicher: privat, nur `application/pdf`, 10 MB; Upload nur in den eigenen Ordner, Lesen nur für an einer Rechnung hängende PDFs, Löschen nur der Server; Abruf-Links 10 Minuten
- [x] Eingaben: Suchbegriff für PostgREST bereinigt (Anführungszeichen, Komma, Klammern, Platzhalter); Texte werden von React escaped; Dateiname des Downloads bereinigt
- [x] Gesamtbetrag und Kleinunternehmer-Kennzeichen bildet die Datenbank, nicht der Browser
- [x] Keine Geheimnisse im Browser (Upload über serverseitig erzeugten, einmaligen Upload-Schlüssel)
- [ ] Hinweis (kein Bug): `prepareInvoiceUpload` ist nicht begrenzt; ein Inhaber kann beliebig viele unbenutzte PDFs hochladen, die erst nach 24 Stunden weggeräumt werden. Risiko gering (nur angemeldete Inhaber, 10 MB je Datei)

### Bugs Found

#### BUG-1: Leere Trefferliste der Buchungs- und Gastsuche verletzt WCAG (axe „aria-required-children“, critical)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Rechnung öffnen → „Bearbeiten“ (oder „Rechnung nacherfassen“)
  2. axe-Prüfung (WCAG 2.1 AA) über das Formular laufen lassen
  3. Expected: keine Verstöße
  4. Actual: Die `CommandList` von `booking-picker` und `guest-picker` hat `role="listbox"`, enthält ohne Suchbegriff aber nur den Hinweis „Mindestens 2 Zeichen eingeben …“ und keine `option`. Betrifft auch die Gastsuche im neuen Buchungsformular (PROJ-8), dort bisher ungetestet
- **Test:** `PROJ-37 … Layout` nimmt die Regel im Formular bis zur Behebung aus
- **Priority:** Fix before deployment (empfohlen) – Hinweise außerhalb der `CommandList` setzen oder die Liste erst mit Treffern rendern
- **Status:** ✅ Behoben 2026-10-30 – Hinweise stehen in `booking-picker` und `guest-picker` neben der Liste; die Liste enthält nur noch Treffer. Gilt damit auch für das Buchungsformular und das Zusammenführen

#### BUG-2: Rechnungsdatum vor 1990 führt zu „Etwas ist schiefgelaufen“
- **Severity:** Low
- **Steps to Reproduce:**
  1. „Rechnung nacherfassen“, Datum z. B. 15.05.1985, übrige Angaben gültig
  2. Speichern
  3. Expected: verständliche Meldung am Datumsfeld
  4. Actual: Das Formular zeigt nur den 7-Jahre-Hinweis; die Datenbank lehnt per Prüfregel (`invoice_date >= 1990-01-01`, Fehler 23514) ab, die Aktion meldet „Etwas ist schiefgelaufen. Bitte versuche es erneut.“
- **Priority:** Fix in next sprint (Untergrenze ins Schema und `min` am Datumsfeld)
- **Status:** Kein Fehler (Entscheidung des Nutzers 2026-10-30): So alte Rechnungen werden nicht nacherfasst

#### BUG-3: Handy-Karten der Rechnungsliste zeigen die Buchung nicht als Link
- **Severity:** Low
- **Steps to Reproduce:**
  1. Rechnungsliste unter 768 px Breite öffnen, Rechnung mit Buchung
  2. Expected (AC): Buchung als Link
  3. Actual: „Buchung 2026-0001“ als Text, weil die ganze Karte der Link zur Rechnung ist (bewusst: kein Link im Link). Die Buchung ist über die Detailseite erreichbar
- **Priority:** Nice to have (oder Spec an die Umsetzung anpassen)
- **Status:** Akzeptiert (Entscheidung des Nutzers 2026-10-30): Die Buchung bleibt am Handy Text in der Karte

#### BUG-4: Suche findet Nummern mit „_“ oder „%“ nicht
- **Severity:** Low
- **Steps to Reproduce:**
  1. Rechnung „2025_01“ erfassen
  2. In der Liste nach „2025_01“ suchen
  3. Expected: Treffer
  4. Actual: `cleanInvoiceQuery` ersetzt „_“ und „%“ durch Leerzeichen, gesucht wird „2025 01“ → „Keine Treffer“ (Suche nach „2025“ findet sie)
- **Priority:** Nice to have (Platzhalter escapen statt entfernen)
- **Status:** ✅ Behoben 2026-10-30 – neues `invoiceSearchPattern` maskiert „%“ und „_“ für die Liste (Komma und Klammern bleiben Teil des Suchbegriffs); die Buchungssuche nutzt weiter `cleanInvoiceQuery`

### Summary
- **Acceptance Criteria:** 64/64 erfüllt (eine Abweichung am Handy: BUG-3)
- **Bugs Found:** 4 total (0 critical, 0 high, 1 medium, 3 low)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy möglich; BUG-1 vorher beheben empfohlen

### Nachtest 2026-10-30 (nach Behebung von BUG-1 und BUG-4)
- `npm test`: 48 Dateien, **551/551 grün** (neuer Unit-Test für `invoiceSearchPattern`); Lint, Typprüfung, Build grün
- E2E `tests/PROJ-37-rechnungen-nacherfassen.spec.ts` (jetzt 21 Tests): Desktop 21/21, Tablet 4/4, Handy 4/4, Firefox 6/6 (Suche, Buchungs- und Gastsuche, neuer Gast, Layout)
  - Layout-Test prüft das Formular wieder ohne Ausnahme mit axe, zusätzlich mit Hinweis „Mindestens 2 Zeichen“ und mit „Keine passende Buchung gefunden“
  - neuer Test BUG-4: „2025_01“, „10%“, „Huber, Maria (“ finden genau die passenden Rechnungen
- Regression der geänderten Gastsuche: PROJ-8 Buchungsformular (7 Tests) und PROJ-7 Zusammenführen (3 Tests) grün
- Safari in diesem Durchgang nicht erneut gelaufen (Änderung nur an der Reihenfolge der Elemente; erster Durchgang grün)
- **Ergebnis:** 0 offene Bugs (BUG-1, BUG-4 behoben; BUG-2, BUG-3 vom Nutzer akzeptiert). **Production Ready: YES** → Status Approved

## Deployment
_To be added by /deploy_
