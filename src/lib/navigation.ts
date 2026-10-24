// Zentrale Navigationsliste (PROJ-2). Wird ein Feature fertig, hier nur `ready: true` setzen.
// Rollen entsprechen public.member_role (PROJ-1); die endgültige Zuordnung kommt mit PROJ-4.

export type Role = 'owner' | 'staff'

export type NavItemId =
  | 'dashboard'
  | 'calendar'
  | 'bookings'
  | 'guests'
  | 'payments'
  | 'reports'
  | 'tax'
  | 'channels'
  | 'settings'

export type NavItem = {
  id: NavItemId
  href: string
  roles: readonly Role[]
  ready: boolean
  // Platz am Handy: in der unteren Leiste oder unter „Mehr“
  mobile: 'primary' | 'more'
}

const ALL: readonly Role[] = ['owner', 'staff']
const OWNER: readonly Role[] = ['owner']

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', href: '/', roles: ALL, ready: true, mobile: 'primary' },
  { id: 'calendar', href: '/belegung', roles: ALL, ready: false, mobile: 'primary' },
  { id: 'bookings', href: '/buchungen', roles: ALL, ready: false, mobile: 'primary' },
  { id: 'guests', href: '/gaeste', roles: ALL, ready: false, mobile: 'primary' },
  { id: 'payments', href: '/zahlungen', roles: OWNER, ready: false, mobile: 'more' },
  { id: 'reports', href: '/auswertungen', roles: OWNER, ready: false, mobile: 'more' },
  { id: 'tax', href: '/tourismusabgabe', roles: OWNER, ready: false, mobile: 'more' },
  { id: 'channels', href: '/kanaele', roles: OWNER, ready: false, mobile: 'more' },
  { id: 'settings', href: '/einstellungen', roles: OWNER, ready: true, mobile: 'more' },
]

const MAX_MOBILE_PRIMARY = 4

export function visibleNavItems(role: Role, items: readonly NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => item.ready && item.roles.includes(role))
}

// Untere Leiste am Handy: bis zu 4 Hauptbereiche; alles Weitere landet unter „Mehr“.
export function mobileNav(role: Role, items: readonly NavItem[] = NAV_ITEMS) {
  const visible = visibleNavItems(role, items)
  const primary = visible.filter((item) => item.mobile === 'primary').slice(0, MAX_MOBILE_PRIMARY)
  const more = visible.filter((item) => !primary.includes(item))
  return { primary, more }
}

export function isAreaAvailable(id: NavItemId, role: Role, items: readonly NavItem[] = NAV_ITEMS): boolean {
  return visibleNavItems(role, items).some((item) => item.id === id)
}

// Aktiver Punkt: exakte Übereinstimmung für „/“, sonst auch Unterseiten (z. B. /buchungen/123)
export function isActivePath(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
