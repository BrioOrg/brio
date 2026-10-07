'use client'

import { createContext, useContext } from 'react'

const EntraideContext = createContext(false)

/**
 * Turns on class entraide for the exercises below it. Only catalogue chapters provide it:
 * teacher courses have no thread scope yet (#208), and a draft preview never does.
 */
export function EntraideProvider({ children }: { children: React.ReactNode }) {
  return <EntraideContext.Provider value={true}>{children}</EntraideContext.Provider>
}

export function useEntraideActive(): boolean {
  return useContext(EntraideContext)
}
