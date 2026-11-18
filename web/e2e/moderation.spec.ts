import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Moderation of the Communauté (#338, ADR 0044), played as the mesh's gate 6: a student reports a
// message, the Brio admin reaches the console from the top bar and masks it, the message is gone for
// the students. The saboteur double-clicks, and tries to report their own message.

// E2E_SESSION, E2E_SESSION_SANS_CLASSE and E2E_SESSION_ADMIN in fake-backend.mjs; importing it would
// start the server.
const ELEVE = 'e2e-eleve' // Renard-Indigo
const AUTRE_ELEVE = 'e2e-sans-classe' // Loutre-Corail
const ADMIN = 'e2e-admin'

async function devenir(context: BrowserContext, session: string, baseURL: string | undefined) {
  await context.addCookies([{ name: 'JSESSIONID', value: session, url: baseURL ?? '' }])
}

/** A question posted straight to the API, as another student would have. */
async function poser(page: Page, titre: string): Promise<string> {
  await page.goto('/communaute')
  const res = await page.request.post('/api/communaute/questions', {
    data: { titre, corps: [{ id: 'p', type: 'prose', text: 'Un message à vérifier.' }] },
  })
  expect(res.status()).toBe(201)
  return ((await res.json()) as { id: string }).id
}

/** A click before hydration is lost. */
async function hydrate(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('main button')
    return el && Object.keys(el).some((k) => k.startsWith('__react'))
  })
}

test('a student reports a message, the admin masks it from the console', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  // Four pages, two of them compiled cold by next dev (the console and the thread).
  test.slow()
  // Unique per project and attempt: the fake backend keeps everything for the whole run.
  const titre = `Message à signaler (${testInfo.project.name} ${testInfo.retry})`

  // Another student posts; ours opens it from the list of their level.
  await devenir(context, AUTRE_ELEVE, baseURL)
  const id = await poser(page, titre)
  await devenir(context, ELEVE, baseURL)
  await page.goto('/communaute')
  await page.getByRole('link', { name: titre }).click()
  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible({
    timeout: 20_000,
  })
  await hydrate(page)

  // Report it with a reason; the saboteur double-clicks the send button.
  await page.getByRole('button', { name: 'Signaler' }).click()
  const motif = page.getByRole('textbox', { name: 'Pourquoi signaler ? (facultatif)' })
  await expect(motif).toBeFocused()
  await motif.fill('Propos blessants')
  await page.getByRole('button', { name: 'Envoyer le signalement' }).dblclick()
  const merci = page.getByRole('status').filter({ hasText: 'Merci, l’équipe brio' })
  await expect(merci).toBeVisible()
  await expect(merci).toBeFocused()

  // The admin lands on the catalogue and finds the console in the top bar, in one click.
  await devenir(context, ADMIN, baseURL)
  await page.goto('/explorer')
  await page.getByRole('link', { name: 'Modération' }).click()
  await expect(page).toHaveURL('/admin/communaute', { timeout: 20_000 })
  const carte = page
    .getByRole('article', { name: 'Question signalée de Loutre-Corail' })
    .filter({ hasText: titre })
  await expect(carte).toBeVisible({ timeout: 20_000 })
  // One report, despite the double click.
  await expect(carte.getByText(/^1 signalement · depuis le/)).toBeVisible()
  await expect(carte.getByText('Propos blessants')).toBeVisible()

  await carte.getByRole('textbox', { name: 'Motif de la décision (facultatif)' }).fill('Blessant')
  await carte.getByRole('button', { name: 'Masquer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Contenu masqué.' })).toHaveCount(1)
  await expect(carte).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Contenus signalés' })).toBeFocused()

  // The message is gone for the students, list and thread alike.
  await devenir(context, ELEVE, baseURL)
  await page.goto('/communaute')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('link', { name: titre })).toHaveCount(0)
  const fil = await page.request.get(`/api/communaute/questions/${id}`)
  expect(fil.status()).toBe(404)
})

test('a student cannot report their own message', async ({ page, context, baseURL }, testInfo) => {
  const titre = `Ma propre question (${testInfo.project.name} ${testInfo.retry})`
  await devenir(context, ELEVE, baseURL)
  const id = await poser(page, titre)

  await page.goto('/communaute')
  await page.getByRole('link', { name: titre }).click()
  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('button', { name: 'Signaler' })).toHaveCount(0)

  // The saboteur goes around the interface: the server refuses too.
  const res = await page.request.post(`/api/communaute/questions/${id}/signalement`, {
    data: { motif: 'moi-même' },
  })
  expect(res.status()).toBe(403)
})

test('the console stays closed to a student', async ({ page, context, baseURL }) => {
  await devenir(context, ELEVE, baseURL)
  await page.goto('/explorer')
  await expect(page.getByRole('link', { name: 'Modération' })).toHaveCount(0)

  await page.goto('/admin/communaute')
  await expect(page).not.toHaveURL(/\/admin/, { timeout: 20_000 })
})
