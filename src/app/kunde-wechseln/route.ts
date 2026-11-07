import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { NO_ACCESS_NOTICE } from '@/lib/dashboard'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { getTenantContext, rememberTenant } from '@/lib/tenant'

// Kundenwechsel (PROJ-4) als normales Formular statt Server-Aktion. Die Aktion setzte das Cookie, Next.js rendert
// daraufhin die aktuelle Seite neu, und der gleichzeitige Seitenwechsel im Browser brach diese Antwort ab:
// Firefox zeigte kurz „Da ist etwas schiefgelaufen“. Hier gibt es nur Cookie + Weiterleitung (303) zum Dashboard
// des neuen Kunden, also einen echten Seitenwechsel ohne parallele Anfrage.
// Fremde Seiten können nicht wechseln: Die Sitzungs-Cookies sind SameSite=Lax (bei fremdem POST nicht gesendet),
// dazu die Prüfung der Herkunft. Gewählt werden nur Kunden, bei denen die Person Mitglied ist.
// PROJ-14: optionales Ziel „weiter“ (nur interne Adressen), z. B. das Buchungsdetail aus dem Dashboard. Gehört die Person
// nicht mehr zum Kunden, geht es ohne Wechsel zum Dashboard mit dem Hinweis „Kein Zugriff mehr auf diesen Kunden“.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 })

  let target = '/'
  const user = await getSessionUser()
  if (user && !(await pendingMfaStep(user))) {
    const form = await request.formData()
    const tenantId = form.get('tenantId')
    const next = form.get('weiter')
    const { list } = await getTenantContext()
    if (typeof tenantId === 'string' && list.some((t) => t.id === tenantId)) {
      await rememberTenant(tenantId)
      target = safeRedirectPath(typeof next === 'string' ? next : null, request.nextUrl.origin)
    } else if (typeof next === 'string') target = `/?hinweis=${NO_ACCESS_NOTICE}`
  }
  // Ohne Sitzung schickt der App-Rahmen von „/“ zur Anmeldung
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), 303)
}
