import { expect, test } from '@playwright/test'

// PL-6a (#398): reaching and leaving a teacher course. Runs on the desktop and the mobile
// projects. Fake backend fixtures (web/e2e/fake-backend.mjs): three courses of the class with no
// homework on them, served newest first, and a fourth, older one cut by the cap of three.

const COURS_RECENT_SANS_DEVOIR = '00000000-0000-4000-8000-00000000c003'
const COURS_HORS_PORTEE = '00000000-0000-4000-8000-00000000c002'
const COURS_INCONNU = '00000000-0000-4000-8000-00000000c404'

const TITRE_C003 = 'Les angles, version M. Dubois'
const TITRE_C004 = 'Le cercle, version M. Dubois'
const TITRE_C001 = 'Les fractions, version M. Dubois'
const TITRE_C005 = 'Les priorités opératoires, version M. Dubois'

// next dev compiles a route on its first visit.
const COMPILATION = { timeout: 20_000 }

const blocCours = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Les cours de ta classe' })
const filDAriane = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: "Fil d'ariane" })

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
})

// Since PL-6b (#400, ADR 0050 §7) a course opens in the interactive mode, as a chapter does, and
// that mode hides the reading chrome (the site header and its trail), as on a chapter. The trail
// is checked in reading mode, the one a chapter's trail is checked in (chapitre.spec.ts).
async function enLecture(context: import('@playwright/test').BrowserContext, baseURL?: string) {
  await context.addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL ?? '' }])
}

// C13 (corrigé) : un des 3 cours les plus récents, sans devoir, en 2 clics depuis l'Accueil.
test('C13 : un cours récent sans devoir s’atteint en deux clics depuis l’Accueil', async ({
  page,
}) => {
  await page.goto('/')
  let clics = 0

  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Ma classe' })
    .click()
  clics++
  await expect(page).toHaveURL('/ma-classe', COMPILATION)

  await blocCours(page)
    .getByRole('link', { name: new RegExp(TITRE_C003) })
    .click()
  clics++

  // The interactive mode (ADR 0050 §7) writes its first slide in the address, as on a chapter.
  await expect(page).toHaveURL(
    new RegExp(`/cours/${COURS_RECENT_SANS_DEVOIR}(\\?diapo=[^&]+)?$`),
    COMPILATION
  )
  await expect(page.getByRole('heading', { level: 1, name: TITRE_C003 })).toBeVisible()
  expect(clics).toBe(2)

  // Back from the course: the class space, with the block still there.
  await page.goBack()
  await expect(page).toHaveURL('/ma-classe')
  await expect(blocCours(page)).toBeVisible()
})

test('plafond : 3 cours, du plus récent au plus ancien, puis « Voir tous les cours du prof »', async ({
  page,
}) => {
  await page.goto('/ma-classe')

  const bloc = blocCours(page)
  await expect(bloc).toBeVisible(COMPILATION)
  const cartes = bloc.getByRole('listitem')
  await expect(cartes).toHaveCount(3)
  await expect(cartes.nth(0)).toContainText(TITRE_C003)
  await expect(cartes.nth(1)).toContainText(TITRE_C004)
  await expect(cartes.nth(2)).toContainText(TITRE_C001)
  await expect(page.getByText(TITRE_C005)).toHaveCount(0)

  await bloc.getByRole('link', { name: /Voir tous les cours du prof/ }).click()

  await expect(page).toHaveURL('/ma-classe/cours', COMPILATION)
  for (const titre of [TITRE_C003, TITRE_C004, TITRE_C001, TITRE_C005]) {
    await expect(page.getByText(titre)).toBeVisible()
  }
})

// C1 : fil « Ma classe › Cours du prof › titre », deux entrées liées (desktop).
test('C1 : le fil d’un cours a « Ma classe » et « Cours du prof », liés', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'le fil se replie sur mobile (voir le test suivant)'
  )
  await enLecture(context, baseURL)
  await page.goto(`/cours/${COURS_RECENT_SANS_DEVOIR}`)

  const fil = filDAriane(page)
  await expect(fil.getByRole('link', { name: 'Ma classe' })).toHaveAttribute(
    'href',
    '/ma-classe',
    COMPILATION
  )
  await expect(fil.getByRole('link', { name: 'Cours du prof' })).toHaveAttribute(
    'href',
    '/ma-classe/cours'
  )
  await expect(fil.getByText(TITRE_C003)).toHaveAttribute('aria-current', 'page')

  await fil.getByRole('link', { name: 'Cours du prof' }).click()
  await expect(page).toHaveURL('/ma-classe/cours', COMPILATION)
  await expect(page.getByText(TITRE_C003)).toBeVisible()
})

test('C1 (mobile) : le fil se replie sur le titre, « Ma classe » reste la page courante de la barre', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'repli propre au mobile')
  await enLecture(context, baseURL)
  await page.goto(`/cours/${COURS_RECENT_SANS_DEVOIR}`)

  const fil = filDAriane(page)
  await expect(fil.getByText(TITRE_C003)).toBeVisible(COMPILATION)
  await expect(fil.getByRole('link', { name: 'Cours du prof' })).toBeHidden()
  await expect(
    page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Ma classe' })
  ).toHaveAttribute('aria-current', 'page')
})

// C2 : un cours indisponible ne laisse jamais sans sortie, sur les deux projets.
for (const [nom, id] of [
  ['hors de portée (403)', COURS_HORS_PORTEE],
  ['inconnu (404)', COURS_INCONNU],
] as const) {
  test(`C2 : un cours ${nom} ouvert directement offre « Voir les cours du prof »`, async ({
    page,
  }) => {
    await page.goto(`/cours/${id}`)

    await expect(page.getByRole('alert').filter({ hasText: 'Cours indisponible' })).toBeVisible(
      COMPILATION
    )
    await expect(page.getByRole('link', { name: 'Retour à mes devoirs' })).toHaveCount(0)

    await page.getByRole('link', { name: /Voir les cours du prof/ }).click()

    await expect(page).toHaveURL('/ma-classe/cours', COMPILATION)
    await expect(page.getByText(TITRE_C001)).toBeVisible()
  })
}

test('C2 : le fil d’un cours indisponible garde le lien « Cours du prof » (desktop)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'le fil se replie sur mobile')
  await page.goto(`/cours/${COURS_INCONNU}`)

  await expect(filDAriane(page).getByRole('link', { name: 'Cours du prof' })).toHaveAttribute(
    'href',
    '/ma-classe/cours',
    COMPILATION
  )
  await expect(filDAriane(page).getByText('Cours indisponible')).toBeVisible()
})
