'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface DetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  // Kleine Zeile über dem Titel, z. B. „Booking.com · #B01-26“
  eyebrow?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  // Escape abfangen, z. B. während eine Position verschoben wird (PROJ-34)
  onEscapeKeyDown?: (event: KeyboardEvent) => void
}

// Detail-Panel wie im Entwurf: fährt von rechts herein (max. 440 px), am Handy bildschirmfüllend.
// Esc (außer bei offener Auswahlliste), Klick außerhalb und „Schließen“ schließen es; der Fokus kehrt zum auslösenden Element zurück.
export function DetailPanel({ open, onOpenChange, title, eyebrow, description, children, onEscapeKeyDown }: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onEscapeKeyDown={(e) => {
          // Offene Auswahlliste eines Kombinationsfelds: Escape schließt nur die Liste, nicht das Panel (PROJ-49)
          if (e.target instanceof Element && e.target.closest('[role="combobox"][aria-expanded="true"]')) e.preventDefault()
          onEscapeKeyDown?.(e)
        }}
        className="flex w-full flex-col gap-6 overflow-y-auto bg-ds-bg p-6 sm:max-w-[440px] [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:p-3.5"
      >
        <SheetHeader className="gap-1 pr-10 text-left">
          {eyebrow && <div className="text-[13px] text-ds-neutral-700">{eyebrow}</div>}
          <SheetTitle className="text-[28px] font-semibold leading-tight">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-base text-ds-neutral-800">{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
