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

  async function rightEdge(pdf: Uint8Array, needle: string): Promise<number> {
    const page = await (await getDocument({ data: pdf.slice() }).promise).getPage(1)
    const content = await page.getTextContent()
    return Math.max(...content.items.filter((i) => 'str' in i && i.str.includes(needle)).map((i) => ('str' in i ? i.transform[4] + i.width : 0)))
  }
  const PAGE_RIGHT_PT = 595.28 - (20 * 72) / 25.4

  it('BUG-1: langes Wort ohne Leerzeichen bleibt innerhalb des Seitenrands', async () => {
    const word = 'A'.repeat(180)
    const r = await render(view({ intro: docFromText(word) }))
    expect(await rightEdge(r.pdf, 'AAAA')).toBeLessThanOrEqual(PAGE_RIGHT_PT + 1)
  })

  it('BUG-2: langer Firmenname im Aussteller-Block wird umgebrochen statt abgeschnitten', async () => {
    const name = 'Sehr lange Firma mit ausführlichem Namen und noch mehr Worten Gesellschaft mit beschränkter Haftung und Co KG'
    const logo = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64'))
    const r = await render(view({ logo: { data: logo, widthMm: 25, heightMm: 25 }, issuer: [{ text: name, bold: true }] }))
    expect(await rightEdge(r.pdf, 'Sehr lange Firma')).toBeLessThanOrEqual(PAGE_RIGHT_PT + 1)
  })

  it('BUG-2: kurze Namen bleiben in voller Größe, ein Block über die Kopfhöhe wird kleiner und meldet nur echten Überlauf', async () => {
    const short = await render(view())
    expect(short.issuerOverflow).toBe(false)
    const many = Array.from({ length: 7 }, (_, i) => ({ text: `Zeile ${i} mit einem längeren Text darin und mehr` }))
    const logo = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64'))
    const r = await render(view({ logo: { data: logo, widthMm: 95, heightMm: 25 }, issuer: many }))
    expect(r.issuerOverflow).toBe(false)
    const huge = await render(view({ logo: { data: logo, widthMm: 95, heightMm: 25 }, issuer: Array.from({ length: 40 }, () => many[0]) }))
    expect(huge.issuerOverflow).toBe(true)
  })

  it('BUG-5: überlange Fußzeile wird verkleinert und lässt Platz für den Inhalt', async () => {
    const r = await render(view({ footer: { ...docFromText('Bankverbindung IBAN AT12 3456 '.repeat(66)), attrs: { fontSize: 24 } } }))
    expect(r.footerReduced).toBe(true)
    expect(r.footerShare).toBeLessThanOrEqual(0.4)
    expect((await pageTexts(r.pdf)).join(' ')).toContain('Rechnungsbetrag')
    const normal = await render(view())
    expect(normal.footerReduced).toBe(false)
  })

  it('BUG-6: meldet Zeichen, die die Schrift nicht kennt; übliche Zeichen nicht', async () => {
    const r = await render(view({ intro: docFromText('Haken ✓ Emoji 😀 Pfeil → Euro € Šőž') }))
    expect(r.missingChars).toEqual(expect.arrayContaining(['✓', '😀']))
    expect(r.missingChars).not.toContain('€')
    expect(r.missingChars).not.toContain('Š')
    expect((await render(view())).missingChars).toEqual([])
  })

  async function yOf(pdf: Uint8Array, needle: string): Promise<number> {
    const page = await (await getDocument({ data: pdf.slice() }).promise).getPage(1)
    const content = await page.getTextContent()
    const item = content.items.find((i) => 'str' in i && i.str.includes(needle))
    if (!item || !('transform' in item)) throw new Error(`nicht gefunden: ${needle}`)
    return item.transform[5]
  }
  type Spacing = 'tight' | 'normal' | 'wide'

  it('Zeilen- und Absatzabstand: eng < normal < weit', async () => {
    const line = async (s: Spacing) => {
      const r = await render(view({ letterhead: { ...DEFAULT_LETTERHEAD, lineSpacing: s } }))
      return (await yOf(r.pdf, 'Rechnungsnummer')) - (await yOf(r.pdf, 'Rechnung für Seeblick'))
    }
    const [tl, nl, wl] = [await line('tight'), await line('normal'), await line('wide')]
    expect(tl).toBeLessThan(nl)
    expect(nl).toBeLessThan(wl)
    const para = async (s: Spacing) => {
      const r = await render(view({ letterhead: { ...DEFAULT_LETTERHEAD, paragraphSpacing: s }, intro: docFromText('Absatz eins\n\nAbsatz zwei') }))
      return (await yOf(r.pdf, 'Absatz eins')) - (await yOf(r.pdf, 'Absatz zwei'))
    }
    const [tp, np, wp] = [await para('tight'), await para('normal'), await para('wide')]
    expect(tp).toBeLessThan(np)
    expect(np).toBeLessThan(wp)
  })

  it('Übliche Zeichen deutscher Texte gelten in allen sechs Schriften nicht als fehlend', async () => {
    const text = 'äöüÄÖÜß „Zitat“ ‚a‘ » « – — … • · € § % ° ² × ’ & @ ÁČŠŽŁőń x'
    for (const font of ['arimo', 'tinos', 'carlito', 'source-sans', 'source-serif', 'open-sans'] as const) {
      const r = await render(view({ letterhead: { ...DEFAULT_LETTERHEAD, fontFamily: font }, intro: docFromText(text) }))
      expect(r.missingChars, font).toEqual([])
    }
  })

  it('BUG-7: Unsichtbare Zeichen aus eingefügten Texten fallen weg und lösen keinen Hinweis aus', async () => {
    const r = await render(view({ intro: docFromText('Rech­nung Null​breite') }))
    expect(r.missingChars).toEqual([])
    const [text] = await pageTexts(r.pdf)
    expect(text).toContain('Rechnung Nullbreite')
  })

  it('Wort über 30 Zeichen, das in die Zeile passt, bleibt ganz und ohne Trennstrich', async () => {
    const word = 'Donaudampfschifffahrtsgesellschaft'
    const r = await render(view({ intro: docFromText(word) }))
    expect((await pageTexts(r.pdf))[0].replace(/\s/g, '')).toContain(word)
  })

  it('IBAN ohne Leerzeichen bleibt ganz', async () => {
    const iban = 'MT84MALT011000012345MTLCAST001S'
    const r = await render(view({ footer: docFromText(`IBAN ${iban}`) }))
    expect((await pageTexts(r.pdf))[0].replace(/\s/g, '')).toContain(iban)
  })
})
