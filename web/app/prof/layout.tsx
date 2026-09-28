import 'katex/dist/katex.min.css'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { CompteInfoSchema } from '@brio/api-client'
import { apiBaseUrl } from '@/lib/api-base-url'

/**
 * Role gate for the teacher space. The middleware only checks that a session cookie
 * is present — JSESSIONID is opaque, so the role can't be read there. Here we ask the
 * backend who the caller is and let only ENSEIGNANT accounts through. This mirrors the
 * backend gate on /api/prof/** ; it exists so non-teachers see a redirect, not a broken page.
 */
export default async function ProfLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const res = await fetch(`${apiBaseUrl()}/api/moi`, {
    headers: { cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  // No live session (expired or absent): send to login, keeping the return path.
  if (!res.ok) redirect('/connexion?from=/prof')

  const moi = CompteInfoSchema.parse(await res.json())
  // Authenticated but not a teacher: the teacher space is not theirs.
  if (moi.role !== 'enseignant') redirect('/')

  return <>{children}</>
}
