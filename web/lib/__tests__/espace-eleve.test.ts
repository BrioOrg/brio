import { describe, it, expect } from 'vitest'
import type { DevoirEleveVue, MaitriseInfo } from '@brio/api-client'

import { competenceARevoir, prochainsDevoirs } from '../espace-eleve'

const devoir = (id: string, echeanceAt: string, champs: Partial<DevoirEleveVue> = {}) =>
  ({
    id,
    classeId: 'c',
    titre: id,
    sourceType: 'chapitre',
    sourceRef: 's',
    echeanceAt,
    nombreExercices: 1,
    statutRendu: 'non_commence',
    corrige: false,
    ...champs,
  }) as DevoirEleveVue

describe('prochainsDevoirs', () => {
  it('garde les devoirs à rendre, les plus proches d’abord, dans la limite demandée', () => {
    const devoirs = [
      devoir('d', '2026-11-04T16:00:00Z'),
      devoir('a', '2026-11-01T16:00:00Z'),
      devoir('rendu', '2026-10-30T16:00:00Z', { statutRendu: 'rendu' }),
      devoir('corrige', '2026-10-30T16:00:00Z', { corrige: true }),
      devoir('c', '2026-11-03T16:00:00Z'),
      devoir('b', '2026-11-02T16:00:00Z'),
    ]
    expect(prochainsDevoirs(devoirs, 3).map((d) => d.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('competenceARevoir', () => {
  const maintenant = new Date('2026-10-31T12:00:00Z')
  const libelles = new Map([
    ['recente-forte', 'Recente forte'],
    ['recente-faible', 'Recente faible'],
    ['ancienne', 'Ancienne'],
    ['sans-niveau', 'Sans niveau'],
    ['limite', 'Limite'],
  ])
  const maitrise = (
    competenceCode: string,
    niveau: number | null,
    dernierTravail: string | null
  ): MaitriseInfo => ({ competenceCode, niveau, echantillon: 5, dernierTravail })

  it('choisit la maîtrise la plus faible parmi les 30 derniers jours', () => {
    const choisie = competenceARevoir(
      [
        maitrise('recente-forte', 3, '2026-10-30T10:00:00Z'),
        maitrise('recente-faible', 1, '2026-10-10T10:00:00Z'),
        maitrise('ancienne', 0, '2026-09-01T10:00:00Z'),
      ],
      libelles,
      maintenant
    )
    expect(choisie).toEqual({ code: 'recente-faible', intitule: 'Recente faible' })
  })

  it('compte une maîtrise de niveau 0', () => {
    const choisie = competenceARevoir(
      [
        maitrise('recente-forte', 2, '2026-10-30T10:00:00Z'),
        maitrise('limite', 0, '2026-10-30T10:00:00Z'),
      ],
      libelles,
      maintenant
    )
    expect(choisie?.code).toBe('limite')
  })

  it('ignore un niveau absent, une date absente et un code sans libellé', () => {
    const choisie = competenceARevoir(
      [
        maitrise('sans-niveau', null, '2026-10-30T10:00:00Z'),
        maitrise('recente-faible', 1, null),
        maitrise('inconnue', 0, '2026-10-30T10:00:00Z'),
      ],
      libelles,
      maintenant
    )
    expect(choisie).toBeNull()
  })
})
