'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

const TABS = [
  { href: '/einstellungen/stammdaten', key: 'tenant' },
  { href: '/einstellungen/team', key: 'team' },
  { href: '/einstellungen/wohnungen', key: 'apartments' },
] as const

// Reiter der Einstellungen als Links (eigene Adressen, Zurück-Taste funktioniert)
export function SettingsTabs() {
  const t = useTranslations('settings')
  const pathname = usePathname()

  return (
    <nav aria-label={t('tabsLabel')} className="border-b">
      <ul className="flex gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex min-h-11 items-center border-b-2 border-transparent px-3 text-[15px] text-ds-neutral-800 hover:text-ds-accent-700',
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
