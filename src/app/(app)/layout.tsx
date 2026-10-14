import { AppSidebar } from '@/components/shell/app-sidebar'
import { BottomNav } from '@/components/shell/bottom-nav'
import { ShellProvider } from '@/components/shell/shell-context'
import { Wordmark } from '@/components/shell/wordmark'
import { SidebarProvider } from '@/components/ui/sidebar'
import { getShellInfo } from '@/lib/shell'

// Gemeinsamer Rahmen aller App-Seiten: Seitenleiste ab 1024 px, darunter die untere Leiste
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const shell = await getShellInfo()

  return (
    <ShellProvider value={shell}>
      <SidebarProvider defaultOpen className="bg-ds-bg">
        <AppSidebar wordmark={<Wordmark />} />
        <main
          id="inhalt"
          className="flex min-w-0 max-w-[1520px] flex-1 flex-col gap-10 px-4 pb-28 pt-8 sm:px-8 lg:gap-[40px] lg:px-10 lg:pb-24 lg:pt-10"
        >
          {children}
        </main>
        <BottomNav />
      </SidebarProvider>
    </ShellProvider>
  )
}
