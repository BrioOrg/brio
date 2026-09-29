import type { Metadata } from 'next'

import { TableauDeBordDevoirVue } from '@/components/prof/tableau-de-bord-devoir'

export const metadata: Metadata = {
  title: 'Tableau de bord — Brio',
}

export default async function TableauDeBordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TableauDeBordDevoirVue devoirId={id} />
}
