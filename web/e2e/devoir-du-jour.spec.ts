import { expect, test, type Page } from '@playwright/test'

// The homework of the day (#370, PL-1): each Accueil card opens what its homework is about in one
// click, and a course the student cannot read never strands them. Runs on the desktop and the
// mobile projects. The fake backend has no catalogue, so a chapter homework's card falls back to
// Ma classe here (critère 4); the chapter destination itself (critère 1) is unit-tested.

// The fake backend's fixtures (web/e2e/fake-backend.mjs).
const COURS_LISIBLE = '00000000-0000-4000-8000-00000000c001'
const COURS_HORS_PORTEE = '00000000-0000-4000-8000-00000000c002'
const COURS_INCONNU = '00000000-0000-4000-8000-00000000c404'
const DEVOIR_LISIBLE = '00000000-0000-4000-8000-00000000d200'
const DEVOIR_HORS_PORTEE = '00000000-0000-4000-8000-00000000d403'
const DEVOIR_INCONNU = '00000000-0000-4000-8000-00000000d404'

const TITRE_DU_COURS = 'Les fractions, version M. Dubois'
const BANDEAU = 'Devoir de M. Dubois · à rendre le 19 octobre'

// next dev compiles a route on its first visit.
const COMPILATION = { timeout: 20_000 }

function pourTaClasse(page: Page) {
  return page.getByRole('region', { name: 'Pour ta classe · 5e B' })
}

function indisponible(page: Page) {
  return page.getByRole('alert').filter({ hasText: 'Cours indisponible' })
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
})

// critère 2
test('a course homework opens its course in one click, with the homework banner', async ({
  page,
}) => {
  await page.goto('/')
  await pourTaClasse(page)
    .getByRole('link', { name: /Relire le cours sur les fractions/ })
    .click()

  await expect(page).toHaveURL(`/cours/${COURS_LISIBLE}?devoir=${DEVOIR_LISIBLE}`, COMPILATION)
  await expect(page.getByRole('heading', { level: 1, name: TITRE_DU_COURS })).toBeVisible()
  await expect(page.getByText(BANDEAU)).toBeVisible()

  // A plain link: the browser's back button returns to Accueil.
  await page.goBack()
  await expect(page).toHaveURL('/')
})

// critère 3
test('each card leads to its own homework, soonest due first', async ({ page }) => {
  await page.goto('/')
  const cartes = pourTaClasse(page).getByRole('link')

  await expect(cartes).toHaveCount(3)
  await expect(cartes.nth(0)).toContainText('Relire le cours sur les fractions')
  await expect(cartes.nth(1)).toContainText('Réviser Pythagore')
  await expect(cartes.nth(2)).toContainText('Lire le cours sur les relatifs')

  await expect(cartes.nth(0)).toHaveAttribute(
    'href',
    `/cours/${COURS_LISIBLE}?devoir=${DEVOIR_LISIBLE}`
  )
  // critère 4: a chapter with no catalogue to place it.
  await expect(cartes.nth(1)).toHaveAttribute('href', '/ma-classe')
  await expect(cartes.nth(2)).toHaveAttribute(
    'href',
    `/cours/${COURS_HORS_PORTEE}?devoir=${DEVOIR_HORS_PORTEE}`
  )
  // The homework due last has no card on Accueil.
  await expect(pourTaClasse(page).getByText('Lire le cours sur les aires')).toHaveCount(0)
})

// critère 4
test('a chapter homework the catalogue cannot place still leads to Ma classe', async ({ page }) => {
  await page.goto('/')
  await pourTaClasse(page)
    .getByRole('link', { name: /Réviser Pythagore/ })
    .click()

  await expect(page).toHaveURL('/ma-classe', COMPILATION)
  await expect(page.getByText('Réviser Pythagore')).toBeVisible()
})

// critère 5
test('a course out of the class’s reach says so, and leads back to the homework in one click', async ({
  page,
}) => {
  await page.goto('/')
  await pourTaClasse(page)
    .getByRole('link', { name: /Lire le cours sur les relatifs/ })
    .click()

  await expect(page).toHaveURL(
    `/cours/${COURS_HORS_PORTEE}?devoir=${DEVOIR_HORS_PORTEE}`,
    COMPILATION
  )
  await expect(indisponible(page)).toBeVisible()
  await expect(page.getByText(/à rendre le/)).toHaveCount(0)

  await page.getByRole('link', { name: 'Retour à mes devoirs' }).click()
  await expect(page).toHaveURL('/ma-classe', COMPILATION)
  await expect(page.getByText('Lire le cours sur les relatifs')).toBeVisible()
})

// critère 5 (404), reached from Ma classe: that homework is due too late for an Accueil card.
test('an unknown course says so, and leads back to the homework in one click', async ({ page }) => {
  await page.goto('/ma-classe')
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Lire le cours sur les aires' })
    .getByRole('link', { name: 'Ouvrir le cours' })
    .click()

  await expect(page).toHaveURL(`/cours/${COURS_INCONNU}?devoir=${DEVOIR_INCONNU}`, COMPILATION)
  await expect(indisponible(page)).toBeVisible()

  await page.getByRole('link', { name: 'Retour à mes devoirs' }).click()
  await expect(page).toHaveURL('/ma-classe', COMPILATION)
})

// critère 5: without a homework in the URL, the unavailable course offers no way back to one.
test('an unavailable course opened directly offers no homework link', async ({ page }) => {
  await page.goto(`/cours/${COURS_HORS_PORTEE}`)

  await expect(indisponible(page)).toBeVisible(COMPILATION)
  await expect(page.getByRole('link', { name: 'Retour à mes devoirs' })).toHaveCount(0)
})

// critère 7
test('Ma classe › À faire opens a course homework on its course', async ({ page }) => {
  await page.goto('/ma-classe')
  const devoir = (titre: string) => page.getByRole('listitem').filter({ hasText: titre })

  await expect(
    devoir('Lire le cours sur les relatifs').getByRole('link', { name: 'Ouvrir le cours' })
  ).toHaveAttribute('href', `/cours/${COURS_HORS_PORTEE}?devoir=${DEVOIR_HORS_PORTEE}`)
  await expect(
    devoir('Lire le cours sur les aires').getByRole('link', { name: 'Ouvrir le cours' })
  ).toHaveAttribute('href', `/cours/${COURS_INCONNU}?devoir=${DEVOIR_INCONNU}`)

  await devoir('Relire le cours sur les fractions')
    .getByRole('link', { name: 'Ouvrir le cours' })
    .click()
  await expect(page).toHaveURL(`/cours/${COURS_LISIBLE}?devoir=${DEVOIR_LISIBLE}`, COMPILATION)
  await expect(page.getByRole('heading', { level: 1, name: TITRE_DU_COURS })).toBeVisible()
  await expect(page.getByText(BANDEAU)).toBeVisible()
})
