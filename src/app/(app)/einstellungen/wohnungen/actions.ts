'use server'

import { type ApartmentErrorCode, type Municipality, municipalitySearchKey, stateOfMunicipality } from '@/lib/apartments'
import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { getTenantContext } from '@/lib/tenant'
import {
  apartmentSchema,
  propertySchema,
  type ApartmentInput,
  type PropertyInput,
} from '@/lib/validation/apartments'

// Server-Aktionen für „Einstellungen → Wohnungen“ (PROJ-6), nur für Inhaber des gewählten Kunden.
// Vorläufig (Frontend): Eingaben und Rolle werden geprüft, die Ausführung folgt mit dem Backend.

type Result<T = undefined> = ActionResult<T, ApartmentErrorCode>
type Failure = { ok: false; error: ApartmentErrorCode | CommonErrorCode }

const key = (k: string) => k
const fail = (error: ApartmentErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

async function requireOwner(): Promise<{ ok: true } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return fail('unknown')
  return { ok: true }
}

// Wohnung anlegen, bei „Neues Objekt“ samt Objekt in einem Zug
export async function createApartment(values: ApartmentInput): Promise<Result<{ id: string }>> {
  if (!apartmentSchema(key).safeParse(values).success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function updateApartment(values: { id: string } & ApartmentInput): Promise<Result> {
  if (!isId(values?.id) || !apartmentSchema(key).safeParse(values).success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function setApartmentArchived(values: { id: string; archived: boolean }): Promise<Result> {
  if (!isId(values?.id) || typeof values?.archived !== 'boolean') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function deleteApartment(values: { id: string }): Promise<Result> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function updateProperty(values: { id: string } & PropertyInput): Promise<Result> {
  if (!isId(values?.id) || !propertySchema(key).safeParse(values).success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function deleteProperty(values: { id: string }): Promise<Result> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

// Vorläufige Beispieldaten für die Gemeindesuche, bis das Backend die Liste von Statistik Austria einspielt
const SAMPLE: { code: string; name: string; postalCodes: string[] }[] = [
  { code: '50101', name: 'Salzburg', postalCodes: ['5020', '5023', '5026'] },
  { code: '50408', name: 'St. Gilgen', postalCodes: ['5340', '5342'] },
  { code: '50628', name: 'Zell am See', postalCodes: ['5700'] },
  { code: '50606', name: 'Kaprun', postalCodes: ['5710'] },
  { code: '90001', name: 'Wien', postalCodes: ['1010', '1020', '1030'] },
  { code: '40101', name: 'Linz', postalCodes: ['4020', '4030'] },
  { code: '50417', name: 'Strobl', postalCodes: ['5350'] },
  { code: '41713', name: 'St. Wolfgang im Salzkammergut', postalCodes: ['5360'] },
]

// Gemeindesuche: zuerst die Gemeinden zur PLZ, dann Treffer nach Name (ab 2 Zeichen), höchstens 20
export async function searchMunicipalities(values: {
  query: string
  postalCode?: string
}): Promise<Result<{ byPostalCode: Municipality[]; results: Municipality[] }>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const needle = municipalitySearchKey(String(values?.query ?? '')).slice(0, 100)
  const postalCode = /^\d{4}$/.test(values?.postalCode ?? '') ? values.postalCode : null
  const toMunicipality = (m: (typeof SAMPLE)[number]): Municipality => ({
    code: m.code,
    name: m.name,
    state: stateOfMunicipality(m.code) ?? 'wien',
  })
  const byPostalCode = postalCode ? SAMPLE.filter((m) => m.postalCodes.includes(postalCode)).map(toMunicipality) : []
  const results =
    needle.length >= 2
      ? SAMPLE.filter((m) => municipalitySearchKey(m.name).includes(needle) || m.postalCodes.some((p) => p.startsWith(needle)))
          .map(toMunicipality)
          .slice(0, 20)
      : []
  return { ok: true, data: { byPostalCode, results } }
}
