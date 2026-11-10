import type { ActionResult } from '@/lib/auth/result'

// Anmelde-Schritte und Abmelden über Route-Handler statt Server-Aktionen (Gründe in src/app/api/anmeldung/[schritt]/route.ts
// und src/app/api/abmelden/route.ts). Die Antwort ist ganz gelesen, bevor die Oberfläche die Seite wechselt; danach läuft
// keine Anfrage mehr, die der Browser beim Seitenwechsel abbrechen könnte.

export type AuthStep = 'anmelden' | 'code' | 'einrichten' | 'einladung' | 'neues-passwort' | 'link'

async function post<T>(url: string, body: unknown): Promise<ActionResult<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return (await res.json()) as ActionResult<T>
  } catch {
    return { ok: false, error: 'network' }
  }
}

export function postAuthStep<T = undefined>(step: AuthStep, values: object): Promise<ActionResult<T>> {
  return post<T>(`/api/anmeldung/${step}`, values)
}

export function requestSignOut(opts: { everywhere?: boolean } = {}): Promise<ActionResult> {
  return post('/api/abmelden', { alle: opts.everywhere === true })
}
