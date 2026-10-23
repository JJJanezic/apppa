import { test } from '@playwright/test'
for (const path of ['/', '/konto']) test(`debug ${path}`, async ({ page }) => {
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', path, m.text().slice(0, 900)))
  page.on('pageerror', (e) => console.log('PAGEERROR', path, e.message.slice(0, 1500)))
  page.on('response', (r) => r.status() === 404 && console.log('404', r.url()))
  await page.goto(path)
  await page.waitForTimeout(2500)
})
