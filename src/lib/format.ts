// Einheitliche Zahlenformate der App: Tausender immer mit Punkt, Dezimalstellen mit Komma („1.179,80“).
// de-AT trennt einfache Zahlen, Prozent und Einheiten mit schmalem Leerzeichen („1 179,80“), Euro-Beträge
// dagegen mit Punkt. Darum: Zahlen, Prozent und Einheiten über de-DE (gleiche Zeichen), Euro über de-AT
// („€ 17.480“ statt „17.480 €“). Datum bleibt bei de-AT (z. B. „Jänner“) über next-intl.
//
// Regel: Zahlen in der Oberfläche nur über diese Funktionen formatieren, nicht mit format.number()
// von next-intl, toLocaleString() oder „#“ in ICU-Texten (dort {value} mit formatNumber() übergeben).

const NUMBER_LOCALE = 'de-DE'
const CURRENCY_LOCALE = 'de-AT'

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, { useGrouping: true, ...options }).format(value)
}

// 0.58 → „58 %“
export function formatPercent(value: number, options?: Intl.NumberFormatOptions): string {
  return formatNumber(value, { style: 'percent', maximumFractionDigits: 0, ...options })
}

// 17480 → „€ 17.480“, mit cents: true → „€ 17.480,00“
export function formatCurrency(value: number, { cents = false }: { cents?: boolean } = {}): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: 'EUR',
    useGrouping: true,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value)
}
