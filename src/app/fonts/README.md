# Web-Schriften

Alle Schriften der Oberfläche liegen hier, damit weder Build noch Seitenaufruf Google Fonts brauchen. Vorher kamen sie über `next/font/google`; der Build scheiterte zeitweise, wenn Google die Schrift-Adressen in anderer Form lieferte („next/font/google queries have exactly one entry“, Produktions-Deploy 2026-11-05).

- **WOFF2, nur latin und latin-ext**, wie bisher bei Google
- **`SourceSerif4-App*`:** Grundschrift der App (`src/app/layout.tsx`). Aus der variablen Datei von [google/fonts](https://github.com/google/fonts) `ofl/sourceserif4/` (Stand 2026-11-05), Gewicht 400 bis 600 stufenlos, optische Größe auf den Standardwert 20 festgelegt
- **Übrige:** Editor-Schriften (`src/components/invoice-settings/rich-text-fonts.ts`), erzeugt aus denselben TTF-Dateien wie das PDF (`src/lib/invoice-pdf/fonts/`, dort Herkunft und Bearbeitung). Editor und PDF zeigen so dieselben Schriften
- **Lizenz:** SIL Open Font License 1.1, Texte in `OFL-*.txt`
- **Erzeugt mit fontTools:** `instancer` (nur Grundschrift), danach `subset` mit `flavor=woff2`, allen Layout-Features und den Unicode-Bereichen von Google für latin und latin-ext
