'use client'

import { Copy } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  value: string
  // Zugänglicher Name des Knopfs, z. B. „booking.com-Buchungsnummer kopieren“
  label: string
  copiedMessage: string
  // Ohne Zwischenablage-Zugriff (alter Browser, keine sichere Verbindung): Text bleibt markierbar
  failedMessage: string
}

// Kopiert einen Wert in die Zwischenablage und bestätigt kurz (PROJ-47, Plattform-Nummer im Buchungsdetail)
export function CopyButton({ value, label, copiedMessage, failedMessage }: CopyButtonProps) {
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(value)
      toast.success(copiedMessage)
    } catch {
      toast.error(failedMessage)
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon" onClick={copy} aria-label={label} title={label} className="size-11 shrink-0 sm:size-9">
      <Copy size={18} aria-hidden="true" />
    </Button>
  )
}
