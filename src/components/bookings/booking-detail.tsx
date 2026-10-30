import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { BookingActions } from '@/components/bookings/booking-actions'
import { BookingBadges } from '@/components/bookings/booking-badges'
import { BookingInvoicesSection } from '@/components/invoices/booking-invoices'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { billableNights, type BookableApartment, type Booking, bookingState, nightsBetween, personCount, totalCents } from '@/lib/bookings'
import { formatCents, formatDate, formatDatePlain, formatNumber, formatPeriod } from '@/lib/format'
import { countryName, guestDisplayName, guestHref, guestSortName } from '@/lib/guests'
import { cn } from '@/lib/utils'
import { formatVatRate, vatBreakdown } from '@/lib/vat'
import { vatStatusForBooking } from '@/lib/vat-status'
import { getVatStatusHistory } from '@/lib/vat-status-data'

// Überschrift eines Eintrags: Gast bzw. „Sperre: Grund“
export async function bookingTitle(b: Booking): Promise<string> {
  const t = await getTranslations('bookings')
  if (b.kind === 'block') return b.blockReason ? `${t('kind.block')}: ${t(`blockReason.${b.blockReason}`)}` : t('kind.block')
  return b.guest ? guestDisplayName(b.guest) : t('kind.booking')
}

const euro = formatCents

interface BookingDetailProps {
  booking: Booking
  apartments: BookableApartment[]
  owner: boolean
  today: string
  // „page“: Detailseite (zwei Spalten ab Desktop); „panel“: Seitenpanel im Belegungskalender (eine Spalte)
  layout: 'page' | 'panel'
  // Ziel der Links auf überschneidende Einträge
  conflictHref: (id: string) => string
  // Nach Stornieren oder Löschen dorthin (Panel schließen); sonst wie auf der Detailseite
  closeHref?: string
}

