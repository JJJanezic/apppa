import { writeFileSync } from 'node:fs'
import { Worker } from 'node:worker_threads'

import { createTranslator } from 'next-intl'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'

import messages from '../../../messages/de.json'
import { countryName } from '@/lib/guests'
import { DEFAULT_LETTERHEAD } from '@/lib/letterhead'
import { buildOrigin, buildStats, type StatsApartment, type StatsFilters, type StatsMonthRow, type StatsOriginRow } from '@/lib/statistics'
import type { StatsPdfResult, StatsPdfView } from '@/lib/statistics-pdf/types'
import { buildStatsPdfView } from '@/lib/statistics-pdf/view'

// Prüft den gebauten Arbeitsprozess (npm test baut ihn vorab) mit echten Schriften und echten Texten (PROJ-18)
const WORKER = `${process.cwd()}/pdf-worker-build/render-worker.mjs`

const translator = createTranslator({ locale: 'de-AT', messages, namespace: 'statistics' })
const t = (key: string, values?: Record<string, string | number>) => translator(key as never, values as never)

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const apartments: StatsApartment[] = [
  { id: 'a1', name: 'Top 1', propertyId: P1, propertyName: 'Haus Alpenblick', archived: false },
  { id: 'a2', name: 'Top 2', propertyId: P1, propertyName: 'Haus Alpenblick', archived: true },
  { id: 'a3', name: 'Studio', propertyId: P2, propertyName: 'Zentrum', archived: false },
]

const row = (apartmentId: string, month: string, over: Partial<StatsMonthRow> = {}): StatsMonthRow => ({
  apartmentId,
  month,
  availableNights: 31,
  occupiedNights: 18,
  blockedNights: 1,
  revenueCents: 180000,
  revenueVatCents: 16364,
  feeCents: 0,
  feeVatCents: 0,
  guestNights: 40,
  arrivals: 6,
  bookings: 3,
  stayNights: 18,
  ...over,
})

const rows: StatsMonthRow[] = []
for (let m = 1; m <= 12; m++) {
  for (const a of ['a1', 'a2', 'a3']) {
    rows.push(row(a, `2026-${String(m).padStart(2, '0')}`, { occupiedNights: 10 + m }))
    rows.push(row(a, `2025-${String(m).padStart(2, '0')}`, { occupiedNights: 8 + m, revenueCents: 150000 }))
  }
}
const COUNTRIES = ['AT', 'DE', 'CH', 'IT', 'NL', 'BE', 'FR', 'GB', 'US', 'CZ', 'HU', 'PL', 'SK', 'SI']
const origin: StatsOriginRow[] = COUNTRIES.flatMap((country, i) => [
  { apartmentId: 'a1', country, previous: false, arrivals: 20 - i, guestNights: 100 - i, revenueCents: 50000 },
  { apartmentId: 'a1', country, previous: true, arrivals: 10, guestNights: 80, revenueCents: 40000 },
])

function view(f: StatsFilters, over: Partial<StatsPdfView> = {}): StatsPdfView {
  const name = (c: string) => countryName(c, 'de')
  const { view: v } = buildStatsPdfView({
    view: buildStats(rows, apartments, f),
    origin: buildOrigin(origin, new Set(apartments.map((a) => a.id)), name, Number.POSITIVE_INFINITY),
    year: f.year,
    period: f.from === 1 && f.to === 12 ? String(f.year) : 'Oktober 2026',
    scope: f.apartment ? 'Haus Alpenblick · Top 1' : 'Alle Wohnungen',
    periodOpen: false,
    tenantName: 'Muster GmbH',
    issuer: { name: 'Muster GmbH', nameLine2: null, addressLine1: 'Seestraße 12', addressLine2: null, postalCode: '5753', city: 'Saalbach', country: 'AT', vatId: 'ATU12345678' },
    letterhead: DEFAULT_LETTERHEAD,
    logo: null,
    t,
    countryName: name,
    stand: 'So, 08.11.2026, 09:15',
    pageOf: translator.raw('pdf.pageOf') as string,
    locale: 'de',
  })
  return { ...v, ...over }
}

function render(v: StatsPdfView): Promise<StatsPdfResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(WORKER, { workerData: v })
    w.once('message', (m: { ok: true; result: StatsPdfResult } | { ok: false; message: string }) => {
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
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    out.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' '))
  }
  return out
}

// Zum Ansehen: PDF_OUT=/pfad/ npm test … schreibt die erzeugten Dateien
const keep = (name: string, pdf: Uint8Array) => {
  if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/${name}.pdf`, pdf)
}

const YEAR: StatsFilters = { year: 2026, from: 1, to: 12, property: null, apartment: null }

describe('PDF Auswertung', () => {
  it('ganzes Jahr: Kopf, Kennzahlen, Diagramme, alle Tabellen mit allen Ländern, Stand und Seitenzahlen', async () => {
    const r = await render(view(YEAR))
    keep('auswertung-jahr', r.pdf)
    expect(r.pages).toBeGreaterThan(1)
    const texts = await pageTexts(r.pdf)
    const all = texts.join(' ')
    for (const s of [
      'Muster GmbH',
      'Auswertung',
      'Zeitraum: 2026',
      'Wohnungen: Alle Wohnungen',
      'Auslastung',
      'Umsatz',
      'Vorjahr (2025)',
      'Je Monat',
      'Je Wohnung',
      'Haus Alpenblick',
      'archiviert',
      'Gästeherkunft',
      'Österreich',
      'Slowenien',
      'Gesamt',
      'Pp.',
    ]) {
      expect(all).toContain(s)
    }
    expect(all).not.toContain('Übrige Länder')
    texts.forEach((x, i) => {
      expect(x).toContain(`Seite ${i + 1} von ${r.pages}`)
      expect(x).toContain('Stand: So, 08.11.2026, 09:15')
    })
  })

  it('einzelne Wohnung: keine Tabelle „Je Wohnung“', async () => {
    const r = await render(view({ ...YEAR, from: 10, to: 10, apartment: 'a1' }))
    keep('auswertung-wohnung', r.pdf)
    const all = (await pageTexts(r.pdf)).join(' ')
    expect(all).toContain('Wohnungen: Haus Alpenblick · Top 1')
    expect(all).not.toContain('Je Wohnung')
  })

  it('ohne Aussteller-Block und mit Hinweis auf offenen Zeitraum', async () => {
    const r = await render(view(YEAR, { issuer: null, notice: t('periodOpen') }))
    const [text] = await pageTexts(r.pdf)
    expect(text).toContain('Vermieter: Muster GmbH, Seestraße 12')
    expect(text).toContain('Zeitraum noch nicht abgeschlossen')
  })
})
