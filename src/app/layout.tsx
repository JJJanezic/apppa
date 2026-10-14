import type { Metadata } from 'next'
import { Source_Serif_4 } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import { AppToaster } from '@/components/app-toaster'
import './globals.css'

// Schrift wird beim Bauen mitgeliefert: keine Verbindung zu Google beim Seitenaufruf, keine Layout-Sprünge
const sourceSerif = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-source-serif',
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app')
  return {
    title: { default: t('name'), template: `%s · ${t('name')}` },
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de-AT" className={sourceSerif.variable}>
      <body>
        <NextIntlClientProvider>
          {children}
          <AppToaster />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
