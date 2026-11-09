'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { saveSheetNumberRange } from '@/app/(app)/einstellungen/gaesteblatt/numbering-actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { type NumberRange, SHEET_CODE_MAX, type SheetNumberRange } from '@/lib/guest-sheet-numbering'
import { sheetRangeSchema, type SheetRangeInput } from '@/lib/validation/guest-sheet'

interface RangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  municipality: { code: string; name: string }
  // null: neuer Bereich (wird hinten angereiht)
  range: SheetNumberRange | null
  // übrige Bereiche derselben Gemeinde (Überschneidung schon im Browser)
  others: NumberRange[]
  // Neuer Bereich wird sofort verwendet (kein offener Bereich): dann mit „Nächste Nummer“
  becomesActive: boolean
}

// Nummernbereich anlegen oder ändern (PROJ-26, Erweiterung 2026-11-09). Beim Bereich in Verwendung sind nur „bis“ und
// „Nächste Nummer“ änderbar, bei folgenden Bereichen „von“ und „bis“. Die Seite setzt key auf Bereich + Stand.
export function RangeDialog({ open, onOpenChange, tenantId, municipality, range, others, becomesActive }: RangeDialogProps) {
  const t = useTranslations('guestSheets.numbering')
  const tv = useTranslations('guestSheets.validation')
  const router = useRouter()
  const active = range ? range.state === 'active' : becomesActive
  const schema = useMemo(
    () => sheetRangeSchema(tv, others, range?.state === 'active' ? range.lastIssued : null, active),
    [tv, others, range, active]
  )
  const form = useForm<SheetRangeInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: { from: range?.from ?? '', to: range?.to ?? '', next: range?.state === 'active' ? (range.next ?? '') : '' },
  })
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  async function save(values: SheetRangeInput) {
    setError(null)
    const result = await callAction(() =>
      saveSheetNumberRange({
        tenantId,
        municipalityCode: municipality.code,
        id: range?.id ?? null,
        updatedAt: range?.updatedAt ?? null,
        range: { ...values, next: active ? values.next : '' },
      })
    )
    if (!result.ok) {
      if (result.error === 'staleRange') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('rangeSaved'))
    onOpenChange(false)
    router.refresh()
  }

  const submitting = form.formState.isSubmitting
  const text = (name: 'from' | 'to' | 'next', label: string, options: { disabled?: boolean; hint?: string } = {}) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input autoComplete="off" maxLength={SHEET_CODE_MAX} disabled={options.disabled} className="min-h-11" {...field} />
          </FormControl>
          {options.hint && <FormDescription>{options.hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{range ? t('editTitle', { municipality: municipality.name }) : t('addTitle', { municipality: municipality.name })}</DialogTitle>
          <DialogDescription>{active ? t('dialogActive') : t('dialogQueued')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(save)} noValidate className="flex flex-col gap-4">
            <FormError error={error} namespace="guestSheets.errors" />
            {stale && <StaleAlert onReload={() => onOpenChange(false)} />}
            <div className="grid gap-4 sm:grid-cols-2">
              {text('from', t('from'), { disabled: range?.state === 'active' })}
              {text('to', t('to'))}
            </div>
            {active && text('next', t('next'), { hint: range ? t('nextHint') : t('nextHintNew') })}
            <p className="text-[13px] text-ds-neutral-800">{t('formatHint')}</p>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting} aria-busy={submitting} className="min-h-11">
                {submitting ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
