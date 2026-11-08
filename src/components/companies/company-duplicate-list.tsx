'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { dismissCompanyDuplicate, loadCompany } from '@/app/(app)/gaeste/firmen/actions'
import { callAction } from '@/components/auth/form-error'
import { CompanyMergeDialog } from '@/components/companies/company-merge-dialog'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Button } from '@/components/ui/button'
import { type Company, companyDetailLine, type CompanyDuplicatePair, companyHref, type CompanyRow } from '@/lib/companies'

// Vorschlagsliste „Mögliche doppelte Firmen“ (PROJ-50, nur Inhaber): je Paar Zusammenführen oder „Keine doppelte Firma“
export function CompanyDuplicateList({ pairs }: { pairs: CompanyDuplicatePair[] }) {
  const t = useTranslations('companies')
  const te = useTranslations('companies.errors')
  const { run, pending } = useTeamAction('companies.errors')
  const [merging, setMerging] = useState<{ company: Company; otherId: string } | null>(null)
  const [loadingPair, setLoadingPair] = useState<string | null>(null)

  async function startMerge(pair: CompanyDuplicatePair) {
    const id = `${pair.a.id}-${pair.b.id}`
    setLoadingPair(id)
    const result = await callAction(() => loadCompany({ id: pair.a.id }))
    setLoadingPair(null)
    if (!result.ok || !result.data) {
      if (!result.ok && result.error !== 'sessionExpired') toast.error(te(result.error))
      return
    }
    setMerging({ company: result.data, otherId: pair.b.id })
  }

  const companyLine = (c: CompanyRow) => (
    <span className="flex min-w-0 flex-col">
      <Link href={companyHref(c.id)} className="break-words font-medium text-ds-accent-700 underline-offset-[3px] hover:underline">
        {c.name}
      </Link>
      <span className="break-words text-[13px] text-ds-neutral-700">
        {[companyDetailLine(c), t('list.guestsShort', { count: c.guestCount })].filter(Boolean).join(' · ')}
      </span>
    </span>
  )

  return (
    <>
      <ul className="flex flex-col gap-3">
        {pairs.map((pair) => {
          const id = `${pair.a.id}-${pair.b.id}`
          return (
            <li key={id} className="flex flex-col gap-3 rounded-lg bg-ds-surface p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2">
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-6">
                  {companyLine(pair.a)}
                  {companyLine(pair.b)}
                </div>
                <p className="text-sm text-ds-neutral-800">
                  {t('duplicates.reasons', { reasons: pair.reasons.map((r) => t(`duplicates.reason.${r}`)).join(', ') })}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="min-h-11" disabled={loadingPair === id} aria-busy={loadingPair === id} onClick={() => startMerge(pair)}>
                  {t('duplicates.merge')}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => run(() => dismissCompanyDuplicate({ aId: pair.a.id, bId: pair.b.id }), t('done.dismissed'))}
                >
                  {t('duplicates.dismiss')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {merging && (
        <CompanyMergeDialog
          open
          onOpenChange={(open) => !open && setMerging(null)}
          company={merging.company}
          presetOtherId={merging.otherId}
        />
      )}
    </>
  )
}
