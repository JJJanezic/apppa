import { MagnifyingGlass, UserCircleDashed, UsersThree } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { CreateGuestButton } from '@/components/guests/create-guest-button'
import { GuestFilterBar } from '@/components/guests/guest-filters'
import { GuestList } from '@/components/guests/guest-list'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { parseGuestFilters } from '@/lib/guests'
import { getDuplicatePairs, getGuestPage, hasAnyGuest } from '@/lib/guests-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('guests')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Gästeliste (PROJ-7) für alle Mitglieder; Anlegen und Dubletten nur für Inhaber
export default async function GuestsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('guests')
  const t = await getTranslations('guests')
  const { active } = await getTenantContext()
  // Ohne Kunde (z. B. Betreiber-Admin ohne Mitgliedschaft): Hinweis wie im Dashboard statt „Seite nicht gefunden“
  if (!active) {
    const tTenant = await getTranslations('tenant')
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      </>
    )
  }
  const isOwner = active.role === 'owner'
  const filters = parseGuestFilters(await searchParams)
  const [page, anyGuest, duplicates] = await Promise.all([
    getGuestPage(filters),
    hasAnyGuest(),
    isOwner ? getDuplicatePairs() : Promise.resolve([]),
  ])

  if (!anyGuest) {
    return (
      <>
        <PageHeader title={t('title')} lead={t('lead')} />
        <EmptyState
          icon={UsersThree}
          title={t('emptyTitle')}
          text={isOwner ? t('emptyTextOwner') : t('emptyTextStaff')}
          action={isOwner ? <CreateGuestButton /> : undefined}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('title')} lead={t('lead')} action={isOwner && <CreateGuestButton />} />
      <section className="flex flex-col gap-4">
        <GuestFilterBar filters={page} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ds-neutral-800" aria-live="polite">
            {t('count', { count: page.total })}
          </p>
          {duplicates.length > 0 && (
            <Link href="/gaeste/dubletten" className="flex min-h-11 items-center text-sm text-ds-accent-700 underline underline-offset-[3px]">
              {t('duplicatesLink', { count: duplicates.length })}
            </Link>
          )}
        </div>
        {page.total === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title={t('noResultsTitle')}
            text={t('noResultsText')}
            action={
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/gaeste">{t('clearFilters')}</Link>
              </Button>
            }
          />
        ) : (
          <GuestList page={page} />
        )}
      </section>
    </>
  )
}
