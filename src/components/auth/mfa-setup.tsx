'use client'

import { confirmMfaEnrollment, startMfaEnrollment } from '@/app/(auth)/actions'
import { MfaEnrollment } from '@/components/auth/mfa-enrollment'

export function MfaSetup() {
  return (
    <MfaEnrollment
      start={startMfaEnrollment}
      confirm={confirmMfaEnrollment}
      onDone={(result) => {
        window.location.href = (result.ok && result.redirectTo) || '/'
      }}
    />
  )
}
