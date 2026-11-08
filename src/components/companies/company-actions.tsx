'use client'

import { GitMerge, PencilSimple, Trash } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deleteCompany } from '@/app/(app)/gaeste/firmen/actions'
import { callAction } from '@/components/auth/form-error'
import { CompanyMergeDialog } from '@/components/companies/company-merge-dialog'
import { CompanyPanel } from '@/components/companies/company-panel'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { type Company, COMPANY_LIST } from '@/lib/companies'

// Aktionen im Firmendetail (nur Inhaber): Bearbeiten, Zusammenführen, Löschen
export function CompanyActions({ company }: { company: Company }) {
  const t = useTranslations('companies')
  const te = useTranslations('companies.errors')
  const [dialog, setDialog] = useState<'edit' | 'merge' | 'delete' | null>(null)
  const [pending, setPending] = useState(false)
  const close = (open: boolean) => !open && setDialog(null)

  async function remove() {
    setDialog(null)
    setPending(true)
    const result = await callAction(() => deleteCompany({ id: company.id }))
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(te(result.error))
      return
    }
    // Frisch laden, damit die Liste die gelöschte Firma nicht mehr aus dem Zwischenspeicher zeigt;
    // die Bestätigung zeigt die Liste selbst (?geloescht=1)
    window.location.assign(result.redirectTo ?? `${COMPANY_LIST}?geloescht=1`)
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button className="min-h-11" onClick={() => setDialog('edit')}>
          <PencilSimple size={18} weight="bold" aria-hidden="true" />
          {t('detail.edit')}
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => setDialog('merge')}>
          <GitMerge size={18} aria-hidden="true" />
          {t('detail.merge')}
        </Button>
        <Button variant="ghost" className="min-h-11 text-ds-accent-2-700" disabled={pending} onClick={() => setDialog('delete')}>
          <Trash size={18} aria-hidden="true" />
          {t('detail.delete')}
        </Button>
      </div>

      {/* Neuer Schlüssel bei geänderter Fassung: „Aktuelle Fassung laden“ startet das Formular mit den neuen Werten */}
      {dialog === 'edit' && <CompanyPanel key={company.updatedAt} open onOpenChange={close} company={company} />}
      {dialog === 'merge' && <CompanyMergeDialog open onOpenChange={close} company={company} />}
      {dialog === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t('delete.title', { name: company.name })}
          text={company.guestCount > 0 ? t('delete.textGuests', { count: company.guestCount }) : t('delete.text')}
          confirmLabel={t('delete.confirm')}
          cancelLabel={t('delete.cancel')}
          onConfirm={remove}
        />
      )}
    </>
  )
}
