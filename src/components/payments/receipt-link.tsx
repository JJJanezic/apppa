'use client'

import { FileImage, FilePdf } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { openReceipt } from '@/app/(app)/zahlungen/actions'
import { callAction } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'

// Beleg-Symbol in Listen: öffnet den Beleg über einen frischen, kurzlebigen Abruf-Link in einem neuen Fenster
export function ReceiptLink({ paymentId, type }: { paymentId: string; type: 'pdf' | 'image' }) {
  const t = useTranslations('payments.receipt')
  const [pending, setPending] = useState(false)
  const Icon = type === 'pdf' ? FilePdf : FileImage

  async function open() {
    // Fenster sofort öffnen (Safari blockt Fenster nach einer Wartezeit), dann den Link setzen
    const win = window.open('', '_blank')
    if (win) win.opener = null
    setPending(true)
    const result = await callAction(() => openReceipt({ paymentId }))
    setPending(false)
    if (result.ok && result.data) {
      if (win) win.location.href = result.data.url
      else window.location.href = result.data.url
      return
    }
    win?.close()
    if (!result.ok && result.error !== 'sessionExpired') toast.error(t('errors.uploadFailed'))
  }

  return (
    <Button type="button" variant="ghost" size="icon" className="size-11" disabled={pending} aria-label={t('openLabel')} onClick={() => void open()}>
      <Icon size={20} aria-hidden="true" />
    </Button>
  )
}
