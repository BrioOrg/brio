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
