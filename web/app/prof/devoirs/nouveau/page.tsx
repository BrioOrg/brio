import type { Metadata } from 'next'

import { CreerDevoir } from '@/components/prof/creer-devoir'

export const metadata: Metadata = {
  title: 'Nouveau devoir — Brio',
}

export default function NouveauDevoirPage() {
  return <CreerDevoir />
}
