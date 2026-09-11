import {
  login as apiLogin,
  logout as apiLogout,
  getMoi as apiGetMoi,
  LoginError,
} from '@brio/api-client'
import type { CompteInfo } from '@brio/api-client'

// Same env var as lib/api.ts — the URL the browser calls for API requests.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

/** Log in with an identifier (login name or e-mail) and password. */
export function login(identifiant: string, motDePasse: string): Promise<CompteInfo> {
  return apiLogin(API_URL, identifiant, motDePasse)
}

/** End the current session. */
export function logout(): Promise<void> {
  return apiLogout(API_URL)
}

/** Return the currently authenticated account, or null when not logged in. */
export function getMoi(): Promise<CompteInfo | null> {
  return apiGetMoi(API_URL)
}

export { LoginError }
export type { CompteInfo }
