'use client'

import { Eraser } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import SignaturePad, { type PointGroup } from 'signature_pad'

import { Button } from '@/components/ui/button'
import { SIGNATURE_MIN_LENGTH } from '@/lib/guest-sheet'
import { cn } from '@/lib/utils'

export type SignatureValue = { image: string; signedAt: string } | null

interface SignatureFieldProps {
  id: string
  label: string
  value: SignatureValue
  onChange: (value: SignatureValue) => void
  // gesperrt: Fläche nimmt nichts an (z. B. Pflichtangaben fehlen); hint erklärt warum
  disabled?: boolean
  hint?: string
}

// Länge aller Striche in CSS-Pixeln; ein Punkt oder Tupfer ist keine Unterschrift
function strokeLength(groups: PointGroup[]): number {
  let total = 0
  for (const g of groups) {
    for (let i = 1; i < g.points.length; i++) total += Math.hypot(g.points[i].x - g.points[i - 1].x, g.points[i].y - g.points[i - 1].y)
  }
  return total
}

// Unterschriftsfeld des Gästeblatts (PROJ-26): Stift, Finger und Maus über signature_pad. Während des Schreibens scrollt
// und zoomt die Seite nicht (touch-action: none). Ergebnis ist ein PNG mit transparentem Hintergrund und der Zeitpunkt.
// Bei Größenänderung (Drehen des Tablets) bleibt die Unterschrift erhalten.
export function SignatureField({ id, label, value, onChange, disabled = false, hint }: SignatureFieldProps) {
  const t = useTranslations('guestSheets.signing')
  const canvas = useRef<HTMLCanvasElement>(null)
  const pad = useRef<SignaturePad | null>(null)
  const strokes = useRef<PointGroup[]>([])
  const change = useRef(onChange)
  useEffect(() => {
    change.current = onChange
  })

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const p = new SignaturePad(el, { minWidth: 0.8, maxWidth: 2.6, penColor: '#14213d', backgroundColor: 'rgba(0,0,0,0)' })
    pad.current = p
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      el.width = el.offsetWidth * ratio
      el.height = el.offsetHeight * ratio
      el.getContext('2d')?.scale(ratio, ratio)
      p.clear()
      if (strokes.current.length) p.fromData(strokes.current)
    }
    const onEnd = () => {
      strokes.current = p.toData()
      if (strokeLength(strokes.current) < SIGNATURE_MIN_LENGTH) change.current(null)
      else change.current({ image: p.toDataURL('image/png'), signedAt: new Date().toISOString() })
    }
    p.addEventListener('endStroke', onEnd)
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    return () => {
      observer.disconnect()
      p.removeEventListener('endStroke', onEnd)
      p.off()
    }
  }, [])

  // Von außen geleert (z. B. Seite 1 geändert): Fläche leeren
  useEffect(() => {
    if (value === null && pad.current && strokes.current.length) {
      strokes.current = []
      pad.current.clear()
    }
  }, [value])

  useEffect(() => {
    if (!pad.current) return
    if (disabled) pad.current.off()
    else pad.current.on()
  }, [disabled])

  const hintId = `${id}-hint`
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </span>
      <div className={cn('relative rounded-lg border-2 border-dashed bg-white', disabled ? 'border-ds-neutral-400 opacity-60' : 'border-ds-accent-700')}>
        <canvas
          ref={canvas}
          id={id}
          role="img"
          aria-labelledby={`${id}-label`}
          aria-describedby={hint ? hintId : undefined}
          className="block h-44 w-full touch-none select-none sm:h-52"
        />
        {/* Grundlinie wie auf Papier */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-ds-neutral-400" />
        {!value && !disabled && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-ds-neutral-600">
            {t('signHere')}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={hintId} className="text-sm text-ds-neutral-800" aria-live="polite">
          {hint ?? (value ? t('signed') : t('notSigned'))}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!value}
          onClick={() => {
            strokes.current = []
            pad.current?.clear()
            onChange(null)
          }}
        >
          <Eraser size={18} aria-hidden="true" />
          {t('clearSignature')}
        </Button>
      </div>
    </div>
  )
}
