import { expect, test, type Page } from '@playwright/test'

// The course block `calculatrice` (#424, ADR 0049 §6) in a real chapter, served by the fake
// backend straight from content/: 5e « Proportionnalité et pourcentages », section
// « Proportionnalité et graphique ». The slider turns the line, « Revenir au départ » brings the
// starting lines back, the chapter's address is never written, « Ouvrir en grand » carries the
// current lines to Explorer, and the block has its own slide in the interactive mode.

const CHAPITRE = '/5e/mathematiques/proportionnalite-pourcentages'
const BLOC = 'calculatrice-droites-origine'

const region = (page: Page) => page.getByRole('region', { name: /^Calculatrice : Déplace/ })
const courbe = (page: Page) =>
  region(page)
    .getByRole('img', { name: /^Repère/ })
    .locator('[data-courbe] path')
const champ = (page: Page, n: number) =>
  region(page).getByRole('textbox', { name: `Expression ${n}` })

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
})

test('the slider turns the line, and « Revenir au départ » brings the starting lines back', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL! }])
  await page.goto(CHAPITRE)
  await region(page).scrollIntoViewIfNeeded()
  await expect(champ(page, 1)).toHaveValue('y = ax')
  await expect(champ(page, 2)).toHaveValue('a = 1')
  await expect(courbe(page)).toHaveCount(1)
  const depart = await courbe(page).getAttribute('d')

  const curseur = region(page).getByRole('slider', { name: 'Curseur a' })
  for (let i = 0; i < 5; i++) await curseur.press('ArrowRight')
  await expect(champ(page, 2)).toHaveValue('a = 1,5')
  await expect(courbe(page)).not.toHaveAttribute('d', depart ?? '')

  await champ(page, 1).fill('y = 2x + 1')
  await expect(champ(page, 1)).toHaveValue('y = 2x + 1')
  await region(page).getByRole('button', { name: 'Revenir aux expressions de départ' }).click()
  await expect(champ(page, 1)).toHaveValue('y = ax')
  await expect(champ(page, 2)).toHaveValue('a = 1')
  await expect(courbe(page)).toHaveAttribute('d', depart ?? '')
  // The block keeps its state in memory: the chapter's address is never written.
  await expect(page).toHaveURL(CHAPITRE)
})

test('« Ouvrir en grand » opens Explorer on the current lines', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL! }])
  await page.goto(CHAPITRE)
  await region(page).scrollIntoViewIfNeeded()
  await expect(champ(page, 1)).toHaveValue('y = ax')
  await region(page).getByRole('button', { name: 'Ajouter une expression' }).click()
  await champ(page, 3).fill('y = 3x')
  await expect(region(page).getByRole('img', { name: /^Repère/ })).toHaveAccessibleName(/2 courbes/)

  await region(page)
    .getByRole('link', { name: 'Ouvrir cette calculatrice en grand, dans Explorer' })
    .click()
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL(/\/explorer\/calculatrice\?e=[A-Za-z0-9_-]+$/, { timeout: 20_000 })
  await expect(page.getByRole('textbox', { name: 'Expression 1' })).toHaveValue('y = ax')
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('a = 1')
  await expect(page.getByRole('textbox', { name: 'Expression 3' })).toHaveValue('y = 3x')
})

test('the block has its own slide in the interactive mode', async ({ page }) => {
  await page.goto(`${CHAPITRE}?diapo=${BLOC}`)
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=${BLOC}`)
  const slide = page.locator(`[data-diapo="${BLOC}"]`)
  await expect(slide.getByRole('region', { name: /^Calculatrice : Déplace/ })).toBeVisible()
  await expect(slide.getByRole('slider', { name: 'Curseur a' })).toBeVisible()
  // The parameterised figure stays on the slide before, with the prose that introduces it.
  await expect(slide.getByRole('slider', { name: 'Paramètre a' })).toHaveCount(0)
})
