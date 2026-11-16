import { expect, test, type Page } from '@playwright/test'

// A full-screen exercise in the interactive mode (#246), answered with the keyboard alone. The fake
// backend grades from content/ only for a logged-in student, as the real one does. Pythagoras:
//  4 ex-reconnaitre-hypotenuse (QCM, [RT] is right: C) · 6 ex-longueur-cotes (short answer)
//  7 ex-calcul-hypotenuse (numeric, 10 cm)
const CHAPITRE = '/3e/mathematiques/theoreme-de-pythagore'

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'e2e-eleve', url: baseURL ?? '' }])
})

/** Keys are lost until React has hydrated the page: wait for the client to own the URL. */
async function ouvrir(page: Page, diapo: string) {
  await page.goto(`${CHAPITRE}?diapo=${diapo}`)
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=${diapo}`)
  await expect(page.getByRole('button', { name: 'Vérifier' })).toBeVisible()
}

function option(page: Page, marker: string) {
  return page.getByRole('button', { name: new RegExp(`^Option ${marker}:`) })
}

test('a QCM answered with the keyboard alone', async ({ page }) => {
  await ouvrir(page, 'ex-reconnaitre-hypotenuse')

  await page.keyboard.press('a')
  await expect(option(page, 'A')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('3')
  await expect(option(page, 'C')).toHaveAttribute('aria-pressed', 'true')
  await expect(option(page, 'A')).not.toHaveAttribute('aria-pressed')

  await page.keyboard.press('Enter')
  await expect(page.getByText('Bien vu !')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=methode-prose`)
  await expect(page.getByText('Bien vu !')).toBeHidden()
})

test('a numeric answer with the keyboard alone', async ({ page }) => {
  await ouvrir(page, 'ex-longueur-cotes')
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=ex-calcul-hypotenuse`)

  // Focus moved to the slide's title: the answer field is the next stop.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('spinbutton', { name: 'Ta réponse' })).toBeFocused()
  await page.keyboard.type('10')
  await page.keyboard.press('Enter')

  await expect(page.getByText('Bien vu !')).toBeVisible()
  await expect(page.getByText('racine de 100 = 10 cm')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=ex-etapes-demonstration`)
})

test('a wrong answer: Entrée retries, the answer is never shown', async ({ page }) => {
  await ouvrir(page, 'ex-reconnaitre-hypotenuse')

  await page.keyboard.press('A')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Pas tout à fait…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeFocused()
  // Only the student's pick is marked: the right option stays muted.
  await expect(option(page, 'C')).toHaveAccessibleName(/muted$/)

  await page.keyboard.press('Enter')
  await expect(page.getByText('Pas tout à fait…')).toBeHidden()
  await page.keyboard.press('C')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Bien vu !')).toBeVisible()
})

test('skipping an exercise is allowed, and the strip says so', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the strip lives in a drawer below the desktop breakpoint')
  await ouvrir(page, 'ex-reconnaitre-hypotenuse')

  await page.getByRole('button', { name: /Passer/ }).click()
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=methode-prose`)
  await expect(page.getByRole('link', { name: /^Diapo 4 sur 10 .* Sans réponse$/ })).toBeVisible()
})

// The rewards of #248. The fake backend never awards XP, so a right answer here is one that earns
// nothing: the check mark and the particles, but no flight. Real gains are covered by the unit
// tests (celebration.test.tsx) and recorded on the real backend for the PR.
test.describe('rewards (MOTION.md)', () => {
  /** What moves in the sheet, sampled for a while: particles in place, running animations. */
  async function mouvements(page: Page) {
    return page.evaluate(async () => {
      const vus = { particules: 0, animations: 0, envols: 0 }
      const fin = performance.now() + 1200
      while (performance.now() < fin) {
        const feuille = document.querySelector('[data-feuille-resultat]')
        vus.particules = Math.max(
          vus.particules,
          document.querySelectorAll('[data-eclats] > *').length
        )
        vus.animations = Math.max(
          vus.animations,
          (feuille?.getAnimations({ subtree: true }) ?? []).filter(
            (a) => !(a instanceof CSSTransition)
          ).length
        )
        vus.envols = Math.max(vus.envols, document.querySelectorAll('[data-envol-xp]').length)
        await new Promise((r) => requestAnimationFrame(r))
      }
      return vus
    })
  }

  test('a right answer bursts, and nothing flies when nothing was earned', async ({ page }) => {
    await ouvrir(page, 'ex-reconnaitre-hypotenuse')
    await page.keyboard.press('C')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Bien vu !')).toBeVisible()

    const vus = await mouvements(page)
    expect(vus.particules).toBe(21)
    expect(vus.envols).toBe(0)
    await expect(page.getByText(/\+\d+\s*XP/)).toHaveCount(0)
  })

  test('a wrong answer moves nothing', async ({ page }) => {
    await ouvrir(page, 'ex-reconnaitre-hypotenuse')
    await page.keyboard.press('A')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Pas tout à fait…')).toBeVisible()

    expect(await mouvements(page)).toEqual({ particules: 0, animations: 0, envols: 0 })
  })
})
