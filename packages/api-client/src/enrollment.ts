import { z } from 'zod'

/**
 * Enrollment client (chemin A — rejoindre par code de classe).
 *
 * Backend: POST /api/classes/rejoindre (fr.brio.identite.web.ClasseController).
 * Public and CSRF-exempt (no session to protect — it creates the account), so
 * unlike login it needs neither the XSRF token nor credentials.
 *
 *   201 -> EleveInscritInfo   · 400 validation · 404 code inconnu
 *   410 code expiré/épuisé     · 403 établissement sans convention
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
