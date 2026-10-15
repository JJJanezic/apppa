// Regel der Sperre nach Fehlversuchen (PROJ-3), ohne Datenbank – damit sie sich einzeln testen lässt.
// 5 Fehlversuche (Passwort oder 2FA-Code) innerhalb von 15 Minuten → 15 Minuten gesperrt, auch bei richtigem Passwort.

export const MAX_FAILURES = 5
export const FAILURE_WINDOW_MS = 15 * 60_000
export const LOCK_DURATION_MS = 15 * 60_000

// Zeitraum, aus dem Fehlversuche gelesen werden müssen, um die Regel auszuwerten
export const LOOKBACK_MS = FAILURE_WINDOW_MS + LOCK_DURATION_MS

export type LockState = { locked: false } | { locked: true; retryAfterMinutes: number }

// failures: Zeitpunkte der Fehlversuche, beliebige Reihenfolge.
// Während der Sperre werden keine weiteren Fehlversuche gespeichert; maßgeblich ist daher der jüngste
// Versuch, sofern er mit den vier davor in ein 15-Minuten-Fenster fällt.
export function lockState(failures: Date[], now: Date): LockState {
  if (failures.length < MAX_FAILURES) return { locked: false }

  const recent = failures
    .map((d) => d.getTime())
    .sort((a, b) => b - a)
    .slice(0, MAX_FAILURES)
  const newest = recent[0]
  const oldest = recent[MAX_FAILURES - 1]
  if (newest - oldest > FAILURE_WINDOW_MS) return { locked: false }

  const remaining = newest + LOCK_DURATION_MS - now.getTime()
  if (remaining <= 0) return { locked: false }
  return { locked: true, retryAfterMinutes: Math.max(1, Math.ceil(remaining / 60_000)) }
}
