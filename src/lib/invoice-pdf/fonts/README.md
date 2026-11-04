# Schriften der Rechnungs-PDFs (PROJ-41)

Sechs Familien mit je vier Schnitten als einzelne TTF-Dateien. React-PDF kann keine variablen Schriften und kein WOFF2 nutzen.

- Quelle: [google/fonts](https://github.com/google/fonts), Ordner `ofl/`, Stand 2026-11-04
- Lizenz: SIL Open Font License 1.1, Texte in `OFL-*.txt`. Für Tinos liegt in der Quelle kein Lizenztext; `METADATA.pb` nennt OFL, es gilt derselbe Lizenztext.
- Carlito und Tinos: unverändert übernommen
- Arimo, Open Sans, Source Sans 3, Source Serif 4: aus den variablen Dateien mit fontTools (`varLib.instancer`) auf wght 400/700 festgelegt; Open Sans mit wdth 100, Source Serif 4 mit opsz 11
