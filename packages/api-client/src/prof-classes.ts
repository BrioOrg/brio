import { z } from 'zod'

import { createApiClient } from './client.js'
import { CoursApiError } from './cours-edition.js'
import { csrfHeaders, ensureCsrfToken } from './csrf.js'
import { EtablissementPublicSchema } from './enrollment.js'
import type { EtablissementPublic } from './enrollment.js'
import type { components } from './generated/schema.js'

/**
 * The connected teacher's own classes: listed for the publish screen's class picker
 * (ADR 0019 §4), created and managed by the teacher themselves (ADR 0029). Session-cookie
 * authenticated; mutations prime and echo the CSRF token. Reuses {@link CoursApiError} so
 * the teacher space maps failures to French copy uniformly.
 *
 * Server contracts (fr.brio.identite.web):
 *   GET   /api/prof/etablissements                     200 -> EtablissementPublic[]
 *   POST  /api/prof/etablissements                     201 -> EtablissementPublic · 404
 *   POST  /api/prof/classes                            201 -> ClasseInfo · 403 not attached
 *   POST  /api/prof/classes/{id}/code                  201 -> CodeClasseCreee · 403 · 404
 *   GET   /api/classes/{id}/codes/actif                200 -> CodeClasseInfo · 404 no active code
 *   GET   /api/classes/{id}/inscriptions               200 -> InscriptionInfo[] · 403
 *   PATCH /api/classes/{id}/inscriptions/{compteId}    200 -> InscriptionInfo · 403 · 404
 */

export type ClasseInfo = components['schemas']['ClasseInfo']

/** The teacher's active classes, with labels. Empty when the teacher runs no class. */
export async function listerMesClasses(baseUrl: string): Promise<ClasseInfo[]> {
  const client = createApiClient(baseUrl)
  const { data, error, response } = await client.GET('/api/prof/classes')
  if (error || !data) {
    throw new CoursApiError(response.status, 'Impossible de charger vos classes.')
  }
  return data
}

// --- Responses validated at the boundary ---

const ClasseInfoSchema = z.object({
  id: z.string(),
  etablissementId: z.string(),
  niveauCode: z.string(),
  libelle: z.string(),
  anneeScolaire: z.string(),
  statut: z.string(),
  enseignantPrincipalId: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
})

/** Returned once at generation: the only response that carries the raw code (ADR 0018 §6). */
export const CodeClasseCreeeSchema = z.object({
  id: z.string(),
  code: z.string(),
  expireAt: z.string(),
  usages: z.number(),
  usagesMax: z.number(),
})
export type CodeClasseCreee = z.infer<typeof CodeClasseCreeeSchema>

/** What can be known of a code afterwards: it is stored hashed, so never the code itself. */
export const CodeClasseInfoSchema = z.object({
  id: z.string(),
  expireAt: z.string(),
  usages: z.number(),
  usagesMax: z.number(),
})
export type CodeClasseInfo = z.infer<typeof CodeClasseInfoSchema>

/** A student of the class. `homonyme` flags a display name shared within it (ADR 0016 §3). */
export const InscriptionInfoSchema = z.object({
  compteId: z.string(),
  nomAffiche: z.string(),
  depuis: z.string(),
  homonyme: z.boolean(),
})
export type InscriptionInfo = z.infer<typeof InscriptionInfoSchema>

export type CreerMaClasseInput = {
  etablissementId: string
  niveauCode: string
  libelle: string
}

function classeError(status: number, fallback: string): CoursApiError {
  const message =
    status === 401
      ? 'Votre session a expiré. Reconnectez-vous pour continuer.'
      : status === 403
        ? "Vous n'avez pas accès à cette classe."
        : status === 404
          ? 'Cette classe est introuvable.'
          : fallback
  return new CoursApiError(status, message)
}

