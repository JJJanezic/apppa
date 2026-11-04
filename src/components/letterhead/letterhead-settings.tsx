'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Info, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { saveLetterhead } from '@/app/(app)/einstellungen/briefpapier/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useUnsavedGuard } from '@/components/invoice-drafts/use-unsaved-guard'
import { PdfPreview } from '@/components/invoice-pdf/pdf-preview'
import { usePdfPreview } from '@/components/invoice-pdf/use-pdf-preview'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatNumber } from '@/lib/format'
import { DEFAULT_LETTERHEAD, LETTERHEAD_FONT_SIZE, LETTERHEAD_LOGO_HEIGHT, LETTERHEAD_SPACINGS, LOGO_POSITIONS, type LetterheadValues } from '@/lib/letterhead'
import type { LetterheadData } from '@/lib/letterhead-data'
import { RICH_FONTS } from '@/lib/rich-text'
import { letterheadSchema, type LetterheadInput } from '@/lib/validation/letterhead'

const PREVIEW_URL = '/api/briefpapier/vorschau'
const PREVIEW_DELAY_MS = 1000
// Ab diesem Anteil an der Seite weist das Formular auf die lange Fußzeile hin
const LONG_FOOTER_SHARE = 1 / 3

const toInput = (v: LetterheadValues): LetterheadInput => ({
  ...v,
  fontSize: formatNumber(v.fontSize, { maximumFractionDigits: 1 }),
  logoHeightMm: String(v.logoHeightMm),
})

