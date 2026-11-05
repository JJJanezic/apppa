import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { IssueForm } from '@/components/invoice-issue/issue-form'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { getInvoiceDraftView } from '@/lib/invoice-drafts-data'
import { getNumberedInvoices } from '@/lib/invoice-issue-data'
import { loadInvoiceSettings } from '@/lib/invoice-settings-data'
import { invoiceHref } from '@/lib/invoices'
import { getInvoiceOrigin } from '@/lib/invoices-data'
import { getTenantContext } from '@/lib/tenant'

type Params = Promise<{ id: string }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoiceIssue')
  return { title: t('metaTitle') }
}

// „Rechnung ausstellen“ (PROJ-42, nur Inhaber). Eine schon ausgestellte Rechnung führt zu ihrer Detailseite.
export default async function IssueInvoicePage({ params }: { params: Params }) {
  await requireArea('invoices')
  const { active } = await getTenantContext()
  if (active?.role !== 'owner') notFound()
  const { id } = await params
  if ((await getInvoiceOrigin(id)) !== 'draft') redirect(invoiceHref(id))
  const t = await getTranslations('invoiceIssue')
  const [view, settings, existing] = await Promise.all([getInvoiceDraftView(id), loadInvoiceSettings(active.id), getNumberedInvoices(active.id)])
  if (!settings) notFound()

  return (
    <>
      <Link href={invoiceHref(id)} className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} />
      <IssueForm
        id={id}
        updatedAt={view.draft.updatedAt}
        initialDate={view.draft.invoiceDate}
        today={todayIso()}
        numbering={settings.numbering}
        numbers={existing.map((e) => e.number)}
      />
    </>
  )
}
