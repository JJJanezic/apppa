// Vom Ortstaxen-Bericht (PROJ-16) zu den fertigen Daten der PDF-Vorlage. Reine Regel.

import { formatCents, formatDatePlain } from '@/lib/format'
import { countryName } from '@/lib/guests'
import type { PdfLine } from '@/lib/invoice-pdf/types'
import { type LetterheadValues, logoBox, type LogoBox } from '@/lib/letterhead'
import { TAX_REPORT_PDF_KIND, type TaxPdfSummaryRow, type TaxPdfView } from '@/lib/tourist-tax-pdf/types'
import { rowNotes, type TaxReportRow, type TaxReportSum, type TaxReportView } from '@/lib/tourist-tax-report'

type T = (key: string, values?: Record<string, string | number>) => string

export type TaxPdfIssuer = {
  name: string
  nameLine2: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  vatId: string | null
} | null

export type TaxPdfInput = {
  report: TaxReportView
  // „Oktober 2026“
  period: string
  // gewählte Gemeinde; null = „Alle Gemeinden“
  municipalityName: string | null
  periodOpen: boolean
  tenantName: string
  issuer: TaxPdfIssuer
  letterhead: LetterheadValues
  logo: { data: Uint8Array; widthPx: number; heightPx: number } | null
  // Übersetzungen des Bereichs „touristTaxReport“
  t: T
  stand: string
  pageOf: string
  locale: string
}

const place = (postalCode: string | null | undefined, city: string | null | undefined) => [postalCode, city].filter(Boolean).join(' ')

export function addressParts(i: NonNullable<TaxPdfIssuer>, locale: string): string[] {
  return [i.nameLine2, i.addressLine1, i.addressLine2, place(i.postalCode, i.city), i.country ? countryName(i.country, locale) : null].filter((x): x is string => Boolean(x))
}

// Aussteller-Block wie auf der Rechnung: Name fett, darunter die Anschrift; unter einem mittigen Logo zweizeilig
export function issuerLines(i: TaxPdfIssuer, v: LetterheadValues, t: T, locale: string): PdfLine[] | null {
  if (!v.showIssuer || !i) return null
  const rest = [...addressParts(i, locale), ...(i.vatId ? [t('pdf.vatId', { id: i.vatId })] : [])]
  if (v.logoPosition === 'center') return [{ text: i.name, bold: true }, ...(rest.length ? [{ text: rest.join(' · ') }] : [])]
  return [{ text: i.name, bold: true }, ...rest.map((text) => ({ text }))]
}

// Hinweise unter einer Übersichtszeile: unbekannte abgabepflichtige und nicht bestimmbare befreite Personennächte
const unknownNote = (s: TaxReportSum, t: T) =>
  [s.unknownPositions > 0 ? t('summary.unknown', { count: s.unknownPositions }) : null, s.exemptUnknown > 0 ? t('summary.exemptUnknown', { count: s.exemptUnknown }) : null]
    .filter(Boolean)
    .join(' · ') || null

const summaryRow = (label: string, s: TaxReportSum, t: T, bold = false): TaxPdfSummaryRow => ({
  label,
  cells: [String(s.taxableNights), String(s.exemptNights), formatCents(s.amountCents)],
  note: unknownNote(s, t),
  bold,
})

const nights = (n: number | null) => (n === null ? '–' : String(n))

function bookingCells(r: TaxReportRow, t: T): string[] {
  return [
    r.bookingNumber ?? '–',
    r.anonymized ? t('bookings.anonymized') : (r.guestName ?? t('bookings.noGuest')),
    r.apartment,
    `${formatDatePlain(r.arrival)} –\n${formatDatePlain(r.departure)}`,
    String(r.persons),
    nights(r.taxableNights),
    nights(r.exemptNights),
    formatCents(r.amountCents),
    rowNotes(r)
      .map((n) => t(`bookings.notes.${n}`))
      .join(', '),
  ]
}

export function buildTaxPdfView(p: TaxPdfInput): { view: TaxPdfView; logo: LogoBox | null } {
  const { report, t, letterhead: v } = p
  const box = p.logo ? logoBox({ widthPx: p.logo.widthPx, heightPx: p.logo.heightPx }, v) : null
  const all = p.municipalityName === null
  const customer = [p.issuer?.name ?? p.tenantName, ...(p.issuer ? addressParts(p.issuer, p.locale) : [])].join(', ')
  const summaryRows = report.groups.map((g) => summaryRow(g.name, g.sum, t))
  if (report.total) summaryRows.push(summaryRow(t('summary.total'), report.total, t, true))
  return {
    logo: box,
    view: {
      kind: TAX_REPORT_PDF_KIND,
      title: `${t('title')} ${p.period}`,
      letterhead: v,
      logo: p.logo && box ? { data: p.logo.data, widthMm: box.widthMm, heightMm: box.heightMm } : null,
      issuer: issuerLines(p.issuer, v, t, p.locale),
      heading: t('title'),
      meta: [
        t('pdf.period', { period: p.period }),
        t('pdf.municipality', { name: p.municipalityName ?? t('filters.allMunicipalities') }),
        t('pdf.customer', { customer }),
      ],
      notice: p.periodOpen ? t('periodOpen') : null,
      summary: {
        title: t('summary.title'),
        columns: [t('summary.municipality'), t('summary.taxable'), t('summary.exempt'), t('summary.amount')],
        rows: summaryRows,
      },
      bookingsTitle: t('bookings.title'),
      columns: [
        t('bookings.col.number'),
        t('bookings.col.guest'),
        t('bookings.col.apartment'),
        t('bookings.col.stay'),
        t('bookings.col.persons'),
        t('bookings.col.taxable'),
        t('bookings.col.exempt'),
        t('bookings.col.amount'),
        t('bookings.col.note'),
      ],
      sections: report.groups.map((g) => ({
        title: g.name,
        summary: all ? summaryRow(g.name, g.sum, t) : null,
        rows: g.rows.map((r) => bookingCells(r, t)),
      })),
      pagePerSection: all,
      stand: t('pdf.stand', { stand: p.stand }),
      pageOf: p.pageOf,
    },
  }
}
