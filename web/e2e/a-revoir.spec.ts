import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from '@playwright/test'

import { buildDeck } from '../../packages/content/src/deck'

// #371 (PL-2): the Accueil card « À revoir » leads to the lesson in ONE click, on a phone as on a
// desktop, with the section title in view and one « back » returning to the Accueil. The
// viewports are explicit (Pixel 7 is 412 px wide, not the 360 px the budget is measured at).

const SESSION_A_REVOIR = 'e2e-a-revoir'
const SESSION_ORPHELIN = 'e2e-a-revoir-orphelin'

const CHAPITRE = '5e/mathematiques/division-decimale-problemes'
const SECTION = 'diviser-par-un-decimal'
const TITRE = 'Diviser par un nombre décimal'
const DESTINATION = `/${CHAPITRE}?diapo=${SECTION}`

// The slide `?diapo=<section id>` opens: the first of that section in the real chapter.
const chapitre = JSON.parse(
  readFileSync(join(__dirname, `../../content/chapitres/${CHAPITRE}.json`), 'utf8')
)
const DIAPO_ATTENDUE = buildDeck(chapitre).find(
  (d) => 'sectionId' in d && d.sectionId === SECTION
)!.id

const VIEWPORTS = [
  { nom: '360×780', viewport: { width: 360, height: 780 } },
  { nom: '1280×800', viewport: { width: 1280, height: 800 } },
]

for (const { nom, viewport } of VIEWPORTS) {
  test.describe(`À revoir at ${nom}`, () => {
    test.use({ viewport })

    // critères 1, 2, 3
    test('one click on the card opens the lesson section, title in view, one back returns', async ({
      context,
      baseURL,
      page,
    }) => {
      await context.addCookies([
        { name: 'JSESSIONID', value: SESSION_A_REVOIR, url: baseURL ?? '' },
      ])
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 2, name: 'À revoir' })).toBeVisible()

      const carte = page.getByRole('link', { name: /Revois/ })
      await expect(carte).toHaveAttribute('href', DESTINATION)
      await expect(carte).toContainText(`Revois : ${TITRE}`)
      await expect(carte).not.toContainText('Explorer')

      await carte.click() // the only click
      // next dev compiles the route on its first visit.
      // The chapter then rewrites ?diapo to the id of the slide it opened (replaceState, no new
      // history entry): the link carries the section id, the address bar may show either.
      await expect(page).toHaveURL(
        new RegExp(`/${CHAPITRE}\\?diapo=(${SECTION}|${DIAPO_ATTENDUE})$`),
        { timeout: 30_000 }
      )

      const actif = page.locator('[data-diapo]:not([hidden])').first()
      await expect(actif).toHaveAttribute('data-diapo', DIAPO_ATTENDUE)
      const titre = page.locator('h2[data-diapo-titre]:visible')
      await expect(titre).toHaveText(TITRE)
      await expect(titre).toBeInViewport() // no scroll, no drawer, no tap

      await page.goBack() // once
      await expect(page).toHaveURL('/')
      await expect(page.getByRole('heading', { level: 2, name: 'À revoir' })).toBeVisible()
    })

    // critère 4
    test('a competence only an exercises section carries shows no À revoir block', async ({
      context,
      baseURL,
      page,
    }) => {
      await context.addCookies([
        { name: 'JSESSIONID', value: SESSION_ORPHELIN, url: baseURL ?? '' },
      ])
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Salut Renard-Indigo')
      await expect(page.getByRole('heading', { name: 'À revoir' })).toHaveCount(0)
      await expect(page.getByText(/Revois/)).toHaveCount(0)
    })
  })
}
