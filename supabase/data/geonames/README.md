# Postleitzahlen Deutschland (GeoNames)

- **Datei:** `DE.txt` – aus `DE.zip`, Stand 08.11.2026
- **Quelle:** https://download.geonames.org/export/zip/DE.zip
- **Lizenz:** Creative Commons Namensnennung 4.0 International (CC BY 4.0), siehe `readme.txt` im Archiv
- **Quellenangabe (Pflicht):** „Daten: GeoNames“ (geonames.org) – steht in der App unter dem Feld „Ort“, sobald ein Ort aus der PLZ stammt (PROJ-48)

Daraus erzeugt `scripts/build-postal-places.mts` die Ortsliste `src/lib/postal-places-data/de.json`. Großkunden-Einträge (Firmennamen) und Ortsteile neben dem Hauptort derselben PLZ entfallen.
Aktualisierung: Runbook `docs/runbooks/supabase.md`, Abschnitt 16.
