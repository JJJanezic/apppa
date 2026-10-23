import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

// PROJ-2: App-Shell & Design-System. Läuft in den Projekten desktop (1440), tablet (768) und mobile (375).
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024
// Seitenleiste = Bereich um die Hauptnavigation (die fest ausgeklappte shadcn-Sidebar hat kein Daten-Merkmal)
const sidebar = (page: Page) => page.locator('div.sticky:has(nav[aria-label="Hauptnavigation"])')

test.describe('Startseite', () => {
  test('zeigt Datum, Begrüßung nach Tageszeit und den Leerzustand', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('main header')
    await expect(header.locator('p').first()).toHaveText(
      /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), \d{1,2}\. (Jänner|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) \d{4}$/i
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Guten (Morgen|Tag|Abend), Erika\.$/)
    await expect(page.getByRole('heading', { name: 'Hier erscheinen bald deine Buchungen.' })).toBeVisible()
  })

  // Seit PROJ-3 angemeldet (tests/auth.setup.ts): echter Name; Kunde bleibt Platzhalter bis PROJ-4
  test('zeigt Namen der angemeldeten Person und Platzhalter für Kunde und Sync-Status', async ({ page }) => {
    await page.goto('/')
    if (!isDesktop(page)) await page.getByRole('button', { name: 'Mehr' }).click()
    const scope = isDesktop(page) ? sidebar(page) : page.getByRole('dialog')
    await expect(scope.getByText('Kunde folgt mit dem Login')).toBeVisible()
    await expect(scope.getByRole('button', { name: /Benutzermenü: Erika Testerin · Inhaber/ })).toBeVisible()
    await expect(scope.getByText('Noch keine Verbindungen')).toBeVisible()
  })

  test('Browser-Tab zeigt „<Seite> · apppa“', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Dashboard · apppa')
  })
})

test.describe('Desktop-Rahmen', () => {
  test.beforeEach(({ page }) => test.skip(!isDesktop(page), 'nur Desktop'))

  test('Seitenleiste mit Wortmarke, Navigation, Personenbereich und Sync-Status; keine Kopfzeile', async ({ page }) => {
    await page.goto('/')
    await expect(sidebar(page)).toBeVisible()
    await expect(sidebar(page).getByRole('link', { name: 'apppa' })).toBeVisible()
    await expect(sidebar(page).getByRole('button', { name: /Benutzermenü/ })).toBeVisible()
    await expect(sidebar(page).getByRole('status')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navigation', exact: true })).toBeHidden()
    await expect(page.locator('body > header, [role="banner"]')).toHaveCount(0)
  })

  test('aktiver Punkt ist hervorgehoben und als aktuelle Seite markiert', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Dashboard' })
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(link).toHaveAttribute('data-active', 'true')
  })

  test('Seitenleiste bleibt beim Scrollen stehen', async ({ page }) => {
    await page.goto('/')
    // Erst verändern, wenn React die Seite übernommen hat, sonst baut React sie neu auf (Hydration)
    await page.waitForFunction(() => {
      const main = document.querySelector('main')
      return !!main && Object.keys(main).some((key) => key.startsWith('__reactFiber'))
    })
    await page.evaluate(() => {
      const filler = document.createElement('div')
      filler.style.height = '3000px'
      document.querySelector('main')?.appendChild(filler)
      window.scrollTo(0, 1500)
    })
    const box = await sidebar(page).boundingBox()
    expect(box?.y).toBe(0)
  })

  test('Benutzermenü zeigt „Mein Konto“ und „Abmelden“', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Benutzermenü/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Mein Konto' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Abmelden' })).toBeVisible()
  })
})

