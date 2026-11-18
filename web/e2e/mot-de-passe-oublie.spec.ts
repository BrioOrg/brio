import { expect, test } from '@playwright/test'

// PL-4 (#364, ADR 0036) : le lien « Identifiant ou mot de passe oublié ? » de /connexion mène à un écran vivant
// (200, pas 404) qui dit la vérité : le prof réinitialise l'accès du compte EXISTANT de l'élève.
// La page ne soumet rien. Vérifié sur les deux projets (desktop + mobile).
test.describe('récupération d’accès de l’élève', () => {
  test.beforeEach(async ({ context }) => {
    // Un élève bloqué est déconnecté : on part sans session, comme sur /connexion.
    await context.clearCookies()
  })

  test('depuis /connexion, le lien mène à la consigne « va voir ton prof »', async ({ page }) => {
    await page.goto('/connexion')

    await page.getByRole('link', { name: 'Identifiant ou mot de passe oublié ?' }).click()

    // next dev compile la route à sa première visite.
    await expect(page).toHaveURL('/mot-de-passe-oublie', { timeout: 20_000 })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/récupérer ton accès/i)

    // La consigne vient en premier et couvre identifiant ET mot de passe, pour SON compte.
    // Le paragraphe juste sous le titre.
    const consigne = page.locator('h1 + p')
    await expect(consigne).toContainText(/va voir ton prof/i)
    await expect(consigne).toBeVisible()
    await expect(consigne).toContainText(/ton identifiant et un mot de passe provisoire/i)
    await expect(page.getByText(/il expire au bout de 7\s*jours/i)).toBeVisible()
    // Pas d'autre solution, pas de nouveau compte (arbitrage N3).
    await expect(page.getByText(/il n’y a pas d’autre solution/i)).toBeVisible()
    await expect(page.getByText(/ne crée pas de nouveau compte/i)).toBeVisible()

    // Aucun champ, rien à soumettre (AC2/AC5), et plus de renvoi vers /rejoindre.
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.locator('a[href="/rejoindre"]')).toHaveCount(0)
  })

  test('« Revenir à la connexion » ramène à /connexion', async ({ page }) => {
    await page.goto('/mot-de-passe-oublie')

    await page.getByRole('link', { name: 'Revenir à la connexion' }).click()

    await expect(page).toHaveURL('/connexion', { timeout: 20_000 })
    await expect(page.getByLabel(/identifiant ou e-mail/i)).toBeVisible()
  })
})
