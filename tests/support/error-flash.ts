import { expect, type Page } from '@playwright/test'

import messages from '../../messages/de.json'

// Meldet, ob die Fehlerseite („Da ist etwas schiefgelaufen.“) auch nur kurz zu sehen war, auch über Seitenwechsel hinweg.
// Anlass: Firefox bricht beim Seitenwechsel eine noch laufende Antwort einer Server-Aktion ab, und Next.js zeigte
// dafür kurz die Fehlerseite (Login, Abmelden, Löschen …). Chrome und Safari lesen die Antwort zu Ende, dort tritt das nicht auf.
// Aufruf vor dem ersten page.goto; danach expect(flashes).toEqual([]).
export async function watchErrorFlash(page: Page): Promise<string[]> {
  const flashes: string[] = []
  await page.exposeFunction('__reportErrorFlash', (url: string) => {
    flashes.push(url)
  })
  await page.addInitScript((title) => {
    let reported = false
    const check = () => {
      // Nur die Überschrift der Fehlerseite zählt: Der Seitentext enthält die Übersetzungen (auch diesen Satz) in Skripten
      if (reported || ![...document.querySelectorAll('h1')].some((h) => h.textContent?.trim() === title)) return
      reported = true
      ;(window as unknown as { __reportErrorFlash: (url: string) => void }).__reportErrorFlash(location.href)
    }
    new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true })
  }, messages.errors.title)
  return flashes
}

// Als automatische Fixture: Jeder Test der Datei schlägt fehl, wenn die Fehlerseite auch nur kurz zu sehen war.
// const test = base.extend<{ …; noErrorFlash: void }>({ noErrorFlash, … })
export const noErrorFlash: [(args: { page: Page }, use: () => Promise<void>) => Promise<void>, { auto: true }] = [
  async ({ page }: { page: Page }, use: () => Promise<void>) => {
    const flashes = await watchErrorFlash(page)
    await use()
    expect(flashes, 'Fehlerseite war kurz zu sehen').toEqual([])
  },
  { auto: true },
]
