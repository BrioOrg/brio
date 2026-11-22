import { expect, test, type Locator, type Page } from '@playwright/test'

// The annales in the main navigation (#395, PL-5, ADR 0047): one click on desktop, one tap on
// mobile, from every screen of the student shell. Both navigations are in the page, one hidden
// by width, so a role query only finds the one shown.
// The fake backend does not serve /api/annales: the page shows its error, its title stays.

const NAV = 'Navigation principale'

/**
 * Screens of the student shell the entry must be one click away from (criteria 1 and 2). The
 * fake backend serves no catalogue, so the subject page /3e/mathematiques fails there
 * ("Catalogue unavailable"): a catalogue chapter, in reading mode, stands for the catalogue screens.
 */
const CHAPITRE = '/3e/mathematiques/theoreme-de-pythagore'
const ECRANS = ['/', '/ma-classe', '/explorer', '/profil', '/parametres', CHAPITRE]

/** Opens a screen; a chapter in reading mode, where the navigations are shown (criterion 9). */
async function ouvrir(page: Page, ecran: string, baseURL: string | undefined) {
  if (ecran === CHAPITRE) {
    await page
      .context()
      .addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL ?? '' }])
  }
  await page.goto(ecran)
}

function navigation(page: Page): Locator {
  return page.getByRole('navigation', { name: NAV })
}

async function expectAnnales(page: Page) {
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL('/annales', { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Annales' })).toBeVisible()
}

async function expectCible44(element: Locator) {
  const box = await element.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)
}

test.describe('desktop', () => {
  for (const ecran of ECRANS) {
    // critère 1
    test(`one click on the sidebar opens the annales from ${ecran}`, async ({
      page,
      baseURL,
    }, testInfo) => {
      test.skip(testInfo.project.name === 'mobile', 'desktop layout')
      await ouvrir(page, ecran, baseURL)
      await navigation(page).getByRole('link', { name: 'Annales' }).click()
      await expectAnnales(page)
    })
  }
})

test.describe('mobile', () => {
  for (const ecran of ECRANS) {
    // critère 2
    test(`one tap on the bottom bar opens the annales from ${ecran}`, async ({
      page,
      baseURL,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'mobile layout')
      await ouvrir(page, ecran, baseURL)
      await navigation(page).getByRole('link', { name: 'Annales' }).tap()
      await expectAnnales(page)
    })
  }

  // critère 2 : a named link (never a disabled button), reachable by keyboard, 44 × 44 at least,
  // like every other space of the bar, and the six spaces fit the screen.
  test('the Annales entry is a link with a 44 px touch target', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile layout')
    await page.goto('/')
    const nav = navigation(page)
    const annales = nav.getByRole('link', { name: 'Annales' })
    await expect(annales).toHaveCount(1)
    await expect(annales).toHaveAttribute('href', '/annales')
    await expect(nav.getByRole('button', { name: /Annales/ })).toHaveCount(0)

    await annales.focus()
    await expect(annales).toBeFocused()

    const cibles = [
      ...(await nav.getByRole('link').all()),
      ...(await nav.getByRole('button').all()),
    ]
    expect(cibles).toHaveLength(6)
    for (const cible of cibles) await expectCible44(cible)

    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(deborde).toBe(false)
  })

  // Side effect of the 44 px target (plan B1 §7): the teacher bar uses the same component.
  test('the teacher bottom bar has 44 px touch targets too', async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile layout')
    await context.clearCookies()
    await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-enseignant', url: baseURL ?? '' }])
    await page.goto('/prof')

    const nav = page.getByRole('navigation', { name: "Navigation de l'espace enseignant" })
    await expect(nav.getByRole('link')).toHaveCount(5)
    for (const lien of await nav.getByRole('link').all()) await expectCible44(lien)
  })
})

// critère 5, on both projects
test('on /annales, Annales is the only current section and the breadcrumb starts there', async ({
  page,
}) => {
  await page.goto('/annales')
  await expect(page.getByRole('heading', { level: 1, name: 'Annales' })).toBeVisible()

  const nav = navigation(page)
  const courants = nav.locator('[aria-current="page"]')
  await expect(courants).toHaveCount(1)
  await expect(courants).toHaveAccessibleName('Annales')
  await expect(nav.getByRole('link', { name: 'Explorer' })).not.toHaveAttribute('aria-current')

  // Counted in the DOM, not by role: on mobile the intermediate crumbs are only hidden.
  const fil = page.getByRole('navigation', { name: "Fil d'ariane" })
  await expect(fil.locator('li')).toHaveCount(1)
  await expect(fil.locator('li')).toHaveText('Annales')
  await expect(fil.getByRole('link')).toHaveCount(0)
})

// critère 9, on both projects: a first visit opens the interactive mode (mode-interactif.spec.ts),
// where the navigations step aside; no link to the annales is left on screen.
test('the interactive mode of a chapter shows no link to the annales', async ({ page }) => {
  await page.goto(CHAPITRE)
  // Keys and layout settle once React has hydrated the page and owns the URL.
  await expect(page).toHaveURL(/\?diapo=/)
  await expect(page.locator('[data-chapitre-mode=interactif]').first()).toBeAttached()

  await expect(page.locator('a[href="/annales"]:visible')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Annales' })).toHaveCount(0)
})
