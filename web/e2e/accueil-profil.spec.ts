import { expect, test } from '@playwright/test'

// Accueil and Profil (#324, #326). Everything they show comes from the fake backend, as it would
// from the real one; each Accueil block leads to the section that becomes active.

const NAV = { name: 'Navigation principale' }

test.describe('a student with homework and a chapter under way', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
  })

  test('Accueil leads to Ma classe and to the chapter', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Salut Renard-Indigo')
    await expect(page.getByRole('heading', { name: 'Pour ta classe · 5e B' })).toBeVisible()
    const nav = page.getByRole('navigation', NAV)
    await expect(nav.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')

    await expect(page.getByRole('link', { name: 'Continuer' })).toHaveAttribute(
      'href',
      '/3e/mathematiques/theoreme-de-pythagore'
    )

    await page.getByRole('link', { name: /Réviser Pythagore/ }).click()
    // next dev compiles the route on its first visit.
    await expect(page).toHaveURL('/ma-classe', { timeout: 20_000 })
    await expect(nav.getByRole('link', { name: 'Ma classe' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  test('Profil is an active section with both identities', async ({ page }) => {
    await page.goto('/profil')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil')
    await expect(page.getByText('Renard-Indigo', { exact: false })).toBeVisible()
    await expect(page.getByText('Dans ta classe 5e B')).toBeVisible()
    await expect(page.getByText('0 XP')).toBeVisible()
    await expect(
      page.getByRole('navigation', NAV).getByRole('link', { name: 'Profil' })
    ).toHaveAttribute('aria-current', 'page')
  })
})

test('a student with nothing to do yet chooses where to start', async ({
  context,
  baseURL,
  page,
}) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-sans-classe', url: baseURL ?? '' }])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choisis par où commencer' })).toBeVisible()
})
