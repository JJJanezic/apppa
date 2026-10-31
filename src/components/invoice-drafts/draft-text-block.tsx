'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { RichTextField } from '@/components/invoice-settings/rich-text-field'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INVOICE_TEXT_LIMITS, type TextBlock, type TextBlockKind } from '@/lib/invoice-texts'
import { emptyDoc, isDocEmpty, normalizeDoc, type RichDoc } from '@/lib/rich-text'
import type { DraftInput } from '@/lib/validation/invoice-drafts'

const NONE = 'none'
const same = (a: RichDoc, b: RichDoc) => JSON.stringify(normalizeDoc(a)) === JSON.stringify(normalizeDoc(b))

interface DraftTextBlockProps {
  kind: TextBlockKind
  // Bausteine dieses Blocks aus PROJ-39 (Standard zuerst)
  blocks: TextBlock[]
  // Zahlungsmodalitäten: Anzahlung für diese Rechnung ein (Platzhalter {Anzahlung} usw. erlaubt)
  deposit?: boolean
  // Ein Baustein wurde übernommen (Zahlungsmodalitäten: Zahlungsregeln setzen)
  onApplied?: (block: TextBlock | null) => void
  children?: React.ReactNode
}

// Textblock des Entwurfs (Einleitung, Zahlungsmodalitäten, Abschlusstext): Auswahl eines Bausteins oder „Kein Text“,
// Text als Kopie mit demselben beschränkten Editor wie PROJ-39. Ein anderer Baustein ersetzt einen geänderten Text erst
// nach Rückfrage. Platzhalter bleiben stehen und werden in der Vorschau ersetzt.
export function DraftTextBlock({ kind, blocks, deposit = false, onApplied, children }: DraftTextBlockProps) {
  const t = useTranslations('invoiceDrafts.texts')
  const form = useFormContext<DraftInput>()
  const [blockId, body] = useWatch({ control: form.control, name: [`${kind}.blockId`, `${kind}.body`] })
  // Neuer Schlüssel für den Editor, wenn der Text von außen ersetzt wird (der Editor übernimmt nur den Anfangswert)
  const [version, setVersion] = useState(0)
  const [pending, setPending] = useState<string | null>(null)
  const source = blocks.find((b) => b.id === blockId)
  const modified = !isDocEmpty(body) && !same(body, source?.body ?? emptyDoc())
  const selectId = `textbaustein-${kind}`

  function apply(id: string) {
    const block = blocks.find((b) => b.id === id) ?? null
    form.setValue(`${kind}.blockId`, block?.id ?? '', { shouldDirty: true })
    form.setValue(`${kind}.body`, block ? block.body : emptyDoc(), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    setVersion((v) => v + 1)
    onApplied?.(block)
  }

  return (
    <section aria-labelledby={`${selectId}-titel`} className="flex flex-col gap-4">
      <h2 id={`${selectId}-titel`} className="text-xl">
        {t(`${kind}.title`)}
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor={selectId}>{t('block')}</Label>
        <Select
          value={blockId || NONE}
          onValueChange={(id) => {
            if (id === (blockId || NONE)) return
            if (modified) setPending(id)
            else apply(id)
          }}
        >
          <SelectTrigger id={selectId} className="min-h-11 w-full sm:max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} className="min-h-11">
              {t('none')}
            </SelectItem>
            {blocks.map((b) => (
              <SelectItem key={b.id} value={b.id} className="min-h-11">
                {b.isDefault ? t('defaultName', { name: b.name }) : b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {blocks.length === 0 && <p className="text-[13px] text-ds-neutral-800">{t('noBlocks')}</p>}
      </div>
      {children}
      <RichTextField<DraftInput>
        key={version}
        control={form.control}
        name={`${kind}.body`}
        label={t('text')}
        hint={t('hint')}
        context={{ kind, deposit: kind === 'payment' && deposit }}
        max={INVOICE_TEXT_LIMITS.bodyMax}
      />
      {pending !== null && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPending(null)}
          title={t('replaceTitle')}
          text={t('replaceText')}
          confirmLabel={t('replaceConfirm')}
          cancelLabel={t('replaceKeep')}
          onConfirm={() => {
            apply(pending)
            setPending(null)
          }}
        />
      )}
    </section>
  )
}
