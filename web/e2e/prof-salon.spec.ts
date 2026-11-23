import { randomUUID } from 'node:crypto'

import { expect, request as nouvelleRequete, test, type BrowserContext } from '@playwright/test'

// PL-7 (#399): the teacher reads, writes and hides messages in the salon of a class, from the
// class page. Runs on the desktop and mobile projects. The fake backend gives the test teacher a
// class apart, 3e C, with its own salon (fake-backend.mjs): 5e B, read by ma-classe.spec, is not
// touched. Both projects share one fake backend for the whole run, so every test writes a unique
// text and hides only messages it wrote itself.

const NAV = "Navigation de l'espace enseignant"
const CLASSE_3EC = '/prof/classes/classe-3eC'
const SALON_3EC = '00000000-0000-4000-8000-0000000053c0'
// Seed of the 3e C salon, oldest first (fake-backend.mjs).
const DU_PROF = 'Bonjour la 3e C, le salon de la classe est ouvert.'
const DE_NOE = 'Bonjour monsieur, bien reçu.'
const DEJA_MASQUE = 'Un message hors sujet, déjà masqué.'

async function sessionDe(context: BrowserContext, baseURL: string | undefined, valeur: string) {
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value: valeur, url: baseURL ?? '' }])
}

test.beforeEach(async ({ context, baseURL }) => {
  await sessionDe(context, baseURL, 'e2e-enseignant')
})

// critère 1 + critère 4
test('reads the salon of a class in 2 clicks from /prof', async ({ page }) => {
  await page.goto('/prof')

  const nav = page.getByRole('navigation', { name: NAV })
  // Click 1: « Mes classes » (left sidebar on desktop, bottom bar on mobile).
  await nav.getByRole('link', { name: 'Mes classes' }).click()
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL('/prof/classes', { timeout: 20_000 })
  // Click 2: the class.
  await page.getByRole('link', { name: /3e C/ }).first().click()
  await expect(page).toHaveURL(CLASSE_3EC, { timeout: 20_000 })

  // The salon is rendered right away, at the top of the page: no third gesture, no scrolling.
  const salon = page.getByRole('region', { name: 'Salon de la classe' })
  const liste = salon.getByRole('list', { name: 'Messages du salon' })
  await expect(liste.getByText(DE_NOE)).toBeVisible({ timeout: 20_000 })
  await expect(salon).toBeInViewport()

  // Chronological order, author and « Toi » for the teacher's own.
  const textes = await liste.getByRole('article').allTextContents()
  const rang = (t: string) => textes.findIndex((x) => x.includes(t))
  expect(rang(DU_PROF)).toBeGreaterThanOrEqual(0)
  expect(rang(DU_PROF)).toBeLessThan(rang(DE_NOE))
  expect(rang(DE_NOE)).toBeLessThan(rang(DEJA_MASQUE))
  const duProf = liste.getByRole('article').filter({ hasText: DU_PROF })
  await expect(duProf.getByText('Toi')).toBeVisible()
  // Porte 5 (V5): no « Masquer » on the teacher's own message.
  await expect(duProf.getByRole('button', { name: /masquer/i })).toHaveCount(0)
  await expect(
    liste.getByRole('article').filter({ hasText: DE_NOE }).getByText('Noé')
  ).toBeVisible()

  // critère 4: the hidden message is shown to the teacher, marked, its body folded until asked
  // (porte 5, V5: the page may be projected); no « Signaler » anywhere.
  const masque = liste.getByRole('article', { name: 'Message masqué de Lou' })
  await expect(masque.getByText('Masqué', { exact: true })).toBeVisible()
  await expect(masque.getByText('Lou')).toBeVisible()
  await expect(masque.getByText(DEJA_MASQUE)).toBeHidden()
  await expect(masque.getByRole('button', { name: /^masquer/i })).toHaveCount(0)
  const bascule = masque.getByRole('button', {
    name: 'Afficher le contenu du message masqué de Lou',
  })
  await expect(bascule).toHaveAttribute('aria-expanded', 'false')
  await bascule.click()
  await expect(masque.getByText(DEJA_MASQUE)).toBeVisible()
  await expect(
    masque.getByRole('button', { name: /contenu du message masqué de Lou/ })
  ).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: /signaler/i })).toHaveCount(0)
})

