import { randomUUID } from 'node:crypto'

import { expect, test, type BrowserContext } from '@playwright/test'

const CHAPTER = '/5e/mathematiques/developper-reduire'
const TEACHER_COURSE = '/cours/00000000-0000-4000-8000-00000000c001'
const CATALOGUE_TITLE = 'Le périmètre du jardin'
const RESULT = 'Corrigé'

async function useSession(context: BrowserContext, baseURL: string | undefined, value: string) {
  await context.clearCookies()
  await context.addCookies([{ name: 'JSESSIONID', value, url: baseURL ?? '' }])
}

test('opens the catalogue exercise and keeps the submitted copy and solution on reload', async ({
  context,
  baseURL,
  page,
}, testInfo) => {
  // The two browser projects need separate copies of the same catalogue exercise.
  await useSession(
    context,
    baseURL,
    testInfo.project.name === 'mobile' ? 'e2e-sans-classe' : 'e2e-eleve'
  )
  await page.goto(CHAPTER)
  await page.getByRole('link', { name: CATALOGUE_TITLE }).click()

  await expect(page.getByRole('heading', { level: 1, name: CATALOGUE_TITLE })).toBeVisible()
  await expect(page.getByRole('heading', { name: RESULT, exact: true })).toHaveCount(0)
  const answer = page.getByRole('textbox', { name: 'Ta réponse' })
  await answer.focus()
  await expect(page.getByRole('button', { name: 'Fraction' })).toBeVisible()
  await answer.fill('2(2x+3)')
  await page.getByRole('button', { name: 'Remettre ma réponse' }).click()

  await expect(page.getByRole('heading', { name: RESULT, exact: true })).toBeVisible()
  await expect(page.getByText(/Le périmètre est le double/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ta réponse', exact: true })).toBeVisible()
  await expect(page.getByText(/Le périmètre est le double/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remettre ma réponse' })).toHaveCount(0)
})

test('a teacher publishes a written derivative exercise and a student submits an equivalent form', async ({
  context,
  baseURL,
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  const title = `Dérivée de polynôme (${testInfo.project.name})`
  await useSession(context, baseURL, `e2e-enseignant-${randomUUID()}`)
  await page.goto('/prof')
  await page.getByRole('link', { name: 'Exercices rédigés' }).click()
  await page.getByRole('button', { name: 'Nouvel exercice' }).click()

  await page
    .getByRole('combobox', { name: 'Leçon' })
    .selectOption('00000000-0000-4000-8000-00000000c001')
  await page.getByLabel('Titre', { exact: true }).fill(title)
  await page.getByLabel('Énoncé', { exact: true }).fill('Calcule la dérivée de $x^2+2x$.')
  await page.getByLabel('Réponse attendue', { exact: true }).fill('2x+2')
  await page
    .getByLabel('Corrigé', { exact: true })
    .fill('On dérive chaque terme. Le résultat est $2x+2$.')
  await page.getByRole('button', { name: 'Prévisualiser' }).click()
  await expect(
    page.getByRole('region', { name: 'Aperçu élève' }).getByText(/Calcule la dérivée de/)
  ).toBeVisible()
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click()
  await page.getByRole('button', { name: 'Publier', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Exercice publié' })).toBeVisible()

  await useSession(context, baseURL, 'e2e-eleve')
  await page.goto(TEACHER_COURSE)
  await page.getByRole('link', { name: title }).click()
  await expect(page.getByRole('heading', { name: RESULT, exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Ta réponse' }).fill('2(x+1)')
  await page.getByRole('button', { name: 'Remettre ma réponse' }).click()
  await expect(page.getByText(/On dérive chaque terme/)).toBeVisible()
  await expect(page.getByText(/Réponse correcte/)).toBeVisible()
})
