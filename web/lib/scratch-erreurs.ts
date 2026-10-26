// Les erreurs de parseScratch (packages/content, ADR 0031) en français, pour l'éditeur enseignant.
//
// Le parseur écrit ses messages en anglais : ils servent aussi à check-content, lu par les
// développeurs. On les traduit ici, motif par motif, sans toucher au parseur partagé. Un message
// qu'aucun motif ne reconnaît (une règle ajoutée depuis) est montré tel quel : mieux vaut un
// message en anglais qu'une erreur tue. Les tests passent chaque erreur connue par ce module.

import type { ScratchError } from '@brio/content'

type Traduction = [RegExp, (...m: string[]) => string]

const TRADUCTIONS: Traduction[] = [
  [/^blank line/, () => 'Ligne vide : un programme s’écrit d’un seul tenant, sans ligne vide.'],
  [/^indent with (\d+) spaces, not tabs$/, (n) => `Indente avec ${n} espaces, pas une tabulation.`],
  [/^"fin" closes no "répéter"$/, () => '« fin » ne ferme aucun « répéter ».'],
  [
    /^"fin" must be at the indentation of its "répéter" \(line (\d+)\)$/,
    (l) => `« fin » doit être aligné sur son « répéter » (ligne ${l}).`,
  ],
  [
    /^"répéter" has an empty body$/,
    () => 'La boucle « répéter » est vide : indente au moins une instruction dessous.',
  ],
  [
    /^"répéter" \(line (\d+)\) must be closed by "fin" before this line$/,
    (l) => `Ferme le « répéter » de la ligne ${l} par « fin » avant cette ligne.`,
  ],
  [
    /^unexpected indentation \(expected (\d+) spaces\)$/,
    (n) =>
      n === '0'
        ? 'Cette ligne ne doit pas être indentée.'
        : `Indentation inattendue : ${n} espaces attendus.`,
  ],
  [
    /^the green-flag block can only start a programme$/,
    () => '« quand le drapeau vert est cliqué » ne peut être que la première ligne.',
  ],
  [/^"répéter" is never closed by "fin"$/, () => 'Ce « répéter » n’est jamais fermé par « fin ».'],
  [/^unknown instruction "(.*)" — /, (t) => `Instruction inconnue : « ${t} ».`],
  [
    /^"(.*)" is not a variable name/,
    (t) => `« ${t} » n’est pas un nom de variable (lettres, chiffres et _, sans espace).`,
  ],
  [/^a value is missing in "(.*)"$/, (s) => `Il manque une valeur dans « ${s} ».`],
  [
    /^a value is missing before "(.)" in "(.*)"$/,
    (op, s) => `Il manque une valeur avant « ${op} » dans « ${s} ».`,
  ],
  [/^"\)" is missing in "(.*)"$/, (s) => `Il manque une parenthèse fermante dans « ${s} ».`],
  [
    /^one operator per pair of parentheses.* in "(.*)"$/,
    (s) => `Un seul opérateur par paire de parenthèses, comme ((a + b) * c), dans « ${s} ».`,
  ],
  [
    /^an operator block goes in parentheses.* in "(.*)"$/,
    (s) => `Un bloc opérateur s’écrit entre parenthèses, comme (a * b), dans « ${s} ».`,
  ],
  [
    /^unexpected text after the value in "(.*)"$/,
    (s) => `Texte en trop après la valeur dans « ${s} ».`,
  ],
  [/^« is never closed by » in "(.*)"$/, (s) => `Un texte ouvert par « n’est pas fermé dans ${s}.`],
  [/^empty text « » in "(.*)"$/, (s) => `Texte vide « » dans ${s}.`],
  [
    /^Scratch writes (.), not (.), in "(.*)"$/,
    (bon, faux, s) => `Scratch écrit ${bon}, pas ${faux}, dans « ${s} ».`,
  ],
  [
    /^unexpected character "(.*)" in "(.*)"$/,
    (c, s) => `Caractère inattendu « ${c} » dans « ${s} ».`,
  ],
]

/** Le message français d'une erreur de parseScratch (le message d'origine si aucun motif ne va). */
export function messageScratch(erreur: ScratchError): string {
  for (const [motif, traduire] of TRADUCTIONS) {
    const m = motif.exec(erreur.message)
    if (m) return traduire(...m.slice(1))
  }
  return erreur.message
}
