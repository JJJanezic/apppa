import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getClientEnv } from '@/lib/env'
import type { Database } from '@/types/database'

// Frischt die Login-Sitzung bei jedem Seitenaufruf auf und schreibt erneuerte Cookies zurück.
export async function updateSession(request: NextRequest) {
  const env = getClientEnv()
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
  await supabase.auth.getClaims()

  return response
}
