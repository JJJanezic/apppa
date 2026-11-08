'use client'

import { useTranslations } from 'next-intl'

import { RichTextView } from '@/components/invoice-settings/rich-text-view'
import { SignatureField, type SignatureValue } from '@/components/guest-sheets/signing/signature-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { RichDoc } from '@/lib/rich-text'

interface SheetPageTwoProps {
  texts: { privacy: RichDoc; marketing: RichDoc }
  consent: boolean
  onConsent: (value: boolean) => void
  signature: SignatureValue
  onSignature: (value: SignatureValue) => void
}

// Seite 2 „Datenschutz“ des Gästeblatts (PROJ-26): Teil A als Information ohne Kästchen, Teil B mit freiwilliger
// Einwilligung (Kästchen nie vorausgewählt), darunter Unterschrift 2. Unterschreiben geht auch ohne Häkchen.
export function SheetPageTwo({ texts, consent, onConsent, signature, onSignature }: SheetPageTwoProps) {
  const t = useTranslations('guestSheets.signing')
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
      </section>
      <SignatureField id="unterschrift-2" label={t('signature2')} value={signature} onChange={onSignature} />
    </div>
  )
}
