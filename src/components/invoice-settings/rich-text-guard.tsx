'use client'

import { createContext, useContext, useEffect, useState, type FormEvent } from 'react'

// Vor dem Speichern fragt ein Formular seine Text-Editoren ab (PROJ-39): Ein offenes Code-Feld, aus dem etwas entfernt
// würde, oder eine ungültige Schriftgröße brechen das Speichern ab. Die Formularprüfung kennt beides nicht, weil im
// Formularwert nur die bereinigte Struktur steht.
type Check = () => boolean
const GuardContext = createContext<Set<Check> | null>(null)

export const RichTextGuardProvider = GuardContext.Provider

export function useRichTextGuard() {
  const [checks] = useState(() => new Set<Check>())
  const guardSubmit = (submit: (event: FormEvent<HTMLFormElement>) => unknown) => (event: FormEvent<HTMLFormElement>) => {
    // Alle Editoren abfragen, damit jeder seinen Hinweis zeigt
    const ok = Array.from(checks).map((check) => check()).every(Boolean)
    if (ok) return submit(event)
    event.preventDefault()
  }
  return { checks, guardSubmit }
}

// Meldet die aktuelle Prüfung eines Editors an; läuft bewusst nach jedem Rendern, damit sie den neuesten Stand kennt
export function useRichTextCheck(check: Check) {
  const checks = useContext(GuardContext)
  useEffect(() => {
    if (!checks) return
    checks.add(check)
    return () => {
      checks.delete(check)
    }
  })
}
