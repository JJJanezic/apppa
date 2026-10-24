'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { NavIcon } from '@/components/shell/nav-icon'
import { useShell } from '@/components/shell/shell-context'
import { SyncStatus } from '@/components/shell/sync-status'
import { TenantLabel } from '@/components/shell/tenant-label'
import { UserMenu } from '@/components/shell/user-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { isActivePath, visibleNavItems } from '@/lib/navigation'

interface AppSidebarProps {
  wordmark: React.ReactNode
}

// Seitenleiste ab 1024 px (Tablet quer, Laptop), fest ausgeklappt wie im Entwurf
export function AppSidebar({ wordmark }: AppSidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { person } = useShell()
  const items = visibleNavItems(person)

  return (
    <div className="sticky top-0 hidden h-svh shrink-0 lg:flex">
      <Sidebar collapsible="none" className="gap-6 px-3 py-[30px]">
        <SidebarHeader className="gap-0.5 px-2 py-0">
          <Link href="/" className="w-fit rounded-md">
            {wordmark}
          </Link>
          <TenantLabel />
        </SidebarHeader>

        <SidebarContent>
          <nav aria-label={t('label')}>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const active = isActivePath(item.href, pathname)
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="h-auto gap-2.5 px-2.5 py-2 text-[15px] data-[active=true]:font-semibold [&>svg]:size-[19px]"
                    >
                      <Link href={item.href} aria-current={active ? 'page' : undefined}>
                        <NavIcon id={item.id} />
                        <span>{t(item.id)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </nav>
        </SidebarContent>

        <SidebarFooter className="gap-3 px-2 py-0">
          <UserMenu />
          <SyncStatus />
        </SidebarFooter>
      </Sidebar>
    </div>
  )
}
