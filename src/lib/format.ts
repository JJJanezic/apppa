// Zahlen ohne Währung wie im Entwurf mit Tausenderpunkt („1.179,80“).
// de-AT trennt einfache Zahlen mit schmalem Leerzeichen („1 179,80“), Euro-Beträge dagegen mit Punkt.
// de-DE hat dieselben Zeichen für Komma und Tausenderpunkt; Datum und Euro bleiben bei de-AT (z. B. „Jänner“, „€ 17.480“).
export function formatDecimal(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('de-DE', options).format(value)
}
