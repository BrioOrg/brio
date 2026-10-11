import { expect, test } from '@playwright/test'

// The end slide (#249), for a logged-in student of the fake backend: they earn no XP there and
// nothing is recorded, so the slide shows the real values the fake returns, and no more. Pythagoras:
//  4 ex-reconnaitre-hypotenuse (QCM, C is right) · 6 ex-longueur-cotes · 7 ex-calcul-hypotenuse
//  8 ex-etapes-demonstration (ordering) · 9 ex-justifier-rectangle (free text) · 10 fin
// The last two are not auto-graded: they never count as left with no answer.
const CHAPITRE = '/3e/mathematiques/theoreme-de-pythagore'

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
})

test('one exercise solved, the others skipped: the end slide sums it up, really', async ({
  page,
}) => {
  await page.goto(`${CHAPITRE}?diapo=ex-reconnaitre-hypotenuse`)
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=ex-reconnaitre-hypotenuse`)
  await expect(page.getByRole('button', { name: 'Vérifier' })).toBeVisible()

  await page.keyboard.press('C')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Bien vu !')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=methode-prose`)
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=fin`)

  const fin = page.locator('[data-diapo="fin"]')
  await expect(fin.getByRole('heading', { name: 'Beau travail !' })).toBeFocused()
  await expect(fin.getByText('1 exercice réussi')).toBeVisible()
  // The fake backend awards no XP: no line, never « +0 XP ».
  await expect(fin.getByText(/XP/)).toHaveCount(0)
  // Its completion is the real one it returns.
  await expect(fin.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  // No catalogue in the fake backend, so no next chapter: the path is the main action.
  await expect(fin.getByRole('link', { name: /Chapitre suivant/ })).toHaveCount(0)
  await expect(fin.getByRole('link', { name: 'Revenir au parcours' })).toBeVisible()

  // The auto-graded exercises seen and left with no answer.
  const revenir = fin.getByRole('list')
  await expect(revenir.getByRole('link')).toHaveText([
    "Exercice 2 · Calculer la longueur de l'hypoténuse",
    "Exercice 3 · Calculer la longueur de l'hypoténuse",
  ])
  await revenir.getByRole('link').first().click()
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=ex-longueur-cotes`)
  await expect(page.getByRole('button', { name: 'Vérifier' })).toBeVisible()
})
