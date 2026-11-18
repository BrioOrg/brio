import { expect, test, type Page } from '@playwright/test'

// Back leaves the chapter in one go (PL-3, #396, ADR 0046): one history entry per chapter visit,
// whatever the mode and the number of slides seen. Slides of the Pythagoras chapter:
//  1 debut · 2 intro-prose · 3 enonce-prose · 4 ex-reconnaitre-hypotenuse (QCM, C is right)
//  5 methode-prose · 6 ex-longueur-cotes · 7 ex-calcul-hypotenuse · 8 ex-etapes-demonstration
//  9 ex-justifier-rectangle · 10 fin
//
// The way in is Next's client navigation (`window.next.router.push`, exposed in development), as a
// click on a link would do, through pages that render without the catalogue: the fake backend does
// not serve it yet (#373), so Explorer → level → subject becomes / → /explorer → /ma-classe.
const CHAPITRE = '/3e/mathematiques/theoreme-de-pythagore'

type Repere = { url: string; titre: string | RegExp }
const ACCUEIL: Repere = { url: '/', titre: /^Salut/ }
const EXPLORER: Repere = { url: '/explorer', titre: 'Apprends, progresse, réussis.' }
const MA_CLASSE: Repere = { url: '/ma-classe', titre: '5e B · Collège Jean Moulin · 2026-2027' }

type FenetreNext = { next?: { router?: { push: (href: string) => void } } }

/** A page of the app, and not the chapter: its own heading, no chapter mode anywhere. */
async function expectPage(page: Page, repere: Repere) {
  // next dev compiles a route on its first visit.
  await expect(page).toHaveURL(repere.url, { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: repere.titre })).toBeVisible()
  await expect(page.locator('[data-chapitre-mode]')).toHaveCount(0)
}

/**
 * A client-side navigation, as a link does: once, after the page has hydrated (a second push would
 * add an entry of its own).
 */
async function naviguer(page: Page, url: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as unknown as FenetreNext).next?.router?.push === 'function' &&
          Object.keys(document.querySelector('h1') ?? {}).some((k) => k.startsWith('__reactFiber'))
      )
    )
    .toBe(true)
  const chemin = url.split('?')[0]
  await page.evaluate((href) => (window as unknown as FenetreNext).next!.router!.push(href), url)
  // next dev compiles a route on its first visit.
  await expect(page).toHaveURL((u) => u.pathname === chemin, { timeout: 20_000 })
}

/** The chapter is hydrated: its keys and gestures are bound. */
async function chapitrePret(page: Page) {
  await expect(
    page.locator('[data-chapitre-mode="interactif"][data-transitions="pretes"]')
  ).toBeAttached({ timeout: 20_000 })
}

async function expectDiapo(page: Page, position: number, id: string) {
  await expect(page).toHaveURL(`${CHAPITRE}?diapo=${id}`)
  await expect(page.locator('[aria-live="polite"]')).toHaveText(`Diapo ${position} sur 10`)
  await expect(page.locator(`[data-diapo="${id}"]`).first()).toBeVisible()
}

/** / → /explorer → /ma-classe → the chapter, each step a client navigation. */
async function arriverAuChapitre(page: Page) {
  await page.goto('/')
  await expectPage(page, ACCUEIL)
  await naviguer(page, EXPLORER.url)
  await expectPage(page, EXPLORER)
  await naviguer(page, MA_CLASSE.url)
  await expectPage(page, MA_CLASSE)
  await naviguer(page, CHAPITRE)
  await chapitrePret(page)
  await expectDiapo(page, 1, 'debut')
}

const longueur = (page: Page) => page.evaluate(() => window.history.length)

/** Opens slide `position` from the side strip on desktop, from the drawer on a phone. */
async function choisirDiapo(page: Page, isMobile: boolean, position: number) {
  const nom = new RegExp(`^Diapo ${position} sur 10`)
  if (isMobile) {
    await page.getByRole('button', { name: 'Toutes les diapos' }).click()
    const tiroir = page.getByRole('dialog', { name: 'Diapos' })
    await tiroir.getByRole('link', { name: nom }).click()
    await expect(tiroir).toBeHidden()
  } else {
    await page
      .getByRole('navigation', { name: 'Diapos du chapitre' })
      .getByRole('link', { name: nom })
      .click()
  }
}

