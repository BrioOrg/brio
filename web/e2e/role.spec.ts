import { expect, test, type Page } from '@playwright/test'

// The account's role in the top bar (#285), on desktop and on mobile: « Élève » for the test
// student, « Enseignant » for the test teacher — in the teacher space and in the student
// catalogue alike, since it is the account's role, from /api/moi. A logged-out visitor sees none.

async function expectRoleInTopBar(page: Page, visible: string, announced: string) {
  const badge = page.getByTestId('role-badge')
  await expect(badge).toHaveCount(1)
  await expect(badge).toBeVisible()
  await expect(badge).toHaveText(`${announced}${visible}`)
  // Fully on screen: the mobile bar must not push it out of the viewport.
  const box = await badge.boundingBox()
  const viewport = page.viewportSize()
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0)
}

test('a student reads « Élève » in the top bar', async ({ page }) => {
  await page.goto('/')
  await expectRoleInTopBar(page, 'Élève', 'Compte élève')
})

test.describe('as a teacher', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.clearCookies()
    await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
  })

  test('the teacher space reads « Enseignant »', async ({ page }) => {
    await page.goto('/prof')
    await expectRoleInTopBar(page, 'Enseignant', 'Compte enseignant')
  })

  test('the student catalogue still reads « Enseignant »', async ({ page }) => {
    await page.goto('/')
    await expectRoleInTopBar(page, 'Enseignant', 'Compte enseignant')
    await expect(page.getByText('Compte élève')).toHaveCount(0)
  })
})

test('a logged-out visitor sees no role', async ({ context, page }) => {
  await context.clearCookies()
  await page.goto('/connexion')
  await expect(page.getByRole('heading').first()).toBeVisible()
  await expect(page.getByTestId('role-badge')).toHaveCount(0)
})
