'use client'

import { createContext, useContext, useState } from 'react'
import { DEFAULT_TUTOR_REQUEST_CAP } from '@/lib/tutor-config'

type ChapterInteraction = {
  activeExerciceId: string | null
  setActiveExerciceId: (id: string) => void
  tutorRequestCap: number
}

const ChapterInteractionContext = createContext<ChapterInteraction>({
  activeExerciceId: null,
  setActiveExerciceId: () => {},
  tutorRequestCap: DEFAULT_TUTOR_REQUEST_CAP,
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
  return (
    <ChapterInteractionContext.Provider
      value={{ activeExerciceId, setActiveExerciceId, tutorRequestCap }}
    >
      {children}
    </ChapterInteractionContext.Provider>
  )
}

export function useChapterInteraction() {
  return useContext(ChapterInteractionContext)
}
