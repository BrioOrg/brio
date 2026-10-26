import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { BlocEditeur } from '../bloc-editeur'
import { ProblemesDuBlocProvider } from '../problemes-du-bloc'
import { nouveauBloc, problemesBloc, type Bloc } from '@/lib/cours-editeur'

function Harnais({ depart, valider = false }: { depart?: Partial<Bloc>; valider?: boolean }) {
  const [bloc, setBloc] = useState<Bloc>(() => ({ ...nouveauBloc('code'), id: 'p1', ...depart }))
  return (
    <ProblemesDuBlocProvider value={{ problemes: valider ? problemesBloc(bloc, 's1') : [] }}>
      <BlocEditeur bloc={bloc} onModifier={(patch) => setBloc((b) => ({ ...b, ...patch }))} />
      <output data-testid="etat">{JSON.stringify(bloc)}</output>
    </ProblemesDuBlocProvider>
  )
}

function etat(): Bloc {
  return JSON.parse(screen.getByTestId('etat').textContent as string)
}

// userEvent.type interprète les accolades et crochets ; un programme se colle d'un coup.
function saisir(code: string) {
  fireEvent.change(screen.getByLabelText(/^Programme Scratch$|^Code$/), {
    target: { value: code },
  })
}

describe('CodeEditeur', () => {
  it('should offer Texte and Scratch, Scratch first selected', async () => {
    render(<Harnais />)
    const groupe = screen.getByRole('group', { name: 'Langage du programme' })
    expect(within(groupe).getByRole('button', { name: 'Scratch' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await userEvent.click(within(groupe).getByRole('button', { name: 'Texte' }))
    expect(etat().language).toBeUndefined()
    expect(screen.getByLabelText('Code')).toBeInTheDocument()

    await userEvent.click(within(groupe).getByRole('button', { name: 'Scratch' }))
    expect(etat().language).toBe('scratch')
  })

  it('should list the parse errors with their line while typing', () => {
    render(<Harnais />)
    saisir('quand le drapeau vert est cliqué\nsauter\ndire (2 × 3)')

    const champ = screen.getByLabelText('Programme Scratch')
    const erreurs = screen.getByRole('list')
    expect(champ.getAttribute('aria-describedby')).toContain(erreurs.id)
    expect(
      within(erreurs)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([
      'Ligne 2 : Instruction inconnue : « sauter ».',
      'Ligne 3 : Scratch écrit *, pas ×, dans « (2 × 3) ».',
    ])
    expect(screen.getByText(/Les blocs s’afficheront quand le programme/)).toBeInTheDocument()

    saisir('quand le drapeau vert est cliqué\ndire (2 * 3)')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('should draw the blocks once the programme parses', () => {
    render(<Harnais />)
    saisir('quand le drapeau vert est cliqué\ndire « Bonjour »')
    const blocs = screen.getByRole('figure', { name: 'Programme Scratch' })
    expect(within(blocs).getByText('Bonjour')).toBeInTheDocument()
  })

  it('should not parse a text programme', () => {
    render(<Harnais depart={{ language: undefined }} />)
    saisir('dire (2 × 3)')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('Aperçu')).not.toBeInTheDocument()
  })

  it('should mark the field when publication validation finds an invalid programme', () => {
    render(<Harnais valider depart={{ code: 'sauter' }} />)
    expect(screen.getByLabelText('Programme Scratch')).toHaveAttribute('aria-invalid', 'true')
  })
})
