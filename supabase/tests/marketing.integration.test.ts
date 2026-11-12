// @vitest-environment node
//
// PROJ-52: Marketing gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft die Datenbank: bewerbbare Gäste (Einwilligung,
// eigene Kontaktmöglichkeit, Plattform-Daten ausgeblendet), alle Filter, Zählweise der Aufenthalte, Blättern, nur Inhaber,
// Segmente (Zugriffsregeln, eindeutiger Name), Protokolleintrag je Export, Mandantentrennung.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

type Row = { id: string; email: string | null; phone: string | null; stay_count: number; last_stay: string | null; consent_on: string; company_name: string | null }
type List = { total: number; without_contact: number; rows: Row[] }

const iso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(d)
const day = (offset: number) => iso(new Date(Date.now() + offset * 86_400_000))

describe.skipIf(!hasSupabaseEnv)('PROJ-52 Marketing', () => {
  let service: Client
  let owner: Client, staff: Client, ownerB: Client
  let ownerUser: TestUser
  const tenants: string[] = []
  let tenant: string, tenantB: string
  let propA: string, aptA1: string, aptA2: string, propB: string, aptB1: string
  const runId = randomUUID().slice(0, 8)
  let seq = 0

  const newGuest = async (over: Record<string, unknown> = {}, consent = true) => {
    const { data, error } = await service
      .from('guests')
      .insert({ tenant_id: tenant, last_name: `Gast ${runId}`, first_name: 'Anna', email: `g${randomUUID().slice(0, 6)}@example.at`, ...over })
      .select('id')
      .single()
    if (error) throw error
    if (consent) {
      const { error: e } = await service
        .from('marketing_consent_events')
        .insert({ tenant_id: tenant, guest_id: data.id, kind: 'grant', origin: 'manual', channel: 'email', occurred_on: day(-30) })
      if (e) throw e
    }
    return data.id
  }
  const stay = async (guestId: string, over: { arrival?: string; nights?: number; apartment?: string; source?: string; kind?: string; cancelled?: boolean } = {}) => {
    seq++
    const arrival = over.arrival ?? day(-100 - seq * 5)
    const departure = iso(new Date(new Date(`${arrival}T12:00:00Z`).getTime() + (over.nights ?? 3) * 86_400_000))
    const { error } = await service.from('bookings').insert({
      tenant_id: tenant,
      apartment_id: over.apartment ?? aptA1,
      kind: over.kind ?? 'booking',
      arrival,
      planned_departure: departure,
      departure,
      guest_id: guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: 1,
      number_year: 2025,
      number_seq: 500 + seq,
      source: over.source ?? 'none',
      option_until: over.kind === 'option' ? day(10) : null,
      cancelled_at: over.cancelled ? new Date().toISOString() : null,
      cancel_reason: over.cancelled ? 'QA' : null,
    } as never)
    if (error) throw error
  }
  const list = async (client: Client, filters: Record<string, unknown> = {}, limit: number | null = 50, offset = 0, tenantId = tenant) => {
    const { data, error } = await client.rpc('marketing_guest_list', { p_tenant_id: tenantId, p_filters: filters as Json, p_limit: limit as number, p_offset: offset })
    return { data: data as unknown as List, error }
  }
  const ids = (l: List) => l.rows.map((r) => r.id).sort()

  beforeAll(async () => {
    service = serviceClient()
    const o = await sharedClient('ownerA')
    const s = await sharedClient('staffA')
    const ob = await sharedClient('ownerB')
    owner = o.client
    staff = s.client
    ownerB = ob.client
    ownerUser = o.user
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-52 Test ${name} ${runId}` }).select('id').single()
      if (error) throw error
      tenants.push(t.id)
    }
    ;[tenant, tenantB] = tenants
    await service.from('memberships').insert([
      { tenant_id: tenant, user_id: ownerUser.id, role: 'owner' },
      { tenant_id: tenant, user_id: s.user.id, role: 'staff' },
      { tenant_id: tenantB, user_id: ob.user.id, role: 'owner' },
    ])
    const property = async (name: string) =>
      (await service.from('properties').insert({ tenant_id: tenant, name, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' }).select('id').single()).data!.id
    const apartment = async (prop: string, name: string) =>
      (await service.from('apartments').insert({ tenant_id: tenant, property_id: prop, name, max_guests: 4, price_cents: 10000 }).select('id').single()).data!.id
    propA = await property(`Haus A ${runId}`)
    propB = await property(`Haus B ${runId}`)
    aptA1 = await apartment(propA, 'Top 1')
    aptA2 = await apartment(propA, 'Top 2')
    aptB1 = await apartment(propB, 'Top 1')
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  }, 60_000)

  it('nur Gäste mit Einwilligung und eigener Kontaktmöglichkeit; Plattform-Daten ausgeblendet', async () => {
    const withEmail = await newGuest({ phone: '+43 660 1234567' })
    const withPost = await newGuest({ email: null, street: 'Hauptplatz 1', city: 'Graz' })
    const platformOnly = await newGuest({ email: 'x@guest.booking.com', email_source: 'platform' })
    const platformAndPost = await newGuest({ email: 'y@guest.booking.com', email_source: 'platform', phone: '+1 555', phone_source: 'platform', street: 'Weg 2', postal_code: '8010' })
    const noConsent = await newGuest({}, false)
    const revoked = await newGuest()
    await service.from('marketing_consent_events').insert({ tenant_id: tenant, guest_id: revoked, kind: 'revoke', origin: 'manual', channel: 'oral', occurred_on: day(-1) })

    const { data, error } = await list(owner, { languages: ['none'] })
    expect(error).toBeNull()
    expect(ids(data)).toEqual([withEmail, withPost, platformAndPost].sort())
    expect(data.without_contact).toBeGreaterThanOrEqual(1)
    const mixed = data.rows.find((r) => r.id === platformAndPost)!
    expect(mixed.email).toBeNull()
    expect(mixed.phone).toBeNull()
    expect(data.rows.find((r) => r.id === withEmail)!.phone).toBe('+43 660 1234567')
    expect(ids(data)).not.toContain(platformOnly)
    expect(ids(data)).not.toContain(noConsent)
    expect(ids(data)).not.toContain(revoked)

    expect(ids((await list(owner, { languages: ['none'], reach: 'email' })).data)).toEqual([withEmail])
    expect(ids((await list(owner, { languages: ['none'], reach: 'post' })).data)).toEqual([withPost, platformAndPost].sort())
  })

  it('nur Inhaber; andere Kunden und Mitarbeiter werden abgelehnt', async () => {
    expect((await list(staff)).error?.code).toBe('42501')
    expect((await list(ownerB)).error?.code).toBe('42501')
    expect((await list(ownerB, {}, 50, 0, tenantB)).error).toBeNull()
  })

  it('Aufenthalte: Anzahl über alle Zeit, nur angetretene Buchungen; Zeitraum, Wohnung, Objekt, Quelle', async () => {
    const lang = 'hu'
    const two = await newGuest({ language: lang })
    await stay(two, { arrival: '2025-07-10', apartment: aptA1, source: 'website' })
    await stay(two, { arrival: '2025-01-10', apartment: aptB1, source: 'booking_com' })
    const one = await newGuest({ language: lang })
    await stay(one, { arrival: '2025-06-28', nights: 5, apartment: aptA2, source: 'booking_com' })
    const notYet = await newGuest({ language: lang })
    await stay(notYet, { arrival: day(20) })
    await stay(notYet, { arrival: '2025-03-01', cancelled: true })
    await stay(notYet, { arrival: '2025-03-10', kind: 'option' })
    const none = await newGuest({ language: lang })

    const base = { languages: [lang] }
    const all = (await list(owner, base)).data
    expect(ids(all)).toEqual([two, one, notYet, none].sort())
    expect(all.rows.find((r) => r.id === two)).toMatchObject({ stay_count: 2, last_stay: '2025-07-10' })
    expect(all.rows.find((r) => r.id === notYet)).toMatchObject({ stay_count: 0, last_stay: null })

    expect(ids((await list(owner, { ...base, minStays: 1 })).data)).toEqual([two, one].sort())
    expect(ids((await list(owner, { ...base, minStays: 2 })).data)).toEqual([two])
    // Zeitraum: Juli 2025 überschneidet den Aufenthalt vom 28.06. bis 03.07.
    expect(ids((await list(owner, { ...base, from: '2025-07', to: '2025-07' })).data)).toEqual([two, one].sort())
    expect(ids((await list(owner, { ...base, from: '2025-01', to: '2025-02' })).data)).toEqual([two])
    expect(ids((await list(owner, { ...base, to: '2025-02' })).data)).toEqual([two])
    expect(ids((await list(owner, { ...base, apartments: [aptA2] })).data)).toEqual([one])
    expect(ids((await list(owner, { ...base, properties: [propA] })).data)).toEqual([two, one].sort())
    expect(ids((await list(owner, { ...base, properties: [propB] })).data)).toEqual([two])
    expect(ids((await list(owner, { ...base, sources: ['website'] })).data)).toEqual([two])
    // Quelle und Zeitraum wirken auf denselben Aufenthalt
    expect(ids((await list(owner, { ...base, sources: ['website'], from: '2025-01', to: '2025-02' })).data)).toEqual([])
    expect(ids((await list(owner, { ...base, sources: ['booking_com'], minStays: 2 })).data)).toEqual([two])
    // gelöschte Wohnung (unbekannte ID): keine Treffer statt alle
    expect(ids((await list(owner, { ...base, apartments: [randomUUID()] })).data)).toEqual([])
  })

  it('Herkunftsland (Adresse) und Sprache inkl. „keine Angabe“', async () => {
    const de = await newGuest({ address_country: 'DE', language: 'it' })
    const at = await newGuest({ address_country: 'AT', language: null })
    const both = { languages: ['it', 'none'] }
    expect(ids((await list(owner, { ...both, countries: ['DE'] })).data)).toEqual([de])
    expect(ids((await list(owner, { ...both, countries: ['AT', 'DE'] })).data)).toEqual([de, at].sort())
    expect(ids((await list(owner, { languages: ['it'] })).data)).toContain(de)
    expect(ids((await list(owner, { languages: ['it'] })).data)).not.toContain(at)
  })

  it('Blättern, Gesamtzahl, alle Zeilen für den Export, Firma und eingewilligt seit', async () => {
    const { data: company } = await service.from('companies').insert({ tenant_id: tenant, name: `Firma ${runId}` } as never).select('id').single()
    const lang = 'sl'
    for (let i = 0; i < 5; i++) await newGuest({ language: lang, last_name: `Blatt ${i} ${runId}`, company_id: i === 0 ? (company as { id: string }).id : null })
    const page1 = (await list(owner, { languages: [lang] }, 2, 0)).data
    const page3 = (await list(owner, { languages: [lang] }, 2, 4)).data
    expect(page1.total).toBe(5)
    expect(page1.rows).toHaveLength(2)
    expect(page3.rows).toHaveLength(1)
    expect(page1.rows[0].company_name).toBe(`Firma ${runId}`)
    expect(page1.rows[0].consent_on).toBe(day(-30))
    expect((await list(owner, { languages: [lang] }, null)).data.rows).toHaveLength(5)
  })

  it('Segmente: nur Inhaber, Name je Kunde eindeutig, Mandantentrennung', async () => {
    const { data: seg, error } = await owner
      .from('marketing_segments')
      .insert({ tenant_id: tenant, name: 'Stammgäste DE', filters: { countries: ['DE'], minStays: 2 } })
      .select('id, created_by')
      .single()
    expect(error).toBeNull()
    expect(seg!.created_by).toBe(ownerUser.id)
    expect((await owner.from('marketing_segments').insert({ tenant_id: tenant, name: 'stammgäste de', filters: {} })).error?.code).toBe('23505')
    expect((await owner.from('marketing_segments').insert({ tenant_id: tenant, name: ' ', filters: {} })).error).not.toBeNull()
    expect((await ownerB.from('marketing_segments').insert({ tenant_id: tenantB, name: 'Stammgäste DE', filters: {} })).error).toBeNull()

    expect((await staff.from('marketing_segments').select('id').eq('tenant_id', tenant)).data).toEqual([])
    expect((await staff.from('marketing_segments').insert({ tenant_id: tenant, name: 'Mitarbeiter', filters: {} })).error).not.toBeNull()
    expect((await ownerB.from('marketing_segments').select('id').eq('id', seg!.id)).data).toEqual([])
    const sneaky = await ownerB.from('marketing_segments').update({ name: 'gekapert' }).eq('id', seg!.id).select()
    expect(sneaky.data ?? []).toHaveLength(0)

    const { data: renamed } = await owner.from('marketing_segments').update({ name: 'Stammgäste Deutschland' }).eq('id', seg!.id).select('name, updated_at').single()
    expect(renamed!.name).toBe('Stammgäste Deutschland')
    const { data: audit } = await service.from('audit_log').select('action').eq('table_name', 'marketing_segments').eq('record_id', seg!.id).order('id')
    expect(audit!.map((a) => a.action)).toEqual(['insert', 'update'])
    expect((await owner.from('marketing_segments').delete().eq('id', seg!.id)).error).toBeNull()
  })

  it('Export-Protokoll: nur Inhaber, mit Filtern, Segment und Anzahl, ohne Gastdaten', async () => {
    const { data: seg } = await owner.from('marketing_segments').insert({ tenant_id: tenant, name: `Export ${runId}`, filters: {} }).select('id').single()
    const filters = { countries: ['DE'] }
    expect((await staff.rpc('log_marketing_export', { p_tenant_id: tenant, p_filters: filters as Json, p_segment_id: seg!.id, p_count: 3 })).error?.code).toBe('42501')
    expect((await ownerB.rpc('log_marketing_export', { p_tenant_id: tenant, p_filters: filters as Json, p_segment_id: seg!.id, p_count: 3 })).error?.code).toBe('42501')
    expect((await owner.rpc('log_marketing_export', { p_tenant_id: tenant, p_filters: filters as Json, p_segment_id: seg!.id, p_count: 3 })).error).toBeNull()
    const { data } = await service
      .from('audit_log')
      .select('actor_id, new_data')
      .eq('tenant_id', tenant)
      .eq('table_name', 'marketing_exports')
      .order('id', { ascending: false })
      .limit(1)
      .single()
    expect(data!.actor_id).toBe(ownerUser.id)
    expect(data!.new_data).toEqual({ filters, segment_id: seg!.id, segment_name: `Export ${runId}`, count: 3 })
  })
})
