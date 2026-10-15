interface AuthCardProps {
  title: string
  intro?: React.ReactNode
  children: React.ReactNode
}

// Inhalt einer Anmelde-Seite: Überschrift, Einleitung, Formular (Rahmen in src/app/(auth)/layout.tsx)
export function AuthCard({ title, intro, children }: AuthCardProps) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] leading-tight">{title}</h1>
        {intro && <p className="text-ds-neutral-800">{intro}</p>}
      </header>
      {children}
    </section>
  )
}