// Inhalt des Buchungs-Details (PROJ-8), gemeinsam für /buchungen/[id] und das Detailpanel im Kalender (PROJ-9).
// Preis nur für Inhaber; Aktionen nach Rolle.
export async function BookingDetail({ booking, apartments, owner, today, layout, conflictHref, closeHref }: BookingDetailProps) {
  const t = await getTranslations('bookings')
  const locale = await getLocale()
  const state = bookingState(booking, today)
  const isBlock = booking.kind === 'block'
  // „Mi, 28.10.2026“ (PROJ-31); Kalendertage ohne Zeitzonen-Verschiebung
  const date = formatDate
  const missing = <span className="text-ds-neutral-700">{t('detail.missing')}</span>
  const persons = personCount(booking.adults, booking.childAges)
  const conflictLabel = (c: Booking['conflicts'][number]) =>
    c.kind === 'block'
      ? `${t('kind.block')}${c.blockReason ? `: ${t(`blockReason.${c.blockReason}`)}` : ''}`
      : [t(`kind.${c.kind}`), c.number, c.guestName].filter(Boolean).join(' · ')
  const headingSize = layout === 'panel' ? 'text-xl' : 'text-2xl'
  // PROJ-30: beide Abreisen nur zeigen, wenn sie abweichen; abgerechnet wird bis zur späteren
  const departureDiffers = !isBlock && booking.plannedDeparture !== booking.departure
  const stayNights = nightsBetween(booking.arrival, booking.departure)
  const plannedNights = nightsBetween(booking.arrival, booking.plannedDeparture)
  // Umsatzsteuer (PROJ-35): Kleinunternehmer laut PROJ-36 → keine Sätze und keine Aufstellung, nur ein Hinweis.
  // Storniert: nur die Stornogebühr zählt; sonst abgerechneter Übernachtungspreis und Zusatzkosten.
  const amounts = booking.amounts
  const smallBusiness = owner && amounts ? vatStatusForBooking(await getVatStatusHistory(), booking).smallBusiness : false
  const vatShares =
    amounts && !smallBusiness
      ? vatBreakdown(
          booking.cancelledAt
            ? amounts.cancellationFeeCents !== null
              ? [{ amountCents: amounts.cancellationFeeCents, vatBp: amounts.cancellationFeeVatBp }]
              : []
            : [{ amountCents: amounts.billedNightsCents, vatBp: amounts.nightsVatBp }, ...amounts.charges]
        )
      : []
  const rate = (bp: number) => (smallBusiness ? undefined : formatVatRate(bp))
  const billable = billableNights(booking)
  const sourceLabel = booking.source === 'custom' && booking.sourceCustom ? booking.sourceCustom : t(`source.${booking.source}`)

  return (
    <>
      <div className={cn('flex flex-col gap-4', layout === 'page' && '-mt-4')}>
        <BookingBadges
          kind={booking.kind}
          state={state}
          optionUntil={booking.optionUntil}
          overlapping={booking.conflicts.length > 0}
          priceReview={owner && booking.priceReview}
        />
        {state === 'expired' && booking.optionUntil && (
          <Alert className="max-w-2xl border-ds-neutral-400 bg-ds-surface">
            <AlertDescription>{t('detail.optionExpiredNote', { date: date(booking.optionUntil) })}</AlertDescription>
          </Alert>
        )}
        {state === 'cancelled' && booking.cancelledAt && (
          <Alert className="max-w-2xl border-ds-neutral-400 bg-ds-surface">
            <AlertDescription>{t('detail.cancelledNote', { date: date(booking.cancelledAt), name: booking.cancelledBy ?? '–' })}</AlertDescription>
          </Alert>
        )}
        {booking.conflicts.length > 0 && (
          <Alert className="max-w-2xl border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
            <AlertDescription className="flex flex-col gap-1 text-ds-accent-2-800">
              <span>{t('detail.overlapNote')}</span>
              <ul className="flex flex-col gap-1">
                {booking.conflicts.map((c) => (
                  <li key={c.id}>
                    <Link href={conflictHref(c.id)} scroll={layout === 'page'} className="underline underline-offset-[3px]">
                      {conflictLabel(c)}
                    </Link>
                    {/* Zeitraum der anderen Buchung wie in der Formular-Warnung (QA PROJ-31 BUG-1) */}
                    <span className="tabular-nums">, {formatPeriod(c.arrival, c.departure)}</span>
                  </li>
                ))}
              </ul>
              {booking.overrideBy && <span className="text-[13px]">{t('detail.overrideNote', { name: booking.overrideBy })}</span>}
            </AlertDescription>
          </Alert>
        )}
        <BookingActions booking={booking} apartments={apartments} owner={owner} today={today} closeHref={closeHref} />
      </div>

      <div className={cn('grid gap-8', layout === 'page' && 'lg:grid-cols-2')}>
        <DetailSection title={t('detail.stay')} headingSize={headingSize}>
          <Fact label={t('detail.arrival')}>{date(booking.arrival)}</Fact>
          {departureDiffers && <Fact label={t('detail.plannedDeparture')}>{date(booking.plannedDeparture)}</Fact>}
          <Fact label={t('detail.departure')}>{date(booking.departure)}</Fact>
          <Fact label={t('detail.nights')}>
            {formatNumber(stayNights)}
            {billable !== stayNights && <span className="text-ds-neutral-800"> · {t('detail.billableNights', { nights: billable })}</span>}
          </Fact>
          {isBlock ? (
            <Fact label={t('detail.reason')}>{booking.blockReason ? t(`blockReason.${booking.blockReason}`) : missing}</Fact>
          ) : (
            <>
              <Fact label={t('detail.persons')}>
                {booking.childAges.length > 0
                  ? t('detail.personsValue', { persons, adults: booking.adults, children: booking.childAges.length })
                  : t('detail.personsAdultsOnly', { persons })}
              </Fact>
              {booking.childAges.length > 0 && (
                <Fact label={t('detail.childAges')}>{t('detail.agesValue', { ages: booking.childAges.join(', ') })}</Fact>
              )}
              <Fact label={t('detail.channel')}>{t('detail.channelDirect')}</Fact>
              <Fact label={t('detail.source')}>{booking.source === 'none' ? missing : <span className="break-words">{sourceLabel}</span>}</Fact>
              <Fact label={t('detail.guestSheetNumber')}>{booking.guestSheetNumber ?? missing}</Fact>
              {booking.residenceRegistered && <Fact label={t('detail.residence')}>{t('detail.residenceRegistered')}</Fact>}
            </>
          )}
          {booking.kind === 'option' && booking.optionUntil && <Fact label={t('detail.optionUntil')}>{date(booking.optionUntil)}</Fact>}
          {booking.cancelReason && <Fact label={t('detail.cancelReason')}>{booking.cancelReason}</Fact>}
          <Fact label={t('detail.note')}>{booking.note ? <span className="whitespace-pre-line break-words">{booking.note}</span> : missing}</Fact>
        </DetailSection>

        {!isBlock && (
          <div className="flex flex-col gap-8">
            {booking.guest && (
              <DetailSection title={t('detail.guest')} headingSize={headingSize}>
                <Fact label={t('detail.guest')}>
                  <Link href={guestHref(booking.guest.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
                    {guestDisplayName(booking.guest)}
                  </Link>
                </Fact>
                <Fact label={t('detail.country')}>{countryName(booking.guest.country, locale)}</Fact>
              </DetailSection>
            )}

            <section className="flex flex-col gap-3">
              <h2 className={headingSize}>{t('detail.companions')}</h2>
              {booking.companions.length === 0 ? (
                <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">
                  {persons > 1 ? t('detail.companionsEmpty') : t('detail.companionsNone')}
                </p>
              ) : (
                <ul className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
                  {booking.companions.map((c, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2 py-3">
                      <span>{guestSortName(c)}</span>
                      {c.birthDate && <span className="text-ds-neutral-800 tabular-nums">{formatDatePlain(c.birthDate)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {owner && booking.amounts && (
              <section className="flex flex-col gap-3">
                <h2 className={headingSize}>{t('detail.price')}</h2>
                {booking.priceReview && (
                  <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
                    <AlertDescription>{t('detail.priceReviewNote')}</AlertDescription>
                  </Alert>
                )}
                <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
                  <Money label={t('detail.nightsPrice')} rate={rate(booking.amounts.nightsVatBp)} cents={booking.amounts.billedNightsCents} />
                  {booking.amounts.charges.map((c, i) => (
                    <Money key={i} label={c.label} rate={rate(c.vatBp)} cents={c.amountCents} />
                  ))}
                  <div className="flex items-baseline justify-between gap-4 py-3 font-semibold">
                    <dt>{t('detail.total')}</dt>
                    <dd>
                      <Amount cents={totalCents({ nightsCents: booking.amounts.billedNightsCents, charges: booking.amounts.charges })} />
                    </dd>
                  </div>
                  {booking.amounts.cancellationFeeCents !== null && (
                    <Money
                      label={t('detail.cancellationFee')}
                      rate={rate(booking.amounts.cancellationFeeVatBp)}
                      cents={booking.amounts.cancellationFeeCents}
                    />
                  )}
                </dl>
                {smallBusiness && <p className="text-[13px] text-ds-neutral-800">{t('detail.noVat')}</p>}
                {vatShares.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <h3 id="enthaltene-ust" className="text-sm font-semibold">
                      {t('detail.vatIncluded')}
                    </h3>
                    <dl aria-labelledby="enthaltene-ust" className="flex flex-col divide-y rounded-lg bg-ds-surface px-4 text-sm">
                      {vatShares.map((s) => (
                        <div key={s.vatBp} className="flex items-baseline justify-between gap-4 py-2">
                          <dt>{formatVatRate(s.vatBp)}</dt>
                          <dd>
                            <Amount cents={s.vatCents} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {booking.amounts.billedNightsCents !== booking.amounts.nightsCents && (
                  <p className="text-[13px] text-ds-neutral-800">
                    {t('detail.extension', { agreed: euro(booking.amounts.nightsCents), nights: plannedNights, billable })}
                  </p>
                )}
              </section>
            )}

            {/* Rechnungen zur Buchung (PROJ-37): für alle Mitglieder, nur wenn welche verknüpft sind */}
            <BookingInvoicesSection bookingId={booking.id} headingSize={headingSize} />
          </div>
        )}
      </div>
    </>
  )
}

function DetailSection({ title, headingSize, children }: { title: string; headingSize: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className={headingSize}>{title}</h2>
      <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">{children}</dl>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-ds-neutral-700 sm:text-sm">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

// rate: Umsatzsteuersatz neben der Bezeichnung („Reinigung · 10 %“, PROJ-35); fehlt bei Kleinunternehmern
function Money({ label, rate, cents }: { label: string; rate?: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="min-w-0 break-words">
        {label}
        {rate && <span className="text-ds-neutral-800"> · {rate}</span>}
      </dt>
      <dd>
        <Amount cents={cents} />
      </dd>
    </div>
  )
}
