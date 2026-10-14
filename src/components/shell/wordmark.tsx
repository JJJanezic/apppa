import { getTranslations } from 'next-intl/server'

// Wortmarke „apppa.“ – Name zentral in messages/de.json (app.name)
export async function Wordmark() {
  const t = await getTranslations('app')
  return (
    <span className="font-serif text-[28px] font-semibold leading-none tracking-[-0.02em]">
      {t('name')}
      <span className="text-ds-accent-2" aria-hidden="true">
        .
      </span>
    </span>
  )
}
