import { writeFileSync } from 'node:fs'
import { Worker } from 'node:worker_threads'

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'

import { DEFAULT_LETTERHEAD } from '@/lib/letterhead'
import type { TaxPdfResult, TaxPdfView } from '@/lib/tourist-tax-pdf/types'
import { buildTaxPdfView } from '@/lib/tourist-tax-pdf/view'
import { buildTaxReport, type TaxReportRow } from '@/lib/tourist-tax-report'

// Prüft den gebauten Arbeitsprozess (npm test baut ihn vorab) mit echten Schriften (PROJ-16)
const WORKER = `${process.cwd()}/pdf-worker-build/render-worker.mjs`

const t = (key: string, values?: Record<string, string | number>) => {
  const texts: Record<string, string> = {
    title: 'Ortstaxe',
    periodOpen: 'Zeitraum noch nicht abgeschlossen',
    'filters.allMunicipalities': 'Alle Gemeinden',
    'summary.title': 'Übersicht',
    'summary.municipality': 'Gemeinde',
    'summary.taxable': 'Abgabepflichtige Personennächte',
    'summary.exempt': 'Befreite Personennächte',
    'summary.amount': 'Betrag',
    'summary.total': 'Gesamt',
    'summary.unknown': 'inkl. {count} ohne Personennächte',
    'bookings.title': 'Buchungen',
    'bookings.anonymized': 'Anonymisiert',
    'bookings.noGuest': 'Ohne Hauptgast',
    'bookings.col.number': 'Nr.',
    'bookings.col.guest': 'Hauptgast',
    'bookings.col.apartment': 'Wohnung',
    'bookings.col.stay': 'Aufenthalt',
    'bookings.col.persons': 'Personen',
    'bookings.col.taxable': 'Abgabepfl. PN',
    'bookings.col.exempt': 'Befreite PN',
    'bookings.col.amount': 'Betrag',
    'bookings.col.note': 'Hinweis',
    'bookings.notes.partial': 'anteilig',
    'bookings.notes.legacy': 'Alt-Position',
    'bookings.notes.percent': 'Prozent-Tarif',
    'pdf.period': 'Zeitraum: {period}',
    'pdf.municipality': 'Gemeinde: {name}',
    'pdf.customer': 'Vermieter: {customer}',
    'pdf.vatId': 'UID: {id}',
    'pdf.stand': 'Stand: {stand}',
  }
  return Object.entries(values ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), texts[key] ?? key)
}

const row = (i: number, over: Partial<TaxReportRow> = {}): TaxReportRow => ({
  bookingId: `b${i}`,
  bookingNumber: `2026-${String(i).padStart(4, '0')}`,
  guestName: 'Šimek Jan',
  anonymized: false,
  apartment: 'Haus am Hang · Top 1',
  municipalityId: '50618',
  municipalityName: 'Saalbach-Hinterglemm',
  arrival: '2026-10-02',
  departure: '2026-10-06',
  persons: 3,
  amountCents: 2400,
  taxableNights: 8,
  knownTaxableNights: 8,
  exemptNights: 4,
  unknownPositions: 0,
  partial: false,
  legacy: false,
  percent: false,
  ...over,
})

function view(rows: TaxReportRow[], municipality: string | null, over: Partial<TaxPdfView> = {}): TaxPdfView {
  const report = buildTaxReport(rows, municipality)
  const { view: v } = buildTaxPdfView({
    report,
    period: 'Oktober 2026',
    municipalityName: report.municipalities.find((m) => m.id === report.municipality)?.name ?? null,
    periodOpen: false,
    tenantName: 'Muster GmbH',
    issuer: { name: 'Muster GmbH', nameLine2: null, addressLine1: 'Seestraße 12', addressLine2: null, postalCode: '5753', city: 'Saalbach', country: 'AT', vatId: 'ATU12345678' },
    letterhead: DEFAULT_LETTERHEAD,
    logo: null,
    t,
    stand: 'So, 08.11.2026, 09:15',
    pageOf: 'Seite {page} von {pages}',
    locale: 'de',
  })
  return { ...v, ...over }
}

function render(v: TaxPdfView): Promise<TaxPdfResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(WORKER, { workerData: v })
    w.once('message', (m: { ok: true; result: TaxPdfResult } | { ok: false; message: string }) => {
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

describe('PDF Ortstaxen-Bericht', () => {
  it('eine Gemeinde: Kopf, Angaben, Übersicht, Buchungen, Stand und Seitenzahl auf einer Seite', async () => {
    const r = await render(view([row(1), row(2, { anonymized: true, guestName: null, legacy: true, taxableNights: null, knownTaxableNights: 0, exemptNights: null, unknownPositions: 1 })], '50618'))
    keep('eine-gemeinde', r.pdf)
    expect(r.pages).toBe(1)
    const [text] = await pageTexts(r.pdf)
    for (const s of ['Muster GmbH', 'Ortstaxe', 'Zeitraum: Oktober 2026', 'Gemeinde: Saalbach-Hinterglemm', 'Übersicht', 'Buchungen · Saalbach-Hinterglemm', 'Šimek Jan', 'Anonymisiert', 'Alt-Position', 'inkl. 1 ohne Personennächte', 'Stand: So, 08.11.2026, 09:15', 'Seite 1 von 1']) {
      expect(text).toContain(s)
    }
    expect(text).not.toContain('Gesamt')
  })

  it('alle Gemeinden: Gesamtübersicht vorn, jede Gemeinde auf neuer Seite', async () => {
    const r = await render(view([row(1), row(2, { municipalityId: '50628', municipalityName: 'Zell am See' })], null))
    keep('alle-gemeinden', r.pdf)
    const texts = await pageTexts(r.pdf)
    expect(r.pages).toBe(3)
    expect(texts[0]).toContain('Gemeinde: Alle Gemeinden')
    expect(texts[0]).toContain('Gesamt')
    expect(texts[1]).toContain('Saalbach-Hinterglemm')
    expect(texts[1]).not.toContain('Zell am See')
    expect(texts[2]).toContain('Zell am See')
    texts.forEach((x, i) => expect(x).toContain(`Seite ${i + 1} von 3`))
  })

  it('lange Liste: Tabellenkopf auf jeder Folgeseite, Kopf mit Aussteller nur auf Seite 1', async () => {
    const rows = Array.from({ length: 90 }, (_, i) => row(i + 1, { arrival: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` }))
    const r = await render(view(rows, '50618'))
    keep('lange-liste', r.pdf)
    expect(r.pages).toBeGreaterThan(2)
    const texts = await pageTexts(r.pdf)
    texts.forEach((x, i) => {
      expect(x).toContain('Hauptgast')
      expect(x).toContain(`Seite ${i + 1} von ${r.pages}`)
      expect(x).toContain('Stand:')
      if (i > 0) expect(x).not.toContain('Seestraße 12')
    })
    // alle 90 Buchungen stehen im PDF
    expect(texts.join(' ').match(/2026-00\d\d/g)?.length).toBeGreaterThanOrEqual(90)
  })

  it('ohne Aussteller-Block und mit Hinweis auf offenen Zeitraum', async () => {
    const r = await render(view([row(1)], '50618', { issuer: null, notice: 'Zeitraum noch nicht abgeschlossen' }))
    const [text] = await pageTexts(r.pdf)
    // Name nur in der Zeile „Vermieter“, nicht zusätzlich im Kopf
    expect(text.match(/Muster GmbH/g)).toHaveLength(1)
    expect(text).toContain('Vermieter: Muster GmbH, Seestraße 12')
    expect(text).toContain('Zeitraum noch nicht abgeschlossen')
  })
})
