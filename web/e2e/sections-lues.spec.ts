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

test('nothing is marked for a visitor without a session', async ({ page, context, baseURL }) => {
  await context.clearCookies()
  await context.addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL ?? '' }])
  const lues: string[] = []
  page.on('request', (request) => {
    const section = sectionLue(request)
    if (section) lues.push(section)
  })

  // Hydrated once the gauge has asked who is reading (401 here): the observer is on by then.
  const moi = page.waitForResponse((response) => response.url().endsWith('/api/moi'))
  await page.goto(CHAPITRE)
  await moi
  await page.locator('[data-fin-section="exercices"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  expect(lues).toEqual([])
})