// critère 2
test('writes in the salon; a student of the class then reads it', async ({
  page,
  context,
  baseURL,
}) => {
  const texte = `Pensez au contrôle de jeudi (${randomUUID()})`
  await page.goto(CLASSE_3EC)

  const salon = page.getByRole('region', { name: 'Salon de la classe' })
  const champ = salon.getByLabel('Ton message à la classe')
  await expect(champ).toBeVisible({ timeout: 20_000 })
  await champ.fill(texte)
  await salon.getByRole('button', { name: 'Envoyer' }).click()

  const mien = salon.getByRole('article').filter({ hasText: texte })
  await expect(mien).toBeVisible()
  await expect(mien.getByText('Toi')).toBeVisible()
  await expect(champ).toHaveValue('')

  // A student of 3e C sees it in their salon.
  await sessionDe(context, baseURL, 'e2e-eleve-3eC-lou')
  await page.goto('/ma-classe/salon')
  await expect(page.getByText(texte)).toBeVisible({ timeout: 20_000 })
})

// critère 2: a server refusal is readable, the typed text is kept
test('shows the refusal of a link and keeps the text', async ({ page }) => {
  const texte = `Voir https://exemple.org/fiche pour jeudi (${randomUUID()})`
  await page.goto(CLASSE_3EC)

  const salon = page.getByRole('region', { name: 'Salon de la classe' })
  const champ = salon.getByLabel('Ton message à la classe')
  await expect(champ).toBeVisible({ timeout: 20_000 })
  await champ.fill(texte)
  await salon.getByRole('button', { name: 'Envoyer' }).click()

  // The screen's own text (non-breaking spaces before « : » and in « 2 000 »), never the
  // server's.
  const alerte = salon.getByRole('alert').filter({ hasText: /pas de lien externe/ })
  await expect(alerte).toBeVisible()
  await expect(alerte).toContainText(
    /Ton message n.est pas parti\s:\spas de lien externe ni de numéro de téléphone, 2\s000 caractères au plus\. Ton texte est gardé\./
  )
  expect(await alerte.textContent()).toMatch(/parti[\u00a0\u202f]:.*2[\u00a0\u202f]000/)
  await expect(salon).not.toContainText('entraide')
  await expect(champ).toHaveValue(texte)
  await expect(salon.getByRole('article').filter({ hasText: texte })).toHaveCount(0)
})

