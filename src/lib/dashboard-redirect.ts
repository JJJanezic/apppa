import 'server-only'

import { isPathAvailable } from '@/lib/navigation'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { type ShellInfo, viewerOf } from '@/lib/shell'
import { getMyInvitations } from '@/lib/team-data'

// Weiterleitungen des Dashboards („/“): Rücksprung-Ziel ?weiter=… nach der Anmeldung, wenn der Bereich erreichbar ist;
// Admin ohne eigenen Kunden → Betreiber-Bereich (PROJ-5), aber nicht, solange eine Einladung an ihn offen ist, sonst
// könnte er sie nie annehmen (sie erscheint nur hier).
// Zweimal geprüft: im App-Rahmen nur beim vollständigen Seitenaufruf (vor dem Streaming, echte Weiterleitung) und in der
// Seite bei Wechsel und Aktualisierung innerhalb der App. Aus der Seite allein kam die Weiterleitung
// beim Seitenaufruf erst nach dem Ladezustand (loading.tsx); Next.js leitete dann doppelt weiter (Router und
// meta refresh), und Firefox zeigte kurz „Da ist etwas schiefgelaufen“.
export async function dashboardRedirect(shell: ShellInfo, weiter: string | string[] | null | undefined): Promise<string | null> {
  const target = safeRedirectPath(Array.isArray(weiter) ? weiter[0] : (weiter ?? undefined), 'https://app.local')
  if (target !== '/' && isPathAvailable(new URL(target, 'https://app.local').pathname, viewerOf(shell))) return target
  const noTenant = shell.tenant.list !== null && shell.tenant.list.length === 0
  if (noTenant && shell.person.isAdmin && (await getMyInvitations()).length === 0) return '/betreiber'
  return null
}
