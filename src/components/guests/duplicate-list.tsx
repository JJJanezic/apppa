'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { dismissDuplicate, loadGuest } from '@/app/(app)/gaeste/actions'
import { callAction } from '@/components/auth/form-error'
import { MergeDialog } from '@/components/guests/merge-dialog'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Button } from '@/components/ui/button'
import { countryName, type DuplicatePair, type Guest, guestHref, type GuestRow, guestSortName } from '@/lib/guests'

// Vorschlagsliste „Mögliche Dubletten“ (PROJ-7, nur Inhaber): je Paar Zusammenführen oder „Kein Doppeleintrag“
export function DuplicateList({ pairs }: { pairs: DuplicatePair[] }) {
  const t = useTranslations('guests')
  const te = useTranslations('guests.errors')
  const locale = useLocale()
  const { run, pending } = useTeamAction('guests.errors')
  const [merging, setMerging] = useState<{ guest: Guest; otherId: string } | null>(null)
  const [loadingPair, setLoadingPair] = useState<string | null>(null)

  async function startMerge(pair: DuplicatePair) {
    const id = `${pair.a.id}-${pair.b.id}`
    setLoadingPair(id)
    const result = await callAction(() => loadGuest({ id: pair.a.id }))
    setLoadingPair(null)
    if (!result.ok || !result.data) {
      if (!result.ok && result.error !== 'sessionExpired') toast.error(te(result.error))
      return
    }
    setMerging({ guest: result.data, otherId: pair.b.id })
  }

  const guestLine = (g: GuestRow) => (
    <span className="flex min-w-0 flex-col">
      <Link href={guestHref(g.id)} className="break-words font-medium text-ds-accent-700 underline-offset-[3px] hover:underline">
        {guestSortName(g)}
      </Link>
      <span className="text-[13px] text-ds-neutral-700">{[g.companyName, countryName(g.country, locale)].filter(Boolean).join(' · ')}</span>
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
                  {guestLine(pair.a)}
                  {guestLine(pair.b)}
                </div>
                <p className="text-sm text-ds-neutral-800">
                  {t('duplicates.reasons', { reasons: pair.reasons.map((r) => t(`reason.${r}`)).join(', ') })}
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
                  onClick={() => run(() => dismissDuplicate({ aId: pair.a.id, bId: pair.b.id }), t('done.dismissed'))}
                >
                  {t('duplicates.dismiss')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {merging && (
        <MergeDialog
          open
          onOpenChange={(open) => !open && setMerging(null)}
          guest={merging.guest}
          presetOtherId={merging.otherId}
        />
      )}
    </>
  )
}
