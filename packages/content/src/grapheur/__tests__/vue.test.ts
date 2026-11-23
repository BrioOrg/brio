import { describe, expect, it } from 'vitest'

import {
  CENTRE_MAX,
  ETENDUE_MAX,
  ETENDUE_MIN,
  decimalesDuPas,
  deplacer,
  depuisSvg,
  estOrthonorme,
  fenetreParDefaut,
  fenetreValide,
  formaterDecimal,
  formaterNombre,
  graduations,
  modeleVue,
  orthonormer,
  pasGraduation,
  versSvg,
  zoomAuCentre,
  zoomAutour,
  type CourbeVue,
  type Fenetre,
  type TailleVue,
} from '../vue'

const TAILLE: TailleVue = { largeur: 800, hauteur: 600 }
const MOINS = '−'
const FINE = ' '

describe('fenetreParDefaut', () => {
  it('va de −10 à 10 en x, centrée sur 0, orthonormée', () => {
    const f = fenetreParDefaut(TAILLE)
    expect(f).toEqual({ xMin: -10, xMax: 10, yMin: -7.5, yMax: 7.5 })
    expect(estOrthonorme(f, TAILLE)).toBe(true)
  })

  it('suit le ratio d’un écran en hauteur', () => {
    const f = fenetreParDefaut({ largeur: 360, hauteur: 720 })
    expect(f.yMax - f.yMin).toBeCloseTo(40)
  })

  it('reste lisible pour une taille nulle', () => {
    expect(fenetreValide(fenetreParDefaut({ largeur: 0, hauteur: 0 }))).toBe(true)
  })
})

describe('pasGraduation et graduations', () => {
  it('choisit un pas 1-2-5 proche d’une graduation tous les 80 px', () => {
    expect(pasGraduation(20, 800)).toBe(2)
    expect(pasGraduation(20, 1600)).toBe(1)
    expect(pasGraduation(20, 320)).toBe(5)
    expect(pasGraduation(1, 800)).toBe(0.1)
    expect(pasGraduation(2e-6, 800)).toBe(2e-7)
    expect(pasGraduation(1e6, 800)).toBe(100000)
  })

  it('ne renvoie que des pas 1, 2 ou 5 fois une puissance de 10', () => {
    for (let e = 1e-6; e < 1e6; e *= 1.37) {
      const pas = pasGraduation(e, 777)
      const mantisse = Number((pas / 10 ** Math.floor(Math.log10(pas))).toPrecision(3))
      expect([1, 2, 5]).toContain(mantisse)
      // About one graduation every 80 px: never fewer than 40 px, never more than 200 px.
      const pxParPas = (pas / e) * 777
      expect(pxParPas).toBeGreaterThan(40)
      expect(pxParPas).toBeLessThan(200)
    }
  })

  it('donne les multiples du pas dans l’intervalle, sans résidu flottant', () => {
    expect(graduations(-10, 10, 800)).toEqual({
      pas: 2,
      valeurs: [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10],
    })
    const { valeurs } = graduations(0.05, 0.75, 560)
    expect(valeurs).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])
  })

  it('compte les décimales d’un pas', () => {
    expect(decimalesDuPas(10)).toBe(0)
    expect(decimalesDuPas(1)).toBe(0)
    expect(decimalesDuPas(0.5)).toBe(1)
    expect(decimalesDuPas(0.02)).toBe(2)
    expect(decimalesDuPas(1e-7)).toBe(7)
  })
})

