'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { saveGuestSheetTexts } from '@/app/(app)/einstellungen/gaesteblatt/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { RichTextField } from '@/components/invoice-settings/rich-text-field'
import { RichTextGuardProvider, useRichTextGuard } from '@/components/invoice-settings/rich-text-guard'
import { SettingsSection, StaleAlert } from '@/components/invoice-settings/section-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import {
  defaultMarketingDoc,
  defaultPrivacyDoc,
  effectiveTexts,
  emptyPlaceholders,
  GUEST_SHEET_TEXT_MAX,
  type GuestSheetPlaceholder,
  type GuestSheetTexts,
} from '@/lib/guest-sheet'
import { docPlainText } from '@/lib/rich-text'
import { guestSheetTextsSchema, type GuestSheetTextsInput } from '@/lib/validation/guest-sheet'

interface GuestSheetTextsFormProps {
  tenantId: string
  texts: GuestSheetTexts
  // Werte der Platzhalter aus den Stammdaten (Vorschau)
  values: Record<GuestSheetPlaceholder, string>
}

type Field = 'privacy' | 'marketing'

// Einstellungen → Gästeblatt (PROJ-26): Teil A „Information zur Verarbeitung“ und Teil B „Marketing-Einwilligung“ mit Editor,
// Platzhaltern und Vorschau. Gespeichert werden beide Texte zusammen; neue Fassungen gelten nur für neue Gästeblätter.
export function GuestSheetTextsForm({ tenantId, texts, values }: GuestSheetTextsFormProps) {
  const t = useTranslations('guestSheets.settings')
  const tv = useTranslations('guestSheets.validation')
  const router = useRouter()
  const schema = useMemo(() => guestSheetTextsSchema(tv), [tv])
  const form = useForm<GuestSheetTextsInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: effectiveTexts(texts),
  })
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [reset, setReset] = useState<Field | null>(null)
  // Der Editor übernimmt Werte von außen nicht: Nach „Auf Standard zurücksetzen“ wird er neu aufgebaut (BUG-2 aus QA)
  const [editorKeys, setEditorKeys] = useState<Record<Field, number>>({ privacy: 0, marketing: 0 })
  const guard = useRichTextGuard()
  const [privacy, marketing] = useWatch({ control: form.control, name: ['privacy', 'marketing'] })
  const missing = emptyPlaceholders([docPlainText(privacy), docPlainText(marketing)], values)
  // Vorschau wie auf dem Blatt: leere Angaben als „–“
  const preview = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v || '–']))

  async function onSubmit(v: GuestSheetTextsInput) {
    setError(null)
    const result = await callAction(() => saveGuestSheetTexts({ tenantId, updatedAt: texts.updatedAt, privacy: v.privacy, marketing: v.marketing }))
    if (!result.ok) {
      if (result.error === 'staleSettings') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('saved'))
    router.refresh()
  }

  const field = (name: Field) => (
    <div className="flex flex-col gap-3">
      <RichTextField
        key={editorKeys[name]}
        control={form.control}
        name={name}
        label={t(`${name}.label`)}
        hint={t(`${name}.hint`, { max: GUEST_SHEET_TEXT_MAX.toLocaleString('de-DE') })}
        context="guestSheet"
        max={GUEST_SHEET_TEXT_MAX}
        preview={{ values: preview }}
      />
      <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setReset(name)}>
        {t('reset')}
      </Button>
    </div>
  )

  return (
    <Form {...form}>
      <RichTextGuardProvider value={guard.checks}>
        <form onSubmit={guard.guardSubmit(form.handleSubmit(onSubmit))} noValidate className="flex min-w-0 flex-col gap-10">
          <FormError error={error} namespace="guestSheets.errors" />
          {stale && <StaleAlert />}
          <SettingsSection level={2} title={t('privacy.title')} lead={t('privacy.lead')}>
            {field('privacy')}
          </SettingsSection>
          <SettingsSection level={2} title={t('marketing.title')} lead={t('marketing.lead')}>
            {field('marketing')}
          </SettingsSection>
          {missing.length > 0 && (
            <Alert className="max-w-[720px] border-ds-accent-700/40 bg-ds-accent-100">
              <AlertDescription className="flex flex-col gap-1">
                {missing.map((p) => (
                  <span key={p}>{t('emptyPlaceholder', { token: `{${p}}` })}</span>
                ))}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex max-w-[720px] flex-col gap-2">
            <p className="text-sm text-ds-neutral-800">{t('onlyNew')}</p>
            <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 self-start">
              {t('save')}
            </Button>
          </div>
        </form>
      </RichTextGuardProvider>
      <ConfirmDialog
        open={reset !== null}
        onOpenChange={(open) => !open && setReset(null)}
        title={t('resetTitle')}
        text={t('resetText')}
        confirmLabel={t('resetConfirm')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          if (reset) {
            form.setValue(reset, reset === 'privacy' ? defaultPrivacyDoc() : defaultMarketingDoc(), { shouldDirty: true, shouldValidate: true })
            setEditorKeys((k) => ({ ...k, [reset]: k[reset] + 1 }))
          }
          setReset(null)
        }}
      />
    </Form>
  )
}
