import { ChapterView } from '@/components/chapter-view'
import { getCatalogue, getChapitreByTriplet } from '@/lib/api'
import Link from 'next/link'

export async function generateStaticParams() {
  const catalogue = await getCatalogue()
  return catalogue.flatMap(({ niveauCode, matieres }) =>
    matieres.flatMap(({ matiereCode, chapitres }) =>
      chapitres.map(({ slug }) => ({ niveau: niveauCode, matiere: matiereCode, slug }))
    )
  )
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ niveau: string; matiere: string; slug: string }>
}) {
  const { niveau, matiere, slug } = await params

  try {
    const chapitre = await getChapitreByTriplet(niveau, matiere, slug)
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <nav className="mb-6">
          <Link
            href={`/${niveau}/${matiere}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Retour
          </Link>
        </nav>
        <ChapterView chapitre={chapitre} />
      </main>
    )
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <nav className="mb-6">
          <Link
            href={`/${niveau}/${matiere}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Retour
          </Link>
        </nav>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Chapitre introuvable</p>
          <p className="mt-1 text-sm">
            Le chapitre{' '}
            <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs">{slug}</code>{' '}
            n&apos;est pas disponible ou le serveur est inaccessible.
          </p>
        </div>
      </main>
    )
  }
}
