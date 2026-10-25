'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { TeamErrorCode } from '@/lib/team'
import { rememberTenant } from '@/lib/tenant'

// Kundenwechsel und Einladungen an die angemeldete Person (PROJ-4)

type Result = ActionResult<undefined, TeamErrorCode>

async function signedIn(): Promise<boolean> {
  const user = await getSessionUser()
  return Boolean(user && !(await pendingMfaStep(user)))
}

// Einladung (bestehendes Konto) annehmen: Mitgliedschaft entsteht in der Datenbank, der Kunde wird gewählt
export async function acceptInvitation(values: { invitationId: string }): Promise<Result> {
  if (!(await signedIn())) return { ok: false, error: 'sessionExpired' }
  if (typeof values?.invitationId !== 'string') return { ok: false, error: 'invitationInvalid' }
  const supabase = await createClient()
  const { data: tenantId, error } = await supabase.rpc('accept_invitation', { p_invitation_id: values.invitationId })
  if (error || !tenantId) return { ok: false, error: error?.code === 'P0002' ? 'invitationInvalid' : 'unknown' }
  await rememberTenant(tenantId)
  revalidatePath('/', 'layout')
  return { ok: true, redirectTo: '/' }
}

export async function declineInvitation(values: { invitationId: string }): Promise<Result> {
  if (!(await signedIn())) return { ok: false, error: 'sessionExpired' }
  if (typeof values?.invitationId !== 'string') return { ok: false, error: 'invitationInvalid' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('decline_invitation', { p_invitation_id: values.invitationId })
  if (error) return { ok: false, error: error.code === 'P0002' ? 'invitationInvalid' : 'unknown' }
  revalidatePath('/')
  return { ok: true }
}
