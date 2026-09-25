import type { Metadata } from 'next'

import { MesCours } from '@/components/prof/mes-cours'

export const metadata: Metadata = {
  title: 'Mes cours — Brio',
}

// Accueil de l'espace enseignant. Hors du groupe (app) : pas de barre de navigation élève.
export default function ProfAccueilPage() {
  return <MesCours />
}
