// Liefert ein Weiterleitungsziel, das garantiert innerhalb der App bleibt (kein Open Redirect).
// Statt Zeichenketten zu vergleichen, wird das Ziel wie im Browser aufgelöst und der Ursprung
// geprüft: Browser behandeln z. B. „/\evil.com“ wie „//evil.com“.
export function safeRedirectPath(next: string | null | undefined, origin: string, fallback = '/'): string {
  if (!next || !next.startsWith('/') || /[\\\u0000-\u001f]/.test(next)) return fallback

  let target: URL
  try {
    target = new URL(next, origin)
  } catch {
    return fallback
  }
  if (target.origin !== new URL(origin).origin) return fallback

  // Punkt-Segmente werden erst beim Auflösen entfernt: „/.//evil.com“ wird zu „//evil.com“,
  // was beim späteren erneuten Auflösen wieder eine fremde Adresse ergäbe.
  const path = `${target.pathname}${target.search}${target.hash}`
  if (path.startsWith('//')) return fallback

  return path
}
