import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'

import { OperatorInvitations } from '@/components/operator/operator-invitations'
import { OperatorLog } from '@/components/operator/operator-log'
import { OperatorMembers } from '@/components/operator/operator-members'
import { OwnerInvitePanel } from '@/components/operator/owner-invite-panel'
import { TenantDangerZone } from '@/components/operator/tenant-danger-zone'
import { TenantStatusBadge } from '@/components/operator/tenant-status-badge'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { getTenantDetail } from '@/lib/operator-data'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const tenant = await getTenantDetail((await params).id)
  return { title: tenant.name }
}

// Detailseite eines Kunden: Status, Mitglieder, Einladungen, Protokoll und Aktionen (PROJ-5)
export default async function TenantDetailPage({ params }: { params: Params }) {
  await requireArea('operator')
  const { id } = await params
  const t = await getTranslations('operator')
  const format = await getFormatter()
  const tenant = await getTenantDetail(id)
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
        eyebrow={t('createdOn', { date: format.dateTime(new Date(tenant.createdAt), { day: 'numeric', month: 'long', year: 'numeric' }) })}
        title={<span className="break-words">{tenant.name}</span>}
      />
      <div className="-mt-6">
        <TenantStatusBadge status={tenant.status} inviteState={tenant.inviteState} />
      </div>

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

      <TenantDangerZone tenantId={tenant.id} tenantName={tenant.name} deactivated={deactivated} />
    </>
  )
}
