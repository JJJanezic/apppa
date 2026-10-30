# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

| ID | Feature | Beschreibung | Priority | Dependencies | Status | Spec | Created |
|----|---------|--------------|----------|--------------|--------|------|---------|
| PROJ-1 | Supabase Infrastructure Setup | Projekt-Anbindung, Env-Variablen, Schema-Grundriss, Mandanten-RLS-Muster, Auth-Konfiguration | P0 | None | Deployed | [Spec](PROJ-1-supabase-infrastructure-setup.md) | 2026-10-12 |
| PROJ-2 | App-Shell & Design-System | Responsives Layout, Navigation, Broadsheet-Tokens in shadcn/ui, i18n-Grundlage (Deutsch) | P0 | None | Deployed | [Spec](PROJ-2-app-shell-design-system.md) | 2026-10-12 |
| PROJ-3 | Authentifizierung | Login, Einladung annehmen, Passwort zurücksetzen, Logout | P0 | PROJ-1, PROJ-2 | Deployed | [Spec](PROJ-3-authentifizierung.md) | 2026-10-12 |
| PROJ-4 | Kundenkonten & Rollen | Mandant (Kunde), Rollen Inhaber/Mitarbeiter, Team-Mitglieder einladen | P0 | PROJ-1, PROJ-3 | Deployed | [Spec](PROJ-4-kundenkonten-rollen.md) | 2026-10-12 |
| PROJ-5 | Betreiber-Admin | Kunden anlegen, einladen, deaktivieren; Übersicht aller Mandanten | P0 | PROJ-1, PROJ-4 | Deployed | [Spec](PROJ-5-betreiber-admin.md) | 2026-10-12 |
| PROJ-6 | Wohnungsverwaltung | Objekte und Wohnungen: Stammdaten, Adresse, Gemeinde, Kapazität | P0 | PROJ-1, PROJ-4 | Deployed | [Spec](PROJ-6-wohnungsverwaltung.md) | 2026-10-12 |
| PROJ-7 | Gäste-Datenbank | Hauptgäste mit Kontakt, Herkunftsland, Firma, Marketing-Quelle; Dubletten zusammenführen; Löschen/Anonymisieren | P0 | PROJ-1, PROJ-4 | Deployed | [Spec](PROJ-7-gaeste-datenbank.md) | 2026-10-12 |
| PROJ-8 | Manuelle Buchungen | Direktbuchungen, Optionen und Sperren; Konflikt- und Kapazitätswarnung; Gast verknüpfen; Personen mit Alter, Mitreisende; Preis mit Zusatzkosten | P0 | PROJ-1, PROJ-6, PROJ-7 | Deployed | [Spec](PROJ-8-manuelle-buchungen.md) | 2026-10-12 |
| PROJ-9 | Belegungskalender | Zeitleiste und Monatsansicht der Belegung auf dem Dashboard und als Vollbild-Seite; Detailpanel, Anlegen per Klick, Objektfilter | P0 | PROJ-1, PROJ-6, PROJ-8 | Deployed | [Spec](PROJ-9-belegungskalender.md) | 2026-10-12 |
| PROJ-10 | Channex-Verbindung | Channex-Konto je Kunde, Wohnungen mit Listings verknüpfen, Verbindungsstatus | P0 | PROJ-1, PROJ-6 | Roadmap | – | 2026-10-12 |
| PROJ-11 | Buchungsimport aus Channex | Neue, geänderte und stornierte Buchungen von booking.com/Airbnb übernehmen, inkl. Gast | P0 | PROJ-1, PROJ-7, PROJ-8, PROJ-10 | Roadmap | – | 2026-10-12 |
| PROJ-12 | Verfügbarkeitssperre an Channex | Manuell erfasste Buchungen sperren die Wohnung auf booking.com/Airbnb | P0 | PROJ-1, PROJ-8, PROJ-10 | Roadmap | – | 2026-10-12 |
| PROJ-13 | Zahlungserfassung | Zahlungen je Buchung, Status offen/teilweise/bezahlt, Übernahme aus Channex | P0 | PROJ-1, PROJ-8 | Roadmap | – | 2026-10-12 |
| PROJ-14 | Dashboard | Heutige An-/Abreisen, kommende Buchungen, offene Zahlungen, Sync-Status | P0 | PROJ-1, PROJ-8, PROJ-13 | Roadmap | – | 2026-10-12 |
| PROJ-15 | Abgaberegeln je Gemeinde | Konfigurierbare Ortstaxe-Regeln (Prozent oder Betrag pro Person/Nacht, Befreiungen) + Vorlagen pro Bundesland | P0 | PROJ-1, PROJ-6 | Roadmap | – | 2026-10-12 |
| PROJ-16 | Tourismusabgabe-Berechnung | Abgabe je Buchung, Monatsbericht pro Gemeinde, Export | P0 | PROJ-1, PROJ-8, PROJ-15 | Roadmap | – | 2026-10-12 |
| PROJ-17 | Kalender-Abo-Link | Privater iCal-Feed für Outlook/M365 und Google Calendar, Link erneuerbar | P0 | PROJ-1, PROJ-8 | Roadmap | – | 2026-10-12 |
| PROJ-18 | Statistische Auswertungen | Auslastung, Umsatz, Gästeherkunft, Kanäle; Filter nach Wohnung und Zeitraum | P0 | PROJ-1, PROJ-7, PROJ-8, PROJ-13 | Roadmap | – | 2026-10-12 |
| PROJ-19 | Marketing: Einwilligung, Segmente & Export | DSGVO-Einwilligung erfassen, Gäste-Segmente, CSV-Export | P0 | PROJ-1, PROJ-7 | Roadmap | – | 2026-10-12 |
| PROJ-20 | Zwei-Wege-Kalendersync | OAuth-Synchronisation mit Microsoft 365 und Google Calendar | P2 | PROJ-17 | Roadmap | – | 2026-10-12 |
| PROJ-21 | Selbstregistrierung & Abo | Kunden registrieren sich selbst und zahlen ein Abo | P2 | PROJ-5 | Roadmap | – | 2026-10-12 |
| PROJ-22 | E-Mail-Versand an Gäste | Mailings und Newsletter direkt aus der App | P2 | PROJ-19 | Roadmap | – | 2026-10-12 |
| PROJ-23 | Englische Oberfläche | Übersetzung der App ins Englische | P2 | PROJ-2 | Roadmap | – | 2026-10-12 |
| PROJ-24 | Online-Zahlung Direktbuchungen | Zahlungslink für Gäste (z. B. Stripe) | P2 | PROJ-13 | Roadmap | – | 2026-10-12 |
| PROJ-25 | Bankabgleich | Kontoauszüge importieren, Zahlungen automatisch Buchungen zuordnen | P2 | PROJ-13 | Roadmap | – | 2026-10-12 |
| PROJ-26 | Gästeblatt (Meldewesen) | Gesetzliche Gästemeldung je Aufenthalt mit Hauptgast und Mitreisenden | P0 | PROJ-1, PROJ-6, PROJ-7, PROJ-8 | Roadmap | – | 2026-10-26 |
| PROJ-27 | Personenpreise und Kapazität nach Erwachsenen | Kapazität „gesamt, davon max. Erwachsene“; Preisart je Wohnung (Wohnungs- oder Personenpreis mit Kinder-Altersstufen); Preisvorschlag und Warnung in Buchungen | P0 | PROJ-6, PROJ-8 | Deployed | [Spec](PROJ-27-personenpreise-kapazitaet.md) | 2026-10-25 |
| PROJ-28 | Kundenstammdaten | Zweite Namenszeile, Adresse, Staat, UID, Steuernummer, Registernummer je Kunde; editierbar durch Betreiber und Inhaber | P0 | PROJ-4, PROJ-5 | Deployed | [Spec](PROJ-28-kundenstammdaten.md) | 2026-10-26 |
| PROJ-29 | Gast-Erweiterung: Titel, Geschlecht, Reisedokument | Akademische Grade vor/nach dem Namen, Geschlecht, ein Reisedokument mit Bildern (Vorder-/Rückseite); Safari-Zeilenklick in der Gästeliste | P0 | PROJ-4, PROJ-7, PROJ-8 | Deployed | [Spec](PROJ-29-gast-titel-geschlecht-reisedokument.md) | 2026-10-26 |
| PROJ-30 | Buchungs-Erweiterung: Meldedaten, Buchungsquelle, Monatsauswahl | Gästeblattnummer, Abreise geplant/tatsächlich (Preis bei Verlängerung wählbar: gesamter Aufenthalt oder anteilig; Belegung nach tatsächlicher Abreise), Wohnsitz angemeldet, Buchungsquelle inkl. booking.com mit Kalenderfarbe und Filter, Sprungauswahl in der Buchungsübersicht, Mitreisende Nachname vor Vorname | P0 | PROJ-8, PROJ-9, PROJ-27 | Architected | [Spec](PROJ-30-buchungs-erweiterung.md) | 2026-10-26 |
| PROJ-31 | Einheitliche Datums- und Betragsformate | Datum überall „Mi, 28.10.2026“ (Ausnahmen: Geburts-/Ausstellungsdatum, enge Kalenderstellen, Monatsüberschriften, Dashboard-Gruß), Zeitraum in der Buchungsliste zweizeilig, Beträge mit zwei Nachkommastellen auch in Eingabefeldern | P0 | PROJ-2, PROJ-8, PROJ-9 | Deployed | [Spec](PROJ-31-datums-und-betragsformate.md) | 2026-10-28 |
| PROJ-32 | Negative Beträge bei Zusatzkosten | Zusatzkosten-Positionen auch negativ (Rabatt, Gutschrift), Endbetrag darf unter 0 fallen, Anzeige „-€ 50,00“ in Rot; Vorschläge „Rabatt“ und „Nächtigungsabgabe“ | P0 | PROJ-8, PROJ-30, PROJ-31 | Deployed | [Spec](PROJ-32-negative-zusatzkosten.md) | 2026-10-28 |
| PROJ-33 | Firmenanschrift des Gastes aufteilen | Rechnungsadresse der Firma statt einem Textfeld in Adresszeile 1/2, PLZ, Ort, Staat; Firmenname und UID unverändert; Altdaten in Adresszeile 1 | P0 | PROJ-7, PROJ-29 | Deployed | [Spec](PROJ-33-firmenanschrift-aufteilen.md) | 2026-10-29 |
| PROJ-34 | Preispositionen ordnen | Zusatzkosten einer Buchung im Buchungsformular per Griff ordnen (Maus, Touch, Tastatur); Übernachtung bleibt oben; Reihenfolge im Detail und für die Rechnung | P0 | PROJ-8, PROJ-32 | Deployed | [Spec](PROJ-34-preispositionen-ordnen.md) | 2026-10-29 |
| PROJ-35 | Umsatzsteuersatz je Position | USt-Satz (Prozent, 2 Nachkommastellen) für Übernachtung, jede Zusatzposition und Stornogebühr; Preise brutto; Auswahl „Reinigung“ 10 %/„Nächtigungsabgabe“ 0 %, sonst 20 %; Detail zeigt enthaltene USt je Satz | P0 | PROJ-8, PROJ-32, PROJ-34, PROJ-36 | Deployed | [Spec](PROJ-35-umsatzsteuersatz-je-position.md) | 2026-10-29 |
| PROJ-36 | Kleinunternehmer-Status | Verlauf von Statuswechseln (ab Datum: Kleinunternehmer ja/nein) in den Kundenstammdaten für Inhaber und Betreiber; Regel je Buchung nach Abreise bzw. Stornodatum; Grundlage für das Ausblenden der USt in PROJ-35 | P0 | PROJ-8, PROJ-28, PROJ-30 | Deployed | [Spec](PROJ-36-kleinunternehmer-status.md) | 2026-10-29 |
| PROJ-37 | Rechnungen nacherfassen | Bestehende Rechnungen aus dem bisherigen System erfassen: PDF hochladen, Nummer/Datum/Empfänger/Betrag von Hand, Buchung optional; Menüpunkt „Rechnungen“ mit Liste; Rechnungen je Buchung im Buchungsdetail; Buchungsübersicht mit Spalte „Rechnungen“ und Filter ohne/mit Rechnung (über alle Monate) | P0 | PROJ-4, PROJ-7, PROJ-8, PROJ-28, PROJ-32, PROJ-34, PROJ-35, PROJ-36 | Deployed | [Spec](PROJ-37-rechnungen-nacherfassen.md) | 2026-10-30 |

<!-- Add features above this line -->

## Build Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 29 → 30 → 31 → 32 → 33 → 34 → 36 → 35 → 37 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 26 → 17 (**Pilotstand**, ca. 3 Monate) → 18 → 19 (**MVP komplett**, ca. 4–5 Monate) → P2 nach Bedarf.

Den Channex-Block (PROJ-10 bis PROJ-12) früh angehen: Er ist das größte Risiko (Testzugang, Webhooks, Abläufe mit den Plattformen).

## Next Available ID: PROJ-38
