interface KpiTileProps {
  label: string
  value: string
  sub?: string
}

// Kennzahl-Kachel wie im Entwurf: Beschriftung, große Zahl, Unterzeile; als Fläche abgesetzt (PROJ-14, Wunsch Nutzer)
export function KpiTile({ label, value, sub }: KpiTileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-ds-surface p-4">
      <dt className="text-[13px] text-ds-neutral-700">{label}</dt>
      <dd className="font-serif text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[44px]">
        {value}
      </dd>
      {sub && <dd className="text-[13px] text-ds-neutral-700">{sub}</dd>}
    </div>
  )
}

interface KpiGridProps {
  children: React.ReactNode
  label?: string
}

// Raster: Handy 2 Spalten, Desktop bis zu 4 nebeneinander (PROJ-14: auch unter 400 px zwei Spalten, damit die Kacheln
// des Dashboards nicht die ganze erste Bildschirmhöhe füllen)
export function KpiGrid({ children, label }: KpiGridProps) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {children}
    </dl>
  )
}