/** Chromium touch events through CDP: Playwright's touchscreen only taps. */
async function swiper(page: Page, sens: 'suivante' | 'precedente') {
  const cdp = await page.context().newCDPSession(page)
  const box = (await page.locator('[data-chapitre-article]').boundingBox())!
  const y = box.y + 40
  const [de, a] =
    sens === 'suivante'
      ? [box.x + box.width * 0.8, box.x + box.width * 0.2]
      : [box.x + box.width * 0.2, box.x + box.width * 0.8]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: de, y }] })
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: de + ((a - de) * i) / 8, y }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test('one back leaves the chapter after many slides and a mode switch; three walk the way back', async ({
  page,
  isMobile,
}) => {
  await arriverAuChapitre(page)
  const arrivee = await longueur(page)

  // Six slide changes, by every keyboard gesture and the strip (the drawer on a phone).
  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 2, 'intro-prose')
  await page.keyboard.press(' ')
  await expectDiapo(page, 3, 'enonce-prose')
  await page.keyboard.press('Shift+ ')
  await expectDiapo(page, 2, 'intro-prose')
  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 3, 'enonce-prose')
  await choisirDiapo(page, isMobile, 7)
  await expectDiapo(page, 7, 'ex-calcul-hypotenuse')
  await page.keyboard.press('ArrowLeft')
  await expectDiapo(page, 6, 'ex-longueur-cotes')

  // A round trip through reading mode.
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(CHAPITRE)
  await page.getByRole('button', { name: 'Mode interactif' }).click()
  await expectDiapo(page, 6, 'ex-longueur-cotes')

  expect(await longueur(page)).toBe(arrivee)

  await page.goBack()
  await expectPage(page, MA_CLASSE)
  await page.goBack()
  await expectPage(page, EXPLORER)
  await page.goBack()
  await expectPage(page, ACCUEIL)
})

test('back after switching to reading leaves the chapter: the interactive mode never reopens', async ({
  page,
}) => {
  await arriverAuChapitre(page)
  for (const [position, id] of [
    [2, 'intro-prose'],
    [3, 'enonce-prose'],
    [4, 'ex-reconnaitre-hypotenuse'],
  ] as const) {
    await page.keyboard.press('ArrowRight')
    await expectDiapo(page, position, id)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Mode interactif' })).toBeVisible()

  await page.goBack()
  await expectPage(page, MA_CLASSE)
})

test('three swipes, then one back, and the list is there', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only')
  await arriverAuChapitre(page)
  const arrivee = await longueur(page)

  await swiper(page, 'suivante')
  await expectDiapo(page, 2, 'intro-prose')
  await swiper(page, 'suivante')
  await expectDiapo(page, 3, 'enonce-prose')
  await swiper(page, 'precedente')
  await expectDiapo(page, 2, 'intro-prose')
  expect(await longueur(page)).toBe(arrivee)

  await page.goBack()
  await expectPage(page, MA_CLASSE)
})

test('neither « Revoir » nor the end summary adds a history entry', async ({ page }) => {
  await arriverAuChapitre(page)
  const arrivee = await longueur(page)

  // A wrong answer offers « Revoir » the lesson: it opens that slide, in place.
  await choisirDiapo(page, test.info().project.name === 'mobile', 4)
  await expectDiapo(page, 4, 'ex-reconnaitre-hypotenuse')
  await page.keyboard.press('A')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Pas tout à fait…')).toBeVisible()
  await page.getByRole('link', { name: /^Revoir/ }).click()
  await expect(page).not.toHaveURL(`${CHAPITRE}?diapo=ex-reconnaitre-hypotenuse`)
  await expect(page).toHaveURL(new RegExp(`^[^#]*${CHAPITRE}\\?diapo=[^&#]+$`))

  // The end summary lists the exercises left with no answer: one of them opens in place too.
  // Walked to the end, so the exercises on the way are seen and left with no answer.
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 10, 'fin')
  const revenir = page.locator('[data-bilan="sans-reponse"]').getByRole('link').first()
  await revenir.click()
  await expect(page).not.toHaveURL(`${CHAPITRE}?diapo=fin`)

  expect(await longueur(page)).toBe(arrivee)
  await page.goBack()
  await expectPage(page, MA_CLASSE)
})

test('a direct link: back returns to the page it was followed from', async ({ page }) => {
  await page.goto(EXPLORER.url)
  await expectPage(page, EXPLORER)
  await naviguer(page, `${CHAPITRE}?diapo=enonce-prose`)
  await chapitrePret(page)
  await expectDiapo(page, 3, 'enonce-prose')

  for (const [position, id] of [
    [4, 'ex-reconnaitre-hypotenuse'],
    [5, 'methode-prose'],
    [6, 'ex-longueur-cotes'],
  ] as const) {
    await page.keyboard.press('ArrowRight')
    await expectDiapo(page, position, id)
  }

  await page.goBack()
  await expectPage(page, EXPLORER)
})