async function mutation(baseUrl: string, method: string, path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...csrfHeaders(await ensureCsrfToken(baseUrl)),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// --- Établissements ---

/** The établissements the teacher is attached to — where they may create a class. */
export async function listerMesEtablissements(baseUrl: string): Promise<EtablissementPublic[]> {
  const res = await fetch(`${baseUrl}/api/prof/etablissements`, { credentials: 'include' })
  if (!res.ok) throw classeError(res.status, 'Impossible de charger vos établissements.')
  return z.array(EtablissementPublicSchema).parse(await res.json())
}

/** Attach the teacher to one more existing établissement (a replacement teacher has several). */
export async function rattacherEtablissement(
  baseUrl: string,
  etablissementId: string
): Promise<EtablissementPublic> {
  const res = await mutation(baseUrl, 'POST', '/api/prof/etablissements', { etablissementId })
  if (!res.ok) {
    throw new CoursApiError(
      res.status,
      res.status === 404
        ? 'Cet établissement est introuvable.'
        : "Impossible d'ajouter cet établissement."
    )
  }
  return EtablissementPublicSchema.parse(await res.json())
}

// --- Classes ---

/** Create a class the teacher becomes the principal of. The server computes the school year. */
export async function creerMaClasse(
  baseUrl: string,
  input: CreerMaClasseInput
): Promise<ClasseInfo> {
  const res = await mutation(baseUrl, 'POST', '/api/prof/classes', input)
  if (!res.ok) {
    throw new CoursApiError(
      res.status,
      res.status === 403
        ? "Vous n'êtes pas rattaché à cet établissement."
        : res.status === 400
          ? 'Vérifiez le niveau et le nom de la classe.'
          : 'Impossible de créer la classe.'
    )
  }
  return ClasseInfoSchema.parse(await res.json())
}

// --- Class code ---

/** Generate the class code. Any previous code stops working; the new one is shown once. */
export async function genererCodeClasse(
  baseUrl: string,
  classeId: string
): Promise<CodeClasseCreee> {
  const res = await mutation(
    baseUrl,
    'POST',
    `/api/prof/classes/${encodeURIComponent(classeId)}/code`
  )
  if (!res.ok) throw classeError(res.status, 'Impossible de générer le code.')
  return CodeClasseCreeeSchema.parse(await res.json())
}

/** The active code's expiry and usage, or `null` when the class has no active code. */
export async function getCodeClasse(
  baseUrl: string,
  classeId: string
): Promise<CodeClasseInfo | null> {
  const res = await fetch(`${baseUrl}/api/classes/${encodeURIComponent(classeId)}/codes/actif`, {
    credentials: 'include',
  })
  if (res.status === 404) return null
  if (!res.ok) throw classeError(res.status, 'Impossible de charger le code de la classe.')
  return CodeClasseInfoSchema.parse(await res.json())
}

// --- Roster ---

/** The students of a class the teacher is the principal of. */
export async function listerInscrits(
  baseUrl: string,
  classeId: string
): Promise<InscriptionInfo[]> {
  const res = await fetch(`${baseUrl}/api/classes/${encodeURIComponent(classeId)}/inscriptions`, {
    credentials: 'include',
  })
  if (!res.ok) throw classeError(res.status, 'Impossible de charger les élèves de la classe.')
  return z.array(InscriptionInfoSchema).parse(await res.json())
}

/** Change the name a student is shown under in this class (ADR 0016 §3). */
export async function renommerEleve(
  baseUrl: string,
  classeId: string,
  compteId: string,
  nomAffiche: string
): Promise<InscriptionInfo> {
  const res = await mutation(
    baseUrl,
    'PATCH',
    `/api/classes/${encodeURIComponent(classeId)}/inscriptions/${encodeURIComponent(compteId)}`,
    { nomAffiche }
  )
  if (!res.ok) {
    throw new CoursApiError(
      res.status,
      res.status === 400
        ? 'Le nom doit faire entre 1 et 30 caractères.'
        : res.status === 404
          ? "Cet élève n'est plus dans la classe."
          : classeError(res.status, 'Impossible de renommer cet élève.').message
    )
  }
  return InscriptionInfoSchema.parse(await res.json())
}
