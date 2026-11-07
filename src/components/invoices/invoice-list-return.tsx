'use client'

import { CaretLeft } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useSyncExternalStore } from 'react'

// Rückweg zur zuletzt gefilterten Rechnungsliste (PROJ-43). Die Liste merkt sich ihre Adresse im Speicher des Browser-Tabs;
// „Zurück zur Liste“ (Detail) und „Abbrechen“ im Entwurf aus der Liste lesen sie. Fehlt sie (neuer Tab, privates Fenster,
// gesperrter Speicher), gilt die ungefilterte Liste. Der Menüpunkt „Rechnungen“ nutzt das nicht und beginnt immer leer.

const KEY = 'rechnungen.liste'
const LIST = '/rechnungen'

// Nur Adressen der Rechnungsliste übernehmen, nie fremde Ziele
const isListHref = (value: string | null): value is string => Boolean(value && (value === LIST || value.startsWith(`${LIST}?`)))

export function readInvoiceListHref(): string {
  try {
    const value = window.sessionStorage.getItem(KEY)
    return isListHref(value) ? value : LIST
  } catch {
    return LIST
  }
}

// In der Liste eingebunden: merkt sich die aktuelle Adresse (Filter, Suche, Seite)
export function RememberInvoiceList({ href }: { href: string }) {
  useEffect(() => {
    try {
      window.sessionStorage.setItem(KEY, href)
    } catch {
      // Speicher gesperrt: der Rückweg führt dann zur ungefilterten Liste
    }
  }, [href])
  return null
}

// Gemerkte Adresse der Liste; vor dem Lesen (Server, erster Aufbau) die ungefilterte Liste
// Der Speicher meldet keine Änderungen im selben Tab; gelesen wird beim Aufbau der Seite
const subscribe = () => () => {}
export function useInvoiceListHref(): string {
  return useSyncExternalStore(subscribe, readInvoiceListHref, () => LIST)
}

export function BackToInvoiceList({ label }: { label: string }) {
  const href = useInvoiceListHref()
  return (
    <Link href={href} className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
      <CaretLeft size={16} weight="bold" aria-hidden="true" />
      {label}
    </Link>
  )
}
