import { describe, expect, it } from 'vitest'

import { analyserLignes } from '../langage'
import { formaterDecimal } from '../nombres'
import { fenetreParDefaut, modeleVue, zoomAuCentre } from '../vue'

// #444 (gate 5 round 3 of #421, V4): a value the engine computed with doubles is never "=", even when
// it lands on an integer; and no huge number ever reaches a path.

function decimal(texte: string) {
  const a = analyserLignes([{ id: 'l', texte }])[0]
  if (a.genre !== 'calcul' && a.genre !== 'constante') throw new Error(`${texte}: ${a.genre}`)
  return {
    a,
    d: formaterDecimal(a.valeur, a.genre === 'calcul' ? a.exact : null, { arrondi: a.arrondi }),
  }
}

describe('le moteur dit quand une valeur est arrondie', () => {
  it.each(['π*10^12', 'e^30', 'sqrt(2)*10^11', 'sqrt(1,0000000000001)'])(
    '%s : arrondi, donc « ≈ », même sur un entier',
    (texte) => {
      const { a, d } = decimal(texte)
      expect(a.arrondi).toBe(true)
      expect(d?.approche).toBe(true)
    }
  )

  it('une valeur exacte reste « = »', () => {
    const { a, d } = decimal('2^40')
    expect(a.arrondi).toBe(false)
    expect(d).toEqual({ texte: '1 099 511 627 776', approche: false })
    expect(decimal('b = 3/4').d).toEqual({ texte: '0,75', approche: false })
  })

  it('une constante calculée avec des doubles est arrondie aussi', () => {
    expect(decimal('b = sqrt(2)').a.arrondi).toBe(true)
  })
})

describe('aucun nombre énorme dans un chemin', () => {
  const tailles = [
    { largeur: 800, hauteur: 600 },
    { largeur: 864, hauteur: 844 },
    { largeur: 360, hauteur: 429 },
  ]
  it.each(['y = 10^307*sin(x)', 'y = 10^307*cos(x)', 'y = 10^200*sin(x)', 'y = 10^300*x'])(
    '%s, à plusieurs tailles et zooms',
    (texte) => {
      const a = analyserLignes([{ id: 'l', texte }])[0]
      if (a.genre !== 'explicite') throw new Error(a.genre)
      for (const taille of tailles) {
        for (const z of [1, 3, 0.2]) {
          const d = modeleVue(zoomAuCentre(fenetreParDefaut(taille), z), taille, [
            { id: 'l', genre: 'explicite', f: a.f, couleur: 1, pointille: false },
          ]).courbes[0].d
          const nombres = (d.match(/-?\d+(\.\d+)?(e[+-]?\d+)?/g) ?? []).map(Number)
          for (const n of nombres)
            expect(Math.abs(n), `${taille.largeur} ${z}`).toBeLessThanOrEqual(1e6)
          expect(d).not.toMatch(/NaN|Infinity|e\+/)
        }
      }
    }
  )
})

describe('une courbe très raide reste dessinée', () => {
  const taille = { largeur: 800, hauteur: 600 }
  const d = (texte: string) => {
    const a = analyserLignes([{ id: 'l', texte }])[0]
    if (a.genre !== 'explicite') throw new Error(a.genre)
    return modeleVue(fenetreParDefaut(taille), taille, [
      { id: 'l', genre: 'explicite', f: a.f, couleur: 1, pointille: false },
    ]).courbes[0].d
  }

  it('y = 10^307*sin(x) traverse le cadre', () => {
    expect(d('y = 10^307*sin(x)')).toMatch(/^M/)
  })

  it('une droite qui sort du cadre est coupée à la marge, pas supprimée', () => {
    const chemin = d('y = 10^9*x')
    expect(chemin).toMatch(/^M/)
    const ys = [...chemin.matchAll(/[ML]-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]))
    expect(Math.min(...ys)).toBeLessThanOrEqual(0)
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(600)
  })
})
