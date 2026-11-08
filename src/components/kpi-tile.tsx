import Link from 'next/link'

import { SWITCH_PATH } from '@/lib/dashboard'

export type KpiLink = {
  href: string
  // Kunde des Ziels, wenn er nicht der gewählte ist: Kundenwechsel mit Ziel (PROJ-14)
  switchTenantId?: string | null
}

interface KpiTileProps {
  label: string
  value: string
  sub?: string
  // Zusätzliche Zeile, z. B. Vorjahr mit Veränderung (PROJ-18)
  note?: React.ReactNode
  // Ganze Kachel klickbar (PROJ-18: Auslastung und Umsatz auf dem Dashboard)
  link?: KpiLink
}

// Die Beschriftung trägt den Link, eine Fläche darüber macht die ganze Kachel klickbar
const STRETCH =
  'after:absolute after:inset-0 after:rounded-lg hover:after:bg-ds-neutral-300/40 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ds-accent'

function TileLabel({ label, link }: { label: string; link?: KpiLink }) {
  if (!link) return label
  if (link.switchTenantId) {
    return (
      <form method="post" action={SWITCH_PATH}>
        <input type="hidden" name="tenantId" value={link.switchTenantId} />
        <input type="hidden" name="weiter" value={link.href} />
        <button type="submit" className={`cursor-pointer text-left underline-offset-4 hover:underline ${STRETCH}`}>
          {label}
        </button>
      </form>
    )
  }
  return (
    <Link href={link.href} className={`underline-offset-4 hover:underline ${STRETCH}`}>
      {label}
    </Link>
  )
}

// Kennzahl-Kachel wie im Entwurf: Beschriftung, große Zahl, Unterzeile; als Fläche abgesetzt (PROJ-14, Wunsch Nutzer)
export function KpiTile({ label, value, sub, note, link }: KpiTileProps) {
  return (
    <div className="relative flex min-w-0 flex-col gap-1 rounded-lg bg-ds-surface p-4">
      <dt className="text-[13px] text-ds-neutral-700">
        <TileLabel label={label} link={link} />
      </dt>
      <dd className="font-serif text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[44px]">
        {value}
      </dd>
      {sub && <dd className="text-[13px] text-ds-neutral-700">{sub}</dd>}
      {note && <dd className="text-[13px] text-ds-neutral-700">{note}</dd>}
    </div>
  )
}

interface KpiGridProps {
  children: React.ReactNode
  label?: string
  // Anzahl der Kacheln am Desktop (Standard 4; Auswertungen: 5)
  columns?: 4 | 5
}

// Raster: Handy 2 Spalten, Desktop bis zu 4 (bzw. 5) nebeneinander (PROJ-14: auch unter 400 px zwei Spalten, damit die
// Kacheln des Dashboards nicht die ganze erste Bildschirmhöhe füllen)
export function KpiGrid({ children, label, columns = 4 }: KpiGridProps) {
  return (
    <dl aria-label={label} className={`grid grid-cols-2 gap-3 sm:gap-4 ${columns === 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'}`}>
      {children}
    </dl>
  )
}
