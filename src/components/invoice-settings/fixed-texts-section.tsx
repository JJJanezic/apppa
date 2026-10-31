'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { saveInvoiceFixedTexts } from '@/app/(app)/einstellungen/rechnungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { RichTextField } from '@/components/invoice-settings/rich-text-field'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import type { InvoiceSettingsData } from '@/lib/invoice-settings'
import { INVOICE_TEXT_LIMITS as L } from '@/lib/invoice-texts'
import { emptyDoc } from '@/lib/rich-text'
import { fixedTextsSchema, type FixedTextsInput } from '@/lib/validation/invoice-settings'

// Kleinunternehmer-Hinweis (Pflicht, bis 500 Zeichen) und Fußzeile (optional, bis 2.000 Zeichen), beide ohne Platzhalter
export function FixedTextsSection({ tenantId, data, readOnly }: { tenantId: string; data: InvoiceSettingsData; readOnly: boolean }) {
  const t = useTranslations('invoiceSettings.fixedTexts')
  const tv = useTranslations('invoiceSettings.validation')
  const router = useRouter()
  const schema = useMemo(() => fixedTextsSchema(tv), [tv])
  const saved = data.fixedTexts
  const form = useForm<FixedTextsInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: { smallBusinessNote: saved.smallBusinessNote, footer: saved.footer ?? emptyDoc() },
  })
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  async function onSubmit(v: FixedTextsInput) {
    setError(null)
    const result = await callAction(() => saveInvoiceFixedTexts({ tenantId, updatedAt: saved.updatedAt, texts: v }))
    if (!result.ok) {
      if (result.error === 'staleSettings') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('saved'))
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FormError error={error} namespace="invoiceSettings.errors" />
        {stale && <StaleAlert />}
        <RichTextField
          control={form.control}
          name="smallBusinessNote"
          label={t('smallBusinessNote')}
          hint={t('smallBusinessNoteHint')}
          context="fixed"
          max={L.smallBusinessNoteMax}
          readOnly={readOnly}
        />
        <RichTextField
          control={form.control}
          name="footer"
          label={t('footer')}
          hint={t('footerHint')}
          context="fixed"
          max={L.footerMax}
          readOnly={readOnly}
        />
        {!readOnly && (
          <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 self-start">
            {t('save')}
          </Button>
        )}
      </form>
    </Form>
  )
}
