import 'server-only'

import { notFound } from 'next/navigation'

import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { invitationStatus, type MyInvitation, type Team } from '@/lib/team'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen für Team & Einladungen (PROJ-4). Rechte prüft die Datenbank (RLS) zusätzlich.

// Team des gewählten Kunden – nur für Inhaber (Seiten unter /einstellungen)
export async function getTeam(): Promise<Team> {
  const [user, { active }] = await Promise.all([getSessionUser(), getTenantContext()])
  if (!user || !active || active.role !== 'owner') notFound()

  const supabase = await createClient()
  const [members, invitations] = await Promise.all([
    supabase
      .from('memberships')
      .select('user_id, role, profile:profiles!inner(display_name, email)')
      .eq('tenant_id', active.id)
      .limit(500),
    supabase
      .from('invitations')
      .select('id, email, role, sent_at, expires_at')
      .eq('tenant_id', active.id)
      .eq('status', 'open')
      .order('sent_at', { ascending: false })
      .limit(500),
  ])
  if (members.error) console.error('[team] Mitglieder nicht lesbar', members.error.message)
  if (invitations.error) console.error('[team] Einladungen nicht lesbar', invitations.error.message)

  return {
    tenantName: active.name,
    viewerRole: active.role,
    members: (members.data ?? [])
      .map((m) => ({
        userId: m.user_id,
        name: m.profile.display_name,
        email: m.profile.email,
        role: m.role,
        isSelf: m.user_id === user.userId,
      }))
      // Inhaber zuerst, dann nach Name
      .sort((a, b) => (a.role === b.role ? (a.name ?? a.email).localeCompare(b.name ?? b.email, 'de') : a.role === 'owner' ? -1 : 1)),
    invitations: (invitations.data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      sentAt: i.sent_at,
      status: invitationStatus(i.expires_at),
    })),
  }
}

// Offene Einladungen an die angemeldete Person (bestehendes Konto)
export async function getMyInvitations(): Promise<MyInvitation[]> {
  const user = await getSessionUser()
  if (!user) return []
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_open_invitations')
  if (error) {
    console.error('[team] Einladungen an mich nicht lesbar', error.message)
    return []
  }
  return (data ?? []).map((i) => ({ id: i.id, tenantName: i.tenant_name, invitedBy: i.invited_by_name, role: i.role }))
}
