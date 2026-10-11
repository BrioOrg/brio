import { expect, test, type Page } from '@playwright/test'

// The interactive mode of a chapter (#245, ADR 0032). Slides of the Pythagoras chapter:
//  1 debut · 2 intro-prose · 3 enonce-prose · 4 ex-reconnaitre-hypotenuse · 5 methode-prose
//  6 ex-longueur-cotes · 7 ex-calcul-hypotenuse · 8 ex-etapes-demonstration
//  9 ex-justifier-rectangle · 10 fin
const CHAPITRE = '/3e/mathematiques/theoreme-de-pythagore'

/** The slide shown, from the strip's current marker: what the student sees, not the URL. */
async function expectDiapo(page: Page, position: number, id: string) {
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=${id}`)
  await expect(page.locator('[aria-live="polite"]')).toHaveText(`Diapo ${position} sur 10`)
  await expect(page.locator(`[data-diapo="${id}"]`).first()).toBeVisible()
}

/** Keys are lost until React has hydrated the page: wait for the client to own the URL. */
async function ouvrir(page: Page, url: string) {
  await page.goto(url)
  await expect(page).toHaveURL(/\?diapo=/)
}

test('a first visit opens the interactive mode on the opening slide', async ({ page }) => {
  await ouvrir(page, CHAPITRE)
  await expectDiapo(page, 1, 'debut')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Le théorème de Pythagore' })
  ).toBeVisible()
  // The site header and the tutor rail step aside.
  await expect(page.getByRole('link', { name: 'Devoirs' })).toBeHidden()
})

test('the keyboard goes through the whole chapter and back', async ({ page }) => {
  await ouvrir(page, CHAPITRE)

  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 2, 'intro-prose')
  // Focus moves to the new slide's title.
  await expect(page.locator(':focus')).toHaveText('Énoncé du théorème')

  await page.keyboard.press(' ')
  await expectDiapo(page, 3, 'enonce-prose')

  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 10, 'fin')
  await expect(page.getByRole('heading', { name: 'Fin du chapitre' })).toBeFocused()

  // Nothing after the end.
  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 10, 'fin')

  await page.keyboard.press('ArrowLeft')
  await expectDiapo(page, 9, 'ex-justifier-rectangle')
})

test('a direct link opens its slide, even when it names a block inside a slide', async ({
  page,
}) => {
  await ouvrir(page, `${CHAPITRE}?diapo=ex-longueur-cotes`)
  await expectDiapo(page, 6, 'ex-longueur-cotes')

  // The figure joined the definition's slide: an old link to it still lands there.
  await page.goto(`${CHAPITRE}?diapo=schema-triangle`)
  await expectDiapo(page, 2, 'intro-prose')

  await page.goto(`${CHAPITRE}?diapo=disparu`)
  await expectDiapo(page, 1, 'debut')
})

test('the back button goes back one slide at a time', async ({ page }) => {
  await ouvrir(page, CHAPITRE)
  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 2, 'intro-prose')
  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 3, 'enonce-prose')
  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 4, 'ex-reconnaitre-hypotenuse')

  await page.goBack()
  await expectDiapo(page, 3, 'enonce-prose')
  await page.goBack()
  await expectDiapo(page, 2, 'intro-prose')
  await page.goForward()
  await expectDiapo(page, 3, 'enonce-prose')
})

test('switching modes keeps the position and the answer being typed', async ({ page }) => {
  await ouvrir(page, `${CHAPITRE}?diapo=ex-longueur-cotes`)
  const reponse = page.locator('#ex-longueur-cotes input')
  await reponse.fill('les cathètes')
  await reponse.blur()

  // Escape back to reading: the page lands on that exercise.
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(CHAPITRE)
  await expect(page.getByRole('button', { name: 'Mode interactif' })).toBeVisible()
  await expect(page.locator('#ex-longueur-cotes')).toBeInViewport()
  await expect(reponse).toHaveValue('les cathètes')

  // And back: the same slide, the answer still there.
  await page.getByRole('button', { name: 'Mode interactif' }).click()
  await expectDiapo(page, 6, 'ex-longueur-cotes')
  await expect(reponse).toHaveValue('les cathètes')
})

test('the reading mode is remembered on this device', async ({ page }) => {
  await ouvrir(page, CHAPITRE)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(CHAPITRE)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Mode interactif' })).toBeVisible()
  await expect(page).toHaveURL(CHAPITRE)

  // A shared slide link still opens the interactive mode, without changing the preference.
  await page.goto(`${CHAPITRE}?diapo=methode-prose`)
  await expectDiapo(page, 5, 'methode-prose')
  await page.goto(CHAPITRE)
  await expect(page.getByRole('button', { name: 'Mode interactif' })).toBeVisible()
})

test('a swipe changes slide on a touch screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only')
  await ouvrir(page, `${CHAPITRE}?diapo=enonce-prose`)

  // Chromium touch events through CDP: Playwright's touchscreen only taps.
  const cdp = await page.context().newCDPSession(page)
  const box = (await page.locator('[data-chapitre-article]').boundingBox())!
  const y = box.y + 40
  async function swipe(fromX: number, toX: number) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: fromX, y }],
    })
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: fromX + ((toX - fromX) * i) / 8, y }],
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }

  await swipe(box.x + box.width * 0.8, box.x + box.width * 0.2)
  await expectDiapo(page, 4, 'ex-reconnaitre-hypotenuse')

  await swipe(box.x + box.width * 0.2, box.x + box.width * 0.8)
  await expectDiapo(page, 3, 'enonce-prose')
})

test('the slides open from a drawer below the desktop breakpoint', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'drawer only below lg')
  await ouvrir(page, CHAPITRE)

  await page.getByRole('button', { name: 'Toutes les diapos' }).click()
  const tiroir = page.getByRole('dialog', { name: 'Diapos' })
  await expect(tiroir.getByRole('link', { name: /Diapo 1 sur 10/ })).toHaveAttribute(
    'aria-current',
    'step'
  )
  await tiroir.getByRole('link', { name: /Diapo 7 sur 10/ }).click()

  await expect(tiroir).toBeHidden()
  await expectDiapo(page, 7, 'ex-calcul-hypotenuse')
})

test.describe('slide transitions (MOTION.md)', () => {
  /** The frames on screen right after a key press: the leaving slide stays during its exit. */
  async function framesApresTouche(page: Page) {
    return page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      return new Promise<string[]>((resolve) =>
        requestAnimationFrame(() =>
          resolve(
            Array.from(document.querySelectorAll<HTMLElement>('[data-diapo]:not([hidden])')).map(
              (el) => el.dataset.diapo ?? ''
            )
          )
        )
      )
    })
  }

  test('the leaving slide exits while the next one enters', async ({ page }) => {
    await ouvrir(page, `${CHAPITRE}?diapo=enonce-prose`)
    // motion is loaded once the interactive mode opens.
    await expect(page.locator('[data-transitions="pretes"]')).toBeAttached()

    expect(await framesApresTouche(page)).toEqual(['enonce-prose', 'ex-reconnaitre-hypotenuse'])
    await expect(page.locator('[data-diapo="enonce-prose"]')).toBeHidden()
  })

  test('the leaving slide never comes back into the flow before it is hidden', async ({ page }) => {
    await ouvrir(page, `${CHAPITRE}?diapo=enonce-prose`)
    await expect(page.locator('[data-transitions="pretes"]')).toBeAttached()

    // A ResizeObserver runs after layout, right before paint: it sees every painted frame where
    // the leaving slide is back in the flow (the article grows) and not yet hidden.
    const retours = await page.evaluate(() => {
      const sortante = document.querySelector<HTMLElement>('[data-diapo="enonce-prose"]')!
      let n = 0
      const observer = new ResizeObserver(() => {
        if (!sortante.hidden && sortante.style.position !== 'absolute') n++
      })
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      observer.observe(document.querySelector('[data-chapitre-article]')!)
      return new Promise<number>((resolve) =>
        setTimeout(() => {
          observer.disconnect()
          resolve(n)
        }, 600)
      )
    })
    expect(retours).toBe(0)
  })

  /** Each block of a slide, right after a key press: its opacity and how many animations run. */
  async function tempsApresTouche(page: Page, diapo: string, key = 'ArrowRight') {
    return page.evaluate(
      ({ diapo, key }) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }))
        return new Promise<{ opacite: number; transform: string; animations: number }[]>(
          (resolve) =>
            requestAnimationFrame(() =>
              resolve(
                Array.from(
                  document.querySelectorAll<HTMLElement>(`[data-diapo="${diapo}"] > *`)
                ).map((el) => ({
                  opacite: Number(getComputedStyle(el).opacity),
                  transform: getComputedStyle(el).transform,
                  // Script animations only: focusing the title runs a CSS outline transition.
                  animations: el.getAnimations().filter((a) => !(a instanceof CSSTransition))
                    .length,
                }))
              )
            )
        )
      },
      { diapo, key }
    )
  }

  test('the blocks of the entering slide come in one after the other', async ({ page }) => {
    await ouvrir(page, `${CHAPITRE}?diapo=debut`)
    await expect(page.locator('[data-transitions="pretes"]')).toBeAttached()

    // intro-prose: the section title, then prose, definition, figure, formula. A frame after
    // the press, none of them has landed yet, and the last one has not even started.
    const temps = await tempsApresTouche(page, 'intro-prose')
    expect(temps).toHaveLength(5)
    expect(temps.every((t) => t.opacite < 1)).toBe(true)
    expect(temps[4].opacite).toBe(0)
  })

  test('a click during the beats ends them at once', async ({ page }) => {
    await ouvrir(page, `${CHAPITRE}?diapo=debut`)
    await expect(page.locator('[data-transitions="pretes"]')).toBeAttached()
    await tempsApresTouche(page, 'intro-prose')

    const opacites = await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent('pointerdown'))
      return Array.from(
        document.querySelectorAll<HTMLElement>('[data-diapo="intro-prose"] > *')
      ).map((el) => Number(getComputedStyle(el).opacity))
    })
    expect(opacites).toEqual([1, 1, 1, 1, 1])
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('the blocks of a slide are there at once', async ({ page }) => {
      await ouvrir(page, `${CHAPITRE}?diapo=debut`)
      await expect(page.locator('[data-transitions="pretes"]')).toBeAttached()

      const temps = await tempsApresTouche(page, 'intro-prose')
      expect(temps).toHaveLength(5)
      expect(temps).toEqual(temps.map(() => ({ opacite: 1, transform: 'none', animations: 0 })))
    })

    test('a step is revealed at once', async ({ page }) => {
      await ouvrir(page, '/6e/mathematiques/angles-bissectrice?diapo=ex-erreur-rapporteur')
      await expect(page.locator('[data-transitions="pretes"]')).toBeAttached()
      await page.keyboard.press('ArrowRight')
      await expect(page).toHaveURL(/diapo=methode-construire/)

      const etape = await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
        return new Promise<{ opacite: number; animations: number }>((resolve) =>
          requestAnimationFrame(() => {
            const el = document.querySelector<HTMLElement>('#methode-construire [data-etape="2"]')!
            resolve({
              opacite: Number(getComputedStyle(el).opacity),
              // Script animations only: focusing the title runs a CSS outline transition.
              animations: el.getAnimations().filter((a) => !(a instanceof CSSTransition)).length,
            })
          })
        )
      })
      expect(etape).toEqual({ opacite: 1, animations: 0 })
    })

    test('a pressed button drops at once', async ({ page }) => {
      await ouvrir(page, `${CHAPITRE}?diapo=intro-prose`)
      const face = page.getByRole('button', { name: 'Suivant' }).locator('[data-bouton-face]')
      const duree = await face.evaluate((el) => getComputedStyle(el).transitionDuration)
      expect(parseFloat(duree)).toBeLessThanOrEqual(0.001)
    })

    test('slides swap at once, without any transition', async ({ page }) => {
      await ouvrir(page, `${CHAPITRE}?diapo=enonce-prose`)
      await expect(page.locator('[data-transitions="pretes"]')).toBeAttached()

      expect(await framesApresTouche(page)).toEqual(['ex-reconnaitre-hypotenuse'])
      const style = await page
        .locator('[data-diapo="ex-reconnaitre-hypotenuse"]')
        .evaluate((el) => (el as HTMLElement).style.cssText)
      expect(style).toBe('')
    })
  })
})
