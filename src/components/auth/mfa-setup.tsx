'use client'

import { startMfaEnrollment } from '@/app/(auth)/actions'
import { MfaEnrollment } from '@/components/auth/mfa-enrollment'
import { postAuthStep } from '@/lib/auth/requests'

export function MfaSetup() {
  return (
    <MfaEnrollment
      start={startMfaEnrollment}
      confirm={(values) => postAuthStep('einrichten', values)}
      onDone={(result) => {
        window.location.href = (result.ok && result.redirectTo) || '/'
      }}
    />
  )
}
