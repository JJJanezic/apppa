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
  // „setup“ legt einen Testnutzer in „apppa-dev“ an und meldet ihn an (tests/auth.setup.ts); die Projekte starten
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
    // Safari (WebKit) und Firefox nur auf Wunsch: `PW_SAFARI=1 npx playwright test --project=safari` (PROJ-31),
    // `PW_FIREFOX=1 npx playwright test --project=firefox`. Beide Browser liegen unter ~/Library/Caches/ms-playwright
    // (mit Node 26 von Hand entpackt: webkit-2248, firefox-1509). Safari nur gegen `npm run dev`: Im Produktions-Build
    // sind die Sitzungs-Cookies `Secure`, und WebKit schickt sie nicht an http://localhost (Chrome/Firefox schon).
    ...(process.env.PW_SAFARI
      ? [
          {
            name: 'safari',
            dependencies: ['setup'],
            use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 }, storageState },
          },
        ]
      : []),
    ...(process.env.PW_FIREFOX
      ? [
          {
            name: 'firefox',
            dependencies: ['setup'],
            use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 }, storageState },
          },
        ]
      : []),
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
