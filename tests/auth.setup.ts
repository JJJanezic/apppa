import { mkdirSync, writeFileSync } from 'node:fs'

import { test as setup } from '@playwright/test'

import { createTenant, createUser, hasSupabaseEnv, loginAndWait, SHARED_USER_FILE, STORAGE_STATE } from './support/supabase'

// Gemeinsamer angemeldeter Testnutzer für Tests, die nur die App-Oberfläche brauchen (z. B. PROJ-2).
// Tests, die abmelden oder Passwörter ändern, legen eigene Nutzer an (sonst endet diese Sitzung für alle).
setup('Testnutzer anmelden', async ({ page }) => {
  setup.skip(!hasSupabaseEnv, 'keine .env.local')
  mkdirSync('tests/.auth', { recursive: true })
  const user = await createUser({ displayName: 'Erika Testerin' })
  writeFileSync(SHARED_USER_FILE, JSON.stringify({ id: user.id, email: user.email }))
  // Inhaber eines Testkunden (PROJ-4); wird beim Löschen des Nutzers mit entfernt
  await createTenant('Testkunde E2E', [{ user, role: 'owner' }])
  await loginAndWait(page, user)
  await page.context().storageState({ path: STORAGE_STATE })
})
