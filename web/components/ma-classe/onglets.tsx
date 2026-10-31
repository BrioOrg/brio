'use client'

import { CoursDeTaClasse } from '@/components/cours-de-ta-classe'
import { DevoirsEleve } from '@/components/devoirs-eleve'
import { useClasseChoisie } from '@/components/ma-classe/espace-classe'
import { SalonClasse } from '@/components/messagerie/salon-classe'
import { EmptyState } from '@/components/ui/empty-state'
import type { Catalogue, CoursVisible } from '@/lib/api'

// The three tabs of Ma classe, each one scoped to the class picked in the header.

export function OngletAFaire({ cheminsChapitres }: { cheminsChapitres: Record<string, string> }) {
  const { id } = useClasseChoisie()
  return <DevoirsEleve classeId={id} cheminsChapitres={cheminsChapitres} />
}

export function OngletCours({ cours, catalogue }: { cours: CoursVisible[]; catalogue: Catalogue }) {
  const { id } = useClasseChoisie()
  const duneClasse = cours.filter((c) => c.classeIds.includes(id))
  if (duneClasse.length === 0) {
    return (
      <EmptyState
        icon="book-open"
        title="Pas encore de cours ici"
        description="Les cours de ton prof pour cette classe apparaîtront ici dès qu’ils seront publiés."
      />
    )
  }
  return <CoursDeTaClasse cours={duneClasse} catalogue={catalogue} />
}

export function OngletSalon() {
  const { id } = useClasseChoisie()
  return <SalonClasse classeId={id} />
}
