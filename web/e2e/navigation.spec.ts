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
  await expect(nav.getByRole('button', { name: /Profil/ })).toHaveCount(0)

  const parcours = nav.getByRole('link', { name: 'Parcours' })
  await expect(parcours).toHaveAttribute('aria-current', 'page')

  // The label shows as an infobulle on hover.
  await nav.getByRole('link', { name: 'Ma classe' }).hover()
  await expect(page.getByRole('tooltip')).toHaveText('Ma classe')

  await nav.getByRole('link', { name: 'Ma classe' }).click()
  await expect(page).toHaveURL('/ma-classe')
  await expect(nav.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Parcours' })).not.toHaveAttribute('aria-current')
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
  await expect(nav.getByRole('button', { name: /Profil/ })).toBeDisabled()

  await nav.getByRole('link', { name: 'Ma classe' }).click()
  await expect(page).toHaveURL('/ma-classe')
  await expect(nav.getByRole('link', { name: 'Ma classe' })).toHaveAttribute('aria-current', 'page')
})
