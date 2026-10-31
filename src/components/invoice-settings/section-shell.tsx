'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// Abschnitt der Rechnungs-Einstellungen mit Überschrift (Ebene je nach Seite: Einstellungen h2, Betreiber h3)
export function SettingsSection({
  title,
  lead,
  level,
  children,
}: {
  title: string
  lead?: string
  level: 2 | 3
  children: React.ReactNode
}) {
  const id = useId()
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <section aria-labelledby={id} className="flex min-w-0 max-w-[720px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading id={id} className={level === 2 ? 'text-2xl' : 'text-xl'}>
          {title}
        </Heading>
        {lead && <p className="text-ds-neutral-800">{lead}</p>}
      </div>
      {children}
    </section>
  )
}

// „Die Einstellungen wurden inzwischen geändert“ mit „Aktuelle Fassung laden“ (Konfliktschutz wie PROJ-28)
export function StaleAlert({ onReload }: { onReload?: () => void }) {
  const t = useTranslations('invoiceSettings.stale')
  const router = useRouter()
  return (
    <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <WarningCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-3">
        {t('text')}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            onReload?.()
            router.refresh()
          }}
        >
          {t('reload')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
