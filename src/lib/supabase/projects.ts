// Supabase-Projekte der drei Umgebungen. Gleiche Refs wie in supabase/config.toml ([remotes.…])
// und im Runbook (docs/runbooks/supabase.md, „Umgebungen“). Wird ein Projekt neu angelegt, hier nachziehen.
export const DEV_PROJECT_REF = 'nizgfmvjplhegoosanmu'
export const STAGING_PROJECT_REF = 'iikzjqjjxoznrkkixfqa'
export const PRODUCTION_PROJECT_REF = 'ahclrqbhfpidxjzbpfgb'

// Projekt-Ref aus der Supabase-URL (https://<ref>.supabase.co); leer bei fehlender oder ungültiger URL.
export function projectRef(supabaseUrl: string | undefined): string {
  try {
    return new URL(supabaseUrl ?? '').hostname.split('.')[0]
  } catch {
    return ''
  }
}

// Automatische Tests legen Nutzer und Mandanten an und löschen sie wieder. Gegen Staging oder
// Produktion dürfen sie nie laufen, auch nicht, wenn .env.local versehentlich deren Werte enthält.
export function assertTestableProject(supabaseUrl: string | undefined): void {
  const ref = projectRef(supabaseUrl)
  if (ref === STAGING_PROJECT_REF || ref === PRODUCTION_PROJECT_REF) {
    throw new Error(
      `Tests abgebrochen: NEXT_PUBLIC_SUPABASE_URL zeigt auf ${ref === STAGING_PROJECT_REF ? 'Staging' : 'Produktion'}. ` +
        `.env.local darf nur die Werte von „apppa-dev“ (${DEV_PROJECT_REF}) enthalten.`
    )
  }
}
