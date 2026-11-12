// @vitest-environment node
//
// PROJ-19: Marketing-Einwilligung gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft die Datenbank: Erfassen von Hand
// (Inhaber und Mitarbeiter, alle Prüfungen, Hinweis „ändert den Stand nicht“), Stand am Gast, Irrtümlich-Markierung (nur
// Inhaber, nur von Hand, einmal), Unveränderlichkeit, Lesesicht, Filter der Gästeliste, Anonymisieren, Zusammenführen,
// Löschen, Speicherregeln der Belege, Bereinigung nur für den Server, Mandantentrennung.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const BUCKET = 'marketing-consent-receipts'

const daysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(d)
}

describe.skipIf(!hasSupabaseEnv)('PROJ-19 Marketing-Einwilligung', () => {
  let service: Client
  let owner: Client, staff: Client, ownerB: Client
  let ownerUser: TestUser, staffUser: TestUser
  const tenants: string[] = []
  let tenant: string, tenantB: string, apartment: string
  const runId = randomUUID().slice(0, 8)

  const newGuest = async (over: Record<string, unknown> = {}) => {
    const { data, error } = await service
      .from('guests')
      .insert({ tenant_id: tenant, last_name: `Huber ${runId}`, first_name: 'Anna', birth_date: '1990-05-01', ...over })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const record = (client: Client, guestId: string, over: Record<string, unknown> = {}) =>
    client.rpc('record_marketing_consent', {
      p_input: { tenant_id: tenant, guest_id: guestId, kind: 'grant', occurred_on: daysAgo(1), channel: 'email', note: null, receipt_path: null, ...over } as Json,
    })
  const upload = async (client: Client, tenantId = tenant) => {
    const path = `${tenantId}/${randomUUID()}.pdf`
    const { error } = await client.storage.from(BUCKET).upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    if (error) throw error
    return path
  }
  const state = async (guestId: string) => {
    const { data } = await service.from('guests').select('marketing_consent_state, marketing_consent_on').eq('id', guestId).single()
    return data
  }
  // Testkonten haben meist keinen Anzeigenamen: die Lesesicht muss den Namen aus dem Profil liefern
  const nameOf = async (userId: string) => {
    await service.from('profiles').update({ display_name: `Person ${runId}` }).eq('id', userId)
    return `Person ${runId}`
  }
  const events = async (guestId: string) => {
    const { data } = await service.from('marketing_consent_events').select('*').eq('guest_id', guestId).order('occurred_on').order('created_at')
    return data ?? []
  }

  beforeAll(async () => {
    service = serviceClient()
    const o = await sharedClient('ownerA')
    const s = await sharedClient('staffA')
    const ob = await sharedClient('ownerB')
    owner = o.client
    staff = s.client
    ownerB = ob.client
    ownerUser = o.user
    staffUser = s.user
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-19 Test ${name} ${runId}` }).select('id').single()
      if (error) throw error
      tenants.push(t.id)
    }
    ;[tenant, tenantB] = tenants
    await service.from('memberships').insert([
      { tenant_id: tenant, user_id: ownerUser.id, role: 'owner' },
      { tenant_id: tenant, user_id: staffUser.id, role: 'staff' },
      { tenant_id: tenantB, user_id: ob.user.id, role: 'owner' },
    ])
    const { data: property } = await service
      .from('properties')
      .insert({ tenant_id: tenant, name: `Haus ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data: ap } = await service.from('apartments').insert({ tenant_id: tenant, property_id: property!.id, name: `Top ${runId}`, max_guests: 4, price_cents: 10000 }).select('id').single()
    apartment = ap!.id
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { data } = await service.storage.from(BUCKET).list(id, { limit: 1000 })
      if (data?.length) await service.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`))
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  }, 60_000)

  it('Mitarbeiter erfassen eine Erteilung mit Beleg; Stand, Lesesicht und Protokoll', async () => {
    const guest = await newGuest()
    const receipt = await upload(staff)
    const { data, error } = await record(staff, guest, { note: '  Mail vom 3.12.  ', receipt_path: receipt })
    expect(error).toBeNull()
    const result = data as { saved: boolean; id: string; warnings: unknown[] }
    expect(result).toMatchObject({ saved: true, warnings: [] })
    expect(await state(guest)).toEqual({ marketing_consent_state: 'granted', marketing_consent_on: daysAgo(1) })
    const [entry] = await events(guest)
    expect(entry).toMatchObject({ kind: 'grant', origin: 'manual', channel: 'email', note: 'Mail vom 3.12.', receipt_path: receipt, created_by: staffUser.id })

    const name = await nameOf(staffUser.id)
    const { data: history } = await staff.from('marketing_consent_history').select('id, created_by, created_by_name, voided_by_name').eq('guest_id', guest)
    expect(history).toEqual([{ id: result.id, created_by: staffUser.id, created_by_name: name, voided_by_name: null }])
    const { data: audit } = await service.from('audit_log').select('action').eq('table_name', 'marketing_consent_events').eq('record_id', result.id)
    expect(audit).toEqual([{ action: 'insert' }])

    // Beleg lesbar für Mitglieder, nicht für andere Kunden
    expect((await staff.storage.from(BUCKET).createSignedUrl(receipt, 60)).error).toBeNull()
    expect((await ownerB.storage.from(BUCKET).createSignedUrl(receipt, 60)).error).not.toBeNull()
    // Beleg lässt sich nur einmal verwenden
    expect((await record(staff, guest, { receipt_path: receipt })).error?.code).toBe('P0988')
  })

  it('prüft Datum, Weg, Widerruf ohne Erteilung, Beleg, Gast und Mitgliedschaft', async () => {
    const guest = await newGuest()
    expect((await record(staff, guest, { occurred_on: daysAgo(-1) })).error?.code).toBe('P0994')
    expect((await record(staff, guest, { occurred_on: '1990-04-30' })).error?.code).toBe('P0995')
    expect((await record(staff, guest, { channel: 'oral' })).error?.code).toBe('P0996')
    expect((await record(staff, guest, { channel: 'fax' })).error?.code).toBe('P0996')
    expect((await record(staff, guest, { kind: 'revoke' })).error?.code).toBe('P0997')
    expect((await record(staff, guest, { receipt_path: `${tenant}/${randomUUID()}.pdf` })).error?.code).toBe('P0988')
    const foreign = await upload(ownerB, tenantB)
    expect((await record(staff, guest, { receipt_path: foreign })).error?.code).toBe('P0988')
    expect((await record(staff, randomUUID())).error?.code).toBe('P0992')
    expect((await ownerB.rpc('record_marketing_consent', { p_input: { tenant_id: tenant, guest_id: guest, kind: 'grant', occurred_on: daysAgo(1), channel: 'email' } as Json })).error?.code).toBe('42501')
    expect((await ownerB.rpc('record_marketing_consent', { p_input: { tenant_id: tenantB, guest_id: guest, kind: 'grant', occurred_on: daysAgo(1), channel: 'email' } as Json })).error?.code).toBe('P0992')
    // Ohne Geburtsdatum entfällt die Prüfung
    const noBirth = await newGuest({ birth_date: null })
    expect((await record(staff, noBirth, { occurred_on: '1950-01-01' })).error).toBeNull()
    expect(await events(guest)).toHaveLength(0)
  })

  it('Widerruf: mündlich erlaubt; vor dem maßgeblichen Eintrag erst nach Bestätigung, ohne Wirkung auf den Stand', async () => {
    const guest = await newGuest()
    await record(staff, guest, { occurred_on: daysAgo(5) })
    const early = await record(staff, guest, { kind: 'revoke', occurred_on: daysAgo(10), channel: 'oral' })
    expect(early.error).toBeNull()
    expect(early.data).toEqual({ saved: false, warnings: [{ code: 'notEffective', latestOn: daysAgo(5), latestKind: 'grant' }] })
    expect(await events(guest)).toHaveLength(1)
    const confirmed = await record(staff, guest, { kind: 'revoke', occurred_on: daysAgo(10), channel: 'oral', confirmed: true })
    expect((confirmed.data as { saved: boolean }).saved).toBe(true)
    expect((await state(guest))!.marketing_consent_state).toBe('granted')

    // Gleiches Datum: der später erfasste Eintrag zählt
    await record(staff, guest, { kind: 'revoke', occurred_on: daysAgo(5), channel: 'oral' })
    expect(await state(guest)).toEqual({ marketing_consent_state: 'revoked', marketing_consent_on: daysAgo(5) })
    // Neue Erteilung nach Widerruf gilt wieder
    await record(owner, guest, { occurred_on: daysAgo(1), channel: 'paper' })
    expect(await state(guest)).toEqual({ marketing_consent_state: 'granted', marketing_consent_on: daysAgo(1) })
  })

  it('Irrtümlich markieren: nur Inhaber, nur von Hand, einmal; Stand neu berechnet', async () => {
    const guest = await newGuest()
    await record(staff, guest, { occurred_on: daysAgo(4) })
    const revoke = await record(staff, guest, { kind: 'revoke', occurred_on: daysAgo(2), channel: 'other' })
    const revokeId = (revoke.data as { id: string }).id
    expect((await state(guest))!.marketing_consent_state).toBe('revoked')

    expect((await staff.rpc('void_marketing_consent', { p_entry_id: revokeId, p_reason: 'falscher Gast' })).error?.code).toBe('42501')
    expect((await ownerB.rpc('void_marketing_consent', { p_entry_id: revokeId, p_reason: 'falscher Gast' })).error?.code).toBe('P0992')
    expect((await owner.rpc('void_marketing_consent', { p_entry_id: revokeId, p_reason: '   ' })).error?.code).toBe('22023')
    expect((await owner.rpc('void_marketing_consent', { p_entry_id: revokeId, p_reason: ' falscher Gast ' })).error).toBeNull()
    expect(await state(guest)).toEqual({ marketing_consent_state: 'granted', marketing_consent_on: daysAgo(4) })
    const voided = (await events(guest)).find((e) => e.id === revokeId)!
    expect(voided).toMatchObject({ void_reason: 'falscher Gast', voided_by: ownerUser.id })
    expect((await owner.rpc('void_marketing_consent', { p_entry_id: revokeId, p_reason: 'nochmal' })).error?.code).toBe('P0999')

    const name = await nameOf(ownerUser.id)
    const { data: history } = await staff.from('marketing_consent_history').select('voided_by, voided_by_name').eq('id', revokeId).single()
    expect(history).toEqual({ voided_by: ownerUser.id, voided_by_name: name })
  })

  it('Einträge sind unveränderlich und nur über die Funktionen anzulegen', async () => {
    const guest = await newGuest()
    const { data } = await record(staff, guest, { note: 'erste Notiz' })
    const id = (data as { id: string }).id
    expect((await service.from('marketing_consent_events').update({ note: 'geändert' }).eq('id', id)).error?.code).toBe('P0989')
    expect((await service.from('marketing_consent_events').update({ occurred_on: daysAgo(3) }).eq('id', id)).error?.code).toBe('P0989')
    expect((await service.from('marketing_consent_events').update({ note: null }).eq('id', id)).error?.code).toBe('P0989')
    expect((await service.from('marketing_consent_events').delete().eq('id', id)).error?.code).toBe('P0989')
    const direct = await owner.from('marketing_consent_events').insert({ tenant_id: tenant, guest_id: guest, kind: 'grant', origin: 'manual', occurred_on: daysAgo(1), channel: 'email' })
    expect(direct.error).not.toBeNull()
    const sneaky = await owner.from('marketing_consent_events').update({ void_reason: 'x' }).eq('id', id).select()
    expect(sneaky.data ?? []).toHaveLength(0)
    // Andere Kunden sehen nichts
    expect((await ownerB.from('marketing_consent_events').select('id').eq('id', id)).data).toEqual([])
    expect((await ownerB.from('marketing_consent_history').select('id').eq('guest_id', guest)).data).toEqual([])
  })

  it('Filter in der Gästeliste nach Stand', async () => {
    const granted = await newGuest({ last_name: `Filter ${runId}`, first_name: 'Erteilt' })
    const revoked = await newGuest({ last_name: `Filter ${runId}`, first_name: 'Widerrufen' })
    const none = await newGuest({ last_name: `Filter ${runId}`, first_name: 'Keine' })
    await record(staff, granted)
    await record(staff, revoked, { occurred_on: daysAgo(3) })
    await record(staff, revoked, { kind: 'revoke', occurred_on: daysAgo(1), channel: 'oral' })
    const list = async (consent: string | undefined) => {
      const { data, error } = await staff.rpc('guest_list', { p_tenant_id: tenant, p_query: `Filter ${runId}`, p_consent: consent })
      expect(error).toBeNull()
      return (data ?? []).map((r) => r.id).sort()
    }
    expect(await list('granted')).toEqual([granted])
    expect(await list('revoked')).toEqual([revoked])
    expect(await list('none')).toEqual([none])
    expect(await list(undefined)).toEqual([granted, revoked, none].sort())
  })

  it('Anonymisieren behält den Verlauf ohne Notizen und Belege, Stand „keine“, neue Einträge gesperrt', async () => {
    const guest = await newGuest()
    const receipt = await upload(staff)
    const first = await record(staff, guest, { note: 'Notiz mit Daten', receipt_path: receipt })
    const firstId = (first.data as { id: string }).id
    const { error: bookingError } = await owner.rpc('save_booking', {
      p_input: {
        tenant_id: tenant, kind: 'booking', apartment_id: apartment, arrival: '2028-07-01', planned_departure: '2028-07-04', departure: '2028-07-04',
        guest_id: guest, adults: 1, child_ages: [], source: 'none', amounts: { nights_cents: 30000, nights_vat_rate: '10.00', charges: [] },
      } as Json,
      p_confirm: true,
    })
    expect(bookingError).toBeNull()
    const { data: mode, error } = await owner.rpc('delete_guest', { p_guest_id: guest })
    expect(error).toBeNull()
    expect(mode).toBe('anonymized')
    expect(await state(guest)).toEqual({ marketing_consent_state: 'none', marketing_consent_on: null })
    const [entry] = await events(guest)
    expect(entry).toMatchObject({ kind: 'grant', channel: 'email', note: null, receipt_path: null, created_by: staffUser.id })
    const { data: audit } = await service.from('audit_log').select('old_data, new_data').eq('table_name', 'marketing_consent_events').eq('record_id', firstId)
    expect(audit!.every((a) => a.old_data === null && a.new_data === null)).toBe(true)
    expect((await record(staff, guest)).error?.code).toBe('P0993')
    expect((await owner.rpc('void_marketing_consent', { p_entry_id: firstId, p_reason: 'x' })).error?.code).toBe('P0993')
    // Datei hängt an keinem Eintrag mehr: nicht mehr lesbar
    expect((await staff.storage.from(BUCKET).createSignedUrl(receipt, 60)).error).not.toBeNull()
  })

  it('Zusammenführen vereint die Verläufe; ein jüngerer Widerruf bleibt maßgeblich', async () => {
    const keep = await newGuest({ last_name: `Keep ${runId}` })
    const remove = await newGuest({ last_name: `Remove ${runId}` })
    await record(staff, keep, { occurred_on: daysAgo(3) })
    await record(staff, remove, { occurred_on: daysAgo(10) })
    await record(staff, remove, { kind: 'revoke', occurred_on: daysAgo(2), channel: 'oral' })
    const { error } = await owner.rpc('merge_guests', { p_keep: keep, p_remove: remove, p_choice: {} as Json })
    expect(error).toBeNull()
    expect(await events(keep)).toHaveLength(3)
    expect(await state(keep)).toEqual({ marketing_consent_state: 'revoked', marketing_consent_on: daysAgo(2) })
  })

  it('Gast ohne Buchungen löschen entfernt auch den Verlauf', async () => {
    const guest = await newGuest()
    const { data } = await record(staff, guest, { note: 'weg damit' })
    const id = (data as { id: string }).id
    const { data: mode, error } = await owner.rpc('delete_guest', { p_guest_id: guest })
    expect(error).toBeNull()
    expect(mode).toBe('deleted')
    expect(await events(guest)).toHaveLength(0)
    const { data: audit } = await service.from('audit_log').select('new_data').eq('table_name', 'marketing_consent_events').eq('record_id', id)
    expect(audit!.every((a) => a.new_data === null)).toBe(true)
  })

  it('Speicher und Bereinigung: Hochladen nur in den eigenen Ordner, Liste unbenutzter Belege nur für den Server', async () => {
    await expect(upload(staff, tenantB)).rejects.toBeTruthy()
    const unused = await upload(staff)
    expect((await staff.storage.from(BUCKET).createSignedUrl(unused, 60)).error).not.toBeNull()
    expect((await owner.rpc('unused_marketing_consent_receipts', { p_limit: 10 })).error).not.toBeNull()
    expect((await service.rpc('unused_marketing_consent_receipts', { p_limit: 10 })).error).toBeNull()
    expect((await staff.storage.from(BUCKET).remove([unused])).data ?? []).toHaveLength(0)
  })
})
