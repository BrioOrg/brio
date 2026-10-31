import { expect, test } from '@playwright/test'

// Class salon (F6b, #270): the logged-in student reads the salon of their class, posts a message
// and can report someone else's. "/ma-classe" is a protected route — the middleware needs a
// session cookie, and the fake backend only serves the salon to the test student's session.

test.describe('Ma classe — salon de la classe', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
  })

  test('shows the salon and lets the student post a message', async ({ page }, testInfo) => {
    await page.goto('/ma-classe/salon')

    await expect(page.getByText('Salon de la 5e B')).toBeVisible()
    // The seeded conversation, from the teacher and a classmate.
    await expect(page.getByText('Bonjour la 5e B ! Pensez aux fractions pour mardi.')).toBeVisible()
    await expect(page.getByText('M. Dubois')).toBeVisible()
    await expect(page.getByText('Léa')).toBeVisible()

    // Unique per project: the fake backend keeps posted messages for the whole run, so chromium
    // and mobile must not collide on the same text.
    const mien = `Merci monsieur, c’est clair (${testInfo.project.name}) !`
    await page.getByLabel('Ton message').fill(mien)
    await page.getByRole('button', { name: 'Envoyer' }).click()

    // After sending, the thread reloads and the new message shows, attributed to the reader.
    const bulle = page.locator('li', { hasText: mien })
    await expect(bulle).toBeVisible()
    await expect(bulle.getByText('Toi')).toBeVisible()
  })

  test('reports another student’s message', async ({ page }) => {
    await page.goto('/ma-classe/salon')

    await expect(page.getByText('Bonjour monsieur, c’est noté.')).toBeVisible()
    // Léa's message carries a report button; the reader's own messages do not.
    await page.getByRole('button', { name: 'Signaler ce message' }).first().click()
    await page.getByRole('button', { name: 'Signaler' }).click()

    await expect(page.getByText('Signalé')).toBeVisible()
  })
})

test.describe('Ma classe — l’espace de la classe', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
  })

  test('shows the class and gives each tab its URL', async ({ page }) => {
    await page.goto('/ma-classe')

    await expect(
      page.getByRole('heading', { name: '5e B · Collège Jean Moulin · 2026-2027' })
    ).toBeVisible()
    await expect(page.getByText('Dans cette classe tu es Inès')).toBeVisible()
    await expect(page.getByText('Réviser Pythagore')).toBeVisible()

    const onglets = page.getByRole('navigation', { name: 'Espace de la classe' })
    await onglets.getByRole('link', { name: 'Cours du prof' }).click()
    await expect(page).toHaveURL('/ma-classe/cours')
    await expect(page.getByText('Les fractions, version M. Dubois')).toBeVisible()

    await onglets.getByRole('link', { name: 'Salon' }).click()
    await expect(page).toHaveURL('/ma-classe/salon')
    await expect(page.getByText('Salon de la 5e B')).toBeVisible()
  })

  test('the old homework URL redirects to the class space', async ({ page }) => {
    await page.goto('/devoirs')
    await expect(page).toHaveURL('/ma-classe')
  })

  test('a chapter shows the homework banner only when opened from the homework', async ({
    page,
  }) => {
    // The link itself needs the catalogue, which the fake backend doesn't serve: unit-tested.
    await page.goto('/3e/mathematiques/theoreme-de-pythagore?devoir=devoir-pythagore')

    const bandeau = page.getByText('Devoir de M. Dubois · à rendre le 20 octobre')
    await expect(bandeau).toBeVisible()

    await page.goto('/3e/mathematiques/theoreme-de-pythagore')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(bandeau).toHaveCount(0)
  })
})

test('a student in no class is asked to join one', async ({ page, context, baseURL }) => {
  // Another student, logged in but in no class: the backend serves no class — the empty state,
  // not the salon.
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-sans-classe', url: baseURL ?? '' }])
  await page.goto('/ma-classe')

  await expect(page.getByText(/Rejoins ta classe/)).toBeVisible()
  await expect(page.getByLabel('Ton message')).toHaveCount(0)
})
