// Einstellungen → Rechnungen (PROJ-39): Daten der Seite und Umwandlung aus der Datenbank. Gilt im Browser und auf dem Server.

import { DEFAULT_NUMBERING, NUMBER_SEPARATORS, type NumberingSettings, type NumberSeparator } from '@/lib/invoice-numbering'
import { type DueBasis, sortTextBlocks, type TextBlock, type TextBlockKind } from '@/lib/invoice-texts'
import { emptyDoc, isRichDoc, normalizeDoc, type RichDoc } from '@/lib/rich-text'

export type InvoiceSettingsErrorCode =
  | 'staleSettings'
  | 'blockGone'
  | 'blockLimit'
  | 'nameTaken'
  | 'contentInvalid'
  | 'tenantDeactivated'
  | 'tenantGone'

export type InvoiceSettingsData = {
  tenantId: string
  numbering: NumberingSettings & { updatedAt: string }
  fixedTexts: { smallBusinessNote: RichDoc; footer: RichDoc | null; updatedAt: string }
  backfill: { enabled: boolean; updatedAt: string }
  blocks: TextBlock[]
  // Nummern aller Rechnungen des Kunden (nacherfasst und ausgestellt) für die Vorschau der nächsten Nummer
  invoiceNumbers: string[]
  // Gibt es schon in der App ausgestellte Rechnungen (PROJ-41)? Dann warnt das Ändern des Nummernkreises.
  hasIssued: boolean
}

// Spalten der Tabelle invoice_settings
export const INVOICE_SETTINGS_COLUMNS =
  'tenant_id, number_prefix, number_with_year, number_separator, number_digits, number_yearly_reset, number_start, number_start_year, numbering_updated_at, small_business_note, footer, texts_updated_at, backfill_enabled, backfill_updated_at'

export const TEXT_BLOCK_COLUMNS = 'id, block, name, body, is_default, deposit_percent, deposit_days, due_days, due_basis, updated_at'

export type InvoiceSettingsRow = {
  tenant_id: string
  number_prefix: string
  number_with_year: boolean
  number_separator: string
  number_digits: number
  number_yearly_reset: boolean
  number_start: number
  number_start_year: number | null
  numbering_updated_at: string
  small_business_note: unknown
  footer: unknown
  texts_updated_at: string
  backfill_enabled: boolean
  backfill_updated_at: string
}

export type TextBlockRow = {
  id: string
  block: string
  name: string
  body: unknown
  is_default: boolean
  deposit_percent: number | string | null
  deposit_days: number | null
  due_days: number | null
  due_basis: string | null
  updated_at: string
}

// Gespeicherte Texte sind von der Datenbank geprüft; normalizeDoc fängt trotzdem jede Abweichung ab
const docFromRow = (value: unknown): RichDoc => (isRichDoc(value) ? value : value ? normalizeDoc(value) : emptyDoc())

export function textBlockFromRow(row: TextBlockRow): TextBlock {
  const kind = row.block as TextBlockKind
  return {
    id: row.id,
    kind,
    name: row.name,
    body: docFromRow(row.body),
    isDefault: row.is_default,
    payment:
      kind === 'payment'
        ? {
            depositPercent: row.deposit_percent === null ? null : Number(row.deposit_percent),
            depositDays: row.deposit_days,
            dueDays: row.due_days ?? 0,
            dueBasis: (row.due_basis ?? 'after_invoice') as DueBasis,
          }
        : null,
    updatedAt: row.updated_at,
  }
}

export function invoiceSettingsFromRows(
  row: InvoiceSettingsRow,
  blocks: TextBlockRow[],
  invoiceNumbers: string[],
  hasIssued: boolean
): InvoiceSettingsData {
  const separator = (NUMBER_SEPARATORS as readonly string[]).includes(row.number_separator)
    ? (row.number_separator as NumberSeparator)
    : DEFAULT_NUMBERING.separator
  return {
    tenantId: row.tenant_id,
    numbering: {
      prefix: row.number_prefix,
      withYear: row.number_with_year,
      separator,
      digits: row.number_digits,
      yearlyReset: row.number_yearly_reset,
      startNumber: row.number_start,
      startYear: row.number_start_year,
      updatedAt: row.numbering_updated_at,
    },
    fixedTexts: {
      smallBusinessNote: docFromRow(row.small_business_note),
      footer: row.footer ? docFromRow(row.footer) : null,
      updatedAt: row.texts_updated_at,
    },
    backfill: { enabled: row.backfill_enabled, updatedAt: row.backfill_updated_at },
    blocks: sortTextBlocks(blocks.map(textBlockFromRow)),
    invoiceNumbers,
    hasIssued,
  }
}
