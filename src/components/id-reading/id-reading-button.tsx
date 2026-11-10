'use client'

import { IdentificationCard, SpinnerGap } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { IdReadingDialog } from '@/components/id-reading/id-reading-dialog'
import { useIdReadingEnabled } from '@/components/id-reading/id-reading-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { IdComparison, IdCurrentValues, IdField, IdReadingError, IdReadingPlace, IdReadingResponse } from '@/lib/id-reading'
import { DOCUMENT_UPLOADING } from '@/lib/validation/guests'

interface IdReadingButtonProps {
  tenantId: string | null
  place: IdReadingPlace
  guestId: string | null
  bookingId: string | null
  // Speicherorte der Bilder im Formular (leer, DOCUMENT_UPLOADING oder <Kunde>/<zufällig>.jpg)
  frontPath: string
  backPath: string
  // aktueller Stand der Felder beim Klick (auch ungespeichert)
  current: () => IdCurrentValues
  // readingId: Kennung der Auslesung, Nachweis für den Vermerk im Änderungsprotokoll
  onApply: (values: Partial<Record<IdField, string>>, readingId: string) => void
}

// Höchstens so lange auf die Antwort warten (der Server bricht nach 50 Sekunden ab)
const TIMEOUT_MS = 60_000

const realPath = (p: string) => Boolean(p) && p !== DOCUMENT_UPLOADING

// Knopf „Ausweis auslesen“ (PROJ-51): nur bei eingeschalteter Funktion und mindestens einem Ausweisbild. Liest Vorder- und
// Rückseite in einem Durchgang und öffnet die Gegenüberstellung; bei Fehlern bleibt alles von Hand bearbeitbar.
export function IdReadingButton({ tenantId, place, guestId, bookingId, frontPath, backPath, current, onApply }: IdReadingButtonProps) {
  const t = useTranslations('idReading')
  const enabled = useIdReadingEnabled()
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<IdReadingError | null>(null)
  const [comparison, setComparison] = useState<IdComparison | null>(null)
  const [readingId, setReadingId] = useState<string | null>(null)

  if (!enabled || !tenantId || (!realPath(frontPath) && !realPath(backPath))) return null
  const uploading = frontPath === DOCUMENT_UPLOADING || backPath === DOCUMENT_UPLOADING

  async function read() {
    setError(null)
    setReading(true)
    try {
      const response = await fetch('/api/ausweis/auslesen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          tenantId,
          place,
          guestId,
          bookingId,
          frontPath: realPath(frontPath) ? frontPath : null,
          backPath: realPath(backPath) ? backPath : null,
          current: current(),
        }),
      })
      const body = (await response.json().catch(() => null)) as IdReadingResponse | null
      if (body?.ok) {
        setComparison(body.comparison)
        setReadingId(body.readingId)
      }
      else setError(body?.error ?? 'unavailable')
    } catch {
      setError('unavailable')
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="min-h-11" disabled={reading || uploading} onClick={() => void read()}>
          {reading ? (
            <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <IdentificationCard size={18} aria-hidden="true" />
          )}
          {reading ? t('reading') : t('button')}
        </Button>
        <span className="text-[13px] text-ds-neutral-700">{t('experimental')}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {reading ? t('reading') : ''}
      </p>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      )}
      <IdReadingDialog
        comparison={comparison}
        onClose={() => setComparison(null)}
        onApply={(values) => {
          if (readingId) onApply(values, readingId)
          setComparison(null)
        }}
      />
    </div>
  )
}
