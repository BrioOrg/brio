import type { Metadata } from 'next'

import { DevoirsProf } from '@/components/prof/devoirs-prof'

export const metadata: Metadata = {
  title: 'Devoirs — Brio',
}

export default function DevoirsProfPage() {
  return <DevoirsProf />
}
