'use client'

import {
  Bank,
  Buildings,
  ChartLineUp,
  DotsThreeOutline,
  GearSix,
  Megaphone,
  type Icon,
  Notebook,
  PlugsConnected,
  Receipt,
  Signature,
  SquaresFour,
  UsersThree,
  Wallet,
} from '@phosphor-icons/react'

import type { NavItemId } from '@/lib/navigation'

// Icons wie im Entwurf (Phosphor, Duotone)
const ICONS: Record<NavItemId | 'more', Icon> = {
  dashboard: SquaresFour,
  bookings: Notebook,
  guests: UsersThree,
  guestSheets: Signature,
  invoices: Receipt,
  payments: Wallet,
  reports: ChartLineUp,
  tax: Bank,
  marketing: Megaphone,
  channels: PlugsConnected,
  settings: GearSix,
  operator: Buildings,
  more: DotsThreeOutline,
}

export function NavIcon({ id, size = 19 }: { id: NavItemId | 'more'; size?: number }) {
  const Component = ICONS[id]
  return <Component size={size} weight="duotone" aria-hidden="true" />
}
