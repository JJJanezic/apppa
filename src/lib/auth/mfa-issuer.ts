import { PRODUCTION_PROJECT_REF, projectRef, STAGING_PROJECT_REF } from '@/lib/supabase/projects'

// Name des Eintrags in der Authenticator-App. Je Supabase-Projekt verschieden, damit dieselbe
// E-Mail-Adresse in Entwicklung, Staging und Produktion drei unterscheidbare Einträge ergibt.
const PROJECT_ISSUERS: Record<string, string> = {
  [PRODUCTION_PROJECT_REF]: 'apppa',
  [STAGING_PROJECT_REF]: 'apppa Staging',
}

export function mfaIssuer(supabaseUrl: string | undefined): string {
  return PROJECT_ISSUERS[projectRef(supabaseUrl)] ?? 'apppa Dev'
}