describe('zoomAutour', () => {
  it('garde fixe le point sous le pointeur', () => {
    const f = fenetreParDefaut(TAILLE)
    const pixel = { x: 200, y: 450 }
    const point = depuisSvg(f, TAILLE)(pixel.x, pixel.y)
    for (const facteur of [1.1, 2, 0.5, 0.9]) {
      const g = zoomAutour(f, point, facteur)
      const apres = versSvg(g, TAILLE)(point.x, point.y)
      expect(apres.x).toBeCloseTo(pixel.x, 6)
      expect(apres.y).toBeCloseTo(pixel.y, 6)
      expect(g.xMax - g.xMin).toBeCloseTo((f.xMax - f.xMin) / facteur)
    }
  })

  it('garde un repère orthonormé orthonormé', () => {
    const f = fenetreParDefaut(TAILLE)
    expect(estOrthonorme(zoomAutour(f, { x: 3, y: -2 }, 1.7), TAILLE)).toBe(true)
    expect(estOrthonorme(zoomAuCentre(f, 0.5), TAILLE)).toBe(true)
  })

  it('s’arrête aux bornes du zoom, dans les deux sens', () => {
    let f = fenetreParDefaut(TAILLE)
    for (let i = 0; i < 200; i++) f = zoomAutour(f, { x: 1, y: 1 }, 2)
    expect(fenetreValide(f)).toBe(true)
    expect(Math.min(f.xMax - f.xMin, f.yMax - f.yMin)).toBeCloseTo(ETENDUE_MIN, 12)
    expect(f.xMin).toBeLessThanOrEqual(1)
    expect(f.xMax).toBeGreaterThanOrEqual(1)

    let g = fenetreParDefaut(TAILLE)
    for (let i = 0; i < 200; i++) g = zoomAuCentre(g, 0.5)
    expect(fenetreValide(g)).toBe(true)
    expect(Math.max(g.xMax - g.xMin, g.yMax - g.yMin)).toBeLessThanOrEqual(ETENDUE_MAX)
  })

  it('ignore un facteur absurde', () => {
    const f = fenetreParDefaut(TAILLE)
    expect(zoomAutour(f, { x: 0, y: 0 }, 0)).toBe(f)
    expect(zoomAutour(f, { x: 0, y: 0 }, Number.NaN)).toBe(f)
    expect(zoomAutour(f, { x: 0, y: 0 }, Infinity)).toBe(f)
  })
})

describe('deplacer', () => {
  it('fait suivre le plan au pointeur', () => {
    const f = fenetreParDefaut(TAILLE)
    const g = deplacer(f, 40, -30, TAILLE)
    // 40 px to the right is one unit; the plane moves right, so the window moves left.
    expect(g.xMin).toBeCloseTo(-11)
    expect(g.xMax).toBeCloseTo(9)
    // 30 px upwards, 0.75 unit: the window goes down.
    expect(g.yMin).toBeCloseTo(-7.5 - 0.75)
  })

  it('ne s’éloigne pas au-delà des bornes', () => {
    let f = fenetreParDefaut(TAILLE)
    for (let i = 0; i < 1000; i++) f = deplacer(f, 1e6, 1e6, TAILLE)
    expect(fenetreValide(f)).toBe(true)
    expect((f.xMin + f.xMax) / 2).toBeCloseTo(-CENTRE_MAX)
  })
})

describe('orthonormer', () => {
  it('garde l’étendue en x et le centre en y', () => {
    const f: Fenetre = { xMin: -5, xMax: 15, yMin: 0, yMax: 100 }
    const g = orthonormer(f, TAILLE)
    expect(g.xMin).toBe(-5)
    expect(g.xMax).toBe(15)
    expect((g.yMin + g.yMax) / 2).toBeCloseTo(50)
    expect(estOrthonorme(g, TAILLE)).toBe(true)
    expect(estOrthonorme(f, TAILLE)).toBe(false)
  })
})

describe('formaterNombre', () => {
  it('écrit en français, sans exposant ni −0', () => {
    expect(formaterNombre(-2.5, 1)).toBe(`${MOINS}2,5`)
    expect(formaterNombre(0.0000002, 7)).toBe('0,0000002')
    expect(formaterNombre(1234567, 0)).toBe(`1${FINE}234${FINE}567`)
    expect(formaterNombre(-0, 0)).toBe('0')
    expect(formaterNombre(-0.001, 2)).toBe('0')
    expect(formaterNombre(1e21, 0)).not.toMatch(/e/i)
  })
})

describe('formaterDecimal', () => {
  // Gate 5 (V4-B1): no absolute threshold any more, the engine rounds residues away relatively;
  // what reaches the screen non-zero is never written "= 0".
  it('n’écrit jamais « = 0 » pour une valeur non nulle, et « ≈ » pour un double arrondi', () => {
    expect(formaterDecimal(Math.sin(Math.PI))).toEqual({
      texte: '0,000000000000000122',
      approche: true,
    })
    expect(formaterDecimal(0.1 + 0.2)).toEqual({ texte: '0,3', approche: true })
  })

  it('arrondit et dit quand la valeur est approchée', () => {
    expect(formaterDecimal(5 / 6)).toEqual({ texte: '0,83', approche: true })
    expect(formaterDecimal(Math.SQRT2)).toEqual({ texte: '1,41', approche: true })
    expect(formaterDecimal(0.25)).toEqual({ texte: '0,25', approche: false })
    expect(formaterDecimal(-1.5)).toEqual({ texte: `${MOINS}1,5`, approche: false })
    expect(formaterDecimal(0.000123456)).toEqual({ texte: '0,000123', approche: true })
  })

  it('groupe les grands nombres sans jamais d’exposant', () => {
    expect(formaterDecimal(2 ** 40)).toEqual({
      texte: `1${FINE}099${FINE}511${FINE}627${FINE}776`,
      approche: false,
    })
    const grand = formaterDecimal(1e30)
    expect(grand?.texte).not.toMatch(/e/i)
    expect(grand?.approche).toBe(true)
    expect(formaterDecimal(Infinity)).toBeNull()
  })
})

