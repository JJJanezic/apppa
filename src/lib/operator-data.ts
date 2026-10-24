import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'

import { getSessionUser } from '@/lib/auth/session'
import {
  displayStatus,
  inviteState,
  OPERATOR_PAGE_SIZE,
  type OperatorMember,
  type TenantDetail,
  type TenantPage,
  type TenantRow,
} from '@/lib/operator'
import { createClient } from '@/lib/supabase/server'
import { invitationStatus } from '@/lib/team'

// Lesefunktionen für den Betreiber-Bereich (PROJ-5). Der Admin darf laut PROJ-1 alles lesen (RLS, nur mit 2FA).
// Vorläufig (Frontend): Suche und Seiten werden hier im Server gefiltert, letzte Anmeldung und Protokoll
// fehlen noch – das Backend ersetzt beides durch eigene, nur für den Admin freigegebene Abfragen.

async function requireAdmin() {
  const user = await getSessionUser()
  if (!user?.isOperatorAdmin || user.aal !== 'aal2') notFound()
}

const byName = (a: { name: string | null; email: string }, b: { name: string | null; email: string }) =>
  (a.name ?? a.email).localeCompare(b.name ?? b.email, 'de')

export async function getTenantPage(opts: { query?: string; page?: number }): Promise<TenantPage> {
  await requireAdmin()
  const query = (opts.query ?? '').trim()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(
      'id, name, status, created_at, memberships(role, profile:profiles!inner(display_name, email)), invitations(email, role, status, expires_at)'
    )
    .order('name')
    .limit(1000)
  if (error) console.error('[betreiber] Kunden nicht lesbar', error.message)

  const needle = query.toLocaleLowerCase('de')
  const rows: TenantRow[] = (data ?? [])
    .map((t) => {
      const open = t.invitations.filter((i) => i.status === 'open').map((i) => ({ ...i, status: invitationStatus(i.expires_at) }))
      const memberCount = t.memberships.length
      const status = displayStatus(t.status, memberCount)
      const owners =
        memberCount > 0
          ? t.memberships
              .filter((m) => m.role === 'owner')
              .map((m) => ({ name: m.profile.display_name, email: m.profile.email }))
              .sort(byName)
          : open.filter((i) => i.role === 'owner').map((i) => ({ name: null, email: i.email }))
      return {
        row: {
          id: t.id,
          name: t.name,
          status,
          inviteState: status === 'invited' ? inviteState(open) : null,
          owners,
          memberCount,
          createdAt: t.created_at,
          lastSignInAt: null,
        },
        emails: [...t.memberships.map((m) => m.profile.email), ...open.map((i) => i.email)],
      }
    })
    .filter(({ row, emails }) => !needle || row.name.toLocaleLowerCase('de').includes(needle) || emails.some((e) => e.includes(needle)))
    .map(({ row }) => row)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  const pageCount = Math.max(1, Math.ceil(rows.length / OPERATOR_PAGE_SIZE))
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1)), pageCount)
  return {
    rows: rows.slice((page - 1) * OPERATOR_PAGE_SIZE, page * OPERATOR_PAGE_SIZE),
    total: rows.length,
    page,
    pageCount,
    query,
  }
}

// Einmal pro Anfrage (Seitentitel und Seite)
export const getTenantDetail = cache(async (id: string): Promise<TenantDetail> => {
  await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(
      'id, name, status, created_at, memberships(user_id, role, profile:profiles!inner(display_name, email)), invitations(id, email, role, status, sent_at, expires_at)'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('[betreiber] Kunde nicht lesbar', error.message)
  if (!data) notFound()

  const members: OperatorMember[] = data.memberships
    .map((m) => ({ userId: m.user_id, name: m.profile.display_name, email: m.profile.email, role: m.role }))
    // Inhaber zuerst, dann nach Name
    .sort((a, b) => (a.role === b.role ? byName(a, b) : a.role === 'owner' ? -1 : 1))
  const invitations = data.invitations
    .filter((i) => i.status === 'open')
    .map((i) => ({ id: i.id, email: i.email, role: i.role, sentAt: i.sent_at, status: invitationStatus(i.expires_at) }))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  const status = displayStatus(data.status, members.length)

  return {
    id: data.id,
    name: data.name,
    status,
    inviteState: status === 'invited' ? inviteState(invitations) : null,
    createdAt: data.created_at,
    members,
    invitations,
    log: [],
  }
})
