'use client'

import {
  Bank,
  Buildings,
  CalendarDots,
  ChartLineUp,
  DotsThreeOutline,
  GearSix,
  type Icon,
  Notebook,
  PlugsConnected,
  SquaresFour,
  UsersThree,
  Wallet,
} from '@phosphor-icons/react'

import type { NavItemId } from '@/lib/navigation'

// Icons wie im Entwurf (Phosphor, Duotone)
const ICONS: Record<NavItemId | 'more', Icon> = {
  dashboard: SquaresFour,
  calendar: CalendarDots,
  bookings: Notebook,
  guests: UsersThree,
  payments: Wallet,
  reports: ChartLineUp,
  tax: Bank,
  channels: PlugsConnected,
  settings: GearSix,
  operator: Buildings,
  more: DotsThreeOutline,
}

export function NavIcon({ id, size = 19 }: { id: NavItemId | 'more'; size?: number }) {
  const Component = ICONS[id]
  return <Component size={size} weight="duotone" aria-hidden="true" />
}
