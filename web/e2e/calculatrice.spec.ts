import { expect, test, type Page } from '@playwright/test'

// The graphing calculator (#421, ADR 0049 §3): opened from Explorer › Les outils, a typed
// expression is drawn, an unknown letter gets its slider, the slider moves the curve, and the
// address keeps the work. Nothing is asked of the backend: the fake one needs no new route.

const repere = (page: Page) => page.getByRole('img', { name: /^Repère/ })
const courbes = (page: Page) => repere(page).locator('[data-courbe] path')

async function ouvrirDepuisExplorer(page: Page) {
  await page.goto('/explorer')
  await page
    .getByRole('region', { name: 'Les outils' })
    .getByRole('link', { name: /Calculatrice graphique/ })
    .click()
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL('/explorer/calculatrice', { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { level: 1, name: 'Calculatrice graphique' })
  ).toBeAttached()
}

test('Explorer opens the calculator, and a typed expression is drawn in the first colour', async ({
  page,
}) => {
  await ouvrirDepuisExplorer(page)
  const champ = page.getByRole('textbox', { name: 'Expression 1' })
  await expect(champ).toHaveAttribute('placeholder', 'Par exemple : y = 2x + 1')

  await champ.fill('y = x^2')
  await expect(courbes(page)).toHaveCount(1)
  await expect(courbes(page).first()).toHaveClass(/stroke-courbe-1/)
  await expect(courbes(page).first()).toHaveAttribute('d', /^M/)
})

test('a slider for an unknown letter moves the line, and the address keeps the work', async ({
  page,
}) => {
  await ouvrirDepuisExplorer(page)
  await page.getByRole('textbox', { name: 'Expression 1' }).fill('y = ax + 1')

  // The letter is not defined: no curve, and the offer to add its slider, once typing pauses.
  await expect(courbes(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Ajouter un curseur a' }).click()

  const curseur = page.getByRole('slider', { name: 'Curseur a' })
  await expect(curseur).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('a = 1')
  await expect(courbes(page)).toHaveCount(1)
  const avant = await courbes(page).first().getAttribute('d')

  for (let i = 0; i < 5; i++) await curseur.press('ArrowRight')
  await expect(curseur).toHaveAttribute('aria-valuetext', 'a = 1,5')
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('a = 1,5')
  await expect(courbes(page).first()).not.toHaveAttribute('d', avant ?? '')
  const apres = await courbes(page).first().getAttribute('d')

  // The state reaches the address after a pause, without a history entry per change.
  await expect(page).toHaveURL(/\/explorer\/calculatrice\?e=[A-Za-z0-9_-]+$/)
  await page.waitForFunction(() => {
    const e = new URLSearchParams(location.search).get('e') ?? ''
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(e.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    )
    return json.includes('a = 1,5')
  })
  const longueurHistorique = await page.evaluate(() => history.length)

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Expression 1' })).toHaveValue('y = ax + 1')
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('a = 1,5')
  await expect(courbes(page)).toHaveCount(1)
  await expect(courbes(page).first()).toHaveAttribute('d', apres ?? '')
  expect(await page.evaluate(() => history.length)).toBe(longueurHistorique)
})

test('an unreadable address opens an empty calculator, without an error', async ({ page }) => {
  await page.goto('/explorer/calculatrice?e=%%%pas-du-base64')
  await expect(page.getByRole('textbox', { name: 'Expression 1' })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveCount(0)
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
})

test('the page never scrolls sideways', async ({ page }) => {
  await page.goto('/explorer/calculatrice')
  await page.getByRole('textbox', { name: 'Expression 1' }).fill('y = x^2 + 2x - 3')
  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(deborde).toBe(false)
})
