import {
  ChapitreAReprendreSchema,
  CompteInfoSchema,
  DevoirEleveVueSchema,
  MaClasseSchema,
  MaitriseInfoSchema,
  ProgressionInfoSchema,
  SerieInfoSchema,
  type DevoirEleveVue,
  type MaitriseInfo,
} from '@brio/api-client'
import { z } from 'zod'

import { apiBaseUrl } from '@/lib/api-base-url'

const LibellesSchema = z.array(z.object({ code: z.string(), intitule: z.string() }))

/**
 * Server-side read of a student endpoint, relaying the request's cookies. Null for a failure and
 * for a 204: Accueil and Profil drop the block, and never show a value the backend did not give.
 */
async function lire<S extends z.ZodTypeAny>(
  chemin: string,
  schema: S,
  cookieHeader: string
): Promise<z.infer<S> | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}${chemin}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok || res.status === 204) return null
    const parsed = schema.safeParse(await res.json())
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export const lireMoi = (cookie: string) => lire('/api/moi', CompteInfoSchema, cookie)
export const lireClasses = (cookie: string) =>
  lire('/api/moi/classes', z.array(MaClasseSchema), cookie)
export const lireDevoirs = (cookie: string) =>
  lire('/api/devoirs', z.array(DevoirEleveVueSchema), cookie)
export const lireReprendre = (cookie: string) =>
  lire('/api/progression/reprendre', ChapitreAReprendreSchema, cookie)
export const lireMaitrise = (cookie: string) =>
  lire('/api/progression/maitrise', z.array(MaitriseInfoSchema), cookie)
export const lireProgression = (cookie: string) =>
  lire('/api/progression/moi', ProgressionInfoSchema, cookie)
export const lireSerie = (cookie: string) => lire('/api/progression/serie', SerieInfoSchema, cookie)

/** Competency labels by code. A code without a label is never shown to a student. */
export async function lireLibelles(cookie: string): Promise<Map<string, string>> {
  const libelles = await lire('/api/referentiel/libelles', LibellesSchema, cookie)
  return new Map((libelles ?? []).map(({ code, intitule }) => [code, intitule]))
}

/** The homework still to hand in, soonest first: the same "à faire" as Ma classe. */
export function prochainsDevoirs(devoirs: DevoirEleveVue[], nombre: number): DevoirEleveVue[] {
  return devoirs
    .filter((d) => !d.corrige && d.statutRendu !== 'rendu')
    .sort((a, b) => Date.parse(a.echeanceAt) - Date.parse(b.echeanceAt))
    .slice(0, nombre)
}

const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * The competence to review: the lowest mastery among those worked in the last 30 days. One with no
 * honest level yet, or no label to show, cannot be picked.
 */
export function competenceARevoir(
  maitrises: MaitriseInfo[],
  libelles: Map<string, string>,
  maintenant: Date
): { code: string; intitule: string } | null {
  const depuis = maintenant.getTime() - TRENTE_JOURS_MS
  let meilleure: (MaitriseInfo & { niveau: number }) | null = null
  for (const m of maitrises) {
    if (m.niveau == null || !libelles.has(m.competenceCode) || !m.dernierTravail) continue
    if (Date.parse(m.dernierTravail) < depuis) continue
    if (!meilleure || m.niveau < meilleure.niveau) meilleure = { ...m, niveau: m.niveau }
  }
  if (!meilleure) return null
  return {
    code: meilleure.competenceCode,
    intitule: libelles.get(meilleure.competenceCode) ?? '',
  }
}
