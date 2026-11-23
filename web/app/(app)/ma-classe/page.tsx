import { cookies } from 'next/headers'

import { OngletAFaire } from '@/components/ma-classe/onglets'
import { getCatalogue, getCoursVisibles, type CoursVisible } from '@/lib/api'
import { cheminsChapitres } from '@/lib/lien-devoir'

export const dynamic = 'force-dynamic'

export default async function AFairePage() {
  const cookie = (await cookies()).toString()
  // Both reads start together; a failed one leaves its part out instead of breaking the page.
  const [catalogue, cours] = await Promise.all([
    getCatalogue().catch(() => []),
    getCoursVisibles(cookie).catch((): CoursVisible[] => []),
  ])
  // The course cards only read the subject labels: drop the chapters from what reaches the client.
  const libelles = catalogue.map((n) => ({
    ...n,
    matieres: n.matieres.map((m) => ({ ...m, chapitres: [] })),
  }))
  // A chapter homework only knows its slug: its URL comes from the catalogue.
  return (
    <OngletAFaire
      cheminsChapitres={cheminsChapitres(catalogue)}
      cours={cours}
      catalogue={libelles}
    />
  )
}
