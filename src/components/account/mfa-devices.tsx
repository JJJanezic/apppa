'use client'

import { DeviceMobile, Plus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { confirmAddMfaDevice, removeMfaDevice, startAddMfaDevice } from '@/app/(app)/konto/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { MfaEnrollment } from '@/components/auth/mfa-enrollment'
import { DetailPanel } from '@/components/detail-panel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { MfaDevice } from '@/lib/account'
import type { AuthErrorCode } from '@/lib/auth/result'
import { formatDate } from '@/lib/format'

// 2FA-Geräte des Admins: Liste, zweites Gerät hinzufügen, entfernen (letztes Gerät gesperrt)
export function MfaDevices({ devices }: { devices: MfaDevice[] }) {
  const t = useTranslations('account')
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const onlyOne = devices.length <= 1

  async function remove(factorId: string) {
    setError(null)
    const result = await callAction(() => removeMfaDevice({ factorId }))
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t('mfaRemoved'))
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError error={error} />
      <ul className="flex flex-col divide-y rounded-lg bg-ds-surface">
        {devices.map((device, i) => (
          <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <DeviceMobile size={22} weight="duotone" aria-hidden="true" className="text-ds-accent-700" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span>{device.name ?? `${t('mfaDevice')} ${i + 1}`}</span>
              <span className="text-[13px] text-ds-neutral-700">
                {t('mfaAddedOn', { date: formatDate(device.createdAt) })}
              </span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="min-h-11" disabled={onlyOne} aria-describedby={onlyOne ? 'mfa-letztes' : undefined}>
                  {t('mfaRemove')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('mfaRemoveConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('mfaRemoveConfirmText')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-11">{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove(device.id)} className="min-h-11">
                    {t('mfaRemove')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
      {onlyOne && (
        <p id="mfa-letztes" className="text-sm text-ds-neutral-700">
          {t('mfaLastHint')}
        </p>
      )}
      <Button variant="outline" className="min-h-11 self-start" onClick={() => setAdding(true)}>
        <Plus size={18} aria-hidden="true" />
        {t('mfaAdd')}
      </Button>
      <DetailPanel open={adding} onOpenChange={setAdding} title={t('mfaAddTitle')}>
        {adding && (
          <MfaEnrollment
            start={startAddMfaDevice}
            confirm={confirmAddMfaDevice}
            onDone={() => {
              setAdding(false)
              toast.success(t('mfaAdded'))
              router.refresh()
            }}
          />
        )}
      </DetailPanel>
    </div>
  )
}
