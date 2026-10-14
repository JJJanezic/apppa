'use client'

import { CaretUpDown, SignOut, UserCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useShell } from '@/components/shell/shell-context'

// Name · Rolle mit Benutzermenü. „Mein Konto“ und „Abmelden“ werden mit PROJ-3 aktiv.
export function UserMenu({ side = 'top' }: { side?: 'top' | 'bottom' }) {
  const t = useTranslations('shell')
  const tRoles = useTranslations('roles')
  const { person } = useShell()
  const label = `${person.name ?? t('personPlaceholder')} · ${tRoles(person.role)}`

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
        <DropdownMenuLabel className="font-normal text-ds-neutral-700">{t('comingWithLogin')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserCircle size={18} weight="duotone" aria-hidden="true" />
          {t('myAccount')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <SignOut size={18} weight="duotone" aria-hidden="true" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
