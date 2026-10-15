import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { checkSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session-limits'
import { getServerEnv } from '@/lib/env'
import type { Database } from '@/types/database'

// Seiten ohne Anmeldung. Alle übrigen Seiten verlangen eine Sitzung (PROJ-3).
const PUBLIC_PATHS = ['/anmelden', '/passwort-vergessen', '/bestaetigen', '/auth/confirm']
// Angemeldete Personen kommen von hier direkt zum Dashboard
const GUEST_ONLY_PATHS = ['/anmelden']

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`))

// Frischt die Login-Sitzung bei jedem Seitenaufruf auf, prüft die Sitzungsgrenzen (30 Tage / 8 h)
// und leitet nicht angemeldete Aufrufe zur Anmeldung (mit Rücksprung-Adresse).
// Zweite Ebene: der App-Rahmen prüft die Sitzung auf dem Server noch einmal; dritte Ebene: RLS.
export async function updateSession(request: NextRequest) {
  const env = getServerEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Nichts zwischen createServerClient und getClaims ausführen, sonst können Sitzungen verloren gehen.
  const { data } = await supabase.auth.getClaims()
  let userId = data?.claims?.sub ?? null

  const path = request.nextUrl.pathname
  // Server-Aktionen nicht umleiten: Sie melden eine abgelaufene Sitzung selbst („sessionExpired“)
  const isAction = request.headers.has('next-action')
  // API-Routen prüfen selbst und antworten mit Statuscodes statt Weiterleitungen
  const isApi = path.startsWith('/api/')
  let expired = false

  if (userId) {
    const check = checkSession(request.cookies.get(SESSION_COOKIE)?.value, userId, env.SUPABASE_SECRET_KEY)
    if (check.status === 'expired') {
      await supabase.auth.signOut({ scope: 'local' })
      response.cookies.delete(SESSION_COOKIE)
      userId = null
      expired = true
    } else if (check.value) {
      response.cookies.set(SESSION_COOKIE, check.value, sessionCookieOptions)
    }
  }

  if (isAction || isApi) return response

  if (!userId && !matches(path, PUBLIC_PATHS)) {
    const url = request.nextUrl.clone()
    url.pathname = '/anmelden'
    url.search = ''
    const next = `${path}${request.nextUrl.search}`
    if (next !== '/') url.searchParams.set('next', next)
    if (expired) url.searchParams.set('grund', 'sitzung-abgelaufen')
    return redirectWithCookies(url, response)
  }

  if (userId && matches(path, GUEST_ONLY_PATHS)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return redirectWithCookies(url, response)
  }

  return response
}

// Weiterleitung, die erneuerte bzw. gelöschte Sitzungs-Cookies mitnimmt
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}
