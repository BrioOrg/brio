'use client'

import { CoursDeTaClasse } from '@/components/cours-de-ta-classe'
import { DevoirsEleve } from '@/components/devoirs-eleve'
import { useClasseChoisie } from '@/components/ma-classe/espace-classe'
import { SalonClasse } from '@/components/messagerie/salon-classe'
import { EmptyState } from '@/components/ui/empty-state'
import type { Catalogue, CoursVisible } from '@/lib/api'

// The three tabs of Ma classe, each one scoped to the class picked in the header.

// The latest courses shown under the homework to do; the tab « Cours de ta classe » lists them all.
const PLAFOND_COURS_A_FAIRE = 3

const coursDeLaClasse = (cours: CoursVisible[], classeId: string) =>
  cours.filter((c) => c.classeIds.includes(classeId))

export function OngletAFaire({
  cheminsChapitres,
  cours = [],
  catalogue = [],
}: {
  cheminsChapitres: Record<string, string>
  cours?: CoursVisible[]
  catalogue?: Catalogue
}) {
  const { id } = useClasseChoisie()
  const duneClasse = coursDeLaClasse(cours, id)
  return (
    <DevoirsEleve
      classeId={id}
      cheminsChapitres={cheminsChapitres}
      apresAFaire={
        duneClasse.length > 0 ? (
          <CoursDeTaClasse
            cours={duneClasse}
            catalogue={catalogue}
            plafond={PLAFOND_COURS_A_FAIRE}
          />
        ) : null
      }
    />
  )
}

export function OngletCours({ cours, catalogue }: { cours: CoursVisible[]; catalogue: Catalogue }) {
  const { id } = useClasseChoisie()
  const duneClasse = coursDeLaClasse(cours, id)
  if (duneClasse.length === 0) {
    return (
      <EmptyState
        icon="book-open"
        title="Pas encore de cours dans ta classe"
        description="Les cours publiés pour ta classe apparaîtront ici."
      />
    )
  }
  return <CoursDeTaClasse cours={duneClasse} catalogue={catalogue} />
}

export function OngletSalon() {
  const { id } = useClasseChoisie()
  return <SalonClasse classeId={id} />
}
