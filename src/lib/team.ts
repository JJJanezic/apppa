import type { Role } from '@/lib/navigation'

// Daten für „Einstellungen → Team / Kunde“ und Einladungen an mich (PROJ-4).
// Typen gelten für Browser und Server; die Lesefunktionen stehen in src/lib/team-data.ts (nur Server).

export type TeamErrorCode =
  | 'alreadyMember'
  | 'alreadyInvited'
  | 'inviteSelf'
  | 'tooManyInvites'
  | 'otherOwner'
  | 'lastOwner'
  | 'invitationInvalid'

export type TeamMember = {
  userId: string
  name: string | null
  email: string
  role: Role
  isSelf: boolean
}

export type Invitation = {
  id: string
  email: string
  role: Role
  sentAt: string
  status: 'open' | 'expired'
}

export type Team = {
  tenantName: string
  viewerRole: Role
  members: TeamMember[]
  invitations: Invitation[]
}

// Einladung an die angemeldete Person (bestehendes Konto), anzunehmen in der App
export type MyInvitation = {
  id: string
  tenantName: string
  invitedBy: string | null
  role: Role
}

export const INVITE_VALIDITY_MS = {
  new_account: 24 * 60 * 60_000,
  existing_account: 14 * 24 * 60 * 60_000,
} as const

export const MAX_INVITES_PER_HOUR = 20

export function invitationStatus(expiresAt: string, now = Date.now()): Invitation['status'] {
  return new Date(expiresAt).getTime() <= now ? 'expired' : 'open'
}
