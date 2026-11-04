import { getTranslations } from 'next-intl/server'

import { todayIso } from '@/lib/bookings'
import { pdfResponse } from '@/lib/invoice-pdf/respond'
import { buildSampleModel } from '@/lib/invoice-pdf/sample'
import { loadInvoiceSettings } from '@/lib/invoice-settings-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { tenantSettingsAccess } from '@/lib/tenant-settings-guard'
import { letterheadSchema } from '@/lib/validation/letterhead'
import { vatStatusFromRows } from '@/lib/vat-status'

const key = (k: string) => k

// Musterrechnung zum Reiter „Briefpapier“ (PROJ-41), auch mit noch nicht gespeicherten Werten. Für Inhaber und Betreiber;
// Stammdaten, Texte und Logo lädt der Server selbst, aus dem Browser kommen nur die Briefpapier-Werte.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tenantId?: unknown; values?: unknown } | null
  const access = await tenantSettingsAccess(body?.tenantId)
  if (!access) return new Response(null, { status: 403 })
  const parsed = letterheadSchema(key).safeParse(body?.values)
  if (!parsed.success) return new Response(null, { status: 400 })

  const settings = await loadInvoiceSettings(access.tenantId)
  if (!settings) return new Response(null, { status: 500 })
  // Zugriff oben geprüft; der Betreiber liest Aussteller und Status ebenso wie der Inhaber
  const admin = createAdminClient()
  const [tenant, vat] = await Promise.all([
    admin.from('tenants').select('name, name_line2, address_line1, address_line2, postal_code, city, country, vat_id').eq('id', access.tenantId).maybeSingle(),
    admin.from('vat_status_changes').select('valid_from, small_business').eq('tenant_id', access.tenantId),
  ])
  const i = tenant.data
  const t = await getTranslations('letterhead')
  const { model, number } = buildSampleModel({
    settings,
    issuer: i
      ? {
          name: i.name,
          nameLine2: i.name_line2,
          addressLine1: i.address_line1,
          addressLine2: i.address_line2,
          postalCode: i.postal_code,
          city: i.city,
          country: i.country,
          vatId: i.vat_id,
        }
      : null,
    vatStatus: vatStatusFromRows(vat.data ?? []),
    today: todayIso(),
    labels: {
      apartment: t('sample.apartment'),
      guestFirst: t('sample.guestFirst'),
      guestLast: t('sample.guestLast'),
      street: t('sample.street'),
      postalCode: t('sample.postalCode'),
      city: t('sample.city'),
      nights: t('sample.nights'),
      cleaning: t('sample.cleaning'),
      textIntro: t('sample.textIntro'),
      textPayment: t('sample.textPayment'),
      textClosing: t('sample.textClosing'),
    },
  })
  return pdfResponse({ tenantId: access.tenantId, model, letterhead: parsed.data, number, mark: t('pdf.sampleMark') })
}
