import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { GuestSheetSigning } from '@/components/guest-sheets/signing/guest-sheet-signing'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { bookingHref, todayIso } from '@/lib/bookings'
import { guestSheetExpected } from '@/lib/guest-sheet'
import { getSigningData } from '@/lib/guest-sheets-data'

type Params = Promise<{ id: string }>

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('guestSheets.signing')
  return { title: t('title') }
}

// Gästeblatt einer Buchung zum Unterschreiben (PROJ-26), Vollbild ohne App-Menü, für Inhaber und Mitarbeiter.
// Ist kein Blatt vorgesehen oder fehlt der Gast, erklärt die Seite das und führt zurück zur Buchung.
export default async function GuestSheetSigningPage({ params }: { params: Params }) {
  await requireArea('bookings')
  const { id } = await params
  const [data, locale, t] = await Promise.all([getSigningData(id, await getLocale()), getLocale(), getTranslations('guestSheets.signing')])
  const blocked = !guestSheetExpected(data.booking) ? 'notExpected' : !data.guest ? 'noGuest' : data.guest.anonymized ? 'guestAnonymized' : null

  if (blocked) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
        <h1 className="text-3xl">{t('title')}</h1>
        <p>{t(`blocked.${blocked}`)}</p>
        <Button asChild className="min-h-11 self-start">
          <Link href={bookingHref(data.booking.id)}>{t('backToBooking')}</Link>
        </Button>
      </div>
    )
  }
  return <GuestSheetSigning data={data} locale={locale} today={todayIso()} />
}
