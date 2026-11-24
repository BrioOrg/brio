import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BlockRenderer } from '@/components/blocs/block-renderer'
import { CalculatriceBloc } from '@/components/calculatrice/calculatrice-bloc'
import { lireBlocCalculatrice, type BlocCalculatrice } from '@/lib/calculatrice-bloc'
import { decoderEtat } from '@/lib/calculatrice-etat'

// The course block `calculatrice` (#424): the starting lines are drawn and editable, « Revenir au
// départ » brings them back, « Ouvrir en grand » carries the current state to Explorer, and the
// chapter's address is never written.

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  })
  window.history.replaceState(null, '', '/5e/mathematiques/proportionnalite-pourcentages')
})

afterEach(() => {
  vi.restoreAllMocks()
})

const BLOC: BlocCalculatrice = {
  id: 'explorer-a',
  type: 'calculatrice',
  consigne: 'Déplace le curseur $a$. Que se passe-t-il quand $a$ est négatif ?',
  expressions: ['f(x) = ax + 1', 'a = 1'],
  fenetre: { x: [-5, 5], y: [-5, 5] },
}

const region = () => screen.getByRole('region', { name: /^Calculatrice/ })
const repere = () => within(region()).getByRole('img', { name: /^Repère/ })
const chemin = () => repere().querySelector('[data-courbe] path')?.getAttribute('d')
const champ = (n: number) => screen.getByRole('textbox', { name: `Expression ${n}` })
const ouvrir = () =>
  screen.getByRole('link', { name: 'Ouvrir cette calculatrice en grand, dans Explorer' })
const etatDuLien = () =>
  decoderEtat(new URL(ouvrir().getAttribute('href') ?? '', 'http://x').searchParams.get('e'))

describe('CalculatriceBloc', () => {
  it('names its region after the instruction and shows it as rich text', () => {
    render(<CalculatriceBloc bloc={BLOC} />)
    expect(region()).toHaveAccessibleName(
      'Calculatrice : Déplace le curseur a. Que se passe-t-il quand a est négatif ?'
    )
    expect(region().querySelector('.katex')).not.toBeNull()
  })

  it('draws the starting lines in fields the student may edit', () => {
    render(<CalculatriceBloc bloc={BLOC} />)
    expect(champ(1)).toHaveValue('f(x) = ax + 1')
    expect(champ(2)).toHaveValue('a = 1')
    expect(chemin()).toMatch(/^M/)
  })

  it('turns the line when the slider a moves', () => {
    render(<CalculatriceBloc bloc={BLOC} />)
    const avant = chemin()
    const curseur = screen.getByRole('slider', { name: 'Curseur a' })
    fireEvent.change(curseur, { target: { value: '-2' } })
    expect(champ(2)).toHaveValue('a = −2')
    expect(chemin()).not.toBe(avant)
  })

  it('brings the starting lines back with « Revenir au départ »', async () => {
    const user = userEvent.setup()
    render(<CalculatriceBloc bloc={BLOC} />)
    const depart = chemin()
    await user.clear(champ(1))
    await user.type(champ(1), 'y = x^2')
    expect(chemin()).not.toBe(depart)

    await user.click(screen.getByRole('button', { name: 'Revenir aux expressions de départ' }))
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(2)
    expect(champ(1)).toHaveValue('f(x) = ax + 1')
    expect(champ(2)).toHaveValue('a = 1')
    expect(chemin()).toBe(depart)
    expect(etatDuLien().lignes.map((l) => l.texte)).toEqual(['f(x) = ax + 1', 'a = 1'])
  })

  it('opens Explorer on the current state, window included', async () => {
    const user = userEvent.setup()
    render(<CalculatriceBloc bloc={BLOC} />)
    expect(ouvrir().getAttribute('href')).toMatch(/^\/explorer\/calculatrice\?e=[A-Za-z0-9_-]+$/)
    expect(etatDuLien()).toMatchObject({
      lignes: [{ texte: 'f(x) = ax + 1' }, { texte: 'a = 1' }],
      fenetre: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      orthonorme: false,
    })

    await user.type(champ(2), '0')
    expect(etatDuLien().lignes.map((l) => l.texte)).toEqual(['f(x) = ax + 1', 'a = 10'])
  })

  it('never writes the chapter’s address', async () => {
    const user = userEvent.setup()
    render(<CalculatriceBloc bloc={BLOC} />)
    await user.type(champ(2), '5')
    await act(() => new Promise((r) => setTimeout(r, 500)))
    expect(window.location.pathname + window.location.search).toBe(
      '/5e/mathematiques/proportionnalite-pourcentages'
    )
    expect(screen.queryByText(/adresse de la page/)).toBeNull()
  })

  it('prints the starting expressions in KaTeX and the starting curve, without controls', () => {
    render(<CalculatriceBloc bloc={BLOC} />)
    const papier = region().querySelector('[data-impression]') as HTMLElement
    expect(papier).toHaveClass('hidden', 'print:flex')
    expect(papier.querySelectorAll('li .katex')).toHaveLength(2)
    expect(papier.querySelector('[data-courbe] path')?.getAttribute('d')).toMatch(/^M/)
    expect(papier.querySelector('button, input, a')).toBeNull()
    for (const controle of [
      screen.getByRole('button', { name: 'Revenir aux expressions de départ' }),
      ouvrir(),
    ]) {
      expect(controle.closest('.print\\:hidden')).not.toBeNull()
    }
  })

  it('is rendered by BlockRenderer, and a malformed block shows nothing', () => {
    const { container, unmount } = render(
      <BlockRenderer block={{ ...BLOC, fenetre: { x: [-5, 5], y: [-5, 5] } }} apercu={false} />
    )
    expect(region()).toBeInTheDocument()
    unmount()
    expect(lireBlocCalculatrice({ ...BLOC, expressions: [] })).toBeNull()
    expect(lireBlocCalculatrice({ ...BLOC, fenetre: { x: [5, -5], y: [0, 1] } })).toBeNull()
    render(<BlockRenderer block={{ id: 'k', type: 'calculatrice' }} apercu={false} />)
    expect(container.querySelector('section')).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })
})
