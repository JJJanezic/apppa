import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { GuestSheetBackfillProvider } from '@/components/guest-sheets/guest-sheet-backfill-context'
import { IdReadingProvider } from '@/components/id-reading/id-reading-context'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { BottomNav } from '@/components/shell/bottom-nav'
import { ShellProvider } from '@/components/shell/shell-context'
import { Wordmark } from '@/components/shell/wordmark'
import { SidebarProvider } from '@/components/ui/sidebar'
import { VatStatusProvider } from '@/components/vat/vat-status-context'
import { requireAppUser } from '@/lib/auth/session'
import { isActivePath, isAreaAvailable } from '@/lib/navigation'
import { getBooking } from '@/lib/bookings-data'
import { getCompany } from '@/lib/companies-data'
import { getGuestSheetBackfill } from '@/lib/guest-sheet-numbering-data'
import { getGuest } from '@/lib/guests-data'
import { getIdReadingEnabled } from '@/lib/id-reading-data'
import { getTenantDetail } from '@/lib/operator-data'
import { getShellInfo, viewerOf } from '@/lib/shell'
import { getVatStatusHistory } from '@/lib/vat-status-data'

// Gemeinsamer Rahmen aller App-Seiten: Seitenleiste ab 1024 px, darunter die untere Leiste.
// Prüft die Sitzung auf dem Server (zweite Ebene nach src/proxy.ts) und die Pflicht-2FA des Admins.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAppUser()
  const shell = await getShellInfo()
  // Einstellungen, Ortstaxe (PROJ-16) und Auswertungen (PROJ-18) nur für Inhaber, Betreiber-Bereich nur für den Admin: hier
  // (vor dem Streaming der Seite) prüfen, damit die Antwort 404 lautet
  const path = (await headers()).get('x-pathname') ?? ''
  const viewer = viewerOf(shell)
  if (isActivePath('/einstellungen', path) && !isAreaAvailable('settings', viewer)) notFound()
  if (isActivePath('/betreiber', path) && !isAreaAvailable('operator', viewer)) notFound()
  if (isActivePath('/ortstaxe', path) && !isAreaAvailable('tax', viewer)) notFound()
  if (isActivePath('/auswertungen', path) && !isAreaAvailable('reports', viewer)) notFound()
  // Detailseite eines Kunden: gibt es ihn (noch)? Sonst ebenfalls 404 statt 200 (BUG-2 aus QA PROJ-5).
  // Die Abfrage ist pro Anfrage zwischengespeichert; die Seite nutzt dasselbe Ergebnis.
  const tenantPath = /^\/betreiber\/kunden\/([^/]+)/.exec(path)
  if (tenantPath) await getTenantDetail(tenantPath[1])
  // Gäste (PROJ-7): Dubletten nur für Inhaber; Detailseite nur für bestehende Gäste des Kunden – sonst 404.
  // „/gaeste/firmen“ ist keine Gast-Kennung (BUG-1 aus QA PROJ-50)
  if (isActivePath('/gaeste/dubletten', path)) {
    if (viewer.role !== 'owner') notFound()
  } else if (isActivePath('/gaeste/firmen', path)) {
    // Firmen (PROJ-50): Dubletten nur für Inhaber; Detailseite nur für bestehende Firmen des Kunden – sonst 404
    if (isActivePath('/gaeste/firmen/dubletten', path)) {
      if (viewer.role !== 'owner') notFound()
    } else {
      const companyPath = /^\/gaeste\/firmen\/([^/]+)/.exec(path)
      if (companyPath && isAreaAvailable('guests', viewer)) await getCompany(companyPath[1])
    }
  } else {
    const guestPath = /^\/gaeste\/([^/]+)/.exec(path)
    if (guestPath && isAreaAvailable('guests', viewer)) await getGuest(guestPath[1])
  }
  // Buchungen (PROJ-8): Detailseite nur für bestehende Einträge des Kunden – sonst 404
  const bookingPath = /^\/buchungen\/([^/]+)/.exec(path)
  if (bookingPath && isAreaAvailable('bookings', viewer)) await getBooking(bookingPath[1])
  // Kleinunternehmer-Status für die Umsatzsteuer-Angaben in Buchungen (PROJ-35/36), nur Inhaber
  const [vatStatus, sheetBackfill, idReading] = await Promise.all([
    getVatStatusHistory(),
    // Schalter „Gästeblätter nacherfassen“ für das Feld im Buchungsformular (PROJ-26)
    getGuestSheetBackfill(),
    // „Ausweis auslesen“ im Gastformular (PROJ-51)
    getIdReadingEnabled(),
  ])

  return (
    <ShellProvider value={shell}>
      <VatStatusProvider value={vatStatus}>
        <GuestSheetBackfillProvider value={sheetBackfill}>
          <IdReadingProvider value={idReading}>
            <SidebarProvider
              defaultOpen
              keyboardShortcut={false}
              // Seitenleiste ohne Schublade (unter 1024 px die untere Leiste): keine Handy-Erkennung, siehe sidebar.tsx
              detectMobile={false}
              // Breite wie im Entwurf; SidebarProvider setzt sonst 16rem per Inline-Style
              style={{ '--sidebar-width': '236px' } as React.CSSProperties}
              className="bg-ds-bg"
            >
              <AppSidebar wordmark={<Wordmark />} />
              <main
                id="inhalt"
                className="flex min-w-0 max-w-[1520px] flex-1 flex-col gap-10 px-4 pb-28 pt-8 sm:px-8 lg:gap-[40px] lg:px-10 lg:pb-24 lg:pt-10"
              >
                {children}
              </main>
              <BottomNav />
            </SidebarProvider>
          </IdReadingProvider>
        </GuestSheetBackfillProvider>
      </VatStatusProvider>
    </ShellProvider>
  )
}
