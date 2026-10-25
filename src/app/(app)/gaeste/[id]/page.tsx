import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { GuestActions } from '@/components/guests/guest-actions'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { requireArea } from '@/lib/areas'
import { formatNumber } from '@/lib/format'
import { countryName, type Guest, guestDisplayName, languageName } from '@/lib/guests'
import { getGuest } from '@/lib/guests-data'
import { getTenantContext } from '@/lib/tenant'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: guestDisplayName(await getGuest((await params).id)) }
}

const LONG_DATE = { day: 'numeric', month: 'long', year: 'numeric' } as const

// Gast-Detail (PROJ-7): Stammdaten und Aufenthalte für alle Mitglieder, Aktionen nur für Inhaber
export default async function GuestDetailPage({ params }: { params: Params }) {
  await requireArea('guests')
  const { id } = await params
  const t = await getTranslations('guests')
  const format = await getFormatter()
  const locale = await getLocale()
  const guest = await getGuest(id)
  const { active } = await getTenantContext()
  const isOwner = active?.role === 'owner'
  // Datum ohne Uhrzeit: mittags erzeugen, damit die Zeitzone den Tag nicht verschiebt
  const date = (iso: string) => format.dateTime(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso), LONG_DATE)
  const missing = <span className="text-ds-neutral-700">{t('detail.missing')}</span>
  const platform = (source: Guest['emailSource']) =>
    source === 'platform' ? (
      <Badge variant="secondary" className="ml-2 font-normal">
        {t('detail.fromPlatform')}
      </Badge>
    ) : null
  const address = [guest.street, [guest.postalCode, guest.city].filter(Boolean).join(' '), guest.addressCountry && countryName(guest.addressCountry, locale)]
    .filter(Boolean)
  const marketing = guest.marketingSource ? t(`marketing.${guest.marketingSource}`) : guest.marketingCustom
  const hasCompany = Boolean(guest.companyName || guest.companyVatId || guest.companyBillingAddress)

  return (
    <>
      <Link href="/gaeste" className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={[guest.companyName, countryName(guest.country, locale)].filter(Boolean).join(' · ')}
        title={<span className="break-words">{guestDisplayName(guest)}</span>}
      />

      {guest.anonymizedAt ? (
        <Alert className="-mt-4 max-w-2xl border-ds-neutral-400 bg-ds-surface">
          <AlertDescription>{t('detail.anonymizedNote', { date: date(guest.anonymizedAt) })}</AlertDescription>
        </Alert>
      ) : (
        isOwner && (
          <div className="-mt-4">
            <GuestActions guest={guest} />
          </div>
        )
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <DetailSection title={t('detail.contact')}>
          <Fact label={t('detail.email')}>
            {guest.email ? (
              <>
                <a href={`mailto:${guest.email}`} className="break-all text-ds-accent-700 underline-offset-[3px] hover:underline">
                  {guest.email}
                </a>
                {platform(guest.emailSource)}
              </>
            ) : (
              missing
            )}
          </Fact>
          <Fact label={t('detail.phone')}>
            {guest.phone ? (
              <>
                <a href={`tel:${guest.phone.replace(/[^\d+]/g, '')}`} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
                  {guest.phone}
                </a>
                {platform(guest.phoneSource)}
              </>
            ) : (
              missing
            )}
          </Fact>
          <Fact label={t('detail.language')}>{guest.language ? languageName(guest.language, locale) : missing}</Fact>
          <Fact label={t('detail.country')}>{countryName(guest.country, locale)}</Fact>
          <Fact label={t('detail.address')}>
            {address.length ? (
              <span className="flex flex-col">
                {address.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            ) : (
              missing
            )}
          </Fact>
        </DetailSection>

        {guest.stays.count === 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-2xl">{t('detail.stays')}</h2>
            <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('detail.staysEmpty')}</p>
          </section>
        ) : (
          <DetailSection title={t('detail.stays')}>
            <Fact label={t('detail.staysCount')}>{formatNumber(guest.stays.count)}</Fact>
            <Fact label={t('detail.lastStay')}>{guest.stays.last ? date(guest.stays.last) : missing}</Fact>
            <Fact label={t('detail.nextStay')}>{guest.stays.next ? date(guest.stays.next) : missing}</Fact>
            <Fact label={t('detail.channels')}>{guest.stays.channels.join(', ') || missing}</Fact>
          </DetailSection>
        )}

        <DetailSection title={t('detail.more')}>
          <Fact label={t('detail.marketing')}>{marketing ?? missing}</Fact>
          <Fact label={t('detail.birthDate')}>{guest.birthDate ? date(guest.birthDate) : missing}</Fact>
          <Fact label={t('detail.note')}>{guest.note ? <span className="whitespace-pre-line break-words">{guest.note}</span> : missing}</Fact>
        </DetailSection>

        {hasCompany && (
          <DetailSection title={t('detail.company')}>
            <Fact label={t('detail.companyName')}>{guest.companyName ?? missing}</Fact>
            <Fact label={t('detail.vatId')}>{guest.companyVatId ?? missing}</Fact>
            <Fact label={t('detail.billingAddress')}>
              {guest.companyBillingAddress ? <span className="whitespace-pre-line">{guest.companyBillingAddress}</span> : missing}
            </Fact>
          </DetailSection>
        )}
      </div>
    </>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
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
