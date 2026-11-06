import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BookingWarnings } from '@/lib/bookings'

// PROJ-47: Hinweis „Plattform-Nummer schon vorhanden“ in der Live-Prüfung des Buchungsformulars
const check = vi.fn()
vi.mock('@/app/(app)/buchungen/actions', () => ({ checkBookingWarnings: (...args: unknown[]) => check(...args) }))
vi.mock('@/components/auth/form-error', () => ({ callAction: (fn: () => unknown) => fn() }))

const { useBookingWarnings } = await import('./use-booking-warnings')

const DUPLICATE: BookingWarnings['platformNumberDuplicate'] = {
  first: { id: 'b1', kind: 'booking', number: '2026-0001', apartmentLabel: 'Haus · Top 1', arrival: '2026-12-01', departure: '2026-12-03', cancelled: false },
  more: 0,
}
const result = (duplicate: BookingWarnings['platformNumberDuplicate']): BookingWarnings => ({
  conflicts: [{ id: 'c1', kind: 'booking', number: '2026-0002', guestName: null, blockReason: null, arrival: '2026-12-01', departure: '2026-12-02' }],
  overCapacity: null,
  guestSheetDuplicates: [],
  platformNumberDuplicate: duplicate,
})
const base = { id: null, apartmentId: 'a1', arrival: '2026-12-01', departure: '2026-12-03', persons: 2, adults: 2 }

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400)
  })
}

describe('useBookingWarnings – Plattform-Nummer (PROJ-47)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    check.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('schickt Quelle und bereinigte Nummer nur bei booking.com/Airbnb', async () => {
    check.mockResolvedValue({ ok: true, data: result(null) })
    const { rerender } = renderHook((p: { source: string; platformNumber: string }) => useBookingWarnings({ ...base, ...p }), {
      initialProps: { source: 'booking_com', platformNumber: ' 4123 456 ' },
    })
    await settle()
    expect(check).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'booking_com', platformNumber: '4123456' }))

    rerender({ source: 'website', platformNumber: '4123456' })
    await settle()
    expect(check).toHaveBeenLastCalledWith(expect.objectContaining({ source: null, platformNumber: null }))

    // Zu lang: keine Prüfung der Nummer (das Formular meldet den Fehler)
    rerender({ source: 'airbnb', platformNumber: 'x'.repeat(31) })
    await settle()
    expect(check).toHaveBeenLastCalledWith(expect.objectContaining({ source: null, platformNumber: null }))
  })

  it('Tippen in der Nummer lässt übrige Warnungen und die Bestätigungs-Version stehen; Hinweis nur für die gezeigte Nummer', async () => {
    check.mockResolvedValueOnce({ ok: true, data: result(DUPLICATE) })
    const { result: hook, rerender } = renderHook((p: { platformNumber: string }) => useBookingWarnings({ ...base, source: 'airbnb', ...p }), {
      initialProps: { platformNumber: 'HM1' },
    })
    await settle()
    expect(hook.current.warnings?.platformNumberDuplicate).toEqual(DUPLICATE)
    const version = hook.current.version

    // Neue Nummer: bis zur Antwort Überschneidung weiter sichtbar, Hinweis weg, Version unverändert
    let resolve: (v: unknown) => void = () => {}
    check.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    rerender({ platformNumber: 'HM2' })
    expect(hook.current.warnings?.conflicts).toHaveLength(1)
    expect(hook.current.warnings?.platformNumberDuplicate).toBeNull()
    expect(hook.current.version).toBe(version)

    await settle()
    await act(async () => resolve({ ok: true, data: result(null) }))
    expect(hook.current.warnings?.platformNumberDuplicate).toBeNull()
    expect(hook.current.version).toBe(version)
  })
})
