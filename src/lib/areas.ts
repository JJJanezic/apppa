import { notFound } from 'next/navigation'

import { isAreaAvailable, type NavItemId } from '@/lib/navigation'
import { getShellInfo } from '@/lib/shell'

// Zu Beginn jeder Bereichsseite aufrufen: Nicht fertige oder für die Rolle gesperrte Bereiche
// sind auch per direkter Adresse nicht erreichbar („Seite nicht gefunden“).
export async function requireArea(id: NavItemId) {
  const { person } = await getShellInfo()
  if (!isAreaAvailable(id, person.role)) notFound()
}
