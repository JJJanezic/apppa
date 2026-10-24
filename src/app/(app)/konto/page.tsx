import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ChangePasswordForm } from '@/components/account/change-password-form'
import { LeaveTenant } from '@/components/account/leave-tenant'
import { DisplayNameForm } from '@/components/account/display-name-form'
import { MfaDevices } from '@/components/account/mfa-devices'
import { SignOutEverywhere } from '@/components/account/sign-out-everywhere'
import { PageHeader } from '@/components/page-header'
import { getAccountInfo } from '@/lib/account'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account')
  return { title: t('title') }
}

// Mein Konto: Profil, Passwort, 2FA-Geräte (nur Admin), gewählten Kunden verlassen (PROJ-4), Abmelden auf allen Geräten
export default async function AccountPage() {
  const t = await getTranslations('account')
  const tRoles = await getTranslations('roles')
  const [account, { active }] = await Promise.all([getAccountInfo(), getTenantContext()])
  // Letzter Inhaber darf nicht austreten (die Datenbank verweigert es zusätzlich)
  let lastOwner = false
  if (active?.role === 'owner') {
    const supabase = await createClient()
    const { count } = await supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', active.id)
      .eq('role', 'owner')
    lastOwner = (count ?? 0) <= 1
  }

  return (
    <>
      <PageHeader title={t('title')} lead={t('lead')} />
      <div className="flex max-w-[640px] flex-col gap-12">
        <AccountSection title={t('profileTitle')}>
          <DisplayNameForm email={account.email} displayName={account.displayName} />
        </AccountSection>
        <AccountSection title={t('passwordTitle')} intro={t('passwordIntro')}>
          <ChangePasswordForm email={account.email} />
        </AccountSection>
        {account.isOperatorAdmin && (
          <AccountSection title={t('mfaTitle')} intro={t('mfaIntro')}>
            <MfaDevices devices={account.mfaDevices} />
          </AccountSection>
        )}
        {active && (
          <AccountSection
            title={t('leaveTenantTitle')}
            intro={t('leaveTenantIntro', { tenant: active.name, role: tRoles(active.role) })}
          >
            <LeaveTenant tenantName={active.name} lastOwner={lastOwner} />
          </AccountSection>
        )}
        <AccountSection title={t('sessionsTitle')} intro={t('sessionsIntro')}>
          <SignOutEverywhere />
        </AccountSection>
      </div>
    </>
  )
}

function AccountSection({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl">{title}</h2>
        {intro && <p className="text-ds-neutral-800">{intro}</p>}
      </div>
      {children}
    </section>
  )
}
