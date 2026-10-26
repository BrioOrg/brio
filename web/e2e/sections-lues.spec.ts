import { expect, test, type Request } from '@playwright/test'

// Reading mode (#252): a section's end coming on screen marks it read, for a logged-in student.
// Pythagoras has three sections: enonce-du-theoreme · calculer-l-hypotenuse · exercices.
const CHAPITRE = '/3e/mathematiques/theoreme-de-pythagore'

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    { name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' },
    { name: 'brio_mode_chapitre', value: 'lecture', url: baseURL ?? '' },
  ])
})

function sectionLue(request: Request): string | null {
  if (request.method() !== 'POST') return null
  return (
    /\/api\/chapitres\/[^/]+\/sections\/([^/]+)\/lu$/.exec(new URL(request.url()).pathname)?.[1] ??
    null
  )
}

test('scrolling to the end of a section marks it read, once', async ({ page }) => {
  const lues: string[] = []
  page.on('request', (request) => {
    const section = sectionLue(request)
    if (section) lues.push(section)
  })

  await page.goto(CHAPITRE)
  // The gauge shows once the page is hydrated and the student known.
  await expect(page.getByRole('progressbar', { name: /Progression du chapitre/ })).toBeVisible()
  expect(lues).not.toContain('exercices')

  const marquee = page.waitForRequest((request) => sectionLue(request) === 'exercices')
  await page.locator('[data-fin-section="exercices"]').scrollIntoViewIfNeeded()
  await marquee

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.locator('[data-fin-section="exercices"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  expect(lues.filter((s) => s === 'exercices')).toEqual(['exercices'])
})

test('a visitor without a session is sent to the login page, and back here after', async ({
  page,
  context,
}) => {
  await context.clearCookies()
  await page.goto(`${CHAPITRE}?diapo=enonce-prose`)

  // No chapter content: the login page, which knows where to come back (#279).
  await expect(page).toHaveURL(
    `/connexion?from=${encodeURIComponent(`${CHAPITRE}?diapo=enonce-prose`)}`
  )
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Content de te')
})

test('a session that expires while reading: a message, then the login page', async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto(CHAPITRE)
  // A first section read while the session is alive: the page knows a student is reading.
  const premiereLue = page.waitForResponse((response) => sectionLue(response.request()) !== null)
  await page.locator('[data-fin-section="enonce-du-theoreme"]').scrollIntoViewIfNeeded()
  expect((await premiereLue).status()).toBe(204)

  // The backend drops the session (idle timeout, restart): the cookie now opens nothing.
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-expiree', url: baseURL ?? '' }])
  await page.locator('[data-fin-section="exercices"]').scrollIntoViewIfNeeded()

  await expect(page.getByRole('alert').filter({ hasText: 'Ta session a expiré' })).toBeVisible()
  await expect(page).toHaveURL(`/connexion?from=${encodeURIComponent(CHAPITRE)}`)
})
