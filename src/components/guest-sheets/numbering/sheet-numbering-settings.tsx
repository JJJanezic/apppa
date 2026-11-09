'use client'

import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deleteSheetNumberRange } from '@/app/(app)/einstellungen/gaesteblatt/numbering-actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { NumberNotice } from '@/components/guest-sheets/numbering/number-notice'
import { RangeDialog } from '@/components/guest-sheets/numbering/range-dialog'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import type { MunicipalityNumbering, SheetNumberRange } from '@/lib/guest-sheet-numbering'
import { cn } from '@/lib/utils'

type DialogState = { municipality: MunicipalityNumbering; range: SheetNumberRange | null } | null

// Abschnitt „Laufende Nummer je Gemeinde“ (PROJ-26, Erweiterung 2026-11-09): je Gemeinde mit Objekten die Nummernbereiche
// in der Reihenfolge der Eingabe. Der erste offene Bereich ist „in Verwendung“, weitere „folgen“; nach der letzten Nummer
// springt die Vergabe in den nächsten Bereich.
export function SheetNumberingSettings({
  tenantId,
  municipalities,
  ready,
  readOnly,
  level,
}: {
  tenantId: string
  municipalities: MunicipalityNumbering[]
  ready: boolean
  readOnly: boolean
  // Überschrift je Gemeinde eine Ebene unter dem Abschnitt
  level: 3 | 4
}) {
  const t = useTranslations('guestSheets.numbering')
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [remove, setRemove] = useState<SheetNumberRange | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const Heading = level === 3 ? 'h3' : 'h4'

  if (!ready) {
    return (
      <Alert>
        <AlertDescription>{t('notReady')}</AlertDescription>
      </Alert>
    )
  }
  if (!municipalities.length) return <p className="text-ds-neutral-800">{t('empty')}</p>

  const open = (municipality: MunicipalityNumbering, range: SheetNumberRange | null) => {
    setDialog({ municipality, range })
    setDialogOpen(true)
  }

  async function confirmRemove() {
    const range = remove
    setRemove(null)
    if (!range) return
    setError(null)
    const result = await callAction(() => deleteSheetNumberRange({ tenantId, id: range.id, updatedAt: range.updatedAt }))
    if (!result.ok) {
      if (result.error === 'staleRange') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('rangeDeleted'))
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError error={error} namespace="guestSheets.errors" />
      {stale && <StaleAlert onReload={() => setStale(false)} />}
      {municipalities.map((m) => (
        <section key={m.code} aria-labelledby={`gemeinde-${m.code}`} className="flex flex-col gap-3 rounded-lg bg-ds-surface px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Heading id={`gemeinde-${m.code}`} className="text-lg font-semibold">
              {m.name} <span className="font-normal text-ds-neutral-800">({m.code})</span>
            </Heading>
            {m.next && (
              <p className="text-sm">
                {t('nextSummary', { number: m.next, count: m.free })}
              </p>
            )}
          </div>
          <NumberNotice state={m.state} municipality={m.name} free={m.free} />
          {m.ranges.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('from')}</TableHead>
                    <TableHead>{t('to')}</TableHead>
                    <TableHead>{t('next')}</TableHead>
                    <TableHead>{t('state')}</TableHead>
                    {!readOnly && <TableHead className="w-0"><span className="sr-only">{t('actions')}</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.ranges.map((r) => (
                    <TableRow key={r.id} className={cn(r.state === 'exhausted' && 'text-ds-neutral-800')}>
                      <TableCell className="whitespace-nowrap">{r.from}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.to}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.state === 'active' ? (r.next ?? '–') : r.state === 'queued' ? r.from : '–'}</TableCell>
                      <TableCell>
                        <Badge variant={r.state === 'active' ? 'default' : 'secondary'}>
                          {r.state === 'exhausted' && r.exhaustedAt ? t('exhaustedOn', { date: formatDate(r.exhaustedAt) }) : t(`states.${r.state}`)}
                        </Badge>
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          {r.state !== 'exhausted' && (
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="icon" className="size-11" onClick={() => open(m, r)} aria-label={t('edit', { from: r.from, to: r.to })}>
                                <PencilSimple size={18} aria-hidden="true" />
                              </Button>
                              {r.state === 'queued' && (
                                <Button type="button" variant="ghost" size="icon" className="size-11" onClick={() => setRemove(r)} aria-label={t('delete', { from: r.from, to: r.to })}>
                                  <Trash size={18} aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!readOnly && (
            <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => open(m, null)}>
              <Plus size={18} aria-hidden="true" />
              {t('add')}
            </Button>
          )}
        </section>
      ))}

      {dialog && (
        <RangeDialog
          key={`${dialog.municipality.code}-${dialog.range?.id ?? 'neu'}-${dialog.range?.updatedAt ?? ''}`}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tenantId={tenantId}
          municipality={dialog.municipality}
          range={dialog.range}
          others={dialog.municipality.ranges.filter((r) => r.id !== dialog.range?.id).map((r) => ({ from: r.from, to: r.to }))}
          becomesActive={!dialog.municipality.ranges.some((r) => r.state !== 'exhausted')}
        />
      )}
      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(o) => !o && setRemove(null)}
        title={t('deleteTitle')}
        text={remove ? t('deleteText', { from: remove.from, to: remove.to }) : ''}
        confirmLabel={t('deleteConfirm')}
        cancelLabel={t('cancel')}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  )
}
