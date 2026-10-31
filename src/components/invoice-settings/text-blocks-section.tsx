'use client'

import { DotsThreeVertical, Plus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deleteInvoiceTextBlock, setInvoiceTextBlockDefault } from '@/app/(app)/einstellungen/rechnungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { TextBlockPanel } from '@/components/invoice-settings/text-block-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatInvoiceNumber } from '@/lib/invoice-numbering'
import type { InvoiceSettingsData } from '@/lib/invoice-settings'
import { INVOICE_TEXT_LIMITS as L, TEXT_BLOCKS, type TextBlock, type TextBlockKind } from '@/lib/invoice-texts'
import { docPlainText } from '@/lib/rich-text'

type PanelState = { kind: TextBlockKind; id: string | null } | null

// Textbausteine der Blöcke 4 (Einleitung), 6 (Zahlungsmodalitäten) und 7 (Abschlusstext)
export function TextBlocksSection({
  tenantId,
  data,
  readOnly,
  level,
}: {
  tenantId: string
  data: InvoiceSettingsData
  readOnly: boolean
  // Überschrift der Gruppen eine Ebene unter dem Abschnitt
  level: 3 | 4
}) {
  const t = useTranslations('invoiceSettings.blocks')
  const router = useRouter()
  const [panel, setPanel] = useState<PanelState>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [remove, setRemove] = useState<TextBlock | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [pending, setPending] = useState(false)

  // Rechnungsnummer der Vorschau im gespeicherten Format
  const sampleNumber = formatInvoiceNumber(data.numbering, 2026, 12)
  const Heading = level === 3 ? 'h3' : 'h4'

  const openPanel = (kind: TextBlockKind, id: string | null) => {
    setPanel({ kind, id })
    setPanelOpen(true)
  }

  async function run(fn: () => ReturnType<typeof setInvoiceTextBlockDefault>, success: string) {
    setError(null)
    setPending(true)
    const result = await callAction(fn)
    setPending(false)
    if (!result.ok) {
      if (result.error === 'staleSettings') setStale(true)
      else setError(result.error)
      // gelöscht oder geändert: aktuellen Stand zeigen
      if (result.error === 'blockGone') router.refresh()
      return
    }
    setStale(false)
    toast.success(success)
    router.refresh()
  }

  const setDefault = (kind: TextBlockKind, blockId: string | null) => {
    const expectedDefaultId = data.blocks.find((b) => b.kind === kind && b.isDefault)?.id ?? null
    return run(
      () => setInvoiceTextBlockDefault({ tenantId, kind, blockId, expectedDefaultId }),
      blockId ? t('defaultSet') : t('defaultCleared')
    )
  }

  const panelBlock = panel?.id ? (data.blocks.find((b) => b.id === panel.id) ?? null) : null
  // Baustein inzwischen gelöscht (z. B. nach „Aktuelle Fassung laden“)
  const panelGone = Boolean(panel?.id && !panelBlock)

  return (
    <div className="flex flex-col gap-6">
      <FormError error={error} namespace="invoiceSettings.errors" />
      {stale && <StaleAlert onReload={() => setStale(false)} />}

      {TEXT_BLOCKS.map((kind) => {
        const blocks = data.blocks.filter((b) => b.kind === kind)
        const full = blocks.length >= L.blocksPerKind
        const hasDefault = blocks.some((b) => b.isDefault)
        return (
          <div key={kind} className="flex flex-col gap-3" data-testid={`text-blocks-${kind}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Heading className="text-lg">{t(`kinds.${kind}`)}</Heading>
                <p className="text-[13px] text-ds-neutral-700">{t(`kindHints.${kind}`)}</p>
              </div>
              {!readOnly && (
                <Button type="button" variant="outline" className="min-h-11 gap-1.5" disabled={full} onClick={() => openPanel(kind, null)}>
                  <Plus size={16} weight="bold" aria-hidden="true" />
                  {t('add')}
                </Button>
              )}
            </div>
            {full && !readOnly && <p className="text-[13px] text-ds-neutral-800">{t('full', { max: L.blocksPerKind })}</p>}
            {!hasDefault && <p className="text-[13px] text-ds-neutral-800">{t('noDefault')}</p>}

            {blocks.length === 0 ? (
              <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg bg-ds-surface">
                {blocks.map((b) => (
                  <li key={b.id} className="flex items-start gap-2 py-1 pl-4 pr-1">
                    <button
                      type="button"
                      onClick={() => openPanel(kind, b.id)}
                      className="flex min-h-11 min-w-0 flex-1 flex-col items-start gap-1 py-2 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="break-words font-semibold text-ds-accent-700 underline-offset-[3px] hover:underline">{b.name}</span>
                        {b.isDefault && <Badge variant="secondary">{t('default')}</Badge>}
                      </span>
                      <span className="line-clamp-2 break-words text-[13px] text-ds-neutral-800">{docPlainText(b.body)}</span>
                    </button>
                    {!readOnly && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-11 shrink-0" disabled={pending} aria-label={t('actionsFor', { name: b.name })}>
                            <DotsThreeVertical size={20} weight="bold" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="min-h-11" onSelect={() => openPanel(kind, b.id)}>
                            {t('edit')}
                          </DropdownMenuItem>
                          {b.isDefault ? (
                            <DropdownMenuItem className="min-h-11" onSelect={() => setDefault(kind, null)}>
                              {t('clearDefault')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="min-h-11" onSelect={() => setDefault(kind, b.id)}>
                              {t('makeDefault')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="min-h-11 text-ds-accent-2-800" onSelect={() => setRemove(b)}>
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {panel && !panelGone && (
        <TextBlockPanel
          key={`${panel.kind}-${panel.id ?? 'new'}-${panelBlock?.updatedAt ?? ''}`}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          tenantId={tenantId}
          kind={panel.kind}
          block={panelBlock}
          otherNames={data.blocks.filter((b) => b.kind === panel.kind && b.id !== panel.id).map((b) => b.name)}
          sampleNumber={sampleNumber}
          readOnly={readOnly}
        />
      )}
      {panelGone && panelOpen && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPanelOpen(false)}
          title={t('goneTitle')}
          text={t('goneText')}
          confirmLabel={t('close')}
          cancelLabel={t('cancel')}
          onConfirm={() => setPanelOpen(false)}
        />
      )}

      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(open) => !open && setRemove(null)}
        title={t('deleteConfirm.title', { name: remove?.name ?? '' })}
        text={remove?.isDefault ? t('deleteConfirm.textDefault') : t('deleteConfirm.text')}
        confirmLabel={t('deleteConfirm.confirm')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          const b = remove
          setRemove(null)
          if (b) void run(() => deleteInvoiceTextBlock({ tenantId, id: b.id }), t('deleted'))
        }}
      />
    </div>
  )
}
