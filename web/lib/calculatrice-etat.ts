import { z } from 'zod'

import { fenetreValide } from '@brio/content'

// The state of the graphing calculator, kept in the page's address (`?e=`, ADR 0049 §3): the
// lines, their colours and styles, the window and the angle unit, as JSON in base64url. Nothing
// else holds it: no server, no localStorage. Pure, so the Server Component decodes the address
// with the same code as the browser.

/** At most this many lines (the screen says so). */
export const LIGNES_MAX = 12
/** At most this many characters in a line. */
export const TEXTE_MAX = 200
/**
 * Longest `e` read. 12 lines of 200 characters, each up to 3 UTF-8 bytes (², √, π), is 7 200 bytes
 * of text, 9 600 characters once in base64: an address the calculator itself wrote always fits.
 */
export const E_MAX = 12_000

const fini = z.number().finite()

/** A slider's bounds stay within the plane the calculator draws (CENTRE_MAX). */
export const BORNE_CURSEUR = 1e6

const borne = fini.min(-BORNE_CURSEUR).max(BORNE_CURSEUR)

// The same rules as the slider's own fields: min < max, 0 < pas ≤ max − min (V1, gate 5).
const CurseurSchema = z
  .object({ min: borne, max: borne, pas: fini.positive().max(2 * BORNE_CURSEUR) })
  .refine((c) => c.max > c.min && c.pas <= c.max - c.min, 'min < max, pas ≤ max − min')

const LigneSchema = z.object({
  texte: z.string().max(TEXTE_MAX),
  couleur: z.number().int().min(1).max(6).optional(),
  style: z.enum(['plein', 'pointille']).optional(),
  masquee: z.boolean().optional(),
  curseur: CurseurSchema.optional(),
})

const FenetreSchema = z
  .object({ xMin: fini, xMax: fini, yMin: fini, yMax: fini })
  .refine(fenetreValide, 'fenêtre')

export const EtatSchema = z.object({
  v: z.literal(1),
  lignes: z.array(LigneSchema).max(LIGNES_MAX),
  fenetre: FenetreSchema.optional(),
  angle: z.enum(['radians', 'degres']).optional(),
  orthonorme: z.boolean().optional(),
})

export type EtatCalculatrice = z.infer<typeof EtatSchema>
export type LigneEtat = z.infer<typeof LigneSchema>
export type CurseurEtat = z.infer<typeof CurseurSchema>

/** The calculator with nothing in it: one empty line. */
export function etatVide(): EtatCalculatrice {
  return { v: 1, lignes: [{ texte: '' }] }
}

function versBase64Url(octets: Uint8Array): string {
  let binaire = ''
  for (const o of octets) binaire += String.fromCharCode(o)
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function depuisBase64Url(texte: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(texte)) return null
  try {
    const binaire = atob(texte.replace(/-/g, '+').replace(/_/g, '/'))
    const octets = new Uint8Array(binaire.length)
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
    return octets
  } catch {
    return null
  }
}

/** The state written for the address: only what differs from the defaults. */
export function encoderEtat(etat: EtatCalculatrice): string {
  const compact: EtatCalculatrice = {
    v: 1,
    lignes: etat.lignes.map((l) => ({
      texte: l.texte,
      ...(l.couleur !== undefined && { couleur: l.couleur }),
      ...(l.style === 'pointille' && { style: l.style }),
      ...(l.masquee && { masquee: true }),
      ...(l.curseur && { curseur: l.curseur }),
    })),
    ...(etat.fenetre && { fenetre: etat.fenetre }),
    ...(etat.angle === 'degres' && { angle: etat.angle }),
    ...(etat.orthonorme === false && { orthonorme: false }),
  }
  return versBase64Url(new TextEncoder().encode(JSON.stringify(compact)))
}

/**
 * The state of an address's `e`. Anything unreadable — missing, too long, not base64url, not
 * UTF-8, not JSON, not the schema, a line too long, a number that is not finite — gives the empty
 * calculator, without an error: a broken link opens a calculator, never an error page.
 */
export function decoderEtat(e: unknown): EtatCalculatrice {
  if (typeof e !== 'string' || e.length === 0 || e.length > E_MAX) return etatVide()
  const octets = depuisBase64Url(e)
  if (!octets) return etatVide()
  let json: unknown
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(octets))
  } catch {
    return etatVide()
  }
  const lu = EtatSchema.safeParse(json)
  if (!lu.success) return etatVide()
  return lu.data.lignes.length === 0 ? { ...lu.data, lignes: etatVide().lignes } : lu.data
}

/** The address of the page with `e` set to an encoded state: its path, `?e=…`, any hash. */
export function adresseAvecEtat(href: string, e: string): string {
  const url = new URL(href)
  url.searchParams.set('e', e)
  return `${url.pathname}${url.search}${url.hash}`
}
