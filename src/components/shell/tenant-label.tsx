'use client'

import { CaretUpDown, Check } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { switchTenant } from '@/app/(app)/tenant-actions'
import { callAction } from '@/components/auth/form-error'
import { TruncatedText } from '@/components/shell/truncated-text'
import { useShell } from '@/components/shell/shell-context'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Kundenname unter der Wortmarke. Bei mehreren Mitgliedschaften: Auswahl mit Rolle je Kunde (PROJ-4)
export function TenantLabel() {
  const t = useTranslations('shell')
  const tRoles = useTranslations('roles')
  const tErrors = useTranslations('team.errors')
  const { tenant } = useShell()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const name = tenant.name ?? t('tenantPlaceholder')
  const list = tenant.list ?? []

  if (!tenant.hasOthers || list.length < 2) {
    return <TruncatedText text={name} className="text-[13px] text-ds-neutral-700" />
  }

  async function choose(tenantId: string) {
    if (tenantId === tenant.id) {
      setOpen(false)
      return
    }
    setPending(true)
    const result = await callAction(() => switchTenant({ tenantId }))
    if (result.ok) {
      // Vollständiger Seitenwechsel: alle Daten des neuen Kunden frisch laden
      window.location.href = result.redirectTo ?? '/'
      return
    }
    setPending(false)
    if (result.error !== 'sessionExpired') toast.error(tErrors(result.error))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${t('switchTenant')}: ${name}`}
        className="flex min-h-11 w-full min-w-0 items-center gap-1 rounded-md text-left text-[13px] text-ds-neutral-700 hover:text-ds-accent-700"
      >
        <TruncatedText text={name} />
        <CaretUpDown size={14} aria-hidden="true" className="shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <p className="px-3 py-2 text-[13px] text-ds-neutral-700">{t('switchTenantTitle')}</p>
        <ul aria-label={t('switchTenantTitle')}>
          {list.map((entry) => {
            const current = entry.id === tenant.id
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  disabled={pending}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => choose(entry.id)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-ds-surface',
                    current && 'font-semibold'
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{entry.name}</span>
                    <span className="text-[13px] font-normal text-ds-neutral-700">{tRoles(entry.role)}</span>
                  </span>
                  {current && <Check size={16} weight="bold" aria-label={t('currentTenant')} className="text-ds-accent-700" />}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
