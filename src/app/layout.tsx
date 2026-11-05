import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'

import { AppToaster } from '@/components/app-toaster'
import './globals.css'

// Schrift liegt im Projekt (src/app/fonts): keine Verbindung zu Google, weder beim Bauen noch beim Seitenaufruf.
// Früher next/font/google; das ließ den Build zeitweise scheitern, wenn Google die Schrift-Adressen anders lieferte.
const appSerif = localFont({
  src: [
    { path: './fonts/SourceSerif4-App.woff2', weight: '400 600', style: 'normal' },
    { path: './fonts/SourceSerif4-App-Italic.woff2', weight: '400 600', style: 'italic' },
  ],
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
    <html lang="de-AT" className={appSerif.variable}>
      <body>
        <NextIntlClientProvider>
          {children}
          <AppToaster />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
