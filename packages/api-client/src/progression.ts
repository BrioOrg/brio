import { z } from 'zod'

/**
 * Progression (XP + level) client — manual Zod wrapper.
 *
 * The progression module derives XP from exercise submissions asynchronously
 * (ADR 0022): a graded submission publishes an application event, and XP is
 * awarded on the listener thread after the transaction commits. The submission
 * response therefore carries no XP delta — the only truthful source of the
 * current total is this endpoint, which the UI re-reads to animate a real gain
 * (never a fabricated number).
 *
 * Backend contract (fr.brio.progression.web.ProgressionController):
 *   GET /api/progression/moi   200 -> ProgressionInfo · 401 when no session
 *
 * Auth is the session cookie (SecurityConfig gates every /api/** behind
 * form-login); all calls use `credentials: 'include'` so the cookie rides.
 */

/**
 * Public projection of a student's progression (fr.brio.progression.api.ProgressionInfo).
 * `niveau` is the game level number (0, 1, 2…), derived from `xpTotal`
 * (floor(sqrt(xp/100))) — NOT a school grade.
 */
export const ProgressionInfoSchema = z.object({
  xpTotal: z.number(),
  niveau: z.number(),
})

export type ProgressionInfo = z.infer<typeof ProgressionInfoSchema>

/**
 * Return the authenticated student's XP total and level, or null when not
 * logged in (401). A logged-out visitor simply sees no XP badge — never a zero.
 */
export async function getProgression(baseUrl: string): Promise<ProgressionInfo | null> {
  const res = await fetch(`${baseUrl}/api/progression/moi`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Impossible de récupérer la progression.')
  return ProgressionInfoSchema.parse(await res.json())
}

/**
 * One chapter's state on the student's path (fr.brio.progression.api.ParcoursChapitre,
 * issue #79/#82). `chapitreId` joins to the public catalogue's `slug` (both are the
 * chapter id server-side). `etat` is kept as a string on purpose so the client does
 * not break if the backend adds a state it does not yet branch on — unknown values
 * fall back to a neutral, reachable node rather than a fabricated lock.
 */
export const ParcoursChapitreSchema = z.object({
  chapitreId: z.string(),
  ordre: z.number(),
  etat: z.string(),
  pourcentage: z.number(),
})

export type ParcoursChapitre = z.infer<typeof ParcoursChapitreSchema>

export const ParcoursSchema = z.array(ParcoursChapitreSchema)

/**
 * Return the path state of a niveau/matière track for the authenticated student,
 * or null when not logged in (401) — a logged-out visitor sees a neutral atlas
 * (all chapters reachable, no fabricated locks or completion).
 */
export async function getParcours(
  baseUrl: string,
  niveau: string,
  matiere: string
): Promise<ParcoursChapitre[] | null> {
  const res = await fetch(
    `${baseUrl}/api/progression/parcours/${encodeURIComponent(niveau)}/${encodeURIComponent(matiere)}`,
    { credentials: 'include' }
  )
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Impossible de récupérer le parcours.')
  return ParcoursSchema.parse(await res.json())
}
