'use client'

import { Copy } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { callAction, FormError } from '@/components/auth/form-error'
import { OtpForm } from '@/components/auth/otp-form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActionResult, AuthErrorCode } from '@/lib/auth/result'

type Enrollment = { factorId: string; qrCode: string; secret: string }

interface MfaEnrollmentProps {
  start: () => Promise<ActionResult<Enrollment>>
  confirm: (values: { factorId: string; code: string }) => Promise<ActionResult>
  onDone: (result: ActionResult) => void
}

// Einrichtung eines Authenticator-Geräts: QR-Code, Schlüssel zum Abtippen, erster Code
// (Pflicht-Einrichtung des Admins und „Gerät hinzufügen“ unter Mein Konto)
export function MfaEnrollment({ start, confirm, onDone }: MfaEnrollmentProps) {
  const t = useTranslations('auth.mfaSetup')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [error, setError] = useState<AuthErrorCode | null>(null)

  useEffect(() => {
    let active = true
    callAction(start).then((result) => {
      if (!active) return
      if (result.ok && result.data) setEnrollment(result.data)
      else setError(result.ok ? 'unknown' : result.error)
    })
    return () => {
      active = false
    }
  }, [start])

  async function copySecret() {
    if (!enrollment) return
    await navigator.clipboard.writeText(enrollment.secret)
    toast.success(t('copied'))
  }

  if (error) return <FormError error={error} />

  if (!enrollment) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{t('loading')}</span>
        <Skeleton className="size-48 bg-ds-neutral-200" />
        <Skeleton className="h-5 w-64 bg-ds-neutral-200" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* QR-Code kommt fertig als SVG von Supabase */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enrollment.qrCode} alt={t('qrAlt')} width={192} height={192} className="size-48 rounded-md bg-white p-2" />
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ds-neutral-700">{t('secretLabel')}</p>
        <div className="flex items-center gap-2">
          <code className="break-all rounded-md bg-ds-surface px-3 py-2 font-mono text-sm tracking-wider">{enrollment.secret}</code>
          <Button type="button" variant="ghost" size="icon" onClick={copySecret} aria-label={t('copy')} className="size-11 shrink-0">
            <Copy size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p>{t('step2')}</p>
      <OtpForm
        submitLabel={t('submit')}
        onSubmitCode={(code) => confirm({ factorId: enrollment.factorId, code })}
        onSuccess={onDone}
      />
    </div>
  )
}
