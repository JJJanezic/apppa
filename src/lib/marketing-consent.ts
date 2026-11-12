// Marketing-Einwilligung (PROJ-19): Stand und Verlauf je Gast. Erteilt wird über das Gästeblatt (PROJ-26) oder von Hand,
// widerrufen nur von Hand. Der Stand ergibt sich aus dem jüngsten gültigen Eintrag (nach Datum, bei Gleichstand nach
// Erfassungszeit); als irrtümlich markierte Einträge zählen nicht. Die Datenbank rechnet ihn aus und hält ihn am Gast.

export type ConsentState = 'granted' | 'revoked' | 'none'
export type ConsentKind = 'grant' | 'revoke'
// Herkunft: Gästeblatt („Fertig“), nacherfasstes (hochgeladenes) Gästeblatt, von Hand
export type ConsentOrigin = 'sheet' | 'sheet_upload' | 'manual'
export type ConsentChannel = 'email' | 'paper' | 'webform' | 'oral' | 'other'

// Wege beim Erfassen von Hand; „mündlich/telefonisch“ nur beim Widerruf (eine mündliche Einwilligung ist nicht nachweisbar)
export const GRANT_CHANNELS = ['email', 'paper', 'webform', 'other'] as const satisfies readonly ConsentChannel[]
export const REVOKE_CHANNELS = ['email', 'paper', 'webform', 'oral', 'other'] as const satisfies readonly ConsentChannel[]
export const channelsFor = (kind: ConsentKind): readonly ConsentChannel[] => (kind === 'grant' ? GRANT_CHANNELS : REVOKE_CHANNELS)

export const CONSENT_LIMITS = { noteMax: 500, voidReasonMax: 200 } as const

// Privater Speicher für Belege, Ordner je Kunde (wie Zahlungsbelege, PROJ-45)
export const CONSENT_RECEIPT_BUCKET = 'marketing-consent-receipts'

export type ConsentEntry = {
  id: string
  kind: ConsentKind
  origin: ConsentOrigin
  // Tag der Erteilung bzw. des Widerrufs (JJJJ-MM-TT)
  occurredOn: string
  channel: ConsentChannel | null
  note: string | null
  receipt: { type: 'pdf' | 'image' } | null
  // Gästeblatt bei Herkunft „sheet“/„sheet_upload“: Nummer und Link zum PDF
  sheet: { id: string; number: string | null; bookingId: string | null; bookingNumber: string | null } | null
  createdAt: string
  createdBy: string | null
  voided: { at: string; by: string | null; reason: string } | null
}

export type GuestConsent = {
  state: ConsentState
  // Datum des maßgeblichen Eintrags (bei „granted“ seit wann, bei „revoked“ wann)
  since: string | null
  // Gästeblatt der maßgeblichen Erteilung, falls über ein Blatt erteilt
  sheetNumber: string | null
  entries: ConsentEntry[]
  // false: Verlauf in der Datenbank noch nicht eingerichtet (nur der Vermerk aus PROJ-26 ist lesbar)
  historyAvailable: boolean
}

export type ConsentErrorCode =
  | 'notFound'
  | 'ownerOnly'
  | 'guestAnonymized'
  | 'consentDateInFuture'
  | 'consentDateBeforeBirth'
  | 'consentChannelInvalid'
  | 'consentNotGranted'
  | 'consentNotVoidable'
  | 'consentAlreadyVoided'
  | 'consentReceiptMissing'

// Hinweis der Datenbank vor dem Speichern: Der Eintrag liegt vor dem maßgeblichen Eintrag und ändert den Stand nicht
export type ConsentWarning = { code: 'notEffective'; latestOn: string; latestKind: ConsentKind }

// Filter der Gästeliste; in der Adresse deutsch (?einwilligung=erteilt|widerrufen|keine)
export type ConsentFilter = ConsentState
export const CONSENT_FILTER_PARAM: Record<ConsentFilter, string> = { granted: 'erteilt', revoked: 'widerrufen', none: 'keine' }
export const CONSENT_FILTERS = ['granted', 'revoked', 'none'] as const satisfies readonly ConsentFilter[]
export function parseConsentFilter(value: string): ConsentFilter | null {
  return CONSENT_FILTERS.find((f) => CONSENT_FILTER_PARAM[f] === value) ?? null
}

export const receiptTypeOf = (path: string): 'pdf' | 'image' => (/\.pdf$/i.test(path) ? 'pdf' : 'image')

// Eigene Kontaktmöglichkeit für Werbung: eine direkt erfasste E-Mail-Adresse oder eine Anschrift.
// Von booking.com/Airbnb übernommene Adressen zählen nicht (PRD, PROJ-7).
export function hasOwnContact(guest: {
  email: string | null
  emailSource: 'direct' | 'platform'
  street: string | null
  postalCode: string | null
  city: string | null
}): boolean {
  const email = Boolean(guest.email && guest.emailSource === 'direct')
  const address = Boolean(guest.street?.trim() && (guest.postalCode?.trim() || guest.city?.trim()))
  return email || address
}
