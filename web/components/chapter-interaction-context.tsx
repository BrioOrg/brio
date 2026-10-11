'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { TuteurReponse } from '@/lib/api'
import { DEFAULT_TUTOR_REQUEST_CAP } from '@/lib/tutor-config'

export type EchangeTuteur = { question: string; response: TuteurReponse }

type ChapterInteraction = {
  activeExerciceId: string | null
  setActiveExerciceId: (id: string) => void
  tutorRequestCap: number
  /**
   * The tutor conversation of this page. The rail, the mobile sheet and the interactive mode's
   * drawer each mount their own panel; they share this one, so the cap counts every question
   * of the session wherever it was asked (#250).
   */
  echangesTuteur: readonly EchangeTuteur[]
  ajouterEchangeTuteur: (echange: EchangeTuteur) => void
}

const ChapterInteractionContext = createContext<ChapterInteraction>({
  activeExerciceId: null,
  setActiveExerciceId: () => {},
  tutorRequestCap: DEFAULT_TUTOR_REQUEST_CAP,
  echangesTuteur: [],
  ajouterEchangeTuteur: () => {},
})

type ChapterInteractionProviderProps = {
  children: React.ReactNode
  // Server config, read by the page at request time (lib/tutor-config.ts).
  tutorRequestCap?: number
}

export function ChapterInteractionProvider({
  children,
  tutorRequestCap = DEFAULT_TUTOR_REQUEST_CAP,
}: ChapterInteractionProviderProps) {
  const [activeExerciceId, setActiveExerciceId] = useState<string | null>(null)
  const [echangesTuteur, setEchangesTuteur] = useState<readonly EchangeTuteur[]>([])
  const ajouterEchangeTuteur = useCallback(
    (echange: EchangeTuteur) => setEchangesTuteur((prev) => [...prev, echange]),
    []
  )
  const value = useMemo(
    () => ({
      activeExerciceId,
      setActiveExerciceId,
      tutorRequestCap,
      echangesTuteur,
      ajouterEchangeTuteur,
    }),
    [activeExerciceId, tutorRequestCap, echangesTuteur, ajouterEchangeTuteur]
  )
  return (
    <ChapterInteractionContext.Provider value={value}>
      {children}
    </ChapterInteractionContext.Provider>
  )
}

export function useChapterInteraction() {
  return useContext(ChapterInteractionContext)
}