test('a direct link in a new tab: no slide of the chapter is behind it', async ({ page }) => {
  await page.goto(`${CHAPITRE}?diapo=enonce-prose`)
  await chapitrePret(page)
  const arrivee = await longueur(page)

  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 6, 'ex-longueur-cotes')

  expect(await longueur(page)).toBe(arrivee)
})

test('reload and a link copied from the address bar reopen the same slide', async ({
  page,
  context,
}) => {
  await arriverAuChapitre(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expectDiapo(page, 3, 'enonce-prose')

  await page.reload()
  await expectDiapo(page, 3, 'enonce-prose')

  const onglet = await context.newPage()
  await onglet.goto(page.url())
  await expectDiapo(onglet, 3, 'enonce-prose')
})

test.describe('forward after a back (criterion 12)', () => {
  test('reopens the last slide seen in interactive mode', async ({ page }) => {
    await arriverAuChapitre(page)
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
    await expectDiapo(page, 5, 'methode-prose')

    await page.goBack()
    await expectPage(page, MA_CLASSE)
    await page.goForward()
    await expectDiapo(page, 5, 'methode-prose')
    await expect(page.locator('[data-chapitre-mode="interactif"]')).toBeAttached()

    // The chapter is alive again: the keys move it, and back still leaves it at once.
    await page.keyboard.press('ArrowRight')
    await expectDiapo(page, 6, 'ex-longueur-cotes')
    await page.goBack()
    await expectPage(page, MA_CLASSE)
  })

  test('reopens the reading mode the student chose before leaving', async ({ page }) => {
    await arriverAuChapitre(page)
    await page.keyboard.press('ArrowRight')
    await expectDiapo(page, 2, 'intro-prose')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Mode interactif' })).toBeVisible()

    await page.goBack()
    await expectPage(page, MA_CLASSE)
    await page.goForward()
    await expect(page).toHaveURL(CHAPITRE)
    await expect(page.locator('[data-chapitre-mode="lecture"]')).toBeAttached()
    await expect(page.getByRole('button', { name: 'Mode interactif' })).toBeVisible()
  })
})

test.describe('no dead back (ADR 0046 §2, §7)', () => {
  test('after a full load, leaving by a link then back shows the chapter again', async ({
    page,
  }) => {
    await page.goto(`${CHAPITRE}?diapo=intro-prose`)
    await chapitrePret(page)
    // The chapter's entry keeps Next's state, even when written during hydration.
    expect(await page.evaluate(() => window.history.state?.__NA)).toBe(true)

    await naviguer(page, EXPLORER.url)
    await expectPage(page, EXPLORER)
    await page.goBack()
    await expectDiapo(page, 2, 'intro-prose')
    await expect(page.getByRole('heading', { level: 1, name: EXPLORER.titre })).toHaveCount(0)
  })

  test('an in-page link in reading mode adds no entry and leaves no dead back', async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, '« Sur cette page » sits in the desktop rail')
    await context.addCookies([{ name: 'brio_mode_chapitre', value: 'lecture', url: baseURL! }])
    await page.goto(CHAPITRE)
    await expect(page.locator('[data-chapitre-mode="lecture"]')).toBeAttached()
    const arrivee = await longueur(page)

    const sommaire = page.getByRole('navigation', { name: 'Sur cette page' })
    const lien = sommaire.getByRole('link').last()
    const cible = (await lien.getAttribute('href'))!.slice(1)
    // A click before hydration would be the browser's own jump: wait for React to own the page.
    await expect
      .poll(() =>
        page
          .locator('[data-chapitre-mode]')
          .evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactFiber')))
      )
      .toBe(true)
    await lien.click()
    await expect(page.locator(`[id="${cible}"]`)).toBeFocused()
    await expect(page.locator(`[id="${cible}"]`)).toBeInViewport()
    await expect(page).toHaveURL(CHAPITRE)
    expect(await longueur(page)).toBe(arrivee)

    await naviguer(page, EXPLORER.url)
    await expectPage(page, EXPLORER)
    await page.goBack()
    await expect(page).toHaveURL(CHAPITRE)
    await expect(page.locator('[data-chapitre-mode="lecture"]')).toBeAttached()
  })
})
