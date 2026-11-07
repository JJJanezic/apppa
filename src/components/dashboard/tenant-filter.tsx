'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_TENANTS, DASHBOARD_COOKIE } from '@/lib/dashboard'

interface TenantFilterProps {
  tenants: { id: string; name: string }[]
  value: string | null
}

// Kundenfilter des Dashboards (PROJ-14): je Gerät gemerkt (Cookie) und in der Adresse; ändert den gewählten Kunden der
// übrigen Seiten nicht
export function TenantFilter({ tenants, value }: TenantFilterProps) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function choose(next: string) {
    document.cookie = `${DASHBOARD_COOKIE}=${next}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`
    startTransition(() => router.push(`/?kunde=${encodeURIComponent(next)}`, { scroll: false }))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="dashboard-kunde" className="text-[13px] font-normal text-ds-neutral-700">
        {t('filterLabel')}
      </Label>
      <Select value={value ?? ALL_TENANTS} onValueChange={choose} disabled={pending}>
        <SelectTrigger id="dashboard-kunde" className="min-h-11 w-full sm:w-72" aria-busy={pending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TENANTS}>{t('allTenants')}</SelectItem>
          {tenants.map((tenant) => (
            <SelectItem key={tenant.id} value={tenant.id}>
              {tenant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
