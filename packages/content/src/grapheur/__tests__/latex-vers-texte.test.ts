import { describe, expect, it } from 'vitest'

import { analyserLignes } from '../langage'
import { latexVersTexte } from '../latex-vers-texte'

// The LaTeX MathLive gives for what a student types (#417), read back as the engine's text. The
// LaTeX on the left was taken from MathLive 0.111 by typing in it (keys in the comment).

describe('latexVersTexte', () => {
  it.each([
    ['x', 'x'],
    // 1/2
    ['\\frac12', '1/2'],
    ['\\frac{1}{2}', '1/2'],
    // 1/x → +1
    ['\\frac{1}{x}+1', '1/x+1'],
    ['\\frac{x+1}{x-1}', '(x+1)/(x-1)'],
    // (x+1)/(x-1)
    ['\\frac{\\left(x+1\\right)}{\\left(x-1\\right)}', '((x+1))/((x-1))'],
    ['\\frac23+\\frac16', '2/3+1/6'],
    ['2\\frac{1}{3}', '2(1/3)'],
    ['x\\frac{1}{2}', 'x(1/2)'],
    ['1\\div\\frac{1}{2}', '1÷(1/2)'],
    ['\\frac{1}{2}^{3}', '(1/2)^3'],
    ['y=\\frac{1}{2}x', 'y = 1/2x'],
    // x^2+1, x^12 (smartSuperscript off)
    ['x^2+1', 'x^2+1'],
    ['x^{12}', 'x^(12)'],
    ['x^{2}', 'x^2'],
    ['x^{-1}', 'x^(-1)'],
    ['x^{\\left(-1\\right)}', 'x^((-1))'],
    ['x^{\\left(\\frac12\\right)}', 'x^((1/2))'],
    ['x^23', 'x^(2)3'],
    ['e^{x}', 'e^x'],
    ['10^{12}x', '10^(12)x'],
    // sqrt → x
    ['\\sqrt{x}', '√x'],
    ['\\sqrt1+1', '√1+1'],
    ['\\sqrt{2}3', '√(2)3'],
    ['\\sqrt{x+1}', '√(x+1)'],
    ['\\sqrt{\\left(x+1\\right)}', '√((x+1))'],
    ['\\sqrt[3]{x}', '∛(x)'],
    // 2,5x with decimalSeparator ','
    ['2{,}5x', '2,5x'],
    ['a=1{,}5', 'a = 1,5'],
    ['12\\,345', '12345'],
    ['\\sin\\left(x\\right)', 'sin(x)'],
    ['\\cos\\left(2x\\right)', 'cos(2x)'],
    ['\\ln\\left(x\\right)', 'ln(x)'],
    ['\\log\\left(x\\right)', 'log(x)'],
    ['\\exp\\left(x\\right)', 'exp(x)'],
    ['\\tan(x)', 'tan(x)'],
    ['x^2\\sin\\left(x\\right)', 'x^2sin(x)'],
    ['\\pi\\cdot x', 'π×x'],
    ['3\\cdot4', '3×4'],
    ['3\\times4', '3×4'],
    ['2\\div3', '2÷3'],
    ['\\left|x\\right|', '|x|'],
    ['\\left\\vert x\\right\\vert', '|x|'],
    ['\\lvert x\\rvert', '|x|'],
    ['\\left\\lbrack x\\right\\rbrack', '(x)'],
    ['abs\\left(x\\right)', 'abs(x)'],
    ['\\operatorname{abs}\\left(x\\right)', 'abs(x)'],
    ['\\mathrm{e}^{x}', 'e^x'],
    ['\\exponentialE^{x}', 'e^x'],
    // f'(x), f''(x)
    ["f'(x)", "f'(x)"],
    ['f^{\\prime}\\left(x\\right)', "f'(x)"],
    ['f^{\\prime}^{\\prime}\\left(x\\right)', "f''(x)"],
    ['f^{\\prime\\prime}\\left(x\\right)', "f''(x)"],
    ['f^{\\doubleprime}\\left(x\\right)', "f''(x)"],
    ['f\\left(x\\right)=x^2', 'f(x) = x^2'],
    ['f_1\\left(x\\right)', 'f1(x)'],
    ['f_{1}(x)', 'f1(x)'],
    ['x\\le2', 'x≤2'],
    ['x\\ge1', 'x≥1'],
    ['x<2', 'x<2'],
    ['x\\ne1', 'x≠1'],
    // d/dx → (x^2)
    ['\\frac{d}{dx}\\left(x^2\\right)', 'd/dx(x^2)'],
    ['\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(x^2\\right)', 'd/dx(x^2)'],
    ['\\frac{d}{\\differentialD x}\\left(x^2\\right)', 'd/dx(x^2)'],
    // d/dx(x^2) typed in one go: the rest lands in the denominator
    ['\\frac{d}{\\differentialD x\\left(x^2\\right)}', 'd/dx(x^2)'],
    ['\\frac{d}{dx}\\left(\\frac{d}{dx}\\left(x^3\\right)\\right)', 'd/dx(d/dx(x^3))'],
    ['\\frac{\\placeholder{}}{\\placeholder{}}', '()/()'],
    ['\\frac{x}{\\placeholder{}}', 'x/()'],
    ['\\infty', '∞'],
    ['\\alpha', 'α'],
    ['\\unknowncommand', '?'],
    ['x}+1', 'x+1'],
    ['', ''],
  ])('%s → %s', (latex, texte) => {
    expect(latexVersTexte(latex)).toBe(texte)
  })

  // The text is what the engine reads: the same value as the LaTeX means.
  it.each([
    ['\\frac{1}{2}x', 3, 1.5],
    ['2\\frac{1}{3}', 0, 2 / 3],
    ['1\\div\\frac{1}{2}', 0, 2],
    ['\\frac{1}{2}^{3}', 0, 1 / 8],
    ['\\frac{x+1}{x-1}', 3, 2],
    ['\\sqrt{x+1}', 3, 2],
    ['x^{\\left(\\frac12\\right)}', 4, 2],
    ['\\left|x-5\\right|', 2, 3],
    ['2{,}5x', 2, 5],
  ])('%s se lit comme il s’écrit', (latex, x, valeur) => {
    const [, a] = analyserLignes([
      { id: 'x', texte: `x = ${x}` },
      { id: 'l', texte: latexVersTexte(latex).replace(/x/g, `(${x})`) },
    ])
    expect(a.genre).toBe('calcul')
    if (a.genre === 'calcul') expect(a.valeur).toBeCloseTo(valeur, 10)
  })

  it('relit le LaTeX du moteur : le texte d’un lien redevient le même', () => {
    for (const texte of [
      'y = 2x + 1',
      'h(x) = x^2 - 3',
      "y = f'(x)",
      'x^2 + y^2 = 4',
      'a = 1,5',
      'y = |x - 1|',
      'y = sqrt(x + 1)',
      'y = d/dx(x^2 sin(x))',
      '2/3 + 1/6',
      'y = (x + 1)/(x - 1)',
      'y = e^(-x^2)',
      'y = ln(x)',
    ]) {
      const lignes = analyserLignes([
        { id: 'f', texte: 'f(x) = x^3' },
        { id: 'l', texte },
      ])
      const a = lignes[1]
      if (a.genre === 'vide' || a.genre === 'erreur') throw new Error(texte)
      const relu = analyserLignes([
        { id: 'f', texte: 'f(x) = x^3' },
        { id: 'l', texte: latexVersTexte(a.latex) },
      ])[1]
      expect(relu.genre, texte).toBe(a.genre)
      if (relu.genre === 'explicite' && a.genre === 'explicite') {
        for (const x of [0.5, 2]) expect(relu.f(x), texte).toBeCloseTo(a.f(x), 10)
      }
      if (relu.genre === 'calcul' && a.genre === 'calcul') expect(relu.valeur).toBe(a.valeur)
      if (relu.genre !== 'vide' && relu.genre !== 'erreur') expect(relu.latex).toBe(a.latex)
    }
  })
})