// critère 3
test('hides a reported student message: « Masqué » for the teacher, out of the queue, gone for the students', async ({
  page,
  context,
  baseURL,
}) => {
  const texte = `Message hors sujet de Noé (${randomUUID()})`
  // Noé writes it, Lou reports it, through the API (as their screens would).
  const eleve = async (session: string) =>
    nouvelleRequete.newContext({ baseURL, extraHTTPHeaders: { Cookie: `JSESSIONID=${session}` } })
  const noe = await eleve('e2e-eleve-3eC-noe')
  const publie = await noe.post(`/api/salons/${SALON_3EC}/messages`, { data: { corps: texte } })
  expect(publie.status()).toBe(201)
  const { id } = (await publie.json()) as { id: string }
  const lou = await eleve('e2e-eleve-3eC-lou')
  const signale = await lou.post(`/api/salons/messages/${id}/signalement`, {
    data: { motif: 'hors sujet' },
  })
  expect(signale.status()).toBe(204)
  await noe.dispose()
  await lou.dispose()

  // The report is in the teacher's queue.
  await page.goto('/prof/signalements-salon')
  await expect(page.getByText(texte)).toBeVisible({ timeout: 20_000 })

  // Hidden from the salon, after confirmation.
  await page.goto(CLASSE_3EC)
  const salon = page.getByRole('region', { name: 'Salon de la classe' })
  const message = salon.getByRole('article').filter({ hasText: texte })
  await expect(message).toBeVisible({ timeout: 20_000 })
  await message.getByRole('button', { name: 'Masquer le message de Noé' }).click()
  const dialogue = page.getByRole('dialog')
  await expect(dialogue).toBeVisible()
  await dialogue.getByRole('button', { name: 'Masquer', exact: true }).click()
  await expect(dialogue).toBeHidden()
  await expect(message.getByText('Masqué', { exact: true })).toBeVisible()
  await expect(message.getByRole('button', { name: /^Masquer/ })).toHaveCount(0)
  // Folded once hidden.
  await expect(message.getByText(texte)).toBeHidden()
  // Without leaving the page.
  await expect(page).toHaveURL(CLASSE_3EC)

  // Its report left the queue.
  const file = page.waitForResponse((r) => r.url().includes('/api/prof/salons/signalements'))
  await page.goto('/prof/signalements-salon')
  expect((await file).ok()).toBe(true)
  await expect(
    page.getByText(/Aucun signalement en attente|Salon de la 3e C/).first()
  ).toBeVisible()
  await expect(page.getByText(texte)).toHaveCount(0)

  // Gone for a student of the class, on reload.
  await sessionDe(context, baseURL, 'e2e-eleve-3eC-lou')
  await page.goto('/ma-classe/salon')
  await expect(page.getByText(DE_NOE)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(texte)).toHaveCount(0)
})

// critère 5: a class without salon; opening it shows the salon in place. The teacher session is
// unique to this test (`e2e-enseignant-<uuid>`): the fake backend keeps the opened salon per
// session, so the desktop and mobile projects each start from a class without salon.
test('opens the salon of a class and shows it without leaving the page', async ({
  page,
  context,
  baseURL,
}) => {
  await sessionDe(context, baseURL, `e2e-enseignant-${randomUUID()}`)
  await page.goto('/prof/classes')
  await expect(page.getByRole('link', { name: /3e C/ }).first()).toBeVisible({ timeout: 20_000 })
  await page.getByRole('link', { name: /4e A/ }).first().click()
  await expect(page).toHaveURL('/prof/classes/classe-4eA', { timeout: 20_000 })

  const salon = page.getByRole('region', { name: 'Salon de la classe' })
  const ouvrir = salon.getByRole('button', { name: 'Ouvrir le salon' })
  await expect(ouvrir).toBeVisible({ timeout: 20_000 })
  await ouvrir.click()

  const champ = salon.getByLabel('Ton message à la classe')
  await expect(champ).toBeVisible()
  await expect(champ).toBeFocused()
  await expect(salon.getByRole('button', { name: 'Envoyer' })).toBeVisible()
  await expect(ouvrir).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Salon ouvert.' })).toBeAttached()
  await expect(page).toHaveURL('/prof/classes/classe-4eA')
})

// critère 7: the student screen keeps its behaviour
test('the student salon keeps « Signaler », has no « Masquer » and no hidden message', async ({
  page,
  context,
  baseURL,
}) => {
  await sessionDe(context, baseURL, 'e2e-eleve-3eC-noe')
  await page.goto('/ma-classe/salon')

  await expect(page.getByText(DU_PROF)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(DE_NOE)).toBeVisible()
  // The teacher's message can be reported; the reader's own cannot.
  await expect(page.getByRole('button', { name: 'Signaler ce message' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /masquer/i })).toHaveCount(0)
  await expect(page.getByText(DEJA_MASQUE)).toHaveCount(0)
  await expect(page.getByText('Masqué', { exact: true })).toHaveCount(0)
})
