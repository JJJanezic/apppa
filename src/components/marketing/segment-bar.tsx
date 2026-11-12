'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { FloppyDisk, PencilSimple, Trash } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { createSegment, deleteSegment, renameSegment, updateSegmentFilters } from '@/app/(app)/marketing/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { filtersOf, marketingHref, type MarketingFilters, type MarketingView, SEGMENT_NAME_MAX, sameFilters, type Segment } from '@/lib/marketing'
import { type SegmentNameInput, segmentNameSchema } from '@/lib/validation/marketing'

const NONE = '__ohne'

interface SegmentBarProps {
  view: MarketingView
  // null: Segmente noch nicht verfügbar (bis /backend)
  segments: Segment[] | null
}

// Segmente der Seite „Marketing“ (PROJ-52): öffnen (lädt die gespeicherten Filter in die Adresse), als neues Segment speichern,
// aktualisieren (nur bei geänderten Filtern, mit Rückfrage), umbenennen und löschen (mit Rückfrage). Segmente speichern nur
// Filter; die Liste wird beim Öffnen neu berechnet.
export function SegmentBar({ view, segments }: SegmentBarProps) {
  const t = useTranslations('marketing.segments')
  const tErr = useTranslations('marketing.errors')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<'save' | 'rename' | 'update' | 'delete' | null>(null)
  const filters = filtersOf(view)
  const current = segments?.find((s) => s.id === view.segment) ?? null
  const changed = Boolean(current && !sameFilters(filters, current.filters))
  const list = segments ?? []

  const open = (id: string) => {
    const segment = list.find((s) => s.id === id)
    startTransition(() => router.push(segment ? marketingHref({ ...segment.filters, segment: segment.id }) : marketingHref(filters), { scroll: false }))
  }

  async function confirmUpdate() {
    if (!current) return
    const result = await callAction(() => updateSegmentFilters({ id: current.id, filters, updatedAt: current.updatedAt }))
    setDialog(null)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(tErr(result.error))
      return
    }
    toast.success(t('updated'))
    router.refresh()
  }

  async function confirmDelete() {
    if (!current) return
    const result = await callAction(() => deleteSegment({ id: current.id, filters }))
    setDialog(null)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(tErr(result.error))
      return
    }
    toast.success(t('deleted'))
  }

  return (
    <section aria-label={t('label')} aria-busy={pending} className="flex flex-col gap-3 rounded-lg bg-ds-surface px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-72">
        <Label htmlFor="marketing-segment" className="text-[13px] text-ds-neutral-800">
          {t('open')}
        </Label>
        <Select value={current?.id ?? NONE} onValueChange={(v) => open(v === NONE ? '' : v)} disabled={segments === null}>
          <SelectTrigger id="marketing-segment" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} className="min-h-11">
              {list.length === 0 ? t('empty') : t('none')}
            </SelectItem>
            {list.map((s) => (
              <SelectItem key={s.id} value={s.id} className="min-h-11">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {changed && (
        <Badge variant="secondary" className="w-fit font-normal sm:mb-3">
          {t('changed')}
        </Badge>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={segments === null} onClick={() => setDialog('save')}>
          <FloppyDisk size={18} aria-hidden="true" />
          {t('save')}
        </Button>
        {current && changed && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('update')}>
            {t('update')}
          </Button>
        )}
        {current && (
          <>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setDialog('rename')}>
              <PencilSimple size={18} aria-hidden="true" />
              {t('rename')}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 text-ds-accent-2-700" onClick={() => setDialog('delete')}>
              <Trash size={18} aria-hidden="true" />
              {t('delete')}
            </Button>
          </>
        )}
      </div>

      {dialog === 'save' && <NameDialog mode="save" filters={filters} onClose={() => setDialog(null)} />}
      {dialog === 'rename' && current && <NameDialog mode="rename" segment={current} filters={filters} onClose={() => setDialog(null)} />}
      {current && (
        <>
          <ConfirmDialog
            open={dialog === 'update'}
            onOpenChange={(o) => !o && setDialog(null)}
            title={t('updateTitle')}
            text={t('updateText', { name: current.name })}
            confirmLabel={t('confirmUpdate')}
            cancelLabel={t('cancel')}
            onConfirm={() => void confirmUpdate()}
          />
          <ConfirmDialog
            open={dialog === 'delete'}
            onOpenChange={(o) => !o && setDialog(null)}
            title={t('deleteTitle')}
            text={t('deleteText', { name: current.name })}
            confirmLabel={t('confirmDelete')}
            cancelLabel={t('cancel')}
            onConfirm={() => void confirmDelete()}
          />
        </>
      )}
    </section>
  )
}

// Name eingeben: neues Segment mit den aktuellen Filtern bzw. Umbenennen
function NameDialog({ mode, segment, filters, onClose }: { mode: 'save' | 'rename'; segment?: Segment; filters: MarketingFilters; onClose: () => void }) {
  const t = useTranslations('marketing.segments')
  const tv = useTranslations('marketing.segments.validation')
  const tErr = useTranslations('marketing.errors')
  const router = useRouter()
  const schema = useMemo(() => segmentNameSchema(tv), [tv])
  const form = useForm<SegmentNameInput>({ resolver: zodResolver(schema, undefined, { raw: true }), defaultValues: { name: segment?.name ?? '' } })
  const [error, setError] = useState<string | null>(null)
  const name = useWatch({ control: form.control, name: 'name' }) ?? ''

  async function submit(v: SegmentNameInput) {
    setError(null)
    const result = await callAction(() =>
      mode === 'save' ? createSegment({ name: v.name, filters }) : renameSegment({ id: segment!.id, name: v.name, updatedAt: segment!.updatedAt })
    )
    if (!result.ok) {
      // Name doppelt, leer oder zu lang: Meldung am Feld
      if (result.error === 'nameTaken' || result.error === 'nameRequired' || result.error === 'nameTooLong') {
        form.setError('name', { message: tErr(result.error) }, { shouldFocus: true })
      } else if (result.error !== 'sessionExpired') setError(result.error)
      return
    }
    toast.success(t(mode === 'save' ? 'created' : 'renamed'))
    onClose()
    if (mode === 'rename') router.refresh()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(mode === 'save' ? 'saveTitle' : 'renameTitle')}</DialogTitle>
          {mode === 'save' && <DialogDescription>{t('saveLead')}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-5">
            <FormError error={error} namespace="marketing.errors" />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input className="min-h-11" maxLength={SEGMENT_NAME_MAX + 20} placeholder={t('namePlaceholder')} autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>{t('nameCount', { count: name.trim().length, max: SEGMENT_NAME_MAX })}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-3 sm:gap-2">
              <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="min-h-11" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('saving') : t('confirmSave')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
