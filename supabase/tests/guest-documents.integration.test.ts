// @vitest-environment node
//
// PROJ-29: Titel, Geschlecht, Reisedokument und Ausweisbilder gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, createTestUser, hasSupabaseEnv, serviceClient, signIn, type TestUser } from './helpers'

const BUCKET = 'guest-documents'
// Kleinstes gültiges JPEG (1×1 Pixel)
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
)

describe.skipIf(!hasSupabaseEnv)('PROJ-29 Titel, Geschlecht, Reisedokument', () => {
  let service: Client
  const users: TestUser[] = []
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client
  const runId = randomUUID().slice(0, 8)

  const user = async () => {
    const u = await createTestUser(service)
    users.push(u)
    return u
  }
  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-29 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  const path = (tenantId: string) => `${tenantId}/${randomUUID()}.jpg`
  // Hochladen im Namen der Person (Zugriffsregeln des Speichers gelten)
  const upload = async (client: Client, tenantId: string) => {
    const p = path(tenantId)
    const { error } = await client.storage.from(BUCKET).upload(p, JPEG, { contentType: 'image/jpeg' })
    if (error) throw error
    return p
  }
  const guest = async (client: Client, tenantId: string, fields: Record<string, string | null> = {}) => {
    const { data, error } = await client
      .from('guests')
      .insert({ tenant_id: tenantId, last_name: `Gast ${runId}`, country: 'AT', ...fields })
      .select('id')
      .single()
    return { id: data?.id ?? '', error }
  }
  const canRead = async (client: Client, p: string) => {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(p, 60)
    return !error && Boolean(data?.signedUrl)
  }

  beforeAll(async () => {
    service = serviceClient()
    const [a, s, b] = await Promise.all([user(), user(), user()])
    tenantA = await newTenant([
      [a, 'owner'],
      [s, 'staff'],
    ])
    tenantB = await newTenant([[b, 'owner']])
    ;[ownerA, staffA, ownerB] = await Promise.all([signIn(a), signIn(s), signIn(b)])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { data } = await service.storage.from(BUCKET).list(id, { limit: 1000 })
      if (data?.length) await service.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`))
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
    for (const u of users) await service.auth.admin.deleteUser(u.id)
  }, 60_000)

  describe('Titel und Geschlecht', () => {
    it('setzt „keine Angabe“ als Standard und prüft Werte und Längen', async () => {
      const g = await guest(ownerA, tenantA, { title_prefix: 'Dr.', title_suffix: 'LL.M.' })
      expect(g.error).toBeNull()
      const { data } = await service.from('guests').select('gender, title_prefix, title_suffix').eq('id', g.id).single()
      expect(data).toEqual({ gender: 'unspecified', title_prefix: 'Dr.', title_suffix: 'LL.M.' })
      expect((await guest(ownerA, tenantA, { gender: 'x' })).error).not.toBeNull()
      expect((await guest(ownerA, tenantA, { title_prefix: 'x'.repeat(51) })).error).not.toBeNull()
    })

    it('liefert die Titel in der Gästeliste', async () => {
      await guest(ownerA, tenantA, { last_name: `Titel ${runId}`, title_prefix: 'Mag.' })
      const { data } = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_query: `Titel ${runId}` })
      expect(data?.[0]?.title_prefix).toBe('Mag.')
    })
  })

  describe('Reisedokument', () => {
    it('verlangt Art und Nummer, sobald etwas erfasst ist', async () => {
      expect((await guest(ownerA, tenantA, { document_authority: 'BH Graz' })).error).not.toBeNull()
      expect((await guest(ownerA, tenantA, { document_type: 'passport' })).error).not.toBeNull()
      expect((await guest(ownerA, tenantA, { document_type: 'visa', document_number: '1' })).error).not.toBeNull()
      expect((await guest(ownerA, tenantA, { document_type: 'passport', document_number: 'P1', document_country: 'DE' })).error).toBeNull()
    })

    it('lehnt ein Ausstellungsdatum in der Zukunft ab', async () => {
      const r = await guest(ownerA, tenantA, { document_type: 'id_card', document_number: '1', document_issued_on: '2999-01-01' })
      expect(r.error?.code).toBe('23514')
    })

    it('Mitarbeiter ändern das Dokument eines bestehenden Gastes nicht', async () => {
      const g = await guest(ownerA, tenantA)
      const { data } = await staffA.from('guests').update({ document_type: 'passport', document_number: 'X' }).eq('id', g.id).select('id')
      expect(data ?? []).toHaveLength(0)
    })
  })

  describe('Ausweisbilder', () => {
    it('Mitglieder laden nur in den eigenen Ordner, nur JPEG', async () => {
      await expect(upload(staffA, tenantA)).resolves.toMatch(/\.jpg$/)
      await expect(upload(ownerB, tenantA)).rejects.toBeTruthy()
      const png = await ownerA.storage.from(BUCKET).upload(path(tenantA), JPEG, { contentType: 'image/png' })
      expect(png.error).not.toBeNull()
      const badName = await ownerA.storage.from(BUCKET).upload(`${tenantA}/ausweis-huber.jpg`, JPEG, { contentType: 'image/jpeg' })
      expect(badName.error).not.toBeNull()
    })

    it('vergibt einen Upload-Schlüssel nur für den eigenen Ordner', async () => {
      const own = await staffA.storage.from(BUCKET).createSignedUploadUrl(path(tenantA))
      expect(own.error).toBeNull()
      const done = await staffA.storage.from(BUCKET).uploadToSignedUrl(own.data!.path, own.data!.token, JPEG, { contentType: 'image/jpeg' })
      expect(done.error).toBeNull()
      const foreign = await ownerB.storage.from(BUCKET).createSignedUploadUrl(path(tenantA))
      expect(foreign.error).not.toBeNull()
    })

    it('Bild hängen: nur existierende Dateien im eigenen Ordner, nie an zwei Gästen', async () => {
      const p = await upload(ownerA, tenantA)
      const doc = { document_type: 'passport', document_number: 'P2' }
      const g = await guest(ownerA, tenantA, { ...doc, document_front_path: p })
      expect(g.error).toBeNull()
      // dieselbe Datei an einem zweiten Gast (auch als Rückseite)
      expect((await guest(ownerA, tenantA, { ...doc, document_back_path: p })).error?.code).toBe('P0705')
      // nicht vorhandene Datei
      expect((await guest(ownerA, tenantA, { ...doc, document_front_path: path(tenantA) })).error?.code).toBe('P0705')
      // Datei eines anderen Kunden
      const foreign = await upload(ownerB, tenantB)
      expect((await guest(ownerA, tenantA, { ...doc, document_front_path: foreign })).error).not.toBeNull()
    })

    it('Lesen: Mitglieder und eigener Upload ja, fremde Kunden und Anonyme nein; ersetzte Bilder sofort nicht mehr', async () => {
      const p = await upload(ownerA, tenantA)
      // Frischer Upload: nur die hochladende Person sieht ihn
      expect(await canRead(ownerA, p)).toBe(true)
      expect(await canRead(staffA, p)).toBe(false)
      const g = await guest(ownerA, tenantA, { document_type: 'id_card', document_number: 'I1', document_front_path: p })
      expect(await canRead(staffA, p)).toBe(true)
      expect(await canRead(ownerB, p)).toBe(false)
      const anon = await service.storage.from(BUCKET).createSignedUrl(p, 60)
      const response = await fetch(anon.data!.signedUrl.replace(/token=[^&]+/, 'token=falsch'))
      expect(response.ok).toBe(false)

      const replacement = await upload(ownerA, tenantA)
      await ownerA.from('guests').update({ document_front_path: replacement }).eq('id', g.id)
      expect(await canRead(staffA, p)).toBe(false)
      expect(await canRead(staffA, replacement)).toBe(true)
    })

    it('Nutzer können Bilder weder löschen noch überschreiben', async () => {
      const p = await upload(ownerA, tenantA)
      await ownerA.storage.from(BUCKET).remove([p])
      const { data } = await service.storage.from(BUCKET).list(tenantA, { search: p.split('/')[1] })
      expect(data).toHaveLength(1)
      const overwrite = await ownerA.storage.from(BUCKET).upload(p, JPEG, { contentType: 'image/jpeg', upsert: true })
      expect(overwrite.error).not.toBeNull()
    })

    it('Mitarbeiter legen per Buchung einen neuen Gast mit Dokument und Bild an', async () => {
      const { data: prop } = await service
        .from('properties')
        .insert({ tenant_id: tenantA, name: 'Haus Test', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
        .select('id')
        .single()
      const { data: apt } = await service
        .from('apartments')
        .insert({ tenant_id: tenantA, property_id: prop!.id, name: 'Dokument', max_guests: 4, price_cents: 10000 })
        .select('id')
        .single()
      const p = await upload(staffA, tenantA)
      const input = {
        tenant_id: tenantA,
        kind: 'booking',
        apartment_id: apt!.id,
        arrival: '2027-05-01',
        planned_departure: '2027-05-03',
        departure: '2027-05-03',
        check_in: '15:00',
        check_out: '10:00',
        guest_id: null,
        adults: 1,
        child_ages: [],
        option_until: null,
        note: null,
        amounts: { nights_cents: 0, charges: [] },
        new_guest: {
          last_name: `Buchung ${runId}`,
          country: 'DE',
          title_prefix: 'Dr.',
          gender: 'female',
          document_type: 'passport',
          document_number: 'C01X00T47',
          document_front_path: p,
        },
      }
      const { error } = await staffA.rpc('save_booking', { p_input: input as Json, p_confirm: false })
      expect(error).toBeNull()
      const { data } = await service.from('guests').select('gender, title_prefix, document_front_path').eq('last_name', `Buchung ${runId}`).single()
      expect(data).toEqual({ gender: 'female', title_prefix: 'Dr.', document_front_path: p })
    })
  })

  describe('Zusammenführen, Anonymisieren, Bereinigung', () => {
    it('übernimmt Titel, Geschlecht und Reisedokument nach Wahl; die Bilder wandern mit', async () => {
      const pa = await upload(ownerA, tenantA)
      const pb = await upload(ownerA, tenantA)
      const a = await guest(ownerA, tenantA, { title_prefix: 'Dr.', document_type: 'passport', document_number: 'A', document_front_path: pa })
      const b = await guest(ownerA, tenantA, { gender: 'male', document_type: 'id_card', document_number: 'B', document_front_path: pb })
      const choice = Object.fromEntries(
        ['name', 'titles', 'gender', 'country', 'email', 'phone', 'language', 'birthDate', 'address', 'marketing', 'company', 'note', 'document'].map(
          (f) => [f, f === 'gender' || f === 'document' ? 'b' : 'a']
        )
      )
      const { error } = await ownerA.rpc('merge_guests', { p_keep: a.id, p_remove: b.id, p_choice: choice })
      expect(error).toBeNull()
      const { data } = await service.from('guests').select('title_prefix, gender, document_type, document_number, document_front_path').eq('id', a.id).single()
      expect(data).toEqual({ title_prefix: 'Dr.', gender: 'male', document_type: 'id_card', document_number: 'B', document_front_path: pb })
      // Das nicht gewählte Bild hängt an keinem Gast mehr → Kandidat für das Löschen
      expect(await canRead(staffA, pa)).toBe(false)
    })

    it('Anonymisieren leert Titel und Dokument und setzt das Geschlecht zurück', async () => {
      const p = await upload(ownerA, tenantA)
      const g = await guest(ownerA, tenantA, { title_suffix: 'MSc', gender: 'inter', document_type: 'passport', document_number: 'Z', document_back_path: p })
      const { error } = await service.rpc('anonymize_guest', { p_guest_id: g.id })
      expect(error).toBeNull()
      const { data } = await service.from('guests').select('title_suffix, gender, document_type, document_back_path').eq('id', g.id).single()
      expect(data).toEqual({ title_suffix: null, gender: 'unspecified', document_type: null, document_back_path: null })
    })

    it('Bereinigung: nur der Server, nur unbenutzte Dateien', async () => {
      const asUser = await ownerA.rpc('unused_guest_documents', { p_limit: 10 })
      expect(asUser.error).not.toBeNull()
      const asService = await service.rpc('unused_guest_documents', { p_limit: 1000 })
      expect(asService.error).toBeNull()
      // Frische Uploads (jünger als 24 Stunden) und verwendete Bilder sind nie dabei
      const used = (await service.from('guests').select('document_front_path').eq('tenant_id', tenantA).not('document_front_path', 'is', null)).data!
      for (const name of asService.data ?? []) {
        expect(used.map((u) => u.document_front_path)).not.toContain(name)
        expect(name.startsWith(tenantA)).toBe(false)
      }
    })
  })
})
