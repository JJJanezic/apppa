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
}

// Detail-Panel wie im Entwurf: fährt von rechts herein (max. 440 px), am Handy bildschirmfüllend.
// Esc, Klick außerhalb und „Schließen“ schließen es; der Fokus kehrt zum auslösenden Element zurück.
export function DetailPanel({ open, onOpenChange, title, eyebrow, description, children }: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-6 overflow-y-auto bg-ds-bg p-6 sm:max-w-[440px] [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:p-3"
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
