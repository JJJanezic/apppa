'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

const TABS = [
  { href: '/einstellungen/stammdaten', key: 'tenant' },
  { href: '/einstellungen/team', key: 'team' },
  { href: '/einstellungen/wohnungen', key: 'apartments' },
  { href: '/einstellungen/briefpapier', key: 'letterhead' },
  { href: '/einstellungen/rechnungen', key: 'invoices' },
  { href: '/einstellungen/zahlungen', key: 'payments' },
] as const

// Reiter der Einstellungen als Links (eigene Adressen, Zurück-Taste funktioniert).
// Am Handy passen die Reiter nicht nebeneinander (PROJ-39): Die Leiste lässt sich seitlich wischen, die Seite selbst
// scrollt nicht, und der aktive Reiter wird ins Bild geholt.
export function SettingsTabs() {
  const t = useTranslations('settings')
  const pathname = usePathname()
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <nav aria-label={t('tabsLabel')} className="overflow-x-auto [scrollbar-width:none]">
      {/* Linie an der Liste statt an der Leiste: sonst schneidet das Wischen die Markierung des aktiven Reiters ab */}
      <ul className="flex w-max min-w-full gap-1 border-b">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <li key={tab.href}>
              <Link
                ref={active ? activeRef : undefined}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-[15px] text-ds-neutral-800 hover:text-ds-accent-700',
                  active && 'border-ds-accent-700 font-semibold text-ds-accent-700'
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
