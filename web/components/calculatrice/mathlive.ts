// MathLive (MIT), the maths field of the calculator (#417), behind a small interface: the only file
// that knows its API. Loaded with a dynamic import, in the browser only — a custom element cannot
// be rendered on the server — and so on the calculator's routes only.

/** The inline shortcuts kept: the engine's words, and the signs it reads. */
const RACCOURCIS: Readonly<Record<string, string>> = {
  pi: '\\pi',
  sqrt: '\\sqrt{#?}',
  racine: '\\sqrt{#?}',
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  ln: '\\ln',
  log: '\\log',
  exp: '\\exp',
  '*': '\\cdot',
  '<=': '\\le',
  '>=': '\\ge',
  '!=': '\\ne',
}

export type OptionsChamp = {
  /** Where the field goes: MathLive takes its options once it is in the page. */
  hote: HTMLElement
  latex: string
  className: string
  surTexte: (latex: string) => void
  surFocus: () => void
  surBlur: () => void
  surEntree: () => void
  surEffacerVide: () => void
}

export type ChampMathLive = {
  element: HTMLElement
  charger: (latex: string) => void
  placeholder: (texte: string) => void
  aLeFocus: () => boolean
}

type Creer = (options: OptionsChamp) => ChampMathLive

let chargement: Promise<Creer> | null = null

/** The placeholder, as LaTeX text: MathLive writes it in the field when it is empty. */
function texteLatex(texte: string): string {
  return `\\text{${texte.replace(/[\\{}]/g, '')}}`
}

/**
 * Shows or hides MathLive's virtual keyboard for a field (the « Clavier » button, with a mouse);
 * nothing before MathLive is loaded.
 */
export function basculerClavier(champ: HTMLElement): void {
  champ.focus()
  const clavier = (
    window as { mathVirtualKeyboard?: { visible: boolean; show(): void; hide(): void } }
  ).mathVirtualKeyboard
  if (!clavier) return
  if (clavier.visible) clavier.hide()
  else clavier.show()
}

export function chargerMathLive(): Promise<Creer> {
  chargement ??= import('mathlive').then(({ MathfieldElement }) => {
    // The fonts are KaTeX's, already loaded by the page; no sound, the decimal comma.
    MathfieldElement.fontsDirectory = null
    MathfieldElement.soundsDirectory = null
    MathfieldElement.plonkSound = null
    MathfieldElement.keypressSound = null
    MathfieldElement.decimalSeparator = ','
    MathfieldElement.locale = 'fr'

    return (o: OptionsChamp): ChampMathLive => {
      const mf = new MathfieldElement()
      mf.className = o.className
      o.hote.appendChild(mf)
      mf.menuItems = []
      // 10^12: the exponent is all the digits typed, not the first one only.
      mf.smartSuperscript = false
      mf.inlineShortcuts = RACCOURCIS
      mf.mathVirtualKeyboardPolicy = 'auto'
      mf.value = o.latex
      mf.addEventListener('input', () => o.surTexte(mf.value))
      mf.addEventListener('focus', o.surFocus)
      mf.addEventListener('blur', o.surBlur)
      // Before MathLive sees them: Enter goes to the next line, Backspace on an empty line
      // deletes it.
      mf.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            o.surEntree()
          } else if (e.key === 'Backspace' && mf.value === '') {
            e.preventDefault()
            e.stopPropagation()
            o.surEffacerVide()
          }
        },
        { capture: true }
      )
      return {
        element: mf,
        charger: (latex) => {
          mf.value = latex
        },
        placeholder: (texte) => {
          mf.placeholder = texteLatex(texte)
        },
        aLeFocus: () => mf.hasFocus(),
      }
    }
  })
  return chargement
}
