import type { Role } from '@/lib/navigation'
import type { Invitation } from '@/lib/team'
import type { TenantMasterData } from '@/lib/tenant-master-data'

// Betreiber-Bereich (PROJ-5): Typen und reine Regeln für Browser und Server.
// Lesefunktionen: src/lib/operator-data.ts (nur Server), Aktionen: src/app/(app)/betreiber/actions.ts.

export type OperatorErrorCode =
  | 'duplicateName'
  | 'alreadyMember'
  | 'alreadyInvited'
  | 'lastOwner'
  | 'invitationInvalid'
  | 'tenantGone'
  | 'notDeactivated'
  | 'nameMismatch'
  | 'mailFailed'
  | 'accountsLeft'

export const OPERATOR_PAGE_SIZE = 50

export const tenantHref = (id: string) => `/betreiber/kunden/${id}`

// Angezeigter Status: „Einladung offen“ wird nicht gespeichert, sondern abgeleitet (aktiv, aber ohne Mitglied)
export type TenantDisplayStatus = 'active' | 'invited' | 'deactivated'
// Zusatz bei „Einladung offen“: Einladung läuft, ist abgelaufen oder fehlt (zurückgezogen/abgelehnt)
export type InviteState = 'open' | 'expired' | 'none'

export function displayStatus(status: 'active' | 'deactivated', memberCount: number): TenantDisplayStatus {
  if (status === 'deactivated') return 'deactivated'
  return memberCount > 0 ? 'active' : 'invited'
}

export function inviteState(invitations: { status: Invitation['status'] }[]): InviteState {
  if (invitations.some((i) => i.status === 'open')) return 'open'
  return invitations.length > 0 ? 'expired' : 'none'
}

export type OwnerSummary = { name: string | null; email: string }

// Zeile der Kundenliste
export type TenantRow = {
  id: string
  name: string
  status: TenantDisplayStatus
  inviteState: InviteState | null
  // Inhaber; ohne Mitglied: die eingeladene Adresse (name = null)
  owners: OwnerSummary[]
  memberCount: number
  createdAt: string
  // jüngste Anmeldung eines Mitglieds; null = noch nie
  lastSignInAt: string | null
  // Ort aus den Stammdaten (PROJ-28), klein unter dem Namen
  city: string | null
}

export type TenantPage = { rows: TenantRow[]; total: number; page: number; pageCount: number; query: string }

export type OperatorMember = {
  userId: string
  name: string | null
  email: string
  role: Role
}

export type OperatorLogAction =
  | 'created'
  | 'invited'
  | 'resent'
  | 'revoked'
  | 'promoted'
  | 'demoted'
  | 'removed'
  | 'deactivated'
  | 'reactivated'
  | 'deleted'
  | 'master_data'

export type OperatorLogEntry = {
  id: string
  at: string
  action: OperatorLogAction
  actorName: string | null
  targetEmail: string | null
  // bei „Stammdaten geändert“: geänderte Felder (Schlüssel aus tenantData.fields)
  fields: string[]
}

export type TenantDetail = {
  id: string
  name: string
  status: TenantDisplayStatus
  inviteState: InviteState | null
  createdAt: string
  masterData: TenantMasterData
  members: OperatorMember[]
  invitations: Invitation[]
  log: OperatorLogEntry[]
}

// Was der Betreiber mit einem Mitglied tun darf: nur Inhaber verwalten (Mitarbeiter bleiben bei den Inhabern).
// Der letzte Inhaber ist geschützt – die Datenbank setzt das zusätzlich durch.
export type OperatorMemberAction = 'promote' | 'demote' | 'remove'
export type OperatorMemberState = { actions: OperatorMemberAction[]; blocked: 'lastOwner' | null }

export function operatorMemberActions(member: { role: Role }, ownerCount: number): OperatorMemberState {
  if (member.role === 'staff') return { actions: ['promote'], blocked: null }
  if (ownerCount <= 1) return { actions: [], blocked: 'lastOwner' }
  return { actions: ['demote', 'remove'], blocked: null }
}

// Endgültig löschen: nur bei deaktivierten Kunden und mit exakt eingetipptem aktuellem Namen
export const deleteConfirmed = (typed: string, tenantName: string) => typed.trim() === tenantName.trim()
