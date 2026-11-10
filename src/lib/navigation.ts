// Zentrale Navigationsliste (PROJ-2). Wird ein Feature fertig, hier nur `ready: true` setzen.
// Rollen entsprechen public.member_role (PROJ-1); die endgültige Zuordnung kommt mit PROJ-4.
// Der Betreiber-Bereich (PROJ-5) hängt nicht an der Rolle beim Kunden, sondern am Admin-Kennzeichen.

export type Role = 'owner' | 'staff'

// Wer schaut? Rolle beim gewählten Kunden, ob die Person Betreiber-Admin (mit 2FA) ist und ob sie bei mindestens einem
// aktiven Kunden Inhaber ist (PROJ-18: Auswertungen über alle Inhaber-Kunden)
export type Viewer = { role: Role; isAdmin: boolean; ownsAny?: boolean }

export type NavItemId =
  | 'dashboard'
  | 'bookings'
  | 'guests'
  | 'guestSheets'
  | 'invoices'
  | 'payments'
  | 'reports'
  | 'tax'
  | 'channels'
  | 'settings'
  | 'operator'

export type NavItem = {
  id: NavItemId
  href: string
  roles: readonly Role[]
  // nur für den Betreiber-Admin, unabhängig von der Rolle (PROJ-5)
  adminOnly?: boolean
  // sichtbar, sobald die Person bei irgendeinem Kunden Inhaber ist, nicht nur beim gewählten (PROJ-18)
  anyOwner?: boolean
  ready: boolean
  // Platz am Handy: in der unteren Leiste oder unter „Mehr“
  mobile: 'primary' | 'more'
}

const ALL: readonly Role[] = ['owner', 'staff']
const OWNER: readonly Role[] = ['owner']

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', href: '/', roles: ALL, ready: true, mobile: 'primary' },
  { id: 'bookings', href: '/buchungen', roles: ALL, ready: true, mobile: 'primary' },
  { id: 'guests', href: '/gaeste', roles: ALL, ready: true, mobile: 'primary' },
  // PROJ-26: Gästeblätter für Inhaber und Mitarbeiter; am Handy in der unteren Leiste statt „Belegung“ (PROJ-9 refine 2026-11-10)
  { id: 'guestSheets', href: '/gaesteblaetter', roles: ALL, ready: true, mobile: 'primary' },
  // PROJ-37: Rechnungen für Inhaber und Mitarbeiter, am Handy unter „Mehr“
  { id: 'invoices', href: '/rechnungen', roles: ALL, ready: true, mobile: 'more' },
  // PROJ-45: Zahlungen für Inhaber und Mitarbeiter (Mitarbeiter erfassen Zahlungen), am Handy unter „Mehr“
  { id: 'payments', href: '/zahlungen', roles: ALL, ready: true, mobile: 'more' },
  // PROJ-18: Auswertungen für Inhaber, auch wenn der gewählte Kunde einer ist, bei dem die Person nur Mitarbeiter ist
  // (die Seite zeigt nur Inhaber-Kunden); am Handy unter „Mehr“
  { id: 'reports', href: '/auswertungen', roles: OWNER, anyOwner: true, ready: true, mobile: 'more' },
  { id: 'tax', href: '/ortstaxe', roles: OWNER, ready: true, mobile: 'more' },
  { id: 'channels', href: '/kanaele', roles: OWNER, ready: false, mobile: 'more' },
  { id: 'settings', href: '/einstellungen', roles: OWNER, ready: true, mobile: 'more' },
  { id: 'operator', href: '/betreiber', roles: [], adminOnly: true, ready: true, mobile: 'more' },
]

const MAX_MOBILE_PRIMARY = 4

const viewerOf = (who: Role | Viewer): Viewer => (typeof who === 'string' ? { role: who, isAdmin: false } : who)

export function visibleNavItems(who: Role | Viewer, items: readonly NavItem[] = NAV_ITEMS): NavItem[] {
  const { role, isAdmin, ownsAny } = viewerOf(who)
  return items.filter((item) => item.ready && (item.adminOnly ? isAdmin : item.roles.includes(role) || Boolean(item.anyOwner && ownsAny)))
}

// Untere Leiste am Handy: bis zu 4 Hauptbereiche; alles Weitere landet unter „Mehr“.
export function mobileNav(who: Role | Viewer, items: readonly NavItem[] = NAV_ITEMS) {
  const visible = visibleNavItems(who, items)
  const primary = visible.filter((item) => item.mobile === 'primary').slice(0, MAX_MOBILE_PRIMARY)
  const more = visible.filter((item) => !primary.includes(item))
  return { primary, more }
}

export function isAreaAvailable(id: NavItemId, who: Role | Viewer, items: readonly NavItem[] = NAV_ITEMS): boolean {
  return visibleNavItems(who, items).some((item) => item.id === id)
}

// Aktiver Punkt: exakte Übereinstimmung für „/“, sonst auch Unterseiten (z. B. /buchungen/123)
export function isActivePath(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Zu welchem Bereich gehört eine Adresse? (Unterseiten zählen mit; „/“ allein ist das Dashboard)
export function areaForPath(pathname: string, items: readonly NavItem[] = NAV_ITEMS): NavItem | null {
  return items.find((item) => item.href !== '/' && isActivePath(item.href, pathname)) ?? null
}

// Darf die Person diese Adresse öffnen? Seiten außerhalb der Bereiche (z. B. /konto) immer.
// Für den Rücksprung nach der Anmeldung: Ein gesperrter Bereich führt dann zur Startseite statt zu „Seite nicht gefunden“.
export function isPathAvailable(pathname: string, who: Role | Viewer, items: readonly NavItem[] = NAV_ITEMS): boolean {
  const area = areaForPath(pathname, items)
  return !area || isAreaAvailable(area.id, who, items)
}
