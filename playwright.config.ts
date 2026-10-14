import { defineConfig, devices } from '@playwright/test'

// Tests laufen im installierten Google Chrome (channel: 'chrome') – kein Browser-Download nötig.
// Prüfbreiten laut Spec: Handy 375 px, Tablet 768 px, Desktop 1440 px.
const chrome = { browserName: 'chromium' as const, channel: 'chrome' }

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
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...chrome, viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...chrome, viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'mobile', use: { ...devices['iPhone 13'], ...chrome, viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
