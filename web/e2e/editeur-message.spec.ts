import { expect, test, type Page } from '@playwright/test'

// The Communauté composer in a real browser (#336), on the /design styleguide until the pages
// exist (#337). jsdom has no contentEditable: typing, Enter and the caret are only checked here.

async function ouvrir(page: Page) {
  await page.goto('/design')
  const zone = page.getByRole('textbox', { name: 'Ta question', exact: true })
  await zone.scrollIntoViewIfNeeded()
  // A click before hydration is lost.
  await expect(page.getByRole('button', { name: 'Gras' })).toBeVisible()
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="toolbar"]')
    return el && Object.keys(el).some((k) => k.startsWith('__react'))
  })
  await zone.click()
  return zone
}

const outil = (page: Page, nom: string) =>
  page.getByRole('toolbar', { name: 'Mise en forme' }).getByRole('button', { name: nom })

async function publier(page: Page) {
  await page.getByRole('textbox', { name: 'Titre de ta question' }).fill('Mon titre')
  await page.getByRole('button', { name: 'Publier ma question' }).click()
  const sortie = await page.getByLabel('Message produit').textContent()
  return JSON.parse(sortie ?? '{}').corps
}

test('writes bold, a formula and code with no markup to type', async ({ page }) => {
  const zone = await ouvrir(page)

  await page.keyboard.type('Le côté ')
  await outil(page, 'Gras').click()
  await page.keyboard.type('le plus long')
  await outil(page, 'Gras').click()
  await page.keyboard.type(' se calcule, 2 * 3 :')
  await expect(zone).toContainText('Le côté le plus long se calcule, 2 * 3 :')
  await expect(zone.locator('strong')).toContainText('le plus long')

  await outil(page, 'Formule').click()
  await page.getByRole('textbox', { name: 'Formule', exact: true }).pressSequentially('a')
  await page.getByRole('button', { name: 'Au carré' }).click()

  await outil(page, 'Code').click()
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill('print(9)')

  expect(await publier(page)).toEqual([
    { id: 'b1', type: 'prose', text: 'Le côté **le plus long** se calcule, 2 \\* 3 :' },
    { id: 'b2', type: 'formula', latex: 'a^2' },
    { id: 'b3', type: 'code', code: 'print(9)' },
  ])
})

test('Enter makes paragraphs and list items, and a list can be left', async ({ page }) => {
  await ouvrir(page)

  await page.keyboard.type('Intro')
  await page.keyboard.press('Enter')
  await outil(page, 'Liste à puces').click()
  await page.keyboard.type('un')
  await page.keyboard.press('Enter')
  await page.keyboard.type('deux')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Fin')

  expect(await publier(page)).toEqual([
    { id: 'b1', type: 'prose', text: 'Intro' },
    { id: 'b2', type: 'list', items: ['un', 'deux'] },
    { id: 'b3', type: 'prose', text: 'Fin' },
  ])
})

test('marks a selection, inserts inline maths, and the caret goes on after it', async ({
  page,
}) => {
  const zone = await ouvrir(page)

  await page.keyboard.type('mot')
  await page.keyboard.press('Shift+Home')
  await outil(page, 'Surligner').click()
  await expect(zone.locator('mark')).toContainText('mot')
  await page.keyboard.press('ArrowRight')
  await outil(page, 'Surligner').click()
  await page.keyboard.type(' donc ')

  await outil(page, 'Maths en ligne').click()
  await page.keyboard.type('x^2')
  await page.keyboard.press('Enter')
  await expect(zone.locator('[data-latex]')).toHaveCount(1)
  await page.keyboard.type(' fin')

  expect(await publier(page)).toEqual([{ id: 'b1', type: 'prose', text: '==mot== donc $x^2$ fin' }])
})

test('the preview renders what the composer holds', async ({ page }) => {
  await ouvrir(page)
  await outil(page, 'Italique').click()
  await page.keyboard.type('penché')

  await page.getByRole('button', { name: 'Aperçu' }).click()
  const apercu = page.getByRole('region', { name: 'Aperçu de ton message' })
  await expect(apercu.locator('em')).toHaveText('penché')

  await page.getByRole('button', { name: 'Continuer d’écrire' }).click()
  await expect(page.getByRole('textbox', { name: 'Ta question', exact: true })).toContainText(
    'penché'
  )
})

test('pasting keeps the text and drops the formatting', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const zone = await ouvrir(page)
  await page.evaluate(() =>
    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob(['<b>gras</b><img src=x>'], { type: 'text/html' }),
        'text/plain': new Blob(['gras'], { type: 'text/plain' }),
      }),
    ])
  )
  await page.keyboard.press('ControlOrMeta+v')
  await expect(zone).toHaveText('gras')
  await expect(zone.locator('img, b')).toHaveCount(0)
})

test('the composer stays within the screen on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile layout')
  await ouvrir(page)
  const barre = await page.getByRole('toolbar', { name: 'Mise en forme' }).boundingBox()
  const ecran = page.viewportSize()
  expect((barre?.x ?? 0) + (barre?.width ?? 0)).toBeLessThanOrEqual(ecran?.width ?? 0)
  const boutons = await page.getByRole('toolbar').getByRole('button').all()
  for (const bouton of boutons) {
    const box = await bouton.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
})
