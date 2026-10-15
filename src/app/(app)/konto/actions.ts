'use server'

import type { ActionResult } from '@/lib/auth/result'
import type { ChangePasswordValues, DisplayNameValues, OtpValues } from '@/lib/validation/auth'

// Server-Aktionen für „Mein Konto“ (PROJ-3). Umsetzung folgt mit /backend.

const notImplemented = async (): Promise<ActionResult> => ({ ok: false, error: 'notImplemented' })

export async function updateDisplayName(values: DisplayNameValues): Promise<ActionResult> {
  void values
  return notImplemented()
}

// Prüft das aktuelle Passwort (zählt bei Fehlern zur Sperre) und beendet andere Sitzungen
export async function changePassword(values: ChangePasswordValues): Promise<ActionResult> {
  void values
  return notImplemented()
}

// Beendet alle Sitzungen, auch die aktuelle
export async function signOutEverywhere(): Promise<ActionResult> {
  return notImplemented()
}

// Zweites 2FA-Gerät: Einrichtung starten bzw. mit Code bestätigen (nur Admin)
export async function startAddMfaDevice(): Promise<ActionResult<{ factorId: string; qrCode: string; secret: string }>> {
  return notImplemented()
}

export async function confirmAddMfaDevice(values: OtpValues & { factorId: string }): Promise<ActionResult> {
  void values
  return notImplemented()
}

// Entfernt ein 2FA-Gerät; das letzte Gerät lässt sich nicht entfernen
export async function removeMfaDevice(values: { factorId: string }): Promise<ActionResult> {
  void values
  return notImplemented()
}
