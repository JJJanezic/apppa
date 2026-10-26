'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { DetailPanel } from '@/components/detail-panel'

interface EntryPanelProps {
  // Adresse des Kalenders ohne offenen Eintrag
  closeHref: string
  title: React.ReactNode
  eyebrow?: React.ReactNode
  children: React.ReactNode
}

// Detailpanel im Belegungskalender (PROJ-9). Der Inhalt kommt vom Server (Buchungsdetail aus PROJ-8);
// Schließen entfernt den offenen Eintrag aus der Adresse, Zeitraum, Ansicht und Filter bleiben.
export function EntryPanel({ closeHref, title, eyebrow, children }: EntryPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  function onOpenChange(next: boolean) {
    if (next) return
    setOpen(false)
    router.replace(closeHref, { scroll: false })
  }

  return (
    <DetailPanel open={open} onOpenChange={onOpenChange} title={title} eyebrow={eyebrow}>
      {children}
    </DetailPanel>
  )
}
