import { createBrowserClient } from '@supabase/ssr'

import { getClientEnv } from '@/lib/env'
import type { Database } from '@/types/database'

// Supabase im Browser: handelt im Namen des angemeldeten Nutzers, Rechte prüft die Datenbank (RLS).
export function createClient() {
  const env = getClientEnv()
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}
