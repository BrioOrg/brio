import { expect, test } from '@playwright/test'

// The student section navigation (#283): a left icon sidebar on desktop, the bottom bar on
// mobile. Both are in the page, one hidden by width, so a role query only finds the one shown.

test('the sections sit in a left icon sidebar on desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'desktop layout')
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav).toHaveCount(1)
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()
  expect(box?.x).toBe(0)
  expect(box?.height).toBe(viewport?.height)
  // No bottom-bar-only tab on desktop.
  await expect(nav.getByRole('button', { name: /Communauté|Profil/ })).toHaveCount(0)

  // "/" redirects to Explorer until the Accueil page exists (#324).
  await expect(page).toHaveURL('/explorer')
  await expect(nav.getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('link', { name: 'Ma classe' }).click()
  await expect(page).toHaveURL('/ma-classe')
  await expect(nav.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Explorer' })).not.toHaveAttribute('aria-current')
})

test('hovering the sidebar widens it over the page, without moving the page', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'desktop layout')
  await page.goto('/ma-classe')

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  const panel = page.getByTestId('section-sidebar-panel')
  const main = page.getByRole('main')
  await expect(panel).toHaveCSS('width', '64px')
  const before = await main.boundingBox()

  // No infobulle any more: the panel carries every label at once.
  await nav.getByRole('link', { name: 'Ma classe' }).hover()
  await expect(panel).toHaveCSS('width', '240px')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  expect(await main.boundingBox()).toEqual(before)
  expect((await nav.boundingBox())?.width).toBe(64)

  await page.mouse.move(600, 400)
  await expect(panel).toHaveCSS('width', '64px')
})

test('keyboard focus widens the sidebar and Escape closes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'desktop layout')
  await page.goto('/ma-classe')

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  const panel = page.getByTestId('section-sidebar-panel')
  const link = nav.getByRole('link', { name: 'Ma classe' })
  // Clicks and keys sent before hydration are lost, so wait until focus actually opens it.
  await expect(async () => {
    await page.locator('body').click({ position: { x: 600, y: 5 } })
    await nav.getByRole('link').first().focus()
    await page.keyboard.press('Tab')
    await expect(panel).toHaveCSS('width', '240px', { timeout: 1_000 })
  }).toPass()
  await expect(link).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(panel).toHaveCSS('width', '64px')
})

test('the bottom bar is kept on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile layout')
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav).toHaveCount(1)
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()
  // Pinned to the bottom edge, across the full width.
  expect(box?.width).toBe(viewport?.width)
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(viewport?.height ?? 0, 0)
  await expect(nav.getByRole('button', { name: /Communauté/ })).toBeDisabled()
  await expect(nav.getByRole('button', { name: /Profil/ })).toBeDisabled()

  await nav.getByRole('link', { name: 'Ma classe' }).click()
  await expect(page).toHaveURL('/ma-classe')
  await expect(nav.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('aria-current', 'page')
})
