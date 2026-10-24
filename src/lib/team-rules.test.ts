import { describe, expect, it } from 'vitest'

import { memberActions } from './team-rules'

describe('Rechte im Team', () => {
  it('Inhaber kann Mitarbeiter zum Inhaber machen und entfernen', () => {
    expect(memberActions({ role: 'staff', isSelf: false }, 'owner', 1)).toEqual({ actions: ['promote', 'remove'], blocked: null })
  })

  it('andere Inhaber sind geschützt', () => {
    expect(memberActions({ role: 'owner', isSelf: false }, 'owner', 2)).toEqual({ actions: [], blocked: 'otherOwner' })
  })

  it('Inhaber kann sich selbst herabstufen oder austreten, wenn es weitere Inhaber gibt', () => {
    expect(memberActions({ role: 'owner', isSelf: true }, 'owner', 2)).toEqual({ actions: ['demoteSelf', 'leave'], blocked: null })
  })

  it('letzter Inhaber kann weder austreten noch sich herabstufen', () => {
    expect(memberActions({ role: 'owner', isSelf: true }, 'owner', 1)).toEqual({ actions: [], blocked: 'lastOwner' })
  })

  it('Mitarbeiter kann nur selbst austreten', () => {
    expect(memberActions({ role: 'staff', isSelf: true }, 'staff', 1)).toEqual({ actions: ['leave'], blocked: null })
    expect(memberActions({ role: 'staff', isSelf: false }, 'staff', 1)).toEqual({ actions: [], blocked: null })
  })
})

describe('Status einer Einladung', async () => {
  const { invitationStatus } = await import('./team')
  const now = Date.UTC(2026, 9, 23, 12)
  it('offen bis zum Ablauf, danach abgelaufen', () => {
    expect(invitationStatus('2026-10-23T12:00:01Z', now)).toBe('open')
    expect(invitationStatus('2026-10-23T12:00:00Z', now)).toBe('expired')
  })
})
