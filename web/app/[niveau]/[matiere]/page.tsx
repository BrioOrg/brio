import Link from 'next/link'
import { getCatalogue } from '@/lib/api'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const catalogue = await getCatalogue()
  return catalogue.flatMap(({ niveauCode, matieres }) =>
    matieres.map(({ matiereCode }) => ({ niveau: niveauCode, matiere: matiereCode }))
  )
}

export default async function MatierePage({
  params,
}: {
  params: Promise<{ niveau: string; matiere: string }>
}) {
  const { niveau, matiere } = await params
  const catalogue = await getCatalogue()
  const niveauEntry = catalogue.find((n) => n.niveauCode === niveau)
  const matiereEntry = niveauEntry?.matieres.find((m) => m.matiereCode === matiere)
  if (!niveauEntry || !matiereEntry) notFound()

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <nav className="mb-6">
        <Link href={`/${niveau}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {niveauEntry.niveauLibelle}
        </Link>
      </nav>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">{matiereEntry.matiereLibelle}</h1>
      <p className="mb-8 text-gray-500">{niveauEntry.niveauLibelle}</p>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Cours disponibles
        </h2>
        <ul className="space-y-2">
          {matiereEntry.chapitres.map(({ slug, titre, dureeEstimeeMinutes }) => (
            <li key={slug}>
              <Link
                href={`/${niveau}/${matiere}/${slug}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-gray-900">{titre}</p>
                <p className="mt-0.5 text-sm text-gray-500">{dureeEstimeeMinutes} min</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
