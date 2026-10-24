import { defineConfig, devices } from '@playwright/test'

// Tests laufen im installierten Google Chrome (channel: 'chrome') – kein Browser-Download nötig.
// Prüfbreiten laut Spec: Handy 375 px, Tablet 768 px, Desktop 1440 px.
const chrome = { browserName: 'chromium' as const, channel: 'chrome' }
const storageState = 'tests/.auth/owner.json'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
  },
  // „setup“ legt einen Testnutzer in „apppa“ an und meldet ihn an (tests/auth.setup.ts); die Projekte starten
  // damit angemeldet. Tests ohne Anmeldung setzen storageState selbst zurück. „teardown“ löscht den Nutzer.
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...chrome }, teardown: 'teardown' },
    { name: 'teardown', testMatch: /auth\.teardown\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], ...chrome, viewport: { width: 1440, height: 900 }, storageState },
    },
    {
      name: 'tablet',
      dependencies: ['setup'],
      use: { ...chrome, viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, storageState },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'], ...chrome, viewport: { width: 375, height: 812 }, storageState },
    },
  ],
  // Tests verschicken keine Hinweis-Mails über Brevo (Testadressen @example.com würden zurückprallen und
  // den Ruf der Absender-Domain schädigen). Ein leerer Wert hat Vorrang vor .env.local.
  // Achtung: Läuft schon ein eigener `npm run dev`, wird dieser wiederverwendet – vor den Tests beenden.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: { BREVO_API_KEY: '' },
  },
})
