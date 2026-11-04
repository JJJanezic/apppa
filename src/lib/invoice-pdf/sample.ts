// Musterrechnung für den Reiter „Briefpapier“ (PROJ-41): echte Stammdaten, Texte und Fußzeile des Kunden, erfundene Gast-
// und Buchungsdaten. Nutzt dieselbe Inhaltsregel wie die Entwurfsvorschau. Verbraucht keine Rechnungsnummer.

import { addDays } from '@/lib/bookings'
import type { DraftBooking, DraftLine, DraftPreviewData } from '@/lib/invoice-drafts'
import { buildPreviewModel, type InvoicePreviewModel } from '@/lib/invoice-preview'
import { nextInvoiceNumber } from '@/lib/invoice-numbering'
import type { InvoiceSettingsData } from '@/lib/invoice-settings'
import { docFromText, type RichDoc } from '@/lib/rich-text'
import { vatStatusOn } from '@/lib/vat-status'
import type { PaymentRules, TextBlockKind } from '@/lib/invoice-texts'

export type SampleLabels = {
  apartment: string
  guestFirst: string
  guestLast: string
  street: string
  postalCode: string
  city: string
  nights: string
  cleaning: string
  textIntro: string
  textPayment: string
  textClosing: string
}

const FALLBACK_PAYMENT: PaymentRules = { depositPercent: null, depositDays: null, dueDays: 14, dueBasis: 'after_invoice' }

export function buildSampleModel(p: {
  settings: InvoiceSettingsData
  issuer: DraftPreviewData['issuer']
  vatStatus: DraftPreviewData['vatStatus']
  today: string
  labels: SampleLabels
}): { model: InvoicePreviewModel; number: string } {
  const { settings: s, labels: l, today } = p
  const lines: DraftLine[] = [
    { label: l.nights, amountCents: 84000, vatBp: 1000, source: null },
    { label: l.cleaning, amountCents: 6000, vatBp: 2000, source: null },
  ]
  const booking: DraftBooking = {
    id: '00000000-0000-0000-0000-000000000000',
    kind: 'booking',
    number: null,
    arrival: addDays(today, -7),
    departure: today,
    cancelledAt: null,
    apartmentLabel: l.apartment,
    guest: {
      id: '00000000-0000-0000-0000-000000000000',
      lastName: l.guestLast,
      firstName: l.guestFirst,
      titlePrefix: null,
      titleSuffix: null,
      gender: 'female',
      anonymized: false,
      street: l.street,
      postalCode: l.postalCode,
      city: l.city,
      addressCountry: 'AT',
      companyName: null,
      companyVatId: null,
      companyAddressLine1: null,
      companyAddressLine2: null,
      companyPostalCode: null,
      companyCity: null,
      companyCountry: null,
    },
    companions: [],
    lines,
  }
  // Standard-Baustein je Block, sonst ein neutraler Mustertext
  const standard = (kind: TextBlockKind) => s.blocks.find((b) => b.kind === kind && b.isDefault)
  const text = (kind: TextBlockKind, fallback: string): RichDoc => standard(kind)?.body ?? docFromText(fallback)
  const model = buildPreviewModel({
    kind: 'invoice',
    invoiceDate: today,
    recipientKind: 'guest',
    recipient: { name: `${l.guestFirst} ${l.guestLast}`, line1: l.street, line2: '', postalCode: l.postalCode, city: l.city, country: 'AT', vatId: '' },
    companySalutation: 'generic',
    guestNameMode: 'main',
    lines,
    deductionIds: [],
    texts: { intro: text('intro', l.textIntro), payment: text('payment', l.textPayment), closing: text('closing', l.textClosing) },
    payment: standard('payment')?.payment ?? FALLBACK_PAYMENT,
    booking,
    others: [],
    preview: { issuer: p.issuer, footer: s.fixedTexts.footer, smallBusinessNote: s.fixedTexts.smallBusinessNote, vatStatus: p.vatStatus },
    smallBusiness: vatStatusOn(p.vatStatus, today).smallBusiness,
  })
  return { model, number: nextInvoiceNumber(s.numbering, s.invoiceNumbers, today).number }
}
