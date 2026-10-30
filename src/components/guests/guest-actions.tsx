'use client'

import { GitMerge, PencilSimple, Trash } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deleteGuest } from '@/app/(app)/gaeste/actions'
import { callAction } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { GuestPanel } from '@/components/guests/guest-panel'
import { MergeDialog } from '@/components/guests/merge-dialog'
import { Button } from '@/components/ui/button'
import { type Guest, guestDisplayName } from '@/lib/guests'

// Aktionen im Gast-Detail (nur Inhaber): Bearbeiten, Zusammenführen, Löschen bzw. Anonymisieren.
// Anonymisierte Gäste lassen sich nicht mehr ändern; für sie gibt es keine Aktionen.
export function GuestActions({ guest }: { guest: Guest }) {
  const t = useTranslations('guests')
  const te = useTranslations('guests.errors')
  const router = useRouter()
  const [dialog, setDialog] = useState<'edit' | 'merge' | 'delete' | null>(null)
  const [pending, setPending] = useState(false)
  const close = (open: boolean) => !open && setDialog(null)
  // Mit Buchungen (auch Optionen und stornierten) oder Rechnungen (PROJ-37) wird anonymisiert statt gelöscht
  // (Buchungen bleiben für Abgabe und Steuer, Rechnungen 7 Jahre)
  const anonymize = guest.stays.bookings > 0 || guest.stays.invoices > 0

  if (guest.anonymizedAt) return null

  async function remove() {
    setDialog(null)
    setPending(true)
    const result = await callAction(() => deleteGuest({ id: guest.id }))
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(te(result.error))
      return
    }
    if (result.data?.mode === 'anonymized') {
      toast.success(t('done.anonymized'))
      router.refresh()
    } else {
      // Frisch laden, damit die Liste den gelöschten Gast nicht mehr aus dem Zwischenspeicher zeigt;
      // die Bestätigung zeigt die Liste selbst (?geloescht=1, siehe DeletedNotice)
      window.location.assign(result.redirectTo ?? '/gaeste?geloescht=1')
    }
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
      {dialog === 'edit' && <GuestPanel key={guest.updatedAt} open onOpenChange={close} guest={guest} />}
      {dialog === 'merge' && <MergeDialog open onOpenChange={close} guest={guest} />}
      {dialog === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t('delete.title', { name: guestDisplayName(guest) })}
          text={guest.stays.bookings > 0 ? t('delete.textAnonymize') : anonymize ? t('delete.textAnonymizeInvoices') : t('delete.textDelete')}
          confirmLabel={anonymize ? t('delete.confirmAnonymize') : t('delete.confirmDelete')}
          cancelLabel={t('delete.cancel')}
          onConfirm={remove}
        />
      )}
    </>
  )
}
