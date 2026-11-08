import 'server-only'

import { getLocale, getTranslations } from 'next-intl/server'

import { apartmentLabel } from '@/lib/apartments'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { todayIso } from '@/lib/bookings'
import { formatDateTime } from '@/lib/format'
import { countryName } from '@/lib/guests'
import { getPreviewDataFor } from '@/lib/invoice-drafts-data'
import { PdfBusyError, renderStatsPdf } from '@/lib/invoice-pdf/render'
import { DEFAULT_LETTERHEAD } from '@/lib/letterhead'
import { loadPdfLogo } from '@/lib/letterhead-data'
import {
  buildOrigin,
  buildStats,
  buildStatsCsv,
  filteredApartmentIds,
  parseStatsFilters,
  resolveStatsFilters,
  type StatsApartment,
  type StatsFilters,
  statsFileName,
  type StatsTenant,
  tenantsInScope,
} from '@/lib/statistics'
import { getStatsData, type StatsData } from '@/lib/statistics-data'
import { buildStatsPdfView } from '@/lib/statistics-pdf/view'
import { periodLabel, periodOpen } from '@/lib/tourist-tax-report'

// Exporte der Auswertungen (PROJ-18): PDF und CSV für den gewählten Kunden, nur Inhaber. Gleiche Filter und Daten wie
// die Seite. Enthält Geschäftszahlen: nie zwischenspeichern.

const NO_STORE = { 'cache-control': 'no-store' }
const status = (code: number) => new Response(null, { status: code, headers: NO_STORE })

// tenant: der einzige Kunde in der Auswertung (Briefpapier); null bei mehreren Kunden
type Loaded = { tenant: StatsTenant | null; filters: StatsFilters; data: StatsData; today: string }

// Anmeldung, Inhaber-Rolle bei mindestens einem Kunden und Daten; sonst die passende Fehlerantwort. Kunde, Objekt und
// Wohnung aus der Adresse gelten nur innerhalb der Inhaber-Kunden (refine 2026-11-08).
async function load(request: Request, origin: boolean): Promise<Loaded | Response> {
  const user = await getSessionUser()
  if (!user) return status(401)
  if (await pendingMfaStep(user)) return status(403)
  const today = todayIso()
  const requested = parseStatsFilters(Object.fromEntries(new URL(request.url).searchParams), today)
  const data = await getStatsData(requested, { origin })
  if (data.tenants.length === 0) return status(403)
  if (!data.ready) return status(503)
  if (data.failed) return status(500)
  const filters = resolveStatsFilters(requested, data.apartments, data.tenants)
  if (buildStats(data.rows, data.apartments, filters, data.tenants).empty) return status(404)
  const scope = tenantsInScope(filters, data.tenants)
  return { tenant: scope.length === 1 ? scope[0] : null, filters, data, today }
}

// „attachment“ mit ASCII-Ersatznamen und dem vollen Namen in UTF-8 (Umlaute in Objektnamen)
function disposition(fileName: string): string {
  const ascii = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

// Filter in Worten: „Alle Wohnungen“, Objektname oder „Objekt · Wohnung“
function scopeLabel(f: StatsFilters, apartments: readonly StatsApartment[], all: string): string {
  const apt = f.apartment ? apartments.find((a) => a.id === f.apartment) : null
  if (apt) return apartmentLabel(apt.propertyName, apt.name)
  const prop = f.property ? apartments.find((a) => a.propertyId === f.property) : null
  return prop ? prop.propertyName : all
}

export async function statsCsvResponse(request: Request): Promise<Response> {
  const loaded = await load(request, false)
  if (loaded instanceof Response) return loaded
  const t = await getTranslations('statistics')
  const csv = buildStatsCsv(loaded.data.rows, loaded.data.apartments, loaded.filters, { columns: t.raw('csv.columns') as string[] })
  const fileName = statsFileName('csv', loaded.filters, loaded.data.apartments, loaded.data.tenants, loaded.today)
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': disposition(fileName),
    },
  })
}

export async function statsPdfResponse(request: Request): Promise<Response> {
  const loaded = await load(request, true)
  if (loaded instanceof Response) return loaded
  try {
    const { filters, data } = loaded
    // Ein Kunde: dessen Briefpapier, Aussteller und Logo (auch wenn er nicht der gewählte Kunde ist). Mehrere Kunden: neutraler
    // Kopf ohne Briefpapier, Grundwerte der Gestaltung, Zeile „Kunden: …“ (refine 2026-11-08)
    const [t, tTax, locale, preview, { logo }] = await Promise.all([
      getTranslations('statistics'),
      getTranslations('touristTaxReport'),
      getLocale(),
      loaded.tenant ? getPreviewDataFor(loaded.tenant.id) : Promise.resolve(null),
      loaded.tenant ? loadPdfLogo(loaded.tenant.id) : Promise.resolve({ logo: null, failed: false }),
    ])
    const tt = (key: string, values?: Record<string, string | number>) => t(key as never, values as never)
    const name = (code: string) => countryName(code, locale)
    const { view } = buildStatsPdfView({
      view: buildStats(data.rows, data.apartments, filters, data.tenants),
      // im PDF alle Länder ausgeschrieben
      origin: buildOrigin(data.origin, filteredApartmentIds(filters, data.apartments), name, Number.POSITIVE_INFINITY),
      year: filters.year,
      period: periodLabel((key, values) => tTax(key as never, values as never), filters),
      scope: scopeLabel(filters, data.apartments, t('filters.allApartments')),
      periodOpen: periodOpen(filters, loaded.today),
      tenantName: loaded.tenant?.name ?? '',
      tenantNames: loaded.tenant ? null : tenantsInScope(filters, data.tenants).map((x) => x.name),
      issuer: preview?.issuer ?? null,
      letterhead: preview?.letterhead ?? { ...DEFAULT_LETTERHEAD, showIssuer: false },
      logo,
      t: tt,
      countryName: name,
      stand: formatDateTime(new Date()),
      pageOf: t.raw('pdf.pageOf') as string,
      locale,
    })
    const { pdf } = await renderStatsPdf(view)
    return new Response(Buffer.from(pdf), {
      headers: {
        ...NO_STORE,
        'content-type': 'application/pdf',
        'content-disposition': disposition(statsFileName('pdf', filters, data.apartments, data.tenants, loaded.today)),
      },
    })
  } catch (e) {
    if (e instanceof PdfBusyError) return status(503)
    console.error('[auswertungen-pdf] Erzeugung fehlgeschlagen', e instanceof Error ? e.message : e)
    return status(500)
  }
}
