import { OngletAFaire } from '@/components/ma-classe/onglets'
import { getCatalogue } from '@/lib/api'
import { cheminsChapitres } from '@/lib/lien-devoir'

export const dynamic = 'force-dynamic'

export default async function AFairePage() {
  const catalogue = await getCatalogue().catch(() => [])
  // A chapter homework only knows its slug: its URL comes from the catalogue.
  return <OngletAFaire cheminsChapitres={cheminsChapitres(catalogue)} />
}
