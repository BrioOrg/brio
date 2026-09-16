import { z } from 'zod'

/**
 * Enrollment client.
 *
 * Chemin A — POST /api/classes/rejoindre (ClasseController).
 * Chemin B — POST /api/comptes/eleve   (InscriptionController).
 *
 * Both endpoints are public and CSRF-exempt (account creation, no prior session).
 */

/**
 * Returned exactly once when an élève joins via class code (ADR 0016 §4 / 0018 §5).
 * This is the only response that discloses `identifiantConnexion` — the student
 * must note it to log in later, so the UI has to surface it prominently.
 */
export const EleveInscritInfoSchema = z.object({
  id: z.string(),
  identifiantConnexion: z.string(),
  nomAffiche: z.string(),
  classeLibelle: z.string(),
})

export type EleveInscritInfo = z.infer<typeof EleveInscritInfoSchema>

export type RejoindreClasseInput = {
  code: string
  nomAffiche: string
  motDePasse: string
}

/** Thrown when joining fails; carries the HTTP status for the caller to map to copy. */
export class RejoindreError extends Error {
  constructor(
    readonly status: number,
    message = 'La demande a échoué.'
  ) {
    super(message)
    this.name = 'RejoindreError'
  }
}

export async function rejoindreClasse(
  baseUrl: string,
  input: RejoindreClasseInput
): Promise<EleveInscritInfo> {
  const res = await fetch(`${baseUrl}/api/classes/rejoindre`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new RejoindreError(res.status)
  return EleveInscritInfoSchema.parse(await res.json())
}

// ── Chemin B — self-signup, awaiting parental consent ───────────────────────

/**
 * Returned once when a path B élève registers (ADR 0016 §5 / ADR 0018).
 * identifiantConnexion is disclosed exactly once and must be shown prominently.
 */
export const InscriptionEleveEnAttenteInfoSchema = z.object({
  id: z.string(),
  identifiantConnexion: z.string(),
  statut: z.string(),
})

export type InscriptionEleveEnAttenteInfo = z.infer<typeof InscriptionEleveEnAttenteInfoSchema>

export type InscrireEleveInput = {
  niveauDeclare: '6e' | '5e' | '4e' | '3e'
  motDePasse: string
  emailParent: string
}

export class InscrireEleveError extends Error {
  constructor(
    readonly status: number,
    message = 'La demande a échoué.'
  ) {
    super(message)
    this.name = 'InscrireEleveError'
  }
}

export async function inscrireEleve(
  baseUrl: string,
  input: InscrireEleveInput
): Promise<InscriptionEleveEnAttenteInfo> {
  const res = await fetch(`${baseUrl}/api/comptes/eleve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new InscrireEleveError(res.status)
  return InscriptionEleveEnAttenteInfoSchema.parse(await res.json())
}
