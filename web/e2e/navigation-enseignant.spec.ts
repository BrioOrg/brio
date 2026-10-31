import { expect, test } from '@playwright/test'

// The teacher section navigation (#286), like the student one (#283): a left icon sidebar on
// desktop, the bottom bar on mobile. Both are in the page, one hidden by width, so a role
// query only finds the one shown. The fake backend has no teacher data (/api/prof/** is a
// 404): the pages show their error, the navigation is all this spec looks at.

const NAV = "Navigation de l'espace enseignant"

test.beforeEach(async ({ context, baseURL }) => {
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
})

test('the teacher sections sit in a left icon sidebar on desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'desktop layout')
  await page.goto('/prof')

  const nav = page.getByRole('navigation', { name: NAV })
  await expect(nav).toHaveCount(1)
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()
  expect(box?.x).toBe(0)
  expect(box?.height).toBe(viewport?.height)

  await expect(nav.getByRole('link', { name: 'Mes cours' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('link', { name: 'Mes classes' }).click()
  await expect(page).toHaveURL('/prof/classes')
  await expect(nav.getByRole('link', { name: 'Mes classes' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(nav.getByRole('link', { name: 'Mes cours' })).not.toHaveAttribute('aria-current')
})

test('the teacher sections are in a bottom bar on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile layout')
  await page.goto('/prof')

  const nav = page.getByRole('navigation', { name: NAV })
  await expect(nav).toHaveCount(1)
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()
  // Pinned to the bottom edge, across the full width.
  expect(box?.width).toBe(viewport?.width)
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(viewport?.height ?? 0, 0)
  await expect(nav.getByRole('link')).toHaveCount(5)
  await expect(nav.getByRole('button')).toHaveCount(0)

  await nav.getByRole('link', { name: 'Signalements du salon' }).click()
  await expect(page).toHaveURL('/prof/signalements-salon')
  await expect(nav.getByRole('link', { name: 'Signalements du salon' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(nav.getByRole('link', { name: 'Signalements', exact: true })).not.toHaveAttribute(
    'aria-current'
  )
})
