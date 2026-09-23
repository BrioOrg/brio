import type { Metadata } from 'next'

import { EditeurCours } from '@/components/prof/editeur-cours'

export const metadata: Metadata = {
  title: 'Écrire un cours — Brio',
}

// Éditeur d'un cours d'enseignant (piste 4). Outil plein écran, hors du groupe (app).
export default async function EditeurCoursPage({
  params,
}: {
  params: Promise<{ coursId: string }>
}) {
  const { coursId } = await params
  return <EditeurCours coursId={coursId} />
}
