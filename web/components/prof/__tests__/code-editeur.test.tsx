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

  it('should insert four spaces when Tab is pressed at the caret', () => {
    render(<Harnais depart={{ code: 'répéter 4 fois\navancer de 50 pas\nfin' }} />)
    const champ = screen.getByLabelText('Programme Scratch') as HTMLTextAreaElement
    champ.setSelectionRange(15, 15) // début de la 2e ligne

    fireEvent.keyDown(champ, { key: 'Tab' })

    expect(etat().code).toBe('répéter 4 fois\n    avancer de 50 pas\nfin')
  })

  it('should indent every selected line with Tab and dedent with Shift+Tab', () => {
    render(<Harnais depart={{ code: 'une\ndeux\ntrois' }} />)
    const champ = screen.getByLabelText('Programme Scratch') as HTMLTextAreaElement
    champ.setSelectionRange(0, 'une\ndeux\ntrois'.length)

    fireEvent.keyDown(champ, { key: 'Tab' })
    expect(etat().code).toBe('    une\n    deux\n    trois')

    champ.setSelectionRange(0, '    une\n    deux\n    trois'.length)
    fireEvent.keyDown(champ, { key: 'Tab', shiftKey: true })
    expect(etat().code).toBe('une\ndeux\ntrois')
  })

  it('should keep a keyboard exit: Escape then Tab leaves the field and is announced', () => {
    render(<Harnais depart={{ code: 'répéter 4 fois' }} />)
    const champ = screen.getByLabelText('Programme Scratch') as HTMLTextAreaElement
    champ.setSelectionRange(0, 0)

    fireEvent.keyDown(champ, { key: 'Escape' })
    expect(screen.getByText(/Tab quitte le champ/)).toBeInTheDocument()

    // Après Échap, Tab ne modifie plus le code (il laisse le focus sortir).
    const avant = etat().code
    const sortie = fireEvent.keyDown(champ, { key: 'Tab' })
    expect(sortie).toBe(true) // non annulé : le comportement par défaut (déplacer le focus) est conservé
    expect(etat().code).toBe(avant)
  })

  it('should re-arm indentation after any other key following Escape', () => {
    render(<Harnais depart={{ code: 'fin' }} />)
    const champ = screen.getByLabelText('Programme Scratch') as HTMLTextAreaElement
    champ.setSelectionRange(0, 0)

    fireEvent.keyDown(champ, { key: 'Escape' })
    fireEvent.keyDown(champ, { key: 'a' }) // réarme
    fireEvent.keyDown(champ, { key: 'Tab' })

    expect(etat().code).toBe('    fin')
  })
})
