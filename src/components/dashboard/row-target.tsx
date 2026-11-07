import Link from 'next/link'

import { SWITCH_PATH } from '@/lib/dashboard'
import { cn } from '@/lib/utils'

interface RowTargetProps {
  // Kunde der Zeile und gewählter Kunde der übrigen Seiten
  tenantId: string
  activeTenantId: string | null
  href: string
  className?: string
  children: React.ReactNode
}

const ROW = 'w-full rounded-md px-1 py-2 text-left hover:bg-ds-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2'

// Zeile des Dashboards (PROJ-14): beim gewählten Kunden ein normaler Link; bei einem anderen Kunden ein Formular an den
// Kundenwechsel, der danach das Ziel öffnet (Tech Design C). Beide sehen gleich aus.
export function RowTarget({ tenantId, activeTenantId, href, className, children }: RowTargetProps) {
  if (tenantId === activeTenantId) {
    return (
      <Link href={href} className={cn(ROW, 'block', className)}>
        {children}
      </Link>
    )
  }
  return (
    <form method="post" action={SWITCH_PATH}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="weiter" value={href} />
      <button type="submit" className={cn(ROW, 'cursor-pointer', className)}>
        {children}
      </button>
    </form>
  )
}

// Für Kalender-Klicks (Eintrag eines anderen Kunden, Anlegen in dessen Zeile): dasselbe Formular, im Browser abgeschickt
export function submitTenantSwitch(tenantId: string, href: string) {
  const form = document.createElement('form')
  form.method = 'post'
  form.action = SWITCH_PATH
  for (const [name, value] of [
    ['tenantId', tenantId],
    ['weiter', href],
  ]) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  }
  document.body.append(form)
  form.submit()
}
