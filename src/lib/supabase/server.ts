import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getClientEnv } from '@/lib/env'
import type { Database } from '@/types/database'

// Supabase in Server Components, Server Actions und Route Handlers – im Namen des angemeldeten Nutzers.
// Pro Anfrage neu erzeugen, nie global teilen.
export async function createClient() {
  const env = getClientEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // In Server Components dürfen keine Cookies gesetzt werden; die Sitzung frischt der Proxy auf.
          }
        },
      },
    }
  )
}
