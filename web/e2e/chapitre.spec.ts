import { expect, test } from '@playwright/test'

test('should render a catalogue chapter served by the backend', async ({ page }) => {
  await page.goto('/3e/mathematiques/theoreme-de-pythagore')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Le théorème de Pythagore' })
  ).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Énoncé du théorème' })).toBeVisible()
})
