import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// The Communauté (#337, ADR 0035). A student cannot keep their own answer, so the journey takes two:
// replacing the session cookie makes the same browser the other student, device and all.

const ANSWER_ZONE = { name: 'Ta réponse', exact: true }

// E2E_SESSION and E2E_SESSION_SANS_CLASSE in fake-backend.mjs; importing it would start the server.
const AUTEUR = 'e2e-eleve'
const REPONDEUR = 'e2e-sans-classe'

async function devenir(context: BrowserContext, session: string, baseURL: string | undefined) {
  await context.addCookies([{ name: 'JSESSIONID', value: session, url: baseURL ?? '' }])
}

/** A click before hydration is lost. */
async function hydrate(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="toolbar"]')
    return el && Object.keys(el).some((k) => k.startsWith('__react'))
  })
}

async function ecrireDans(page: Page, nom: { name: string; exact: boolean }, texte: string) {
  await hydrate(page)
  await page.getByRole('textbox', nom).click()
  await page.keyboard.type(texte)
}

test('asks a question, answers it, and marks it as solved', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  // Unique per project and attempt: the fake backend keeps what is posted for the whole run.
  const titre = `Pourquoi 2 + 2 = 4 ? (${testInfo.project.name} ${testInfo.retry})`

  await page.goto('/communaute')
  await page.getByRole('link', { name: 'Poser une question' }).click()
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL('/communaute/nouvelle', { timeout: 20_000 })

  await ecrireDans(page, { name: 'Ta question', exact: true }, 'Je ne vois pas pourquoi.')
  await page.getByRole('textbox', { name: 'Titre de ta question' }).fill(titre)
  await page.getByRole('button', { name: 'Publier ma question' }).click()

  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText('Renard-Indigo · 5e')).toBeVisible()
  await expect(page.getByText('Pas encore de réponse')).toBeVisible()
  // One's own question: the count, but no vote.
  await expect(page.getByRole('button', { name: /^Utile/ })).toHaveCount(0)
  const urlDuFil = page.url()

  // The other student finds it in the list of their level, and answers.
  await devenir(context, REPONDEUR, baseURL)
  await page.goto('/communaute')
  await page.getByRole('link', { name: titre }).click()
  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible({
    timeout: 20_000,
  })
  await ecrireDans(page, ANSWER_ZONE, 'Compte sur tes doigts.')
  await page.getByRole('button', { name: 'Publier ma réponse' }).click()
  await expect(page.getByText('Compte sur tes doigts.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '1 réponse' })).toBeVisible()
  // The composer is empty again.
  await expect(page.getByRole('textbox', ANSWER_ZONE)).toHaveText('')
  // Only the question's author can mark it.
  await expect(page.getByRole('button', { name: 'Marquer comme résolue' })).toHaveCount(0)

  // They find the question useful.
  const utile = page.getByRole('article').getByRole('button', { name: /^Utile/ })
  await expect(utile).toHaveAccessibleName('Utile · 0')
  await utile.click()
  await expect(utile).toHaveAccessibleName('Utile · 1')
  await expect(utile).toHaveAttribute('aria-pressed', 'true')

  // Back to the author, who comments and keeps the answer.
  await devenir(context, AUTEUR, baseURL)
  await page.goto(urlDuFil)
  await expect(page.getByText('Loutre-Corail · 5e')).toBeVisible()
  await hydrate(page)

  await page.getByRole('button', { name: 'Commenter' }).click()
  await ecrireDans(page, { name: 'Ton commentaire', exact: true }, 'Merci pour l’idée !')
  await page.getByRole('button', { name: 'Publier mon commentaire' }).click()
  const commentaires = page.getByRole('list', { name: 'Commentaires' })
  await expect(commentaires.getByText('Merci pour l’idée !')).toBeVisible()
  // No vote on a comment (ADR 0035 §5).
  await expect(commentaires.getByRole('button', { name: /^Utile/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Marquer comme résolue' }).click()
  await expect(page.getByText('A résolu la question')).toBeVisible()
  await expect(page.getByRole('article').getByText('Résolue')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marquer comme résolue' })).toHaveCount(0)

  // The list says so too.
  await page.goto('/communaute')
  await expect(page.getByRole('link', { name: titre }).getByText('Résolue')).toBeVisible()
})

test('opens on the student’s level, and every level is one filter away', async ({ page }) => {
  await page.goto('/communaute')
  const question3e = page.getByRole('link', { name: /Comment développer/ })
  await expect(page.getByRole('heading', { level: 1, name: 'Communauté' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Niveau' })).toHaveValue('5e')
  await expect(question3e).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Niveau' }).selectOption('tous')
  await expect(page).toHaveURL(/niveau=tous/, { timeout: 20_000 })
  await expect(question3e).toBeVisible()
  await expect(question3e.getByText('Hibou-Turquoise · 3e')).toBeVisible()

  await page.getByRole('combobox', { name: 'Matière' }).selectOption('mathematiques')
  await expect(page).toHaveURL(/niveau=tous&matiere=mathematiques/)
  await expect(question3e).toBeVisible()
})

test('says so when no question matches, and fabricates nothing', async ({ page }) => {
  await page.goto('/communaute?niveau=6e')
  await expect(page.getByText('Aucune question pour l’instant')).toBeVisible()
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(0)
})

test('edits and deletes one’s own question', async ({ page }, testInfo) => {
  const titre = `À corriger (${testInfo.project.name} ${testInfo.retry})`
  await page.goto('/communaute/nouvelle')
  await ecrireDans(page, { name: 'Ta question', exact: true }, 'Une fote.')
  await page.getByRole('textbox', { name: 'Titre de ta question' }).fill(titre)
  await page.getByRole('button', { name: 'Publier ma question' }).click()
  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible({
    timeout: 20_000,
  })
  await hydrate(page)

  await page.getByRole('button', { name: 'Modifier ma question' }).click()
  const zone = page.getByRole('textbox', { name: 'Ta question', exact: true })
  await expect(zone).toHaveText('Une fote.')
  await zone.click()
  await page.keyboard.type(' Corrigé.')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('article').getByText('Une fote. Corrigé.')).toBeVisible()
  await expect(page.getByText(/modifié/)).toBeVisible()

  await page.getByRole('button', { name: 'Supprimer ma question' }).click()
  await page.getByRole('button', { name: 'Oui, supprimer' }).click()
  await expect(page).toHaveURL('/communaute', { timeout: 20_000 })
  await expect(page.getByRole('link', { name: titre })).toHaveCount(0)
})

test('a question that does not exist is not found, a malformed link either', async ({ page }) => {
  for (const id of ['00000000-0000-4000-8000-000000000999', 'pas-un-identifiant']) {
    await page.goto(`/communaute/${id}`)
    await expect(page.getByText('Cette question n’existe pas ou plus')).toBeVisible()
  }
})

test('the thread stays within the screen on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile layout')
  await page.goto('/communaute?niveau=tous')
  await page.getByRole('link', { name: /Comment développer/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Comment développer/ })).toBeVisible({
    timeout: 20_000,
  })
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(largeur).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
})

test('Communauté is the active section on its pages', async ({ page }) => {
  await page.goto('/communaute/nouvelle')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link', { name: 'Communauté' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})
