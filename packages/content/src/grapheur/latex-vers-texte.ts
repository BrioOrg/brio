// The LaTeX of the calculator's maths field (MathLive, #417) written back in the engine's text:
// the state, the address and the engine read the text only, so the links of before still open.
//
//   \frac{a}{b}          (a)/(b), brackets only where the reading needs them
//   \frac{d}{dx}(…)      d/dx(…), the derivative operator
//   \sqrt{…}             √(…); \sqrt[n]{…} becomes ∛, which the engine refuses with its message
//   ^{…}                 ^(…); primes ^{\prime} and ' become f'
//   \cdot \times \div    × ÷
//   \pi \sin \ln …       π sin ln …
//   \left( \right) …     ( ), |…|
//   {,}                  , (the French decimal comma)
//   \le \ge \ne          ≤ ≥ ≠ (the engine refuses inequalities with its own message)
//
// Pure: no DOM. Anything it does not know is written as a character the engine refuses, never
// dropped silently.

type Jeton =
  | { type: 'commande'; nom: string }
  | { type: 'ouvrante' }
  | { type: 'fermante' }
  | { type: 'car'; c: string }

function jetons(latex: string): Jeton[] {
  const out: Jeton[] = []
  let i = 0
  while (i < latex.length) {
    const c = latex[i]
    if (c === '\\') {
      const lettres = /^[a-zA-Z]+/.exec(latex.slice(i + 1))?.[0]
      if (lettres) {
        out.push({ type: 'commande', nom: lettres })
        i += 1 + lettres.length
      } else {
        out.push({ type: 'commande', nom: latex[i + 1] ?? '' })
        i += 2
      }
      continue
    }
    if (c === '{') out.push({ type: 'ouvrante' })
    else if (c === '}') out.push({ type: 'fermante' })
    else if (!/\s/.test(c)) out.push({ type: 'car', c })
    i++
  }
  return out
}

const FONCTIONS: ReadonlySet<string> = new Set(['sin', 'cos', 'tan', 'ln', 'log', 'exp'])

const SYMBOLES: Readonly<Record<string, string>> = {
  cdot: '×',
  times: '×',
  ast: '×',
  div: '÷',
  pi: 'π',
  exponentialE: 'e',
  differentialD: 'd',
  imaginaryI: 'i',
  le: '≤',
  leq: '≤',
  leqslant: '≤',
  ge: '≥',
  geq: '≥',
  geqslant: '≥',
  lt: '<',
  gt: '>',
  ne: '≠',
  neq: '≠',
  prime: "'",
  doubleprime: "''",
  vert: '|',
  lvert: '|',
  rvert: '|',
  mid: '|',
  lbrack: '(',
  rbrack: ')',
  '{': '(',
  '}': ')',
  '|': '|',
  infty: '∞',
  in: '∈',
  pm: '±',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  sigma: 'σ',
  phi: 'φ',
  varphi: 'φ',
  omega: 'ω',
}

/** Spacing commands: nothing to write. */
const ESPACES: ReadonlySet<string> = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad'])

/** Commands whose argument is plain text to keep: \operatorname{abs}, \mathrm{d}. */
const TEXTES: ReadonlySet<string> = new Set([
  'operatorname',
  'mathrm',
  'mathit',
  'mathbf',
  'text',
  'textrm',
  'mathnormal',
])

const DELIMITEURS: Readonly<Record<string, string>> = {
  '(': '(',
  ')': ')',
  '[': '(',
  ']': ')',
  '|': '|',
  '.': '',
}

/** A whole number, a decimal, or one letter: no brackets needed around it. */
function atomique(t: string): boolean {
  return /^(\d+(,\d+)?|[a-zA-Zπ])$/.test(t)
}

class Lecteur {
  private i = 0
  private readonly j: Jeton[]

  constructor(j: Jeton[]) {
    this.j = j
  }

  /** Skips a stray closing brace; false at the end of the text. */
  avancerFermante(): boolean {
    if (this.suivant()?.type !== 'fermante') return false
    this.i++
    return true
  }

  private suivant(): Jeton | undefined {
    return this.j[this.i]
  }

  /** The text of a sequence, up to a closing brace or the end. */
  suite(): string {
    let out = ''
    for (let t = this.suivant(); t && t.type !== 'fermante'; t = this.suivant()) {
      out += this.element(out)
    }
    return out
  }

  /** One argument: a braced group, or a single token. */
  private argument(): string {
    const t = this.suivant()
    if (!t) return ''
    if (t.type === 'ouvrante') {
      this.i++
      const s = this.suite()
      if (this.suivant()?.type === 'fermante') this.i++
      return s
    }
    return this.element('')
  }

  /** A braced group read as raw letters (\operatorname{abs}); a single token otherwise. */
  private texteBrut(): string {
    const t = this.suivant()
    if (t?.type !== 'ouvrante') return this.element('')
    this.i++
    let out = ''
    for (let u = this.suivant(); u && u.type !== 'fermante'; u = this.suivant()) {
      out += u.type === 'car' ? u.c : this.element(out)
      if (u.type === 'car') this.i++
    }
    if (this.suivant()?.type === 'fermante') this.i++
    return out
  }

