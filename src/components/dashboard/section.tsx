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

// Abschnitt unter der Belegung: Überschrift (22 px), Inhalt darunter; als Fläche abgesetzt (PROJ-14, Wunsch Nutzer)
export function DashboardSection({ id, title, aside, className, children }: DashboardSectionProps) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-3 rounded-lg bg-ds-surface p-4 sm:p-5', className)}>
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
export function SectionSkeleton({ title, rows = 3, className }: { title: string; rows?: number; className?: string }) {
  return (
    <section aria-busy="true" className={cn('flex flex-col gap-3 rounded-lg bg-ds-surface p-4 sm:p-5', className)}>
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
    <div role={retry ? 'alert' : undefined} className="flex flex-col items-start gap-2 rounded-lg bg-ds-bg p-4">
      <p className="text-sm text-ds-neutral-800">{text}</p>
      {retry && <SectionRetry />}
    </div>
  )
}

// Leertext
export function SectionEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ds-neutral-700">{children}</p>
}
