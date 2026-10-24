import { describe, expect, it } from 'vitest'

import { isActivePath, isAreaAvailable, mobileNav, NAV_ITEMS, type NavItem, visibleNavItems } from './navigation'

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
      'dashboard', 'calendar', 'bookings', 'guests', 'payments', 'reports', 'tax', 'channels', 'settings',
    ])
  })

  it('zeigt derzeit das Dashboard und für Inhaber die Einstellungen (PROJ-4)', () => {
    expect(visibleNavItems('owner').map((i) => i.id)).toEqual(['dashboard', 'settings'])
    expect(visibleNavItems('staff').map((i) => i.id)).toEqual(['dashboard'])
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
