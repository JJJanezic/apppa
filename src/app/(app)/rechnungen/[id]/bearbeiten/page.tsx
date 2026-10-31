import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { DraftForm } from '@/components/invoice-drafts/draft-form'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { getDraftTextBlocks, getInvoiceDraftView } from '@/lib/invoice-drafts-data'
import { invoiceHref } from '@/lib/invoices'
import { getTenantContext } from '@/lib/tenant'

type Params = Promise<{ id: string }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoiceDrafts')
  return { title: t('form.editTitle') }
}

// „Entwurf bearbeiten“ (PROJ-40, nur Inhaber). Neuer Schlüssel je Fassung: „Aktuelle Fassung laden“ nach einem
// Konflikt startet das Formular mit den neuen Werten.
export default async function EditInvoiceDraftPage({ params }: { params: Params }) {
  await requireArea('invoices')
  const { active } = await getTenantContext()
  if (active?.role !== 'owner') notFound()
  const { id } = await params
  const t = await getTranslations('invoiceDrafts')
  const [view, textBlocks] = await Promise.all([getInvoiceDraftView(id), getDraftTextBlocks()])
  const lines = view.booking.lines
  if (!lines) notFound()

  return (
    <>
      <Link href={invoiceHref(id)} className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('form.backToDraft')}
      </Link>
      <PageHeader eyebrow={t('form.eyebrow')} title={t('form.editTitle')} />
      <DraftForm
        key={view.draft.updatedAt}
        booking={{ ...view.booking, lines }}
        others={view.others}
        preview={view.preview}
        smallBusiness={view.smallBusiness}
        textBlocks={textBlocks}
        today={todayIso()}
        draft={view.draft}
        bookingChanged={view.bookingChanged}
      />
    </>
  )
}
