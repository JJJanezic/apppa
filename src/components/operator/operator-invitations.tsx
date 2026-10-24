'use client'

import { resendOwnerInvitation, revokeOwnerInvitation } from '@/app/(app)/betreiber/actions'
import { InvitationsList } from '@/components/settings/invitations-list'
import type { Invitation } from '@/lib/team'

// Einladungen eines Kunden aus Sicht des Betreibers: gleiche Liste wie die Team-Seite, mit Betreiber-Aktionen
export function OperatorInvitations({
  tenantId,
  invitations,
  readOnly,
}: {
  tenantId: string
  invitations: Invitation[]
  readOnly: boolean
}) {
  return (
    <InvitationsList
      invitations={invitations}
      readOnly={readOnly}
      actions={{
        resend: (invitationId) => resendOwnerInvitation({ tenantId, invitationId }),
        revoke: (invitationId) => revokeOwnerInvitation({ tenantId, invitationId }),
        errors: 'operator.errors',
      }}
    />
  )
}
