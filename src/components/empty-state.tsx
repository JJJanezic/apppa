import type { Icon } from '@phosphor-icons/react'

interface EmptyStateProps {
  icon?: Icon
  title: string
  text?: string
  action?: React.ReactNode
}

// Leerzustand: Symbol, Satz, optional Erklärung und Aktion
export function EmptyState({ icon: IconComponent, title, text, action }: EmptyStateProps) {
  return (
    <section className="flex max-w-xl flex-col items-start gap-3 rounded-lg bg-ds-surface p-6 sm:p-8">
      {IconComponent && <IconComponent size={32} weight="duotone" aria-hidden="true" className="text-ds-accent-700" />}
      <h2 className="text-2xl">{title}</h2>
      {text && <p className="text-ds-neutral-800">{text}</p>}
      {action}
    </section>
  )
}
