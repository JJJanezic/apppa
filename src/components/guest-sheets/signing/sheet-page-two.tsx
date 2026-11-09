'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { RichTextView } from '@/components/invoice-settings/rich-text-view'
import { SignatureField, type SignatureValue } from '@/components/guest-sheets/signing/signature-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIMITS } from '@/lib/guests'
import type { RichDoc } from '@/lib/rich-text'
import { sheetEmailSchema } from '@/lib/validation/guest-sheet'

interface SheetPageTwoProps {
  texts: { privacy: RichDoc; marketing: RichDoc }
  consent: boolean
  onConsent: (value: boolean) => void
  signature: SignatureValue
  onSignature: (value: SignatureValue) => void
  // Feld „E-Mail-Adresse“, wenn der Gast noch keine hat; save liefert null oder einen Fehlercode
  email: { save: (email: string) => Promise<string | null> } | null
}

// Seite 2 „Datenschutz“ des Gästeblatts (PROJ-26): Teil A als Information ohne Kästchen, Teil B mit freiwilliger
// Einwilligung (Kästchen nie vorausgewählt), darunter Unterschrift 2. Unterschreiben geht auch ohne Häkchen.
// Hat der Gast noch keine E-Mail, kann er sie hier freiwillig angeben; sie wird beim Verlassen des Felds am Gast gespeichert.
export function SheetPageTwo({ texts, consent, onConsent, signature, onSignature, email }: SheetPageTwoProps) {
  const t = useTranslations('guestSheets.signing')
  const te = useTranslations('guestSheets.errors')
  const tv = useTranslations('guestSheets.validation')
  const schema = useMemo(() => sheetEmailSchema(tv), [tv])
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function commit() {
    if (!email || value.trim() === saved) return
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? tv('emailInvalid'))
      return
    }
    setError(null)
    setState('saving')
    const failed = await email.save(value.trim())
    if (failed) {
      setError(te(failed as never))
      setState('idle')
      return
    }
    setSaved(value.trim())
    setState('saved')
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="blatt-teil-a" className="flex flex-col gap-3 rounded-lg border bg-ds-surface p-4">
        <h2 id="blatt-teil-a" className="text-xl">
          {t('privacyTitle')}
        </h2>
        <RichTextView doc={texts.privacy} className="flex flex-col gap-2 text-[15px] leading-relaxed" />
      </section>
      <section aria-labelledby="blatt-teil-b" className="flex flex-col gap-3 rounded-lg border bg-ds-surface p-4">
        <h2 id="blatt-teil-b" className="text-xl">
          {t('marketingTitle')}
        </h2>
        <RichTextView doc={texts.marketing} className="flex flex-col gap-2 text-[15px] leading-relaxed" />
        <div className="flex items-start gap-3 rounded-md bg-white p-3">
          <Checkbox id="blatt-einwilligung" className="mt-0.5 size-6" checked={consent} onCheckedChange={(v) => onConsent(v === true)} />
          <Label htmlFor="blatt-einwilligung" className="min-h-6 cursor-pointer text-base font-semibold leading-snug">
            {t('consent')}
          </Label>
        </div>
        <p className="text-sm text-ds-neutral-800">{t('consentOptional')}</p>
        {email && (
          <div className="flex max-w-xl flex-col gap-2">
            <Label htmlFor="blatt-email">{t('email')}</Label>
            <Input
              id="blatt-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={LIMITS.emailMax}
              value={value}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby="blatt-email-hinweis"
              className="min-h-11 bg-white"
              onChange={(e) => {
                setValue(e.target.value)
                setState('idle')
              }}
              onBlur={() => void commit()}
            />
            <p id="blatt-email-hinweis" className="text-sm text-ds-neutral-800" aria-live="polite">
              {error ? <span className="font-semibold text-red-700">{error}</span> : state === 'saving' ? t('save.saving') : state === 'saved' ? t('emailSaved') : t('emailHint')}
            </p>
          </div>
        )}
      </section>
      <SignatureField id="unterschrift-2" label={t('signature2')} value={signature} onChange={onSignature} />
    </div>
  )
}
