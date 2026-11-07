import { CaretLeft, Receipt } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { DraftForm } from '@/components/invoice-drafts/draft-form'
import { BackToInvoiceList } from '@/components/invoices/invoice-list-return'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { bookingHref, todayIso } from '@/lib/bookings'
import { billableCents, invoiceButtonState, invoiceSums } from '@/lib/invoice-drafts'
import { draftSmallBusiness, getBookingInvoiceSummaries, getDraftBooking, getDraftPreviewData, getDraftTextBlocks } from '@/lib/invoice-drafts-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoiceDrafts')
  return { title: t('form.createTitle') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// „Rechnung erstellen“ (PROJ-40, nur Inhaber): Entwurf aus der Buchung (?buchung=…). Ist nichts mehr zu verrechnen,
// erscheint statt des Formulars die Begründung (wie am inaktiven Knopf); die Datenbank prüft die Summenregel selbst.
export default async function NewInvoiceDraftPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('invoices')
  const { active } = await getTenantContext()
  if (active?.role !== 'owner') notFound()
  const params = await searchParams
  const raw = params.buchung
  const bookingId = Array.isArray(raw) ? raw[0] : raw
  // Aus der Rechnungsliste geöffnet (PROJ-43): Rückweg und „Abbrechen“ zur Liste
  const fromList = (Array.isArray(params.von) ? params.von[0] : params.von) === 'liste'
  const tList = await getTranslations('invoices')
  const booking = bookingId ? await getDraftBooking(bookingId) : null
  if (!booking || booking.kind === 'block' || !booking.lines) notFound()
  const t = await getTranslations('invoiceDrafts')
  const [others, preview, textBlocks] = await Promise.all([getBookingInvoiceSummaries(booking.id), getDraftPreviewData(), getDraftTextBlocks()])
  const lines = booking.lines
  const { billedCents, draftCents } = invoiceSums(others)
  const state = invoiceButtonState({
    cancelled: booking.cancelledAt !== null,
    hasFee: lines.some((l) => l.source === 'cancellation_fee'),
    billableCents: billableCents(lines),
    billedCents,
    draftCents,
  })

  return (
    <>
      {fromList ? (
        <BackToInvoiceList label={tList('detail.back')} />
      ) : (
        <Link href={bookingHref(booking.id)} className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
          <CaretLeft size={16} weight="bold" aria-hidden="true" />
          {t('form.backToBooking')}
        </Link>
      )}
      <PageHeader eyebrow={t('form.eyebrow')} title={t('form.createTitle')} lead={t('form.lead')} />
      {state.enabled ? (
        <DraftForm
          booking={{ ...booking, lines }}
          others={others}
          preview={preview}
          smallBusiness={draftSmallBusiness(preview, booking)}
          textBlocks={textBlocks}
          today={todayIso()}
          draft={null}
          bookingChanged={false}
          fromList={fromList}
        />
      ) : (
        <EmptyState
          icon={Receipt}
          title={t('form.blockedTitle')}
          text={t(`button.disabled.${state.reason}`)}
          action={
            fromList ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/rechnungen">{tList('detail.back')}</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={bookingHref(booking.id)}>{t('form.backToBooking')}</Link>
              </Button>
            )
          }
        />
      )}
    </>
  )
}
