'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// Ziel „Zurück im Browserverlauf“ für pendingHref/leave (Zurück-Taste, Wischgeste)
export const HISTORY_BACK = '__zurueck__'

// Rückfrage beim Verlassen einer Seite mit ungespeicherten Änderungen (PROJ-40, Seite „Rechnung erstellen“):
// Neu laden, Schließen und Adresseingabe über die Browser-Rückfrage; Klicks auf Links innerhalb der App über eine
// eigene Rückfrage (pendingHref → Dialog). leave() navigiert ohne Rückfrage (Abbrechen nach Bestätigung, Speichern).
// Zurück-Taste (QA BUG-1): Sobald Änderungen vorliegen, steht ein zweiter Verlaufseintrag derselben Seite (gleicher
// Zustand des App-Routers) vor der Seite. „Zurück“ landet zuerst dort – die Seite bleibt, die Rückfrage erscheint.
// „Weiter bearbeiten“ legt den Eintrag neu an, „Verwerfen“ geht einen weiteren Schritt zurück.
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  // Stand für die Ereignis-Handler (Refs nur in Effekten und Handlern lesen/schreiben)
  const dirtyRef = useRef(dirty)
  const released = useRef(false)
  // Zusatzeintrag im Verlauf angelegt und noch nicht verbraucht
  const armed = useRef(false)

  const arm = () => {
    if (armed.current) return
    window.history.pushState(window.history.state, '', window.location.href)
    armed.current = true
  }

  useEffect(() => {
    dirtyRef.current = dirty
    if (dirty && !released.current) arm()
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
    // Zurück auf den Zusatzeintrag: dieselbe Seite, der App-Router stellt denselben Stand her
    const popState = () => {
      if (!armed.current) return
      armed.current = false
      if (active()) setPendingHref(HISTORY_BACK)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('popstate', popState)
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('popstate', popState)
      document.removeEventListener('click', click, true)
    }
  }, [])

  const leave = (href: string) => {
    released.current = true
    setPendingHref(null)
    if (href === HISTORY_BACK) {
      // Der Zusatzeintrag ist schon verbraucht: ein Schritt zurück verlässt die Seite
      window.history.back()
      return
    }
    router.push(href)
  }

  // „Weiter bearbeiten“: nach „Zurück“ den Zusatzeintrag neu anlegen
  const cancelLeave = () => {
    setPendingHref(null)
    if (dirtyRef.current && !released.current) arm()
  }

  // Speichern: die Aktion leitet selbst weiter, ohne Rückfrage; schlägt es fehl, gilt die Rückfrage wieder (release(false))
  const release = (on = true) => {
    released.current = on
  }

  return { pendingHref, cancelLeave, leave, release }
}
