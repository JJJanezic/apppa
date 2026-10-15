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
| PROJ-1 | Supabase Infrastructure Setup | Projekt-Anbindung, Env-Variablen, Schema-Grundriss, Mandanten-RLS-Muster, Auth-Konfiguration | P0 | None | Approved | [Spec](PROJ-1-supabase-infrastructure-setup.md) | 2026-10-12 |
| PROJ-2 | App-Shell & Design-System | Responsives Layout, Navigation, Broadsheet-Tokens in shadcn/ui, i18n-Grundlage (Deutsch) | P0 | None | Approved | [Spec](PROJ-2-app-shell-design-system.md) | 2026-10-12 |
| PROJ-3 | Authentifizierung | Login, Einladung annehmen, Passwort zurücksetzen, Logout | P0 | PROJ-1, PROJ-2 | In Progress | [Spec](PROJ-3-authentifizierung.md) | 2026-10-12 |
| PROJ-4 | Kundenkonten & Rollen | Mandant (Kunde), Rollen Inhaber/Mitarbeiter, Team-Mitglieder einladen | P0 | PROJ-1, PROJ-3 | Roadmap | – | 2026-10-12 |
| PROJ-5 | Betreiber-Admin | Kunden anlegen, einladen, deaktivieren; Übersicht aller Mandanten | P0 | PROJ-1, PROJ-4 | Roadmap | – | 2026-10-12 |
| PROJ-6 | Wohnungsverwaltung | Stammdaten, Adresse, Gemeinde, Kapazität | P0 | PROJ-1, PROJ-4 | Roadmap | – | 2026-10-12 |
| PROJ-7 | Gäste-Datenbank | Gäste-Stammdaten, Herkunftsland, Buchungsplattform, Marketing-Kanal, Dubletten zusammenführen | P0 | PROJ-1, PROJ-4 | Roadmap | – | 2026-10-12 |
| PROJ-8 | Manuelle Buchungen | Buchungen anlegen, bearbeiten, stornieren; Konfliktprüfung; Gast verknüpfen | P0 | PROJ-1, PROJ-6, PROJ-7 | Roadmap | – | 2026-10-12 |
| PROJ-9 | Belegungskalender | Monats-/Wochenansicht der Belegung aller Wohnungen | P0 | PROJ-1, PROJ-8 | Roadmap | – | 2026-10-12 |
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

<!-- Add features above this line -->

## Build Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 (**Pilotstand**, ca. 3 Monate) → 18 → 19 (**MVP komplett**, ca. 4–5 Monate) → P2 nach Bedarf.

Den Channex-Block (PROJ-10 bis PROJ-12) früh angehen: Er ist das größte Risiko (Testzugang, Webhooks, Abläufe mit den Plattformen).

## Next Available ID: PROJ-26
