import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChampMathLive, OptionsChamp } from '@/components/calculatrice/mathlive'

// A stand-in for MathLive: an element whose `value` is LaTeX, as the real field gives it.
const champs: Array<{ options: OptionsChamp; el: HTMLElement; valeur: string }> = []
const basculerClavier = vi.fn()

vi.mock('@/components/calculatrice/mathlive', () => ({
  chargerMathLive: () =>
    Promise.resolve((options: OptionsChamp): ChampMathLive => {
      const el = document.createElement('div')
      el.tabIndex = 0
      el.setAttribute('role', 'textbox')
      options.hote.appendChild(el)
      const c = { options, el, valeur: options.latex }
      champs.push(c)
      el.addEventListener('focus', options.surFocus)
      el.addEventListener('blur', options.surBlur)
      return {
        element: el,
        charger: (latex) => {
          c.valeur = latex
        },
        placeholder: () => undefined,
        aLeFocus: () => document.activeElement === el,
      }
    }),
  basculerClavier: (el: HTMLElement) => basculerClavier(el),
}))

const { ChampMath } = await import('@/components/calculatrice/champ-math')
const { Calculatrice } = await import('@/components/calculatrice/calculatrice')

function props(over: Partial<Parameters<typeof ChampMath>[0]> = {}) {
  return {
    texte: 'y = 1/2x',
    latex: 'y=\\frac{1}{2}x',
    numero: 2,
    placeholder: 'Écris une expression',
    invalide: false,
    champRef: vi.fn(),
    onTexte: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onEntree: vi.fn(),
    onEffacerVide: vi.fn(),
    ...over,
  }
}

/** Flush the mock loader and the resulting React update together. */
async function pret() {
  await act(() => Promise.resolve())
  return screen.getByRole('textbox', { name: 'Expression 2' })
}

beforeEach(() => {
  champs.length = 0
})

describe('ChampMath', () => {
  it('remplace le champ texte par le champ de maths, nommé et ouvert sur le LaTeX du moteur', async () => {
    const p = props()
    render(<ChampMath {...p} />)
    const champ = await pret()
    expect(document.querySelector('input')).toBeNull()
    expect(champs[0].valeur).toBe('y=\\frac{1}{2}x')
    expect(p.champRef).toHaveBeenLastCalledWith(champ)
  })

  it('rend le texte du moteur pour ce qui est tapé', async () => {
    const p = props()
    render(<ChampMath {...p} />)
    await pret()
    act(() => champs[0].options.surTexte('y=\\frac{d}{dx}\\left(x^2\\right)'))
    expect(p.onTexte).toHaveBeenLastCalledWith('y = d/dx(x^2)')
  })

  it('charge un texte venu d’ailleurs (un curseur), sans écraser sa propre saisie', async () => {
    const p = props({ texte: 'a = 1', latex: 'a=1' })
    const { rerender } = render(<ChampMath {...p} />)
    await pret()
    rerender(<ChampMath {...p} texte="a = 1,5" latex="a=1{,}5" />)
    expect(champs[0].valeur).toBe('a=1{,}5')
    act(() => champs[0].options.surTexte('a=2'))
    rerender(<ChampMath {...p} texte="a = 2" latex="a=2" />)
    expect(champs[0].valeur).toBe('a=1{,}5')
  })

  it('suit l’état de la ligne : invalide, décrite par son message', async () => {
    const p = props()
    const { rerender } = render(<ChampMath {...p} />)
    const champ = await pret()
    rerender(<ChampMath {...p} invalide describedBy="msg" />)
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(champ).toHaveAttribute('aria-describedby', 'msg')
  })

  it('Entrée et effacement passent à la ligne', async () => {
    const p = props()
    render(<ChampMath {...p} />)
    await pret()
    champs[0].options.surEntree()
    champs[0].options.surEffacerVide()
    expect(p.onEntree).toHaveBeenCalled()
    expect(p.onEffacerVide).toHaveBeenCalled()
  })

  it('ouvre le clavier de maths du dernier champ par le bouton « Clavier »', async () => {
    render(
      <Calculatrice
        etatInitial={{ v: 1, lignes: [{ texte: 'y = x' }, { texte: 'y = 2x' }] }}
        synchroniserAdresse={false}
      />
    )
    const deuxieme = await pret()
    expect(document.querySelector('input')).toBeNull()
    act(() => deuxieme.focus())
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clavier mathématique' }))
    expect(basculerClavier).toHaveBeenCalledWith(deuxieme)
  })
})
