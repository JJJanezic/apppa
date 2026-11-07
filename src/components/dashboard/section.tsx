import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { SectionRetry } from './section-retry'

interface DashboardSectionProps {
  id: string
  title: string
  // Rechts neben der Überschrift, z. B. Summe oder Anzahl
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}

// Abschnitt der rechten Spalte wie im Entwurf: Überschrift (22 px), Inhalt darunter
export function DashboardSection({ id, title, aside, className, children }: DashboardSectionProps) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex items-baseline gap-2">
        <h2 id={id} className="text-[22px]">
          {title}
        </h2>
        {aside && <span className="ml-auto tabular-nums">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

// Platzhalter beim Laden
export function SectionSkeleton({ title, rows = 3 }: { title: string; rows?: number }) {
  return (
    <section aria-busy="true" className="flex flex-col gap-3">
      <h2 className="text-[22px]">{title}</h2>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </section>
  )
}

// Fehler nur in diesem Abschnitt, der Rest bleibt nutzbar; „noch nicht verfügbar“ ohne Migration
export function SectionProblem({ text, retry }: { text: string; retry?: boolean }) {
  return (
    <div role={retry ? 'alert' : undefined} className="flex flex-col items-start gap-2 rounded-lg bg-ds-surface p-4">
      <p className="text-sm text-ds-neutral-800">{text}</p>
      {retry && <SectionRetry />}
    </div>
  )
}

// Leertext
export function SectionEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ds-neutral-700">{children}</p>
}
