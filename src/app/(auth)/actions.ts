'use server'

import type { ActionResult } from '@/lib/auth/result'
import type {
  CompleteInviteValues,
  ForgotPasswordValues,
  LoginValues,
  NewPasswordValues,
  OtpValues,
} from '@/lib/validation/auth'

// Server-Aktionen der Anmelde-Seiten (PROJ-3).
// Frontend-Stand: Schnittstellen festgelegt, Umsetzung (Supabase, Sperre nach Fehlversuchen,
// Sitzungsgrenzen, Pflicht-2FA) folgt mit /backend.

const notImplemented = async (): Promise<ActionResult> => ({ ok: false, error: 'notImplemented' })

// Anmelden. Erfolg → redirectTo: Ziel (Dashboard, Rücksprung-Seite, /2fa oder /2fa/einrichten)
export async function signIn(values: LoginValues & { next?: string }): Promise<ActionResult> {
  void values
  return notImplemented()
}

// Reset-Mail anfordern. Antwortet immer gleich (neutral), auch wenn kein Konto existiert
export async function requestPasswordReset(values: ForgotPasswordValues): Promise<ActionResult> {
  void values
  return notImplemented()
}

// Mail-Link einlösen – erst nach Klick auf der Bestätigungsseite (Schutz vor Linkscannern)
export async function confirmEmailLink(values: {
  tokenHash: string
  type: 'invite' | 'recovery'
}): Promise<ActionResult<{ signedOutOther: boolean }>> {
  void values
  return notImplemented()
}

// Einladung abschließen: Anzeigename + Passwort
export async function completeInvite(values: CompleteInviteValues): Promise<ActionResult> {
  void values
  return notImplemented()
}

// Neues Passwort nach Reset; beendet andere Sitzungen
export async function setNewPassword(values: NewPasswordValues): Promise<ActionResult> {
  void values
  return notImplemented()
}

// 2FA-Code nach dem Passwort prüfen (nur Admin)
export async function verifyMfa(values: OtpValues & { next?: string }): Promise<ActionResult> {
  void values
  return notImplemented()
}

// 2FA-Einrichtung starten: QR-Code (SVG-Daten-URL) und Schlüssel zum Abtippen
export async function startMfaEnrollment(): Promise<ActionResult<{ factorId: string; qrCode: string; secret: string }>> {
  return notImplemented()
}

// 2FA-Einrichtung mit erstem Code bestätigen
export async function confirmMfaEnrollment(values: OtpValues & { factorId: string }): Promise<ActionResult> {
  void values
  return notImplemented()
}

// Abmelden (nur dieses Gerät)
export async function signOut(): Promise<ActionResult> {
  return notImplemented()
}
