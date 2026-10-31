'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useId } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'

import { RichTextView } from '@/components/invoice-settings/rich-text-view'
import { FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import type { PlaceholderContext, PlaceholderValues } from '@/lib/invoice-texts'
import { isDocEmpty, type RichDoc } from '@/lib/rich-text'

// Editor erst bei Bedarf laden: nur die Rechnungs-Einstellungen brauchen ihn (Tech Design PROJ-39)
const RichTextEditor = dynamic(() => import('@/components/invoice-settings/rich-text-editor').then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-full" />,
})

interface RichTextFieldProps<V extends FieldValues> {
  control: Control<V>
  name: FieldPath<V>
  label: string
  hint?: string
  context: PlaceholderContext
  max: number
  readOnly?: boolean
  // Vorschau unter dem Editor; values: Beispielwerte für die Platzhalter
  preview?: { values?: PlaceholderValues }
}

export function RichTextField<V extends FieldValues>({ control, name, label, hint, context, max, readOnly, preview }: RichTextFieldProps<V>) {
  const t = useTranslations('invoiceSettings.editor')
  const id = useId()
  const labelId = `${id}-label`
  const hintId = `${id}-hint`
  const messageId = `${id}-message`

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const doc = field.value as RichDoc
        return (
          <FormItem className="min-w-0">
            {/* Kein <label>: die Schreibfläche ist kein Formularfeld; sie verweist mit aria-labelledby hierher */}
            <span id={labelId} className="text-sm font-medium leading-none">
              {label}
            </span>
            {hint && (
              <p id={hintId} className="text-sm text-muted-foreground">
                {hint}
              </p>
            )}
            <RichTextEditor
              value={doc}
              onChange={field.onChange}
              context={context}
              max={max}
              labelId={labelId}
              describedBy={[hint ? hintId : null, fieldState.error ? messageId : null].filter(Boolean).join(' ') || undefined}
              invalid={Boolean(fieldState.error)}
              readOnly={readOnly}
            />
            <FormMessage id={messageId} />
            {preview && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-ds-neutral-700">{t('preview')}</span>
                <div className="rounded-md border border-dashed bg-ds-bg px-3 py-2 text-[15px]">
                  {isDocEmpty(doc) ? (
                    <p className="text-ds-neutral-700">{t('previewEmpty')}</p>
                  ) : (
                    <RichTextView doc={doc} values={preview.values} />
                  )}
                </div>
              </div>
            )}
          </FormItem>
        )
      }}
    />
  )
}
