import { Worker } from 'node:worker_threads'

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'

import type { PdfResult, PdfView } from '@/lib/invoice-pdf/types'
import { DEFAULT_LETTERHEAD } from '@/lib/letterhead'
import { docFromText } from '@/lib/rich-text'

// Prüft den gebauten Arbeitsprozess (npm test baut ihn vorab) mit echten Schriften.
const WORKER = `${process.cwd()}/pdf-worker-build/render-worker.mjs`

const view = (over: Partial<PdfView> = {}): PdfView => ({
  title: 'Rechnung',
  letterhead: DEFAULT_LETTERHEAD,
  mark: 'Entwurf',
  logo: null,
  issuer: [{ text: 'Muster GmbH', bold: true }, { text: 'Seestraße 12' }],
  recipient: [{ text: 'Jan Šimek', bold: true }, { text: 'Hauptstraße 5' }],
  placeDate: 'Velden, 04.11.2026',
  heading: 'Rechnung',
  numberLine: 'Rechnungsnummer: 2026-0007',
  periodLine: 'Rechnung für Seeblick',
  guestsLine: null,
  intro: docFromText('Position Preis Übernachtung Šőž'),
  services: { rows: [{ label: 'Position 1', amount: '€ 700,00' }], totals: [{ label: 'Rechnungsbetrag', amount: '€ 700,00', bold: true }], note: null, vatTitle: null, vatRows: [] },
  smallBusinessNote: null,
  payment: null,
  closing: null,
  footer: docFromText('Bankverbindung IBAN AT12 Muster GmbH Šőž'),
  pageOf: 'Seite {page} von {pages}',
  ...over,
})

function render(v: PdfView): Promise<PdfResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(WORKER, { workerData: v })
    w.once('message', (m: { ok: true; result: PdfResult } | { ok: false; message: string }) => {
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

// Datum und Dateikennung ändern sich je Erzeugung
const stable = (pdf: Uint8Array) =>
  Buffer.from(pdf)
    .toString('latin1')
    .replace(/\(D:\d+Z\)|\/ID \[[^\]]*\]/g, '')

describe('PDF-Arbeitsprozess', () => {
  it('setzt Text mit Sonderzeichen vollständig und ohne Seitenzahl auf einer Seite', async () => {
    const r = await render(view())
    expect(r.pages).toBe(1)
    const [text] = await pageTexts(r.pdf)
    expect(text).toContain('Šimek')
    expect(text).toContain('Rechnungsbetrag')
    expect(text).not.toContain('Seite 1')
  })

  // Vorab-Versuch: Wurde im selben Prozess zuvor ein anderes Dokument erzeugt, fehlten Buchstaben. Zwei Durchgänge im
  // selben Arbeitsprozess dürfen deshalb keinen Unterschied machen: mit Fußzeile (zwei Durchgänge) muss der Inhalt
  // gleich bleiben, auch wenn zwei Erzeugungen nacheinander laufen.
  it('erzeugt bei jedem Lauf dasselbe Dokument', async () => {
    const a = await render(view())
    await render(view({ intro: docFromText('Ganz anderer Text Qq Xx Zz') }))
    const b = await render(view())
    expect(stable(b.pdf)).toBe(stable(a.pdf))
  })

  it('mehrseitig: Seitenzahl auf jeder Seite, Fußzeile auf jeder Seite, Nummer ab Seite 2, Kopf nur auf Seite 1', async () => {
    const rows = Array.from({ length: 70 }, (_, i) => ({ label: `Position ${i}`, amount: '€ 1,00' }))
    const r = await render(view({ services: { ...view().services, rows } }))
    expect(r.pages).toBeGreaterThan(1)
    const texts = await pageTexts(r.pdf)
    texts.forEach((t, i) => {
      expect(t).toContain(`Seite ${i + 1} von ${r.pages}`)
      expect(t).toContain('Bankverbindung')
    })
    expect(texts[0]).toContain('Seestraße 12')
    expect(texts[1]).not.toContain('Seestraße 12')
    expect(texts[1]).toContain('Rechnungsnummer: 2026-0007')
    expect(texts[0].match(/Rechnungsnummer: 2026-0007/g)).toHaveLength(1)
  })

  it('misst eine lange Fußzeile', async () => {
    const short = await render(view())
    const long = await render(view({ footer: docFromText('Bankverbindung IBAN '.repeat(150)) }))
    expect(long.footerShare).toBeGreaterThan(short.footerShare)
  })

  it('nutzt Schrift aus einem einzelnen Text zusätzlich zur Grundschrift', async () => {
    const r = await render(view({ intro: { ...docFromText('Position'), attrs: { fontFamily: 'tinos', fontSize: 14, textAlign: 'center' } } }))
    const raw = Buffer.from(r.pdf).toString('latin1')
    expect(raw).toMatch(/Tinos/)
    expect(raw).toMatch(/Carlito/)
  })
})
