import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { BookingList } from '@/components/bookings/booking-list'
import { CompanyActions } from '@/components/companies/company-actions'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { requireArea } from '@/lib/areas'
import { COMPANY_BOOKING_LIMIT } from '@/lib/bookings-data'
import { COMPANY_LIST, companyAddress, websiteHref } from '@/lib/companies'
import { COMPANY_INVOICE_LIMIT, getCompany, getCompanyBookingRows, getCompanyGuests, getCompanyInvoicePage } from '@/lib/companies-data'
import { countryName, guestHref, guestSortName } from '@/lib/guests'
import { getTenantContext } from '@/lib/tenant'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: (await getCompany((await params).id)).name }
}

// Firmendetail (PROJ-50): Angaben, verknüpfte Gäste, ihre Buchungen und die Rechnungen an die Firma für alle Mitglieder;
// Bearbeiten, Zusammenführen und Löschen nur für Inhaber
export default async function CompanyDetailPage({ params }: { params: Params }) {
  await requireArea('guests')
  const { id } = await params
  const t = await getTranslations('companies')
  const locale = await getLocale()
  const [company, guests, bookings, invoices] = await Promise.all([getCompany(id), getCompanyGuests(id), getCompanyBookingRows(id), getCompanyInvoicePage(id)])
  const { active } = await getTenantContext()
  const isOwner = active?.role === 'owner'
  const missing = <span className="text-ds-neutral-700">{t('detail.missing')}</span>
  const address = companyAddress(company, locale)
  const website = company.website ? websiteHref(company.website) : null

  return (
    <>
      <Link href={COMPANY_LIST} className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={[company.vatId, company.country ? countryName(company.country, locale) : null].filter(Boolean).join(' · ') || undefined}
        title={
          <span className="flex flex-wrap items-center gap-3 break-words">
            {company.name}
            {company.nameMissing && (
              <Badge variant="secondary" className="text-sm font-normal">
                {t('list.nameMissing')}
              </Badge>
            )}
          </span>
        }
      />
      {isOwner && (
        <div className="-mt-4">
          <CompanyActions company={company} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">{t('detail.data')}</h2>
          <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
            <Fact label={t('detail.vatId')}>{company.vatId ?? missing}</Fact>
            <Fact label={t('detail.billingAddress')}>
              {address.length ? (
                <span className="flex flex-col">
                  {address.map((line) => (
                    <span key={line} className="break-words">
                      {line}
                    </span>
                  ))}
                </span>
              ) : (
                missing
              )}
            </Fact>
            <Fact label={t('detail.email')}>
              {company.email ? (
                <a href={`mailto:${company.email}`} className="break-all text-ds-accent-700 underline-offset-[3px] hover:underline">
                  {company.email}
                </a>
              ) : (
                missing
              )}
            </Fact>
            <Fact label={t('detail.website')}>
              {company.website ? (
                website ? (
                  <a href={website} target="_blank" rel="noopener noreferrer" className="break-all text-ds-accent-700 underline-offset-[3px] hover:underline">
                    {company.website}
                  </a>
                ) : (
                  <span className="break-all">{company.website}</span>
                )
              ) : (
                missing
              )}
            </Fact>
            <Fact label={t('detail.contact')}>{company.contact ? <span className="break-words">{company.contact}</span> : missing}</Fact>
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">{t('detail.guests', { count: guests.length })}</h2>
          {guests.length === 0 ? (
            <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('detail.guestsEmpty')}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
              {guests.map((g) => (
                <li key={g.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2">
                  <Link href={guestHref(g.id)} className="break-words font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                    {guestSortName(g)}
                  </Link>
                  <span className="text-[13px] text-ds-neutral-700">{countryName(g.country, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t('detail.bookings')}</h2>
        {bookings.length === 0 ? (
          <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('detail.bookingsEmpty')}</p>
        ) : (
          <>
            <BookingList rows={bookings} showAmounts={isOwner} />
            {bookings.length >= COMPANY_BOOKING_LIMIT && <p className="text-sm text-ds-neutral-700">{t('detail.limited', { count: COMPANY_BOOKING_LIMIT })}</p>}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t('detail.invoices')}</h2>
        <p className="-mt-1 text-sm text-ds-neutral-700">{t('detail.invoicesHint')}</p>
        {invoices.rows.length === 0 ? (
          <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('detail.invoicesEmpty')}</p>
        ) : (
          <>
            <InvoiceList page={invoices} />
            {invoices.limited && <p className="text-sm text-ds-neutral-700">{t('detail.limited', { count: COMPANY_INVOICE_LIMIT })}</p>}
          </>
        )}
      </section>
    </>
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
