import type { Metadata } from 'next'

import { DevoirsEleve } from '@/components/devoirs-eleve'

export const metadata: Metadata = {
  title: 'Mes devoirs — Brio',
}

export default function DevoirsElevePage() {
  return <DevoirsEleve />
}
