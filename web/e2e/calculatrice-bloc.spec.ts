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

/** The LaTeX of a line's maths field (MathLive, #417), once it has replaced the plain field. */
async function latex(page: Page, n: number, dans = region(page)): Promise<string> {
  const mf = dans.locator(`math-field[aria-label="Expression ${n}"]`)
  await expect(mf).toBeAttached()
  return mf.evaluate((el) => (el as HTMLElement & { value: string }).value)
}

/** Replaces what a line holds, typed as on a keyboard. */
async function taper(page: Page, n: number, texte: string) {
  await expect(region(page).locator(`math-field[aria-label="Expression ${n}"]`)).toBeAttached()
  const mf = region(page).locator(`math-field[aria-label="Expression ${n}"]`)
  await mf.click()
  // MathLive takes the focus just after the click: keys typed before it would be lost.
  await expect(mf).toBeFocused()
  await mf.evaluate((el) => (el as HTMLElement & { executeCommand(c: string): void }).executeCommand('selectAll'))
  await page.keyboard.type(texte)
}

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
  await expect.poll(() => latex(page, 1)).toBe('y=ax')
  await expect.poll(() => latex(page, 2)).toBe('a=1')
  await expect(courbe(page)).toHaveCount(1)
  const depart = await courbe(page).getAttribute('d')

  const curseur = region(page).getByRole('slider', { name: 'Curseur a' })
  for (let i = 0; i < 5; i++) await curseur.press('ArrowRight')
  await expect.poll(() => latex(page, 2)).toBe('a=1{,}5')
  await expect(courbe(page)).not.toHaveAttribute('d', depart ?? '')

  await taper(page, 1, 'y=2x+1')
  await expect.poll(() => latex(page, 1)).toBe('y=2x+1')
  await region(page).getByRole('button', { name: 'Revenir aux expressions de départ' }).click()
  await expect.poll(() => latex(page, 1)).toBe('y=ax')
  await expect.poll(() => latex(page, 2)).toBe('a=1')
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
  await expect.poll(() => latex(page, 1)).toBe('y=ax')
  await region(page).getByRole('button', { name: 'Ajouter une expression' }).click()
  await taper(page, 3, 'y=3x')
  await expect(region(page).getByRole('img', { name: /^Repère/ })).toHaveAccessibleName(/2 courbes/)

  await region(page)
    .getByRole('link', { name: 'Ouvrir cette calculatrice en grand, dans Explorer' })
    .click()
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL(/\/explorer\/calculatrice\?e=[A-Za-z0-9_-]+$/, { timeout: 20_000 })
  const main = page.getByRole('main')
  await expect.poll(() => latex(page, 1, main)).toBe('y=ax')
  await expect.poll(() => latex(page, 2, main)).toBe('a=1')
  await expect.poll(() => latex(page, 3, main)).toBe('y=3x')
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
