'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { saveEstablishmentNumbers } from '@/app/(app)/einstellungen/gaesteblatt/numbering-actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SHEET_CODE_MAX } from '@/lib/guest-sheet-numbering'
import type { EstablishmentNumber } from '@/lib/guest-sheet-numbering-data'
import { establishmentNumbersSchema, type EstablishmentNumbersInput } from '@/lib/validation/guest-sheet'

interface EstablishmentNumbersFormProps {
  tenantId: string
  items: EstablishmentNumber[]
  ready: boolean
  readOnly?: boolean
  level: 2 | 3
}

// Abschnitt „Kennzahlen je Gemeinde“ in den Stammdaten (PROJ-26, Erweiterung 2026-11-09): je Gemeinde, in der der Kunde
// Objekte hat, die von der Gemeinde vergebene Kennzahl des Betriebs. Optional; sie steht auf dem Gästeblatt im Kopf.
// Eigenes Speichern, unabhängig vom Stammdaten-Formular.
export function EstablishmentNumbersForm({ tenantId, items, ready, readOnly = false, level }: EstablishmentNumbersFormProps) {
  const t = useTranslations('guestSheets.establishment')
  const tv = useTranslations('guestSheets.validation')
  const router = useRouter()
  const schema = useMemo(() => establishmentNumbersSchema(tv), [tv])
  const form = useForm<EstablishmentNumbersInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: { items: items.map((i) => ({ code: i.code, number: i.number ?? '' })) },
  })
  const { fields } = useFieldArray({ control: form.control, name: 'items' })
  const values = useWatch({ control: form.control, name: 'items' })
  const [error, setError] = useState<string | null>(null)
  const Heading = level === 2 ? 'h2' : 'h3'

  async function onSubmit(v: EstablishmentNumbersInput) {
    setError(null)
    const result = await callAction(() => saveEstablishmentNumbers({ tenantId, data: v }))
    if (!result.ok) return setError(result.error)
    toast.success(t('saved'))
    form.reset(v)
    router.refresh()
  }

  return (
    <section aria-labelledby="kennzahlen" className="flex min-w-0 max-w-[720px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading id="kennzahlen" className={level === 2 ? 'text-2xl' : 'text-xl'}>
          {t('title')}
        </Heading>
        <p className="text-ds-neutral-800">{t('lead')}</p>
      </div>
      {!ready ? (
        <Alert>
          <AlertDescription>{t('notReady')}</AlertDescription>
        </Alert>
      ) : fields.length === 0 ? (
        <p className="text-ds-neutral-800">{t('empty')}</p>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormError error={error} namespace="guestSheets.errors" />
            {fields.map((f, index) => (
              <FormField
                key={f.id}
                control={form.control}
                name={`items.${index}.number`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('label', { municipality: items[index].name, code: items[index].code })}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" maxLength={SHEET_CODE_MAX} disabled={readOnly} className="min-h-11 w-56" {...field} value={field.value ?? ''} />
                    </FormControl>
                    {!values?.[index]?.number?.trim() && <FormDescription>{t('missing')}</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            {!readOnly && (
              <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty} className="min-h-11 self-start">
                {t('save')}
              </Button>
            )}
          </form>
        </Form>
      )}
    </section>
  )
}
