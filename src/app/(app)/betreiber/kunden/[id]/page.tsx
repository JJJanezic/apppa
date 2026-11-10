import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { GuestSheetNumberingSections } from '@/components/guest-sheets/numbering/guest-sheet-numbering-sections'
import { InvoiceSettings } from '@/components/invoice-settings/invoice-settings'
import { LetterheadSettings } from '@/components/letterhead/letterhead-settings'
import { OperatorInvitations } from '@/components/operator/operator-invitations'
import { OperatorLog } from '@/components/operator/operator-log'
import { IdReadingSettingsForm } from '@/components/operator/id-reading-settings'
import { OperatorMembers } from '@/components/operator/operator-members'
import { OwnerInvitePanel } from '@/components/operator/owner-invite-panel'
import { TenantDangerZone } from '@/components/operator/tenant-danger-zone'
import { TenantStatusBadge } from '@/components/operator/tenant-status-badge'
import { PageHeader } from '@/components/page-header'
import { EstablishmentNumbersForm } from '@/components/tenant/establishment-numbers-form'
import { TenantMasterDataForm } from '@/components/tenant/tenant-master-data-form'
import { requireArea } from '@/lib/areas'
import { formatDate } from '@/lib/format'
import { loadEstablishmentNumbers, loadSheetNumbering } from '@/lib/guest-sheet-numbering-data'
import { loadIdReadingSettings, loadIdReadingUsage } from '@/lib/id-reading-data'
import { loadInvoiceSettings } from '@/lib/invoice-settings-data'
import { countRetainedInvoices } from '@/lib/invoices-data'
import { loadLetterhead } from '@/lib/letterhead-data'
import { getTenantDetail } from '@/lib/operator-data'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const tenant = await getTenantDetail((await params).id)
  return { title: tenant.name }
}

// Detailseite eines Kunden: Status, Stammdaten (PROJ-28), Kennzahlen und Gästeblattnummern (PROJ-26), Rechnungen (PROJ-39), Mitglieder, Einladungen, Protokoll und Aktionen (PROJ-5)
export default async function TenantDetailPage({ params }: { params: Params }) {
  await requireArea('operator')
  const { id } = await params
  const t = await getTranslations('operator')
  const [tenant, invoiceSettings, letterhead, establishment, numbering, idReading, idReadingUsage] = await Promise.all([
    getTenantDetail(id),
    loadInvoiceSettings(id),
    loadLetterhead(id),
    loadEstablishmentNumbers(id),
    loadSheetNumbering(id),
    loadIdReadingSettings(id),
    loadIdReadingUsage(id),
  ])
  const deactivated = tenant.status === 'deactivated'

  return (
    <>
      <Link
        href="/betreiber"
        className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline"
      >
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={t('createdOn', { date: formatDate(tenant.createdAt) })}
        title={<span className="break-words">{tenant.name}</span>}
      />
      <div className="-mt-6">
        <TenantStatusBadge status={tenant.status} inviteState={tenant.inviteState} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">{t('masterDataTitle')}</h2>
        <TenantMasterDataForm key={tenant.masterData.updatedAt} data={tenant.masterData} mode="operator" readOnly={deactivated} />
      </section>

      <EstablishmentNumbersForm
        key={establishment.items.map((i) => `${i.code}:${i.number ?? ''}`).join('|')}
        tenantId={tenant.id}
        items={establishment.items}
        ready={establishment.ready}
        readOnly={deactivated}
        level={2}
      />

      <LetterheadSettings key={letterhead.updatedAt} data={letterhead} readOnly={deactivated} />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">{t('invoiceSettingsTitle')}</h2>
        <InvoiceSettings tenantId={tenant.id} data={invoiceSettings} level={3} readOnly={deactivated} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">{t('guestSheetSettingsTitle')}</h2>
        <GuestSheetNumberingSections tenantId={tenant.id} data={numbering} level={3} readOnly={deactivated} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">{t('idReadingTitle')}</h2>
        <IdReadingSettingsForm
          key={`${idReading.enabled}:${idReading.dailyLimit}`}
          tenantId={tenant.id}
          settings={idReading}
          usage={idReadingUsage}
          readOnly={deactivated}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">{t('membersTitle')}</h2>
        <OperatorMembers tenantId={tenant.id} members={tenant.members} readOnly={deactivated} />
        {tenant.members.some((m) => m.role === 'staff') && <p className="text-[13px] text-ds-neutral-700">{t('staffHint')}</p>}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">{t('invitationsTitle')}</h2>
          {!deactivated && <OwnerInvitePanel tenantId={tenant.id} />}
        </div>
        <OperatorInvitations tenantId={tenant.id} invitations={tenant.invitations} readOnly={deactivated} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl">{t('logTitle')}</h2>
        <OperatorLog entries={tenant.log} />
      </section>

      <TenantDangerZone tenantId={tenant.id} tenantName={tenant.name} deactivated={deactivated} retainedInvoices={await countRetainedInvoices(tenant.id)} />
    </>
  )
}
