import { expect, test } from '@playwright/test'

// ADR 0036 (#364), de bout en bout : le prof réinitialise l'accès d'un élève de sa classe et voit
// une fois son identifiant et un mot de passe provisoire ; l'élève se connecte avec, doit choisir
// son propre mot de passe, puis arrive à l'accueil — sur son compte, du premier coup (AC8).
test('le prof réinitialise l’accès, l’élève choisit son mot de passe et arrive à l’accueil', async ({
  context,
  page,
  baseURL,
}) => {
  // ── Le prof ──
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
  await page.goto('/prof/classes/classe-4eA')

  // next dev compile la route à sa première visite.
  await page
    .getByRole('button', { name: 'Réinitialiser l’accès de Inès' })
    .click({ timeout: 20_000 })
  const confirmation = page.getByRole('group', {
    name: 'Confirmer la réinitialisation de l’accès de Inès',
  })
  await expect(confirmation).toContainText(/garde son compte/i)
  await confirmation.getByRole('button', { name: 'Réinitialiser l’accès' }).click()

  const acces = page.getByRole('status', { name: 'Nouvel accès de Inès' })
  await expect(acces).toContainText(/affiché une seule fois/i)
  const identifiant = (await acces.getByTestId('identifiant-connexion').textContent())?.trim() ?? ''
  const provisoire =
    (await acces.getByTestId('mot-de-passe-provisoire').textContent())?.trim() ?? ''
  expect(identifiant).not.toBe('')
  expect(provisoire).toMatch(
    /^[23456789a-hjkmnp-z]{4}-[23456789a-hjkmnp-z]{4}-[23456789a-hjkmnp-z]{4}$/
  )

  // ── L'élève, sur un autre poste : aucune session ──
  await context.clearCookies()
  await page.goto('/connexion')
  await page.getByLabel(/identifiant ou e-mail/i).fill(identifiant)
  await page.getByLabel('Mot de passe', { exact: true }).fill(provisoire)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()

  // Forcé de choisir son mot de passe avant tout le reste.
  await expect(page).toHaveURL('/changer-mot-de-passe', { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/choisis ton mot de passe/i)

  // Aucune autre page n'est accessible tant que ce n'est pas fait.
  await page.goto('/ma-classe')
  await expect(page).toHaveURL('/changer-mot-de-passe', { timeout: 20_000 })

  await page.getByLabel('Ton nouveau mot de passe').fill('ma-phrase-a-moi')
  await page.getByLabel('Retape-le pour vérifier').fill('ma-phrase-a-moi')
  await page.getByRole('button', { name: /enregistrer mon mot de passe/i }).click()

  // À l'accueil, sur son compte.
  await expect(page).toHaveURL('/', { timeout: 20_000 })
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(1)
})

test('un mot de passe provisoire ne sert qu’une fois', async ({ context, page, baseURL }) => {
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
  await page.goto('/prof/classes/classe-4eA')
  await page
    .getByRole('button', { name: 'Réinitialiser l’accès de Inès' })
    .click({ timeout: 20_000 })
  await page
    .getByRole('group', { name: /confirmer la réinitialisation/i })
    .getByRole('button', { name: 'Réinitialiser l’accès' })
    .click()
  const acces = page.getByRole('status', { name: 'Nouvel accès de Inès' })
  const identifiant = (await acces.getByTestId('identifiant-connexion').textContent())?.trim() ?? ''
  const provisoire =
    (await acces.getByTestId('mot-de-passe-provisoire').textContent())?.trim() ?? ''

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
