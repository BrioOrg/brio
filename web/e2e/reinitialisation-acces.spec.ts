import { expect, test, type Page } from '@playwright/test'

// ADR 0036 (#364), de bout en bout : le prof réinitialise l'accès d'un élève de sa classe et voit
// une fois son identifiant et un mot de passe provisoire (masqué tant qu'il ne demande pas à le
// voir) ; l'élève se connecte avec, doit choisir son propre mot de passe, puis arrive à l'accueil
// — sur son compte, du premier coup (AC8) — où il est prévenu de la réinitialisation.

/** The result panel's identifier and provisional password, revealed on purpose. */
async function lireAcces(page: Page) {
  const acces = page.getByRole('region', { name: 'Nouvel accès de Inès' })
  await expect(acces).toContainText(/affiché une seule fois/i)
  await expect(acces).toContainText(/n’affichez pas cet écran au tableau/i)
  // Masked by default.
  await expect(acces.getByTestId('mot-de-passe-provisoire')).toHaveCount(0)
  await acces.getByRole('button', { name: 'Afficher' }).click()
  const identifiant = (await acces.getByTestId('identifiant-connexion').textContent())?.trim() ?? ''
  const provisoire =
    (await acces.getByTestId('mot-de-passe-provisoire').textContent())?.trim() ?? ''
  return { identifiant, provisoire }
}

async function reinitialiserInes(page: Page) {
  await page.goto('/prof/classes/classe-4eA')
  // next dev compile la route à sa première visite.
  await page
    .getByRole('button', { name: 'Réinitialiser l’accès de Inès' })
    .click({ timeout: 20_000 })
  const confirmation = page.getByRole('group', {
    name: 'Confirmer la réinitialisation de l’accès de Inès',
  })
  await expect(confirmation).toContainText(/garde son compte/i)
  await expect(confirmation).toContainText(/sessions seront fermées/i)
  await expect(confirmation).toBeFocused()
  await confirmation.getByRole('button', { name: 'Réinitialiser l’accès' }).click()
  return lireAcces(page)
}

test('le prof réinitialise l’accès, l’élève choisit son mot de passe et arrive à l’accueil', async ({
  context,
  page,
  baseURL,
}) => {
  // ── Le prof ──
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
  const { identifiant, provisoire } = await reinitialiserInes(page)
  expect(identifiant).not.toBe('')
  expect(provisoire).toMatch(
    /^[23456789a-hjkmnp-z]{4}-[23456789a-hjkmnp-z]{4}-[23456789a-hjkmnp-z]{4}$/
  )

  // ── L'élève, sur un autre poste : aucune session ──
  await context.clearCookies()
  await page.goto('/connexion')
  await page.getByLabel(/identifiant ou e-mail/i).fill(identifiant)
  // Tapé sans les tirets et en majuscules : accepté quand même (ADR 0036 §2).
  await page
    .getByLabel('Mot de passe', { exact: true })
    .fill(provisoire.replace(/-/g, '').toUpperCase())
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()

  // Forcé de choisir son mot de passe avant tout le reste.
  await expect(page).toHaveURL('/changer-mot-de-passe', { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/choisis ton mot de passe/i)

  await expect(page.getByRole('note')).toContainText(/fais-le maintenant/i)

  // Aucune autre page n'est accessible tant que ce n'est pas fait — la connexion non plus.
  await page.goto('/ma-classe')
  await expect(page).toHaveURL('/changer-mot-de-passe', { timeout: 20_000 })
  await page.goto('/connexion')
  await expect(page).toHaveURL('/changer-mot-de-passe', { timeout: 20_000 })

  await page.getByLabel('Ton nouveau mot de passe').fill('ma-phrase-a-moi')
  await page.getByLabel('Retape-le pour vérifier').fill('ma-phrase-a-moi')
  await page.getByRole('button', { name: /enregistrer mon mot de passe/i }).click()

  // À l'accueil, sur son compte, prévenu de la réinitialisation (ADR 0036 §8).
  await expect(page).toHaveURL('/', { timeout: 20_000 })
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(1)
  const avis = page.getByRole('status').filter({ hasText: /ton accès a été réinitialisé/i })
  await expect(avis).toContainText(/par ton prof/i)
  await expect(avis).toContainText(/préviens ton prof/i)
  await avis.getByRole('button', { name: 'Fermer ce message' }).click()
  await expect(avis).toHaveCount(0)
})

test('un mot de passe provisoire ne sert qu’une fois', async ({ context, page, baseURL }) => {
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
  const { identifiant, provisoire } = await reinitialiserInes(page)

  async function connexion() {
    await context.clearCookies()
    await page.goto('/connexion')
    await page.getByLabel(/identifiant ou e-mail/i).fill(identifiant)
    await page.getByLabel('Mot de passe', { exact: true }).fill(provisoire)
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  }

  await connexion()
  await expect(page).toHaveURL('/changer-mot-de-passe', { timeout: 20_000 })

  // Deuxième fois : le même message qu'un mauvais mot de passe.
  await connexion()
  // (Next's route announcer is also an alert: find the message by its text.)
  await expect(page.getByText(/identifiant ou mot de passe incorrect/i)).toBeVisible()
  await expect(page).toHaveURL('/connexion')
})

test('l’élève peut se déconnecter pendant le changement, au prix du provisoire', async ({
  context,
  page,
  baseURL,
}) => {
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
  const { identifiant, provisoire } = await reinitialiserInes(page)

  await context.clearCookies()
  await page.goto('/connexion')
  await page.getByLabel(/identifiant ou e-mail/i).fill(identifiant)
  await page.getByLabel('Mot de passe', { exact: true }).fill(provisoire)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL('/changer-mot-de-passe', { timeout: 20_000 })

  // The provisional password again is refused (422), the page stays.
  await page.getByLabel('Ton nouveau mot de passe').fill(provisoire)
  await page.getByLabel('Retape-le pour vérifier').fill(provisoire)
  await page.getByRole('button', { name: /enregistrer mon mot de passe/i }).click()
  await expect(page.getByText(/différent du mot de passe provisoire/i)).toBeVisible()

  await page.getByRole('button', { name: /se déconnecter/i }).click()
  await expect(page).toHaveURL(/\/connexion/, { timeout: 20_000 })
})
