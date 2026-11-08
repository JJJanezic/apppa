import { FilePdf, Warning } from '@phosphor-icons/react/ssr'
import { getTranslations } from 'next-intl/server'

import { GuestSheetButtons } from '@/components/guest-sheets/guest-sheet-buttons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Booking } from '@/lib/bookings'
import { formatDate, formatDateTime } from '@/lib/format'
import { guestSheetExpected, guestSheetPdfHref, type GuestSheetSummary } from '@/lib/guest-sheet'
import { getBookingGuestSheets } from '@/lib/guest-sheets-data'

// Abschnitt „Gästeblatt“ im Buchungsdetail (PROJ-26) für Inhaber und Mitarbeiter: Stand, Ansehen, Unterschreiben lassen,
// Hochladen, frühere Blätter. Nur bei Buchungen, für die ein Blatt vorgesehen ist, oder wenn schon eines existiert
// (z. B. nach Storno oder nachträglich gesetztem „Wohnsitz angemeldet“).
export async function BookingGuestSheetSection({ booking, headingSize }: { booking: Booking; headingSize: string }) {
  if (booking.kind !== 'booking') return null
  const t = await getTranslations('guestSheets.booking')
  const { current, previous } = await getBookingGuestSheets(booking.id)
  const expected = guestSheetExpected(booking)
  if (!expected && !current && previous.length === 0) return null

  const blocked = !booking.guest ? 'noGuest' : booking.guest.anonymized ? 'guestAnonymized' : null
  const status = (s: GuestSheetSummary) =>
    s.kind === 'signed'
      ? t('signedAt', { date: s.signedAt ? formatDateTime(s.signedAt) : '–' })
      : [t('uploadedAt', { date: formatDate(s.createdAt), name: s.createdBy ?? '–' }), s.signedAt ? t('uploadedSignedOn', { date: formatDate(s.signedAt) }) : null]
          .filter(Boolean)
          .join(' · ')

  return (
    <section className="flex flex-col gap-3" aria-labelledby="gaesteblatt">
      <h2 id="gaesteblatt" className={headingSize}>
        {t('title')}
      </h2>
      {current?.changed && (
        <Alert className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
          <Warning size={18} weight="duotone" aria-hidden="true" />
          <AlertDescription className="text-ds-accent-2-800">{t('changed')}</AlertDescription>
        </Alert>
      )}
      {current && booking.cancelledAt && (
        <Alert className="border-ds-neutral-400 bg-ds-surface">
          <AlertDescription>{t('cancelled')}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3 rounded-lg bg-ds-surface px-4 py-3">
        {current ? (
          <dl className="flex flex-col divide-y">
            <Fact label={t('status')}>{status(current)}</Fact>
            <Fact label={t('sheetNumber')}>{current.sheetNumber ?? <span className="text-ds-neutral-700">–</span>}</Fact>
            <Fact label={t('marketing')}>{current.marketingConsent ? t('marketingYes') : t('marketingNo')}</Fact>
          </dl>
        ) : (
          <p>{t('none')}</p>
        )}
        {blocked && !current && expected && <p className="text-sm text-ds-neutral-800">{t(`blocked.${blocked}`)}</p>}
        <GuestSheetButtons
          bookingId={booking.id}
          current={current ? { id: current.id, pdfHref: guestSheetPdfHref(current.id) } : null}
          canSign={expected && !blocked}
          canUpload={expected}
          sheetNumber={booking.guestSheetNumber}
          canConsent={Boolean(booking.guest && !booking.guest.anonymized)}
        />
      </div>
      {previous.length > 0 && (
        <details className="group rounded-lg bg-ds-surface px-4 py-3">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t('previous', { count: previous.length })}</summary>
          <ul className="flex flex-col divide-y">
            {previous.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  {status(s)}
                  <span className="text-ds-neutral-800"> · {t('replacedAt', { date: formatDate(s.replacedAt ?? s.createdAt) })}</span>
                </span>
                <a
                  href={guestSheetPdfHref(s.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline"
                >
                  <FilePdf size={18} aria-hidden="true" />
                  {t('view')}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-ds-neutral-700 sm:text-sm">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
