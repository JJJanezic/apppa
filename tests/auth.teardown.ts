import { existsSync, readFileSync, rmSync } from 'node:fs'

import { test as teardown } from '@playwright/test'

import { deleteUser, hasSupabaseEnv, SHARED_USER_FILE, STORAGE_STATE } from './support/supabase'

teardown('Testnutzer löschen', async () => {
  teardown.skip(!hasSupabaseEnv || !existsSync(SHARED_USER_FILE), 'nichts anzulegen gewesen')
  await deleteUser(JSON.parse(readFileSync(SHARED_USER_FILE, 'utf8')))
  rmSync(SHARED_USER_FILE, { force: true })
  rmSync(STORAGE_STATE, { force: true })
})
