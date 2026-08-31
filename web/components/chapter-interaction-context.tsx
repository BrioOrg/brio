'use client'

import { createContext, useContext, useState } from 'react'

type ChapterInteraction = {
  activeExerciceId: string | null
  setActiveExerciceId: (id: string) => void
}

const ChapterInteractionContext = createContext<ChapterInteraction>({
  activeExerciceId: null,
  setActiveExerciceId: () => {},
})

export function ChapterInteractionProvider({ children }: { children: React.ReactNode }) {
  const [activeExerciceId, setActiveExerciceId] = useState<string | null>(null)
  return (
    <ChapterInteractionContext.Provider value={{ activeExerciceId, setActiveExerciceId }}>
      {children}
    </ChapterInteractionContext.Provider>
  )
}

export function useChapterInteraction() {
  return useContext(ChapterInteractionContext)
}
