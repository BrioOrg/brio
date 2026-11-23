import { expect, test, type Page } from '@playwright/test'

// The graphing calculator (#421, ADR 0049 §3): opened from Explorer › Les outils, a typed
// expression is drawn, an unknown letter gets its slider, the slider moves the curve, and the
// address keeps the work. Nothing is asked of the backend: the fake one needs no new route.

const repere = (page: Page) => page.getByRole('img', { name: /^Repère/ })
const courbes = (page: Page) => repere(page).locator('[data-courbe] path')

async function ouvrirDepuisExplorer(page: Page) {
  await page.goto('/explorer')
  await page
    .getByRole('region', { name: 'Les outils' })
    .getByRole('link', { name: /Calculatrice graphique/ })
    .click()
  // next dev compiles the route on its first visit.
  await expect(page).toHaveURL('/explorer/calculatrice', { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { level: 1, name: 'Calculatrice graphique' })
  ).toBeAttached()
}

test('Explorer opens the calculator, and a typed expression is drawn in the first colour', async ({
  page,
}) => {
  await ouvrirDepuisExplorer(page)
  const champ = page.getByRole('textbox', { name: 'Expression 1' })
  await expect(champ).toHaveAttribute('placeholder', 'Par exemple : y = 2x + 1')

  await champ.fill('y = x^2')
  await expect(courbes(page)).toHaveCount(1)
  await expect(courbes(page).first()).toHaveClass(/stroke-courbe-1/)
  await expect(courbes(page).first()).toHaveAttribute('d', /^M/)
})

test('a slider for an unknown letter moves the line, and the address keeps the work', async ({
  page,
}) => {
  await ouvrirDepuisExplorer(page)
  await page.getByRole('textbox', { name: 'Expression 1' }).fill('y = ax + 1')

  // The letter is not defined: no curve, and the offer to add its slider, once typing pauses.
  await expect(courbes(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Ajouter un curseur a' }).click()

  const curseur = page.getByRole('slider', { name: 'Curseur a' })
  await expect(curseur).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('a = 1')
  await expect(courbes(page)).toHaveCount(1)
  const avant = await courbes(page).first().getAttribute('d')
  // Measured before the slider moves: its five steps must not add history entries (V3, gate 5).
  const longueurAvant = await page.evaluate(() => history.length)

  for (let i = 0; i < 5; i++) await curseur.press('ArrowRight')
  await expect(curseur).toHaveAttribute('aria-valuetext', 'a = 1,5')
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('a = 1,5')
  await expect(courbes(page).first()).not.toHaveAttribute('d', avant ?? '')
  const apres = await courbes(page).first().getAttribute('d')

  // The state reaches the address after a pause, without a history entry per change.
  await expect(page).toHaveURL(/\/explorer\/calculatrice\?e=[A-Za-z0-9_-]+$/)
  await page.waitForFunction(() => {
    const e = new URLSearchParams(location.search).get('e') ?? ''
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(e.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    )
    return json.includes('a = 1,5')
  })
  const longueurHistorique = await page.evaluate(() => history.length)
  expect(longueurHistorique).toBe(longueurAvant)

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Expression 1' })).toHaveValue('y = ax + 1')
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveValue('a = 1,5')
  await expect(courbes(page)).toHaveCount(1)
  await expect(courbes(page).first()).toHaveAttribute('d', apres ?? '')
  expect(await page.evaluate(() => history.length)).toBe(longueurHistorique)
})

test('an unreadable address opens an empty calculator, without an error', async ({ page }) => {
  await page.goto('/explorer/calculatrice?e=%%%pas-du-base64')
  await expect(page.getByRole('textbox', { name: 'Expression 1' })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Expression 2' })).toHaveCount(0)
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
})

test('the page never scrolls sideways', async ({ page }) => {
  await page.goto('/explorer/calculatrice')
  await page.getByRole('textbox', { name: 'Expression 1' }).fill('y = x^2 + 2x - 3')
  await expect(courbes(page)).toHaveCount(1)
  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(deborde).toBe(false)
})

// WCAG 2.4.11 (U7, gate 5 of #421): moving the focus with Tab never leaves the focused control
// under the sticky top bar or, on a phone, under the bottom bar; at 200 % zoom (640 × 400 CSS px).
function etatLong(): string {
  const lignes = [
    'y = x^2',
    'y = ax + 1',
    'a = 1',
    '2/3 + 1/6',
    'x^2 + y^2 = 9',
    'y = sin(x)',
    'y = bx',
    'b = 2',
  ].map((texte) => ({ texte }))
  return Buffer.from(JSON.stringify({ v: 1, lignes })).toString('base64url')
}

async function focusJamaisCache(page: Page) {
  await page.goto(`/explorer/calculatrice?e=${etatLong()}`)
  await expect(page.getByRole('textbox', { name: 'Expression 8' })).toHaveValue('b = 2')
  await page.getByRole('textbox', { name: 'Expression 1' }).focus()
  // Forwards, then back up with Shift+Tab: going up is where the top bar hides things.
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press(i < 45 ? 'Tab' : 'Shift+Tab')
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      // The Next.js dev tools (a portal at the end of the page) are not the page's.
      if (!el || el === document.body || el.tagName === 'NEXTJS-PORTAL') return null
      const box = el.getBoundingClientRect()
      const header = document.querySelector('header')?.getBoundingClientRect()
      const nav = Array.from(document.querySelectorAll('nav')).find(
        (n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().height > 0
      )
      const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight
      // Controls on the grid sit in the drawing, which may itself be scrolled away: skip them.
      if (
        el.closest('[role="group"][aria-label="Outils du repère"], [aria-label="Unité des angles"]')
      )
        return null
      if (el.closest('[aria-label="Fil d\'ariane"], header, nav')) return null
      return {
        nom: el.getAttribute('aria-label') || el.textContent || el.outerHTML.slice(0, 120),
        haut: box.top,
        bas: box.bottom,
        limiteHaut: header?.bottom ?? 0,
        limiteBas: navTop,
      }
    })
    if (!r) continue
    expect(r.haut, `${r.nom} sous la barre du haut`).toBeGreaterThanOrEqual(r.limiteHaut - 1)
    expect(r.bas, `${r.nom} sous la barre du bas`).toBeLessThanOrEqual(r.limiteBas + 1)
  }
}

test.describe('focus visible at 200 % zoom', () => {
  test.use({ viewport: { width: 640, height: 400 } })
  test('the focused control is never hidden under the top bar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'desktop at 200 %')
    await focusJamaisCache(page)
  })
})

