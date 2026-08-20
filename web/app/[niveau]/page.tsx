import Link from 'next/link'
import { getCatalogue } from '@/lib/api'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const catalogue = await getCatalogue()
  return catalogue.map(({ niveauCode }) => ({ niveau: niveauCode }))
}

export default async function NiveauPage({ params }: { params: Promise<{ niveau: string }> }) {
  const { niveau } = await params
  const catalogue = await getCatalogue()
  const entry = catalogue.find((n) => n.niveauCode === niveau)
  if (!entry) notFound()

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Accueil
        </Link>
      </nav>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">{entry.niveauLibelle}</h1>
      <p className="mb-8 text-gray-500">{entry.niveauCode}</p>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Matières
        </h2>
        <ul className="space-y-2">
          {entry.matieres.map(({ matiereCode, matiereLibelle }) => (
            <li key={matiereCode}>
              <Link
                href={`/${niveau}/${matiereCode}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-gray-900">{matiereLibelle}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
