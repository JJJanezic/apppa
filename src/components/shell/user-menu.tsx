'use client'

import { CaretUpDown, SignOut, UserCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { signOut } from '@/app/(auth)/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useShell } from '@/components/shell/shell-context'

// Name · Rolle mit Benutzermenü: „Mein Konto“ und „Abmelden“ (PROJ-3)
export function UserMenu({ side = 'top' }: { side?: 'top' | 'bottom' }) {
  const t = useTranslations('shell')
  const tRoles = useTranslations('roles')
  const { person, tenant } = useShell()
  // Ohne eigenen Kunden hat der Admin keine Kunden-Rolle: „Betreiber“ statt „Mitarbeiter“ (PROJ-5)
  const role = !tenant.id && person.isAdmin ? t('operator') : tRoles(person.role)
  const label = `${person.name ?? t('personPlaceholder')} · ${role}`

  async function handleSignOut() {
    await signOut().catch(() => undefined)
    // Vollständiger Seitenwechsel: keine App-Daten im Verlauf/Zwischenspeicher
    window.location.href = '/anmelden?grund=abgemeldet'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t('userMenu')}: ${label}`}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md text-left text-[13px] text-ds-neutral-700 hover:text-ds-accent-700"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <CaretUpDown size={14} aria-hidden="true" className="shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="w-56">
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/konto">
            <UserCircle size={18} weight="duotone" aria-hidden="true" />
            {t('myAccount')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} className="min-h-11">
          <SignOut size={18} weight="duotone" aria-hidden="true" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
