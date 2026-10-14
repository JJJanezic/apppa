'use client'

import { useEffect } from 'react'

import messages from '../../messages/de.json'
import './globals.css'

// Letzte Rückfallebene, wenn das oberste Layout selbst scheitert (z. B. Texte oder Umgebung nicht ladbar).
// Ersetzt das ganze Dokument; Texte direkt aus messages/de.json, weil next-intl hier nicht verfügbar ist.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="de-AT">
      <body className="bg-ds-bg font-serif text-ds-text">
        <main className="flex min-h-svh items-center justify-center px-4">
          <section role="alert" className="flex max-w-md flex-col items-start gap-3">
            <h1 className="text-[34px] leading-tight">{messages.errors.title}</h1>
            <p className="text-ds-neutral-800">{messages.errors.text}</p>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-ds-accent-800"
            >
              {messages.common.retry}
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
