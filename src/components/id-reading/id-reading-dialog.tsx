'use client'

import { CheckCircle, Warning } from '@phosphor-icons/react'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { formatDatePlain } from '@/lib/format'
import { countryName } from '@/lib/guests'
import { chosenValues, type IdComparison, type IdComparisonRow, type IdField, initialChoice } from '@/lib/id-reading'
import { cn } from '@/lib/utils'

interface IdReadingDialogProps {
  comparison: IdComparison | null
  onClose: () => void
  onApply: (values: Partial<Record<IdField, string>>) => void
}

const DATE_FIELDS: IdField[] = ['birthDate', 'documentIssuedOn']
const COUNTRY_FIELDS: IdField[] = ['country', 'documentCountry']

// Gegenüberstellung „Vorhanden | Vom Ausweis“ (PROJ-51). Je Angabe eine Zeile; bei Abweichung, leerem Feld oder unsicherem
// Wert wählt man zwischen vorhandenem Wert und Ausweiswert. Gespeichert wird erst mit „Übernehmen“ (bzw. im Gastformular
// danach mit „Speichern“). Eine Zeile je Angabe statt Tabelle, damit es am Handy und am Tablet ohne Querscrollen passt.
export function IdReadingDialog({ comparison, onClose, onApply }: IdReadingDialogProps) {
  const t = useTranslations('idReading')
  return (
    <Dialog open={comparison !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>
        {comparison && <Comparison key={JSON.stringify(comparison)} comparison={comparison} onClose={onClose} onApply={onApply} />}
      </DialogContent>
    </Dialog>
  )
}

function Comparison({ comparison, onClose, onApply }: { comparison: IdComparison; onClose: () => void; onApply: IdReadingDialogProps['onApply'] }) {
  const t = useTranslations('idReading')
  const [choice, setChoice] = useState(() => initialChoice(comparison.rows))
  const values = chosenValues(comparison.rows, choice)
  const count = Object.keys(values).length

  return (
    <>
      {comparison.otherPerson && (
        <Alert variant="destructive" role="alert">
          <Warning size={18} aria-hidden="true" />
          <AlertDescription>{t('dialog.otherPerson')}</AlertDescription>
        </Alert>
      )}
      <ul className="flex flex-col divide-y rounded-lg border">
        {comparison.rows.map((row) => (
          <ComparisonRow
            key={row.field}
            row={row}
            useRead={Boolean(choice[row.field])}
            onChange={(useRead) => setChoice((c) => ({ ...c, [row.field]: useRead }))}
          />
        ))}
      </ul>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          {t('dialog.cancel')}
        </Button>
        <Button type="button" className="min-h-11" disabled={count === 0} onClick={() => onApply(values)}>
          {count === 0 ? t('dialog.nothing') : t('dialog.apply', { count })}
        </Button>
      </DialogFooter>
    </>
  )
}

function ComparisonRow({ row, useRead, onChange }: { row: IdComparisonRow; useRead: boolean; onChange: (useRead: boolean) => void }) {
  const t = useTranslations('idReading')
  const td = useTranslations('guests.documentType')
  const tg = useTranslations('guests.gender')
  const locale = useLocale()
  const id = useId()

  const show = (value: string | null) => {
    if (value === null || value.trim() === '') return '–'
    if (DATE_FIELDS.includes(row.field)) return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDatePlain(value) : value
    if (COUNTRY_FIELDS.includes(row.field)) return countryName(value, locale)
    if (row.field === 'documentType') return td(value as never)
    if (row.field === 'gender') return tg(value as never)
    return value
  }
  const label = t(`fields.${row.field}`)
  const choosable = row.state === 'fill' || row.state === 'differs' || row.state === 'uncertain'

  return (
    <li
      className={cn(
        'flex flex-col gap-2 p-3',
        row.state === 'differs' && 'bg-red-50',
        row.state === 'uncertain' && 'bg-amber-50'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-semibold">
          {label}
        </span>
        <StateBadge row={row} />
      </div>
      {choosable ? (
        <RadioGroup
          aria-labelledby={`${id}-label`}
          value={useRead ? 'read' : 'current'}
          onValueChange={(v) => onChange(v === 'read')}
          className="grid gap-2 sm:grid-cols-2"
        >
          {(['current', 'read'] as const).map((side) => (
            <Label
              key={side}
              htmlFor={`${id}-${side}`}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-white p-3 font-normal',
                (side === 'read') === useRead && 'border-ds-accent-700 ring-1 ring-ds-accent-700'
              )}
            >
              <RadioGroupItem id={`${id}-${side}`} value={side} className="mt-0.5" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] text-ds-neutral-700">{t(side === 'read' ? 'dialog.fromId' : 'dialog.existing')}</span>
                <span className="break-words">{show(side === 'read' ? row.read : row.current)}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      ) : (
        <p className="flex min-h-11 items-center gap-2 break-words">
          {row.state === 'same' && <CheckCircle size={18} weight="fill" className="shrink-0 text-ds-accent-700" aria-hidden="true" />}
          <span>{show(row.current || null)}</span>
          {row.state === 'missing' && <span className="text-[13px] text-ds-neutral-700">({t('dialog.notOnId')})</span>}
        </p>
      )}
    </li>
  )
}

function StateBadge({ row }: { row: IdComparisonRow }) {
  const t = useTranslations('idReading.state')
  switch (row.state) {
    case 'same':
      return <Badge variant="secondary">{t('same')}</Badge>
    case 'fill':
      return <Badge variant="secondary">{t('fill')}</Badge>
    case 'differs':
      return <Badge className="bg-red-700 text-white hover:bg-red-700">{t('differs')}</Badge>
    case 'uncertain':
      return <Badge className="bg-amber-300 text-black hover:bg-amber-300">{t('uncertain')}</Badge>
    case 'missing':
      return <Badge variant="outline">{t('missing')}</Badge>
  }
}
