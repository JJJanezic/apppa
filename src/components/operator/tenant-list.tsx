'use client'

import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { TenantStatusBadge } from '@/components/operator/tenant-status-badge'
import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/format'
import { type OwnerSummary, tenantHref, type TenantPage, type TenantRow } from '@/lib/operator'

// Kundenliste: ab 768 px Tabelle (Name als Link), darunter Karten
export function TenantList({ page }: { page: TenantPage }) {
  const t = useTranslations('operator')

  const owners = (row: TenantRow) =>
    row.owners.length === 0 ? (
      <span className="text-ds-neutral-700">{t('noOwner')}</span>
    ) : (
      <span className="flex flex-col gap-0.5">
        {row.owners.map((owner) => (
          <OwnerLine key={owner.email} owner={owner} invited={row.memberCount === 0} />
        ))}
      </span>
    )
  const lastSignIn = (row: TenantRow) =>
    row.lastSignInAt ? formatDateTime(row.lastSignInAt) : <span className="text-ds-neutral-700">{t('never')}</span>

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colStatus')}</TableHead>
            <TableHead>{t('colOwner')}</TableHead>
            <TableHead className="text-right">{t('colMembers')}</TableHead>
            <TableHead>{t('colCreated')}</TableHead>
            <TableHead>{t('colLastSignIn')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {/* Nur der Name ist der Link: Safari kann Klickflächen über die ganze Zeile (after:inset-0) nicht an <tr> verankern */}
                <Link
                  href={tenantHref(row.id)}
                  className="text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2"
                >
                  {row.name}
                </Link>
                {row.city && <span className="block text-[13px] font-normal text-ds-neutral-700">{row.city}</span>}
              </TableCell>
              <TableCell>
                <TenantStatusBadge status={row.status} inviteState={row.inviteState} />
              </TableCell>
              <TableCell className="max-w-[320px]">{owners(row)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.memberCount}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(row.createdAt)}</TableCell>
              <TableCell className="whitespace-nowrap">{lastSignIn(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((row) => (
          <li key={row.id}>
            <Link
              href={tenantHref(row.id)}
              className="flex flex-col gap-2 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="break-words text-lg font-semibold">{row.name}</span>
                  {row.city && <span className="text-[13px] text-ds-neutral-700">{row.city}</span>}
                </span>
                <TenantStatusBadge status={row.status} inviteState={row.inviteState} />
              </span>
              <span className="text-sm">{owners(row)}</span>
              <span className="text-[13px] text-ds-neutral-700">
                {t('members', { count: row.memberCount })} · {t('lastSignIn', { date: row.lastSignInAt ? formatDate(row.lastSignInAt) : t('never') })}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {page.pageCount > 1 && <TenantPagination page={page} />}
    </div>
  )
}

function OwnerLine({ owner, invited }: { owner: OwnerSummary; invited: boolean }) {
  const t = useTranslations('operator')
  return (
    <span className="min-w-0 break-all">
      {owner.name && <span className="font-medium">{owner.name} · </span>}
      <span className="text-ds-neutral-800">{owner.email}</span>
      {invited && <span className="text-ds-neutral-700"> ({t('invitedOwner')})</span>}
    </span>
  )
}

function TenantPagination({ page }: { page: TenantPage }) {
  const t = useTranslations('operator')
  const href = (n: number) => {
    const params = new URLSearchParams()
    if (page.query) params.set('q', page.query)
    if (n > 1) params.set('seite', String(n))
    const search = params.toString()
    return search ? `/betreiber?${search}` : '/betreiber'
  }

  return (
    <Pagination aria-label={t('pagination')}>
      <PaginationContent className="gap-3">
        <PaginationItem>
          {page.page > 1 ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={href(page.page - 1)}>
                <CaretLeft size={16} aria-hidden="true" />
                {t('previous')}
              </Link>
            </Button>
          ) : (
            <Button variant="outline" className="min-h-11" disabled>
              <CaretLeft size={16} aria-hidden="true" />
              {t('previous')}
            </Button>
          )}
        </PaginationItem>
        <PaginationItem className="text-sm text-ds-neutral-800" aria-current="page">
          {t('pageOf', { page: page.page, pageCount: page.pageCount })}
        </PaginationItem>
        <PaginationItem>
          {page.page < page.pageCount ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={href(page.page + 1)}>
                {t('next')}
                <CaretRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" className="min-h-11" disabled>
              {t('next')}
              <CaretRight size={16} aria-hidden="true" />
            </Button>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
