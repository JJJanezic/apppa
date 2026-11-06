'use client'

import { useEffect, useState } from 'react'

import { checkBookingWarnings } from '@/app/(app)/buchungen/actions'
import { callAction } from '@/components/auth/form-error'
import { type BookingWarnings, guestSheetKey, isIsoDate, isPlatformSource, LIMITS, normalizePlatformNumber, platformNumberKey } from '@/lib/bookings'

const DELAY_MS = 300

type Query = {
  id: string | null
  apartmentId: string
  arrival: string
  departure: string
  persons: number
  adults: number
  // PROJ-30: Gästeblattnummer für die Doppelungswarnung (Sperren: keine)
  guestSheetNumber?: string
  // PROJ-47: Quelle und Plattform-Nummer für den Hinweis „Nummer schon vergeben“ (Sperren: keine)
  source?: string
  platformNumber?: string
}

// Vorschau der Konflikt- und Kapazitätsprüfung im Formular (Tech Design D). Verbindlich prüft erst das Speichern.
// Liefert null, solange Wohnung oder Zeitraum fehlen. `version` ändert sich mit jeder neuen Prüfung,
// damit eine Bestätigung „Trotzdem speichern“ nur für die gezeigten Warnungen gilt.
// Die Plattform-Nummer (PROJ-47) ist nur ein Hinweis: Tippen dort lässt Warnungen und Bestätigungen stehen.
export function useBookingWarnings({ id, apartmentId, arrival, departure, persons, adults, guestSheetNumber = '', source = '', platformNumber = '' }: Query) {
  const complete = apartmentId !== '' && isIsoDate(arrival) && isIsoDate(departure) && arrival < departure
  // Zu lange Nummern prüft erst das Formular; Groß/Klein und Rand-Leerzeichen zählen nicht
  const sheet = guestSheetNumber.trim().length <= LIMITS.guestSheetNumberMax ? guestSheetNumber.trim() : ''
  const queryKey = complete ? JSON.stringify([apartmentId, arrival, departure, persons, adults, guestSheetKey(sheet)]) : null
  // Ungültige oder zu lange Nummern prüft erst das Formular
  const number = isPlatformSource(source) ? normalizePlatformNumber(platformNumber) : ''
  const platformSource = number && number.length <= LIMITS.platformNumberMax ? source : null
  const platformValue = platformSource ? number : ''
  const platformKey = platformSource ? JSON.stringify([platformSource, platformNumberKey(platformValue)]) : ''
  const [result, setResult] = useState<{ key: string; platformKey: string; warnings: BookingWarnings } | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!queryKey) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await callAction(() =>
        checkBookingWarnings({
          id,
          apartmentId,
          arrival,
          departure,
          persons,
          adults,
          guestSheetNumber: sheet || null,
          source: platformSource,
          platformNumber: platformValue || null,
        })
      )
      if (!cancelled && res.ok && res.data) setResult({ key: queryKey, platformKey, warnings: res.data })
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [queryKey, platformKey, platformSource, platformValue, id, apartmentId, arrival, departure, persons, adults, sheet, refresh])

  // Bis die neue Antwort da ist, bleiben die übrigen Warnungen stehen; der Hinweis gilt nur für die gezeigte Nummer
  const current = queryKey && result?.key === queryKey ? result : null
  const warnings = current
    ? { ...current.warnings, platformNumberDuplicate: platformKey && current.platformKey === platformKey ? current.warnings.platformNumberDuplicate : null }
    : null
  return { warnings, version: result ? `${result.key}:${refresh}` : '', recheck: () => setRefresh((n) => n + 1) }
}
