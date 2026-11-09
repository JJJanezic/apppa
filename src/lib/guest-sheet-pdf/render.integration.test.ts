import { writeFileSync } from 'node:fs'
import { Worker } from 'node:worker_threads'

import { createTranslator } from 'next-intl'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'

import messages from '../../../messages/de.json'
import { defaultMarketingDoc, defaultPrivacyDoc, filledTexts, type GuestSheetSnapshot } from '@/lib/guest-sheet'
import type { GuestSheetPdfResult, GuestSheetPdfView } from '@/lib/guest-sheet-pdf/types'
import { buildGuestSheetPdfView } from '@/lib/guest-sheet-pdf/view'

// Prüft den gebauten Arbeitsprozess (npm test baut ihn vorab) mit echten Schriften und Texten (PROJ-26)
const WORKER = `${process.cwd()}/pdf-worker-build/render-worker.mjs`
// 1×1 Pixel, reicht für die Prüfung; zum Ansehen siehe PDF_OUT
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const issuer = { name: 'Pichler Ferienwohnungen', addressLine1: 'Dorfstraße 3', addressLine2: null, postalCode: '6020', city: 'Innsbruck', country: 'AT', email: 'office@pichler.at', phone: '+43 512 123456' }
const texts = filledTexts({ privacy: defaultPrivacyDoc(), marketing: defaultMarketingDoc() }, issuer)

const snapshot = (companions: number): GuestSheetSnapshot => ({
  version: 1,
  tenantName: issuer.name,
  sheetNumber: '2026/17',
  guest: {
    lastName: 'Rossi',
    firstName: 'Giulia',
    titlePrefix: null,
    titleSuffix: null,
    gender: 'female',
    birthDate: '1985-04-03',
    country: 'IT',
    documentType: 'passport',
    documentNumber: 'YA1234567',
    documentIssuedOn: '2020-02-01',
    documentAuthority: 'Questura di Bolzano',
    documentCountry: 'IT',
    street: 'Via Roma 1',
    postalCode: '39100',
    city: 'Bolzano',
    addressCountry: 'IT',
    documentFrontPath: null,
    documentBackPath: null,
  },
  companions: Array.from({ length: companions }, (_, i) => ({ lastName: 'Rossi', firstName: `Kind ${i + 1}`, birthDate: '2016-07-09' })),
  stay: { arrival: '2026-11-02', plannedDeparture: '2026-11-09', persons: companions + 1 },
  privacyText: texts.privacy,
  marketingText: texts.marketing,
  marketingConsent: true,
  signedAt1: '2026-11-02T14:05:00Z',
  signedAt2: '2026-11-02T14:06:00Z',
})

const t = createTranslator({ locale: 'de', messages, namespace: 'guestSheets.pdf' })
const tg = createTranslator({ locale: 'de', messages, namespace: 'guests.gender' })
const tdt = createTranslator({ locale: 'de', messages, namespace: 'guests.documentType' })

const view = (s: GuestSheetSnapshot, departure: Parameters<typeof buildGuestSheetPdfView>[0]['departure'] = null) =>
  buildGuestSheetPdfView({
    snapshot: s,
    departure,
    signatures: { first: PNG, second: PNG },
    t: (key, values) => t(key as never, values as never),
    genderLabel: (g) => tg(g as never),
    documentTypeLabel: (d) => tdt(d as never),
    locale: 'de',
  })

function render(v: GuestSheetPdfView): Promise<GuestSheetPdfResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(WORKER, { workerData: v })
    w.once('message', (m: { ok: true; result: GuestSheetPdfResult } | { ok: false; message: string }) => {
      void w.terminate()
      if (m.ok) resolve(m.result)
      else reject(new Error(m.message))
    })
    w.once('error', reject)
  })
}

async function pageTexts(pdf: Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data: pdf.slice() }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    out.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' '))
  }
  return out
}

// Zum Ansehen: PDF_OUT=/pfad/ npm test … schreibt die erzeugten Dateien
const keep = (name: string, pdf: Uint8Array) => {
  if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/${name}.pdf`, pdf)
}

describe('PDF Gästeblatt', () => {
  it('Seite 1 Meldedaten, Seite 2 Datenschutz', async () => {
    const r = await render(view(snapshot(1)))
    keep('gaesteblatt', r.pdf)
    expect(r.pages).toBe(2)
    const [first, second] = await pageTexts(r.pdf)
    for (const s of ['Gästeverzeichnisblatt', 'Pichler Ferienwohnungen', '2026/17', 'Rossi', 'Giulia', '03.04.1985', 'Italien', 'Reisepass', 'YA1234567', 'Bolzano', 'Kind 1', 'Seite 1 von 2']) {
      expect(first).toContain(s)
    }
    for (const s of ['Datenschutz', 'Information zur Verarbeitung Ihrer Daten', 'office@pichler.at', 'Einwilligung in Marketing', 'Ich willige ein.', 'Seite 2 von 2']) {
      expect(second).toContain(s)
    }
  })

  it('mit Abreise-Nachtrag und vielen Mitreisenden', async () => {
    const r = await render(view(snapshot(8), { date: '2026-11-09', noted: { at: '2026-11-09T08:00:00Z', by: 'Eva Pichler' }, automatic: false }))
    keep('gaesteblatt-nachtrag', r.pdf)
    const texts = await pageTexts(r.pdf)
    expect(texts.join(' ')).toContain('Kind 8')
    expect(texts.join(' ')).toContain('nachgetragen am')
    expect(texts.join(' ')).toContain('Eva Pichler')
  })
})
