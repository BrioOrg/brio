import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EditeurMessage, type MessageEcrit } from '@/components/communaute/editeur-message'

function ecrire(zone: HTMLElement, texte: string) {
  zone.textContent = texte
  fireEvent.input(zone)
}

function selectionner(zone: HTMLElement, debut: number, fin: number) {
  const noeud = zone.firstChild as Text
  act(() => {
    const selection = document.getSelection() as Selection
    selection.removeAllRanges()
    const range = document.createRange()
    range.setStart(noeud, debut)
    range.setEnd(noeud, fin)
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
}

const outil = (nom: string) =>
  within(screen.getByRole('toolbar', { name: 'Mise en forme' })).getByRole('button', { name: nom })

function monter(mode: 'question' | 'reponse' | 'commentaire' = 'reponse') {
  const onEnvoyer = vi.fn<(m: MessageEcrit) => void>()
  render(<EditeurMessage mode={mode} onEnvoyer={onEnvoyer} />)
  return { onEnvoyer, envoyer: () => screen.getByRole('button', { name: /^Publier/ }) }
}

async function corpsEnvoye(onEnvoyer: ReturnType<typeof monter>['onEnvoyer'], bouton: HTMLElement) {
  await userEvent.click(bouton)
  expect(onEnvoyer).toHaveBeenCalledTimes(1)
  return onEnvoyer.mock.calls[0][0].corps
}

describe('EditeurMessage', () => {
  it('offers the palette, and nothing else', () => {
    monter()
    const outils = within(screen.getByRole('toolbar')).getAllByRole('button')
    expect(outils.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Gras',
      'Italique',
      'Surligner',
      'Liste à puces',
      'Maths en ligne',
      'Formule',
      'Code',
      'Programme Scratch',
    ])
  })

  it.each([
    ['Gras', '**grand**'],
    ['Italique', '*grand*'],
    ['Surligner', '==grand=='],
  ])('%s marks the selection, with no markup to type', async (nom, attendu) => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'le grand côté')
    selectionner(zone, 3, 8)

    await userEvent.click(outil(nom))
    expect(outil(nom)).toHaveAttribute('aria-pressed', 'true')
    // The student sees formatted text, never the delimiters.
    expect(zone.textContent).toBe('le grand côté')

    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'prose', text: `le ${attendu} côté` },
    ])
  })

  it('Liste à puces makes a list block', async () => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'un point')
    selectionner(zone, 0, 2)

    await userEvent.click(outil('Liste à puces'))
    expect(outil('Liste à puces')).toHaveAttribute('aria-pressed', 'true')
    expect(within(zone).getByRole('listitem')).toHaveTextContent('un point')

    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'list', items: ['un point'] },
    ])
  })

  it('Maths en ligne inserts a formula in the text, through the maths field', async () => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'donc  ici')
    selectionner(zone, 5, 5)

    await userEvent.click(outil('Maths en ligne'))
    const panneau = screen.getByRole('group', { name: 'Maths en ligne' })
    const champ = within(panneau).getByRole('textbox', { name: 'Formule à insérer dans le texte' })
    expect(champ).toHaveFocus()
    expect(within(panneau).getByRole('group', { name: 'Clavier mathématique' })).toBeInTheDocument()

    await userEvent.click(within(panneau).getByRole('button', { name: 'Racine carrée' }))
    await userEvent.keyboard('2')
    await userEvent.click(within(panneau).getByRole('button', { name: 'Insérer' }))

    expect(screen.queryByRole('group', { name: 'Maths en ligne' })).toBeNull()
    expect(within(zone).getByRole('img', { name: 'Formule : \\sqrt{2}' })).toBeInTheDocument()
    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'prose', text: 'donc $\\sqrt{2}$ ici' },
    ])
  })

  it('reopens the maths field on a click on a formula, to edit it', async () => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    await userEvent.click(outil('Maths en ligne'))
    await userEvent.keyboard('x{Enter}')

    await userEvent.click(within(zone).getByRole('img', { name: 'Formule : x' }))
    const champ = screen.getByRole('textbox', { name: 'Formule à insérer dans le texte' })
    expect(champ).toHaveValue('x')
    await userEvent.clear(champ)
    await userEvent.keyboard('y{Enter}')

    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'prose', text: '$y$' },
    ])
  })

  it('Escape closes the maths field without inserting', async () => {
    monter()
    await userEvent.click(outil('Maths en ligne'))
    await userEvent.keyboard('x{Escape}')
    expect(screen.queryByRole('group', { name: 'Maths en ligne' })).toBeNull()
    expect(screen.queryByRole('img', { name: /Formule/ })).toBeNull()
  })

  it('Formule adds a formula block with the maths keyboard, cutting the text at the caret', async () => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'avant apres')
    selectionner(zone, 5, 5)

    await userEvent.click(outil('Formule'))
    const champ = screen.getByRole('textbox', { name: 'Formule' })
    expect(champ).toHaveFocus()
    expect(screen.getByRole('group', { name: 'Clavier mathématique' })).toBeInTheDocument()
    await userEvent.keyboard('a')
    await userEvent.click(screen.getByRole('button', { name: 'Au carré' }))

    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'prose', text: 'avant' },
      { id: 'b2', type: 'formula', latex: 'a^2' },
      { id: 'b3', type: 'prose', text: 'apres' },
    ])
  })

  it('Code adds a code block, without any fence to type', async () => {
    const { onEnvoyer, envoyer } = monter()
    await userEvent.click(outil('Code'))
    const champ = screen.getByRole('textbox', { name: 'Code' })
    expect(champ).toHaveFocus()
    fireEvent.change(champ, { target: { value: 'print(2 * 3)\n' } })

    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'code', code: 'print(2 * 3)' },
    ])
  })

  it('Programme Scratch draws the blocks as they are typed', async () => {
    const { onEnvoyer, envoyer } = monter()
    await userEvent.click(outil('Programme Scratch'))
    const champ = screen.getByRole('textbox', { name: 'Programme Scratch' })
    fireEvent.change(champ, { target: { value: 'mettre a à 7' } })
    expect(screen.getByRole('figure', { name: 'Programme Scratch' })).toBeInTheDocument()

    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'code', code: 'mettre a à 7', language: 'scratch' },
    ])
  })

  it('removing a block joins the text around it', async () => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'avant apres')
    selectionner(zone, 5, 5)
    await userEvent.click(outil('Formule'))
    expect(screen.getByRole('textbox', { name: 'Suite de ta réponse' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Retirer cette formule' }))

    expect(screen.queryByRole('textbox', { name: 'Suite de ta réponse' })).toBeNull()
    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'prose', text: 'avant' },
      { id: 'b2', type: 'prose', text: 'apres' },
    ])
  })

  it('moves through the tools with the arrow keys, as one tab stop', async () => {
    monter()
    const gras = outil('Gras')
    gras.focus()
    expect(outil('Italique')).toHaveAttribute('tabindex', '-1')

    await userEvent.keyboard('{ArrowRight}')
    expect(outil('Italique')).toHaveFocus()
    expect(gras).toHaveAttribute('tabindex', '-1')
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(outil('Programme Scratch')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(gras).toHaveFocus()
  })

  it('takes Ctrl+B and Ctrl+I in the text', async () => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'un deux')
    selectionner(zone, 0, 2)
    fireEvent.keyDown(zone, { key: 'b', ctrlKey: true })
    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'prose', text: '**un** deux' },
    ])
  })

  it('undoes a tool with Ctrl+Z, and brings it back', async () => {
    monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'un deux')
    selectionner(zone, 0, 2)
    await userEvent.click(outil('Gras'))
    expect(zone.querySelector('strong')).not.toBeNull()

    fireEvent.keyDown(zone, { key: 'z', ctrlKey: true })
    expect(zone.querySelector('strong')).toBeNull()
    expect(zone.textContent).toBe('un deux')

    fireEvent.keyDown(zone, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(zone.querySelector('strong')).not.toBeNull()
  })

  it('pastes text only: formatting and HTML from elsewhere stay out', async () => {
    const { onEnvoyer, envoyer } = monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    fireEvent.paste(zone, {
      clipboardData: {
        getData: (type: string) =>
          type === 'text/plain' ? 'copié *ici*' : '<img src=x onerror=alert(1)>',
      },
    })
    expect(zone.querySelector('img')).toBeNull()
    expect(await corpsEnvoye(onEnvoyer, envoyer())).toEqual([
      { id: 'b1', type: 'prose', text: 'copié \\*ici\\*' },
    ])
  })

  it('shows the message as it will look, and keeps the text to go on', async () => {
    monter()
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'le grand côté')
    selectionner(zone, 3, 8)
    await userEvent.click(outil('Gras'))

    await userEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    const apercu = screen.getByRole('region', { name: 'Aperçu de ton message' })
    expect(within(apercu).getByText('grand').tagName).toBe('STRONG')
    expect(screen.queryByRole('toolbar')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Continuer d’écrire' }))
    expect(screen.getByRole('textbox', { name: 'Ta réponse' }).textContent).toBe('le grand côté')
  })

  it('refuses a title the server would refuse, and says why', async () => {
    const { onEnvoyer, envoyer } = monter('question')
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre de ta question' }), {
      target: { value: 'x'.repeat(201) },
    })
    ecrire(screen.getByRole('textbox', { name: 'Ta question' }), 'Le corps')
    await userEvent.click(envoyer())
    expect(onEnvoyer).not.toHaveBeenCalled()
    expect(screen.getByText(/Ton titre est trop long/)).toBeInTheDocument()
  })

  it('asks for a title and a body on a question', async () => {
    const { onEnvoyer, envoyer } = monter('question')
    await userEvent.click(envoyer())
    expect(onEnvoyer).not.toHaveBeenCalled()
    expect(screen.getByText('Donne un titre à ta question.')).toBeInTheDocument()
    expect(screen.getByText('Écris ta question avant de la publier.')).toBeInTheDocument()

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Titre de ta question' }),
      ' Un titre '
    )
    ecrire(screen.getByRole('textbox', { name: 'Ta question' }), 'Pourquoi ?')
    await userEvent.click(envoyer())
    expect(onEnvoyer).toHaveBeenCalledWith({
      titre: 'Un titre',
      corps: [{ id: 'b1', type: 'prose', text: 'Pourquoi ?' }],
    })
  })

  it.each([
    ['reponse', 'Ta réponse', 'Publier ma réponse'],
    ['commentaire', 'Ton commentaire', 'Publier mon commentaire'],
  ] as const)('has no title in %s mode', (mode, zone, envoyer) => {
    monter(mode)
    expect(screen.getByRole('textbox', { name: zone })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: envoyer })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Titre de ta question' })).toBeNull()
  })

  it('refuses what the server would, in French, before sending', async () => {
    const { onEnvoyer, envoyer } = monter()
    ecrire(screen.getByRole('textbox', { name: 'Ta réponse' }), 'a'.repeat(20_001))
    await userEvent.click(envoyer())
    expect(onEnvoyer).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('trop long')
  })

  it('keeps the text and says so when sending fails', async () => {
    const onEnvoyer = vi.fn().mockRejectedValue(new Error('500'))
    render(<EditeurMessage mode="reponse" onEnvoyer={onEnvoyer} />)
    const zone = screen.getByRole('textbox', { name: 'Ta réponse' })
    ecrire(zone, 'ma réponse')
    await userEvent.click(screen.getByRole('button', { name: 'Publier ma réponse' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('toujours là')
    expect(zone.textContent).toBe('ma réponse')
  })

  it('opens a stored message to edit it, and leaves out what is not in the palette', async () => {
    const onEnvoyer = vi.fn()
    const corps = [
      { id: 'a', type: 'prose', text: 'a **b** $x$' },
      { id: 'b', type: 'formula', latex: 'y' },
      { id: 'c', type: 'heading', text: 'hors palette' },
      { id: 'd', type: 'list', items: ['un'] },
      { id: 'e', type: 'code', code: 'x = 1', language: 'python' },
    ]
    render(
      <EditeurMessage
        mode="question"
        valeurInitiale={{ titre: 'Titre', corps }}
        onEnvoyer={onEnvoyer}
        libelleEnvoyer="Enregistrer"
      />
    )
    expect(screen.getByRole('textbox', { name: 'Titre de ta question' })).toHaveValue('Titre')
    expect(screen.getByRole('textbox', { name: 'Formule' })).toHaveValue('y')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onEnvoyer).toHaveBeenCalledWith({
      titre: 'Titre',
      corps: [
        { id: 'b1', type: 'prose', text: 'a **b** $x$' },
        { id: 'b2', type: 'formula', latex: 'y' },
        { id: 'b3', type: 'list', items: ['un'] },
        { id: 'b4', type: 'code', code: 'x = 1', language: 'python' },
      ],
    })
  })
})
