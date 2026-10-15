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

export type ActionResult<T = undefined> =
  | { ok: true; redirectTo?: string; data?: T }
  | { ok: false; error: AuthErrorCode; retryAfterMinutes?: number }
