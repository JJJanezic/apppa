import 'server-only'

import { headers } from 'next/headers'

import { sendInvitationNotice } from '@/lib/mail/brevo'
import type { Role } from '@/lib/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

// Versand von Einladungen (PROJ-4). Braucht Systemrechte (Login-Konten anlegen, Konten nachschlagen) und
// wird nur von Server-Aktionen aufgerufen, nachdem diese die Inhaber-Rolle geprüft haben.
// Bewusst keine Server-Aktionen: nicht direkt aus dem Browser aufrufbar.

type Kind = 'new_account' | 'existing_account'
const ROLE_LABEL: Record<Role, string> = { owner: 'Inhaber', staff: 'Mitarbeiter' }

async function findAccount(email: string) {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!profile) return null
  const { data } = await admin.auth.admin.getUserById(profile.id)
  return data.user ?? null
}

// Konto mit bestätigter Adresse → Hinweis-Mail (Anmelden bzw. „Passwort vergessen“ möglich);
// kein Konto oder frühere Einladung nie angenommen (Adresse unbestätigt) → Einladungsmail
export async function invitationKindFor(email: string, tenantId: string): Promise<Kind | 'member'> {
  const account = await findAccount(email)
  if (!account) return 'new_account'
  const { data: membership } = await createAdminClient()
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', account.id)
    .maybeSingle()
  if (membership) return 'member'
  return account.email_confirmed_at ? 'existing_account' : 'new_account'
}

async function appUrl(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function deliverInvitation(input: {
  email: string
  kind: Kind
  role: Role
  tenantName: string
  inviterName: string | null
}): Promise<boolean> {
  if (input.kind === 'existing_account') {
    return sendInvitationNotice({
      to: input.email,
      tenantName: input.tenantName,
      inviterName: input.inviterName,
      roleLabel: ROLE_LABEL[input.role],
      appUrl: await appUrl(),
    })
  }

  // Neue Person: Supabase legt das Login-Konto an (bzw. nutzt das unbenutzte) und schickt die Einladungsmail
  // (Vorlage supabase/templates/invite.html über Brevo). Ein erneuter Versand ersetzt den alten Link.
  const admin = createAdminClient()
  const metadata = { tenant_name: input.tenantName, invited_by_name: input.inviterName ?? '' }
  const existing = await findAccount(input.email)
  if (existing) await admin.auth.admin.updateUserById(existing.id, { user_metadata: metadata })
  const { error } = await admin.auth.admin.inviteUserByEmail(input.email, { data: metadata })
  if (error) console.error('[invite] Einladungsmail nicht verschickt', error.code ?? error.status)
  return !error
}

// Nach dem Zurückziehen: Login-Konto entfernen, wenn die Einladung nie angenommen wurde (Adresse unbestätigt)
// und es sonst nirgends gebraucht wird.
// So führt ein bereits verschickter Einladungslink ins Leere („nicht mehr gültig“).
export async function cleanupUnusedAccount(email: string): Promise<void> {
  const account = await findAccount(email)
  if (!account || account.email_confirmed_at) return
  const admin = createAdminClient()
  const [{ count: memberships }, { count: openInvites }] = await Promise.all([
    admin.from('memberships').select('id', { count: 'exact', head: true }).eq('user_id', account.id),
    admin.from('invitations').select('id', { count: 'exact', head: true }).eq('email', email).eq('status', 'open'),
  ])
  if ((memberships ?? 0) > 0 || (openInvites ?? 0) > 0) return
  const { error } = await admin.auth.admin.deleteUser(account.id)
  if (error) console.error('[invite] Unbenutztes Konto nicht gelöscht', error.code ?? error.status)
}
