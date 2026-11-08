// Vom eingefrorenen Gästeblatt (PROJ-26) zu den fertigen Daten der PDF-Vorlage. Reine Regel.

import { formatDatePlain, formatDateTime } from '@/lib/format'
import type { GuestSheetSnapshot, SheetDeparture } from '@/lib/guest-sheet'
import { GUEST_SHEET_PDF_KIND, type GuestSheetPdfView, type PdfDay } from '@/lib/guest-sheet-pdf/types'
import { countryName, GENDERS, guestDisplayName } from '@/lib/guests'

type T = (key: string, values?: Record<string, string | number>) => string

// Beschriftungen der Vorlage (Schlüssel unter „guestSheets.pdf“)
const LABEL_KEYS = [
  'title',
  'kennzahl',
  'establishment',
  'sheetNumber',
  'lastName',
  'gender',
  'genderHint',
  'genderNone',
  'firstNames',
  'birthDate',
  'nationality',
  'document',
  'address',
  'addressHint',
  'street',
  'postalCode',
  'city',
  'country',
  'companions',
  'companionsHint',
  'arrival',
  'plannedDeparture',
  'actualDeparture',
  'day',
  'month',
  'year',
  'signature',
  'privacyPage',
] as const

const day = (iso: string): PdfDay => ({ day: iso.slice(8, 10), month: iso.slice(5, 7), year: iso.slice(0, 4) })

export type GuestSheetPdfInput = {
  snapshot: GuestSheetSnapshot
  departure: SheetDeparture
  // PNG der Unterschriften als data:-Adressen
  signatures: { first: string; second: string }
  // Übersetzungen „guestSheets.pdf“ und Namen der Geschlechter bzw. Dokumentarten
  t: T
  genderLabel: (g: string) => string
  documentTypeLabel: (d: string) => string
  locale: string
}

export function buildGuestSheetPdfView(p: GuestSheetPdfInput): GuestSheetPdfView {
  const { snapshot: s, t } = p
  const g = s.guest
  const country = (c: string | null) => (c ? countryName(c, p.locale) : '')
  const labels: Record<string, string> = Object.fromEntries(LABEL_KEYS.map((k) => [k, t(k)]))
  labels.privacyRef = t('privacyRef', {
    number: s.sheetNumber ?? '–',
    guest: guestDisplayName({ lastName: g.lastName, firstName: g.firstName, titlePrefix: g.titlePrefix, titleSuffix: g.titleSuffix }),
  })
  const document = g.documentType
    ? [
        p.documentTypeLabel(g.documentType),
        g.documentNumber ? t('documentNumber', { number: g.documentNumber }) : null,
        g.documentIssuedOn ? t('documentIssuedOn', { date: formatDatePlain(g.documentIssuedOn) }) : null,
        g.documentAuthority,
        country(g.documentCountry) || null,
      ]
        .filter(Boolean)
        .join('; ')
    : ''
  const departureNote = p.departure
    ? p.departure.noted
      ? t('departureNoted', { date: formatDateTime(p.departure.noted.at), name: p.departure.noted.by ?? '–' })
      : t('departureAutomatic', { date: formatDatePlain(p.departure.date) })
    : null

  return {
    kind: GUEST_SHEET_PDF_KIND,
    title: t('fileTitle', { number: s.sheetNumber ?? '' }).trim(),
    labels,
    genders: GENDERS.map((value) => ({ value, label: p.genderLabel(value) })),
    sheetNumber: s.sheetNumber ?? '',
    establishment: s.tenantName,
    guest: {
      lastName: g.lastName,
      // Titel stehen beim Vornamen, damit der Familienname wie auf dem Formular allein steht
      firstNames: [g.titlePrefix, g.firstName, g.titleSuffix].filter(Boolean).join(' '),
      gender: g.gender,
      birthDate: g.birthDate ? formatDatePlain(g.birthDate) : '',
      nationality: country(g.country),
      document,
      street: g.street ?? '',
      postalCode: g.postalCode ?? '',
      city: g.city ?? '',
      country: country(g.addressCountry),
    },
    companions: s.companions.map((c) => ({ lastName: c.lastName, firstNames: c.firstName, birthDate: c.birthDate ? formatDatePlain(c.birthDate) : '' })),
    arrival: day(s.stay.arrival),
    plannedDeparture: day(s.stay.plannedDeparture),
    actualDeparture: p.departure ? day(p.departure.date) : null,
    departureNote,
    signature1: { image: p.signatures.first, signedAt: formatDateTime(s.signedAt1) },
    privacyTitle: t('privacyTitle'),
    privacy: s.privacyText,
    marketingTitle: t('marketingTitle'),
    marketing: s.marketingText,
    consentLabel: t('consent'),
    consent: s.marketingConsent,
    signature2: { image: p.signatures.second, signedAt: t('signedAt', { date: formatDateTime(s.signedAt2) }), label: t('signature2') },
    // Seitenzahlen setzt erst die Vorlage ein
    footer: t('footer', { number: s.sheetNumber ?? '–', page: '{page}', pages: '{pages}' }),
  }
}
