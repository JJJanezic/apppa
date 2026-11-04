import 'server-only'

import { notFound } from 'next/navigation'

import { getSessionUser } from '@/lib/auth/session'
import { DEFAULT_LETTERHEAD, letterheadFromDb, type LetterheadValues } from '@/lib/letterhead'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { LOGO_BUCKET } from '@/lib/tenant-logo'
import { getTenantContext } from '@/lib/tenant'

export type LetterheadData = {
  tenantId: string
  values: LetterheadValues
  updatedAt: string
  hasLogo: boolean
  footerEmpty: boolean
}

const LETTERHEAD_COLUMNS =
  'letterhead_font, letterhead_font_size, letterhead_line_spacing, letterhead_paragraph_spacing, letterhead_logo_position, letterhead_logo_height_mm, letterhead_show_issuer, letterhead_updated_at, footer'

type LetterheadRow = {
  letterhead_font: unknown
  letterhead_font_size: unknown
  letterhead_line_spacing: unknown
  letterhead_paragraph_spacing: unknown
  letterhead_logo_position: unknown
  letterhead_logo_height_mm: unknown
  letterhead_show_issuer: unknown
  letterhead_updated_at: string
  footer: unknown
}

// Lesen dürfen Inhaber und Betreiber (RLS). Fehlen die Spalten noch (Migration aus /backend), gelten die Standardwerte.
export async function loadLetterhead(tenantId: string): Promise<LetterheadData> {
  const supabase = await createClient()
  const [settings, tenant] = await Promise.all([
    supabase.from('invoice_settings').select(LETTERHEAD_COLUMNS as 'footer').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenants').select('logo_path').eq('id', tenantId).maybeSingle(),
  ])
  if (settings.error) console.error('[briefpapier] Einstellungen nicht lesbar', settings.error.message)
  const r = settings.data as unknown as LetterheadRow | null
  return {
    tenantId,
    values: r
      ? letterheadFromDb({
          font: r.letterhead_font,
          font_size: r.letterhead_font_size,
          line_spacing: r.letterhead_line_spacing,
          paragraph_spacing: r.letterhead_paragraph_spacing,
          logo_position: r.letterhead_logo_position,
          logo_height_mm: r.letterhead_logo_height_mm,
          show_issuer: r.letterhead_show_issuer,
        })
      : DEFAULT_LETTERHEAD,
    updatedAt: r?.letterhead_updated_at ?? 'pending',
    hasLogo: Boolean(tenant.data?.logo_path),
    footerEmpty: !r?.footer,
  }
}

// Einstellungen → Briefpapier des gewählten Kunden, nur für Inhaber
export async function getOwnLetterhead(): Promise<LetterheadData> {
  const [user, { active }] = await Promise.all([getSessionUser(), getTenantContext()])
  if (!user || !active || active.role !== 'owner') notFound()
  return loadLetterhead(active.id)
}

// ---- Logo für das PDF ----------------------------------------------------------------------------------

export type PdfLogo = { data: Uint8Array; widthPx: number; heightPx: number }

// Breite und Höhe aus dem Kopf der PNG-Datei; das Logo ist immer PNG (PROJ-38)
function pngSize(data: Uint8Array): { widthPx: number; heightPx: number } | null {
  if (data.length < 24 || data[0] !== 0x89 || data[1] !== 0x50) return null
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const widthPx = view.getUint32(16)
  const heightPx = view.getUint32(20)
  return widthPx && heightPx ? { widthPx, heightPx } : null
}

// Liest das Logo mit dem geheimen Schlüssel. Nur aufrufen, nachdem der Zugriff auf den Kunden geprüft wurde: Mitarbeiter
// haben keinen Lesezugriff auf die Datei (PROJ-38), sehen das Logo aber in der Entwurfsvorschau.
export async function loadPdfLogo(tenantId: string): Promise<{ logo: PdfLogo | null; failed: boolean }> {
  const admin = createAdminClient()
  const { data: tenant } = await admin.from('tenants').select('logo_path').eq('id', tenantId).maybeSingle()
  if (!tenant?.logo_path) return { logo: null, failed: false }
  const { data, error } = await admin.storage.from(LOGO_BUCKET).download(tenant.logo_path)
  if (error || !data) {
    console.error('[briefpapier] Logo nicht lesbar', error?.message)
    return { logo: null, failed: true }
  }
  const bytes = new Uint8Array(await data.arrayBuffer())
  const size = pngSize(bytes)
  return size ? { logo: { data: bytes, ...size }, failed: false } : { logo: null, failed: true }
}
