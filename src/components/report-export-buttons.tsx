'use client'

import { FileCsv, FilePdf, SpinnerGap } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

type Kind = 'pdf' | 'csv'

interface ReportExportButtonsProps {
  // Download-Adressen mit den Filtern der Seite
  hrefs: Record<Kind, string>
  // Texte des Berichts (Beschriftung, Fehlermeldung)
  namespace: 'touristTaxReport.export' | 'statistics.export'
  // Dateinamen, falls der Server keinen mitschickt
  fileNames: Record<Kind, string>
  disabled: boolean
}

// Dateiname aus „Content-Disposition“ (filename* bevorzugt)
function fileNameFrom(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      return null
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? null
}

// Export-Knöpfe der Berichte (Ortstaxe PROJ-16, Auswertungen PROJ-18): laden PDF bzw. CSV im Hintergrund und speichern
// die Datei. Scheitert das, erscheint eine Meldung; der Bericht bleibt sichtbar.
export function ReportExportButtons({ hrefs, namespace, fileNames, disabled }: ReportExportButtonsProps) {
  const t = useTranslations(namespace)
  const [busy, setBusy] = useState<Kind | null>(null)
  const [failed, setFailed] = useState(false)

  async function download(kind: Kind) {
    setBusy(kind)
    setFailed(false)
    try {
      const res = await fetch(hrefs[kind], { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileNameFrom(res.headers.get('content-disposition')) ?? fileNames[kind]
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  const icon = (kind: Kind) =>
    busy === kind ? (
      <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
    ) : kind === 'pdf' ? (
      <FilePdf size={18} weight="duotone" aria-hidden="true" />
    ) : (
      <FileCsv size={18} weight="duotone" aria-hidden="true" />
    )

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div role="group" aria-label={t('label')} className="flex flex-wrap gap-2">
        {(['pdf', 'csv'] as const).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled || busy !== null}
            aria-label={t(`${kind}Label`)}
            title={disabled ? t('disabled') : undefined}
            aria-busy={busy === kind}
            onClick={() => download(kind)}
          >
            {icon(kind)}
            {busy === kind ? t('busy') : t(kind)}
          </Button>
        ))}
      </div>
      <p role="alert" className="text-sm text-destructive empty:hidden">
        {failed ? t('failed') : ''}
      </p>
    </div>
  )
}
