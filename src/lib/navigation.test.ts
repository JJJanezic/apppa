import { describe, expect, it } from 'vitest'

import {
  areaForPath,
  isActivePath,
  isAreaAvailable,
  isPathAvailable,
  mobileNav,
  NAV_ITEMS,
  type NavItem,
  visibleNavItems,
} from './navigation'

const item = (id: NavItem['id'], over: Partial<NavItem> = {}): NavItem => ({
  id,
  href: `/${id}`,
  roles: ['owner', 'staff'],
  ready: true,
  mobile: 'primary',
  ...over,
})

describe('Navigationsliste', () => {
  it('enthält alle Bereiche aus dem Entwurf in dessen Reihenfolge', () => {
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'dashboard', 'calendar', 'bookings', 'guests', 'payments', 'reports', 'tax', 'channels', 'settings', 'operator',
    ])
  })

  it('zeigt derzeit Dashboard und Gäste (PROJ-7) und für Inhaber die Einstellungen (PROJ-4)', () => {
    expect(visibleNavItems('owner').map((i) => i.id)).toEqual(['dashboard', 'guests', 'settings'])
    expect(visibleNavItems('staff').map((i) => i.id)).toEqual(['dashboard', 'guests'])
  })

  it('zeigt den Betreiber-Bereich nur dem Admin, unabhängig von der Rolle (PROJ-5)', () => {
    expect(visibleNavItems({ role: 'staff', isAdmin: true }).map((i) => i.id)).toEqual(['dashboard', 'guests', 'operator'])
    expect(visibleNavItems({ role: 'owner', isAdmin: true }).map((i) => i.id)).toEqual(['dashboard', 'guests', 'settings', 'operator'])
    expect(visibleNavItems({ role: 'owner', isAdmin: false }).map((i) => i.id)).not.toContain('operator')
    expect(isAreaAvailable('operator', 'owner')).toBe(false)
    expect(isAreaAvailable('operator', { role: 'staff', isAdmin: true })).toBe(true)
  })

  it('blendet nicht fertige Bereiche aus', () => {
    const items = [item('dashboard'), item('calendar', { ready: false })]
    expect(visibleNavItems('owner', items).map((i) => i.id)).toEqual(['dashboard'])
  })

  it('filtert nach Rolle', () => {
    const items = [item('dashboard'), item('payments', { roles: ['owner'] })]
    expect(visibleNavItems('owner', items).map((i) => i.id)).toEqual(['dashboard', 'payments'])
    expect(visibleNavItems('staff', items).map((i) => i.id)).toEqual(['dashboard'])
  })

  it('Zahlungen und Auswertungen sind nur für Inhaber vorgesehen', () => {
    const allReady = NAV_ITEMS.map((i) => ({ ...i, ready: true }))
    const staff = visibleNavItems('staff', allReady).map((i) => i.id)
    expect(staff).not.toContain('payments')
    expect(staff).not.toContain('reports')
  })
})

describe('Handy-Navigation', () => {
  it('nimmt höchstens 4 Hauptbereiche in die untere Leiste, der Rest kommt unter „Mehr“', () => {
    const items = [
      item('dashboard'), item('calendar'), item('bookings'), item('guests'), item('payments'),
      item('settings', { mobile: 'more' }),
    ]
    const { primary, more } = mobileNav('owner', items)
    expect(primary.map((i) => i.id)).toEqual(['dashboard', 'calendar', 'bookings', 'guests'])
    expect(more.map((i) => i.id)).toEqual(['payments', 'settings'])
  })

  it('lässt keine leeren Plätze, wenn weniger Bereiche freigegeben sind', () => {
    const items = [item('dashboard'), item('calendar', { ready: false }), item('tax', { mobile: 'more' })]
    const { primary, more } = mobileNav('owner', items)
    expect(primary.map((i) => i.id)).toEqual(['dashboard'])
    expect(more.map((i) => i.id)).toEqual(['tax'])
  })

  it('entspricht mit allen fertigen Bereichen dem Entwurf', () => {
    const allReady = NAV_ITEMS.map((i) => ({ ...i, ready: true }))
    const { primary, more } = mobileNav('owner', allReady)
    expect(primary.map((i) => i.id)).toEqual(['dashboard', 'calendar', 'bookings', 'guests'])
    expect(more.map((i) => i.id)).toEqual(['payments', 'reports', 'tax', 'channels', 'settings'])
    expect(mobileNav({ role: 'owner', isAdmin: true }, allReady).more.map((i) => i.id)).toContain('operator')
  })
})

describe('Erreichbarkeit und aktiver Punkt', () => {
  it('nicht fertige Bereiche sind nicht erreichbar', () => {
    expect(isAreaAvailable('dashboard', 'owner')).toBe(true)
    expect(isAreaAvailable('bookings', 'owner')).toBe(false)
  })

  it('erkennt den aktiven Bereich inklusive Unterseiten', () => {
    expect(isActivePath('/', '/')).toBe(true)
    expect(isActivePath('/', '/buchungen')).toBe(false)
    expect(isActivePath('/buchungen', '/buchungen')).toBe(true)
    expect(isActivePath('/buchungen', '/buchungen/123')).toBe(true)
    expect(isActivePath('/buchungen', '/buchungenarchiv')).toBe(false)
  })
})

describe('Rücksprung-Ziele nach der Anmeldung', () => {
  it('ordnet Adressen samt Unterseiten einem Bereich zu', () => {
    expect(areaForPath('/einstellungen/team')?.id).toBe('settings')
    expect(areaForPath('/betreiber/kunden/123')?.id).toBe('operator')
    expect(areaForPath('/konto')).toBeNull()
    expect(areaForPath('/')).toBeNull()
  })

  it('gesperrte Bereiche sind kein Ziel, Seiten außerhalb der Bereiche schon', () => {
    const admin = { role: 'staff', isAdmin: true } as const
    expect(isPathAvailable('/einstellungen', admin)).toBe(false)
    expect(isPathAvailable('/betreiber', admin)).toBe(true)
    expect(isPathAvailable('/einstellungen/team', 'owner')).toBe(true)
    expect(isPathAvailable('/betreiber', 'owner')).toBe(false)
    expect(isPathAvailable('/buchungen', 'owner')).toBe(false)
    expect(isPathAvailable('/konto', 'staff')).toBe(true)
  })
})
