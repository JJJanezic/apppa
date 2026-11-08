# PLZ-Verzeichnis Österreich (RTR)

- **Datei:** `plz.json` – PLZ-Verzeichnis der Österreichischen Post, veröffentlicht von der RTR-GmbH, Version 61407 vom 04.11.2026
- **Quelle:** https://data.rtr.at/api/v1/tables/plz.json (Übersicht: https://data.rtr.at/)
- **Lizenz:** Creative Commons Namensnennung 3.0 Österreich (CC BY 3.0 AT)
- **Quellenangabe (Pflicht):** „Daten: RTR“ – steht in der App unter dem Feld „Ort“, sobald ein Ort aus der PLZ stammt (PROJ-48)

Daraus erzeugt `scripts/build-postal-places.mts` die Ortsliste `src/lib/postal-places-data/at.json` (nur gültige PLZ mit Adressierung).
Aktualisierung: Runbook `docs/runbooks/supabase.md`, Abschnitt 16.
