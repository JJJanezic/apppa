'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deleteTenant, setTenantActive } from '@/app/(app)/betreiber/actions'
import { callAction } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTeamAction } from '@/components/settings/use-team-action'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteConfirmed } from '@/lib/operator'

interface TenantDangerZoneProps {
  tenantId: string
  tenantName: string
  deactivated: boolean
}

// Deaktivieren / Reaktivieren und – nur bei deaktivierten Kunden – endgültig löschen
export function TenantDangerZone({ tenantId, tenantName, deactivated }: TenantDangerZoneProps) {
  const t = useTranslations('operator')
  const { run, pending } = useTeamAction('operator.errors')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const action = deactivated ? 'reactivate' : 'deactivate'

  async function toggle() {
    setConfirming(false)
    await run(() => setTenantActive({ tenantId, active: deactivated }), t(deactivated ? 'done.reactivated' : 'done.deactivated'))
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-ds-accent-2-700/30 p-4 sm:p-6">
      <h2 className="text-2xl">{t('danger.title')}</h2>
      <p className="text-ds-neutral-800">{t(deactivated ? 'danger.deactivatedText' : 'danger.activeText')}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => setConfirming(true)}>
          {t(`actions.${action}`)}
        </Button>
        {deactivated && (
          <Button variant="destructive" className="min-h-11" disabled={pending} onClick={() => setDeleting(true)}>
            {t('actions.delete')}
          </Button>
        )}
      </div>
      {!deactivated && <p className="text-[13px] text-ds-neutral-700">{t('danger.deleteHint')}</p>}

      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(false)}
          title={t(`confirm.${action}Title`, { tenant: tenantName })}
          text={t(`confirm.${action}Text`)}
          confirmLabel={t(`actions.${action}`)}
          cancelLabel={t('confirm.cancel')}
          onConfirm={toggle}
        />
      )}
      {deleting && <DeleteDialog tenantId={tenantId} tenantName={tenantName} onClose={() => setDeleting(false)} />}
    </section>
  )
}

// Bestätigung durch Eintippen des Kundennamens; der Knopf bleibt bis zur exakten Übereinstimmung gesperrt
function DeleteDialog({ tenantId, tenantName, onClose }: { tenantId: string; tenantName: string; onClose: () => void }) {
  const t = useTranslations('operator')
  const tErrors = useTranslations('operator.errors') as (key: string) => string
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const matches = deleteConfirmed(typed, tenantName)

  async function onDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!matches || pending) return
    setPending(true)
    const result = await callAction(() => deleteTenant({ tenantId, confirmName: typed.trim() }))
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(tErrors(result.error))
      return
    }
    const left = result.data?.accountsLeft ?? 0
    if (left > 0) toast.warning(t('done.deletedAccountsLeft', { tenant: tenantName, count: left }))
    else toast.success(t('done.deleted', { tenant: tenantName }))
    window.location.href = '/betreiber'
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <form onSubmit={onDelete} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm.deleteTitle', { tenant: tenantName })}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirm.deleteText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="loeschen-name">{t('confirm.deleteLabel', { tenant: tenantName })}</Label>
            <Input
              id="loeschen-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="min-h-11"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={pending}>
              {t('confirm.cancel')}
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" className="min-h-11" disabled={!matches || pending} aria-busy={pending}>
              {t('actions.delete')}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
