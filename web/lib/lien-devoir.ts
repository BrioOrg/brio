import type { Catalogue } from '@/lib/api'

// Where a homework opens (#370). Pure functions, shared by the server home page and the client
// Ma classe list.
//
// Keep every link a template literal that starts with `/`: `scripts/mesh/lib/route-graph.mjs`
// reads route links statically from the source, and only sees those. A path held in a variable
// (`${chemin}?…`) or built by concatenation is invisible to it, and the hot task
// `eleve-ouvrir-devoir-cours` (1 click from the home page) would then fail.

/** The fields of a homework that say what it points to. */
type SourceDevoir = { id: string; sourceType: string; sourceRef: string }

/** A chapter homework only knows its slug: its URL comes from the catalogue (slug → path). */
export function cheminsChapitres(catalogue: Catalogue): Record<string, string> {
  return Object.fromEntries(
    catalogue.flatMap(({ niveauCode, matieres }) =>
      matieres.flatMap(({ matiereCode, chapitres }) =>
        chapitres.map(({ slug }) => [slug, `/${niveauCode}/${matiereCode}/${slug}`])
      )
    )
  )
}

/**
 * The page a homework opens, carrying its id so the page can show the homework banner. `null`
 * when it cannot be told: a chapter missing from the catalogue, or an unknown source type.
 */
export function lienDevoir(d: SourceDevoir, chemins: Record<string, string>): string | null {
  if (d.sourceType === 'cours') {
    return `/cours/${encodeURIComponent(d.sourceRef)}?devoir=${encodeURIComponent(d.id)}`
  }
  if (d.sourceType === 'chapitre' && Object.hasOwn(chemins, d.sourceRef)) {
    return `${chemins[d.sourceRef]}?devoir=${encodeURIComponent(d.id)}`
  }
  return null
}
