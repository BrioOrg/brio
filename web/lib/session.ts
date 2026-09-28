import {
  login as apiLogin,
  logout as apiLogout,
  getMoi as apiGetMoi,
  LoginError,
} from '@brio/api-client'
import type { CompteInfo } from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'

// Same env var as lib/api.ts — the URL the browser calls for API requests.
/** Log in with an identifier (login name or e-mail) and password. */
export function login(identifiant: string, motDePasse: string): Promise<CompteInfo> {
  return apiLogin(apiBaseUrl(), identifiant, motDePasse)
}

/** End the current session. */
export function logout(): Promise<void> {
  return apiLogout(apiBaseUrl())
}

/** Return the currently authenticated account, or null when not logged in. */
export function getMoi(): Promise<CompteInfo | null> {
  return apiGetMoi(apiBaseUrl())
}

export { LoginError }
export type { CompteInfo }
