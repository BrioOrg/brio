import { expect, test, type Page } from '@playwright/test'

// Reading a curve (#422, ADR 0049 §4): the grid takes the focus, Tab chooses the curve, Enter
// goes through its remarkable points, the arrows move the point and a polite live region says
// where it is once it stops; a tap on the curve reads it too. Nothing is asked of the backend.

const NBSP = ' '

function adresse(...textes: string[]): string {
  const json = JSON.stringify({ v: 1, lignes: textes.map((texte) => ({ texte })) })
  return `/explorer/calculatrice?e=${Buffer.from(json).toString('base64url')}`
}

const plan = (page: Page) => page.getByRole('group', { name: 'Repère', exact: true })
const etiquette = (page: Page) => page.locator('[data-lecture]')

test('y = x² − 4: keyboard reading, remarkable points, announcement, and a tap on the curve', async ({
  page,
  isMobile,
}) => {
  await page.goto(adresse('y = x^2 - 4'))
  await expect(page.locator('[data-courbe] path')).toHaveCount(1, { timeout: 20_000 })

  // Keyboard only: the grid, Tab to choose the curve.
  await plan(page).focus()
  await expect(plan(page)).toHaveAccessibleDescription(/Utilise Tab pour choisir une courbe\./)
  await page.keyboard.press('Tab')
  await expect(plan(page)).toBeFocused()
  await expect(etiquette(page)).toHaveText(new RegExp(`^Courbe 1${NBSP}: \\(0${NBSP}; −4\\)$`))
  await expect(page.locator('[data-point-remarquable]')).toHaveCount(3)

  // Enter goes through the remarkable points: both zeros and the minimum, exact.
  const vus = new Set<string>()
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Enter')
    vus.add((await etiquette(page).textContent()) ?? '')
  }
  expect([...vus].sort()).toEqual(
    [
      `Ordonnée à l’origine · Minimum${NBSP}: (0${NBSP}; −4)`,
      `Zéro${NBSP}: (−2${NBSP}; 0)`,
      `Zéro${NBSP}: (2${NBSP}; 0)`,
    ].sort()
  )

  // An arrow moves the point by a graduation; the live region speaks once it stops, in French.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-annonce-lecture]')).toHaveText(
    new RegExp(`^Courbe 1${NBSP}: x = \\d+(,\\d+)?${NBSP}; y = −?\\d+(,\\d+)?$`)
  )

  // A tap on the curve reads it there, after Escape has put the reading away.
  await page.keyboard.press('Escape')
  await expect(etiquette(page)).toHaveCount(0)
  const svg = page.getByRole('img', { name: /^Repère/ })
  const boite = await svg.boundingBox()
  const vb = (await svg.getAttribute('viewBox'))?.split(' ').map(Number) ?? []
  const desc = (await svg.locator('desc').textContent()) ?? ''
  const nombre = (t: string) => Number(t.replace('−', '-').replace(',', '.').replace(/\s/g, ''))
  const m = /x de (\S+) à (\S+) ; y de (\S+) à (\S+)\./.exec(desc.replace(/ /g, ' '))
  expect(m && boite && vb.length === 4).toBeTruthy()
  const [xMin, xMax, yMin, yMax] = m!.slice(1).map(nombre)
  const px = boite!.x + ((0 - xMin) / (xMax - xMin)) * boite!.width
  const py = boite!.y + ((yMax - -4) / (yMax - yMin)) * boite!.height
  if (isMobile) await page.touchscreen.tap(px, py)
  else await page.mouse.click(px, py)
  await expect(etiquette(page)).toHaveText(new RegExp(`^(Courbe 1${NBSP}: \\(|Ordonnée)`))
})
