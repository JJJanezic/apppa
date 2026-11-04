'use client'

import { useEffect, useRef } from 'react'
import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form'

// Eingaben übernehmen, die vor dem Aktivwerden des Formulars gemacht wurden (BUG-4 aus QA PROJ-39). Die Seite kommt fertig
// vom Server, ist aber erst einige hundert Millisekunden später aktiv. Tippt jemand in dieser Zeit, steht der Wert im Feld,
// das Formular kennt ihn aber nicht und rechnet und speichert mit dem alten: beim Rechnungsdatum das falsche Datum.
export function useAdoptEarlyInput<T extends FieldValues>(form: UseFormReturn<T>) {
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!ref.current) return
    for (const field of Array.from(ref.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name], textarea[name]'))) {
      if (['checkbox', 'radio', 'hidden', 'file'].includes(field.type)) continue
      const name = field.name as Path<T>
      const current: unknown = form.getValues(name)
      if (typeof current === 'string' && current !== field.value) {
        form.setValue(name, field.value as PathValue<T, Path<T>>, { shouldDirty: true })
      }
    }
    // Nur einmal: danach läuft jede Eingabe über das Formular
  }, [form])
  return ref
}