test('on a phone, the focused control is never hidden under a bar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone layout')
  await focusJamaisCache(page)
})

// V1-B1 (gate 5 of #421): twelve dense implicit curves from a shared link do not freeze the page.
// Their evaluations share one budget, and while the plane is dragged the traced curves are moved,
// not traced again.
test('dragging over twelve dense implicit curves never blocks the page', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'mouse drag')
  const lignes = Array.from({ length: 12 }, () => ({ texte: 'sin(x^3*y^3)=cos(y^3/x)' }))
  const e = Buffer.from(JSON.stringify({ v: 1, lignes })).toString('base64url')
  await page.goto(`/explorer/calculatrice?e=${e}`)
  await expect(courbes(page).first()).toHaveAttribute('d', /^M/, { timeout: 20_000 })

  await page.evaluate(() => {
    const w = window as unknown as { plusLongue: number }
    w.plusLongue = 0
    new PerformanceObserver((liste) => {
      for (const t of liste.getEntries()) w.plusLongue = Math.max(w.plusLongue, t.duration)
    }).observe({ type: 'longtask' })
  })
  const box = await repere(page).boundingBox()
  if (!box) throw new Error('no grid')
  const avant = await courbes(page).first().getAttribute('d')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width / 2 + i * 15, box.y + box.height / 2 + i * 8)
  }
  const pendant = await page.evaluate(
    () => (window as unknown as { plusLongue: number }).plusLongue
  )
  // During the drag the curves traced before are moved (a transform), not traced again…
  expect(await courbes(page).first().getAttribute('d')).toBe(avant)
  await expect(repere(page).locator('g[transform]')).toHaveCount(1)
  await page.mouse.up()
  expect(pendant).toBeLessThan(200)
  // …and once it stops, they are traced for the new window.
  await expect(courbes(page).first()).not.toHaveAttribute('d', avant ?? '', { timeout: 20_000 })
  await expect(repere(page).locator('g[transform]')).toHaveCount(0)
})
