'use client'

import { useTranslations } from 'next-intl'

import { signOut, verifyMfa } from '@/app/(auth)/actions'
import { OtpForm } from '@/components/auth/otp-form'
import { Button } from '@/components/ui/button'

export function MfaChallenge({ next }: { next?: string }) {
  const t = useTranslations('auth.mfa')

  async function switchAccount() {
    await signOut().catch(() => undefined)
    window.location.href = '/anmelden'
  }

  return (
    <div className="flex flex-col gap-4">
      <OtpForm
        submitLabel={t('submit')}
        onSubmitCode={(code) => verifyMfa({ code, next })}
        onSuccess={(result) => {
          window.location.href = (result.ok && result.redirectTo) || next || '/'
        }}
      />
      <Button type="button" variant="link" onClick={switchAccount} className="min-h-11 self-start px-0 text-ds-accent-700">
        {t('switchAccount')}
      </Button>
    </div>
  )
}
