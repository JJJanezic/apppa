import { NextResponse, type NextRequest } from 'next/server'

import type { ActionResult } from '@/lib/auth/result'
import { clearSessionLimits, getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

// Abmelden (PROJ-3) ohne Server-Aktion: Eine Aktion löscht die Sitzungs-Cookies, Next.js schickt daraufhin in derselben
// Antwort die erneuerte Seite mit, und der anschließende Seitenwechsel zur Anmeldung brach diese Antwort ab. Firefox
// zeigte kurz „Da ist etwas schiefgelaufen“. Hier gibt es nur eine kurze JSON-Antwort; die Oberfläche liest sie ganz
// und wechselt dann mit vollständigem Seitenaufruf (keine App-Daten im Verlauf/Zwischenspeicher).
// Body { alle: true }: auf allen Geräten abmelden (Mein Konto), nur mit bestätigter Sitzung.
// Fremde Seiten können nicht abmelden: Prüfung der Herkunft, Sitzungs-Cookies sind SameSite=Lax.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 })

  const body = (await request.json().catch(() => null)) as { alle?: unknown } | null
  const everywhere = body?.alle === true
  const supabase = await createClient()

  if (everywhere) {
    const user = await getSessionUser()
    if (!user || (await pendingMfaStep(user, supabase))) return respond({ ok: false, error: 'sessionExpired' })
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) return respond({ ok: false, error: 'unknown' })
  } else {
    await supabase.auth.signOut({ scope: 'local' })
  }
  await clearSessionLimits()
  return respond({ ok: true })
}

const respond = (result: ActionResult) => NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
