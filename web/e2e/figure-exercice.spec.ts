import { expect, test, type Page } from '@playwright/test'

// A figure and the exercise right after it share one slide (#277, ADR 0032 rule 6a). Slides of
// the parallelogram chapter, section "Définir et construire":
//  def-parallelogramme (definition) · fig-parallelogramme (figure + ex-definition) · ex-parallele-ab
const CHAPITRE = '/5e/mathematiques/parallelogrammes'
const FIGURE = /^Parallélogramme ABCD avec ses diagonales/

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
})

/** Keys are lost until React has hydrated the page: wait for the client to own the URL. */
async function ouvrir(page: Page, diapo: string) {
  await page.goto(`${CHAPITRE}?diapo=${diapo}`)
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=${diapo}`)
}

function diapo(page: Page, id: string) {
  return page.locator(`[data-diapo="${id}"]`)
}

test('the figure is on the exercise slide, above the exercise', async ({ page }) => {
  await ouvrir(page, 'def-parallelogramme')
  // The definition's slide no longer holds the figure.
  await expect(diapo(page, 'def-parallelogramme').getByRole('img', { name: FIGURE })).toHaveCount(0)

  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=fig-parallelogramme`)
  const slide = diapo(page, 'fig-parallelogramme')
  const figure = slide.getByRole('img', { name: FIGURE })
  const consigne = slide.getByText('Un parallélogramme est un quadrilatère :')
  await expect(figure).toBeVisible()
  await expect(consigne).toBeVisible()
  // The check button lives in the scene's bottom bar, outside the slide.
  await expect(page.getByRole('button', { name: 'Vérifier' })).toBeVisible()

  // One column on every screen: the figure first, the exercise below it.
  const boiteFigure = await figure.boundingBox()
  const boiteConsigne = await consigne.boundingBox()
  expect(boiteFigure).not.toBeNull()
  expect(boiteConsigne).not.toBeNull()
  expect(boiteFigure!.y + boiteFigure!.height).toBeLessThanOrEqual(boiteConsigne!.y)
})

test('an old link to the exercise lands on the slide it shares with the figure', async ({
  page,
}) => {
  await page.goto(`${CHAPITRE}?diapo=ex-definition`)
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=fig-parallelogramme`)
  await expect(diapo(page, 'fig-parallelogramme').getByRole('img', { name: FIGURE })).toBeVisible()
})

test('a figure with no exercise after it keeps its lesson slide', async ({ page }) => {
  // Pythagoras: the figure sits between the definition and the formula, on the lesson slide.
  await page.goto('/3e/mathematiques/theoreme-de-pythagore?diapo=intro-prose')
  await expect(page).toHaveURL(/\?diapo=intro-prose$/)
  const slide = diapo(page, 'intro-prose')
  await expect(slide.getByRole('img', { name: /^Triangle rectangle ABC/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vérifier' })).toBeHidden()
})
