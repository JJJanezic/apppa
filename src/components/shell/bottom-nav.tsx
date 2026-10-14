'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { NavIcon } from '@/components/shell/nav-icon'
import { useShell } from '@/components/shell/shell-context'
import { SyncStatus } from '@/components/shell/sync-status'
import { TenantLabel } from '@/components/shell/tenant-label'
import { UserMenu } from '@/components/shell/user-menu'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { isActivePath, mobileNav } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const itemClass =
  'flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[12px] leading-tight text-ds-text hover:text-ds-accent-700'
const activeClass = 'font-semibold text-ds-accent-700'

// Untere Leiste für Handy und Tablet hochkant (unter 1024 px)
export function BottomNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { person } = useShell()
  const { primary, more } = mobileNav(person.role)
  const [open, setOpen] = useState(false)
  const moreActive = more.some((item) => isActivePath(item.href, pathname))

  return (
    <nav
      aria-label={t('mobileLabel')}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-ds-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch gap-1 px-2">
        {primary.map((item) => {
          const active = isActivePath(item.href, pathname)
          return (
            <li key={item.id} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(itemClass, active && activeClass)}
              >
                <NavIcon id={item.id} size={22} />
                <span className="max-w-full truncate">{t(item.id)}</span>
              </Link>
            </li>
          )
        })}
        {/* „Mehr“ immer anzeigen: dort liegen auch Kunde, Benutzermenü (Abmelden) und Sync-Status */}
        <li className="flex flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className={cn(itemClass, 'h-auto', moreActive && activeClass)}>
                <NavIcon id="more" size={22} />
                <span>{t('more')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85svh] overflow-y-auto rounded-t-lg bg-ds-bg pb-[calc(1.5rem+env(safe-area-inset-bottom))] [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:p-3"
            >
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl">{t('moreTitle')}</SheetTitle>
                <SheetDescription className="sr-only">{t('moreTitle')}</SheetDescription>
              </SheetHeader>
              {more.length > 0 && (
                <ul className="mt-4 flex flex-col gap-0.5">
                  {more.map((item) => {
                    const active = isActivePath(item.href, pathname)
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-[15px] hover:text-ds-accent-700',
                            active && 'bg-ds-surface font-semibold text-ds-accent-700'
                          )}
                        >
                          <NavIcon id={item.id} />
                          {t(item.id)}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="mt-6 flex flex-col gap-3 border-t pt-4">
                <TenantLabel />
                <UserMenu side="top" />
                <SyncStatus />
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  )
}
