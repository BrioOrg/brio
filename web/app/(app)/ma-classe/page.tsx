import { OngletAFaire } from '@/components/ma-classe/onglets'
import { getCatalogue } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function AFairePage() {
  const catalogue = await getCatalogue().catch(() => [])
  // A chapter homework only knows its slug: its URL comes from the catalogue.
  const cheminsChapitres = Object.fromEntries(
    catalogue.flatMap(({ niveauCode, matieres }) =>
      matieres.flatMap(({ matiereCode, chapitres }) =>
        chapitres.map(({ slug }) => [slug, `/${niveauCode}/${matiereCode}/${slug}`])
      )
    )
  )

  return <OngletAFaire cheminsChapitres={cheminsChapitres} />
}
