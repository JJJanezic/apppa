# Product Requirements Document

## Vision
Eine Web-App für Vermieter von Ferien- und Dienstwohnungen. Sie führt Buchungen von booking.com, Airbnb und Direktbuchungen automatisch an einem Ort zusammen und verhindert Doppelbuchungen. Gäste, Zahlungen und die Tourismusabgabe werden ebenfalls dort verwaltet. Ziel ist, den wöchentlichen Verwaltungsaufwand der Vermieter mindestens zu halbieren.

Die App wird als Mehrmandanten-SaaS betrieben: Jeder Kunde (Vermieter) hat ein eigenes, vollständig abgeschottetes Konto. Sie läuft im Desktop- und im mobilen Browser und ist so aufgebaut, dass später weitere Features ergänzt werden können.

## Target Users

**Vermieter (Inhaber):** Privatvermieter und kleine Betriebe in Österreich mit wenigen bis einigen Dutzend Ferien- oder Dienstwohnungen.
- Gleichen Buchungen von booking.com, Airbnb und Direktbuchungen heute manuell ab, mit dem Risiko von Doppelbuchungen
- Gästedaten liegen verstreut in Plattform-Postfächern, Excel-Listen und E-Mails
- Berechnen die Tourismusabgabe (Ortstaxe) für die Gemeinde händisch
- Haben keinen Überblick über Auslastung, Umsatz und Herkunft ihrer Gäste
- Wollen ihre Gäste für Marketing (z. B. Stammgäste) nutzen, dürfen das aber nur mit DSGVO-Einwilligung

**Mitarbeiter eines Vermieters:** Sehen und bearbeiten Buchungen und Kalender, ohne Zugriff auf Zahlungen und Auswertungen.

**Betreiber (Admin):** Legt Kundenkonten an, lädt Kunden ein und betreut sie.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (Pilot) | Supabase-Infrastruktur, App-Shell & Design-System, Authentifizierung | Deployed (PROJ-1, PROJ-2, PROJ-3) |
| P0 (Pilot) | Kundenkonten mit Rollen (Inhaber/Mitarbeiter), Betreiber-Admin | Deployed (PROJ-4, PROJ-5) |
| P0 (Pilot) | Kundenstammdaten (Adresse, UID, Steuer- und Registernummer) | Deployed (PROJ-28) |
| P0 (Pilot) | Wohnungsverwaltung, Gäste-Datenbank, manuelle Buchungen, Belegungskalender | Deployed (PROJ-6, PROJ-7, PROJ-8, PROJ-9, PROJ-27) |
| P0 (Pilot) | Channex-Anbindung: Buchungsimport von booking.com/Airbnb und Verfügbarkeitssperren | Roadmap |
| P0 (Pilot) | Zahlungserfassung je Buchung, Dashboard | Roadmap |
| P0 (Pilot) | Tourismusabgabe: Regeln je Gemeinde, Berechnung und Monatsbericht | Roadmap |
| P0 (Pilot) | Gast-Erweiterung: Titel, Geschlecht, Reisedokument | Planned (PROJ-29) |
| P0 (Pilot) | Gästeblatt (Meldewesen) | Roadmap (PROJ-26) |
| P0 (Pilot) | Kalender-Abo-Link für Outlook/M365 und Google Calendar | Roadmap |
| P0 (MVP-Abschluss) | Statistische Auswertungen (Auslastung, Umsatz, Gästeherkunft, Kanäle) | Roadmap |
| P0 (MVP-Abschluss) | Marketing: DSGVO-Einwilligung, Segmente, CSV-Export | Roadmap |
| P2 | Zwei-Wege-Kalendersync, Selbstregistrierung & Abo, E-Mail-Versand, Englisch, Online-Zahlung, Bankabgleich | Roadmap |

Details, Abhängigkeiten und Bau-Reihenfolge: siehe `features/INDEX.md`.

## Success Metrics
- **Hauptziel:** Mindestens 50 % weniger wöchentlicher Verwaltungsaufwand für Buchungen, Gäste, Zahlungen und Abgabe bei den Pilotkunden (Vorher-Nachher-Schätzung)
- Zusätzlich beobachtet: keine Doppelbuchungen mehr durch fehlende Sperren
- Zusätzlich beobachtet: die Pilotkunden nutzen die App mindestens wöchentlich

## Constraints
- **Team:** Ein Entwickler mit Claude Code
- **Zeitrahmen:** Pilotstand (ohne Statistik und Marketing) nach ca. 3 Monaten mit 2–3 Pilotkunden; MVP komplett nach ca. 4–5 Monaten
- **Technik:** Next.js + Supabase (Projekt „apppa-dev“, Region eu-west-1) + Vercel
- **Plattform-Anbindung:** Ausschließlich über den Channel Manager Channex.io (White-Label). booking.com und Airbnb geben ihre APIs nur an zertifizierte Partner frei. Channex wird pro Wohnung abgerechnet
- **Kosten:** Laufende Kosten niedrig halten (Einstiegstarife bei Supabase/Vercel)
- **Onboarding & Abrechnung:** Der Betreiber legt Kunden an und lädt sie per E-Mail ein; abgerechnet wird außerhalb der App per Rechnung
- **Zahlungen:** Werden nur erfasst, nicht abgewickelt
- **Recht:** DSGVO (Gästedaten, Marketing nur mit Einwilligung; Plattform-Adressen von booking.com/Airbnb nicht für Werbung). Die Tourismusabgabe ist je Bundesland/Gemeinde unterschiedlich geregelt und muss konfigurierbar sein
- **Sprache:** Deutsch, technisch mehrsprachig vorbereitet; Euro, österreichische Datums- und Zahlenformate
- **Geräte:** Responsiv für Desktop- und mobile Browser
- **Design-System:** siehe `docs/design-system.md`

## Non-Goals
In dieser Version wird **nicht** gebaut:
- Eigene Zahlungsabwicklung oder Online-Zahlung für Gäste
- Eigener E-Mail- oder Newsletter-Versand
- Zwei-Wege-Synchronisation mit Outlook/Google Calendar
- Selbstregistrierung von Kunden mit Abo-Bezahlung
- Bankabgleich (Import von Kontoauszügen)
- Direkte Partner-APIs von booking.com oder Airbnb
- Native Mobile-Apps (iOS/Android)
- Englische Oberfläche

---

Use `/write-spec` to create detailed feature specifications for each item in the roadmap above.
