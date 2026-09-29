import type { Metadata } from 'next'

import { AnnalesEleve } from '@/components/annales-eleve'

export const metadata: Metadata = {
  title: 'Annales — Brio',
}

export default function AnnalesPage() {
  return <AnnalesEleve />
}
