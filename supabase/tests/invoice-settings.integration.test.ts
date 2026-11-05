// @vitest-environment node
//
// PROJ-39: Einstellungen → Rechnungen gegen „apppa-dev“ (übersprungen ohne .env.local): Vorbelegung, Lesen und Schreiben
// je Rolle, Nummernkreis, feste Texte, Schalter, Textbausteine (Grenzen, Platzhalter, Standard, Konflikte),
// Prüfung am Formular vorbei und Betreiber-Protokoll ohne Text.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isRichDoc, RICH_ALIGNS, RICH_FONTS } from '@/lib/rich-text'
import type { Json } from '@/types/database'
import { anonClient, type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const doc = (...paragraphs: string[]): Json => ({
  type: 'doc',
  content: paragraphs.map((text) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' })),
})

describe.skipIf(!hasSupabaseEnv)('PROJ-39 Rechnungseinstellungen', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client, admin: Client, adminAal1: Client
  let ownerBUser: TestUser
  const runId = randomUUID().slice(0, 8)

  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-39 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  const settings = async (tenantId: string) => {
    const { data, error } = await service.from('invoice_settings').select('*').eq('tenant_id', tenantId).single()
    if (error) throw error
    return data
  }
  const blocks = async (tenantId: string) => {
    const { data, error } = await service.from('invoice_text_blocks').select('*').eq('tenant_id', tenantId).order('name')
    if (error) throw error
    return data
  }
  const numbering = { prefix: '', with_year: true, separator: '-', digits: 4, yearly_reset: true, start: 1 }
  const saveNumbering = async (client: Client, tenantId: string, data: Record<string, unknown>, stamp?: string) =>
    client.rpc('save_invoice_numbering', {
      p_tenant_id: tenantId,
      p_expected_updated_at: stamp ?? (await settings(tenantId)).numbering_updated_at,
      p_data: { ...numbering, ...data } as Json,
    })
  const saveTexts = async (client: Client, tenantId: string, data: Record<string, unknown>, stamp?: string) =>
    client.rpc('save_invoice_fixed_texts', {
      p_tenant_id: tenantId,
      p_expected_updated_at: stamp ?? (await settings(tenantId)).texts_updated_at,
      p_data: data as Json,
    })
  const saveBlock = (client: Client, input: Record<string, unknown>) =>
    client.rpc('save_invoice_text_block', {
      p_input: { tenant_id: tenantA, id: null, updated_at: null, block: 'intro', name: `B ${randomUUID().slice(0, 6)}`, body: doc('Hallo {Gast}'), ...input } as Json,
    })
  const setDefault = (client: Client, tenantId: string, block: string, blockId: string | null, expected: string | null) =>
    client.rpc('set_invoice_text_block_default', {
      p_tenant_id: tenantId,
      p_block: block,
      p_block_id: blockId as string,
      p_expected_default_id: expected as string,
    })
  const log = async (tenantId: string) => {
    const { data } = await service
      .from('operator_log')
      .select('action, changed_fields, target_block, target_label')
      .eq('tenant_id', tenantId)
      .in('action', ['invoice_settings', 'text_block_created', 'text_block_updated', 'text_block_deleted'])
      .order('id')
    return data ?? []
  }

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob, ad, ad1] = await Promise.all([
      sharedClient('ownerA'),
      sharedClient('staffA'),
      sharedClient('ownerB'),
      sharedClient('adminAal2'),
      sharedClient('adminAal1'),
    ])
    ;[ownerA, staffA, ownerB, admin, adminAal1] = [oa.client, sa.client, ob.client, ad.client, ad1.client]
    tenantA = await newTenant([
      [oa.user, 'owner'],
      [sa.user, 'staff'],
    ])
    ownerBUser = ob.user
    tenantB = await newTenant([[ob.user, 'owner']])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  it('neuer Kunde bekommt die Vorbelegung als eigene Kopie', async () => {
    const s = await settings(tenantA)
    expect(s).toMatchObject({
      number_prefix: '',
      number_with_year: true,
      number_separator: '-',
      number_digits: 4,
      number_yearly_reset: true,
      number_start: 1,
      footer: null,
      backfill_enabled: true,
    })
    expect(JSON.stringify(s.small_business_note)).toContain('§ 6 Abs. 1 Z 27 UStG')
    const b = await blocks(tenantA)
    expect(b.map((x) => [x.block, x.name, x.is_default])).toEqual([
      ['payment', 'Anzahlung 20 %, Rest vor Anreise', false],
      ['intro', 'Dank für den Aufenthalt', true],
      ['closing', 'Nächster Besuch', true],
      ['payment', 'Überweisung 14 Tage', true],
    ])
    expect(b[0]).toMatchObject({ deposit_percent: 20, deposit_days: 3, due_days: 1, due_basis: 'before_arrival' })
    expect(b[3]).toMatchObject({ deposit_percent: null, deposit_days: null, due_days: 14, due_basis: 'after_invoice' })
    // eigene Zeilen je Kunde
    const other = await blocks(tenantB)
    expect(other).toHaveLength(4)
    expect(other.map((x) => x.id)).not.toContain(b[0].id)
  })

  it('Lesen: Inhaber und Admin mit 2FA; Mitarbeiter, fremder Inhaber, Admin ohne 2FA und anonym nichts', async () => {
    const read = async (client: Client) => ({
      s: (await client.from('invoice_settings').select('tenant_id').eq('tenant_id', tenantA)).data ?? [],
      b: (await client.from('invoice_text_blocks').select('id').eq('tenant_id', tenantA)).data ?? [],
    })
    expect(await read(ownerA)).toMatchObject({ s: [{ tenant_id: tenantA }] })
    expect((await read(ownerA)).b).toHaveLength(4)
    expect((await read(admin)).b).toHaveLength(4)
    for (const client of [staffA, ownerB, adminAal1, anonClient()]) {
      expect(await read(client)).toEqual({ s: [], b: [] })
    }
  })

  it('kein direktes Schreiben in die Tabellen', async () => {
    const before = await settings(tenantA)
    await ownerA.from('invoice_settings').update({ number_prefix: 'X' }).eq('tenant_id', tenantA)
    await ownerA.from('invoice_text_blocks').delete().eq('tenant_id', tenantA)
    const ins = await ownerA.from('invoice_text_blocks').insert({ tenant_id: tenantA, block: 'intro', name: 'Direkt', body: doc('x') })
    expect(ins.error).not.toBeNull()
    expect((await settings(tenantA)).number_prefix).toBe(before.number_prefix)
    expect(await blocks(tenantA)).toHaveLength(4)
  })

  it('Schreiben: Mitarbeiter, fremder Inhaber, Admin ohne 2FA → 42501', async () => {
    for (const client of [staffA, ownerB, adminAal1]) {
      expect((await saveNumbering(client, tenantA, { prefix: 'Z-' })).error?.code).toBe('42501')
      expect((await saveBlock(client, {})).error?.code).toBe('42501')
    }
    expect((await settings(tenantA)).number_prefix).toBe('')
  })

  it('Nummernkreis: speichern, Jahr der Startnummer, Konflikt, Prüfregeln, kein Eintrag ohne Änderung', async () => {
    const before = (await log(tenantA)).length
    const stale = (await settings(tenantA)).numbering_updated_at
    expect((await saveNumbering(ownerA, tenantA, { prefix: 'R-', separator: '/', digits: 5, start: 41 })).error).toBeNull()
    const s = await settings(tenantA)
    expect(s).toMatchObject({ number_prefix: 'R-', number_separator: '/', number_digits: 5, number_start: 41 })
    expect(s.number_start_year).toBe(Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' }).slice(0, 4)))
    // zweiter Bearbeiter mit altem Stand
    expect((await saveNumbering(admin, tenantA, { prefix: 'X' }, stale)).error?.code).toBe('P0910')
    // ohne Änderung: kein Protokolleintrag, Stand bleibt
    expect((await saveNumbering(ownerA, tenantA, { prefix: 'R-', separator: '/', digits: 5, start: 41 })).error).toBeNull()
    expect((await settings(tenantA)).numbering_updated_at).toBe(s.numbering_updated_at)
    for (const bad of [
      { prefix: 'ABCDEFGHIJK' },
      { prefix: 'R 1' },
      { prefix: 'R#' },
      { digits: 7 },
      { digits: 2 },
      { start: 0 },
      { start: 1.5 },
      { separator: '_' },
      { with_year: false, yearly_reset: true },
      { with_year: 'ja' },
    ]) {
      expect((await saveNumbering(ownerA, tenantA, bad)).error?.code, JSON.stringify(bad)).toBe('P0914')
    }
    expect((await saveNumbering(ownerA, tenantA, { with_year: false, yearly_reset: false, separator: '' })).error).toBeNull()
    expect((await saveNumbering(ownerA, tenantA, {})).error).toBeNull()
    const entries = (await log(tenantA)).slice(before)
    expect(entries).toEqual([
      { action: 'invoice_settings', changed_fields: ['numbering'], target_block: null, target_label: null },
      { action: 'invoice_settings', changed_fields: ['numbering'], target_block: null, target_label: null },
      { action: 'invoice_settings', changed_fields: ['numbering'], target_block: null, target_label: null },
    ])
  })

  it('feste Texte: Hinweis Pflicht, Grenzen, keine Platzhalter, leere Fußzeile = null, kein HTML', async () => {
    const note = (await settings(tenantA)).small_business_note
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: doc('IBAN AT12 3456', 'Tel. 0664 123') })).error).toBeNull()
    expect((await settings(tenantA)).footer).toEqual(doc('IBAN AT12 3456', 'Tel. 0664 123'))
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: doc('', '  ') })).error).toBeNull()
    expect((await settings(tenantA)).footer).toBeNull()

    for (const bad of [
      { small_business_note: doc('  '), footer: null },
      { small_business_note: doc('x'.repeat(501)), footer: null },
      { small_business_note: note, footer: doc('y'.repeat(2001)) },
      { small_business_note: doc('Hinweis {Wohnung}'), footer: null },
      { small_business_note: note, footer: doc('{Gast}') },
      { small_business_note: '<p>Hallo</p>', footer: null },
      { small_business_note: { type: 'doc', content: [{ type: 'paragraph', attrs: { style: 'color:red' } }] }, footer: null },
      { small_business_note: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }, footer: null },
      { small_business_note: { type: 'doc', content: [{ type: 'image', attrs: { src: 'x' } }] }, footer: null },
      { small_business_note: note, footer: 'Text' },
    ]) {
      expect((await saveTexts(ownerA, tenantA, bad)).error?.code, JSON.stringify(bad).slice(0, 80)).toBe('P0914')
    }
    // fett, kursiv, Listen und Umbruch sind erlaubt
    const formatted = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'fett', marks: [{ type: 'bold' }, { type: 'italic' }] }, { type: 'hardBreak' }, { type: 'text', text: 'neu' }] },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'eins' }] }] }] },
      ],
    }
    expect((await saveTexts(ownerA, tenantA, { small_business_note: formatted, footer: formatted })).error).toBeNull()
    const stale = (await settings(tenantA)).texts_updated_at
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: null })).error).toBeNull()
    expect((await saveTexts(admin, tenantA, { small_business_note: formatted, footer: null }, stale)).error?.code).toBe('P0910')
    const last = (await log(tenantA)).at(-1)
    expect(last?.changed_fields).toEqual(['small_business_note', 'footer'])
    // Protokoll ohne Text
    expect(JSON.stringify(await log(tenantA))).not.toContain('IBAN')
  })

  it('Schriftart, Schriftgröße, Ausrichtung: gültige Werte gespeichert, ungültige abgelehnt, auch direkt in der Datenbank', async () => {
    const note = (await settings(tenantA)).small_business_note
    const styled = (attrs: unknown): Json => ({ ...(doc('Text') as object), attrs }) as Json

    // jede Schrift der App, alle Ausrichtungen, Grenzen und halbe Punkte
    const valid: Record<string, unknown>[] = [
      ...RICH_FONTS.map((fontFamily) => ({ fontFamily })),
      ...RICH_ALIGNS.map((textAlign) => ({ textAlign })),
      { fontSize: 6 },
      { fontSize: 24 },
      { fontSize: 10.5 },
      { fontFamily: 'arimo', fontSize: 10.5, textAlign: 'justify' },
    ]
    for (const attrs of valid) {
      const { error } = await saveTexts(ownerA, tenantA, { small_business_note: note, footer: styled(attrs) })
      expect(error, JSON.stringify(attrs)).toBeNull()
      expect((await settings(tenantA)).footer, JSON.stringify(attrs)).toEqual(styled(attrs))
      expect(isRichDoc(styled(attrs)), JSON.stringify(attrs)).toBe(true)
    }

    const invalid: unknown[] = [
      {},
      null,
      'arimo',
      [],
      { fontFamily: 'comic' },
      { fontFamily: 1 },
      { fontFamily: null },
      { fontSize: 5.5 },
      { fontSize: 24.5 },
      { fontSize: 10.3 },
      { fontSize: '10' },
      { fontSize: null },
      { textAlign: 'left' },
      { textAlign: 'middle' },
      { textAlign: null },
      { color: 'red' },
      { fontSize: 10, style: 'color:red' },
    ]
    for (const attrs of invalid) {
      expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: styled(attrs) })).error?.code, JSON.stringify(attrs)).toBe('P0914')
      expect(isRichDoc(styled(attrs)), JSON.stringify(attrs)).toBe(false)
      // Prüfregel der Tabelle: auch mit dem Service-Schlüssel nicht speicherbar
      const direct = await service.from('invoice_settings').update({ footer: styled(attrs) } as never).eq('tenant_id', tenantA)
      expect(direct.error?.code, JSON.stringify(attrs)).toBe('23514')
    }
    // Einstellungen an einem Absatz bleiben verboten
    const onParagraph = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' } }] } as Json
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: onParagraph })).error?.code).toBe('P0914')

    // nur Einstellungen ohne Text zählen als leer: leere Fußzeile, Pflichttext abgelehnt
    const empty = { type: 'doc', attrs: { fontSize: 9 }, content: [{ type: 'paragraph' }] } as Json
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: empty })).error).toBeNull()
    expect((await settings(tenantA)).footer).toBeNull()
    expect((await saveTexts(ownerA, tenantA, { small_business_note: empty, footer: null })).error?.code).toBe('P0914')
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: null })).error).toBeNull()
  })

  it('Zeilenhöhe (refine 2026-11-05): 0,8 bis 3 mit höchstens zwei Nachkommastellen, auch direkt in der Datenbank', async () => {
    const note = (await settings(tenantA)).small_business_note
    const styled = (attrs: unknown): Json => ({ ...(doc('Text') as object), attrs }) as Json

    for (const attrs of [{ lineHeight: 0.8 }, { lineHeight: 1 }, { lineHeight: 1.25 }, { lineHeight: 3 }, { fontFamily: 'arimo', fontSize: 9, textAlign: 'center', lineHeight: 1.5 }]) {
      const { error } = await saveTexts(ownerA, tenantA, { small_business_note: note, footer: styled(attrs) })
      expect(error, JSON.stringify(attrs)).toBeNull()
      expect((await settings(tenantA)).footer, JSON.stringify(attrs)).toEqual(styled(attrs))
      expect(isRichDoc(styled(attrs)), JSON.stringify(attrs)).toBe(true)
    }
    for (const attrs of [{ lineHeight: 0.79 }, { lineHeight: 3.01 }, { lineHeight: 1.255 }, { lineHeight: 0 }, { lineHeight: '1.2' }, { lineHeight: 'abc' }, { lineHeight: null }, { lineHeight: 1.2, fontSize: 40 }]) {
      expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: styled(attrs) })).error?.code, JSON.stringify(attrs)).toBe('P0914')
      expect(isRichDoc(styled(attrs)), JSON.stringify(attrs)).toBe(false)
      const direct = await service.from('invoice_settings').update({ footer: styled(attrs) } as never).eq('tenant_id', tenantA)
      expect(direct.error?.code, JSON.stringify(attrs)).toBe('23514')
    }
    // an einem Absatz bleibt sie verboten
    const onParagraph = { type: 'doc', content: [{ type: 'paragraph', attrs: { lineHeight: 2 }, content: [{ type: 'text', text: 'x' }] }] } as Json
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: onParagraph })).error?.code).toBe('P0914')

    // Baustein: reine Änderung der Zeilenhöhe ändert den Stand und steht im Protokoll
    const body = doc('Zeilenhöhe')
    const name = `Zeilen ${randomUUID().slice(0, 6)}`
    expect((await saveBlock(ownerA, { name, body })).error).toBeNull()
    const before = (await blocks(tenantA)).find((b) => b.name === name)!
    const taller = { ...(body as object), attrs: { lineHeight: 1.75 } } as Json
    expect((await saveBlock(ownerA, { id: before.id, updated_at: before.content_updated_at, name, body: taller })).error).toBeNull()
    const after = (await blocks(tenantA)).find((b) => b.id === before.id)!
    expect(after.body).toEqual(taller)
    expect(after.content_updated_at).not.toBe(before.content_updated_at)
    expect((await log(tenantA)).at(-1)).toEqual({ action: 'text_block_updated', changed_fields: ['body'], target_block: 'intro', target_label: name })
    expect((await saveTexts(ownerA, tenantA, { small_business_note: note, footer: null })).error).toBeNull()
  })

  it('Baustein: reine Formatänderung zählt als Textänderung für Stand, Konflikt und Protokoll, ohne Textinhalt', async () => {
    const body = doc('Formatierter Text')
    const name = `Format ${randomUUID().slice(0, 6)}`
    expect((await saveBlock(ownerA, { name, body })).error).toBeNull()
    const before = (await blocks(tenantA)).find((b) => b.name === name)!

    const styled = { ...(body as object), attrs: { fontFamily: 'tinos', fontSize: 12, textAlign: 'center' } } as Json
    expect((await saveBlock(ownerA, { id: before.id, updated_at: before.content_updated_at, name, body: styled })).error).toBeNull()
    const after = (await blocks(tenantA)).find((b) => b.id === before.id)!
    expect(after.body).toEqual(styled)
    expect(after.content_updated_at).not.toBe(before.content_updated_at)
    expect((await log(tenantA)).at(-1)).toEqual({ action: 'text_block_updated', changed_fields: ['body'], target_block: 'intro', target_label: name })

    // alter Stand: Konflikt
    expect((await saveBlock(ownerA, { id: before.id, updated_at: before.content_updated_at, name, body })).error?.code).toBe('P0910')
    // Reihenfolge der Schlüssel ist egal: gleiche Einstellungen sind keine Änderung
    const reordered = { content: (body as { content: unknown }).content, attrs: { textAlign: 'center', fontSize: 12, fontFamily: 'tinos' }, type: 'doc' } as Json
    const logBefore = (await log(tenantA)).length
    expect((await saveBlock(ownerA, { id: before.id, updated_at: after.content_updated_at, name, body: reordered })).error).toBeNull()
    expect((await log(tenantA)).length).toBe(logBefore)

    const invalid = { ...(body as object), attrs: { fontSize: 40 } } as Json
    expect((await saveBlock(ownerA, { name: `${name} 2`, body: invalid })).error?.code).toBe('P0914')
  })

  it('Schalter: speichern, Konflikt, Rechnung nacherfassen danach abgelehnt (P0905)', async () => {
    const s = await settings(tenantB)
    expect((await ownerB.rpc('save_invoice_backfill', { p_tenant_id: tenantB, p_expected_updated_at: s.backfill_updated_at, p_enabled: false })).error).toBeNull()
    expect((await settings(tenantB)).backfill_enabled).toBe(false)
    expect((await ownerB.rpc('save_invoice_backfill', { p_tenant_id: tenantB, p_expected_updated_at: s.backfill_updated_at, p_enabled: true })).error?.code).toBe('P0910')
    const invoice = await ownerB.rpc('save_invoice', {
      p_input: { tenant_id: tenantB, number: `S-${runId}`, invoice_date: '2026-10-01', recipient: 'Test', lines: [{ label: 'Übernachtung', amount_cents: 100, vat_rate: '10' }] },
    })
    expect(invoice.error?.code).toBe('P0905')
    const now = await settings(tenantB)
    expect((await ownerB.rpc('save_invoice_backfill', { p_tenant_id: tenantB, p_expected_updated_at: now.backfill_updated_at, p_enabled: true })).error).toBeNull()
    expect((await log(tenantB)).at(-1)).toMatchObject({ action: 'invoice_settings', changed_fields: ['backfill'] })
  })

  it('Baustein anlegen und ändern: Name eindeutig je Block, Grenzen, Platzhalter, Konflikt, gelöscht', async () => {
    const created = await saveBlock(ownerA, { name: 'Nächster Besuch', block: 'intro', body: doc('{Anrede}, {Wohnung}') })
    expect(created.error).toBeNull()
    const id = created.data!
    // gleicher Name im selben Block (andere Schreibweise) → vergeben; im anderen Block erlaubt
    expect((await saveBlock(ownerA, { name: 'nächster besuch', block: 'closing' })).error?.code).toBe('P0913')
    expect((await saveBlock(ownerA, { name: 'NÄCHSTER BESUCH', block: 'intro' })).error?.code).toBe('P0913')

    for (const bad of [
      { name: ' ' },
      { name: 'x'.repeat(61) },
      { body: doc(' ') },
      { body: doc('x'.repeat(2001)) },
      { body: doc('{Gastname}') },
      { body: doc('bis {Fälligkeitsdatum}') },
      { block: 'header' },
      { body: '<b>x</b>' },
    ]) {
      expect((await saveBlock(ownerA, bad)).error?.code, JSON.stringify(bad).slice(0, 60)).toBe('P0914')
    }

    const [row] = (await blocks(tenantA)).filter((b) => b.id === id)
    expect(row.name).toBe('Nächster Besuch')
    const edited = await saveBlock(ownerA, { id, updated_at: row.content_updated_at, name: 'Wiedersehen', body: doc('Bis bald, {Gast}!') })
    expect(edited.error).toBeNull()
    // alter Stand → Konflikt; Block wechseln geht nicht
    expect((await saveBlock(admin, { id, updated_at: row.content_updated_at, name: 'Admin' })).error?.code).toBe('P0910')
    const [now] = (await blocks(tenantA)).filter((b) => b.id === id)
    expect((await saveBlock(ownerA, { id, updated_at: now.content_updated_at, block: 'closing', name: 'X' })).error?.code).toBe('P0914')
    expect((await log(tenantA)).at(-1)).toEqual({
      action: 'text_block_updated',
      changed_fields: ['name', 'body'],
      target_block: 'intro',
      target_label: 'Wiedersehen',
    })

    expect((await ownerA.rpc('delete_invoice_text_block', { p_tenant_id: tenantA, p_block_id: id })).error).toBeNull()
    expect((await saveBlock(ownerA, { id, updated_at: now.content_updated_at, name: 'Weg' })).error?.code).toBe('P0911')
    expect((await ownerA.rpc('delete_invoice_text_block', { p_tenant_id: tenantA, p_block_id: id })).error?.code).toBe('P0911')
    expect((await log(tenantA)).at(-1)).toMatchObject({ action: 'text_block_deleted', target_block: 'intro', target_label: 'Wiedersehen' })
    // fremder Inhaber löscht nicht
    const [someB] = await blocks(tenantB)
    expect((await ownerA.rpc('delete_invoice_text_block', { p_tenant_id: tenantB, p_block_id: someB.id })).error?.code).toBe('42501')
    expect((await ownerA.rpc('delete_invoice_text_block', { p_tenant_id: tenantA, p_block_id: someB.id })).error?.code).toBe('P0911')
  })

  it('Zahlungsregeln: Pflicht bei Zahlungsmodalitäten, Anzahlungs-Platzhalter nur mit Anzahlung, Grenzen', async () => {
    const pay = { block: 'payment', body: doc('Bitte bis {Fälligkeitsdatum}.'), due_days: 14, due_basis: 'after_invoice' }
    const ok = await saveBlock(ownerA, { ...pay, name: `Pay ${runId}` })
    expect(ok.error).toBeNull()
    const dep = await saveBlock(ownerA, {
      ...pay,
      name: `Dep ${runId}`,
      body: doc('{Anzahlung} bis {Anzahlung fällig}, Rest {Restbetrag} bis {Fälligkeitsdatum}'),
      deposit_percent: 12.5,
      deposit_days: 3,
      due_days: 1,
      due_basis: 'before_arrival',
    })
    expect(dep.error).toBeNull()
    const row = (await blocks(tenantA)).find((b) => b.id === dep.data)!
    expect(row).toMatchObject({ deposit_percent: 12.5, deposit_days: 3, due_days: 1, due_basis: 'before_arrival' })

    for (const bad of [
      { due_days: null },
      { due_days: 366 },
      { due_days: -1 },
      { due_days: 1.5 },
      { due_basis: 'later' },
      { deposit_percent: 0.5, deposit_days: 3 },
      { deposit_percent: 101, deposit_days: 3 },
      { deposit_percent: 20.123, deposit_days: 3 },
      { deposit_percent: 20, deposit_days: null },
      { deposit_percent: 20, deposit_days: 400 },
      { deposit_percent: '20', deposit_days: 3 },
      { body: doc('{Restbetrag}') },
    ]) {
      expect((await saveBlock(ownerA, { ...pay, ...bad })).error?.code, JSON.stringify(bad)).toBe('P0914')
    }
    // Einleitung: Zahlungsfelder werden ignoriert
    const intro = await saveBlock(ownerA, { name: `Intro ${runId}`, deposit_percent: 20, deposit_days: 3, due_days: 5, due_basis: 'after_invoice' })
    expect(intro.error).toBeNull()
    expect((await blocks(tenantA)).find((b) => b.id === intro.data)).toMatchObject({ deposit_percent: null, due_days: null, due_basis: null })
    // auch direkt an der Tabelle: Zahlungsfelder nur bei payment, Fälligkeit Pflicht
    const direct = await service.from('invoice_text_blocks').insert({ tenant_id: tenantB, block: 'payment', name: `Direkt ${runId}`, body: doc('x') })
    expect(direct.error?.code).toBe('23514')
  })

  it('Standard: genau einer je Block, Aufheben, Konflikt bei veraltetem Standard, Löschen des Standards', async () => {
    const intro = (await blocks(tenantB)).filter((b) => b.block === 'intro')
    const current = intro.find((b) => b.is_default)!
    const other = await saveBlock(ownerB, { tenant_id: tenantB, name: `Std ${runId}` })
    expect(other.error).toBeNull()
    expect((await setDefault(ownerB, tenantB, 'intro', other.data!, current.id)).error).toBeNull()
    const after = (await blocks(tenantB)).filter((b) => b.block === 'intro' && b.is_default)
    expect(after.map((b) => b.id)).toEqual([other.data])
    // zweiter, gleichzeitiger Standard-Wechsel mit altem Stand → Konflikt
    expect((await setDefault(admin, tenantB, 'intro', current.id, current.id)).error?.code).toBe('P0910')
    // Aufheben
    expect((await setDefault(ownerB, tenantB, 'intro', null, other.data!)).error).toBeNull()
    expect((await blocks(tenantB)).filter((b) => b.block === 'intro' && b.is_default)).toHaveLength(0)
    // fremder bzw. falscher Block
    const closing = (await blocks(tenantB)).find((b) => b.block === 'closing')!
    expect((await setDefault(ownerB, tenantB, 'intro', closing.id, null)).error?.code).toBe('P0911')
    expect((await setDefault(ownerB, tenantB, 'header', null, null)).error?.code).toBe('P0914')
    // Standard löschen → Block ohne Standard
    expect((await setDefault(ownerB, tenantB, 'closing', closing.id, closing.id)).error).toBeNull()
    expect((await ownerB.rpc('delete_invoice_text_block', { p_tenant_id: tenantB, p_block_id: closing.id })).error).toBeNull()
    expect((await blocks(tenantB)).filter((b) => b.block === 'closing')).toHaveLength(0)
    // direkt an der Tabelle: zweiter Standard scheitert
    const pays = (await blocks(tenantB)).filter((b) => b.block === 'payment')
    const second = await service.from('invoice_text_blocks').update({ is_default: true }).eq('id', pays.find((b) => !b.is_default)!.id)
    expect(second.error?.code).toBe('23505')
    expect((await log(tenantB)).filter((e) => e.changed_fields?.includes('is_default')).length).toBeGreaterThanOrEqual(2)
  })

  it('BUG-6: Standard umschalten ändert den Inhaltsstand nicht; Speichern danach ohne Konflikt', async () => {
    const created = await saveBlock(ownerB, { tenant_id: tenantB, name: `Stand ${runId}` })
    expect(created.error).toBeNull()
    const before = (await blocks(tenantB)).find((b) => b.id === created.data)!
    const expected = (await blocks(tenantB)).find((b) => b.block === 'intro' && b.is_default)?.id ?? null
    expect((await setDefault(admin, tenantB, 'intro', created.data!, expected)).error).toBeNull()
    const after = (await blocks(tenantB)).find((b) => b.id === created.data)!
    expect(after.is_default).toBe(true)
    expect(after.updated_at).not.toBe(before.updated_at)
    expect(after.content_updated_at).toBe(before.content_updated_at)
    // Panel mit dem Stand von vorher speichert ohne „inzwischen geändert“ und bleibt Standard
    const saved = await saveBlock(ownerB, { tenant_id: tenantB, id: created.data, updated_at: before.content_updated_at, name: `Stand neu ${runId}` })
    expect(saved.error).toBeNull()
    const edited = (await blocks(tenantB)).find((b) => b.id === created.data)!
    expect(edited).toMatchObject({ name: `Stand neu ${runId}`, is_default: true })
    expect(edited.content_updated_at).not.toBe(before.content_updated_at)
    // eine echte Inhaltsänderung dazwischen bleibt ein Konflikt
    expect((await saveBlock(admin, { tenant_id: tenantB, id: created.data, updated_at: before.content_updated_at, name: 'Admin' })).error?.code).toBe('P0910')
  })

  it('BUG-3: invoice_numbers liefert alle Nummern (über 1.000), nur für Berechtigte', async () => {
    const tenant = await newTenant([[ownerBUser, 'owner']])
    const rows = Array.from({ length: 1100 }, (_, i) => ({
      tenant_id: tenant,
      number: `2026-${String(i + 1).padStart(4, '0')}`,
      invoice_date: '2026-01-15',
      recipient: 'Alt KG',
      total_cents: 100,
    }))
    for (let i = 0; i < rows.length; i += 550) {
      const { error } = await service.from('invoices').insert(rows.slice(i, i + 550) as never)
      expect(error).toBeNull()
    }
    const own = await ownerB.rpc('invoice_numbers', { p_tenant_id: tenant })
    expect(own.error).toBeNull()
    expect(own.data).toHaveLength(1100)
    expect(own.data).toContain('2026-1100')
    expect((await admin.rpc('invoice_numbers', { p_tenant_id: tenant })).data).toHaveLength(1100)
    // fremder Inhaber und Admin ohne 2FA sehen nichts (RLS), anonym darf die Funktion nicht aufrufen
    for (const client of [ownerA, adminAal1]) {
      expect((await client.rpc('invoice_numbers', { p_tenant_id: tenant })).data).toEqual([])
    }
    expect((await anonClient().rpc('invoice_numbers', { p_tenant_id: tenant })).error?.code).toBe('42501')
  }, 60_000)

  it('höchstens 20 Bausteine je Block', async () => {
    const tenant = await newTenant([])
    const existing = (await blocks(tenant)).filter((b) => b.block === 'closing').length
    const rows = Array.from({ length: 20 - existing }, (_, i) => ({ tenant_id: tenant, block: 'closing', name: `Voll ${i}`, body: doc('x') }))
    expect((await service.from('invoice_text_blocks').insert(rows)).error).toBeNull()
    const full = await admin.rpc('save_invoice_text_block', {
      p_input: { tenant_id: tenant, id: null, updated_at: null, block: 'closing', name: 'Einer zu viel', body: doc('x') },
    })
    expect(full.error?.code).toBe('P0912')
    // anderer Block geht noch
    const intro = await admin.rpc('save_invoice_text_block', {
      p_input: { tenant_id: tenant, id: null, updated_at: null, block: 'intro', name: 'Noch Platz', body: doc('x') },
    })
    expect(intro.error).toBeNull()
  })

  it('Admin mit 2FA ändert bei aktivem Kunden; deaktiviert → P0016; Inhaber eines deaktivierten Kunden → 42501', async () => {
    const [b] = await blocks(tenantB)
    expect((await saveNumbering(admin, tenantB, { prefix: 'ADM-' })).error).toBeNull()
    const { error } = await service.from('tenants').update({ status: 'deactivated' }).eq('id', tenantB)
    expect(error).toBeNull()
    try {
      expect((await saveNumbering(admin, tenantB, { prefix: 'NEU' })).error?.code).toBe('P0016')
      expect((await admin.rpc('delete_invoice_text_block', { p_tenant_id: tenantB, p_block_id: b.id })).error?.code).toBe('P0016')
      expect((await saveNumbering(ownerB, tenantB, { prefix: 'NEU' })).error?.code).toBe('42501')
      // Admin liest weiter
      expect((await admin.from('invoice_settings').select('number_prefix').eq('tenant_id', tenantB)).data).toEqual([{ number_prefix: 'ADM-' }])
    } finally {
      await service.from('tenants').update({ status: 'active' }).eq('id', tenantB)
    }
  })

  it('Löschen des Kunden entfernt Einstellungen und Bausteine', async () => {
    const tenant = await newTenant([])
    expect((await blocks(tenant)).length).toBe(4)
    await service.from('tenants').delete().eq('id', tenant)
    expect((await service.from('invoice_settings').select('id').eq('tenant_id', tenant)).data).toEqual([])
    expect((await service.from('invoice_text_blocks').select('id').eq('tenant_id', tenant)).data).toEqual([])
  })
})
