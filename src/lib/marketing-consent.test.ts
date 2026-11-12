import { describe, expect, it } from 'vitest'

import { channelsFor, consentDbError, hasOwnContact, parseConsentFilter, receiptTypeOf } from '@/lib/marketing-consent'
import { consentSchema, voidSchema } from '@/lib/validation/marketing-consent'

const key = (k: string) => k
const contact = { email: null, emailSource: 'direct' as const, street: null, postalCode: null, city: null }

describe('Marketing-Einwilligung (PROJ-19)', () => {
  it('bietet „mündlich/telefonisch“ nur beim Widerruf an', () => {
    expect(channelsFor('grant')).not.toContain('oral')
    expect(channelsFor('revoke')).toContain('oral')
  })

  it('zählt nur direkt erfasste E-Mail-Adressen oder eine Anschrift als eigene Kontaktmöglichkeit', () => {
    expect(hasOwnContact(contact)).toBe(false)
    expect(hasOwnContact({ ...contact, email: 'anna@example.at' })).toBe(true)
    expect(hasOwnContact({ ...contact, email: 'x@guest.booking.com', emailSource: 'platform' })).toBe(false)
    expect(hasOwnContact({ ...contact, street: 'Hauptplatz 1', city: 'Graz' })).toBe(true)
    expect(hasOwnContact({ ...contact, street: 'Hauptplatz 1' })).toBe(false)
  })

  it('liest den Filter aus der Adresse', () => {
    expect(parseConsentFilter('erteilt')).toBe('granted')
    expect(parseConsentFilter('granted')).toBeNull()
  })

  it('übersetzt Datenbankfehler je Aktion (QA BUG-1)', () => {
    expect(consentDbError('P0016', 'record')).toBe('tenantDeactivated')
    expect(consentDbError('P0016', 'void')).toBe('tenantDeactivated')
    expect(consentDbError('42501', 'record')).toBe('notMember')
    expect(consentDbError('42501', 'void')).toBe('ownerOnly')
    expect(consentDbError('P0997', 'record')).toBe('consentNotGranted')
    expect(consentDbError('XX000', 'record')).toBeNull()
    expect(consentDbError(undefined, 'record')).toBeNull()
  })

  it('erkennt die Belegart am Speicherort', () => {
    expect(receiptTypeOf('t/a.pdf')).toBe('pdf')
    expect(receiptTypeOf('t/a.jpg')).toBe('image')
  })
})

describe('Prüfregeln Erteilung/Widerruf', () => {
  const valid = { occurredOn: '2026-11-10', channel: 'email', note: '', receiptPath: '' }

  it('verlangt Datum und Weg', () => {
    const schema = consentSchema(key, { kind: 'grant', today: '2026-11-11' })
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, occurredOn: '' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, channel: '' }).success).toBe(false)
  })

  it('lehnt Datum in der Zukunft und vor dem Geburtsdatum ab', () => {
    const schema = consentSchema(key, { kind: 'grant', today: '2026-11-11', birthDate: '1990-05-01' })
    expect(schema.safeParse({ ...valid, occurredOn: '2026-11-12' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, occurredOn: '1990-04-30' }).success).toBe(false)
  })

  it('erlaubt „mündlich“ nur beim Widerruf', () => {
    expect(consentSchema(key, { kind: 'grant', today: '2026-11-11' }).safeParse({ ...valid, channel: 'oral' }).success).toBe(false)
    expect(consentSchema(key, { kind: 'revoke', today: '2026-11-11' }).safeParse({ ...valid, channel: 'oral' }).success).toBe(true)
  })

  it('begrenzt die Notiz und lässt leere Werte als null durch', () => {
    const schema = consentSchema(key, { kind: 'grant', today: '2026-11-11' })
    expect(schema.safeParse({ ...valid, note: 'x'.repeat(501) }).success).toBe(false)
    const parsed = schema.parse(valid)
    expect(parsed.note).toBeNull()
    expect(parsed.receiptPath).toBeNull()
  })

  it('verlangt beim Markieren als irrtümlich einen Grund', () => {
    expect(voidSchema(key).safeParse({ reason: '  ' }).success).toBe(false)
    expect(voidSchema(key).safeParse({ reason: 'falscher Gast' }).success).toBe(true)
    expect(voidSchema(key).safeParse({ reason: 'x'.repeat(201) }).success).toBe(false)
  })
})
