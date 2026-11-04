import { ArrowLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { DraftPdfPreview } from '@/components/invoice-pdf/draft-pdf-preview'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { getInvoiceDraftView } from '@/lib/invoice-drafts-data'
import { invoiceHref } from '@/lib/invoices'

type Params = Promise<{ id: string }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoiceDrafts')
  return { title: t('preview.metaTitle') }
}

// Vorschau eines gespeicherten Entwurfs (PROJ-40) für Inhaber und Mitarbeiter, ohne Bearbeitungsknöpfe
export default async function InvoiceDraftPreviewPage({ params }: { params: Params }) {
  await requireArea('invoices')
  const { id } = await params
  const t = await getTranslations('invoiceDrafts')
  // Prüft den Zugriff; das PDF lädt die Komponente
  await getInvoiceDraftView(id)
  const back = (
    <Button asChild variant="outline" className="min-h-11 self-start">
      <Link href={invoiceHref(id)}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('form.backToDraft')}
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader eyebrow={t('preview.eyebrow')} title={t('preview.pageTitle')} />
      <div className="-mt-4 flex flex-col gap-6">
        {back}
        <DraftPdfPreview body={JSON.stringify({ draftId: id })} />
        {back}
      </div>
    </>
  )
}
