'use client'

import { forwardRef } from 'react'

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { OTP_LENGTH } from '@/lib/validation/auth'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  onComplete?: () => void
  disabled?: boolean
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

// 6-stellige Code-Eingabe (shadcn Input OTP): nur Ziffern, Einfügen aus der Zwischenablage, Ausfüllen per SMS/Passwortmanager
export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(function OtpInput(props, ref) {
  return (
    <InputOTP
      ref={ref}
      maxLength={OTP_LENGTH}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      containerClassName="justify-start"
      {...props}
    >
      <InputOTPGroup>
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
})
