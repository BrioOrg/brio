import { parseScratch, type ScratchError } from '@brio/content'
import { describe, expect, it } from 'vitest'

import { messageScratch } from '../scratch-erreurs'

// Chaque programme déclenche une erreur connue de parseScratch. Si le parseur change un message
// (#232, #234…), le test le dit : il faut alors mettre la traduction à jour.
const CAS: Array<[string, string, number, string]> = [
  [
    'ligne vide',
    'dire 1\n\ndire 2',
    2,
    'Ligne vide : un programme s’écrit d’un seul tenant, sans ligne vide.',
  ],
  ['tabulation', 'répéter 2 fois\n\tdire 1\nfin', 2, 'Indente avec 4 espaces, pas une tabulation.'],
  ['fin orphelin', 'dire 1\nfin', 2, '« fin » ne ferme aucun bloc (« répéter », « si »…).'],
  [
    'fin mal aligné',
    'répéter 2 fois\n    dire 1\n  fin',
    3,
    '« fin » doit être aligné sur son « répéter » (ligne 1).',
  ],
  [
    'boucle vide',
    'répéter 2 fois\nfin',
    1,
    'La boucle « répéter » est vide : indente au moins une instruction dessous.',
  ],
  [
    'boucle non fermée avant une ligne',
    'répéter 2 fois\n    dire 1\n  dire 2\nfin',
    3,
    'Ferme le « répéter » de la ligne 1 par « fin » avant cette ligne.',
  ],
  ['indentation à la racine', '    dire 1', 1, 'Cette ligne ne doit pas être indentée.'],
  [
    'indentation dans une boucle',
    'répéter 2 fois\n        dire 1\nfin',
    2,
    'Indentation inattendue : 4 espaces attendus.',
  ],
  [
    'drapeau pas en tête',
    'dire 1\nquand le drapeau vert est cliqué',
    2,
    '« quand le drapeau vert est cliqué » ne peut être que la première ligne.',
  ],
  [
    'boucle jamais fermée',
    'répéter 2 fois\n    dire 1',
    1,
    'Ce « répéter » n’est jamais fermé par « fin ».',
  ],
  ['instruction inconnue', 'sauter', 1, 'Instruction inconnue : « sauter ».'],
  [
    'nom de variable',
    'mettre réponse à 1',
    1,
    '« réponse » n’est pas un nom de variable (lettres, chiffres et _, sans espace).',
  ],
  ['valeur manquante', 'dire ()', 1, 'Il manque une valeur avant « ) » dans « () ».'],
  ['valeur manquante en fin', 'dire (x +', 1, 'Il manque une valeur dans « (x + ».'],
  [
    'valeur avant un opérateur',
    'dire (* 2)',
    1,
    'Il manque une valeur avant « * » dans « (* 2) ».',
  ],
  ['parenthèse manquante', 'dire (x + 1', 1, 'Il manque une parenthèse fermante dans « (x + 1 ».'],
  [
    'deux opérateurs',
    'dire (1 + 2 * 3)',
    1,
    'Un seul opérateur par paire de parenthèses, comme ((a + b) * c), dans « (1 + 2 * 3) ».',
  ],
  [
    'opérateur sans parenthèses',
    'dire x * 2',
    1,
    'Un bloc opérateur s’écrit entre parenthèses, comme (a * b), dans « x * 2 ».',
  ],
  ['texte en trop', 'dire x y', 1, 'Texte en trop après la valeur dans « x y ».'],
  ['texte non fermé', 'dire « Bonjour', 1, 'Un texte ouvert par « n’est pas fermé dans « Bonjour.'],
  ['texte vide', 'dire « »', 1, 'Texte vide « » dans « ».'],
  ['signe ×', 'dire (2 × 3)', 1, 'Scratch écrit *, pas ×, dans « (2 × 3) ».'],
  ['caractère inattendu', 'dire (2 % 3)', 1, 'Caractère inattendu « % » dans « (2 % 3) ».'],
  // 4e : conditions, comparaisons, logique, stylo (#234).
  [
    'condition pas booléenne',
    'si x alors',
    1,
    'La condition doit être un booléen (une comparaison ou un « et »/« ou »), pas « x ».',
  ],
  [
    'booléen là où une valeur est attendue',
    'mettre x à (a > b)',
    1,
    'Un booléen est utilisé là où une valeur est attendue, dans « (a > b) ».',
  ],
  [
    'comparaison de booléens',
    'dire ((a > b) > 3)',
    1,
    'Une comparaison compare des valeurs, pas des booléens, dans « ((a > b) > 3) ».',
  ],
  [
    'et/ou de valeurs',
    'si (x et y) alors',
    1,
    '« et » et « ou » combinent des booléens, pas des valeurs, dans « (x et y) ».',
  ],
  ['sinon orphelin', 'sinon', 1, '« sinon » ne ferme aucun « si ».'],
  [
    'sinon mal aligné',
    'si (x > 0) alors\n    dire 1\n  sinon\n    dire 2\nfin',
    3,
    '« sinon » doit être aligné sur son « si » (ligne 1).',
  ],
  [
    'deux sinon',
    'si (x > 0) alors\n    dire 1\nsinon\n    dire 2\nsinon\n    dire 3\nfin',
    5,
    'Un « si » n’a qu’un seul « sinon ».',
  ],
  [
    'si vide',
    'si (x > 0) alors\nsinon\n    dire 1\nfin',
    1,
    'Le « si » est vide : indente au moins une instruction dessous.',
  ],
  [
    'sinon vide',
    'si (x > 0) alors\n    dire 1\nsinon\nfin',
    1,
    'Le « sinon » est vide : indente au moins une instruction dessous.',
  ],
  [
    'répéter jusqu’à vide',
    "répéter jusqu'à ce que (n = 0)\nfin",
    1,
    'La boucle « répéter jusqu’à ce que » est vide : indente au moins une instruction dessous.',
  ],
  [
    'si jamais fermé',
    'si (x > 0) alors\n    dire 1',
    1,
    'Ce « si » n’est jamais fermé par « fin ».',
  ],
  [
    'fin d’un si mal aligné',
    'si (x > 0) alors\n    dire 1\n  fin',
    3,
    '« fin » doit être aligné sur son « si » (ligne 1).',
  ],
  [
    'si non fermé avant une ligne',
    'si (x > 0) alors\n    dire 1\n  dire 2\nfin',
    3,
    'Ferme le « si » de la ligne 1 par « fin » avant cette ligne.',
  ],
]

describe('messageScratch', () => {
  it.each(CAS)('should translate the %s error', (_, code, ligne, attendu) => {
    const r = parseScratch(code)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const erreur = r.errors.find((e) => e.line === ligne)
    expect(erreur).toBeDefined()
    expect(messageScratch(erreur!)).toBe(attendu)
  })

  it('should show an unknown code’s message as written rather than hide it', () => {
    const inconnu = {
      line: 1,
      code: 'ruleAddedSince' as ScratchError['code'],
      params: {},
      message: 'something new',
    }
    expect(messageScratch(inconnu)).toBe('something new')
  })
})
