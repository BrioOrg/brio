import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MESSAGES_CALCULATRICE } from '@brio/content'

// Le bloc « Calculatrice » dans l'éditeur de cours (#424) : on l'insère, on écrit ses
// expressions (le message du moteur s'affiche à la frappe), l'aperçu le montre, et
// l'enregistrement le garde. L'éditeur parle à l'API : on la moque (pas de back).
const { getCoursBrouillon, enregistrerCours, listerCompetences } = vi.hoisted(() => ({
  getCoursBrouillon: vi.fn(),
  enregistrerCours: vi.fn(),
  listerCompetences: vi.fn(),
}))

vi.mock('@brio/api-client', () => ({
  getCoursBrouillon,
  enregistrerCours,
  listerCompetences,
  CoursApiError: class CoursApiError extends Error {},
}))
vi.mock('@/lib/api-base-url', () => ({ apiBaseUrl: () => 'http://test' }))

import { EditeurCours } from '../editeur-cours'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // jsdom lays nothing out: the preview's grid is given a box, as a browser would measure it.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 600,
    bottom: 300,
    width: 600,
    height: 300,
    toJSON: () => ({}),
  })
  getCoursBrouillon.mockResolvedValue({
    titre: 'Mon cours',
    content: {
      schemaVersion: 1,
      id: 'c1',
      title: 'Mon cours',
      sections: [{ id: 's1', title: 'Le cours', kind: 'lesson', blocks: [] }],
    },
    updatedAt: null,
    statut: 'brouillon',
    versionPubliee: null,
    classeIds: [],
    niveauCode: '5e',
  })
  enregistrerCours.mockResolvedValue(undefined)
  listerCompetences.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function insererCalculatrice() {
  const user = userEvent.setup()
  render(<EditeurCours coursId="c1" />)
  await screen.findByLabelText('Titre du cours')
  await user.click(screen.getByLabelText('Ajouter un bloc ici'))
  await user.click(screen.getByRole('menuitem', { name: 'Calculatrice' }))
  return user
}

const formulaire = () => screen.getByText('Expressions (8 au maximum)').closest('fieldset')!
const expression = (n: number) =>
  within(formulaire()).getByRole('textbox', { name: `Expression ${n}` })

describe('CalculatriceEditeur', () => {
  it('creates the block, shows the engine’s message as one types, and previews it', async () => {
    const user = await insererCalculatrice()
    expect(screen.getByLabelText('Consigne (280 caractères au maximum)')).toBeInTheDocument()

    await user.type(expression(1), 'y = ax')
    expect(expression(1)).toHaveAttribute('aria-invalid', 'true')
    expect(expression(1)).toHaveAccessibleDescription(MESSAGES_CALCULATRICE.lettreInconnue('a'))

    await user.click(within(formulaire()).getByRole('button', { name: /Ajouter une expression/ }))
    await user.type(expression(2), 'a = 2')
    expect(expression(1)).not.toHaveAttribute('aria-invalid')

    await user.type(screen.getByLabelText('Consigne (280 caractères au maximum)'), 'Bouge $a$.')
    const apercu = screen.getByRole('region', { name: 'Calculatrice : Bouge a.' })
    const lignes = within(apercu).getAllByRole('textbox', { name: /^Expression/ })
    expect(lignes.map((l) => (l as HTMLInputElement).value)).toEqual(['y = ax', 'a = 2'])
    expect(within(apercu).getByRole('slider', { name: 'Curseur a' })).toBeInTheDocument()
    expect(
      within(apercu).getByRole('link', {
        name: 'Ouvrir cette calculatrice en grand, dans Explorer',
      })
    ).toHaveAttribute('target', '_blank')
  })

  it('refuses an inverted window, then saves the block with its window', async () => {
    const user = await insererCalculatrice()
    await user.type(expression(1), 'y = 2x')
    const fenetre = screen.getByRole('group', { name: 'Fenêtre' })
    await user.type(within(fenetre).getByLabelText('Minimum de x'), '5')
    await user.type(within(fenetre).getByLabelText('Maximum de x'), '-5')
    await user.type(within(fenetre).getByLabelText('Minimum de y'), '-1')
    await user.type(within(fenetre).getByLabelText('Maximum de y'), '10')
    expect(fenetre).toHaveAccessibleDescription(
      'La fenêtre est vide ou inversée : le minimum doit être plus petit que le maximum.'
    )

    await user.clear(within(fenetre).getByLabelText('Minimum de x'))
    await user.type(within(fenetre).getByLabelText('Minimum de x'), '-5')
    await user.clear(within(fenetre).getByLabelText('Maximum de x'))
    await user.type(within(fenetre).getByLabelText('Maximum de x'), '5')
    expect(fenetre).not.toHaveAccessibleDescription(/fenêtre/)

    await waitFor(
      () => {
        const dernier = enregistrerCours.mock.calls.at(-1)?.[2]
        expect(dernier?.content.sections[0].blocks[0]).toMatchObject({
          type: 'calculatrice',
          expressions: ['y = 2x'],
          fenetre: { x: [-5, 5], y: [-1, 10] },
        })
      },
      { timeout: 4000 }
    )
    expect(
      enregistrerCours.mock.calls.at(-1)?.[2].content.sections[0].blocks[0]
    ).not.toHaveProperty('consigne')
  })
})
