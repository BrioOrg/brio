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
 *   GET /api/progression/moi              200 -> ProgressionInfo · 401 when no session
 *   GET /api/progression/cours/{coursId}  200 -> ProgressionCoursInfo · 204 no gauge · 401
 *   GET /api/progression/reprendre        200 -> ContenuAReprendre · 204 nothing to resume
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

/**
 * A student's day streak (fr.brio.progression.api.SerieInfo, issue #81).
 * `joursConsecutifs` is the live value decayed to today — a broken streak reads
 * 0, and the UI hides the flame at 0 (never "0 jour"). `dernierJourActif` is left
 * unvalidated because the UI doesn't use it and its JSON shape (date) is not worth
 * pinning here.
 */
export const SerieInfoSchema = z.object({
  joursConsecutifs: z.number(),
  dernierJourActif: z.unknown().nullish(),
  gelsRestants: z.number(),
  actifAujourdhui: z.boolean(),
})

export type SerieInfo = z.infer<typeof SerieInfoSchema>

/**
 * Return the authenticated student's day streak, or null when not logged in (401).
 */
export async function getSerie(baseUrl: string): Promise<SerieInfo | null> {
  const res = await fetch(`${baseUrl}/api/progression/serie`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Impossible de récupérer la série.')
  return SerieInfoSchema.parse(await res.json())
}

/**
 * The chapter a student left unfinished (fr.brio.progression.api.ChapitreAReprendre, #323).
 * `chapitreId` is also the catalogue slug.
 */
export const ChapitreAReprendreSchema = z.object({
  type: z.literal('chapitre'),
  chapitreId: z.string(),
  titre: z.string(),
  niveauCode: z.string(),
  matiereCode: z.string(),
  sectionsLues: z.number(),
  sectionsTotal: z.number(),
  derniereActivite: z.string(),
})

export type ChapitreAReprendre = z.infer<typeof ChapitreAReprendreSchema>

/**
 * A teacher course the student left unfinished (fr.brio.progression.api.CoursAReprendre, ADR 0050).
 * Only sent while the student can still open it; `titre` is its published title. Links to
 * `/cours/{coursId}`.
 */
export const CoursAReprendreSchema = z.object({
  type: z.literal('cours'),
  coursId: z.string(),
  titre: z.string(),
  sectionsLues: z.number(),
  sectionsTotal: z.number(),
  derniereActivite: z.string(),
})

export type CoursAReprendre = z.infer<typeof CoursAReprendreSchema>

/**
 * What « Reprendre » proposes (GET /api/progression/reprendre): a chapter or a teacher course,
 * told apart by `type`. The endpoint answers 204 when there is nothing to resume.
 */
export const ContenuAReprendreSchema = z.discriminatedUnion('type', [
  ChapitreAReprendreSchema,
  CoursAReprendreSchema,
])

export type ContenuAReprendre = z.infer<typeof ContenuAReprendreSchema>

/**
 * The student's gauge for one teacher course (fr.brio.progression.api.ProgressionCoursInfo,
 * GET /api/progression/cours/{coursId}, ADR 0050). 204 when the course is unknown to progression
 * or the student never opened it: then there is no gauge, never a 0 %.
 */
export const ProgressionCoursSchema = z.object({
  coursId: z.string(),
  pourcentage: z.number(),
  termine: z.boolean(),
  sectionsLues: z.number(),
  sectionsTotal: z.number(),
})

export type ProgressionCours = z.infer<typeof ProgressionCoursSchema>

/**
 * Return the authenticated student's gauge for a teacher course, or null when there is none
 * (204) or no session (401).
 */
export async function getProgressionCours(
  baseUrl: string,
  coursId: string
): Promise<ProgressionCours | null> {
  const res = await fetch(`${baseUrl}/api/progression/cours/${encodeURIComponent(coursId)}`, {
    credentials: 'include',
  })
  if (res.status === 401 || res.status === 204) return null
  if (!res.ok) throw new Error('Impossible de récupérer la progression du cours.')
  return ProgressionCoursSchema.parse(await res.json())
}

/**
 * Mastery of one competence (fr.brio.progression.api.MaitriseInfo). `niveau` is 0 to 4, absent
 * while the sample is too small to report an honest level (ADR 0022 §6).
 */
export const MaitriseInfoSchema = z.object({
  competenceCode: z.string(),
  niveau: z.number().nullish(),
  echantillon: z.number(),
  dernierTravail: z.string().nullish(),
})

export type MaitriseInfo = z.infer<typeof MaitriseInfoSchema>
