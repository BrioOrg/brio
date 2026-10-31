import { expect, test, type Page } from '@playwright/test'

// The tutor and entraide drawer of the interactive mode (#250), and full screen. Pythagoras:
//  2 intro-prose · 6 ex-longueur-cotes (short answer). The fake tutor answers for a logged-in
// student with a fixed reply citing intro-prose, a block that exists, as the server checks.
const CHAPITRE = '/3e/mathematiques/theoreme-de-pythagore'

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
})

/** Keys are lost until React has hydrated the page: wait for the client to own the URL. */
async function ouvrir(page: Page, diapo: string) {
  await page.goto(`${CHAPITRE}?diapo=${diapo}`)
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=${diapo}`)
  await expect(page.locator(`[data-diapo="${diapo}"]`).first()).toBeVisible()
}

async function expectDiapo(page: Page, position: number, id: string) {
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=${id}`)
  // The slide announcer: the tutor's answers are a live region too.
  await expect(page.locator('[aria-live="polite"][aria-atomic="true"]')).toHaveText(
    `Diapo ${position} sur 10`
  )
  await expect(page.locator(`[data-diapo="${id}"]`).first()).toBeVisible()
}

test('the tutor opens from an exercise slide and gives the student back the same slide', async ({
  page,
}) => {
  await ouvrir(page, 'ex-longueur-cotes')
  const historique = await page.evaluate(() => window.history.length)

  await page.getByRole('button', { name: 'Aide' }).click()
  const tiroir = page.getByRole('dialog', { name: 'Besoin d’aide ?' })
  await expect(tiroir).toBeVisible()
  await expect(tiroir.getByText('Ta question porte sur cet exercice.')).toBeVisible()

  // The tutor is told which exercise the slide is, without the student touching it.
  await tiroir.getByLabel('Ta question au tuteur').fill('Par où je commence ?')
  const requete = page.waitForRequest((r) => r.url().endsWith('/tuteur') && r.method() === 'POST')
  await tiroir.getByRole('button', { name: 'Envoyer' }).click()
  expect((await requete).postDataJSON()).toMatchObject({
    question: 'Par où je commence ?',
    exerciceId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  })
  await expect(tiroir.getByText('Relis le début du chapitre')).toBeVisible()

  await tiroir.getByRole('button', { name: 'Fermer' }).click()
  await expect(tiroir).toBeHidden()
  await expectDiapo(page, 6, 'ex-longueur-cotes')
  await expect(page.getByRole('button', { name: 'Aide' })).toBeFocused()
  expect(await page.evaluate(() => window.history.length)).toBe(historique)

  // Opened again, with T: the conversation is still there.
  await page.keyboard.press('t')
  await expect(tiroir.getByText('Relis le début du chapitre')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tiroir).toBeHidden()
  await expectDiapo(page, 6, 'ex-longueur-cotes')
})

test('a lesson slide asks about the whole chapter; a citation opens its slide', async ({
  page,
}) => {
  await ouvrir(page, 'methode-prose')
  await page.keyboard.press('t')
  const tiroir = page.getByRole('dialog', { name: 'Besoin d’aide ?' })
  await expect(tiroir.getByText('Ta question porte sur tout le chapitre.')).toBeVisible()

  await tiroir.getByLabel('Ta question au tuteur').fill('C’est quoi l’hypoténuse ?')
  const requete = page.waitForRequest((r) => r.url().endsWith('/tuteur') && r.method() === 'POST')
  await tiroir.getByRole('button', { name: 'Envoyer' }).click()
  // No exercise: the client leaves the field out, and the tutor reads the whole chapter.
  expect((await requete).postDataJSON()).toEqual({ question: 'C’est quoi l’hypoténuse ?' })

  await tiroir.getByRole('button', { name: 'intro-prose' }).click()
  await expect(tiroir).toBeHidden()
  await expectDiapo(page, 2, 'intro-prose')
})

test('F puts the chapter in full screen and takes it out', async ({ page }) => {
  await ouvrir(page, 'intro-prose')
  await page.keyboard.press('f')
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true)
  await expect(page.getByRole('button', { name: 'Quitter le plein écran' })).toBeVisible()

  await page.keyboard.press('f')
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(false)
  await expectDiapo(page, 2, 'intro-prose')
})
