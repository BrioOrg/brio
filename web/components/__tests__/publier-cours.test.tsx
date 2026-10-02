import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problemesBrouillon, type Brouillon, type Probleme } from '@/lib/cours-editeur'

vi.mock('@brio/api-client', async () => {
  const actual = await vi.importActual<typeof import('@brio/api-client')>('@brio/api-client')
  return {
    ...actual,
    listerMesClasses: vi.fn(),
    definirPortees: vi.fn(),
    publierCours: vi.fn(),
  }
})

const brouillon: Brouillon = {
  schemaVersion: 1,
  id: 'c1',
  title: 'Pythagore',
  sections: [
    { id: 's1', title: 'Leçon', kind: 'lesson', blocks: [{ id: 'b1', type: 'prose', text: 'x' }] },
  ],
}

async function setup(
  overrides: {
    onPublie?: () => void
    onFermer?: () => void
    brouillon?: Brouillon
    problemes?: Probleme[]
    verificationEnCours?: boolean
  } = {}
) {
  const { listerMesClasses, definirPortees, publierCours } = await import('@brio/api-client')
  vi.mocked(listerMesClasses).mockResolvedValue([
    { id: 'cl1', libelle: '3e A', niveauCode: '3e' },
    { id: 'cl2', libelle: '3e B', niveauCode: '3e' },
  ])
  const onAvant = vi.fn().mockResolvedValue(undefined)
  const onAller = vi.fn()
  const onRefus = vi.fn()
  const b = overrides.brouillon ?? brouillon
  const { PublierCours } = await import('../prof/publier-cours')
  render(
    <PublierCours
      coursId="c1"
      brouillon={b}
      problemes={overrides.problemes ?? problemesBrouillon(b)}
      verificationEnCours={overrides.verificationEnCours ?? false}
      classeIdsInitiales={[]}
      onAvantPublicationAction={onAvant}
      onAllerAuProblemeAction={onAller}
      onRefusServeurAction={onRefus}
      onPublieAction={overrides.onPublie ?? vi.fn()}
      onFermerAction={overrides.onFermer ?? vi.fn()}
    />
  )
  return {
    onAvant,
    onAller,
    onRefus,
    definirPortees: vi.mocked(definirPortees),
    publierCours: vi.mocked(publierCours),
  }
}

describe('PublierCours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exige au moins une classe avant d’autoriser la publication', async () => {
    await setup()
    await screen.findByRole('checkbox', { name: /3e A/ })
    expect(screen.getByRole('button', { name: 'Publier' })).toBeDisabled()
  })

  it('enregistre, définit les portées, publie, puis confirme la version figée', async () => {
    const user = userEvent.setup()
    const onPublie = vi.fn()
    const { onAvant, definirPortees, publierCours } = await setup({ onPublie })
    publierCours.mockResolvedValue({ coursId: 'c1', version: 1 })
    definirPortees.mockResolvedValue(undefined)

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    await user.click(screen.getByRole('button', { name: 'Publier' }))

    await waitFor(() => expect(publierCours).toHaveBeenCalledWith(expect.any(String), 'c1'))
    expect(onAvant).toHaveBeenCalled()
    expect(definirPortees).toHaveBeenCalledWith(expect.any(String), 'c1', ['cl1'])
    expect(onPublie).toHaveBeenCalledWith(1)
    expect(await screen.findByText(/version 1/i)).toBeInTheDocument()
  })

  it('bloque un texte à trous dont un trou n’a pas de réponse', async () => {
    const user = userEvent.setup()
    await setup({
      brouillon: {
        ...brouillon,
        sections: [
          {
            id: 's1',
            title: 'Exercices',
            kind: 'exercises',
            blocks: [
              {
                id: 'e1',
                type: 'exercise',
                exerciseType: 'fill-blank',
                prompt: 'Complète.',
                template: '{} et {}',
                expected: ['a', ''],
                bank: ['a'],
              },
            ],
          },
        ],
      },
    })

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    expect(screen.getByText('Donne la réponse du trou 2.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publier' })).toBeDisabled()
  })

  it('signale une case de tableau vide avant publication', async () => {
    const user = userEvent.setup()
    await setup({
      brouillon: {
        ...brouillon,
        sections: [
          {
            id: 's1',
            title: 'Leçon',
            kind: 'lesson',
            blocks: [{ id: 't1', type: 'table', rows: [['a', '']] }],
          },
        ],
      },
    })

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    expect(screen.getByText('Remplis chaque case du tableau.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publier' })).toBeDisabled()
  })

  it('mène au bloc concerné depuis la liste des problèmes', async () => {
    const user = userEvent.setup()
    const { onAller, publierCours } = await setup({
      brouillon: {
        ...brouillon,
        sections: [
          {
            id: 's1',
            title: 'Leçon',
            kind: 'lesson',
            blocks: [{ id: 'f1', type: 'formula', latex: '' }],
          },
        ],
      },
    })

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    await user.click(screen.getByRole('button', { name: /Partie 1 · Formule.*Remplis la formule/ }))

    expect(onAller).toHaveBeenCalledWith(
      expect.objectContaining({ sectionId: 's1', blocId: 'f1', champ: 'latex' })
    )
    expect(publierCours).not.toHaveBeenCalled()
  })

  it('laisse publier malgré un simple avertissement', async () => {
    const user = userEvent.setup()
    const avertissement: Probleme = {
      code: 'EMPTY_OBJECTIVES',
      gravite: 'avertissement',
      sectionId: 's1',
      blocId: 'b1',
      message: 'Ce bloc est vide : ajoute un objectif ou une compétence.',
    }
    await setup({ problemes: [avertissement] })

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    expect(screen.getByText(/à vérifier/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publier' })).toBeEnabled()
  })

  it('attend la vérification des références avant d’autoriser la publication', async () => {
    const user = userEvent.setup()
    await setup({ verificationEnCours: true })

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    expect(screen.getByText(/Vérification des références/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publier' })).toBeDisabled()
  })

  it('remonte les violations d’un 422 à l’éditeur, sans afficher le texte du serveur', async () => {
    const user = userEvent.setup()
    const { CoursApiError } = await import('@brio/api-client')
    const { definirPortees, publierCours, onRefus } = await setup()
    definirPortees.mockResolvedValue(undefined)
    const violations = [
      { code: 'ANSWER_NOT_IN_BANK', sectionId: 's1', blockId: 'b1', field: 'bank' },
    ]
    publierCours.mockRejectedValue(
      new CoursApiError(422, 'Le serveur a refusé la publication.', violations)
    )

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    await user.click(screen.getByRole('button', { name: 'Publier' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le serveur a refusé la publication.'
    )
    expect(onRefus).toHaveBeenCalledWith(violations)
  })

  it('affiche le motif d’un 422 sans violations', async () => {
    const user = userEvent.setup()
    const { CoursApiError } = await import('@brio/api-client')
    const { definirPortees, publierCours, onRefus } = await setup()
    definirPortees.mockResolvedValue(undefined)
    publierCours.mockRejectedValue(new CoursApiError(422, 'Précisez l’établissement du cours.'))

    await user.click(await screen.findByRole('checkbox', { name: /3e A/ }))
    await user.click(screen.getByRole('button', { name: 'Publier' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Précisez l’établissement du cours.')
    expect(onRefus).not.toHaveBeenCalled()
  })
})