test.describe('Handy und Tablet hochkant', () => {
  test.beforeEach(({ page }) => test.skip(isDesktop(page), 'nur Handy/Tablet'))

  test('untere Leiste statt Seitenleiste', async ({ page }) => {
    await page.goto('/')
    const bottom = page.getByRole('navigation', { name: 'Navigation', exact: true })
    await expect(bottom).toBeVisible()
    await expect(bottom.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(bottom.getByRole('button', { name: 'Mehr' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden()
  })

  test('„Mehr“ zeigt Kunde, Benutzermenü und Sync-Status', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Mehr' }).click()
    const sheet = page.getByRole('dialog', { name: 'Weitere Bereiche' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Kunde folgt mit dem Login')).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Benutzermenü/ })).toBeVisible()
    await expect(sheet.getByRole('status')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('button', { name: 'Mehr' })).toBeFocused()
  })

  test('kein waagrechtes Scrollen und Bedienelemente mindestens 44 × 44 px', async ({ page }) => {
    await page.goto('/')
    const { scrollWidth, width } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(width)
    const bottom = page.getByRole('navigation', { name: 'Navigation', exact: true })
    for (const el of await bottom.locator('a, button').all()) {
      const box = await el.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('Drehen ins Querformat wechselt ohne Neuladen zur Seitenleiste', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) !== 768, 'nur Tablet')
    await page.goto('/')
    await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true))
    await page.setViewportSize({ width: 1024, height: 768 })
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navigation', exact: true })).toBeHidden()
    expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true)
  })
})

test.describe('Sichtbarkeit der Navigation', () => {
  test('nicht fertige Bereiche fehlen in der Navigation', async ({ page }) => {
    await page.goto('/')
    if (!isDesktop(page)) await page.getByRole('button', { name: 'Mehr' }).click()
    for (const name of ['Belegung', 'Buchungen', 'Gäste', 'Zahlungen', 'Auswertungen', 'Tourismusabgabe', 'Kanäle & Kalender', 'Einstellungen']) {
      await expect(page.getByRole('link', { name })).toHaveCount(0)
    }
  })

  for (const path of ['/belegung', '/buchungen', '/gaeste', '/zahlungen', '/einstellungen']) {
    test(`direkter Aufruf von ${path} zeigt „Seite nicht gefunden“`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBe(404)
      await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    })
  }

  test('unbekannte Adresse zeigt „Seite nicht gefunden“ mit Link zum Dashboard', async ({ page }) => {
    const res = await page.goto('/gibt-es-nicht')
    expect(res?.status()).toBe(404)
    await page.getByRole('link', { name: 'Zum Dashboard' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Barrierefreiheit', () => {
  test('keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page }) => {
    await page.goto('/')
    await page.locator('nextjs-portal').evaluateAll((els) => els.forEach((e) => e.remove()))
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('alle Bedienelemente sind per Tastatur erreichbar und der Fokus ist sichtbar', async ({ page }) => {
    await page.goto('/')
    const expected = isDesktop(page) ? ['Dashboard', 'Benutzermenü'] : ['Dashboard', 'Mehr']
    const reached: string[] = []
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        // Entwicklerwerkzeug von Next.js (nur im Dev-Modus) ignorieren
        if (!el || el === document.body || el.tagName === 'NEXTJS-PORTAL') return null
        const style = getComputedStyle(el)
        return { name: el.getAttribute('aria-label') ?? el.textContent ?? '', outline: style.outlineStyle }
      })
      if (info) {
        reached.push(info.name)
        expect(info.outline, `Fokus sichtbar bei „${info.name}“`).not.toBe('none')
      }
    }
    for (const name of expected) expect(reached.some((r) => r.includes(name))).toBe(true)
  })

  test('„Bewegung reduzieren“ schaltet Animationen ab', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const duration = await page.evaluate(() => {
      const el = document.createElement('div')
      el.style.transition = 'opacity 2s'
      document.body.appendChild(el)
      return getComputedStyle(el).transitionDuration
    })
    expect(parseFloat(duration)).toBeLessThan(0.01)
  })
})

test.describe('Regression (QA-Bugs PROJ-2)', () => {
  test('BUG-1: Seitenleiste ist 236 px breit wie im Entwurf', async ({ page }) => {
    test.skip(!isDesktop(page), 'nur Desktop')
    await page.goto('/')
    const box = await sidebar(page).boundingBox()
    expect(box?.width).toBe(236)
  })

  test('BUG-2: Cmd/Ctrl+B wird nicht abgefangen', async ({ page }) => {
    await page.goto('/')
    const prevented = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          window.addEventListener('keydown', (e) => setTimeout(() => resolve(e.defaultPrevented), 0), { once: true })
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'b', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true })
          )
        })
    )
    expect(prevented).toBe(false)
  })

  test('BUG-3: Bereich der Hinweis-Meldungen ist deutsch beschriftet', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('region', { name: /^Benachrichtigungen/ })).toBeAttached()
  })
})
