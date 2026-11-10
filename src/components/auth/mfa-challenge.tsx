'use client'

import { useTranslations } from 'next-intl'

import { OtpForm } from '@/components/auth/otp-form'
import { Button } from '@/components/ui/button'
import { postAuthStep, requestSignOut } from '@/lib/auth/requests'

export function MfaChallenge({ next }: { next?: string }) {
  const t = useTranslations('auth.mfa')

  async function switchAccount() {
    await requestSignOut()
    window.location.href = '/anmelden'
  }

  return (
    <div className="flex flex-col gap-4">
      <OtpForm
        submitLabel={t('submit')}
        onSubmitCode={(code) => postAuthStep('code', { code, next })}
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
