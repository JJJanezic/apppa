import type { Role } from '@/lib/navigation'

// Wer darf was im Team (PROJ-4)? Reine Regeln für die Oberfläche; die Datenbank setzt dieselben Regeln durch.
// - Inhaber machen Mitarbeiter zu Inhabern und entfernen Mitarbeiter
// - andere Inhaber sind geschützt (nur der Betreiber kann sie herabstufen oder entfernen)
// - jede Person kann sich selbst herabstufen (Inhaber) oder das Team verlassen – außer dem letzten Inhaber

export type MemberAction = 'promote' | 'remove' | 'demoteSelf' | 'leave'

// Warum eine Aktion fehlt: für den Hinweis in der Oberfläche
export type MemberActionBlock = 'otherOwner' | 'lastOwner' | null

export type MemberActionState = {
  actions: MemberAction[]
  blocked: MemberActionBlock
}

export function memberActions(
  member: { role: Role; isSelf: boolean },
  viewerRole: Role,
  ownerCount: number
): MemberActionState {
  const lastOwner = member.role === 'owner' && ownerCount <= 1

  if (member.isSelf) {
    if (lastOwner) return { actions: [], blocked: 'lastOwner' }
    return { actions: member.role === 'owner' ? ['demoteSelf', 'leave'] : ['leave'], blocked: null }
  }

  if (viewerRole !== 'owner') return { actions: [], blocked: null }
  if (member.role === 'owner') return { actions: [], blocked: 'otherOwner' }
  return { actions: ['promote', 'remove'], blocked: null }
}
