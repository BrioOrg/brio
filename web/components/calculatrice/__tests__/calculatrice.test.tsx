import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calculatrice } from '@/components/calculatrice/calculatrice'
import { encoderEtat, etatVide, type EtatCalculatrice } from '@/lib/calculatrice-etat'

// jsdom lays nothing out: the grid is given an 800 × 600 box, as a browser would measure it.
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
  window.history.replaceState(null, '', '/explorer/calculatrice')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function rendre(etat: EtatCalculatrice = etatVide(), synchroniserAdresse = true) {
  return render(<Calculatrice etatInitial={etat} synchroniserAdresse={synchroniserAdresse} />)
}

const repere = () => screen.getByRole('img', { name: /^Repère/ })
const courbes = () => repere().querySelectorAll('[data-courbe] path')
const champ = (n: number) => screen.getByRole('textbox', { name: `Expression ${n}` })

describe('Calculatrice', () => {
  it('commence par une ligne vide, avec l’exemple en placeholder et rien de tracé', () => {
    rendre()
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(1)
    expect(champ(1)).toHaveAttribute('placeholder', 'Par exemple : y = 2x + 1')
    expect(courbes()).toHaveLength(0)
    expect(repere()).toHaveAccessibleName(/Aucune courbe n’est tracée\./)
  })

  it('trace ce qui est tapé dans la première couleur, comme sa pastille', async () => {
    const user = userEvent.setup()
    rendre()
    await user.type(champ(1), 'y = x^2')
    expect(courbes()).toHaveLength(1)
    expect(courbes()[0]).toHaveClass('stroke-courbe-1')
    expect(courbes()[0].getAttribute('d')).toMatch(/^M/)
    const pastille = screen.getByRole('button', { name: 'Masquer la courbe 1' })
    expect(pastille.querySelector('[data-pastille]')).toHaveClass('bg-courbe-1')
    expect(repere()).toHaveAccessibleName(/1 courbe : y = x\^2, en bleu\./)
  })

  it('donne à chaque nouvelle ligne la prochaine couleur libre', async () => {
    const user = userEvent.setup()
    rendre()
    await user.type(champ(1), 'y = x{Enter}')
    expect(champ(2)).toHaveFocus()
    await user.type(champ(2), 'x^2 + y^2 = 9')
    const chemins = Array.from(courbes())
    expect(chemins.map((c) => c.getAttribute('class'))).toEqual([
      'stroke-courbe-1',
      'stroke-courbe-2',
    ])
  })

  it('n’affiche l’erreur qu’une fois le champ quitté, liée au champ', async () => {
    const user = userEvent.setup()
    rendre()
    await user.type(champ(1), 'y = 2 +')
    expect(champ(1)).not.toHaveAttribute('aria-invalid')
    expect(courbes()).toHaveLength(0)

    fireEvent.blur(champ(1))
    expect(champ(1)).toHaveAttribute('aria-invalid', 'true')
    const message = document.getElementById(champ(1).getAttribute('aria-describedby') ?? '')
    expect(message?.textContent).toBeTruthy()
  })

  it('affiche aussi l’erreur après une pause de frappe', () => {
    vi.useFakeTimers()
    rendre()
    fireEvent.change(champ(1), { target: { value: 'y = 2 +' } })
    expect(champ(1)).not.toHaveAttribute('aria-invalid')
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(champ(1)).toHaveAttribute('aria-invalid', 'true')
  })

  it('propose un curseur pour une lettre inconnue, qui fait bouger la droite', async () => {
    const user = userEvent.setup()
    rendre()
    await user.type(champ(1), 'y = ax + 1')
    fireEvent.blur(champ(1))
    expect(screen.getByText('La lettre a n’est pas définie.')).toBeInTheDocument()
    // Not an error state: the letter only lacks a slider.
    expect(champ(1)).not.toHaveAttribute('aria-invalid')

    await user.click(screen.getByRole('button', { name: 'Ajouter un curseur a' }))
    const curseur = screen.getByRole('slider', { name: 'Curseur a' })
    expect(curseur).toHaveFocus()
    expect(curseur).toHaveAttribute('aria-valuetext', 'a = 1')
    expect(champ(2)).toHaveValue('a = 1')
    expect(courbes()).toHaveLength(1)

    const avant = courbes()[0].getAttribute('d')
    fireEvent.change(curseur, { target: { value: '2' } })
    expect(champ(2)).toHaveValue('a = 2')
    expect(courbes()[0].getAttribute('d')).not.toBe(avant)
  })

  it('laisse l’élève changer les bornes du curseur, sans en accepter d’impossibles', async () => {
    const user = userEvent.setup()
    rendre({ v: 1, lignes: [{ texte: 'a = 2' }] })
    const max = screen.getByRole('textbox', { name: 'Maximum du curseur a' })
    await user.clear(max)
    await user.type(max, '5{Enter}')
    expect(screen.getByRole('slider', { name: 'Curseur a' })).toHaveAttribute('max', '5')

    await user.clear(max)
    await user.type(max, '−20{Enter}')
    expect(max).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('slider', { name: 'Curseur a' })).toHaveAttribute('max', '5')
  })

  it('lance l’animation à la demande seulement, et l’arrête à une touche', async () => {
    const user = userEvent.setup()
    rendre({ v: 1, lignes: [{ texte: 'a = 2' }] })
    const lancer = screen.getByRole('button', { name: 'Lancer l’animation du curseur a' })
    await user.click(lancer)
    expect(
      screen.getByRole('button', { name: 'Mettre en pause l’animation du curseur a' })
    ).toBeInTheDocument()
    await user.keyboard('{Shift}')
    expect(
      screen.getByRole('button', { name: 'Lancer l’animation du curseur a' })
    ).toBeInTheDocument()
  })

  it('montre un calcul en fraction exacte, puis en écriture décimale', async () => {
    const user = userEvent.setup()
    rendre()
    await user.type(champ(1), '2/3 + 1/6')
    expect(screen.getByText('Résultat : 5 sur 6')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Masquer la courbe/ })).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Afficher le résultat en écriture décimale' })
    )
    expect(screen.getByText('Résultat : environ 0,83')).toBeInTheDocument()
    expect(screen.getByText(/≈ 0,83/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Afficher le résultat en fraction' }))
    expect(screen.getByText('Résultat : 5 sur 6')).toBeInTheDocument()
  })

  it('masque et réaffiche une courbe sans toucher au champ', async () => {
    const user = userEvent.setup()
    rendre({ v: 1, lignes: [{ texte: 'y = x' }] })
    expect(courbes()).toHaveLength(1)
    const pastille = screen.getByRole('button', { name: 'Masquer la courbe 1' })
    expect(pastille).toHaveAttribute('aria-pressed', 'true')
    await user.click(pastille)
    expect(courbes()).toHaveLength(0)
    const afficher = screen.getByRole('button', { name: 'Afficher la courbe 1' })
    expect(afficher).toHaveAttribute('aria-pressed', 'false')
    expect(champ(1)).toBeEnabled()
    await user.click(afficher)
    expect(courbes()).toHaveLength(1)
  })

  it('change la couleur et le trait d’une courbe par son menu', async () => {
    const user = userEvent.setup()
    rendre({ v: 1, lignes: [{ texte: 'y = x' }] })
    await user.click(screen.getByRole('button', { name: 'Couleur et trait de l’expression 1' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitemradio', { name: 'Couleur 1 : bleu' })).toHaveFocus()
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Couleur 3 : magenta' }))
    expect(courbes()[0]).toHaveClass('stroke-courbe-3')
    expect(screen.queryByRole('menu')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Couleur et trait de l’expression 1' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Trait pointillé' }))
    expect(courbes()[0]).toHaveAttribute('stroke-dasharray')
  })

  it('ferme le menu à Échap et rend le focus à son bouton', async () => {
    const user = userEvent.setup()
    rendre({ v: 1, lignes: [{ texte: 'y = x' }] })
    const bouton = screen.getByRole('button', { name: 'Couleur et trait de l’expression 1' })
    await user.click(bouton)
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('menuitemradio', { name: 'Couleur 2 : orange' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(bouton).toHaveFocus()
  })

  it('supprime une ligne et donne le focus à la suivante ; Retour arrière efface une ligne vide', async () => {
    const user = userEvent.setup()
    rendre({ v: 1, lignes: [{ texte: 'y = x' }, { texte: 'y = 2x' }, { texte: '' }] })
    await user.click(screen.getByRole('button', { name: 'Supprimer l’expression 1' }))
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(2)
    expect(champ(1)).toHaveValue('y = 2x')
    expect(champ(1)).toHaveFocus()

    await user.click(champ(2))
    await user.keyboard('{Backspace}')
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(1)
    expect(champ(1)).toHaveFocus()
    // Alone, a line is emptied rather than removed.
    await user.click(screen.getByRole('button', { name: 'Supprimer l’expression 1' }))
    expect(champ(1)).toHaveValue('')
  })

  it('s’arrête à 12 expressions et le dit', async () => {
    const user = userEvent.setup()
    rendre()
    const ajouter = screen.getByRole('button', { name: 'Ajouter une expression' })
    for (let i = 0; i < 11; i++) await user.click(ajouter)
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(12)
    expect(ajouter).toHaveAttribute('aria-disabled', 'true')
    expect(ajouter).toHaveAccessibleDescription('12 expressions au maximum')
    await user.click(ajouter)
    expect(screen.getAllByRole('textbox', { name: /^Expression/ })).toHaveLength(12)
  })

  it('zoome depuis ses boutons et revient à la vue par défaut', async () => {
    const user = userEvent.setup()
    rendre()
    expect(repere()).toHaveAccessibleName(/x de −10 à 10 ;/)
    await user.click(screen.getByRole('button', { name: 'Zoomer' }))
    expect(repere()).not.toHaveAccessibleName(/x de −10 à 10 ;/)
    await user.click(screen.getByRole('button', { name: 'Revenir à la vue par défaut' }))
    expect(repere()).toHaveAccessibleName(/x de −10 à 10 ;/)
  })

  it('bascule l’unité des angles et le repère orthonormé', async () => {
    const user = userEvent.setup()
    rendre()
    const radians = screen.getByRole('button', { name: 'Radians' })
    const degres = screen.getByRole('button', { name: 'Degrés' })
    expect(radians).toHaveAttribute('aria-pressed', 'true')
    await user.click(degres)
    expect(degres).toHaveAttribute('aria-pressed', 'true')
    expect(radians).toHaveAttribute('aria-pressed', 'false')
    const ortho = screen.getByRole('button', { name: /^Repère orthonormé/ })
    expect(ortho).toHaveAttribute('aria-pressed', 'true')
    await user.click(ortho)
    expect(ortho).toHaveAttribute('aria-pressed', 'false')
  })

  it('écrit son état dans l’adresse après une pause, et pas à l’ouverture', () => {
    vi.useFakeTimers()
    const replace = vi.spyOn(window.history, 'replaceState')
    rendre({ v: 1, lignes: [{ texte: 'y = x' }] })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(replace).not.toHaveBeenCalled()

    fireEvent.change(champ(1), { target: { value: 'y = 3x' } })
    expect(replace).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(replace).toHaveBeenCalledTimes(1)
    const adresse = String(replace.mock.calls[0][2])
    expect(adresse).toBe(
      `/explorer/calculatrice?e=${encoderEtat({ v: 1, lignes: [{ texte: 'y = 3x', couleur: 1 }], angle: 'radians', orthonorme: true })}`
    )
  })

  it('n’écrit rien dans l’adresse en démonstration', () => {
    vi.useFakeTimers()
    const replace = vi.spyOn(window.history, 'replaceState')
    rendre(etatVide(), false)
    fireEvent.change(champ(1), { target: { value: 'y = x' } })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(replace).not.toHaveBeenCalled()
  })
})
