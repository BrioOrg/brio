import { cookies } from 'next/headers'

import { OngletCours } from '@/components/ma-classe/onglets'
import { getCatalogue, getCoursVisibles, type CoursVisible } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function CoursDuProfPage() {
  const cookieStore = await cookies()
  const [catalogue, cours] = await Promise.all([
    getCatalogue().catch(() => []),
    getCoursVisibles(cookieStore.toString()).catch((): CoursVisible[] => []),
  ])

  return <OngletCours cours={cours} catalogue={catalogue} />
}
