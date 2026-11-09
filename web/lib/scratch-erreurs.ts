// Les erreurs de parseScratch (packages/content, ADR 0031) en français, pour l'éditeur enseignant.
//
// Le parseur écrit ses messages en anglais (ils servent aussi à check-content, lu par les
// développeurs). On traduit par `code` stable, pas par le texte anglais : reformuler un message
// côté parseur (#232, #234…) ne casse plus la traduction (#307). Un code que ce module ne connaît
// pas encore (une règle ajoutée depuis) retombe sur le message d'origine : mieux vaut un message
// en anglais qu'une erreur tue.

import type {
  ScratchBlockType,
  ScratchError,
  ScratchErrorCode,
  ScratchErrorParams,
} from '@brio/content'

// Le nom français du bloc d'un code « bloc » (le même code sert « répéter », « répéter jusqu'à ce
// que », « si » et « sinon », #307) ; « répéter » par défaut.
function nomBloc(blockType?: ScratchBlockType): string {
  switch (blockType) {
    case 'repeatUntil':
      return '« répéter jusqu’à ce que »'
    case 'if':
      return '« si »'
    case 'else':
      return '« sinon »'
    default:
      return '« répéter »'
  }
}

const TRADUCTIONS: Record<ScratchErrorCode, (p: ScratchErrorParams) => string> = {
  blankLine: () => 'Ligne vide : un programme s’écrit d’un seul tenant, sans ligne vide.',
  tabs: (p) => `Indente avec ${p.expected} espaces, pas une tabulation.`,
  finWithoutLoop: () => '« fin » ne ferme aucun bloc (« répéter », « si »…).',
  finIndent: (p) => `« fin » doit être aligné sur son ${nomBloc(p.blockType)} (ligne ${p.loopLine}).`,
  emptyLoop: (p) =>
    p.blockType === 'if'
      ? 'Le « si » est vide : indente au moins une instruction dessous.'
      : p.blockType === 'else'
        ? 'Le « sinon » est vide : indente au moins une instruction dessous.'
        : `La boucle ${nomBloc(p.blockType)} est vide : indente au moins une instruction dessous.`,
  loopNotClosedBeforeLine: (p) =>
    `Ferme le ${nomBloc(p.blockType)} de la ligne ${p.loopLine} par « fin » avant cette ligne.`,
  unexpectedIndent: (p) =>
    p.expected === 0
      ? 'Cette ligne ne doit pas être indentée.'
      : `Indentation inattendue : ${p.expected} espaces attendus.`,
  flagNotFirst: () =>
    '« quand le drapeau vert est cliqué » ne peut être que la première ligne.',
  loopNeverClosed: (p) => `Ce ${nomBloc(p.blockType)} n’est jamais fermé par « fin ».`,
  unknownInstruction: (p) => `Instruction inconnue : « ${p.text} ».`,
  invalidVariableName: (p) =>
    `« ${p.text} » n’est pas un nom de variable (lettres, chiffres et _, sans espace).`,
  valueMissing: (p) => `Il manque une valeur dans « ${p.source} ».`,
  valueMissingBeforeOperator: (p) =>
    `Il manque une valeur avant « ${p.operator} » dans « ${p.source} ».`,
  valueMissingBeforeClose: (p) => `Il manque une valeur avant « ) » dans « ${p.source} ».`,
  closeMissing: (p) => `Il manque une parenthèse fermante dans « ${p.source} ».`,
  oneOperatorPerPair: (p) =>
    `Un seul opérateur par paire de parenthèses, comme ((a + b) * c), dans « ${p.source} ».`,
  operatorNeedsParentheses: (p) =>
    `Un bloc opérateur s’écrit entre parenthèses, comme (a * b), dans « ${p.source} ».`,
  unexpectedTextAfterValue: (p) => `Texte en trop après la valeur dans « ${p.source} ».`,
  textNeverClosed: (p) => `Un texte ouvert par « n’est pas fermé dans ${p.source}.`,
  emptyText: (p) => `Texte vide « » dans ${p.source}.`,
  wrongOperatorSymbol: (p) => `Scratch écrit ${p.correct}, pas ${p.symbol}, dans « ${p.source} ».`,
  unexpectedCharacter: (p) => `Caractère inattendu « ${p.character} » dans « ${p.source} ».`,
  conditionNotBoolean: (p) =>
    `La condition doit être un booléen (une comparaison ou un « et »/« ou »), pas « ${p.source} ».`,
  booleanInValueSlot: (p) =>
    `Un booléen est utilisé là où une valeur est attendue, dans « ${p.source} ».`,
  comparisonNeedsValues: (p) =>
    `Une comparaison compare des valeurs, pas des booléens, dans « ${p.source} ».`,
  logicalNeedsBooleans: (p) =>
    `« et » et « ou » combinent des booléens, pas des valeurs, dans « ${p.source} ».`,
  sinonWithoutIf: () => '« sinon » ne ferme aucun « si ».',
  sinonIndent: (p) => `« sinon » doit être aligné sur son « si » (ligne ${p.loopLine}).`,
  duplicateSinon: () => 'Un « si » n’a qu’un seul « sinon ».',
}

/** Le message français d'une erreur de parseScratch (le message d'origine si le code est inconnu). */
export function messageScratch(erreur: ScratchError): string {
  const traduire = TRADUCTIONS[erreur.code]
  return traduire ? traduire(erreur.params) : erreur.message
}
