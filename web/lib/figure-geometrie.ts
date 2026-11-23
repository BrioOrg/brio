import { checkFigureGeometry, formatNumber, type FigureGeometryIssue } from '@brio/content'

// Les règles des transformations, vecteurs et droites d'une figure (ADR 0041) sont celles de
// check-content (packages/content, transformations.ts : une seule source) ; seul leur libellé
// français est ici.

const SORTES: Record<string, string> = {
  'symetrie-axiale': 'cette symétrie axiale',
  'symetrie-centrale': 'cette symétrie centrale',
  translation: 'cette translation',
  rotation: 'cette rotation',
  homothetie: 'cette homothétie',
}

export function libelleGeometrie(i: FigureGeometryIssue): string {
  switch (i.code) {
    case 'UNKNOWN_POINT':
      return i.name.trim() === ''
        ? 'Indique le nom du point.'
        : `Le point ${i.name} n’existe pas : ajoute-le ou corrige son nom.`
    case 'SAME_POINTS':
      return `${i.names[0]} et ${i.names[1]} sont au même endroit : ils ne donnent aucune direction.`
    case 'EMPTY_SOURCE':
      return 'Indique les points à transformer (ex. A, B, C).'
    case 'DUPLICATE_SOURCE':
      return `Le point ${i.name} est cité deux fois parmi les points transformés.`
    case 'IDENTITY':
      return `${SORTES[i.kind] ?? 'Cette transformation'} laisse chaque point à sa place : il n’y a pas d’image à tracer.`.replace(
        /^./,
        (c) => c.toUpperCase()
      )
    case 'ZERO_RATIO':
      return 'Une homothétie de rapport 0 envoie tous les points sur son centre : choisis un autre rapport.'
    case 'ANGLE_RANGE':
      return `L’angle d’une rotation est compris entre −360° et 360° (ici ${formatNumber(i.angle)}°).`
    case 'IMAGE_NAME_TAKEN':
      return `L’image ${i.name} porterait le nom d’un point existant : renomme ce point.`
    case 'CONSTRUCTION_NOT_IN_SOURCE':
      return `Le point ${i.name} n’est pas parmi les points transformés.`
    case 'AXIS_NOT_DRAWN':
      return `Trace l’axe : ajoute la droite (${i.names.join('')}).`
    case 'UNEQUAL_SCALES':
      return 'Les tracés de construction demandent la même échelle sur les deux axes du repère.'
    case 'BLANK_LABEL':
      return 'Ce nom est vide : écris-le ou retire-le.'
  }
}

/** Les problèmes de géométrie d'un bloc figure, au format de l'éditeur de cours. */
export function problemesGeometrieFigure(
  spec: unknown
): { code: string; champ: string; message: string }[] {
  return checkFigureGeometry(spec).map((i) => ({
    code: `FIGURE_${i.code}`,
    champ: `spec.${i.path}`,
    message: libelleGeometrie(i),
  }))
}
