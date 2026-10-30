'use client'

import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deleteInvoice } from '@/app/(app)/rechnungen/actions'
import { callAction } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { InvoicePanel } from '@/components/invoices/invoice-panel'
import { Button } from '@/components/ui/button'
import type { Invoice } from '@/lib/invoices'

// „Rechnung nacherfassen“ im Kopf und im Leerzustand der Rechnungsliste (nur Inhaber, nur bei eingeschaltetem Schalter)
export function NewInvoiceButton({ today }: { today: string }) {
  const t = useTranslations('invoices')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button className="min-h-11" onClick={() => setOpen(true)}>
        <Plus size={18} weight="bold" aria-hidden="true" />
        {t('create')}
      </Button>
      {open && <InvoicePanel open onOpenChange={setOpen} invoice={null} today={today} />}
    </>
  )
}

// „Bearbeiten“ und „Löschen“ im Rechnungsdetail (nur Inhaber; auch bei ausgeschaltetem Schalter)
export function InvoiceActions({ invoice, today }: { invoice: Invoice; today: string }) {
  const t = useTranslations('invoices')
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const [pending, setPending] = useState(false)
  const close = (open: boolean) => !open && setDialog(null)

  async function remove() {
    setDialog(null)
    setPending(true)
    const result = await callAction(() => deleteInvoice({ id: invoice.id }))
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(t(`errors.${result.error}`))
      return
    }
    // Die Aktion leitet selbst zur Liste weiter
    toast.success(t('done.deleted'))
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button className="min-h-11" onClick={() => setDialog('edit')}>
          <PencilSimple size={18} weight="bold" aria-hidden="true" />
          {t('detail.edit')}
        </Button>
        <Button variant="ghost" className="min-h-11 text-ds-accent-2-700" disabled={pending} onClick={() => setDialog('delete')}>
          <Trash size={18} aria-hidden="true" />
          {t('detail.delete')}
        </Button>
      </div>
      {/* Neuer Schlüssel bei geänderter Fassung: „Aktuelle Fassung laden“ startet das Formular mit den neuen Werten */}
      {dialog === 'edit' && <InvoicePanel key={invoice.updatedAt} open onOpenChange={close} invoice={invoice} today={today} />}
      {dialog === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t('delete.title', { number: invoice.number })}
          text={invoice.pdfPath ? t('delete.textWithPdf') : t('delete.text')}
          confirmLabel={t('delete.confirm')}
          cancelLabel={t('delete.cancel')}
          onConfirm={remove}
        />
      )}
    </>
  )
}
