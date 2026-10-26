import { expect, test, type Page } from '@playwright/test'

// The burger menu and the Paramètres page (#282): reachable by a student from the app shell
// and by a teacher from the teacher space, with the theme choice applied at once and kept.
// Runs in both projects (desktop and mobile): the burger is in the top bar at every width.

/** Opens the burger menu. A click before React hydrates the page is lost: retry until open. */
async function ouvrirMenu(page: Page) {
  const bouton = page.getByRole('button', { name: 'Menu' })
  await expect(async () => {
    if ((await bouton.getAttribute('aria-expanded')) !== 'true') await bouton.click()
    await expect(bouton).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 })
  }).toPass()
  return bouton
}

test('a student opens Paramètres from the burger menu and changes the theme', async ({ page }) => {
  await page.goto('/')
  const bouton = await ouvrirMenu(page)

  // Escape closes the menu and gives the focus back to the button.
  await expect(page.getByRole('menuitem', { name: 'Paramètres' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(bouton).toHaveAttribute('aria-expanded', 'false')
  await expect(bouton).toBeFocused()

  await ouvrirMenu(page)
  await page.getByRole('menuitem', { name: 'Paramètres' }).click()
  await expect(page).toHaveURL('/parametres')
  await expect(page.getByRole('heading', { name: 'Paramètres', level: 1 })).toBeVisible()

  const theme = page.getByRole('group', { name: 'Thème' })
  await theme.getByText('Sombre', { exact: true }).click()
  await expect(theme.getByRole('radio', { name: /Sombre/ })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // Kept in this browser: still dark after a reload, before React even runs.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('radio', { name: /Sombre/ })).toBeChecked()

  await page.getByRole('group', { name: 'Thème' }).getByText('Clair', { exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('a teacher reaches Paramètres from the teacher space', async ({ page, context, baseURL }) => {
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
  await page.goto('/prof')

  await ouvrirMenu(page)
  await page.getByRole('menuitem', { name: 'Paramètres' }).click()
  await expect(page).toHaveURL('/parametres')
  await expect(page.getByRole('group', { name: 'Thème' })).toBeVisible()
})
