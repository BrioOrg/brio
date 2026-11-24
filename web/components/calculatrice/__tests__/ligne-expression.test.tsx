import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { analyserLignes } from '@brio/content'

import { LigneExpression, type ActionsLigne } from '@/components/calculatrice/ligne-expression'
import type { Ligne } from '@/components/calculatrice/lignes'
import { InfobulleProvider } from '@/components/ui/infobulle'

function actions(): ActionsLigne {
  return {
    onTexte: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onEntree: vi.fn(),
    onEffacerVide: vi.fn(),
    onSupprimer: vi.fn(),
    onMasquer: vi.fn(),
    onCouleur: vi.fn(),
    onStyle: vi.fn(),
    onAjouterCurseur: vi.fn(),
    onValeur: vi.fn(),
    onCurseur: vi.fn(),
    onAnimer: vi.fn(),
  }
}

function rendre(
  texte: string,
  options: Partial<Ligne> & { peutAjouter?: boolean; erreurVisible?: boolean } = {}
) {
  const { peutAjouter = true, erreurVisible = true, ...reste } = options
  const ligne: Ligne = { id: 'l0', texte, couleur: 2, style: 'plein', masquee: false, ...reste }
  const [analyse] = analyserLignes([{ id: 'l0', texte }])
  const a = actions()
  render(
    <InfobulleProvider>
      <ol>
        <LigneExpression
          ligne={ligne}
          numero={3}
          analyse={analyse}
          erreurVisible={erreurVisible}
          premiere={false}
          peutAjouter={peutAjouter}
          limiteId={peutAjouter ? undefined : 'limite'}
          anime={false}
          champRef={() => undefined}
          curseurRef={() => undefined}
          actions={a}
        />
      </ol>
      <p id="limite">12 expressions au maximum</p>
    </InfobulleProvider>
  )
  return a
}

describe('LigneExpression', () => {
  it('nomme ses contrôles par le numéro de la ligne', () => {
    rendre('y = x')
    expect(screen.getByRole('textbox', { name: 'Expression 3' })).toHaveAttribute(
      'placeholder',
      'Écris une expression'
    )
    expect(screen.getByRole('button', { name: 'Afficher la courbe 3' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('button', { name: 'Couleur et trait de l’expression 3' })
    ).toHaveAttribute('aria-haspopup', 'menu')
    expect(screen.getByRole('button', { name: 'Supprimer l’expression 3' })).toBeInTheDocument()
  })

  it('propose un champ prêt pour les maths : sans majuscule, correction ni suggestion', () => {
    rendre('y = x')
    const champ = screen.getByRole('textbox', { name: 'Expression 3' })
    expect(champ).toHaveAttribute('inputmode', 'text')
    expect(champ).toHaveAttribute('autocapitalize', 'off')
    expect(champ).toHaveAttribute('autocomplete', 'off')
    expect(champ).toHaveAttribute('spellcheck', 'false')
  })

  it('montre une courbe masquée par un disque creux et un œil barré, pas seulement la couleur', () => {
    rendre('y = x', { masquee: true })
    const bouton = screen.getByRole('button', { name: 'Afficher la courbe 3' })
    expect(bouton).toHaveAttribute('aria-pressed', 'false')
    const pastille = bouton.querySelector('[data-pastille]')
    expect(pastille).toHaveClass('border-courbe-2', 'bg-transparent')
    expect(pastille?.querySelector('use')?.getAttribute('href')).toMatch(/eye-slash/)
  })

  it('n’offre ni pastille ni menu à une ligne qui ne trace rien', () => {
    rendre('2/3 + 1/6')
    expect(screen.queryByRole('button', { name: /courbe 3/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Couleur et trait/ })).toBeNull()
    // In its place, the line's number.
    expect(screen.getByRole('listitem').firstElementChild).toHaveTextContent(/^3$/)
  })

  it('lie le message du moteur au champ et souligne le caractère fautif', () => {
    rendre('y = 2 +')
    const champ = screen.getByRole('textbox', { name: 'Expression 3' })
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    const [a] = analyserLignes([{ id: 'l0', texte: 'y = 2 +' }])
    expect(a.genre).toBe('erreur')
    if (a.genre !== 'erreur') return
    expect(champ).toHaveAccessibleDescription(a.erreur.message)
    expect(document.querySelector('.decoration-wavy')).not.toBeNull()
  })

  it('ajoute le curseur d’une lettre inconnue, sauf à 12 lignes', async () => {
    const user = userEvent.setup()
    const a = rendre('y = bx')
    await user.click(screen.getByRole('button', { name: 'Ajouter un curseur b' }))
    expect(a.onAjouterCurseur).toHaveBeenCalledWith('b')
  })

  it('ne l’ajoute pas quand la liste est pleine, et dit pourquoi', async () => {
    const user = userEvent.setup()
    const a = rendre('y = bx', { peutAjouter: false })
    const bouton = screen.getByRole('button', { name: 'Ajouter un curseur b' })
    expect(bouton).toHaveAttribute('aria-disabled', 'true')
    expect(bouton).toHaveAccessibleDescription('12 expressions au maximum')
    await user.click(bouton)
    expect(a.onAjouterCurseur).not.toHaveBeenCalled()
  })

  it('ajoute une ligne à Entrée et efface une ligne vide à Retour arrière', async () => {
    const user = userEvent.setup()
    const a = rendre('')
    await user.click(screen.getByRole('textbox', { name: 'Expression 3' }))
    await user.keyboard('{Enter}')
    expect(a.onEntree).toHaveBeenCalled()
    await user.keyboard('{Backspace}')
    expect(a.onEffacerVide).toHaveBeenCalled()
  })

  it('donne un entier sans bascule, et une valeur décimale propre', () => {
    rendre('2 + 3')
    expect(screen.getByText('Résultat : 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Afficher le résultat/ })).toBeNull()
  })

  it('suit l’ordre de focus de la spec : champ, bascule, puis supprimer', async () => {
    const user = userEvent.setup()
    rendre('2/3 + 1/6')
    await user.click(screen.getByRole('textbox', { name: 'Expression 3' }))
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Afficher le résultat en écriture décimale' })
    ).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Supprimer l’expression 3' })).toHaveFocus()
  })

  it('place les bornes du curseur avant son bouton de lecture dans l’ordre de focus', async () => {
    const user = userEvent.setup()
    rendre('a = 2')
    await user.click(screen.getByRole('slider', { name: 'Curseur a' }))
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Minimum du curseur a' })).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Pas du curseur a' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Lancer l’animation du curseur a' })).toHaveFocus()
  })

  // #417: an undefined letter is said at once, while typing; other errors wait for the pause.
  it('propose le curseur d’une lettre inconnue tout de suite, pendant la saisie', async () => {
    const a = rendre('y = ax', { erreurVisible: false })
    expect(screen.getByText('La lettre a n’est pas définie.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ajouter un curseur a' }))
    expect(a.onAjouterCurseur).toHaveBeenCalledWith('a')
  })

  it('attend la pause pour les autres erreurs', () => {
    rendre('y = 2x +', { erreurVisible: false })
    expect(screen.getByRole('textbox', { name: 'Expression 3' })).not.toHaveAttribute(
      'aria-invalid'
    )
    expect(screen.queryByText(/il manque/i)).not.toBeInTheDocument()
  })

  it('n’affiche plus d’aperçu sous le champ : le champ est l’écriture', () => {
    rendre('y = 1/2x + 1')
    expect(document.querySelector('.katex')).toBeNull()
  })
})
