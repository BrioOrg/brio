import { describe, expect, it } from 'vitest'

import { sampleCurve } from '../../function-plot'
import { BUDGET_IMPLICITE } from '../implicite'
import { analyserLignes } from '../langage'
import {
  fenetreParDefaut,
  modeleVue,
  versSvg,
  type CourbeVue,
  type Fenetre,
  type GeometrieCourbe,
  type TailleVue,
} from '../vue'

// Gate 5 round 1 of #421: the view never freezes (V1-B1), never writes NaN (V1-I1), does not
// trace again what did not change (V1-I2), and writes a single 0 at the origin (V4-I2).

const TAILLE: TailleVue = { largeur: 800, hauteur: 600 }

function implicite(id: string, texte: string, compteur: { n: number }): CourbeVue {
  const a = analyserLignes([{ id, texte }])[0]
  if (a.genre !== 'implicite') throw new Error(texte)
  const F = a.F
  return {
    id,
    genre: 'implicite',
    F: (x, y) => {
      compteur.n++
      return F(x, y)
    },
    couleur: 1,
    pointille: false,
  }
}

function explicite(texte: string, cle?: string, compteur = { n: 0 }): CourbeVue {
  const a = analyserLignes([{ id: 'e', texte }])[0]
  if (a.genre !== 'explicite') throw new Error(texte)
  const f = a.f
  return {
    id: 'e',
    genre: 'explicite',
    f: (x) => {
      compteur.n++
      return f(x)
    },
    couleur: 2,
    pointille: false,
    ...(cle !== undefined && { cle }),
  }
}

describe('budget des courbes implicites', () => {
  it('borne les évaluations de toute la vue, quel que soit le nombre de lignes', () => {
    const compteur = { n: 0 }
    const courbes = Array.from({ length: 12 }, (_, i) =>
      implicite(`c${i}`, 'sin(x^3*y^3)=cos(y^3/x)', compteur)
    )
    modeleVue({ xMin: -50, xMax: 50, yMin: -37.5, yMax: 37.5 }, TAILLE, courbes)
    expect(compteur.n).toBeGreaterThan(0)
    expect(compteur.n).toBeLessThanOrEqual(BUDGET_IMPLICITE)
  })

  it('suit un budget donné', () => {
    const compteur = { n: 0 }
    const courbes = [0, 1, 2].map((i) => implicite(`c${i}`, 'sin(x*y)=0', compteur))
    modeleVue({ xMin: -50, xMax: 50, yMin: -37.5, yMax: 37.5 }, TAILLE, courbes, {
      budgetImplicite: 30000,
    })
    expect(compteur.n).toBeLessThanOrEqual(30000)
  })
})

describe('jamais NaN ni Infinity dans un chemin', () => {
  it.each(['y = exp(exp(-x))', 'y = x^x^x', 'y = exp(exp(x))', 'y = 1/x', 'y = tan(x)'])(
    '%s',
    (texte) => {
      const d = modeleVue(fenetreParDefaut(TAILLE), TAILLE, [explicite(texte)]).courbes[0].d
      expect(d).toMatch(/^M/)
      expect(d).not.toMatch(/NaN|Infinity/)
    }
  )

  it('protège aussi sampleCurve, celui des figures de cours', () => {
    const f: Fenetre = fenetreParDefaut(TAILLE)
    const points = sampleCurve((x) => Math.exp(Math.exp(x)), f.xMin, f.xMax, f, versSvg(f, TAILLE))
    for (const p of points.flat()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
    }
  })
})

describe('cache de géométrie', () => {
  it('ne retrace pas une courbe dont seuls la couleur ou le trait changent', () => {
    const cache = new Map<string, GeometrieCourbe>()
    const compteur = { n: 0 }
    const f = fenetreParDefaut(TAILLE)
    const c = explicite('y = x^2', 'y = x^2', compteur)
    const premier = modeleVue(f, TAILLE, [c], { cache })
    const apres = compteur.n
    expect(apres).toBeGreaterThan(0)
    const second = modeleVue(f, TAILLE, [{ ...c, couleur: 5, pointille: true }], { cache })
    expect(compteur.n).toBe(apres)
    expect(second.courbes[0]).toMatchObject({
      d: premier.courbes[0].d,
      couleur: 5,
      pointille: true,
    })
  })

  it('retrace quand la clé, la fenêtre ou la taille change, et oublie ce qui ne sert plus', () => {
    const cache = new Map<string, GeometrieCourbe>()
    const compteur = { n: 0 }
    const f = fenetreParDefaut(TAILLE)
    modeleVue(f, TAILLE, [explicite('y = x^2', 'a=1', compteur)], { cache })
    let n = compteur.n
    modeleVue(f, TAILLE, [explicite('y = x^2', 'a=2', compteur)], { cache })
    expect(compteur.n).toBeGreaterThan(n)
    expect(cache.size).toBe(1)
    n = compteur.n
    modeleVue(
      { ...f, xMin: f.xMin + 1, xMax: f.xMax + 1 },
      TAILLE,
      [explicite('y = x^2', 'a=2', compteur)],
      { cache }
    )
    expect(compteur.n).toBeGreaterThan(n)
    n = compteur.n
    modeleVue(f, TAILLE, [explicite('y = x^2', undefined, compteur)], { cache })
    expect(compteur.n).toBeGreaterThan(n)
    expect(cache.size).toBe(0)
  })
})

describe('un seul 0 à l’origine', () => {
  it('écrit exactement un « 0 » quand l’origine est dans le dessin, même au bord', () => {
    let vues = 0
    for (let cx = -10.4; cx <= 10.4; cx += 0.4) {
      for (let cy = -7.9; cy <= 7.9; cy += 0.4) {
        const f: Fenetre = { xMin: cx - 10, xMax: cx + 10, yMin: cy - 7.5, yMax: cy + 7.5 }
        const m = modeleVue(f, TAILLE)
        const zeros = [
          ...m.axeX.nombres,
          ...m.axeY.nombres,
          ...(m.origine ? [m.origine] : []),
        ].filter((t) => t.texte === '0')
        const origine = Math.abs(cx) <= 10 && Math.abs(cy) <= 7.5
        expect(zeros.length, `${cx} ${cy}`).toBe(origine ? 1 : zeros.length > 0 ? 1 : 0)
        if (origine) {
          vues++
          const z = m.origine!
          expect(z.x).toBeGreaterThanOrEqual(0)
          expect(z.x).toBeLessThanOrEqual(TAILLE.largeur)
          expect(z.y).toBeGreaterThanOrEqual(0)
          expect(z.y).toBeLessThanOrEqual(TAILLE.hauteur)
        }
      }
    }
    expect(vues).toBeGreaterThan(100)
  })
})
