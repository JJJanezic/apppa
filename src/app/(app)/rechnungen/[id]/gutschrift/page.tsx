import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

import { CreditForm } from '@/components/invoice-credit/credit-form'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { creditEntry, mirrorAmounts } from '@/lib/invoice-credit'
import { getNumberedInvoices } from '@/lib/invoice-issue-data'
import { loadInvoiceSettings } from '@/lib/invoice-settings-data'
import { addressLines } from '@/lib/guests'
import { invoiceHref } from '@/lib/invoices'
import { getInvoice, getInvoiceOrigin } from '@/lib/invoices-data'
import { getTenantContext } from '@/lib/tenant'

type Params = Promise<{ id: string }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoiceCredit')
  return { title: t('metaTitle') }
}

// „Gutschrift ausstellen“ zu einer ausgestellten Rechnung (PROJ-44, nur Inhaber). Mitarbeiter, Entwürfe, nacherfasste und
// stornierte Rechnungen, Gutschriften und abgezogene Teilrechnungen führen zur Detailseite der Rechnung; dort steht der Grund.
export default async function CreditNotePage({ params }: { params: Params }) {
  await requireArea('invoices')
  const { id } = await params
  const { active } = await getTenantContext()
  if (!active) notFound()
  if (active.role !== 'owner' || (await getInvoiceOrigin(id)) !== 'issued') redirect(invoiceHref(id))
  const invoice = await getInvoice(id)
  if (!invoice.issued || creditEntry(invoice).state !== 'available') redirect(invoiceHref(id))
  const [t, locale, settings, existing] = await Promise.all([getTranslations('invoiceCredit'), getLocale(), loadInvoiceSettings(active.id), getNumberedInvoices(active.id)])
  if (!settings) notFound()
  const s = invoice.issued.snapshot
  const r = s.recipient

  return (
    <>
      <Link href={invoiceHref(id)} className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader eyebrow={t('eyebrow', { number: invoice.number })} title={t('title')} />
      <CreditForm
        invoice={{
          id: invoice.id,
          number: invoice.number,
          invoiceDate: invoice.invoiceDate,
        }}
        mirrored={{ ...s, ...mirrorAmounts(s) }}
        recipientLines={addressLines(
          {
            lines: [r.line1, r.line2],
            postalCode: r.postalCode || null,
            city: r.city || null,
            country: r.country || null,
          },
          locale,
        )}
        today={todayIso()}
        numbering={settings.numbering}
        numbers={existing.map((e) => e.number)}
      />
    </>
  )
}
