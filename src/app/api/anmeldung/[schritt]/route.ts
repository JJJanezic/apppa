import { NextResponse, type NextRequest } from 'next/server'

import {
  completeInvite,
  confirmEmailLink,
  confirmMfaEnrollment,
  setNewPassword,
  signIn,
  verifyMfa,
} from '@/app/(auth)/actions'
import type { ActionResult } from '@/lib/auth/result'

// Anmelde-Schritte mit Seitenwechsel (PROJ-3) ohne Server-Aktion. Als Server-Aktion setzten sie die Sitzungs-Cookies, Next.js
// schickte daraufhin in derselben Antwort die erneuerte Seite mit, und der Seitenwechsel im Browser brach diese Antwort ab:
// Firefox zeigte kurz „Da ist etwas schiefgelaufen“. redirect() in der Aktion vermeidet das, Next.js verwirft solche
// Weiterleitungen aber gelegentlich (BUG-5 aus PROJ-15); beim Anmelden soll es keine Wartezeit geben.
// Hier gibt es nur eine kurze JSON-Antwort mit dem Ziel; die Oberfläche liest sie ganz und wechselt dann mit vollständigem
// Seitenaufruf, damit die neue Sitzung überall gilt (wie src/app/kunde-wechseln/route.ts und src/app/api/abmelden/route.ts).
// Die Schritte prüfen ihre Eingaben selbst; fremde Seiten scheitern an der Prüfung der Herkunft.
const STEPS: Record<string, (values: never) => Promise<ActionResult<unknown>>> = {
  anmelden: signIn,
  code: verifyMfa,
  einrichten: confirmMfaEnrollment,
  einladung: completeInvite,
  'neues-passwort': setNewPassword,
  link: confirmEmailLink,
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ schritt: string }> }) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 })

  const { schritt } = await params
  const step = Object.hasOwn(STEPS, schritt) ? STEPS[schritt] : undefined
  if (!step) return new NextResponse(null, { status: 404 })

  const body: unknown = await request.json().catch(() => null)
  const values = typeof body === 'object' && body !== null ? body : {}
  let result: ActionResult<unknown>
  try {
    result = await (step as (values: object) => Promise<ActionResult<unknown>>)(values)
  } catch (e) {
    console.error('[auth] Anmelde-Schritt gescheitert', schritt, e)
    result = { ok: false, error: 'unknown' }
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
}
