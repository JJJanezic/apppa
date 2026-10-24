import 'server-only'

import { notFound } from 'next/navigation'

import type { Property } from '@/lib/apartments'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen für Objekte und Wohnungen (PROJ-6), nur für Inhaber des gewählten Kunden (Einstellungen).
// Vorläufig (Frontend): Die Tabellen entstehen mit dem Backend; bis dahin gibt es noch keine Objekte.

export async function getProperties(): Promise<Property[]> {
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') notFound()
  return []
}
