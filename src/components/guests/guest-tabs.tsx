'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

const TABS = [
  { href: '/gaeste', key: 'guests' },
  { href: '/gaeste/firmen', key: 'companies' },
] as const

// Reiter „Gäste“ | „Firmen“ (PROJ-50) als Links, Bauart wie die Reiter der Einstellungen
export function GuestTabs() {
  const t = useTranslations('companies.tabs')
  const pathname = usePathname()

  return (
    <nav aria-label={t('label')}>
      <ul className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const active = tab.href === '/gaeste/firmen' ? pathname.startsWith(tab.href) : !pathname.startsWith('/gaeste/firmen')
          return (
            <li key={tab.href}>
              <Link
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
