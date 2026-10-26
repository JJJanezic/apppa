import { describe, expect, it } from 'vitest'

import messages from '../../../messages/de.json'
import { inviteSchema } from './team'

const v = messages.team.validation as Record<string, string>
const t = (key: string) => v[key] ?? key
const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? null : r.error!.issues[0].message)

describe('Einladen', () => {
  it('normalisiert die Adresse und übernimmt die Rolle', () => {
    const r = inviteSchema(t).safeParse({ email: ' Maria@Example.AT ', role: 'staff' })
    expect(r.success && r.data).toEqual({ email: 'maria@example.at', role: 'staff' })
  })

  it('meldet leere und ungültige Adressen', () => {
    expect(firstError(inviteSchema(t).safeParse({ email: '', role: 'staff' }))).toBe(v.emailRequired)
    expect(firstError(inviteSchema(t).safeParse({ email: 'keine-adresse', role: 'staff' }))).toBe(v.emailInvalid)
  })

  it('verlangt Inhaber oder Mitarbeiter', () => {
    expect(firstError(inviteSchema(t).safeParse({ email: 'a@b.at', role: 'admin' }))).toBe(v.roleRequired)
  })
})
