'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// Rückfrage beim Verlassen einer Seite mit ungespeicherten Änderungen (PROJ-40, Seite „Rechnung erstellen“):
// Neu laden, Schließen und Adresseingabe über die Browser-Rückfrage; Klicks auf Links innerhalb der App über eine
// eigene Rückfrage (pendingHref → Dialog). leave() navigiert ohne Rückfrage (Abbrechen nach Bestätigung, Speichern).
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  // Stand für die Ereignis-Handler (Refs nur in Effekten und Handlern lesen/schreiben)
  const dirtyRef = useRef(dirty)
  const released = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    const active = () => dirtyRef.current && !released.current
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!active()) return
      e.preventDefault()
      e.returnValue = ''
    }
    // Erfassungsphase: vor dem Link-Handler von Next.js
    const click = (e: MouseEvent) => {
      if (!active() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Sprungmarke auf derselben Seite
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(`${url.pathname}${url.search}${url.hash}`)
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', click, true)
    }
  }, [])

  const leave = (href: string) => {
    released.current = true
    setPendingHref(null)
    router.push(href)
  }

  // Speichern: die Aktion leitet selbst weiter, ohne Rückfrage; schlägt es fehl, gilt die Rückfrage wieder (release(false))
  const release = (on = true) => {
    released.current = on
  }

  return { pendingHref, cancelLeave: () => setPendingHref(null), leave, release }
}
