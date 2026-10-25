// Name des Eintrags in der Authenticator-App. Je Supabase-Projekt verschieden, damit dieselbe
// E-Mail-Adresse in Entwicklung, Staging und Produktion drei unterscheidbare Einträge ergibt.
// Projekt-Refs wie in supabase/config.toml ([remotes.…]) und im Runbook.
const PROJECT_ISSUERS: Record<string, string> = {
  ahclrqbhfpidxjzbpfgb: 'apppa',
  iikzjqjjxoznrkkixfqa: 'apppa Staging',
}

export function mfaIssuer(supabaseUrl: string | undefined): string {
  let ref = ''
  try {
    ref = new URL(supabaseUrl ?? '').hostname.split('.')[0]
  } catch {
    // Ungültige URL: wie Entwicklung behandeln
  }
  return PROJECT_ISSUERS[ref] ?? 'apppa Dev'
}
