// Testreste in „apppa-dev“ beseitigen (Skill /clean-dev, Runbook docs/runbooks/supabase.md, Abschnitt „Testdaten bereinigen“).
//
// Aufruf:
//   node scripts/clean-dev.mts            nur zählen, nichts löschen
//   node scripts/clean-dev.mts --apply    löschen
//
// Läuft ausschließlich gegen Dev: Die Adresse in .env.local muss genau auf „apppa-dev“ zeigen, sonst bricht das Skript ab.
// Entfernt werden nur Daten, die eindeutig von Tests stammen und älter als zwei Stunden sind (laufende Tests bleiben unberührt):
// - Kunden ohne echtes Mitglied (nur Testnutzer oder niemand) und ohne Einladung an eine echte Adresse, samt ihren Daten
// - Testnutzer test-…@example.com bzw. test-e2e-…@example.com samt Sperrzählern der Anmeldung
// - Dateien in den Speicherbereichen, deren Kunde nicht mehr existiert
// Verwaiste Zeilen im Protokoll (audit_log) und VACUUM laufen danach als SQL über die Supabase-CLI (siehe Skill), weil die
// Schnittstelle dafür nicht freigegeben ist. Geheimnisse werden nie ausgegeben.
import { createHmac } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

import { DEV_PROJECT_REF, projectRef } from '../src/lib/supabase/projects.ts'

const TEST_EMAIL = /^test-(e2e-)?[0-9a-f-]{36}@example\.com$/
const MIN_AGE_MS = 2 * 60 * 60 * 1000
const BUCKETS = ['invoices', 'tenant-logos', 'guest-documents', 'payment-receipts', 'guest-sheets'] as const
const PAGE = 1000

const apply = process.argv.includes('--apply')
process.loadEnvFile('.env.local')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (projectRef(url) !== DEV_PROJECT_REF) {
  console.error(`Abbruch: .env.local zeigt nicht auf „apppa-dev“ (${DEV_PROJECT_REF}). Bereinigt wird nur Dev.`)
  process.exit(1)
}
if (!key) {
  console.error('Abbruch: SUPABASE_SECRET_KEY fehlt in .env.local.')
  process.exit(1)
}
const db = createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })
const cutoff = Date.now() - MIN_AGE_MS
const old = (iso: string) => new Date(iso).getTime() < cutoff

// Gleicher Hash wie src/lib/auth/lockout.ts (Sperrzähler der Anmeldung)
const accountHash = (email: string) => {
  const k = createHmac('sha256', key).update('apppa:login-failures').digest()
  return createHmac('sha256', k).update(email.trim().toLowerCase()).digest('hex')
}

async function all<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (;;) {
    const { data, error } = await fetch(out.length, out.length + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) return out
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

// ---- Nutzer ---------------------------------------------------------------------------------------
const users: { id: string; email: string; created_at: string }[] = []
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE })
  if (error) throw new Error(error.message)
  users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? '', created_at: u.created_at })))
  if (data.users.length < PAGE) break
}
const testUserIds = new Set(users.filter((u) => TEST_EMAIL.test(u.email)).map((u) => u.id))
const oldTestUsers = users.filter((u) => testUserIds.has(u.id) && old(u.created_at))

// ---- Kunden ---------------------------------------------------------------------------------------
const tenants = await all<{ id: string; name: string; created_at: string }>((a, b) => db.from('tenants').select('id, name, created_at').order('id').range(a, b))
const memberships = await all<{ tenant_id: string; user_id: string }>((a, b) => db.from('memberships').select('tenant_id, user_id').order('tenant_id').range(a, b))
const invitations = await all<{ tenant_id: string; email: string }>((a, b) => db.from('invitations').select('tenant_id, email').order('tenant_id').range(a, b))
const realMember = new Set(memberships.filter((m) => !testUserIds.has(m.user_id)).map((m) => m.tenant_id))
const realInvite = new Set(invitations.filter((i) => !TEST_EMAIL.test(i.email.toLowerCase())).map((i) => i.tenant_id))
const testTenants = tenants.filter((t) => !realMember.has(t.id) && !realInvite.has(t.id) && old(t.created_at))
const keptTenantIds = new Set(tenants.filter((t) => !testTenants.includes(t)).map((t) => t.id))

// ---- Dateien --------------------------------------------------------------------------------------
async function listFiles(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE, offset })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      // Ordner haben keine Kennung
      if (item.id === null) out.push(...(await listFiles(bucket, path)))
      else out.push(path)
    }
    if (!data || data.length < PAGE) return out
  }
}
const orphanFiles: Record<string, string[]> = {}
for (const bucket of BUCKETS) {
  const { data: folders, error } = await db.storage.from(bucket).list('', { limit: PAGE })
  if (error) {
    // Speicherbereich gibt es (noch) nicht
    orphanFiles[bucket] = []
    continue
  }
  const files: string[] = []
  for (const folder of folders ?? []) {
    if (folder.id !== null || keptTenantIds.has(folder.name)) continue
    files.push(...(await listFiles(bucket, folder.name)))
  }
  orphanFiles[bucket] = files
}

// ---- Bericht --------------------------------------------------------------------------------------
console.log(`Projekt: apppa-dev (${DEV_PROJECT_REF})${apply ? '' : ' – nur gezählt, nichts gelöscht'}`)
console.log(`Testkunden (ohne echtes Mitglied, älter als 2 h): ${testTenants.length} von ${tenants.length}`)
console.log(`Testnutzer (älter als 2 h): ${oldTestUsers.length} von ${users.length} Nutzern`)
for (const bucket of BUCKETS) console.log(`Dateien ohne Kunde in „${bucket}“: ${orphanFiles[bucket].length}`)
console.log(`Bleiben: ${tenants.length - testTenants.length} Kunden, ${users.length - oldTestUsers.length} Nutzer`)

if (!apply) process.exit(0)

// ---- Löschen --------------------------------------------------------------------------------------
let failed = 0
for (const t of testTenants) {
  const { error } = await db.from('tenants').delete().eq('id', t.id)
  if (error) {
    failed++
    console.error(`Kunde nicht gelöscht (${t.id}): ${error.message}`)
  }
}
for (const u of oldTestUsers) {
  await db.from('login_failures').delete().eq('account_hash', accountHash(u.email))
  const { error } = await db.auth.admin.deleteUser(u.id)
  if (error) {
    failed++
    console.error(`Nutzer nicht gelöscht (${u.id}): ${error.message}`)
  }
}
for (const bucket of BUCKETS) {
  const files = orphanFiles[bucket]
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await db.storage.from(bucket).remove(files.slice(i, i + 100))
    if (error) {
      failed++
      console.error(`Dateien in „${bucket}“ nicht gelöscht: ${error.message}`)
    }
  }
}
console.log(failed ? `Fertig mit ${failed} Fehlern (siehe oben).` : 'Gelöscht. Nächster Schritt: verwaiste Protokollzeilen und VACUUM (Skill /clean-dev, Schritt 3).')
process.exit(failed ? 1 : 0)
