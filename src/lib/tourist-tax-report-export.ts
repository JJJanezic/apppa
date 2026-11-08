import 'server-only'

import { getLocale, getTranslations } from 'next-intl/server'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { todayIso } from '@/lib/bookings'
import { formatDateTime } from '@/lib/format'
import { getDraftPreviewData } from '@/lib/invoice-drafts-data'
import { PdfBusyError, renderTaxReportPdf } from '@/lib/invoice-pdf/render'
import { loadPdfLogo } from '@/lib/letterhead-data'
import { getTenantContext } from '@/lib/tenant'
import { buildTaxPdfView } from '@/lib/tourist-tax-pdf/view'
import {
  buildTaxReport,
  buildTaxReportCsv,
  parseTaxReportFilters,
  periodLabel,
  periodOpen,
  type RowNote,
  type TaxReportFilters,
  taxReportFileName,
  type TaxReportView,
} from '@/lib/tourist-tax-report'
import { getTouristTaxReport } from '@/lib/tourist-tax-report-data'

// Exporte der Ortstaxen-Berichte (PROJ-16): PDF und CSV für den gewählten Kunden, nur Inhaber. Gleiche Filter und Daten
// wie die Seite. Enthält Gästedaten: nie zwischenspeichern.

const NO_STORE = { 'cache-control': 'no-store' }
const status = (code: number) => new Response(null, { status: code, headers: NO_STORE })

type Loaded = { tenantId: string; tenantName: string; filters: TaxReportFilters; report: TaxReportView; municipalityName: string | null; today: string }

// Anmeldung, Inhaber-Rolle beim gewählten Kunden und Daten; sonst die passende Fehlerantwort
async function load(request: Request): Promise<Loaded | Response> {
  const user = await getSessionUser()
  if (!user) return status(401)
  if (await pendingMfaStep(user)) return status(403)
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return status(403)
  const today = todayIso()
  const requested = parseTaxReportFilters(Object.fromEntries(new URL(request.url).searchParams), today)
  const data = await getTouristTaxReport(requested)
  if (!data.ready) return status(503)
  if (data.failed) return status(500)
  const report = buildTaxReport(data.rows, requested.municipality)
  if (report.groups.length === 0) return status(404)
  const filters = { ...requested, municipality: report.municipality }
  const municipalityName = report.municipalities.find((m) => m.id === filters.municipality)?.name ?? null
  return { tenantId: active.id, tenantName: active.name, filters, report, municipalityName, today }
}

// „attachment“ mit ASCII-Ersatznamen und dem vollen Namen in UTF-8 (Umlaute in Gemeindenamen)
function disposition(fileName: string): string {
  const ascii = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function taxReportCsvResponse(request: Request): Promise<Response> {
  const loaded = await load(request)
  if (loaded instanceof Response) return loaded
  const t = await getTranslations('touristTaxReport')
  const csv = buildTaxReportCsv(loaded.report.groups, {
    columns: t.raw('csv.columns') as string[],
    notes: Object.fromEntries((['partial', 'legacy', 'percent'] as RowNote[]).map((n) => [n, t(`bookings.notes.${n}`)])) as Record<RowNote, string>,
    anonymized: t('bookings.anonymized'),
  })
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': disposition(taxReportFileName('csv', loaded.filters, loaded.municipalityName, loaded.today)),
    },
  })
}

export async function taxReportPdfResponse(request: Request): Promise<Response> {
  const loaded = await load(request)
  if (loaded instanceof Response) return loaded
  try {
    const [t, locale, preview, { logo }] = await Promise.all([getTranslations('touristTaxReport'), getLocale(), getDraftPreviewData(), loadPdfLogo(loaded.tenantId)])
    const tt = (key: string, values?: Record<string, string | number>) => t(key as never, values as never)
    const { view } = buildTaxPdfView({
      report: loaded.report,
      period: periodLabel(tt, loaded.filters),
      municipalityName: loaded.municipalityName,
      periodOpen: periodOpen(loaded.filters, loaded.today),
      tenantName: loaded.tenantName,
      issuer: preview.issuer,
      letterhead: preview.letterhead,
      logo,
      t: tt,
      stand: formatDateTime(new Date()),
      pageOf: t.raw('pdf.pageOf') as string,
      locale,
    })
    const { pdf } = await renderTaxReportPdf(view)
    return new Response(Buffer.from(pdf), {
      headers: {
        ...NO_STORE,
        'content-type': 'application/pdf',
        'content-disposition': disposition(taxReportFileName('pdf', loaded.filters, loaded.municipalityName, loaded.today)),
      },
    })
  } catch (e) {
    if (e instanceof PdfBusyError) return status(503)
    console.error('[ortstaxe-pdf] Erzeugung fehlgeschlagen', e instanceof Error ? e.message : e)
    return status(500)
  }
}