describe('modeleVue', () => {
  const parabole: CourbeVue = {
    id: 'a',
    genre: 'explicite',
    f: (x) => x * x,
    couleur: 1,
    pointille: false,
  }
  const cercle: CourbeVue = {
    id: 'b',
    genre: 'implicite',
    F: (x, y) => x * x + y * y - 9,
    couleur: 2,
    pointille: true,
  }

  it('dessine la grille, les axes, un seul 0 et les courbes', () => {
    const m = modeleVue(fenetreParDefaut(TAILLE), TAILLE, [parabole, cercle])
    expect(m.axeX.ligne).toEqual({ x1: 0, y1: 300, x2: 799, y2: 300 })
    expect(m.axeY.ligne).toEqual({ x1: 400, y1: 600, x2: 400, y2: 1 })
    expect(m.axeX.nom?.texte).toBe('x')
    expect(m.axeY.nom?.texte).toBe('y')
    expect(m.origine?.texte).toBe('0')
    const textes = [...m.axeX.nombres, ...m.axeY.nombres].map((t) => t.texte)
    expect(textes).not.toContain('0')
    expect(textes).toContain(`${MOINS}4`)
    // −10 … 10 by 2, the axis itself excluded.
    expect(m.grille.verticales).toHaveLength(10)
    expect(m.courbes.map((c) => [c.id, c.couleur, c.pointille])).toEqual([
      ['a', 1, false],
      ['b', 2, true],
    ])
    expect(m.courbes[0].d).toMatch(/^M/)
    expect(m.courbes[1].d).toMatch(/^M/)
  })

  it('colle les nombres au bord quand un axe sort de la fenêtre', () => {
    const f: Fenetre = { xMin: 5, xMax: 25, yMin: 10, yMax: 25 }
    const m = modeleVue(f, TAILLE)
    expect(m.axeX.ligne).toBeNull()
    expect(m.axeY.ligne).toBeNull()
    expect(m.origine).toBeNull()
    // The x axis is below the window: its numbers sit at the bottom edge.
    for (const t of m.axeX.nombres) expect(t.y).toBeGreaterThan(560)
    // The y axis is left of the window: its numbers sit at the left edge.
    for (const t of m.axeY.nombres) {
      expect(t.ancre).toBe('start')
      expect(t.x).toBeLessThan(10)
    }
  })

  it('montre le 0 d’un axe quand l’autre axe est hors champ', () => {
    const m = modeleVue({ xMin: 2, xMax: 12, yMin: -4, yMax: 4 }, TAILLE)
    expect(m.axeX.ligne).not.toBeNull()
    expect(m.axeY.nombres.map((t) => t.texte)).toContain('0')
  })

  it('ne trace rien pour une taille nulle ou une fenêtre invalide', () => {
    const vide = modeleVue(fenetreParDefaut(TAILLE), { largeur: 0, hauteur: 0 }, [parabole])
    expect(vide.courbes[0].d).toBe('')
    const invalide = modeleVue({ xMin: 1, xMax: 1, yMin: 0, yMax: 1 }, TAILLE, [parabole])
    expect(invalide.axeX.ligne).toBeNull()
  })

  it('suit les changements de fonction (le chemin change)', () => {
    const f = fenetreParDefaut(TAILLE)
    const d1 = modeleVue(f, TAILLE, [{ ...parabole, f: (x) => x + 1 }]).courbes[0].d
    const d2 = modeleVue(f, TAILLE, [{ ...parabole, f: (x) => 2 * x + 1 }]).courbes[0].d
    expect(d1).not.toBe(d2)
  })
})
