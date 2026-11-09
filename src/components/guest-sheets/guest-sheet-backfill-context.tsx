'use client'

import { createContext, useContext } from 'react'

// Schalter „Gästeblätter nacherfassen“ des gewählten Kunden (PROJ-26, Erweiterung 2026-11-09) für das Buchungsformular:
// nur eingeschaltet gibt es das Feld „Gästeblattnummer“. Das App-Layout lädt ihn einmal je Anfrage.
const GuestSheetBackfillContext = createContext(false)

export function GuestSheetBackfillProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <GuestSheetBackfillContext.Provider value={value}>{children}</GuestSheetBackfillContext.Provider>
}

export const useGuestSheetBackfill = (): boolean => useContext(GuestSheetBackfillContext)
