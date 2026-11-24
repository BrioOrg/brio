import { describe, expect, it } from 'vitest'

import { fenetreParDefaut, graduationsX, modeleVue, zoomAutour, type TailleVue } from '../vue'

// #443: at extreme zoom the numbers of the x axis are long; the step is made coarser until they
// no longer overlap.

/** Width of a number as vue.ts estimates it: 7 px per character. */
const largeur = (texte: string) => texte.length * 7

function chevauchements(taille: TailleVue, zoom: number, centre: number): number {
  const f = zoomAutour(fenetreParDefaut(taille), { x: centre, y: 0 }, 1)
  const d = (f.xMax - f.xMin) / zoom / 2
  const fenetre = { ...f, xMin: centre - d, xMax: centre + d }
  const nombres = modeleVue(fenetre, taille).axeX.nombres
  let n = 0
  for (let i = 1; i < nombres.length; i++) {
    const a = nombres[i - 1]
    const b = nombres[i]
    if (b.x - a.x < (largeur(a.texte) + largeur(b.texte)) / 2) n++
  }
  return n
}

describe('graduations de l’axe des abscisses', () => {
  it.each([
    [{ largeur: 800, hauteur: 600 }, 1e6, 1e6],
    [{ largeur: 360, hauteur: 429 }, 1e6, 1e6],
    [{ largeur: 800, hauteur: 600 }, 1e3, 123456.789],
    [{ largeur: 360, hauteur: 429 }, 1, 0],
    [{ largeur: 360, hauteur: 429 }, 1e-4, 0],
  ])('%o, zoom %d autour de %d : aucun nombre ne chevauche son voisin', (taille, zoom, centre) => {
    expect(chevauchements(taille, zoom, centre)).toBe(0)
  })

  it('garde le pas habituel quand les nombres tiennent', () => {
    expect(graduationsX(-10, 10, 800).pas).toBe(2)
  })

  it('élargit le pas quand les nombres sont longs, et garde des graduations', () => {
    const g = graduationsX(999_999.99999, 1_000_000.00001, 800)
    expect(g.valeurs.length).toBeGreaterThanOrEqual(2)
    expect(g.pas).toBeGreaterThan(2e-6)
  })
})
