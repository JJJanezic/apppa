'use client'

import { Eye, PencilSimple, Stamp, Trash } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deleteInvoiceDraft } from '@/app/(app)/rechnungen/actions'
import { callAction } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { invoiceEditHref, invoiceIssueHref, invoicePreviewHref } from '@/lib/invoice-drafts'

// Knöpfe der Entwurf-Detailseite (PROJ-40, PROJ-42): Inhaber „Ausstellen“, „Bearbeiten“, „Vorschau“, „Löschen“ (mit Bestätigung);
// Mitarbeiter nur „Vorschau“
export function DraftActions({ id, owner }: { id: string; owner: boolean }) {
  const t = useTranslations('invoiceDrafts.detail')
  const te = useTranslations('invoices.errors')
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)

  async function remove() {
    setConfirm(false)
    setPending(true)
    const result = await callAction(() => deleteInvoiceDraft({ id }))
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(te(result.error))
      return
    }
    // Die Aktion leitet selbst zur Buchung weiter
    toast.success(t('deleted'))
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {owner && (
          <Button asChild className="min-h-11">
            <Link href={invoiceIssueHref(id)}>
              <Stamp size={18} weight="bold" aria-hidden="true" />
              {t('issue')}
            </Link>
          </Button>
        )}
        {owner && (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={invoiceEditHref(id)}>
              <PencilSimple size={18} aria-hidden="true" />
              {t('edit')}
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="min-h-11">
          <Link href={invoicePreviewHref(id)}>
            <Eye size={18} aria-hidden="true" />
            {t('preview')}
          </Link>
        </Button>
        {owner && (
          <Button variant="ghost" className="min-h-11 text-ds-accent-2-700" disabled={pending} onClick={() => setConfirm(true)}>
            <Trash size={18} aria-hidden="true" />
            {t('delete')}
          </Button>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={setConfirm}
          title={t('deleteTitle')}
          text={t('deleteText')}
          confirmLabel={t('deleteConfirm')}
          cancelLabel={t('deleteCancel')}
          onConfirm={remove}
        />
      )}
    </>
  )
}
