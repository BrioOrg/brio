import { expect, test, type Page } from '@playwright/test'

// « Ouvrir dans la calculatrice » under a course figure with functions (#423, ADR 0049 §5): the
// figure's curve and slider, at the slider's current value, in the calculator; back returns to the
// chapter, at the figure. The fake backend needs no new route (the chapter and the calculator ask
// nothing else of it).

const CHAPITRE = '/5e/mathematiques/proportionnalite-pourcentages'

/** The LaTeX of a line's maths field (MathLive, #417), once it has replaced the plain field. */
async function latex(page: Page, n: number): Promise<string> {
  const mf = page.locator(`math-field[aria-label="Expression ${n}"]`)
  await expect(mf).toBeAttached()
  return mf.evaluate((el) => (el as HTMLElement & { value: string }).value)
}

test('the figure opens in the calculator at the slider value, and back returns to it', async ({
  page,
  context,
  baseURL,
}) => {
  // The reading mode: the whole chapter on one page.
  await context.addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL! }])
  await page.goto(CHAPITRE)

  const figure = page.locator('#fig-coefficient-curseur')
  const curseur = figure.getByRole('slider', { name: 'Paramètre a' })
  await curseur.scrollIntoViewIfNeeded()
  await expect(curseur).toHaveValue('1.5')
  // Hydrated: the slider answers the keyboard (1,5 → 2).
  await curseur.focus()
  await expect(async () => {
    await curseur.press('ArrowRight')
    await expect(curseur).toHaveValue('2')
  }).toPass()

  await figure.getByRole('link', { name: 'Ouvrir dans la calculatrice graphique' }).click()
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL(/\/explorer\/calculatrice\?e=/, { timeout: 20_000 })

  await expect.poll(() => latex(page, 1)).toBe('f(x)=ax')
  await expect.poll(() => latex(page, 2)).toBe('a=2')
  const reglette = page.getByRole('slider', { name: /Curseur a/ })
  await expect(reglette).toHaveAttribute('min', '0.5')
  await expect(reglette).toHaveAttribute('max', '4')
  await expect(reglette).toHaveAttribute('step', '0.5')
  await expect(reglette).toHaveValue('2')
  // The curve is drawn, in the window of the figure's axes (x from 0 to 5).
  await expect(
    page.getByRole('img', { name: /^Repère/ }).locator('[data-courbe] path')
  ).toHaveCount(1)
  await expect(page.getByRole('img', { name: /^Repère/ }).locator('desc')).toContainText(
    /x de 0 à 5\s;\sy de 0 à 10/
  )

  await page.goBack()
  await expect(page).toHaveURL(CHAPITRE, { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { level: 1, name: 'Proportionnalité et pourcentages' })
  ).toBeVisible()
  await expect(page.locator('#fig-coefficient-curseur')).toBeInViewport()
})

test('in the interactive mode, back from the calculator returns to the same slide', async ({
  page,
}) => {
  const diapo = `${CHAPITRE}?diapo=intro-coefficient-curseur`
  await page.goto(diapo)
  await expect(
    page.locator('[data-chapitre-mode="interactif"][data-transitions="pretes"]')
  ).toBeAttached({
    timeout: 20_000,
  })
  await page.getByRole('link', { name: 'Ouvrir dans la calculatrice graphique' }).click()
  await expect(page).toHaveURL(/\/explorer\/calculatrice\?e=/, { timeout: 20_000 })
  await expect.poll(() => latex(page, 1)).toBe('f(x)=ax')

  await page.goBack()
  await expect(page).toHaveURL(diapo, { timeout: 20_000 })
  await expect(page.locator('[data-diapo="intro-coefficient-curseur"]').first()).toBeVisible()
})

test('in a 360 x 800 slide, the focused link stays above the sticky Précédent / Suivant bar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto(`${CHAPITRE}?diapo=intro-coefficient-curseur`)
  await expect(
    page.locator('[data-chapitre-mode="interactif"][data-transitions="pretes"]')
  ).toBeAttached({ timeout: 20_000 })

  const lien = page.getByRole('link', { name: 'Ouvrir dans la calculatrice graphique' })
  await lien.focus()
  await expect(lien).toBeFocused()
  await expect(async () => {
    const boite = await lien.boundingBox()
    const barre = await page.getByRole('button', { name: /Suivant/ }).boundingBox()
    expect(boite).not.toBeNull()
    expect(barre).not.toBeNull()
    // The ring is 2 px + 2 px offset around the link.
    expect(boite!.y + boite!.height + 4).toBeLessThanOrEqual(barre!.y)
  }).toPass()
})

test('a figure without functions has no link', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL! }])
  await page.goto('/3e/mathematiques/theoreme-de-pythagore')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: /calculatrice/i })).toHaveCount(0)
})
