interface PageHeaderProps {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lead?: React.ReactNode
  // Hauptaktion, z. B. „Neue Buchung“: am Desktop rechts, am Handy unter der Überschrift
  action?: React.ReactNode
}

// Seitenkopf wie im Entwurf (Variante „Zeitung“)
export function PageHeader({ eyebrow, title, lead, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
      <div className="flex max-w-[760px] flex-col gap-2">
        {eyebrow && <p className="text-[13px] uppercase tracking-[0.08em] text-ds-neutral-700">{eyebrow}</p>}
        <h1 className="text-[34px] leading-[1.05] tracking-[-0.02em] sm:text-[46px]">{title}</h1>
        {lead && <p className="text-lg leading-[1.4] text-ds-neutral-800 sm:text-xl">{lead}</p>}
      </div>
      {action && <div className="sm:ml-auto">{action}</div>}
    </header>
  )
}
