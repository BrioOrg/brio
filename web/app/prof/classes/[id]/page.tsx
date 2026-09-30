import type { Metadata } from 'next'

import { ClasseDetail } from '@/components/prof/classe-detail'

export const metadata: Metadata = {
  title: 'Classe — Brio',
}

export default async function ClassePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClasseDetail classeId={id} />
}
