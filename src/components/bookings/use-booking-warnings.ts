'use client'

import { useEffect, useState } from 'react'

import { checkBookingWarnings } from '@/app/(app)/buchungen/actions'
import { callAction } from '@/components/auth/form-error'
import { type BookingWarnings, isIsoDate } from '@/lib/bookings'

const DELAY_MS = 300

type Query = { id: string | null; apartmentId: string; arrival: string; departure: string; persons: number }

// Vorschau der Konflikt- und Kapazitätsprüfung im Formular (Tech Design D). Verbindlich prüft erst das Speichern.
// Liefert null, solange Wohnung oder Zeitraum fehlen. `version` ändert sich mit jeder neuen Prüfung,
// damit eine Bestätigung „Trotzdem speichern“ nur für die gezeigten Warnungen gilt.
export function useBookingWarnings({ id, apartmentId, arrival, departure, persons }: Query) {
  const complete = apartmentId !== '' && isIsoDate(arrival) && isIsoDate(departure) && arrival < departure
  const queryKey = complete ? JSON.stringify([apartmentId, arrival, departure, persons]) : null
  const [result, setResult] = useState<{ key: string; warnings: BookingWarnings } | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!queryKey) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await callAction(() => checkBookingWarnings({ id, apartmentId, arrival, departure, persons }))
      if (!cancelled && res.ok && res.data) setResult({ key: queryKey, warnings: res.data })
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [queryKey, id, apartmentId, arrival, departure, persons, refresh])

  const warnings = queryKey && result?.key === queryKey ? result.warnings : null
  return { warnings, version: result ? `${result.key}:${refresh}` : '', recheck: () => setRefresh((n) => n + 1) }
}
