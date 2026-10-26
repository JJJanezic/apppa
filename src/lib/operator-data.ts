import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'

import { getSessionUser } from '@/lib/auth/session'
import type { Role } from '@/lib/navigation'
import {
  displayStatus,
  inviteState,
  type OperatorLogAction,
  type OperatorMember,
  OPERATOR_PAGE_SIZE,
  type OwnerSummary,
  type TenantDetail,
  type TenantPage,
  type TenantRow,
} from '@/lib/operator'
import { createClient } from '@/lib/supabase/server'
import { invitationStatus } from '@/lib/team'
import { MASTER_DATA_COLUMNS, masterDataFromRow } from '@/lib/tenant-master-data'

// Lesefunktionen für den Betreiber-Bereich (PROJ-5). Der Admin darf laut PROJ-1 alles lesen (RLS, nur mit 2FA).
// Die Kundenliste kommt aus einer nur für den Admin freigegebenen Datenbankfunktion (Suche, Seiten,
// letzte Anmeldung aus der Login-Verwaltung); die Detailseite liest über die normalen Leserechte.

async function requireAdmin() {
  const user = await getSessionUser()
  if (!user?.isOperatorAdmin || user.aal !== 'aal2') notFound()
}

const byName = (a: { name: string | null; email: string }, b: { name: string | null; email: string }) =>
  (a.name ?? a.email).localeCompare(b.name ?? b.email, 'de')

type OverviewInvitation = { email: string; role: Role; expires_at: string }

export async function getTenantPage(opts: { query?: string; page?: number }): Promise<TenantPage> {
  await requireAdmin()
  const query = (opts.query ?? '').trim()
  const requested = Math.max(1, Math.floor(opts.page ?? 1))
  const supabase = await createClient()

  const load = (page: number) =>
    supabase.rpc('admin_tenant_overview', {
      p_query: query,
      p_limit: OPERATOR_PAGE_SIZE,
      p_offset: (page - 1) * OPERATOR_PAGE_SIZE,
    })
  let page = requested
  let { data, error } = await load(page)
  // Seite hinter dem Ende (z. B. nach Löschen oder alter Link): erste Seite zeigen
  if (!error && data?.length === 0 && page > 1) {
    page = 1
    ;({ data, error } = await load(page))
  }
  if (error) console.error('[betreiber] Kunden nicht lesbar', error.message)

  const rows: TenantRow[] = (data ?? []).map((t) => {
    const open = (t.invitations as OverviewInvitation[]).map((i) => ({ ...i, status: invitationStatus(i.expires_at) }))
    const status = displayStatus(t.status, t.member_count)
    const owners: OwnerSummary[] =
      t.member_count > 0
        ? (t.owners as OwnerSummary[])
        : open.filter((i) => i.role === 'owner').map((i) => ({ name: null, email: i.email }))
    return {
      id: t.id,
      name: t.name,
      status,
      inviteState: status === 'invited' ? inviteState(open) : null,
      owners,
      memberCount: t.member_count,
      createdAt: t.created_at,
      lastSignInAt: t.last_sign_in_at,
      city: t.city,
    }
  })
  const total = Number(data?.[0]?.total ?? 0)
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / OPERATOR_PAGE_SIZE)), query }
}

// Einmal pro Anfrage (Seitentitel und Seite)
export const getTenantDetail = cache(async (id: string): Promise<TenantDetail> => {
  await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const [tenant, log] = await Promise.all([
    supabase
      .from('tenants')
      .select(
        `${MASTER_DATA_COLUMNS}, status, created_at, memberships(user_id, role, profile:profiles!inner(display_name, email)), invitations(id, email, role, status, sent_at, expires_at)` as const
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('operator_log')
      .select('id, created_at, action, actor_name, target_email, changed_fields')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ])
  if (tenant.error) console.error('[betreiber] Kunde nicht lesbar', tenant.error.message)
  if (log.error) console.error('[betreiber] Protokoll nicht lesbar', log.error.message)
  const data = tenant.data
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
    masterData: masterDataFromRow(data),
    members,
    invitations,
    log: (log.data ?? []).map((entry) => ({
      id: String(entry.id),
      at: entry.created_at,
      action: entry.action as OperatorLogAction,
      actorName: entry.actor_name,
      targetEmail: entry.target_email,
      // Spaltennamen (vat_id) → Feldschlüssel der Oberfläche (vatId)
      fields: (entry.changed_fields ?? []).map((f) => f.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())),
    })),
  }
})
