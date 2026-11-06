'use client'

import { CaretDown, DotsThreeVertical, Plus } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useFieldArray, useFormContext, useFormState, useWatch } from 'react-hook-form'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { accountDisplayName, BANK_ACCOUNT_LIMITS as B, type BankAccount, formatIban } from '@/lib/bank-accounts'
import { cn } from '@/lib/utils'
import type { TenantMasterDataInput } from '@/lib/validation/tenant'

type AccountInput = TenantMasterDataInput['bankAccounts'][number]

interface BankAccountsFieldsProps {
  // gespeicherte Konten: daraus die Wohnungen mit fester Zuordnung und welche Konten noch neu sind
  saved: BankAccount[]
  readOnly: boolean
}

export const toAccountInput = (a: BankAccount): AccountInput => ({
  id: a.id,
  label: a.label ?? '',
  accountHolder: a.accountHolder,
  iban: formatIban(a.iban),
  bic: a.bic ?? '',
  bankName: a.bankName ?? '',
  note: a.note ?? '',
  primary: a.primary,
  archived: a.archived,
})

// Bereich „Bankkonten“ im Stammdaten-Formular (PROJ-46). Je Konto eine aufklappbare Karte; alle Änderungen
// (auch Primär, Archivieren, Löschen) übernimmt erst „Speichern“. Die Reihenfolge springt beim Bearbeiten nicht,
// sortiert wird nach dem Speichern (Seite lädt neu). Neue Konten erhalten ihre Kennung sofort.
export function BankAccountsFields({ saved, readOnly }: BankAccountsFieldsProps) {
  const t = useTranslations('tenantData.bank')
  const { control, getValues, setValue } = useFormContext<TenantMasterDataInput>()
  const rows = useFieldArray({ control, name: 'bankAccounts', keyName: 'key' })
  const values = useWatch({ control, name: 'bankAccounts' }) ?? []
  const { errors } = useFormState({ control, name: 'bankAccounts' })
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [confirmArchive, setConfirmArchive] = useState<number | null>(null)

  const usedBy = new Map(saved.map((a) => [a.id, a.usedBy]))
  const savedIds = new Set(saved.map((a) => a.id))
  const full = rows.fields.length >= B.accountsMax
  const listError = errors.bankAccounts?.root?.message ?? errors.bankAccounts?.message

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function add() {
    const id = crypto.randomUUID()
    setOpen((prev) => new Set(prev).add(id))
    rows.append(
      {
        id,
        label: '',
        accountHolder: getValues('name').trim(),
        iban: '',
        bic: '',
        bankName: '',
        note: '',
        // erstes Konto wird automatisch primär
        primary: rows.fields.length === 0,
        archived: false,
      },
      { shouldFocus: true, focusName: `bankAccounts.${rows.fields.length}.label` }
    )
  }

  function makePrimary(index: number) {
    values.forEach((_, i) => setValue(`bankAccounts.${i}.primary`, i === index, { shouldDirty: true }))
  }

  const setArchived = (index: number, archived: boolean) =>
    setValue(`bankAccounts.${index}.archived`, archived, { shouldDirty: true, shouldValidate: false })

  function archive(index: number) {
    if ((usedBy.get(values[index]?.id) ?? []).length > 0) setConfirmArchive(index)
    else setArchived(index, true)
  }

  const confirming = confirmArchive !== null ? values[confirmArchive] : null

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg">{t('title')}</h3>
      {rows.fields.length === 0 ? (
        <p className="text-ds-neutral-800">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t('listLabel')}>
          {rows.fields.map((row, i) => {
            const v = values[i] ?? row
            const used = usedBy.get(row.id) ?? []
            const isNew = !savedIds.has(row.id)
            const hasError = Boolean(errors.bankAccounts?.[i])
            const isOpen = readOnly || hasError || open.has(row.id)
            const name = accountDisplayName({ label: v.label, bankName: v.bankName, iban: v.iban })
            // Löschen: nie das primäre Konto (außer einem neuen, einzigen), nie bei fester Zuordnung
            const canDelete = used.length === 0 && (!v.primary || (isNew && rows.fields.length === 1))
            const contentId = `bank-account-${row.id}`
            return (
              <li key={row.key} className={cn('rounded-lg border p-3', v.archived && 'bg-ds-surface')}>
                <Collapsible open={isOpen}>
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('font-semibold break-words', v.archived && 'text-ds-neutral-800')}>{name}</span>
                        {v.primary && <Badge>{t('primary')}</Badge>}
                        {v.archived && (
                          <Badge variant="secondary" className="font-normal">
                            {t('archived')}
                          </Badge>
                        )}
                        {isNew && !readOnly && (
                          <Badge variant="outline" className="font-normal">
                            {t('unsaved')}
                          </Badge>
                        )}
                      </div>
                      {v.iban && <span className="font-mono text-sm break-all">{formatIban(v.iban)}</span>}
                      {used.length > 0 && (
                        <span className="text-sm text-ds-neutral-800">{t('inUse', { apartments: used.join(', ') })}</span>
                      )}
                    </div>
                    {!readOnly && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0"
                          aria-expanded={isOpen}
                          aria-controls={contentId}
                          aria-label={`${isOpen ? t('collapse') : t('edit')}: ${name}`}
                          onClick={() => toggle(row.id)}
                        >
                          <CaretDown size={18} aria-hidden="true" className={cn('transition-transform', isOpen && 'rotate-180')} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t('actions', { name })}>
                              <DotsThreeVertical size={20} weight="bold" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="min-h-11" onSelect={() => toggle(row.id)}>
                              {isOpen ? t('collapse') : t('edit')}
                            </DropdownMenuItem>
                            {!v.primary && !v.archived && (
                              <DropdownMenuItem className="min-h-11" onSelect={() => makePrimary(i)}>
                                {t('makePrimary')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {v.archived ? (
                              <DropdownMenuItem className="min-h-11" onSelect={() => setArchived(i, false)}>
                                {t('restore')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="min-h-11" disabled={v.primary} onSelect={() => archive(i)}>
                                {t('archive')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="min-h-11 text-ds-accent-2-700"
                              disabled={!canDelete}
                              onSelect={() => rows.remove(i)}
                            >
                              {t('remove')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>

                  <CollapsibleContent id={contentId} className="mt-4 flex flex-col gap-4">
                    {!readOnly && v.primary && !isNew && (
                      <p className="text-sm text-ds-neutral-800">{t('primaryLocked')}</p>
                    )}
                    {!readOnly && used.length > 0 && <p className="text-sm text-ds-neutral-800">{t('inUseNoDelete')}</p>}
                    {errors.bankAccounts?.[i]?.archived?.message && (
                      <p role="alert" className="text-sm text-destructive">
                        {errors.bankAccounts?.[i]?.archived?.message}
                      </p>
                    )}
                    <AccountText index={i} name="label" max={B.labelMax} hint={t('labelHint')} />
                    <AccountText index={i} name="accountHolder" max={B.holderMax} autoComplete="name" />
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                      <AccountText index={i} name="iban" max={42} hint={t('ibanHint')} mono />
                      <AccountText index={i} name="bic" max={14} hint={t('bicHint')} mono />
                    </div>
                    <AccountText index={i} name="bankName" max={B.bankNameMax} />
                    <FormField
                      control={control}
                      name={`bankAccounts.${i}.note`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('note')}</FormLabel>
                          <FormControl>
                            <Textarea rows={2} maxLength={B.noteMax} {...field} />
                          </FormControl>
                          <FormDescription>{t('noteHint')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}
      {listError && (
        <p role="alert" className="text-sm text-destructive">
          {listError}
        </p>
      )}
      {!readOnly && (
        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={add}
            disabled={full}
            aria-describedby={full ? 'bank-accounts-full' : undefined}
          >
            <Plus size={16} aria-hidden="true" />
            {t('add')}
          </Button>
          {full && (
            <p id="bank-accounts-full" className="text-sm text-ds-neutral-800">
              {t('full', { max: B.accountsMax })}
            </p>
          )}
        </div>
      )}

      {confirming && confirmArchive !== null && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setConfirmArchive(null)}
          title={t('archiveTitle', { name: accountDisplayName(confirming) })}
          text={t('archiveText', { apartments: (usedBy.get(confirming.id) ?? []).join(', ') })}
          confirmLabel={t('archiveConfirm')}
          cancelLabel={t('cancel')}
          onConfirm={() => {
            setArchived(confirmArchive, true)
            setConfirmArchive(null)
          }}
        />
      )}
    </div>
  )
}

type TextName = 'label' | 'accountHolder' | 'iban' | 'bic' | 'bankName'

function AccountText({
  index,
  name,
  max,
  hint,
  mono = false,
  autoComplete = 'off',
}: {
  index: number
  name: TextName
  max: number
  hint?: string
  mono?: boolean
  autoComplete?: string
}) {
  const t = useTranslations('tenantData.bank')
  const { control } = useFormContext<TenantMasterDataInput>()
  return (
    <FormField
      control={control}
      name={`bankAccounts.${index}.${name}`}
      render={({ field }) => (
        <FormItem className="min-w-0">
          <FormLabel>{t(name)}</FormLabel>
          <FormControl>
            <Input
              maxLength={max}
              autoComplete={autoComplete}
              spellCheck={false}
              className={cn('min-h-11', mono && 'font-mono uppercase')}
              {...field}
            />
          </FormControl>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
