// Einheitliches Ergebnis aller Anmelde-Aktionen (PROJ-3). Fehler sind Schlüssel in messages/de.json („auth.errors.*“),
// damit Meldungen bewusst neutral bleiben und die Oberfläche sie übersetzt.

export type AuthErrorCode =
  | 'invalidCredentials'
  | 'locked'
  | 'linkInvalid'
  | 'wrongCurrentPassword'
  | 'codeInvalid'
  | 'lastFactor'
  | 'weakPassword'
  | 'sessionExpired'
  | 'network'
  | 'notImplemented'
  | 'unknown'

// Fehler, die jede Server-Aktion liefern kann (Netzwerk, abgelaufene Sitzung, unbekannt)
export type CommonErrorCode = 'network' | 'sessionExpired' | 'notImplemented' | 'unknown'

// E: Fehlercodes des jeweiligen Bereichs (Standard: Anmeldung). Für Team & Kunde siehe src/lib/team.ts
export type ActionResult<T = undefined, E extends string = AuthErrorCode> =
  | { ok: true; redirectTo?: string; data?: T }
  | { ok: false; error: E | CommonErrorCode; retryAfterMinutes?: number }
