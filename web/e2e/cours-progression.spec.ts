import { expect, test, type Request } from '@playwright/test'

// PL-6b (#400, ADR 0050): a teacher course has the progression of a chapter. « Reprendre » can
// name it, its page has the course gauge and the interactive mode, and reading a section is sent
// to the course endpoint. Desktop and mobile projects. Fake backend fixtures: e2e-cours-en-cours
// left « Les fractions, version M. Dubois » (c001) unfinished; e2e-eleve never opened a course.

const COURS = '00000000-0000-4000-8000-00000000c001'
const TITRE = 'Les fractions, version M. Dubois'

// next dev compiles a route on its first visit.
const COMPILATION = { timeout: 20_000 }

function sectionDeCoursLue(request: Request): string | null {
  if (request.method() !== 'POST') return null
  return (
    /\/api\/cours\/[^/]+\/sections\/([^/]+)\/lu$/.exec(new URL(request.url()).pathname)?.[1] ?? null
  )
}

test('C10 : « Reprendre » propose le cours laissé en cours et l’ouvre en un clic', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-cours-en-cours', url: baseURL! }])
  await page.goto('/')

  const bloc = page.getByRole('region', { name: 'Reprendre' })
  await expect(bloc.getByText(TITRE)).toBeVisible(COMPILATION)
  await bloc.getByRole('link', { name: 'Continuer' }).click()

  await expect(page).toHaveURL(new RegExp(`/cours/${COURS}`), COMPILATION)
  await expect(page.locator('[data-chapitre-mode]')).toBeVisible()
})

test('C7 : en mode lecture, la jauge du cours vient de la progression de l’élève', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: 'JSESSIONID', value: 'e2e-cours-en-cours', url: baseURL! },
    { name: 'brio_mode_chapitre', value: 'lecture', url: baseURL! },
  ])
  await page.goto(`/cours/${COURS}`)

  const jauge = page.getByRole('progressbar', { name: /^Progression du cours : \d+ %$/ })
  await expect(jauge).toBeVisible(COMPILATION)
  expect(Number(await jauge.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
})

test('un élève qui n’a jamais ouvert le cours n’a pas de jauge, jamais un 0 %', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL! },
    { name: 'brio_mode_chapitre', value: 'lecture', url: baseURL! },
  ])
  const jaugeDemandee = page.waitForResponse((r) =>
    r.url().includes(`/api/progression/cours/${COURS}`)
  )
  await page.goto(`/cours/${COURS}`)
  expect((await jaugeDemandee).status()).toBe(204)

  await expect(page.getByRole('heading', { level: 1, name: TITRE })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: /Progression du cours/ })).toHaveCount(0)
})

test('mode interactif : quitter une section la marque lue sur le cours, la fin renvoie aux cours', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-cours-en-cours', url: baseURL! }])
  const lues: string[] = []
  page.on('request', (request) => {
    const section = sectionDeCoursLue(request)
    if (section) lues.push(section)
  })

  await page.goto(`/cours/${COURS}`)
  await expect(page.locator('[data-chapitre-mode="interactif"]')).toBeVisible(COMPILATION)

  // Forward through the slides until a section is left: its read goes to the course endpoint.
  const premiere = page.waitForRequest((request) => sectionDeCoursLue(request) !== null)
  for (let i = 0; i < 30 && lues.length === 0; i++) {
    // A lesson slide moves on with « Suivant », an exercise slide with « Passer ».
    const avancer = page.getByRole('button', { name: /^(Suivant|Passer)$/ }).first()
    if (!(await avancer.isVisible())) break
    await avancer.click()
  }
  await premiere
  expect(lues.length).toBeGreaterThan(0)

  await page.goto(`/cours/${COURS}?diapo=fin`)
  const fin = page.locator('[data-diapo="fin"]')
  await expect(
    fin.getByRole('heading', { name: /Fin du cours|Beau travail|Tous les exercices/ })
  ).toBeVisible()
  await expect(fin.getByText(/chapitre/i)).toHaveCount(0)
  await expect(fin.getByRole('link', { name: /suivant/i })).toHaveCount(0)
  await fin.getByRole('link', { name: 'Revenir à tes cours' }).click()
  await expect(page).toHaveURL('/ma-classe/cours', COMPILATION)
})
