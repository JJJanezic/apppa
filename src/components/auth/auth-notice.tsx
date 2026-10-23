// Hinweis nach einer Weiterleitung (z. B. „Du wurdest abgemeldet.“); wird von Screenreadern angesagt
export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-md bg-ds-surface px-4 py-3 text-sm">
      {children}
    </p>
  )
}
