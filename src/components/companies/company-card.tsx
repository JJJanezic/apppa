'use client'

import { Buildings } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { companyDetailLine, type CompanyRow } from '@/lib/companies'

type CardCompany = Pick<CompanyRow, 'name' | 'nameMissing' | 'vatId' | 'postalCode' | 'city' | 'addressLine1'>

interface CompanyCardProps {
  company: CardCompany
  // „Ändern“: andere bestehende Firma suchen
  onChange: () => void
  disabled?: boolean
}

// Gewählte Firma im Gastformular (PROJ-50): nur zum Lesen, Pflege im Reiter „Firmen“
export function CompanyCard({ company, onChange, disabled }: CompanyCardProps) {
  const t = useTranslations('companies.card')
  const detail = companyDetailLine(company)
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-ds-surface p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Buildings size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-ds-neutral-700" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words font-semibold">{company.name}</span>
            {company.nameMissing && (
              <Badge variant="secondary" className="font-normal">
                {t('nameMissing')}
              </Badge>
            )}
          </span>
          {detail && <span className="break-words text-[13px] text-ds-neutral-800">{detail}</span>}
          <span className="text-[13px] text-ds-neutral-700">{t('readOnlyHint')}</span>
        </div>
      </div>
      <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={onChange} disabled={disabled}>
        {t('change')}
      </Button>
    </div>
  )
}
