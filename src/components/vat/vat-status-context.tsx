'use client'

import { createContext, useContext } from 'react'

import type { VatStatusChange } from '@/lib/vat-status'

// Verlauf des Kleinunternehmer-Status (PROJ-36) für die Buchungsansichten (PROJ-35).
// Das App-Layout lädt ihn einmal je Anfrage; für Mitarbeiter und Admin-Ansichten ist er leer.
const VatStatusContext = createContext<VatStatusChange[]>([])

export function VatStatusProvider({ value, children }: { value: VatStatusChange[]; children: React.ReactNode }) {
  return <VatStatusContext.Provider value={value}>{children}</VatStatusContext.Provider>
}

export const useVatStatus = (): VatStatusChange[] => useContext(VatStatusContext)