  /** An optional [ … ] argument (\sqrt[3]); null when there is none. */
  private optionnel(): string | null {
    const t = this.suivant()
    if (t?.type !== 'car' || t.c !== '[') return null
    this.i++
    let out = ''
    for (let u = this.suivant(); u && !(u.type === 'car' && u.c === ']'); u = this.suivant()) {
      out += this.element(out)
    }
    if (this.suivant()) this.i++
    return out
  }

  private prochainEst(c: string): boolean {
    const t = this.suivant()
    return t?.type === 'car' && t.c === c
  }

  private prochainChiffre(): boolean {
    const t = this.suivant()
    return t?.type === 'car' && /\d/.test(t.c)
  }

  private element(avant: string): string {
    const t = this.j[this.i++]
    switch (t.type) {
      case 'ouvrante': {
        // A bare group ({,} or {x}): its content, in place.
        const s = this.suite()
        if (this.suivant()?.type === 'fermante') this.i++
        return s
      }
      case 'fermante':
        return ''
      case 'car':
        return this.caractere(t.c)
      case 'commande':
        return this.commande(t.nom, avant)
    }
  }

  private caractere(c: string): string {
    if (c === '^') return this.exposant()
    if (c === '_') {
      const indice = this.argument()
      // f_1 is the function f1; any other subscript is left for the engine to refuse.
      return /^\d$/.test(indice) ? indice : `_${indice}`
    }
    if (c === '*') return '×'
    if (c === '=') return ' = '
    if (c === '[') return '('
    if (c === ']') return ')'
    if (c === '’' || c === '′') return "'"
    return c
  }

  private exposant(): string {
    const e = this.argument()
    // Primes: f^{\prime}, f^{\prime\prime}, f^{\doubleprime}.
    if (/^'+$/.test(e)) return e
    if (e === '') return '^()'
    return atomique(e) && e.length === 1 && !this.prochainChiffre() ? `^${e}` : `^(${e})`
  }

  private commande(nom: string, avant: string): string {
    if (nom === 'frac' || nom === 'dfrac' || nom === 'tfrac') return this.fraction(avant)
    if (nom === 'sqrt') {
      const n = this.optionnel()
      const a = this.argument()
      if (n !== null) return `∛(${a})`
      return atomique(a) && !this.prochainChiffre() ? `√${a}` : `√(${a})`
    }
    if (nom === 'left' || nom === 'right' || /^(big|Big|bigg|Bigg)[lr]?$/.test(nom)) {
      return this.delimiteur()
    }
    if (nom === 'mleft' || nom === 'mright') return this.delimiteur()
    if (FONCTIONS.has(nom)) return nom
    if (TEXTES.has(nom)) return this.texteBrut()
    if (nom === 'placeholder') {
      this.optionnel()
      this.argument()
      return ''
    }
    if (ESPACES.has(nom)) return ''
    if (nom in SYMBOLES) return SYMBOLES[nom]
    // An unknown command: a character the engine refuses, never a silent change.
    return '?'
  }

  private delimiteur(): string {
    const t = this.j[this.i++]
    if (!t) return ''
    if (t.type === 'car') return DELIMITEURS[t.c] ?? t.c
    if (t.type === 'commande') return SYMBOLES[t.nom] ?? ''
    return ''
  }

  private fraction(avant: string): string {
    const num = this.argument().trim()
    const den = this.argument().trim()
    // d/dx: \frac{d}{dx}, \frac{\mathrm{d}}{\mathrm{d}x}; what was typed on in the denominator
    // (\frac{d}{dx(x^2)}, typed d/dx(x^2) in one go) is the operand.
    if (num === 'd' && den.startsWith('dx')) {
      const reste = den.slice(2)
      return `d/dx${reste}`
    }
    const n = atomique(num) ? num : `(${num})`
    const d = atomique(den) ? den : `(${den})`
    const f = `${n}/${d}`
    // The fraction is one block: bracketed after a factor (2·(1/3)), a division or a power, and
    // before a power.
    const apres = avant.trimEnd()
    const ouvre = apres === '' || /[+\-×(=≤≥<>≠]$/.test(apres)
    return !ouvre || this.prochainEst('^') ? `(${f})` : f
  }
}

/**
 * The engine's text for the LaTeX of the maths field. `\frac{1}{2}x` is 1/2x (read (1/2)·x),
 * `\frac{d}{dx}\left(x^2\right)` is d/dx(x^2), `2{,}5` is 2,5.
 */
export function latexVersTexte(latex: string): string {
  const lecteur = new Lecteur(jetons(latex))
  let out = ''
  // A stray closing brace is skipped: the rest is still read.
  do out += lecteur.suite()
  while (lecteur.avancerFermante())
  return out.replace(/ {2,}/g, ' ').trim()
}
