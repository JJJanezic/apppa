import { getRequestConfig } from 'next-intl/server'

import { LOCALE, TIME_ZONE } from '@/lib/locale'

// Nur Deutsch (de-AT), ohne Sprachkürzel in der Adresse. Weitere Sprachen: messages/<sprache>.json (PROJ-23).
export default getRequestConfig(async () => ({
  locale: LOCALE,
  timeZone: TIME_ZONE,
  messages: (await import('../../messages/de.json')).default,
}))
