import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { getServerEnv } from '@/lib/env'
import type { Database } from '@/types/database'

// Supabase mit Systemrechten (umgeht RLS). Nur serverseitig und nur wo nötig verwenden,
// z. B. für Einladungen (PROJ-5) oder den Channex-Import (PROJ-11).
export function createAdminClient() {
  const env = getServerEnv()
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
