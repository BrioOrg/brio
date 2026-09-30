import type { Metadata } from 'next'

import { MesClasses } from '@/components/prof/mes-classes'

export const metadata: Metadata = {
  title: 'Mes classes — Brio',
}

export default function MesClassesPage() {
  return <MesClasses />
}
