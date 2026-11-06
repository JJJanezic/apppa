'use client'

import { DotsThreeVertical, Plus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  createPaymentMethod,
  deletePaymentMethod,
  renamePaymentMethod,
  reorderPaymentMethods,
  setDefaultPaymentMethod,
  setPaymentMethodActive,
} from '@/app/(app)/einstellungen/zahlungen/actions'
import { callAction } from '@/components/auth/form-error'
import { SortableChargeList, SortableChargeRow } from '@/components/bookings/sortable-charges'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/auth/result'
import { PAYMENT_LIMITS as L, type PaymentMethod, type PaymentMethodErrorCode } from '@/lib/payments'

type Method = PaymentMethod & { used: boolean }

const nameKey = (name: string) => name.trim().toLocaleLowerCase('de-AT')

// Einstellungen → Zahlungen (PROJ-45), nur Inhaber: Zahlungsarten anlegen, umbenennen, per Griff ordnen (Reihenfolge der
// Auswahl beim Erfassen), Standard wählen, deaktivieren und, solange unbenutzt, löschen.
export function PaymentMethodsSettings({ methods, ready }: { methods: Method[]; ready: boolean }) {
  const t = useTranslations('paymentMethods')
  const tv = useTranslations('payments.validation')
  const router = useRouter()
  const [order, setOrder] = useState(methods.map((m) => m.id))
  const [seen, setSeen] = useState(methods)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Method | null>(null)
  const [deleting, setDeleting] = useState<Method | null>(null)
  const [pending, startTransition] = useTransition()

  // Neue Daten vom Server (nach router.refresh): Reihenfolge nachziehen
  if (methods !== seen) {
    setSeen(methods)
    setOrder(methods.map((m) => m.id))
  }
  const byId = new Map(methods.map((m) => [m.id, m]))
  const ordered = order.map((id) => byId.get(id)).filter((m): m is Method => Boolean(m))
  const activeCount = methods.filter((m) => m.active).length

  async function run(fn: () => Promise<ActionResult<unknown, PaymentMethodErrorCode>>, done?: string): Promise<boolean> {
    const result = await callAction(fn)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(t(`errors.${result.error}`))
      return false
    }
    if (done) toast.success(done)
    startTransition(() => router.refresh())
    return true
  }

  function validate(value: string, except?: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return tv('nameRequired')
    if (trimmed.length > L.methodNameMax) return tv('nameTooLong')
    if (methods.some((m) => m.id !== except && nameKey(m.name) === nameKey(trimmed))) return tv('nameTaken')
    return null
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validate(name)
    setNameError(invalid)
    if (invalid) return
    if (await run(() => createPaymentMethod({ name: name.trim() }), t('created'))) setName('')
  }

  function move(from: number, to: number) {
    const next = [...order]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    const previous = order
    setOrder(next)
    void (async () => {
      if (!(await run(() => reorderPaymentMethods({ ids: next })))) setOrder(previous)
    })()
  }

  if (!ready) {
    return (
      <Alert>
        <AlertDescription>{t('notReady')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="flex max-w-2xl flex-col gap-5" aria-labelledby="zahlungsarten" aria-busy={pending}>
      <div className="flex flex-col gap-1">
        <h2 id="zahlungsarten" className="text-2xl">
          {t('title')}
        </h2>
        <p className="text-ds-neutral-800">{t('lead')}</p>
      </div>

      {ordered.length > 0 ? (
        <SortableChargeList ids={order} labelAt={(i) => ordered[i]?.name ?? ''} onMove={move} onDraggingChange={() => undefined}>
          {ordered.map((m) => (
            <SortableChargeRow key={m.id} id={m.id} handleLabel={t('moveLabel', { name: m.name })} sortable={ordered.length > 1} withVat>
              <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2">
                <span className={m.active ? 'break-words' : 'break-words text-ds-neutral-800'}>{m.name}</span>
                {m.isDefault && (
                  <Badge variant="outline" className="border-ds-accent-700 font-normal text-ds-accent-700">
                    {t('default')}
                  </Badge>
                )}
                {!m.active && (
                  <Badge variant="outline" className="border-ds-neutral-500 font-normal text-ds-neutral-800">
                    {t('inactive')}
                  </Badge>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-11" aria-label={t('actionsLabel', { name: m.name })}>
                    <DotsThreeVertical size={20} weight="bold" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="min-h-11" onSelect={() => setRenaming(m)}>
                    {t('rename')}
                  </DropdownMenuItem>
                  {!m.isDefault && m.active && (
                    <DropdownMenuItem className="min-h-11" onSelect={() => void run(() => setDefaultPaymentMethod({ id: m.id }), t('defaultSet', { name: m.name }))}>
                      {t('makeDefault')}
                    </DropdownMenuItem>
                  )}
                  {m.active ? (
                    <DropdownMenuItem
                      className="min-h-11"
                      onSelect={() => {
                        if (m.isDefault) return void toast.error(t('errors.defaultInactive'))
                        if (activeCount <= 1) return void toast.error(t('errors.lastActive'))
                        void run(() => setPaymentMethodActive({ id: m.id, active: false }), t('deactivated', { name: m.name }))
                      }}
                    >
                      {t('deactivate')}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem className="min-h-11" onSelect={() => void run(() => setPaymentMethodActive({ id: m.id, active: true }), t('activated', { name: m.name }))}>
                      {t('activate')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="min-h-11 text-ds-accent-2-700"
                    onSelect={() => {
                      if (m.used) return void toast.error(t('errors.methodInUse'))
                      if (m.active && activeCount <= 1) return void toast.error(t('errors.lastActive'))
                      if (m.isDefault) return void toast.error(t('errors.defaultInactive'))
                      setDeleting(m)
                    }}
                  >
                    {t('delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SortableChargeRow>
          ))}
        </SortableChargeList>
      ) : (
        <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('empty')}</p>
      )}
      <p className="text-[13px] text-ds-neutral-800">{t('usedHint')}</p>

      <form onSubmit={add} noValidate className="flex flex-col gap-1.5">
        <Label htmlFor="neue-zahlungsart">{t('newLabel')}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="neue-zahlungsart"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError(null)
            }}
            maxLength={L.methodNameMax + 10}
            autoComplete="off"
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? 'neue-zahlungsart-fehler' : undefined}
            className="min-h-11 sm:max-w-sm"
          />
          <Button type="submit" variant="outline" className="min-h-11" disabled={methods.length >= L.methodsMax}>
            <Plus size={18} weight="bold" aria-hidden="true" />
            {t('add')}
          </Button>
        </div>
        {nameError && (
          <p id="neue-zahlungsart-fehler" role="alert" className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </form>

      {renaming && (
        <RenameDialog
          method={renaming}
          validate={(v) => validate(v, renaming.id)}
          onClose={() => setRenaming(null)}
          onSave={async (v) => {
            if (await run(() => renamePaymentMethod({ id: renaming.id, name: v.trim() }), t('renamed'))) setRenaming(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={t('deleteTitle', { name: deleting.name })}
          text={t('deleteText')}
          confirmLabel={t('deleteConfirm')}
          cancelLabel={t('cancel')}
          onConfirm={() => {
            const id = deleting.id
            setDeleting(null)
            void run(() => deletePaymentMethod({ id }), t('deleted'))
          }}
        />
      )}
    </section>
  )
}

function RenameDialog({
  method,
  validate,
  onClose,
  onSave,
}: {
  method: Method
  validate: (value: string) => string | null
  onClose: () => void
  onSave: (value: string) => Promise<void>
}) {
  const t = useTranslations('paymentMethods')
  const [value, setValue] = useState(method.name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validate(value)
    setError(invalid)
    if (invalid) return
    setSaving(true)
    await onSave(value)
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('renameTitle')}</DialogTitle>
            <DialogDescription>{t('renameText')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zahlungsart-name">{t('nameLabel')}</Label>
            <Input
              id="zahlungsart-name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={L.methodNameMax + 10}
              autoComplete="off"
              aria-invalid={error !== null}
              className="min-h-11"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" className="min-h-11" disabled={saving}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
