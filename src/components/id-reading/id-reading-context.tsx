'use client'

import { createContext, useContext } from 'react'

// „Ausweis automatisch auslesen“ beim gewählten Kunden eingeschaltet (PROJ-51)? Schaltet der Betreiber. Das App-Layout und
// die Vollbild-Seite des Gästeblatts laden den Schalter einmal je Anfrage.
const IdReadingContext = createContext(false)

export function IdReadingProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <IdReadingContext.Provider value={value}>{children}</IdReadingContext.Provider>
}

export const useIdReadingEnabled = (): boolean => useContext(IdReadingContext)
