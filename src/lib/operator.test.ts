import { describe, expect, it } from 'vitest'

import { deleteConfirmed, displayStatus, inviteState, operatorMemberActions } from './operator'

describe('Angezeigter Kundenstatus', () => {
  it('deaktiviert geht vor, sonst „Einladung offen“ ohne Mitglied', () => {
    expect(displayStatus('deactivated', 3)).toBe('deactivated')
    expect(displayStatus('active', 0)).toBe('invited')
    expect(displayStatus('active', 1)).toBe('active')
  })

  it('kennzeichnet laufende, abgelaufene und fehlende Einladungen', () => {
    expect(inviteState([{ status: 'expired' }, { status: 'open' }])).toBe('open')
    expect(inviteState([{ status: 'expired' }])).toBe('expired')
    expect(inviteState([])).toBe('none')
  })
})

describe('Aktionen des Betreibers an Mitgliedern', () => {
  it('Mitarbeiter kann er nur befördern', () => {
    expect(operatorMemberActions({ role: 'staff' }, 1)).toEqual({ actions: ['promote'], blocked: null })
  })

  it('Inhaber herabstufen oder entfernen, solange ein weiterer bleibt', () => {
    expect(operatorMemberActions({ role: 'owner' }, 2)).toEqual({ actions: ['demote', 'remove'], blocked: null })
    expect(operatorMemberActions({ role: 'owner' }, 1)).toEqual({ actions: [], blocked: 'lastOwner' })
  })
})

describe('Bestätigung beim endgültigen Löschen', () => {
  it('verlangt den exakten Namen (Leerzeichen am Rand egal)', () => {
    expect(deleteConfirmed(' Pichler Ferienwohnungen ', 'Pichler Ferienwohnungen')).toBe(true)
    expect(deleteConfirmed('pichler ferienwohnungen', 'Pichler Ferienwohnungen')).toBe(false)
    expect(deleteConfirmed('', 'Pichler')).toBe(false)
  })
})