// Einstellungen und Vorschau des Briefpapiers (PROJ-41), gleich für Inhaber und Betreiber. Die Vorschau zeigt auch den
// ungespeicherten Stand; offene Entwürfe ändern sich erst mit „Speichern“.
export function LetterheadSettings({
  data,
  readOnly = false,
  stammdatenHref,
  footerHref,
}: {
  data: LetterheadData
  readOnly?: boolean
  // nur für Inhaber: auf der Kunden-Detailseite des Betreibers stehen Stammdaten und Fußzeile auf derselben Seite
  stammdatenHref?: string
  footerHref?: string
}) {
  const t = useTranslations('letterhead')
  const te = useTranslations('invoiceSettings.editor')
  const tv = useTranslations('letterhead.validation')
  const router = useRouter()
  const schema = useMemo(() => letterheadSchema(tv), [tv])
  const form = useForm<LetterheadInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    mode: 'onChange',
    defaultValues: toInput(data.values),
  })
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const guard = useUnsavedGuard(form.formState.isDirty && !readOnly)
  const live = useWatch({ control: form.control }) as LetterheadInput
  const headingId = useId()

  // Nur gültige Werte gehen an die Vorschau; sonst bleibt die letzte gültige stehen und das Feld zeigt den Fehler
  const valid = schema.safeParse(live).success
  const body = valid ? JSON.stringify({ tenantId: data.tenantId, values: live }) : null
  const preview = usePdfPreview(PREVIEW_URL, body, PREVIEW_DELAY_MS)
  const meta = preview.meta
  const showIssuer = live.showIssuer

  async function onSubmit(values: LetterheadInput) {
    setError(null)
    const result = await callAction(() => saveLetterhead({ tenantId: data.tenantId, updatedAt: data.updatedAt, letterhead: values }))
    if (!result.ok) {
      if (result.error === 'staleSettings') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('saved'))
    form.reset(values)
    router.refresh()
  }

  const SPACING = (name: 'lineSpacing' | 'paragraphSpacing', label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
            <FormControl>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {LETTERHEAD_SPACINGS.map((s) => (
                <SelectItem key={s} value={s} className="min-h-11">
                  {t(`spacing.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-6">
      <div className="flex max-w-[720px] flex-col gap-1">
        <h2 id={headingId} className="text-2xl">
          {t('title')}
        </h2>
        <p className="text-ds-neutral-800">{t('lead')}</p>
        {readOnly && <p className="text-ds-neutral-800">{t('readOnlyHint')}</p>}
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-w-0 flex-col gap-6">
            <FormError error={error} namespace="invoiceSettings.errors" />
            {stale && <StaleAlert />}

            <fieldset className="flex flex-col gap-4">
              <legend className="mb-3 font-semibold">{t('groupFont')}</legend>
              <FormField
                control={form.control}
                name="fontFamily"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fontFamily')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger className="min-h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RICH_FONTS.map((f) => (
                          <SelectItem key={f} value={f} className="min-h-11">
                            {te(`fonts.${f}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fontSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fontSize')}</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" disabled={readOnly} className="min-h-11" />
                    </FormControl>
                    <FormDescription>{t('fontSizeHint', { min: LETTERHEAD_FONT_SIZE.min, max: LETTERHEAD_FONT_SIZE.max })}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="mb-3 font-semibold">{t('groupSpacing')}</legend>
              {SPACING('lineSpacing', t('lineSpacing'))}
              {SPACING('paragraphSpacing', t('paragraphSpacing'))}
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="mb-3 font-semibold">{t('groupLogo')}</legend>
              {!data.hasLogo && (
                <Hint>
                  {t('noLogo')}{' '}
                  {stammdatenHref && (
                    <Link href={stammdatenHref} className="text-ds-accent-700 underline">
                      {t('noLogoLink')}
                    </Link>
                  )}
                </Hint>
              )}
              <FormField
                control={form.control}
                name="logoPosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('logoPosition')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly || !data.hasLogo}>
                      <FormControl>
                        <SelectTrigger className="min-h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOGO_POSITIONS.map((p) => (
                          <SelectItem key={p} value={p} className="min-h-11">
                            {t(`position.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logoHeightMm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('logoHeight')}</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" disabled={readOnly || !data.hasLogo} className="min-h-11" />
                    </FormControl>
                    <FormDescription>{t('logoHeightHint', { min: LETTERHEAD_LOGO_HEIGHT.min, max: LETTERHEAD_LOGO_HEIGHT.max })}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {meta?.logoFailed && <Hint warn>{t('logoFailed')}</Hint>}
              {meta?.logoReduced && <Hint>{t('logoReduced')}</Hint>}
              {meta?.logoBlurry && <Hint>{t('logoBlurry')}</Hint>}
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="mb-3 font-semibold">{t('groupIssuer')}</legend>
              <FormField
                control={form.control}
                name="showIssuer"
                render={({ field }) => (
                  <FormItem className="flex min-h-11 items-center justify-between gap-4 space-y-0">
                    <FormLabel>{t('showIssuer')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {!showIssuer && (
                <Hint warn>
                  {t('issuerOff')} {data.footerEmpty && t('issuerOffEmpty')}{' '}
                  {footerHref && (
                    <Link href={footerHref} className="text-ds-accent-700 underline">
                      {t('issuerOffLink')}
                    </Link>
                  )}
                </Hint>
              )}
            </fieldset>

            {meta && meta.footerShare > LONG_FOOTER_SHARE && <Hint>{t('footerLong')}</Hint>}

            {!readOnly && (
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11">
                  {t('save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => form.reset(toInput(DEFAULT_LETTERHEAD), { keepDefaultValues: true })}
                >
                  {t('reset')}
                </Button>
              </div>
            )}
          </form>
        </Form>

        <PdfPreview state={preview} label={t('preview.label')} />
      </div>

      {guard.pendingHref && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) guard.cancelLeave()
          }}
          title={t('leave.title')}
          text={t('leave.text')}
          confirmLabel={t('leave.confirm')}
          cancelLabel={t('leave.stay')}
          onConfirm={() => guard.leave(guard.pendingHref ?? '/')}
        />
      )}
    </section>
  )
}

function Hint({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <Alert className={warn ? 'border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800' : 'border-ds-neutral-400 bg-ds-surface'}>
      {warn ? <WarningCircle size={18} weight="duotone" aria-hidden="true" /> : <Info size={18} weight="duotone" aria-hidden="true" />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
