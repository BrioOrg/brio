import { expect, test } from '@playwright/test'

// PL-4 (#364, ADR 0036) : le lien « Mot de passe oublié ? » de /connexion n'est plus mort.
// Il mène à un écran statique de récupération d'accès (200, pas 404) qui renvoie l'élève vers
// son prof et reboucle sur /rejoindre. La page ne soumet rien, donc aucune route à ajouter au
// faux backend. Vérifié sur les deux projets (desktop + mobile).
test.describe('récupération d’accès de l’élève', () => {
  test.beforeEach(async ({ context }) => {
    // Un élève bloqué est déconnecté : on part sans session, comme sur /connexion.
    await context.clearCookies()
  })

  test('depuis /connexion, le lien mène à un écran vivant qui renvoie vers le prof', async ({
    page,
  }) => {
    await page.goto('/connexion')

    await page.getByRole('link', { name: /mot de passe oublié/i }).click()

    // next dev compile la route à sa première visite.
    await expect(page).toHaveURL('/mot-de-passe-oublie', { timeout: 20_000 })

    // Pas un 404 : le titre de récupération est là.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/récupérer ton accès/i)

    // La consigne actionnable « va voir ton prof » est visible.
    await expect(page.getByText(/ton prof/i).first()).toBeVisible()

    // Aucun champ e-mail ni identifiant, rien à soumettre (AC2/AC5).
    await expect(page.getByRole('textbox')).toHaveCount(0)

    // Le rebouclage « Rejoindre ma classe » pointe vers le flux existant.
    await expect(page.getByRole('link', { name: /rejoindre ma classe/i })).toHaveAttribute(
      'href',
      '/rejoindre'
    )
  })

  test('« Revenir à la connexion » ramène à /connexion', async ({ page }) => {
    await page.goto('/mot-de-passe-oublie')

    await page.getByRole('link', { name: /revenir à la connexion/i }).click()

    await expect(page).toHaveURL('/connexion', { timeout: 20_000 })
    await expect(page.getByLabel(/identifiant ou e-mail/i)).toBeVisible()
  })
})
