'use client'

import { CheckCircle, Circle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { PASSWORD_RULES } from '@/lib/validation/auth'
import { cn } from '@/lib/utils'

interface PasswordRulesProps {
  value: string
  id?: string
}

// Passwortregeln, schon vor der Eingabe sichtbar; erfüllte Regeln werden markiert
export function PasswordRules({ value, id }: PasswordRulesProps) {
  const t = useTranslations('auth')
  return (
    <div id={id} className="text-[13px] text-ds-neutral-700">
      <p>{t('rulesTitle')}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value)
          return (
            <li key={rule.key} className={cn('flex items-center gap-1.5', met && 'text-ds-accent-700')}>
              {met ? (
                <CheckCircle size={16} weight="duotone" aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              <span>{t(`rules.${rule.key}`)}</span>
              <span className="sr-only">: {met ? t('ruleMet') : t('ruleMissing')}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
