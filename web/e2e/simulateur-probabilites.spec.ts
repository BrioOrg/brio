import { expect, test } from '@playwright/test'

test('opens the simulator from mathematics tools and runs an urn experiment', async ({ page }) => {
  await page.goto('/explorer')
  const tools = page.getByRole('region', { name: 'Les outils' })
  const maths = tools.getByRole('list', { name: 'Mathématiques' })
  await maths.getByRole('link', { name: /Simulateur de probabilités/ }).click()

  await expect(page).toHaveURL('/explorer/probabilites')
  await expect(
    page.getByRole('heading', { name: 'Simulateur de probabilités', level: 1 })
  ).toBeVisible()
  await page.getByRole('combobox', { name: 'Expérience' }).selectOption('urn')
  await expect(
    page.getByRole('row', { name: /Rouge/ }).getByRole('cell', { name: /^60\s*%$/ })
  ).toBeVisible()
  const result = page.getByRole('main').getByRole('status')
  await page.getByRole('button', { name: 'Lancer 10 essais' }).click()
  await expect(result).toHaveText('10 essais')

  await page.getByRole('button', { name: 'Remettre à zéro' }).click()
  await expect(result).toHaveText('0 essais')
})
