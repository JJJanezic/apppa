'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { saveCompanions } from '@/app/(app)/buchungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { type Booking, LIMITS, personCount } from '@/lib/bookings'
import { type CompanionsInput, companionsSchema } from '@/lib/validation/bookings'

interface CompanionsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: Booking
  today: string
}

// Detail-Panel „Mitreisende bearbeiten“ (PROJ-8): je Person Vor-, Nachname und Geburtsdatum,
// höchstens Personen minus Hauptgast; jederzeit nachtragbar (z. B. beim Check-in)
export function CompanionsPanel({ open, onOpenChange, booking, today }: CompanionsPanelProps) {
  const t = useTranslations('bookings.companions')
  const tv = useTranslations('bookings.validation')
  const td = useTranslations('bookings.done')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const max = Math.max(0, personCount(booking.adults, booking.childAges) - 1)
  const form = useForm<CompanionsInput>({
    resolver: zodResolver(companionsSchema(tv, { max, today }), undefined, { raw: true }),
    defaultValues: {
      companions: booking.companions.map((c) => ({ firstName: c.firstName, lastName: c.lastName, birthDate: c.birthDate ?? '' })),
    },
  })
  const rows = useFieldArray({ control: form.control, name: 'companions' })

  async function save(values: CompanionsInput) {
    setError(null)
    const result = await callAction(() => saveCompanions({ id: booking.id, updatedAt: booking.updatedAt, max, values }))
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(td('companionsSaved'))
    onOpenChange(false)
    router.refresh()
  }

  const submitting = form.formState.isSubmitting

  return (
    <DetailPanel open={open} onOpenChange={onOpenChange} title={t('title')} description={max > 0 ? t('description', { max }) : undefined}>
      {max === 0 ? (
        <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('none')}</p>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(save)} noValidate className="flex flex-col gap-6">
            <FormError error={error} namespace="bookings.errors" />
            {rows.fields.map((row, i) => (
              <fieldset key={row.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-semibold">
                  {t('person', { n: i + 1 })}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['firstName', 'lastName'] as const).map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={`companions.${i}.${name}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t(name)}</FormLabel>
                          <FormControl>
                            <Input maxLength={LIMITS.nameMax} autoComplete="off" className="min-h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormField
                  control={form.control}
                  name={`companions.${i}.birthDate`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('birthDate')}</FormLabel>
                      <FormControl>
                        <Input type="date" max={today} className="min-h-11 w-48" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="ghost" className="min-h-11 self-start text-ds-accent-2-700" onClick={() => rows.remove(i)}>
                  <Trash size={16} aria-hidden="true" />
                  {t('remove', { n: i + 1 })}
                </Button>
              </fieldset>
            ))}
            {rows.fields.length < max && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 self-start"
                onClick={() => rows.append({ firstName: '', lastName: booking.guest?.lastName ?? '', birthDate: '' }, { shouldFocus: true })}
              >
                <Plus size={16} aria-hidden="true" />
                {t('add')}
              </Button>
            )}
            <Button type="submit" disabled={submitting} aria-busy={submitting} className="min-h-11">
              {t('save')}
            </Button>
          </form>
        </Form>
      )}
    </DetailPanel>
  )
}
